# Holo Binder

A phone app (iPhone, Android and web) for Pokémon trading cards:

- **Scan** a card with the camera. Claude identifies it, and the app looks up its live raw price in AUD.
- **PSA pre-check**: an estimated grade range with centering, corners, edges and surface scores, and whether grading looks worth it.
- **Prices**: ungraded prices are live from the Pokémon TCG API (TCGplayer in USD, Cardmarket in EUR), converted to AUD with European Central Bank rates. PSA 8 / 9 / 10 prices are Claude's estimates.
- **Search** any card by name and number.
- **Binder**: your digital collection, saved on the phone and synced to your account.

## Try it on your phone

1. Install **Expo Go** from the App Store or Google Play.
2. On a computer with Node.js 20+:
   ```bash
   git clone https://github.com/EternalReptiles/pokemon.git
   cd pokemon
   npm install
   npx expo start
   ```
3. Scan the QR code with your phone's camera (iPhone) or with Expo Go (Android).
4. Open the **Account** tab and create an account. Scanning only works once you're signed in.

To try it in a browser instead: `npx expo start --web`.

## How it fits together

| Part | Where |
|---|---|
| Screens | `app/` (Expo Router: Scan, Search, Binder, Account, card and binder-item pages) |
| Card database and live prices | `lib/tcg.ts` (Pokémon TCG API) and `lib/money.ts` (AUD exchange rates) |
| Binder storage and sync | `lib/binder.ts` (on the phone, synced to the `binder_items` table) |
| Scanning, grading, graded estimates | `supabase/functions/scan` (calls Claude with the `ANTHROPIC_API_KEY` secret) |
| Database tables and security | `supabase/migrations/0001_binder.sql` |

The Claude key is stored only as a Supabase secret and is never in the app. Each account is limited to 150 Claude calls a day (`DAILY_LIMIT` in the scan function).

## Supabase project

Project ref `xxzcsrhyryvxujglyttj`. To redeploy the server function after changing it:

```bash
npx supabase functions deploy scan --project-ref xxzcsrhyryvxujglyttj --no-verify-jwt
```

## Accuracy

Graded prices and grade checks are estimates. Photos hide small flaws, and Claude's price knowledge isn't live. Check eBay AU sold listings (linked on every card) before buying, selling or submitting to PSA.
