import AsyncStorage from '@react-native-async-storage/async-storage';

// Exchange rates into AUD, from the European Central Bank (via Frankfurter, free, no key).
// Cached on the phone for 12 hours; falls back to the last saved rates, then to rough defaults.
export type Rates = { USD: number; EUR: number; date: string; source: 'live' | 'saved' | 'default' };

const KEY = 'holobinder.fx.v1';
const DEFAULT: Rates = { USD: 1.53, EUR: 1.66, date: '', source: 'default' };
const MAX_AGE = 12 * 60 * 60 * 1000;

let memo: Rates | null = null;
let pending: Promise<Rates> | null = null;

async function fetchLive(): Promise<Rates> {
  const [usd, eur] = await Promise.all([
    fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=AUD').then(r => r.json()),
    fetch('https://api.frankfurter.dev/v1/latest?from=EUR&to=AUD').then(r => r.json()),
  ]);
  const USD = Number(usd?.rates?.AUD), EUR = Number(eur?.rates?.AUD);
  if (!(USD > 0) || !(EUR > 0)) throw new Error('bad rates');
  return { USD, EUR, date: String(usd.date ?? ''), source: 'live' };
}

export function getRates(): Promise<Rates> {
  if (memo && memo.source === 'live') return Promise.resolve(memo);
  if (pending) return pending;
  pending = (async () => {
    let saved: (Rates & { at: number }) | null = null;
    try { saved = JSON.parse((await AsyncStorage.getItem(KEY)) ?? 'null'); } catch {}
    if (saved && Date.now() - saved.at < MAX_AGE) return (memo = { ...saved, source: 'live' as const });
    try {
      const live = await fetchLive();
      AsyncStorage.setItem(KEY, JSON.stringify({ ...live, at: Date.now() })).catch(() => {});
      return (memo = live);
    } catch {
      return (memo = saved ? { ...saved, source: 'saved' as const } : DEFAULT);
    }
  })().finally(() => { pending = null; });
  return pending;
}

export function aud(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '–';
  if (n < 10) return 'A$' + n.toFixed(2);
  return 'A$' + Math.round(n).toLocaleString('en-AU');
}
