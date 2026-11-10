import type { Progress } from './progress';
import type { ChoiceExercise, ChoiceKind, Exercise, Item, MatchExercise, Sentence, Unit, WordBankExercise } from './types';

export const LESSON_SIZE = 12;
export const JUMP_TEST_SIZE = 8;
export const JUMP_MAX_MISTAKES = 2;
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

/**
 * A unit is unlocked when the previous one is complete, or once she has started it
 * (so forgetting a few old words never re-locks a unit she's already in).
 */
export function unitStatuses(units: Unit[], p: Progress): UnitStatus[] {
  let prevComplete = true;
  return units.map((unit) => {
    const n = unit.items.length || 1;
    const mastered = unit.items.filter((i) => (p.items[i.id]?.box ?? 0) >= UNIT_COMPLETE_BOX).length / n;
    const seen = unit.items.filter((i) => p.items[i.id]).length / n;
    const complete = mastered >= UNIT_COMPLETE_FRACTION;
    const unlocked = prevComplete || seen > 0;
    prevComplete = unlocked && complete;
    return { unit, mastered, seen, unlocked, complete };
  });
}

/** The unit new words come from: the first unlocked unit that still has unseen items. */
export function currentUnit(statuses: UnitStatus[]): UnitStatus {
  const unlocked = statuses.filter((s) => s.unlocked);
  return (
    unlocked.find((s) => s.seen < 1) ??
    unlocked.find((s) => !s.complete) ??
    unlocked[unlocked.length - 1]
  );
}

/** How many new items to introduce, based on accuracy in the last few (non-test) lessons. */
export function newWordCount(p: Progress): number {
  const recent = p.lessons.filter((l) => !l.test).slice(-3);
  if (recent.length === 0) return 3;
  const acc = recent.reduce((a, l) => a + l.accuracy, 0) / recent.length;
  if (acc < 0.7) return 2;
  if (acc > 0.9) return 4;
  return 3;
}

/** Exercise type climbs a difficulty ladder as the item's box grows. */
export function kindForBox(box: number, type: Item['type'] = 'word'): ChoiceKind | 'word-bank' {
  if (type === 'phrase') {
    if (box <= 0) return 'en-to-he';
    if (box === 1) return 'listen-meaning';
    if (box === 2) return 'he-to-en';
    return 'word-bank';
  }
  if (box <= 0) return 'pick-picture';
  if (box === 1) return 'listen-picture';
  if (box === 2) return 'listen-word';
  return 'he-to-en';
}

/** Tiles: words without punctuation (so a trailing '?' doesn't give the answer away). */
const wordsOf = (s: string) => s.split(' ').map((w) => w.replace(/[.!?,]/g, '')).filter(Boolean);
const bare = (w: string) => w.toLowerCase().replace(/[.!?,]/g, '');

class Factory {
  private counter = 0;
  constructor(
    private units: Unit[],
    private pool: Item[],
    private rng: Rng,
  ) {}

  private mk<T extends Exercise>(e: Omit<T, 'key' | 'origin'>): T {
    const key = `ex${this.counter++}`;
    return { ...e, key, origin: key } as T;
  }

  choice(item: Item, kind: ChoiceKind, isNew = false): ChoiceExercise {
    const sameUnit = this.units.find((u) => u.id === item.unitId)?.items ?? [];
    let others = sameUnit.filter((i) => i.id !== item.id);
    if (others.length < 3) others = this.pool.filter((i) => i.id !== item.id && i.type === item.type);
    const distractors = shuffle(others, this.rng).slice(0, 3);
    const options = shuffle([item, ...distractors], this.rng).map((i) => i.id);
    return this.mk<ChoiceExercise>({ kind, itemId: item.id, options, isNew });
  }

  sentence(s: Sentence): WordBankExercise {
    return this.mk<WordBankExercise>({ kind: 'word-bank', targetId: s.id, tiles: shuffle([...wordsOf(s.en), ...s.distractors], this.rng) });
  }

  /** Build-the-phrase: distractor tiles come from other phrases in the same unit. */
  phrase(item: Item): WordBankExercise {
    const own = new Set(wordsOf(item.en).map(bare));
    const sameUnit = this.units.find((u) => u.id === item.unitId)?.items ?? [];
    const candidates = [...new Set(sameUnit.filter((i) => i.id !== item.id).flatMap((i) => wordsOf(i.en)))].filter(
      (w) => !own.has(bare(w)),
    );
    const distractors = shuffle(candidates, this.rng).slice(0, 2);
    return this.mk<WordBankExercise>({ kind: 'word-bank', targetId: item.id, tiles: shuffle([...wordsOf(item.en), ...distractors], this.rng) });
  }

  practice(item: Item, kind: ChoiceKind | 'word-bank'): Exercise {
    if (kind !== 'word-bank') return this.choice(item, kind);
    // Building a one- or two-word phrase from tiles is too trivial: ask for recall instead.
    return wordsOf(item.en).length >= 3 ? this.phrase(item) : this.choice(item, 'he-to-en');
  }

  match(items: Item[]): Exercise {
    return this.mk<MatchExercise>({ kind: 'match-pairs', itemIds: shuffle(items, this.rng).map((i) => i.id) });
  }
}

