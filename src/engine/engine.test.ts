import { describe, expect, it } from 'vitest';
import { buildUnits } from './content';
import { applyAnswer, currentStreak, emptyProgress, finishLesson, markKnown, recordAnswer, type Progress } from './progress';
import { buildJumpTest, buildLesson, checkWordBank, itemsUpTo, kindForBox, newWordCount, requeue, unitStatuses } from './lessonBuilder';

const DAY = 86400000;
const NOW = new Date(2026, 10, 10, 17, 0).getTime();

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const mkItems = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, k) => ({
    id: `${prefix}${k}`,
    en: `${prefix}${k}`,
    he: `ה${prefix}${k}`,
    emoji: String.fromCodePoint(0x1f400 + prefix.charCodeAt(0) * 20 - 1900 + k),
  }));

const units = buildUnits([
  { id: 'a', title: 'A', emoji: 'A', items: mkItems('a', 10), sentences: [{ id: 's1', en: 'I like a0', he: 'x', emoji: 'x', distractors: ['you'] }] },
  { id: 'b', title: 'B', emoji: 'B', items: mkItems('b', 10) },
]);

function withItems(boxes: Record<string, number>, due = NOW - 1): Progress {
  const p = emptyProgress();
  for (const [id, box] of Object.entries(boxes)) p.items[id] = { box, due, seen: 3, correct: 3, wrong: 0, lastSeen: NOW - DAY };
  return p;
}

describe('applyAnswer (Leitner)', () => {
  it('moves up on correct and schedules later', () => {
    const s = applyAnswer(undefined, true, NOW);
    expect(s.box).toBe(1);
    expect(s.due).toBe(NOW + DAY);
  });
  it('does not promote when practised before due', () => {
    const s1 = applyAnswer(undefined, true, NOW);
    const s2 = applyAnswer(s1, true, NOW + 1000);
    expect(s2.box).toBe(1);
    expect(s2.due).toBe(s1.due);
    expect(applyAnswer(s2, true, NOW + DAY).box).toBe(2);
  });
  it('moves down on wrong and is due now', () => {
    const s = applyAnswer({ box: 3, due: 0, seen: 1, correct: 1, wrong: 0, lastSeen: 0 }, false, NOW);
    expect(s.box).toBe(2);
    expect(s.due).toBe(NOW);
  });
  it('retries do not change memory state', () => {
    const p = recordAnswer(emptyProgress(), { itemId: 'a0', kind: 'pick-picture', skill: 'recognition', correct: true, retry: true, ms: 1, ts: NOW });
    expect(p.items.a0).toBeUndefined();
    expect(p.events).toHaveLength(1);
  });
});

describe('streak', () => {
  it('continues from yesterday, resets after a gap, and does not double count a day', () => {
    let p = finishLesson(emptyProgress(), { startedAt: NOW, firstTryCorrect: 5, total: 5 }, NOW - DAY);
    expect(p.streak).toBe(1);
    p = finishLesson(p, { startedAt: NOW, firstTryCorrect: 5, total: 5 }, NOW);
    expect(p.streak).toBe(2);
    p = finishLesson(p, { startedAt: NOW, firstTryCorrect: 5, total: 5 }, NOW + 1000);
    expect(p.streak).toBe(2);
    expect(currentStreak(p, NOW + 3 * DAY)).toBe(0);
    p = finishLesson(p, { startedAt: NOW, firstTryCorrect: 5, total: 5 }, NOW + 3 * DAY);
    expect(p.streak).toBe(1);
  });
  it('gives perfect bonus', () => {
    const p = finishLesson(emptyProgress(), { startedAt: NOW, firstTryCorrect: 12, total: 12 }, NOW);
    expect(p.xp).toBe(27);
    expect(p.gems).toBe(10);
  });
});

describe('units', () => {
  it('unlocks the next unit only when 80% mastered', () => {
    const boxes = Object.fromEntries(mkItems('a', 7).map((i) => [i.id, 2]));
    expect(unitStatuses(units, withItems(boxes))[1].unlocked).toBe(false);
    boxes.a7 = 2;
    expect(unitStatuses(units, withItems(boxes))[1].unlocked).toBe(true);
  });
});

