import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Grade, GradedPrices } from './ai';
import type { RawPrice } from './tcg';

// The binder: always saved on this phone, and synced to your account when you're signed in.
// Each card is one row; the newest change wins. Removing a card leaves a "deleted" marker so the
// removal reaches your other devices too.

export type BinderItem = {
  id: string;
  cardId: string | null;      // Pokémon TCG API id, when the card was matched
  name: string;
  setName: string;
  number: string;
  rarity: string;
  variant: string;
  image: string | null;       // official card image
  qty: number;
  raw: RawPrice | null;       // live ungraded price, AUD
  rawEstimate: { low: number | null; mid: number | null; high: number | null } | null; // Claude's estimate when no live price
  graded: GradedPrices | null;
  grade: Grade | null;
  notes: string;
  addedAt: number;
  pricedAt: number | null;
  updatedAt: number;
  deleted?: boolean;
};

export type SyncState = 'device' | 'syncing' | 'synced' | 'offline';

const KEY = 'holobinder.binder.v1';
let items = new Map<string, BinderItem>();
let loaded = false;
let userId: string | null = null;
let state: SyncState = 'device';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const newId = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// Each account has its own copy on the device; cards added while signed out are kept under the guest key
// (the original single key, so cards saved before this change are kept too) until someone signs in.
const GUEST_KEY = KEY;
const keyFor = (uid: string | null) => (uid ? `slabbed.binder.${uid}` : GUEST_KEY);

async function read(key: string): Promise<Map<string, BinderItem>> {
  const m = new Map<string, BinderItem>();
  try {
    const arr: BinderItem[] = JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');
    for (const it of arr) if (it?.id) m.set(it.id, it);
  } catch {}
  return m;
}

let loading: Promise<void> | null = null;
async function load() {
  if (loaded) return;
  if (!loading) loading = (async () => { items = await read(keyFor(userId)); loaded = true; emit(); })();
  return loading;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function save() {
  clearTimeout(saveTimer);
  const key = keyFor(userId), snapshot = JSON.stringify([...items.values()]);
  saveTimer = setTimeout(() => { AsyncStorage.setItem(key, snapshot).catch(() => {}); }, 150);
}
function flush() {
  clearTimeout(saveTimer);
  return AsyncStorage.setItem(keyFor(userId), JSON.stringify([...items.values()])).catch(() => {});
}
function setState(s: SyncState) { state = s; emit(); }

async function push(list: BinderItem[], uid = userId) {
  if (!uid || !list.length) return;
  const rows = list.map(it => ({ id: it.id, user_id: uid, data: it, updated_at: it.updatedAt, deleted: !!it.deleted }));
  const { error } = await supabase.from('binder_items').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function sync() {
  await load();
  const uid = userId;
  if (!uid) return setState('device');
  setState('syncing');
  try {
    const { data, error } = await supabase.from('binder_items').select('id,data,updated_at,deleted');
    if (error) throw error;
    if (userId !== uid) return; // switched account while this was loading
    const remote = new Map<string, number>();
    for (const row of data ?? []) {
      remote.set(row.id, Number(row.updated_at));
      const local = items.get(row.id);
      if (!local || Number(row.updated_at) > local.updatedAt) items.set(row.id, { ...(row.data as BinderItem), deleted: row.deleted });
    }
    const newer = [...items.values()].filter(it => !remote.has(it.id) || it.updatedAt > (remote.get(it.id) ?? 0));
    await push(newer, uid);
    if (userId !== uid) return;
    save();
    setState('synced');
  } catch {
    if (userId === uid) setState('offline');
  }
}

// Switch the binder to whoever is signed in (null = signed out).
let switching: Promise<void> = Promise.resolve();
export function setUser(id: string | null) {
  switching = switching.then(async () => {
    if (loaded && id === userId) return;
    if (loaded) await flush();
    userId = id;
    items = await read(keyFor(id));
    if (id) {
      // Cards added while signed out on this device move into this account.
      const guest = await read(GUEST_KEY);
      const now = Date.now();
      let moved = false;
      for (const [k, v] of guest) if (!v.deleted && !items.has(k)) { items.set(k, { ...v, updatedAt: now }); moved = true; }
      if (guest.size) await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
      if (moved) await flush();
    }
    loaded = true; loading = null;
    emit();
    await sync();
  });
  return switching;
}

export async function upsert(it: BinderItem) {
  await load();
  const next = { ...it, updatedAt: Date.now() };
  items.set(next.id, next);
  save(); emit();
  const uid = userId;
  if (uid) push([next], uid).then(() => { if (userId === uid) setState('synced'); }, () => { if (userId === uid) setState('offline'); });
  return next;
}

export async function remove(id: string) {
  const it = items.get(id);
  if (!it) return;
  await upsert({ ...it, deleted: true });
}

export function getItem(id: string) { return items.get(id); }

export function useBinder() {
  const [, bump] = useState(0);
  useEffect(() => {
    const l = () => bump(n => n + 1);
    listeners.add(l);
    load();
    return () => { listeners.delete(l); };
  }, []);
  const list = [...items.values()].filter(i => !i.deleted);
  return { items: list, state, loaded };
}

// Value used for totals: live raw price, else Claude's raw estimate.
export const unitValue = (i: BinderItem) => i.raw?.mid ?? i.rawEstimate?.mid ?? 0;
