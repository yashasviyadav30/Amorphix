# State

Where Amorphix stands right now, so anyone on the team can pick up exactly here. Updated 31 Oct 2026, hackCBS 9.0.
Dated detail is in `progress.md` (newest first).

## Start here

**Product:** Amorphix, an AI architect that learns your taste with its own ML models and designs the whole space:
interview, style, three plans, 3D walkthrough, budget, shopping list, drawings, and a shared workspace for owner,
architect, builder and client.

**Event:** hackCBS 9.0, Shaheed Sukhdev College of Business Studies. Sponsor database: YugabyteDB.

**Repo:** github.com/yashasviyadav30/Amorphix (branch `main`). Local folder on Vicky's machine: `C:\Users\admin\amorphix`.

## Done

- Codebase set up and running locally: `npm ci`, `npx next typegen`, then type check is clean and all unit tests pass.
- Product README.

## Now (in order)

1. **ML taste engine.** Replace the external taste module under `lib/` with Amorphix's own engine:
   - a vocabulary of style words the app already understands (decor, ambience, aesthetic, tone, style), each with a
     text prompt;
   - CLIP embeddings for those prompts, for the user's photos and for the names of things they love;
   - nearest-neighbour matching gives the same `Profile` shape the rest of the app reads (`tags` with weights and
     sources, `brands`), so style, moods, 3D, budget and shopping keep working.
2. **YugabyteDB vector store.** pgvector tables for style prompts and the brand and product catalog; API routes for
   nearest-neighbour search.
3. **Interview picks.** Photos you upload, plus names of places and brands you love, instead of picture picks.
4. **Cost and risk model.** Budget by room and trade, and the risk of going over.
5. **Deploy** to a new Vercel project; demo world seeded on the new database.

## Keys needed (in `.env.local`, never in chat or git)

- `YUGABYTE_URL`: YugabyteDB connection string.
- New Supabase project: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `POSTGRES_URL_NON_POOLING`.
- New Gemini key: `GOOGLE_GENERATIVE_AI_API_KEY`.
- `AMORPHIX_SESSION_SECRET`: 32+ random characters.

## How we work

- Commit small and often, push to `main`. Author `vicky sharma <raghunathsharma296@gmail.com>`, plain messages.
- Before every commit: `npm test` and `node node_modules/typescript/bin/tsc --noEmit` pass.
- Update this file and `progress.md` at the end of every working block.