describe('buildLesson', () => {
  it('first lesson introduces 3 words, each practised several times', () => {
    const lesson = buildLesson(units, emptyProgress(), NOW, seeded());
    const intros = lesson.filter((e) => e.kind === 'pick-picture' && e.isNew);
    expect(intros.map((e) => (e as { itemId: string }).itemId)).toEqual(['a0', 'a1', 'a2']);
    expect(lesson.some((e) => e.kind === 'match-pairs')).toBe(true);
    expect(lesson.length).toBeGreaterThanOrEqual(9);
    expect(lesson.length).toBeLessThanOrEqual(12);
    expect(lesson.some((e) => e.kind === 'word-bank')).toBe(false);
  });

  it('uses only unlocked items and correct answers are always among options', () => {
    const p = withItems({ a0: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 0 });
    const lesson = buildLesson(units, p, NOW, seeded(7));
    expect(lesson).toHaveLength(12);
    for (const e of lesson) {
      if ('options' in e) {
        expect(e.options).toContain(e.itemId);
        expect(new Set(e.options).size).toBe(4);
        expect(e.options.every((o) => o.startsWith('a'))).toBe(true);
      }
    }
    expect(new Set(lesson.map((e) => e.key)).size).toBe(lesson.length);
  });

  it('reviews climb the ladder and sentences appear once most words are seen', () => {
    const p = withItems({ a0: 0, a1: 1, a2: 2, a3: 3, a4: 4, a5: 5 });
    const lesson = buildLesson(units, p, NOW, seeded(3));
    const review = (id: string) => lesson.find((e) => 'itemId' in e && e.itemId === id && !('isNew' in e && e.isNew));
    expect(review('a0')?.kind).toBe(kindForBox(0));
    expect(review('a3')?.kind).toBe('he-to-en');
    expect(lesson.filter((e) => e.kind === 'word-bank')).toHaveLength(1);
  });

  it('introduces fewer new words after struggling', () => {
    const p = emptyProgress();
    p.lessons = [{ startedAt: 0, finishedAt: 0, xp: 0, accuracy: 0.5 }];
    const lesson = buildLesson(units, p, NOW, seeded());
    expect(lesson.filter((e) => 'isNew' in e && e.isNew)).toHaveLength(2);
  });

  it('never asks about the same word twice in a row', () => {
    for (let seed = 1; seed < 30; seed++) {
      for (const p of [emptyProgress(), withItems({ a0: 0, a1: 1, a2: 2 })]) {
        const lesson = buildLesson(units, p, NOW, seeded(seed));
        const ids = lesson.map((e) => ('itemId' in e ? e.itemId : e.kind === 'word-bank' ? e.targetId : e.key));
        for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
      }
    }
  });

  it('requeue keeps origin and makes a new key', () => {
    const [e] = buildLesson(units, emptyProgress(), NOW, seeded());
    const r = requeue(e, 1, seeded());
    expect(r.origin).toBe(e.origin);
    expect(r.key).not.toBe(e.key);
  });
});

describe('checkWordBank', () => {
  it('ignores case and punctuation', () => {
    const s = units[0].sentences[0];
    expect(checkWordBank(s, ['I', 'like', 'a0'])).toBe(true);
    expect(checkWordBank(s, ['like', 'I', 'a0'])).toBe(false);
  });
});

const phraseUnits = buildUnits([
  {
    id: 'ph',
    kind: 'phrases',
    title: 'P',
    emoji: 'P',
    items: [
      { id: 'p0', en: 'Can I go to the bathroom?', he: 'x0', emoji: '🚻' },
      { id: 'p1', en: "I don't understand", he: 'x1', emoji: '🤔' },
      { id: 'p2', en: 'Slowly, please', he: 'x2', emoji: '🐢' },
      { id: 'p3', en: 'I need help', he: 'x3', emoji: '🆘' },
      { id: 'p4', en: 'Me too!', he: 'x4', emoji: '🙌' },
    ],
  },
  ...units.map((u) => ({ ...u, items: u.items.map(({ unitId: _u, type: _t, ...i }) => i) })),
]);

