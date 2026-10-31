# Amorphix build log

Newest first. Each entry is what was done that day, and how it was checked.

---

## 1 November

- **Tour stop for "Make changes"** (now 13 stops): Sam's café opens on the workspace with two changes in its history,
  made through the real edit route in plain words ("Make the cafe seating bigger", a renamed store room). A judge
  who tries a change gets the view-only note and a link to try it on their own project. The café's night reveal now
  comes in close on the seating after opening the building up. The seed runs against a local app started with
  `AMORPHIX_DEMO_SEED=1`.

- **The judges' demo on the new build:** the demo people pick by name and their taste is read by the taste model
  (`scripts/taste-node.ts`); the seed built Maya's house (on site), the Parks' house (in review), Ana's apartment (last
  week) and Sam's café through the app's own routes. The tour's demo account ids were from another database, so the
  tour found no projects; they now match. All 12 stops checked on the live site.
- **"AI architect · powered by Albo AI Research Lab"** on the landing, intro, tour, footer, exports and README.

- **V7, the risk of going over:** `lib/budget/risk.ts` simulates 4,000 builds of the chosen design: each trade drawn
  around its estimate with its own spread and an upward skew, all tied by one shared price factor, with extra
  hidden-condition risk in a renovation. The budget step shows the chance of going over, the most likely, 80% and 90%
  figures, what to keep aside to be 80% sure, and the trades that carry most of the risk. Six tests (renovation riskier
  than new build, luxury riskier than essential, same design same figures). A typical fit-out: 61% chance of going
  over the planned figure, about 13% to keep aside.
- **Interview reveal fix:** the style shows, and the design can start, only once every pick has been read.

- **V5, the taste engine on YugabyteDB:** the 50 style words and 30 brands are rows with pgvector columns and an HNSW
  index (`ybhnsw`); the browser sends the CLIP vectors it made and `/api/taste/profile` asks YugabyteDB for every
  similarity in four queries (the brands nearest the whole taste are an `order by <=> limit` query). Brand vectors are
  measured from the catalogue's average, so affinities spread from about -0.15 to 0.2 instead of all sitting near
  0.88. Checked: the profile from YugabyteDB matches the in-memory engine (differences under 0.00002), about 350 ms
  warm; if the database can't be reached the same engine runs in memory.
- **Shopping list logos:** each catalogue brand has its website, which gives its logo and its shop link.

- **V6, the whole app on Amorphix's own taste model:** the shopping list picks each piece's brand from the brands
  closest to the person's taste, nearest their price tier, with a cheaper and a dearer brand from the catalogue; the
  budget's starting tier is the average price level of their closest brands; plan import reads the three names on
  the device, as the interview does; the interviewer agent saves names with their design descriptions. The old
  service's module, routes, cache migration and features that needed its data (moodboard photos, neighbourhood read,
  art and playlist, eco brands, nearby stores) are gone, and the copy that described them is updated. Type check
  clean, 404 unit tests pass, no mention of the old service left in the repo.

## 31 October: set-up at hackCBS 9.0

- **Names become design descriptions (V1):** `lib/taste/describe.ts` and `/api/taste/describe`. Gemini says what kind
  of thing each name is (place, brand, culture: its weight) and describes the interior look it evokes; checked live:
  Chateau Marmont gives dark walnut panelling, velvet, dim light, brass lamps; Muji gives light ash wood and unbleached
  cotton; Mad Men gives teak credenzas and brass bar carts. Four unit tests.
- **The interview reads taste on the device (V3 and V4, first pass):** `components/interview/useTaste.ts` describes
  each name, embeds descriptions and photos with CLIP in the browser, and builds the profile with the taste engine;
  the taste step is now a typed name or an idea chip, with "Add photos of spaces you love" on the first taste
  question; `/api/interview` saves the taste the browser read (checked against a schema) instead of asking the old
  service. Type check clean, all unit tests pass; the browser walk-through reached question 10 of the interview.

- **Landing page pass on the live site:** the header menu no longer wraps beside the logo; the tagline is simply "AI
  architect"; the film section, which had no film yet, is gone; links to the style quiz say "from photos".

- **Live at amorphix-nine.vercel.app** (deployed from this repo on every push).
- **Every page and message now speaks of Amorphix's own taste model**: the landing hero, the style and taste
  screens, the tour, the FAQ and the interviewer's instructions; the landing's live taste strip, which called the old
  service, is gone. What still calls the old service in code is task V6 in `state.md`.

- **Keys and databases connected:** Supabase with all migrations, YugabyteDB with pgvector, a Gemini key; each one
  checked with a live call. Two fixes from that: an empty model setting now means the default model, and the Gemini
  fallbacks skip a model closed to new accounts (tested).

- **Style from photos, on the device (V2):** `lib/taste/clip.ts` runs CLIP in the browser (transformers.js), so photos
  never leave the device; `lib/taste/name.ts` names a style from its strongest looks (tested). The style quiz at
  `/quiz` is now photo-based: add up to 5 photos, the model downloads once with a progress bar, and a style card
  shows the style, the words with the photo each came from, and the closest brands. Checked in the browser with
  three interior photos: Minimalist with Scandinavian and Bright; brands Audo Copenhagen, HAY, Muji, The Conran
  Shop. Then fixed: when two opposite words come up (minimalist and maximalist, bright and
  moody, light and dark wood), only the stronger stays (tested).

- **The 24-hour plan, split for two:** `state.md` now maps every part of the product to its folder, lists what is
  left, and gives each task an owner (Yashasvi: Supabase, YugabyteDB, Gemini key, Vercel on his account, demo data,
  end-to-end testing, pitch; Vicky: the ML core), with a set-up guide for anyone joining.

- **CLIP vectors for the taste engine:** a catalog of 30 home brands, and `scripts/embed-taste.ts`, which embeds the
  50 style words and the brands with CLIP's text encoder (transformers.js) into `lib/taste/vectors.json`.
- **What we learned testing it on real phrases:** a bare name ("Muji") matched against style prompts gives generic
  words, because CLIP compares sentence shapes; a short design description of the same thing gives the right ones
  (Muji: japandi, natural materials, minimalist; a brick loft café: industrial, concrete). So names go through a short
  description first, and photos go straight in, since image-to-text is what CLIP is built for.

- **Taste engine, first part:** `lib/taste` with the profile types the app reads, a vocabulary of 50 style words
  (decor, aesthetic, ambience, tone) each with the prompt its vector is made from, and the engine that turns photo and
  word vectors into weighted style tags with their sources and ranks brands by closeness to the whole taste.
  Six unit tests on synthetic vectors.

- **Codebase set up** in the team repo and running locally: packages installed, route types generated, type check
  clean, all unit tests passing.
- **README** for the product: what Amorphix does, the ML core, agents, stack and how to run it.
- **Plan for the ML taste engine:** one vector space for photos and words, a vocabulary of style prompts, and
  nearest-neighbour matching on YugabyteDB that feeds the style, moods, 3D, budget and shopping.
- **state.md** so anyone on the team can pick up where the work stands.
