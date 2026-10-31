# State

Where Amorphix stands, what is left in the 24 hours, and who does what, so anyone on the team can start exactly
here. Updated 1 Nov 2026, hackCBS 9.0. Dated detail is in `progress.md` (newest first).

**Team:** Vicky Sharma, Yashasvi Yadav. **Repo:** github.com/yashasviyadav30/Amorphix (public, branch `main`).
**Live:** amorphix-nine.vercel.app, deployed by Vercel on every push to `main`.
**Deadline:** end of the hackCBS sprint, 1 Nov 2026, 12:00 pm. **Sponsor database:** YugabyteDB.

---

## Resume here (1 Nov, 1:30 am)

V6 is done (commit 732cec2): nothing calls the old external taste service; the module, its routes and its cache
table migration are gone, and `git grep -i` for its name finds nothing.

1. **Walk-through on the live site:** `/start` to the end, a name or two and a photo on the taste questions, then
   "Design my space": the budget level, shopping list and greenery should all load without errors.
2. **Demo seed (Y5):** `scripts/seed-demo.ts` now builds its taste with `scripts/taste-node.ts` (Gemini descriptions,
   CLIP in Node, the taste engine). Safe to run now.
3. **V5 (YugabyteDB)**, then **V7** (cost and risk model). The YugabyteDB allow list needs 0.0.0.0/0 for Vercel.
4. Optional, if time: a moodboard from the describe output (text tiles), since photos aren't uploaded.

## 1. What Amorphix is today (the product map)

| Part | What it does | Where |
|---|---|---|
| Interview | A short chat by voice or text (English, Hindi, Hinglish): the space, the people, how they live, the budget | `agents/interviewer` (eve agent), `components/interview`, `lib/interview`, `app/api/interview` |
| Design agents | Brief, room programme and three plans from the answers and the taste | `lib/design` |
| Layout engine | Places rooms, validator and solver for an architect's rules, three plans ranked by how you live | `lib/layout` |
| 3D | Walkthrough, explore and look around, day and night, room moods and light | `components/three`, `lib/three` |
| Budget | Room-by-room and trade-by-trade costs for 8 markets, 4 finish levels | `lib/budget` |
| Shopping list | Pieces to buy at each price level | `lib/shop` |
| Drawings | Dimensioned plans, elevations, schedules as PDF and DXF | `lib/export` |
| Changes by chat | Plain words become edits, re-checked and re-priced | `lib/workspace` |
| Workspace | Owner, architect, builder, client on one record: thread, review, quotes, fees, site, snags, handover | `lib/project`, `lib/site`, `lib/pros`, `lib/manage`, `app/(app)` |
| Demo world | Seeded projects and a 12-stop guided tour, no sign-in | `lib/demo`, `scripts/demo-world.ts`, `scripts/seed-demo.ts`, `app/demo` |
| **Taste engine (new)** | CLIP vectors for photos and words, matched to 50 style words and 30 brands | `lib/taste` |

**What changed in V6:** shopping and the budget's starting tier read the brand catalogue (`lib/taste/brands.ts`
now has each brand's price level and what it makes); plan import reads taste on the device like the interview;
the interviewer agent has one `add_taste` tool that saves names with their descriptions. Dropped: the moodboard (it
needed photos from the old service), the neighbourhood read, art and the playlist, eco brands and nearby nurseries
and stores.

---

## 2. The 24-hour plan

Each task has an owner so both can work at the same time without touching the same files.

### Yashasvi: accounts, data, deploy, testing

