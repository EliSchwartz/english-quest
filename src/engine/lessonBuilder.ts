import type { Progress } from './progress';
import type { ChoiceExercise, ChoiceKind, Exercise, Item, Sentence, Unit } from './types';

export const LESSON_SIZE = 12;
const UNIT_COMPLETE_FRACTION = 0.8;
const UNIT_COMPLETE_BOX = 2;

export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface UnitStatus {
  unit: Unit;
  mastered: number; // fraction of items at box >= 2
  seen: number; // fraction of items seen at least once
  unlocked: boolean;
  complete: boolean;
}

export function unitStatuses(units: Unit[], p: Progress): UnitStatus[] {
  let prevComplete = true;
  return units.map((unit) => {
    const n = unit.items.length || 1;
    const mastered = unit.items.filter((i) => (p.items[i.id]?.box ?? 0) >= UNIT_COMPLETE_BOX).length / n;
    const seen = unit.items.filter((i) => p.items[i.id]).length / n;
    const complete = mastered >= UNIT_COMPLETE_FRACTION;
    const unlocked = prevComplete;
    prevComplete = unlocked && complete;
    return { unit, mastered, seen, unlocked, complete };
  });
}

export function currentUnit(statuses: UnitStatus[]): UnitStatus {
  return statuses.find((s) => s.unlocked && !s.complete) ?? statuses[statuses.length - 1];
}

/** How many new words to introduce, based on accuracy in the last few lessons. */
export function newWordCount(p: Progress): number {
  const recent = p.lessons.slice(-3);
  if (recent.length === 0) return 3;
  const acc = recent.reduce((a, l) => a + l.accuracy, 0) / recent.length;
  if (acc < 0.7) return 2;
  if (acc > 0.9) return 4;
  return 3;
}

/** Exercise type climbs a difficulty ladder as the item's box grows. */
export function kindForBox(box: number): ChoiceKind {
  if (box <= 0) return 'pick-picture';
  if (box === 1) return 'listen-picture';
  if (box === 2) return 'listen-word';
  return 'he-to-en';
}

export function buildLesson(units: Unit[], p: Progress, now: number, rng: Rng = Math.random): Exercise[] {
  const statuses = unitStatuses(units, p);
  const unlockedUnits = statuses.filter((s) => s.unlocked).map((s) => s.unit);
  const allUnlockedItems = unlockedUnits.flatMap((u) => u.items);
  const cur = currentUnit(statuses).unit;

  let counter = 0;
  const mk = <T extends Omit<Exercise, 'key' | 'origin'>>(e: T) => {
    const key = `ex${counter++}`;
    return { ...e, key, origin: key } as T & { key: string; origin: string };
  };

  const choice = (item: Item, kind: ChoiceKind, isNew = false): ChoiceExercise => {
    const sameUnit = units.find((u) => u.id === item.unitId)?.items ?? [];
    let pool = sameUnit.filter((i) => i.id !== item.id);
    if (pool.length < 3) pool = allUnlockedItems.filter((i) => i.id !== item.id);
    const distractors = shuffle(pool, rng).slice(0, 3);
    const options = shuffle([item, ...distractors], rng).map((i) => i.id);
    return mk({ kind, itemId: item.id, options, isNew });
  };

  // 1. New items from the current unit.
  const newItems = cur.items.filter((i) => !p.items[i.id]).slice(0, newWordCount(p));
  const intros = newItems.map((i) => choice(i, 'pick-picture', true));
  const seconds = newItems.map((i) => choice(i, 'listen-picture'));

  // 2. Seen items, prioritised: due first, then weak, then least practised.
  const seen = allUnlockedItems.filter((i) => p.items[i.id]);
  const st = (i: Item) => p.items[i.id];
  const isWeak = (i: Item) => st(i).box === 0 || st(i).wrong * 2 > st(i).correct;
  const due = seen.filter((i) => st(i).due <= now).sort((a, b) => st(a).box - st(b).box || st(a).due - st(b).due);
  const weak = seen.filter((i) => !due.includes(i) && isWeak(i));
  const rest = seen
    .filter((i) => !due.includes(i) && !weak.includes(i))
    .sort((a, b) => st(a).box - st(b).box || st(a).lastSeen - st(b).lastSeen);
  const reviewOrder = [...due, ...weak, ...rest];

  // 3. Sentences from units where she has seen most words.
  const sentencePool: Sentence[] = statuses
    .filter((s) => s.unlocked && s.seen >= 0.6)
    .flatMap((s) => s.unit.sentences)
    .sort((a, b) => (p.items[a.id]?.box ?? -1) - (p.items[b.id]?.box ?? -1) || (p.items[a.id]?.lastSeen ?? 0) - (p.items[b.id]?.lastSeen ?? 0));
  const wordBanks = sentencePool.slice(0, 2).map((s) =>
    mk({ kind: 'word-bank' as const, sentenceId: s.id, tiles: shuffle([...s.en.split(' '), ...s.distractors], rng) }),
  );

  // 4. Match pairs: newest + most urgent items.
  const matchItems = [...newItems, ...reviewOrder].slice(0, 5);
  const match = matchItems.length >= 3 ? [mk({ kind: 'match-pairs' as const, itemIds: shuffle(matchItems, rng).map((i) => i.id) })] : [];

  // 5. Fill the remaining slots with reviews at the right ladder step.
  const slots = Math.max(0, LESSON_SIZE - intros.length - seconds.length - match.length - wordBanks.length);
  const reviews = reviewOrder.slice(0, slots).map((i) => choice(i, kindForBox(st(i).box)));

  // Early on there may be few reviews: add harder practice of the new words.
  const extra: ChoiceExercise[] = [];
  for (const kind of ['listen-word', 'he-to-en'] as const) {
    for (const i of newItems) {
      if (reviews.length + extra.length < slots) extra.push(choice(i, kind));
    }
  }

  const interleave = <T,>(a: T[], b: T[]) => {
    const out: T[] = [];
    for (let k = 0; k < Math.max(a.length, b.length); k++) {
      if (k < a.length) out.push(a[k]);
      if (k < b.length) out.push(b[k]);
    }
    return out;
  };

  const head = interleave<Exercise>(intros, reviews.slice(0, intros.length));
  const tail = interleave<Exercise>(seconds, [...reviews.slice(intros.length), ...extra]);
  return spreadOut([...head, ...match, ...tail, ...wordBanks]);
}

const targetOf = (e: Exercise) => (e.kind === 'match-pairs' ? null : e.kind === 'word-bank' ? e.sentenceId : e.itemId);

/** Avoid asking about the same word twice in a row by swapping with a later exercise. */
export function spreadOut(list: Exercise[]): Exercise[] {
  const out = [...list];
  for (let i = 1; i < out.length; i++) {
    const prev = targetOf(out[i - 1]);
    if (prev === null || targetOf(out[i]) !== prev) continue;
    const j = out.findIndex((e, k) => k > i && targetOf(e) !== prev && e.kind !== 'word-bank');
    if (j > 0) [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Copy of an exercise to retry at the end of the lesson. */
export function requeue(e: Exercise, n: number, rng: Rng = Math.random): Exercise {
  const key = `${e.origin}-r${n}`;
  if (e.kind === 'word-bank') return { ...e, key, tiles: shuffle(e.tiles, rng) };
  if (e.kind === 'match-pairs') return { ...e, key, itemIds: shuffle(e.itemIds, rng) };
  return { ...e, key, isNew: false, options: shuffle(e.options, rng) };
}

export function checkWordBank(sentence: Sentence, chosen: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[.!?,]/g, '').trim();
  return norm(chosen.join(' ')) === norm(sentence.en);
}
