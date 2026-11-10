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
  Array.from({ length: n }, (_, k) => ({ id: `${prefix}${k}`, en: `${prefix}${k}`, he: `ה${k}`, emoji: '⭐' }));

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
    const review = (id: string) => lesson.find((e) => 'itemId' in e && e.itemId === id && !e.isNew);
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
