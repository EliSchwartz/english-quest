import { describe, expect, it } from 'vitest';
import { buildUnits } from './content';
import { applyAnswer, currentStreak, emptyProgress, finishLesson, recordAnswer, type Progress } from './progress';
import { buildLesson, checkWordBank, kindForBox, requeue, unitStatuses } from './lessonBuilder';

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
        const ids = lesson.map((e) => ('itemId' in e ? e.itemId : e.key));
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