describe('phrase units', () => {
  it('use meaning exercises and build-the-phrase', () => {
    const lesson = buildLesson(phraseUnits, emptyProgress(), NOW, seeded(5));
    const kinds = new Set(lesson.map((e) => e.kind));
    expect(kinds.has('en-to-he')).toBe(true);
    expect(kinds.has('listen-meaning')).toBe(true);
    expect(kinds.has('pick-picture')).toBe(false);
    expect(kindForBox(3, 'phrase')).toBe('word-bank');
  });
  it('phrase tiles have no punctuation and include the whole phrase', () => {
    const p = withItems({ p0: 3, p1: 3, p2: 3, p3: 3 });
    const wb = buildLesson(phraseUnits, p, NOW, seeded(2)).filter((e) => e.kind === 'word-bank');
    expect(wb.length).toBeGreaterThan(0);
    for (const e of wb) {
      if (e.kind !== 'word-bank') continue;
      expect(e.tiles.some((t) => /[?!,.]/.test(t))).toBe(false);
      const target = phraseUnits[0].items.find((i) => i.id === e.targetId)!;
      const words = target.en.replace(/[?!,.]/g, '').split(' ');
      expect(checkWordBank(target, words)).toBe(true);
      for (const w of words) expect(e.tiles).toContain(w);
    }
  });
});

describe('jump ahead', () => {
  it('builds a test from the target unit only', () => {
    const t = buildJumpTest(units, 'b', seeded(4));
    expect(t).toHaveLength(8);
    for (const e of t) if ('itemId' in e) expect(e.itemId.startsWith('b')).toBe(true);
  });
  it('passing unlocks the unit and everything before it', () => {
    const p = markKnown(emptyProgress(), itemsUpTo(units, 'b'), NOW);
    const st = unitStatuses(units, p);
    expect(st.every((s) => s.unlocked && s.complete)).toBe(true);
    expect(p.items.b0.due).toBeGreaterThan(NOW);
  });
  it('test answers do not change memory state, and test lessons do not affect pacing', () => {
    let p = recordAnswer(emptyProgress(), { itemId: 'b0', kind: 'he-to-en', skill: 'recall', correct: true, retry: false, test: true, ms: 1, ts: NOW });
    expect(p.items.b0).toBeUndefined();
    expect(unitStatuses(units, p)[1].unlocked).toBe(false);
    p = finishLesson(p, { startedAt: NOW, firstTryCorrect: 1, total: 8 }, NOW, true);
    expect(newWordCount(p)).toBe(3);
  });
  it('a started unit stays unlocked even if earlier words slip', () => {
    const boxes: Record<string, number> = Object.fromEntries(mkItems('a', 10).map((i) => [i.id, 2]));
    boxes.b0 = 1;
    expect(unitStatuses(units, withItems(boxes))[1].unlocked).toBe(true);
    for (const k of [0, 1, 2, 3, 4]) boxes[`a${k}`] = 0;
    expect(unitStatuses(units, withItems(boxes))[1].unlocked).toBe(true);
  });
});

