import { useMemo, useRef, useState } from 'react';
import { JUMP_MAX_MISTAKES, checkWordBank, requeue } from '../engine/lessonBuilder';
import type { AnswerEvent, LessonResult } from '../engine/progress';
import { SKILL_OF, type Exercise, type Item, type Sentence } from '../engine/types';
import { comfort, praise } from '../lib/praise';
import { sounds } from '../lib/sounds';
import { speak } from '../lib/speech';
import { ChoiceView, spoken } from './exercises/ChoiceView';
import { SoundStartView } from './exercises/SoundStartView';
import { MatchView } from './exercises/MatchView';
import { WordBankView } from './exercises/WordBankView';

interface Props {
  exercises: Exercise[];
  items: Map<string, Item>;
  sentences: Map<string, Sentence>;
  onAnswer: (e: AnswerEvent) => void;
  onFinish: (r: LessonResult) => void;
  onQuit: () => void;
  /** Jump-ahead test: no retries, answers don't change memory state. */
  test?: boolean;
}

interface Feedback {
  correct: boolean;
  message: string;
  answer?: { en: string; he: string; emoji: string; say?: string };
}

export function Lesson({ exercises, items, sentences, onAnswer, onFinish, onQuit, test = false }: Props) {
  const target = (id: string) => (sentences.get(id) ?? items.get(id))!;
  const [queue, setQueue] = useState(exercises);
  const [pos, setPos] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [combo, setCombo] = useState(0);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const firstTry = useRef(new Map<string, boolean>());
  const shownAt = useRef(Date.now());
  const startedAt = useRef(Date.now());
  const retries = useRef(0);

  const total = useMemo(() => new Set(exercises.map((e) => e.origin)).size, [exercises]);
  const mistakes = [...firstTry.current.values()].filter((v) => !v).length;
  const ex = queue[pos];

  const log = (itemId: string, correct: boolean) => {
    onAnswer({
      itemId,
      kind: ex.kind,
      skill: SKILL_OF[ex.kind],
      correct,
      retry: firstTry.current.has(ex.origin),
      ...(test ? { test } : {}),
      ms: Date.now() - shownAt.current,
      ts: Date.now(),
    });
  };

  const settle = (correct: boolean, answer?: Feedback['answer']) => {
    if (!firstTry.current.has(ex.origin)) firstTry.current.set(ex.origin, correct);
    if (correct) {
      sounds.correct();
      setSolved((s) => new Set(s).add(ex.origin));
      setCombo((c) => c + 1);
    } else {
      sounds.wrong();
      setCombo(0);
      if (!test) {
        retries.current += 1;
        setQueue((q) => [...q, requeue(ex, retries.current)]);
      }
    }
    if (answer) speak(answer.say ?? answer.en);
    setFeedback({ correct, message: correct ? praise() : test ? 'לא נורא!' : comfort(), answer });
  };

  const check = () => {
    if (ex.kind === 'word-bank') {
      const s = target(ex.targetId);
      const ok = checkWordBank(s, chosen.map((t) => ex.tiles[t]), ex.letters);
      log(ex.targetId, ok);
      settle(ok, { en: s.en, he: s.he, emoji: s.emoji });
    } else if (ex.kind === 'sound-start') {
      const letter = items.get(ex.itemId)!;
      const pic = ex.pictures[ex.answer];
      const ok = choice === String(ex.answer);
      log(letter.id, ok);
      settle(ok, { en: pic.en, he: `מתחיל ב-${letter.en}`, emoji: pic.emoji });
    } else if (ex.kind !== 'match-pairs') {
      const it = items.get(ex.itemId)!;
      const ok = choice === ex.itemId;
      log(it.id, ok);
      settle(ok, { en: it.en, he: it.he, emoji: it.emoji, say: spoken(it) });
    }
  };

  const matchDone = (mistakes: Set<string>) => {
    for (const id of ex.kind === 'match-pairs' ? ex.itemIds : []) log(id, !mistakes.has(id));
    if (!firstTry.current.has(ex.origin)) firstTry.current.set(ex.origin, mistakes.size === 0);
    sounds.correct();
    setSolved((s) => new Set(s).add(ex.origin));
    setCombo((c) => (mistakes.size === 0 ? c + 1 : 0));
    setFeedback({ correct: true, message: mistakes.size === 0 ? praise() : 'כל הזוגות הותאמו!' });
  };

  const next = () => {
    if (pos + 1 >= queue.length || (test && mistakes > JUMP_MAX_MISTAKES)) {
      const results = [...firstTry.current.values()];
      onFinish({ startedAt: startedAt.current, firstTryCorrect: results.filter(Boolean).length, total: results.length });
      return;
    }
    setPos(pos + 1);
    setChoice(null);
    setChosen([]);
    setFeedback(null);
    shownAt.current = Date.now();
  };

  const canCheck = ex.kind === 'word-bank' ? chosen.length > 0 : choice !== null;
  const isRetry = ex.key !== ex.origin;

  return (
    <div className="lesson">
      <header className="lesson-top">
        <button className="quit" aria-label="יציאה" onClick={onQuit}>
          ✕
        </button>
        <div className="bar">
          <div className="bar-fill" style={{ width: `${((test ? firstTry.current.size : solved.size) / total) * 100}%` }} />
        </div>
        {test ? (
          <div className="test-lives" aria-label="טעויות">
            {Array.from({ length: 3 }, (_, k) => (k < 3 - mistakes ? '⚡' : '·')).join('')}
          </div>
        ) : (
          combo >= 3 && <div className="combo">🔥 {combo}</div>
        )}
      </header>

      <main className="lesson-body" key={ex.key}>
        {isRetry && <div className="badge-retry">🔁 עוד ניסיון</div>}
        {ex.kind === 'match-pairs' ? (
          <MatchView ex={ex} items={items} onComplete={matchDone} />
        ) : ex.kind === 'word-bank' ? (
          <WordBankView ex={ex} sentence={target(ex.targetId)} chosen={chosen} locked={!!feedback} onChange={setChosen} />
        ) : ex.kind === 'sound-start' ? (
          <SoundStartView ex={ex} letter={items.get(ex.itemId)!} selected={choice} locked={!!feedback} onSelect={setChoice} />
        ) : (
          <ChoiceView ex={ex} items={items} selected={choice} locked={!!feedback} onSelect={setChoice} />
        )}
      </main>

      <footer className={`lesson-footer ${feedback ? (feedback.correct ? 'good' : 'bad') : ''}`}>
        {feedback ? (
          <>
            <div className="feedback">
              <div className="feedback-title">{feedback.message}</div>
              {feedback.answer && (
                <div className="feedback-answer">
                  {!feedback.correct && <span>התשובה: </span>}
                  <span>{feedback.answer.emoji} </span>
                  <bdi dir="ltr" lang="en" className="en">{feedback.answer.en}</bdi>
                  <span className="he-small"> · {feedback.answer.he}</span>
                </div>
              )}
            </div>
            <button className={`btn ${feedback.correct ? 'btn-green' : 'btn-red'}`} onClick={next}>
              המשך
            </button>
          </>
        ) : ex.kind === 'match-pairs' ? null : (
          <button className="btn btn-green" disabled={!canCheck} onClick={check}>
            בדיקה
          </button>
        )}
      </footer>
    </div>
  );
}
