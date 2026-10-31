# State

Where Amorphix stands, what is left in the 24 hours, and who does what, so anyone on the team can start exactly
here. Updated 31 Oct 2026, hackCBS 9.0. Dated detail is in `progress.md` (newest first).

**Team:** Vicky Sharma, Yashasvi Yadav. **Repo:** github.com/yashasviyadav30/Amorphix (public, branch `main`).
**Live:** amorphix-nine.vercel.app, deployed by Vercel on every push to `main`.
**Deadline:** end of the hackCBS sprint, 1 Nov 2026, 12:00 pm. **Sponsor database:** YugabyteDB.

---

## Resume here (31 Oct, before the break)

1. **Finish the interview walk-through in the browser** (`npm run dev`, open `/start`): answer to the end, add a
   name or two and a photo on the taste questions, check the taste card and the style reveal, press "Design my
   space". Expect the design page to fail in places until V6: the moodboard, budget level, shopping list, greenery,
   art and neighbourhood still call the old service (list in section 1).
2. **V6:** move those to the new engine (shopping from the brand vectors, budget level and greenery from the taste
   words; drop art and the neighbourhood read), remove `app/api/interview/taste`, `app/api/taste` (GET lookup),
   `app/api/quiz`, `app/api/strip`, the interviewer agent's old taste tools, then delete the old module.
3. Copy to fix: the interview's quick guide still says "three pictures for your taste".
4. Then the demo seed, V5 (YugabyteDB), V7 (cost and risk model).

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

**Still on the old external taste service (to replace):** the old taste module under `lib/` (its API client and profile builder) and everything that imports it: the interview
picks (`app/api/interview/taste`, `agents/interviewer/agent/tools/find_taste.ts`, `add_taste.ts`), `app/api/taste`,
`app/api/quiz`, `app/api/strip` (landing strip), `lib/art`, `lib/neighbourhood`, `lib/shop/fetch.ts`,
`lib/green/eco.ts`, `lib/budget/tier.ts`, `lib/plan-import/taste.ts`, and its API key read in the client. When this list is empty, delete that module.

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
| V4 | ⏳ Interview: typed names and idea chips, photos on the first taste question, live taste card from the device | Code done 31 Oct; **finish the browser walk-through** (it reached question 10) |
| V5 | **YugabyteDB vector store** (after Y2): tables for style words and brands with pgvector, nearest-neighbour queries replace the in-memory match | Profile comes from Yugabyte queries |
| V6 | Replace the rest of the old taste service (list in section 1): shopping from the brand vectors, budget level from the taste, art and neighbourhood dropped or rebuilt | Old module deleted, type check and tests clean |
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
