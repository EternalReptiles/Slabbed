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

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const arr: BinderItem[] = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    for (const it of arr) if (it?.id) items.set(it.id, it);
  } catch {}
  emit();
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify([...items.values()])).catch(() => {}); }, 150);
}
function setState(s: SyncState) { state = s; emit(); }

async function push(list: BinderItem[]) {
  if (!userId || !list.length) return;
  const rows = list.map(it => ({ id: it.id, user_id: userId, data: it, updated_at: it.updatedAt, deleted: !!it.deleted }));
  const { error } = await supabase.from('binder_items').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function sync() {
  await load();
  if (!userId) return setState('device');
  setState('syncing');
  try {
    const { data, error } = await supabase.from('binder_items').select('id,data,updated_at,deleted');
    if (error) throw error;
    const remote = new Map<string, number>();
    for (const row of data ?? []) {
      remote.set(row.id, Number(row.updated_at));
      const local = items.get(row.id);
      if (!local || Number(row.updated_at) > local.updatedAt) items.set(row.id, { ...(row.data as BinderItem), deleted: row.deleted });
    }
    const newer = [...items.values()].filter(it => !remote.has(it.id) || it.updatedAt > (remote.get(it.id) ?? 0));
    await push(newer);
    save();
    setState('synced');
  } catch {
    setState('offline');
  }
}

export function setUser(id: string | null) {
  if (id === userId) return;
  userId = id;
  sync();
}

export async function upsert(it: BinderItem) {
  await load();
  const next = { ...it, updatedAt: Date.now() };
  items.set(next.id, next);
  save(); emit();
  if (userId) push([next]).then(() => setState('synced'), () => setState('offline'));
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
