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

- `content/units/*.json`: units load in file-name order; add a file to add a unit.
  - `"kind": "phrases"` units (the first five: introductions, classroom instructions, asking for help, friends at recess, lunch) are for getting by at a US school. Each item is a short phrase (`en`, `he`, `emoji`).
  - Word units (colors, animals, food) hold single words plus `sentences` for the word bank.
  - Hebrew uses feminine forms for "I" (אני צריכה, אני לא מבינה).
- `content/reading/*.json`: the **📖 reading** track. On the home screen its units are interleaved with the 🗣️ speaking units in one path, but each track unlocks on its own, so a slow reading unit never blocks the school phrases. The main button alternates lessons 1:1 (speaking, reading, speaking…); tapping a unit starts that track directly.
  - Letter units (`"kind": "letters"`): each letter has a Hebrew sound equivalent (b = בּ, sh = ש), a keyword she knows orally (b → ball ⚽) and example pictures. Vowels (`"vowel": true`) have no clean Hebrew equivalent, so they're taught only through keywords. `"confusable"` keeps c/k (same sound) and p/f (פּ/פ look alike) from being offered against each other.
  - Decodable word units (`"kind": "decodable"`): short a/i/o/u/e words (cat, pig, dog, sun, bed), then sh/ch/th and magic e.
  - The phone's TTS can't say isolated sounds reliably, so sounds are taught through Hebrew letters and keywords, never by playing "/b/".
- `src/engine/progress.ts`: progress model. Leitner boxes 0–5 per item, promoted only on *due* reviews (1, 2, 4, 8, 16 days); XP, gems, streak, daily goal.
- `src/engine/lessonBuilder.ts`: builds ~12-exercise lessons: new words from the current unit (2–4, adapted to recent accuracy), due/weak reviews, a match-pairs round, and word-bank sentences. Exercise type climbs a ladder with the item's box: pick picture → listen & pick picture → listen & pick word → Hebrew → English.
- Letter ladder: letter → pick its Hebrew sound → hear a keyword, pick its first letter → which picture starts with this sound?
- Decodable ladder: read the word (no audio) → pick picture → hear it, pick the written word → read again → spell it from letter tiles.
- Phrase ladder: see/hear English → pick Hebrew meaning → hear only → pick meaning → Hebrew → pick English → build the phrase from tiles.
- A unit unlocks when 80% of the previous unit's items reach box 2, and stays unlocked once started.
- **Jump ahead:** tap a locked unit (⚡ קפיצה) for an 8-question test (no retries, ends after a 3rd mistake). Pass with ≤2 mistakes: every item up to that unit is credited as known (box 2, review in 2 days). A failed test changes nothing except some XP for trying.
- Wrong answers are re-queued at the end, so every lesson ends in success.
- Progress is stored in `localStorage` (Phase 1). Every answer is logged as an event, ready to sync to Supabase in Phase 2.

## Roadmap

1. ✅ Core loop: speaking track (5 phrase units + 3 word units) and reading track (4 letter units + 7 word units), 11 exercise types, jump-ahead tests, TTS, XP, celebrations, local storage
2. Supabase auth + sync, per-skill FSRS
3. Streak freezes, unit map polish, collectibles shop
4. Weekly league (bots + family) and parent view
5. Letter-tile spelling, speaking, pre-generated audio, push reminders, offline
