import type { ExerciseKind, Skill } from './types';

/** Leitner-style memory state for one item or sentence. Box 0 = shaky, 5 = solid. */
export interface ItemState {
  box: number;
  due: number;
  seen: number;
  correct: number;
  wrong: number;
  lastSeen: number;
}

export interface AnswerEvent {
  itemId: string;
  kind: ExerciseKind;
  skill: Skill;
  correct: boolean;
  retry: boolean;
  /** Answer given in a jump-ahead test: logged, but doesn't change memory state. */
  test?: boolean;
  ms: number;
  ts: number;
}

export interface LessonRecord {
  startedAt: number;
  finishedAt: number;
  xp: number;
  accuracy: number;
  test?: boolean;
}

export interface Progress {
  version: 1;
  xp: number;
  gems: number;
  streak: number;
  lastActiveDay: string | null;
  lessons: LessonRecord[];
  items: Record<string, ItemState>;
  events: AnswerEvent[];
}

export const MAX_BOX = 5;
const DAY = 24 * 60 * 60 * 1000;
/** Days until next review after reaching each box. */
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
export const DAILY_GOAL = 2;

export function emptyProgress(): Progress {
  return { version: 1, xp: 0, gems: 0, streak: 0, lastActiveDay: null, lessons: [], items: {}, events: [] };
}

/** Update the memory state of one item after a first-try answer. */
export function applyAnswer(prev: ItemState | undefined, correct: boolean, now: number): ItemState {
  const s: ItemState = prev ?? { box: 0, due: now, seen: 0, correct: 0, wrong: 0, lastSeen: now };
  // Practising before the review is due doesn't promote (except from box 0): real memory needs spacing.
  const promote = s.box === 0 || now >= s.due;
  const box = correct ? Math.min(MAX_BOX, s.box + (promote ? 1 : 0)) : Math.max(0, s.box - 1);
  return {
    box,
    due: correct ? (promote ? now + INTERVAL_DAYS[box] * DAY : s.due) : now,
    seen: s.seen + 1,
    correct: s.correct + (correct ? 1 : 0),
    wrong: s.wrong + (correct ? 0 : 1),
    lastSeen: now,
  };
}

export function recordAnswer(p: Progress, e: AnswerEvent): Progress {
  const items = e.retry || e.test ? p.items : { ...p.items, [e.itemId]: applyAnswer(p.items[e.itemId], e.correct, e.ts) };
  return { ...p, items, events: [...p.events, e] };
}

/** Local calendar day, e.g. "2026-11-10". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function previousDay(ts: number): string {
  const d = new Date(ts);
  d.setDate(d.getDate() - 1);
  return dayKey(d.getTime());
}

export interface LessonResult {
  startedAt: number;
  firstTryCorrect: number;
  total: number;
}

export function lessonRewards(r: LessonResult) {
  const perfect = r.total > 0 && r.firstTryCorrect === r.total;
  return {
    xp: 10 + r.firstTryCorrect + (perfect ? 5 : 0),
    gems: 5 + (perfect ? 5 : 0),
    accuracy: r.total ? r.firstTryCorrect / r.total : 1,
    perfect,
  };
}

export function finishLesson(p: Progress, r: LessonResult, now: number, test = false): Progress {
  const { xp, gems, accuracy } = lessonRewards(r);
  const today = dayKey(now);
  let streak = p.streak;
  if (p.lastActiveDay !== today) streak = p.lastActiveDay === previousDay(now) ? p.streak + 1 : 1;
  return {
    ...p,
    xp: p.xp + xp,
    gems: p.gems + gems,
    streak,
    lastActiveDay: today,
    lessons: [...p.lessons, { startedAt: r.startedAt, finishedAt: now, xp, accuracy, ...(test ? { test } : {}) }],
  };
}

/** Streak to display: it is broken if she missed yesterday and hasn't played today. */
export function currentStreak(p: Progress, now: number): number {
  if (!p.lastActiveDay) return 0;
  return p.lastActiveDay === dayKey(now) || p.lastActiveDay === previousDay(now) ? p.streak : 0;
}

export function lessonsToday(p: Progress, now: number): number {
  const today = dayKey(now);
  return p.lessons.filter((l) => dayKey(l.finishedAt) === today).length;
}

/** Items she proved she knows in a jump test: treat as learned, with a review in 2 days. */
export function markKnown(p: Progress, itemIds: string[], now: number): Progress {
  const items = { ...p.items };
  for (const id of itemIds) {
    const s = items[id];
    if (s && s.box >= 2) continue;
    items[id] = {
      box: 2,
      due: now + INTERVAL_DAYS[2] * DAY,
      seen: (s?.seen ?? 0) + 1,
      correct: (s?.correct ?? 0) + 1,
      wrong: s?.wrong ?? 0,
      lastSeen: now,
    };
  }
  return { ...p, items };
}
