# Amorphix build log

Newest first. Each entry is what was done that day, and how it was checked.

---

## 31 October: set-up at hackCBS 9.0

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
