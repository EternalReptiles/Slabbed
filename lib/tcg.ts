import { getRates } from './money';

// Pokémon TCG API (pokemontcg.io): every card, with official images and daily market prices from
// TCGplayer (USD) and Cardmarket (EUR). Works without a key at a lower rate limit.
const API = 'https://api.pokemontcg.io/v2';

type TcgPrice = { low?: number | null; mid?: number | null; high?: number | null; market?: number | null };
export type TcgCard = {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  supertype?: string;
  images: { small: string; large: string };
  set: { id: string; name: string; series: string; printedTotal?: number; releaseDate?: string; images?: { symbol?: string } };
  tcgplayer?: { url?: string; updatedAt?: string; prices?: Record<string, TcgPrice> };
  cardmarket?: { url?: string; updatedAt?: string; prices?: { trendPrice?: number; avg30?: number; lowPrice?: number; averageSellPrice?: number } };
};

export type RawPrice = {
  low: number | null;
  mid: number | null;
  high: number | null;
  source: 'TCGplayer' | 'Cardmarket';
  variant: string | null;
  updatedAt: string | null;
};

// Which TCGplayer price row to use when we don't know the variant: the common printing, not the rare one.
const VARIANT_ORDER = ['holofoil', 'unlimitedHolofoil', 'normal', 'reverseHolofoil', '1stEditionHolofoil', '1stEditionNormal'];

// Turn the scanner's description ("1st Edition Holo", "Reverse Holo") into a TCGplayer price row.
export function variantKey(text?: string | null): string | null {
  const t = (text ?? '').toLowerCase();
  if (!t) return null;
  if (t.includes('reverse')) return 'reverseHolofoil';
  if (t.includes('1st')) return t.includes('holo') ? '1stEditionHolofoil' : '1stEditionNormal';
  if (t.includes('holo')) return 'holofoil';
  return 'normal';
}
const VARIANT_LABEL: Record<string, string> = {
  '1stEditionHolofoil': '1st Edition Holo', holofoil: 'Holo', '1stEditionNormal': '1st Edition',
  unlimitedHolofoil: 'Unlimited Holo', normal: 'Normal', reverseHolofoil: 'Reverse Holo',
};
export const variantLabel = (k: string) => VARIANT_LABEL[k] ?? k;

// The card database often answers 500/502 and then succeeds a moment later, so retry a few times.
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let status = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 300 * attempt + Math.random() * 300));
    if (signal?.aborted) throw new Error('cancelled');
    try {
      const r = await fetch(API + path, { signal });
      if (r.ok) return r.json();
      status = r.status;
      if (status < 500 && status !== 429) break;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  throw new Error(status === 429 ? 'The card database is busy. Try again in a minute.'
    : status === 404 ? 'Card not found.' : "Couldn't reach the card database. Check your connection and try again.");
}