const interleave = <T>(a: T[], b: T[]) => {
  const out: T[] = [];
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    if (k < a.length) out.push(a[k]);
    if (k < b.length) out.push(b[k]);
  }
  return out;
};

export function buildLesson(units: Unit[], p: Progress, now: number, rng: Rng = Math.random): Exercise[] {
  const statuses = unitStatuses(units, p);
  const unlockedUnits = statuses.filter((s) => s.unlocked).map((s) => s.unit);
  const pool = unlockedUnits.flatMap((u) => u.items);
  const cur = currentUnit(statuses).unit;
  const f = new Factory(units, pool, rng);

  // 1. New items from the current unit: an intro, then a second exposure later on.
  const newItems = cur.items.filter((i) => !p.items[i.id]).slice(0, newWordCount(p));
  const intros = newItems.map((i) => f.choice(i, i.type === 'phrase' ? 'en-to-he' : 'pick-picture', true));
  const seconds = newItems.map((i) => f.choice(i, i.type === 'phrase' ? 'listen-meaning' : 'listen-picture'));

  // 2. Seen items, prioritised: due first, then weak, then least practised.
  const seen = pool.filter((i) => p.items[i.id]);
  const st = (i: Item) => p.items[i.id];
  const isWeak = (i: Item) => st(i).box === 0 || st(i).wrong * 2 > st(i).correct;
  const due = seen.filter((i) => st(i).due <= now).sort((a, b) => st(a).box - st(b).box || st(a).due - st(b).due);
  const weak = seen.filter((i) => !due.includes(i) && isWeak(i));
  const rest = seen
    .filter((i) => !due.includes(i) && !weak.includes(i))
    .sort((a, b) => st(a).box - st(b).box || st(a).lastSeen - st(b).lastSeen);
  const reviewOrder = [...due, ...weak, ...rest];

  // 3. Sentences from word units where she has seen most words.
  const sentencePool: Sentence[] = statuses
    .filter((s) => s.unlocked && s.seen >= 0.6)
    .flatMap((s) => s.unit.sentences)
    .sort(
      (a, b) =>
        (p.items[a.id]?.box ?? -1) - (p.items[b.id]?.box ?? -1) ||
        (p.items[a.id]?.lastSeen ?? 0) - (p.items[b.id]?.lastSeen ?? 0),
    );
  const wordBanks = sentencePool.slice(0, 2).map((s) => f.sentence(s));

  // 4. Match pairs: newest + most urgent items.
  const matchItems = [...newItems, ...reviewOrder].slice(0, 5);
  const match = matchItems.length >= 3 ? [f.match(matchItems)] : [];

  // 5. Fill the remaining slots with reviews at the right ladder step.
  const slots = Math.max(0, LESSON_SIZE - intros.length - seconds.length - match.length - wordBanks.length);
  const reviews = reviewOrder.slice(0, slots).map((i) => f.practice(i, kindForBox(st(i).box, i.type)));

  // Early on there may be few reviews: add harder practice of the new items.
  const extra: Exercise[] = [];
  for (const box of [2, 3]) {
    for (const i of newItems) {
      if (reviews.length + extra.length < slots) extra.push(f.practice(i, kindForBox(box, i.type)));
    }
  }

  const head = interleave<Exercise>(intros, reviews.slice(0, intros.length));
  const tail = interleave<Exercise>(seconds, [...reviews.slice(intros.length), ...extra]);
  return spreadOut([...head, ...match, ...tail, ...wordBanks]);
}

/**
 * Jump-ahead test for a locked unit: harder exercises on that unit's items.
 * Pass with at most JUMP_MAX_MISTAKES mistakes to unlock it (and everything before it).
 */
export function buildJumpTest(units: Unit[], unitId: string, rng: Rng = Math.random): Exercise[] {
  const unit = units.find((u) => u.id === unitId)!;
  const f = new Factory(units, unit.items, rng);
  const picked = shuffle(unit.items, rng).slice(0, JUMP_TEST_SIZE);
  return picked.map((item, k) => {
    const kinds: (ChoiceKind | 'word-bank')[] =
      item.type === 'phrase' ? ['listen-meaning', 'he-to-en', 'word-bank'] : ['listen-word', 'he-to-en'];
    return f.practice(item, kinds[k % kinds.length]);
  });
}

/** Item ids she is credited with after passing a jump test for unitId. */
export function itemsUpTo(units: Unit[], unitId: string): string[] {
  const idx = units.findIndex((u) => u.id === unitId);
  return units.slice(0, idx + 1).flatMap((u) => u.items.map((i) => i.id));
}

const targetOf = (e: Exercise) => (e.kind === 'match-pairs' ? null : e.kind === 'word-bank' ? e.targetId : e.itemId);

/** Avoid asking about the same item twice in a row by swapping with a later exercise. */
export function spreadOut(list: Exercise[]): Exercise[] {
  const out = [...list];
  for (let i = 1; i < out.length; i++) {
    const prev = targetOf(out[i - 1]);
    if (prev === null || targetOf(out[i]) !== prev) continue;
    const j = out.findIndex((e, k) => k > i && targetOf(e) !== prev);
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

export function checkWordBank(target: { en: string }, chosen: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[.!?,]/g, '').replace(/\s+/g, ' ').trim();
  return norm(chosen.join(' ')) === norm(target.en);
}