describe('reading track', () => {
  const readUnits = UNITS_READ();
  function UNITS_READ() {
    return buildUnits([
      {
        id: 'L',
        kind: 'letters',
        track: 'read',
        title: 'L',
        emoji: 'L',
        items: [
          { id: 'l-c', en: 'c', he: 'כּ', emoji: '🐈', keyword: 'cat', examples: [{ en: 'car', emoji: '🚗' }], confusable: ['k'] },
          { id: 'l-k', en: 'k', he: 'כּ', emoji: '🪁', keyword: 'kite', examples: [{ en: 'key', emoji: '🔑' }], confusable: ['c'] },
          { id: 'l-a', en: 'a', he: 'אַ', emoji: '🍎', keyword: 'apple', examples: [], vowel: true },
          { id: 'l-m', en: 'm', he: 'מ', emoji: '🌙', keyword: 'moon', examples: [] },
          { id: 'l-d', en: 'd', he: 'ד', emoji: '🐕', keyword: 'dog', examples: [] },
          { id: 'l-s', en: 's', he: 'ס', emoji: '☀️', keyword: 'sun', examples: [] },
        ],
      },
      {
        id: 'W',
        kind: 'decodable',
        track: 'read',
        title: 'W',
        emoji: 'W',
        items: ['cat', 'hat', 'bat', 'map', 'shell'].map((en, k) => ({ id: `r-${en}`, en, he: en, emoji: ['🐈', '🎩', '🦇', '🗺️', '🐚'][k] })),
      },
    ]);
  }

  it('never offers c and k as alternatives for each other, and vowels are never letter-sound', () => {
    for (let seed = 1; seed < 40; seed++) {
      const boxes: Record<string, number> = { 'l-c': seed % 4, 'l-k': (seed + 1) % 4, 'l-a': 0, 'l-m': 1, 'l-d': 2, 'l-s': 3 };
      for (const e of buildLesson(readUnits, withItems(boxes), NOW, seeded(seed))) {
        if ('options' in e && (e.itemId === 'l-c' || e.itemId === 'l-k')) {
          expect(e.options.filter((o) => o === 'l-c' || o === 'l-k')).toHaveLength(1);
        }
        if (e.kind === 'letter-sound') {
          expect(e.itemId).not.toBe('l-a');
          expect(e.options).not.toContain('l-a');
        }
        if (e.kind === 'sound-start') {
          const own = e.itemId === 'l-c' ? ['cat', 'car'] : e.itemId === 'l-k' ? ['kite', 'key'] : null;
          if (own) expect(e.pictures.filter((p) => ['cat', 'car', 'kite', 'key'].includes(p.en))).toHaveLength(1);
          expect(e.pictures[e.answer].en[0]).toBe(readUnits[0].items.find((i) => i.id === e.itemId)!.en);
          const r = requeue(e, 1, seeded(seed));
          expect(r.kind === 'sound-start' && r.pictures[r.answer].en).toBe(e.pictures[e.answer].en);
        }
      }
    }
  });

  it('decodable words are read without audio first, then spelled from letters', () => {
    expect(kindForBox(0, 'decodable')).toBe('read-pick');
    const boxes = Object.fromEntries(readUnits.flatMap((u) => u.items).map((i) => [i.id, 3]));
    const spell = buildLesson(readUnits, withItems(boxes), NOW, seeded(9)).filter((e) => e.kind === 'word-bank');
    expect(spell.length).toBeGreaterThan(0);
    for (const e of spell) {
      if (e.kind !== 'word-bank') continue;
      expect(e.letters).toBe(true);
      const word = e.targetId.slice(2);
      expect(e.tiles).toHaveLength(word.length + 2);
      expect(checkWordBank({ en: word }, [...word], true)).toBe(true);
    }
  });
});

describe('no look-alike options', () => {
  it('match pairs and choices never show two identical pictures', () => {
    const units2 = buildUnits([
      { id: 'L', kind: 'letters', track: 'read', title: 'L', emoji: 'L', items: [
        { id: 'l-c', en: 'c', he: 'כּ', emoji: '🐈', keyword: 'cat', examples: [] },
        { id: 'l-d', en: 'd', he: 'ד', emoji: '🐕', keyword: 'dog', examples: [] },
        { id: 'l-s', en: 's', he: 'ס', emoji: '☀️', keyword: 'sun', examples: [] },
      ] },
      { id: 'W', kind: 'decodable', track: 'read', title: 'W', emoji: 'W', items: [
        { id: 'r-cat', en: 'cat', he: 'חתול', emoji: '🐈' },
        { id: 'r-dog', en: 'dog', he: 'כלב', emoji: '🐕' },
        { id: 'r-sun', en: 'sun', he: 'שמש', emoji: '☀️' },
        { id: 'r-hat', en: 'hat', he: 'כובע', emoji: '🎩' },
      ] },
    ]);
    const all = new Map(units2.flatMap((u) => u.items).map((i) => [i.id, i]));
    for (let seed = 1; seed < 40; seed++) {
      const p = withItems({ 'l-c': 2, 'l-d': 2, 'l-s': 2 });
      for (const e of buildLesson(units2, p, NOW, seeded(seed))) {
        const ids = e.kind === 'match-pairs' ? e.itemIds : 'options' in e ? e.options : [];
        const faces = ids.map((id) => all.get(id)!.emoji);
        expect(new Set(faces).size).toBe(faces.length);
      }
    }
  });
});