| # | Task | Done when |
|---|---|---|
| Y1 | ✅ **Supabase:** new project on your account. Put its keys in `.env.local` (see section 4). Run `node scripts/migrate.ts` | All migrations applied, `npm run dev` opens the landing page |
| Y2 | ✅ **YugabyteDB:** free cluster on YugabyteDB Aeon. Enable pgvector (`CREATE EXTENSION vector;`). Put `YUGABYTE_URL` in `.env.local` | `psql "$YUGABYTE_URL" -c "select 1"` works |
| Y3 | ✅ **Gemini key** from a new Google Cloud project on your account: `GOOGLE_GENERATIVE_AI_API_KEY` | `npm run dev`, the interview answers |
| Y4 | ✅ **Vercel:** live at amorphix-nine.vercel.app; import the repo on your account, add every key from `.env.local` as environment variables | The deploy URL opens |
| Y5 | **Demo world:** run the seed scripts against the new database (`scripts/demo-world.ts`, then `scripts/seed-demo.ts`) | `/demo` opens the tour |
| Y6 | **End-to-end test** on the deploy, as each person (owner, architect, builder, client) and on a phone; write what breaks into section 3 | Every stop of the tour and a fresh design work |
| Y7 | **Pitch:** slides and a 2-minute demo script | Ready by 10:00 am, 1 Nov |

### Vicky: the ML core

| # | Task | Done when |
|---|---|---|
| V1 | ✅ `app/api/taste/describe` + `lib/taste/describe.ts` | Done 31 Oct, checked live |
| V2 | ✅ Browser CLIP (`lib/taste/clip.ts`) and the photo style quiz at `/quiz` | Done 31 Oct, checked in the browser |
| V3 | ✅ (first pass) the profile is built in the browser by `components/interview/useTaste.ts` and saved by `/api/interview` | Done 31 Oct; moves to the server with V5 |
| V4 | ⏳ Interview: typed names and idea chips, photos on the first taste question, live taste card from the device | Code done 31 Oct; walk-through on the live site after V6 |
| V5 | **YugabyteDB vector store** (after Y2): tables for style words and brands with pgvector, nearest-neighbour queries replace the in-memory match | Profile comes from Yugabyte queries |
| V6 | ✅ Replace the rest of the old taste service: shopping and budget level from the brand catalogue, plan import on the device, art and neighbourhood dropped | Done 1 Nov, old module deleted, 404 tests and type check clean |
| V7 | **Cost and risk model:** budget by room and trade and the risk of going over, shown on the budget step | Model trained, tested, on screen |

### Together

- 9:00 am, 1 Nov: freeze features, only fixes after this.
- 11:00 am: final deploy, final run of the tour, submit.

---

## 3. Bugs and notes from testing

(Yashasvi adds here while testing: what, where, how to repeat it.)

- 31 Oct: keys in place; Supabase has all 16 migrations (26 tables), YugabyteDB connects with pgvector 0.8.0, Gemini
  key works. The venue Wi-Fi goes out from two IPs, so the YugabyteDB allow list has the venue range
  14.139.45.0/24. **Before the Vercel deploy (Y4):** Vercel's IPs change, so the allow list needs 0.0.0.0/0; the
  password and TLS still protect the database.
- 31 Oct, fixed: an empty `AMORPHIX_MODEL=` line made the app ask for a model with no name; empty now means the
  default. `gemini-2.5-flash` is closed to new accounts, so the fallbacks are now gemini-3.5-flash,
  gemini-3.1-flash-lite, gemini-flash-lite-latest, gemini-flash-latest (checked on the new key).

---

## 4. Set-up for anyone joining

```bash
git clone https://github.com/yashasviyadav30/Amorphix && cd Amorphix
npm ci
npx next typegen
cp .env.example .env.local      # fill in the keys below
npm run dev                     # http://localhost:3000
```

Keys in `.env.local` (never in chat or git; the same ones go in Vercel):

- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `POSTGRES_URL_NON_POOLING`
- `YUGABYTE_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `AMORPHIX_SESSION_SECRET`: 32+ random characters

Rebuild the taste vectors after changing `lib/taste/vocab.ts` or `lib/taste/brands.ts`: `node scripts/embed-taste.ts`.

## 5. How we work

- Pull before you start, commit small, push often to `main`. Plain commit messages.
- Before every push: `npm test` and `node node_modules/typescript/bin/tsc --noEmit` pass.
- Update this file and `progress.md` at the end of every working block: tick tasks, add what you learned.
