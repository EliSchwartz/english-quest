import type { Progress } from './progress';
import type {
  ChoiceExercise,
  ChoiceKind,
  Exercise,
  Item,
  MatchExercise,
  Sentence,
  SoundStartExercise,
  Unit,
  WordBankExercise,
} from './types';

export type PracticeKind = ChoiceKind | 'word-bank' | 'sound-start';

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
export function kindForBox(box: number, type: Item['type'] = 'word'): PracticeKind {
  if (type === 'letter') {
    if (box <= 0) return 'letter-sound';
    if (box === 1) return 'hear-letter';
    if (box === 2) return 'sound-start';
    return box % 2 ? 'hear-letter' : 'sound-start';
  }
  if (type === 'decodable') {
    // Alternate reading (word -> picture) with hearing (sound -> written word) for variety.
    if (box <= 0) return 'read-pick';
    if (box === 1) return 'listen-word';
    if (box === 2) return 'read-pick';
    return 'word-bank';
  }
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
/** What a match/choice option shows on its picture side: two items with the same face can't be told apart. */
const face = (i: Item) => (i.type === 'phrase' ? i.he : i.emoji);

function uniqueBy<T>(xs: T[], key: (x: T) => string): T[] {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)));
}

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

  /** Items that can't be told apart from `item` (c and k sound the same). */
  private confusable(item: Item, other: Item) {
    return other.id === item.id || (item.confusable ?? []).includes(other.en) || (other.confusable ?? []).includes(item.en);
  }

  choice(item: Item, kind: ChoiceKind, isNew = false): ChoiceExercise {
    // Vowels have no Hebrew letter to pick: practise them by hearing a keyword instead.
    if (kind === 'letter-sound' && item.vowel) kind = 'hear-letter';
    const usable = (i: Item) =>
      !this.confusable(item, i) && !(kind === 'letter-sound' && i.vowel) && face(i) !== face(item) && i.en !== item.en && i.he !== item.he;
    const sameUnit = this.units.find((u) => u.id === item.unitId)?.items ?? [];
    let others = sameUnit.filter(usable);
    if (others.length < 3) others = this.pool.filter((i) => i.type === item.type && usable(i));
    const distractors = uniqueBy(shuffle(others, this.rng), face).slice(0, 3);
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

  /** Letter -> which picture starts with this sound? Distractor pictures come from other letters. */
  soundStart(item: Item): SoundStartExercise {
    const own = [{ en: item.keyword ?? item.en, emoji: item.emoji }, ...(item.examples ?? [])];
    const correct = own[Math.floor(this.rng() * own.length)];
    const letters = this.pool.filter((i) => i.type === 'letter' && !this.confusable(item, i));
    const distractors = shuffle(letters, this.rng)
      .slice(0, 3)
      .map((l) => {
        const pics = [{ en: l.keyword ?? l.en, emoji: l.emoji }, ...(l.examples ?? [])];
        return pics[Math.floor(this.rng() * pics.length)];
      });
    const pictures = shuffle([correct, ...distractors], this.rng);
    return this.mk<SoundStartExercise>({ kind: 'sound-start', itemId: item.id, pictures, answer: pictures.indexOf(correct) });
  }

  /** Spell a word from letter tiles (plus two letters that aren't in it). */
  spell(item: Item): WordBankExercise {
    const letters = [...item.en.toLowerCase()].filter((c) => /[a-z]/.test(c));
    const others = shuffle([...'abcdefghijklmnoprstuvwyz'].filter((c) => !letters.includes(c)), this.rng).slice(0, 2);
    return this.mk<WordBankExercise>({ kind: 'word-bank', targetId: item.id, tiles: shuffle([...letters, ...others], this.rng), letters: true });
  }

  practice(item: Item, kind: PracticeKind): Exercise {
    if (kind === 'sound-start') return this.soundStart(item);
    if (kind === 'word-bank' && item.type === 'decodable') return this.spell(item);
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
  const INTRO: Record<Item['type'], ChoiceKind> = { word: 'pick-picture', phrase: 'en-to-he', letter: 'letter-sound', decodable: 'read-pick' };
  const SECOND: Record<Item['type'], ChoiceKind> = { word: 'listen-picture', phrase: 'listen-meaning', letter: 'hear-letter', decodable: 'listen-word' };
  const intros = newItems.map((i) => f.choice(i, INTRO[i.type], true));
  const seconds = newItems.map((i) => f.choice(i, SECOND[i.type]));

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
  const matchItems = uniqueBy(uniqueBy([...newItems, ...reviewOrder], face), (i) => i.en).slice(0, 5);
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

  // Small units can run out of material: practise reviewed items again one step up the ladder.
  for (const i of reviewOrder.slice(0, slots)) {
    if (reviews.length + extra.length >= slots) break;
    extra.push(f.practice(i, kindForBox(st(i).box + 1, i.type)));
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
    const KINDS: Record<Item['type'], PracticeKind[]> = {
      word: ['listen-word', 'he-to-en'],
      phrase: ['listen-meaning', 'he-to-en', 'word-bank'],
      letter: ['hear-letter', 'sound-start', 'letter-sound'],
      decodable: ['read-pick', 'listen-word', 'word-bank'],
    };
    const kinds = KINDS[item.type];
    return f.practice(item, kinds[k % kinds.length]);
  });
}

/** Item ids she is credited with after passing a jump test for unitId. */
export function itemsUpTo(units: Unit[], unitId: string): string[] {
  const idx = units.findIndex((u) => u.id === unitId);
  return units.slice(0, idx + 1).flatMap((u) => u.items.map((i) => i.id));
}

const targetOf = (e: Exercise) => (e.kind === 'match-pairs' ? null : e.kind === 'word-bank' ? e.targetId : e.itemId);
export { targetOf };

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
  if (e.kind === 'sound-start') {
    const pictures = shuffle(e.pictures, rng);
    return { ...e, key, pictures, answer: pictures.indexOf(e.pictures[e.answer]) };
  }
  return { ...e, key, isNew: false, options: shuffle(e.options, rng) };
}

export function checkWordBank(target: { en: string }, chosen: string[], letters = false): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[.!?,]/g, '').replace(/\s+/g, letters ? '' : ' ').trim();
  return norm(chosen.join(letters ? '' : ' ')) === norm(target.en);
}
