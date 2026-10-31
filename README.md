# Amorphix

**An AI architect that learns your taste, designs the whole space around you, and stays with the project until you move in.**

Show Amorphix the places and rooms you love and tell it how you live. Its own ML models read the taste behind them, and Amorphix turns it into a style, three floor plans with honest trade-offs, a 3D walkthrough by day and night, a budget in your currency, a shopping list, a drawings pack, and a shared project your architect, client and builder run together: review, change requests, fees, the building site, snags, handover and warranty.

## Why Amorphix

The real problem in design is understanding the person. Style lives in patterns of taste: the hotel someone never wanted to leave, the brands they trust, the way their family moves through a day. People can't name their style, and that gap is expensive: three in four homeowners who remodel end up with regrets.

Amorphix reads that taste with machine learning, turns it into design decisions, and keeps everyone building from the same record.

## How it works

1. **Know you.** A short interview by voice or text: the space, the people, how they live in it, the budget, and photos of places you love.
2. **Read the taste.** Amorphix's taste engine embeds your photos and words into one vector space and matches them against a library of design styles, materials and palettes.
3. **Your style.** A style with its palette, materials and light, each choice traced to the photo or words it came from.
4. **Three plans.** Drawn by Amorphix's layout engine and ranked by how you live, each with what it does best and what it gives up.
5. **Walk through it in 3D.** Furniture in your style, a mood and light for every room, day and night.
6. **Budget, shopping and drawings.** Room by room in your currency, a shopping list matched to your taste, and a drawings pack as PDF and DXF.
7. **Change anything by asking.** "Add a study." "Make the kitchen bigger." The plan, 3D and budget follow.
8. **Run the whole build.** Owner, architect, builder and client on one record: the thread, the quote, the site, every fee and sign-off, right to the keys.

## The ML core

| Model | What it does | Where it shows |
|---|---|---|
| **Taste embeddings** | Photos and words you love, embedded into one shared space | Your style, with its sources |
| **Style matching** | Nearest design styles, palettes and materials to your taste vector | Style card, materials, 3D |
| **Recommendations** | Products closest to your taste, at each price level | Shopping list |
| **Cost and risk model** | Budget by room and trade, and the risk of going over | Budget |

The vectors live in **YugabyteDB** with pgvector, so every recommendation is a nearest-neighbour query over a distributed, Postgres-compatible database.

## Agentic by design

- **The interviewer agent**, built with the eve agent framework, holds the conversation and saves answers through its own tools.
- **The design agents** write the brief, the room programme and three plans, each step grounded in the taste profile and checked by code before anything is drawn.
- **Changes by chat:** a request in plain words becomes a tool call that edits the design, re-checked and re-priced.

Models write; code verifies. Nothing a model writes is drawn, priced or credited until the code has checked it.

## Stack

| Area | Technology |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind, installable PWA |
| 3D | three.js with React Three Fiber |
| ML | Taste embeddings, style matching, recommendations, cost and risk model |
| Agents | eve agent framework, AI SDK, Gemini |
| Data | YugabyteDB (vectors), Supabase (projects, auth, storage) |
| Hosting | Vercel |

## Run it

```bash
npm install
cp .env.example .env.local     # database, model and storage keys
npm run dev                    # http://localhost:3000
```

## License

MIT, see `LICENSE`.
