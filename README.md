# English Quest

A Duolingo-style English game for a Hebrew-speaking 9-year-old. Mobile-first web app (installable as a PWA), Hebrew RTL interface.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for testing on a phone)
npm test           # engine unit tests + a 10-day simulated learner
npm run build
```

## Deploy (Vercel)

Push to GitHub, import the repo in Vercel (framework: Vite), done. Every push to `main` redeploys.
On the phone: open the URL in Chrome → ⋮ → "Add to Home screen".

## How it works

- `content/units/*.json`: units of words (`en`, `he`, `emoji`) and sentences for the word-bank exercise. Files load in name order; add a file to add a unit.
- `src/engine/progress.ts`: progress model. Leitner boxes 0–5 per item, promoted only on *due* reviews (1, 2, 4, 8, 16 days); XP, gems, streak, daily goal.
- `src/engine/lessonBuilder.ts`: builds ~12-exercise lessons: new words from the current unit (2–4, adapted to recent accuracy), due/weak reviews, a match-pairs round, and word-bank sentences. Exercise type climbs a ladder with the item's box: pick picture → listen & pick picture → listen & pick word → Hebrew → English.
- A unit unlocks when 80% of the previous unit's words reach box 2.
- Wrong answers are re-queued at the end, so every lesson ends in success.
- Progress is stored in `localStorage` (Phase 1). Every answer is logged as an event, ready to sync to Supabase in Phase 2.

## Roadmap

1. ✅ Core loop: 3 units, 5 exercise types, TTS, XP, celebrations, local storage
2. Supabase auth + sync, per-skill FSRS
3. Streak freezes, unit map polish, collectibles shop
4. Weekly league (bots + family) and parent view
5. Letter-tile spelling, speaking, pre-generated audio, push reminders, offline