const esc = (s: string) => s.replace(/["\\]/g, '').trim();

export async function searchCards(text: string, signal?: AbortSignal): Promise<TcgCard[]> {
  const t = text.trim();
  if (!t) return [];
  // "Charizard 4/102" or "charizard 4" -> name + number; otherwise a name search.
  const m = t.match(/^(.*?)[\s#]+(\w+)(?:\/\w+)?$/);
  const parts: string[] = [];
  if (m && /\d/.test(m[2]) && m[1].trim()) parts.push(`name:"${esc(m[1])}*"`, `number:"${esc(m[2].replace(/^0+(?=\d)/, ''))}"`);
  else parts.push(`name:"${esc(t)}*"`);
  const q = encodeURIComponent(parts.join(' '));
  const res = await get<{ data: TcgCard[] }>(`/cards?q=${q}&orderBy=-set.releaseDate&pageSize=40`, signal);
  return res.data ?? [];
}

export async function getCard(id: string): Promise<TcgCard> {
  const res = await get<{ data: TcgCard }>(`/cards/${encodeURIComponent(id)}`);
  return res.data;
}

// Find the card the scanner identified: by set name + number first, then name + number, then name.
export async function matchCard(name: string, number: string, setName: string): Promise<TcgCard | null> {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
  const first = (number || '').split('/')[0].trim();
  const num = first.replace(/^0+(?=\d)/, '');            // "025" -> "25", "SV049" stays
  const nm = esc(name);
  const base = esc(name.replace(/\s+(ex|EX|GX|V|VMAX|VSTAR|BREAK|LV\.X|Prime|Star|δ)$/i, ''));
  const want = norm(setName);
  const sameNum = (c: TcgCard) => num && (norm(c.number) === norm(num) || norm(c.number) === norm(first));
  // Set names match by prefix ("Base" also finds "Base Set 2"), so prefer an exact set-name match.
  const best = (list: TcgCard[]) => list.find(c => want && norm(c.set.name) === want) ?? list[0];

  const tries: string[] = [];
  if (num && setName) tries.push(`name:"${nm}" number:"${esc(num)}" set.name:"${esc(setName)}"`);
  if (num) tries.push(`name:"${nm}" number:"${esc(num)}"`);
  if (num && first !== num) tries.push(`name:"${nm}" number:"${esc(first)}"`);
  if (num && base !== nm) tries.push(`name:"${base}*" number:"${esc(num)}"`);
  if (num && setName) tries.push(`number:"${esc(num)}" set.name:"${esc(setName)}"`);
  for (const q of tries) {
    try {
      const res = await get<{ data: TcgCard[] }>(`/cards?q=${encodeURIComponent(q)}&orderBy=-set.releaseDate&pageSize=10`);
      if (res.data?.length) return best(res.data);
    } catch {}
  }
  // Last try: every printing of the name, keep one with the same number (or the same set if no number).
  try {
    const res = await get<{ data: TcgCard[] }>(`/cards?q=${encodeURIComponent(`name:"${base}*"`)}&orderBy=-set.releaseDate&pageSize=250&select=id,name,number,rarity,images,set,tcgplayer,cardmarket`);
    const list = res.data ?? [];
    const byNum = list.filter(sameNum);
    if (byNum.length) return best(byNum);
    if (!num && want) return list.find(c => norm(c.set.name) === want) ?? null;
  } catch {}
  return null;
}

// Live raw (ungraded) price in AUD. Prefers TCGplayer's market price, falls back to Cardmarket's trend.
export async function rawPriceAud(card: TcgCard, preferVariant?: string | null): Promise<RawPrice | null> {
  const fx = await getRates();
  const prices = card.tcgplayer?.prices ?? {};
  const keys = Object.keys(prices);
  const key = (preferVariant && prices[preferVariant] ? preferVariant : null)
    ?? VARIANT_ORDER.find(k => prices[k]) ?? keys[0];
  if (key) {
    const p = prices[key];
    const mid = p.market ?? p.mid ?? null;
    if (mid != null) {
      const c = (n?: number | null) => (n == null ? null : n * fx.USD);
      return { low: c(p.low), mid: c(mid), high: c(p.high), source: 'TCGplayer', variant: key, updatedAt: card.tcgplayer?.updatedAt ?? null };
    }
  }
  const cm = card.cardmarket?.prices;
  const trend = cm?.trendPrice ?? cm?.avg30 ?? cm?.averageSellPrice;
  if (cm && trend != null) {
    const c = (n?: number | null) => (n == null ? null : n * fx.EUR);
    return { low: c(cm.lowPrice), mid: c(trend), high: null, source: 'Cardmarket', variant: null, updatedAt: card.cardmarket?.updatedAt ?? null };
  }
  return null;
}

export const ebaySold = (q: string) =>
  'https://www.ebay.com.au/sch/i.html?LH_Sold=1&LH_Complete=1&_nkw=' + encodeURIComponent(q);
