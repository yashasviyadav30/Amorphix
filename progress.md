# Amorphix build log

Newest first. Each entry is what was done that day, and how it was checked.

---

## 31 October: set-up at hackCBS 9.0

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
