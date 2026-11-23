// Supabase Edge Function "scan": identifies Pokémon cards, pre-screens PSA grades and estimates
// graded prices with Claude. The Claude key is read from the ANTHROPIC_API_KEY secret and never
// leaves the server. Callers must be signed in; each account is capped per day to protect the bill.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = 'claude-opus-5-5';
const DAILY_LIMIT = 150;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const num = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const obj = (properties: Record<string, unknown>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});
const sub = obj({ score: { type: 'number' }, note: { type: 'string' } });

const IDENTIFY_SCHEMA = obj({
  found: { type: 'boolean' },
  name: { type: 'string' },
  set_name: { type: 'string' },
  number: { type: 'string' },
  year: { type: 'string' },
  rarity: { type: 'string' },
  variant: { type: 'string' },
  language: { type: 'string' },
  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  notes: { type: 'string' },
  raw_aud: obj({ low: num, mid: num, high: num }),
  graded_aud: obj({ psa8: num, psa9: num, psa10: num }),
});

const GRADE_SCHEMA = obj({
  most_likely: { type: 'number' },
  low: { type: 'number' },
  high: { type: 'number' },
  centering: obj({ score: { type: 'number' }, note: { type: 'string' }, front: { type: 'string' } }),
  corners: sub,
  edges: sub,
  surface: sub,
  photo_quality: { type: 'string', enum: ['good', 'fair', 'poor'] },
  worth_grading: { type: 'boolean' },
  advice: { type: 'string' },
});

const ESTIMATE_SCHEMA = obj({ graded_aud: obj({ psa8: num, psa9: num, psa10: num }), notes: { type: 'string' } });

const PRICING_RULES = `Give prices in AUSTRALIAN DOLLARS as whole numbers, based on your knowledge of recent sold prices (eBay sold listings, PriceCharting, TCGplayer, Cardmarket). Convert USD at about 1.53 AUD per USD and EUR at about 1.66. Use null where you genuinely cannot estimate. Be realistic, not optimistic.`;

const IDENTIFY_PROMPT = `You are an expert Pokémon Trading Card Game identifier and price guide for collectors in Australia.
The image(s) show one Pokémon card: the first image is the front, a second image (if present) is the back.
Identify the exact card: its name as printed, the set name (as used by the Pokémon TCG API, e.g. "Base", "Jungle", "Scarlet & Violet—151"), the collector number as printed (e.g. "4/102", "SV049/SV122", "TG05/TG30"), year, rarity, any visible variant (1st Edition stamp, Shadowless, Holo, Reverse Holo, promo stamp, etc.) and language.
Then estimate values: raw_aud is an ungraded near-mint copy (low / mid / high); graded_aud is the typical sold price at PSA 8, PSA 9 and PSA 10.
${PRICING_RULES}
If it is not a Pokémon card or you cannot read it, set found to false, leave the text fields empty, prices null, and explain in notes.
notes: one short sentence on what drives this card's value or any uncertainty in the identification.`;

const gradePrompt = (card?: Record<string, unknown>) => `You are an experienced PSA card-grading pre-screener. Examine the photo(s) of one Pokémon card (first image = front, second = back if present) and estimate the PSA grade it would likely receive.
${card ? `The card is: ${JSON.stringify(card)} (values in AUD).` : 'The card has not been identified.'}
Judge against PSA's standards:
- Centering: estimate the front border ratios left/right and top/bottom (PSA 10 needs about 55/45 or better on the front and 75/25 on the back). Put the ratios in centering.front, e.g. "60/40 L/R, 55/45 T/B".
- Corners: whitening, rounding, dings.
- Edges: whitening, chipping, nicks.
- Surface: scratches, print lines, dents, creases, stains, holo scratches.
Score each from 1 to 10. Photos hide small flaws, so be conservative and lower photo_quality when glare, blur or angle limits what you can see.
low/high is the realistic grade range; most_likely sits within it.
Assume grading a card from Australia costs about AUD 50–80 all-in at a standard service level. worth_grading is whether the likely graded value minus that cost clearly beats selling raw.
advice: one or two short, plain sentences for the owner.`;

const estimatePrompt = (card: Record<string, unknown>) => `You are a Pokémon TCG price guide for collectors in Australia.
Card: ${JSON.stringify(card)}
Estimate the typical recent sold price of this exact card at PSA 8, PSA 9 and PSA 10.
${PRICING_RULES}
notes: one short sentence on how confident you are and why.`;

type Img = { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg'; data: string } };
const img = (b64: string): Img => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } });

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

async function ask(content: Array<Img | { type: 'text'; text: string }>, schema: object, effort: 'low' | 'medium' | 'high') {
  // deno-lint-ignore no-explicit-any
  const res: any = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  } as never);
  if (res.stop_reason === 'refusal') throw new HttpError(422, 'The scanner could not process that photo. Try a clear photo of just the card.');
  if (res.stop_reason === 'max_tokens') throw new HttpError(502, 'The answer was cut short. Please try again.');
  // deno-lint-ignore no-explicit-any
  const text = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  return JSON.parse(text);
}

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

const MAX_B64 = 7_000_000; // about 5 MB per photo

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    if (!Deno.env.get('ANTHROPIC_API_KEY')) throw new HttpError(500, 'The scanner is not set up yet: the ANTHROPIC_API_KEY secret is missing.');

    // Signed-in users only.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) throw new HttpError(401, 'Sign in on the Account tab to scan cards.');

    // Daily cap per account.
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await sb.from('scan_log').select('id', { count: 'exact', head: true }).gte('created_at', since);
    if ((count ?? 0) >= DAILY_LIMIT) throw new HttpError(429, `You've reached today's limit of ${DAILY_LIMIT} scans. It resets over the next 24 hours.`);

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode ?? '');
    const front = typeof body.front === 'string' ? body.front : '';
    const back = typeof body.back === 'string' ? body.back : '';
    if ((mode === 'identify' || mode === 'grade') && !front) throw new HttpError(400, 'Add a photo of the front of the card.');
    if (front.length > MAX_B64 || back.length > MAX_B64) throw new HttpError(413, 'That photo is too large.');

    let result: unknown;
    if (mode === 'identify') {
      result = await ask([img(front), ...(back ? [img(back)] : []), { type: 'text', text: IDENTIFY_PROMPT }], IDENTIFY_SCHEMA, 'medium');
    } else if (mode === 'grade') {
      const card = body.card && typeof body.card === 'object' ? body.card : undefined;
      result = await ask([img(front), ...(back ? [img(back)] : []), { type: 'text', text: gradePrompt(card) }], GRADE_SCHEMA, 'high');
    } else if (mode === 'estimate') {
      if (!body.card || typeof body.card !== 'object') throw new HttpError(400, 'Missing card details.');
      result = await ask([{ type: 'text', text: estimatePrompt(body.card) }], ESTIMATE_SCHEMA, 'low');
    } else {
      throw new HttpError(400, 'Unknown request.');
    }

    await sb.from('scan_log').insert({ mode }).then(() => {}, () => {});
    return json(result);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'The Claude API key was rejected. Check the ANTHROPIC_API_KEY secret in Supabase.' }, 500);
    if (e instanceof Anthropic.PermissionDeniedError) return json({ error: 'The Claude API account has no access. Check billing at console.anthropic.com.' }, 500);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'The scanner is busy. Try again in a minute.' }, 429);
    if (e instanceof Anthropic.BadRequestError) {
      const m = String(e.message);
      if (/credit|billing/i.test(m)) return json({ error: 'Your Claude API credit has run out. Top up at console.anthropic.com.' }, 402);
      console.error('bad request', m);
      return json({ error: 'The scanner could not read that photo. Try another one.' }, 400);
    }
    if (e instanceof Anthropic.APIError) { console.error('api error', e.status, e.message); return json({ error: 'Claude is unavailable right now. Try again shortly.' }, 502); }
    console.error(e);
    return json({ error: 'Something went wrong. Try again.' }, 500);
  }
});
