import { useState } from 'react';
import { currentUnit, unitStatuses, type UnitStatus } from '../engine/lessonBuilder';
import { DAILY_GOAL, currentStreak, lessonsToday, nextTrack, type Progress } from '../engine/progress';
import type { Track, Unit } from '../engine/types';
import { JumpSheet } from './JumpSheet';

interface Props {
  talkUnits: Unit[];
  readUnits: Unit[];
  progress: Progress;
  onStart: (track: Track) => void;
  onJump: (unit: Unit) => void;
}

const TRACK_LABEL: Record<Track, string> = { talk: '🗣️ מדברים', read: '📖 קוראים' };

/** One path: speaking and reading units interleaved. Each track still unlocks on its own. */
function interleave(a: UnitStatus[], b: UnitStatus[]): UnitStatus[] {
  const out: UnitStatus[] = [];
  for (let k = 0; k < Math.max(a.length, b.length); k++) {
    if (k < a.length) out.push(a[k]);
    if (k < b.length) out.push(b[k]);
  }
  return out;
}

export function Home({ talkUnits, readUnits, progress, onStart, onJump }: Props) {
  const [jumpTo, setJumpTo] = useState<Unit | null>(null);
  const now = Date.now();
  const talk = unitStatuses(talkUnits, progress);
  const read = unitStatuses(readUnits, progress);
  const currentIds = new Set([currentUnit(talk).unit.id, currentUnit(read).unit.id]);
  const path = interleave(talk, read);
  const next = nextTrack(progress);
  const today = lessonsToday(progress, now);
  const streak = currentStreak(progress, now);
  const goalDone = today >= DAILY_GOAL;
  const fresh = progress.lessons.length === 0;

  return (
    <div className="home">
      <header className="topbar">
        <div className="chip chip-streak" title="ימים ברצף">🔥 {streak}</div>
        <div className="chip chip-gems" title="יהלומים">💎 {progress.gems}</div>
        <div className="chip chip-xp" title="נקודות">⭐ {progress.xp}</div>
      </header>

      <section className={`goal ${goalDone ? 'done' : ''}`}>
        <div className="goal-text">{goalDone ? 'עמדת במטרה היומית! 🎉' : 'המטרה היומית'}</div>
        <div className="goal-bar">
          <div className="goal-fill" style={{ width: `${Math.min(1, today / DAILY_GOAL) * 100}%` }} />
        </div>
        <div className="goal-count">
          {Math.min(today, DAILY_GOAL)}/{DAILY_GOAL} שיעורים
        </div>
      </section>

      <section className="path">
        {path.map((s, i) => {
          const isCur = currentIds.has(s.unit.id);
          const state = !s.unlocked ? 'locked' : s.complete && !isCur ? 'complete' : isCur ? 'current' : 'open';
          return (
            <div key={s.unit.id} className={`node-wrap ${i % 2 ? 'right' : 'left'}`}>
              <button
                className={`node ${state} track-${s.unit.track}`}
                onClick={() => (state === 'locked' ? setJumpTo(s.unit) : onStart(s.unit.track))}
                style={{ ['--p' as string]: `${Math.round(s.mastered * 100)}%` }}
                aria-label={s.unit.title}
              >
                <span className="node-emoji">{state === 'locked' ? '🔒' : state === 'complete' ? '👑' : s.unit.emoji}</span>
              </button>
              <div className="node-label">
                <span className="node-track">{s.unit.track === 'talk' ? '🗣️' : '📖'}</span> <bdi>{s.unit.title}</bdi>
                {s.unlocked && <span className="node-pct"> · {Math.round(s.mastered * 100)}%</span>}
              </div>
              {state === 'locked' && (
                <button className="jump-chip" onClick={() => setJumpTo(s.unit)}>
                  ⚡ קפיצה
                </button>
              )}
            </div>
          );
        })}
      </section>

      {jumpTo && (
        <JumpSheet
          unit={jumpTo}
          onClose={() => setJumpTo(null)}
          onStart={() => {
            setJumpTo(null);
            onJump(jumpTo);
          }}
        />
      )}

      <footer className="home-footer">
        <button className="btn btn-green wide big" onClick={() => onStart(next)}>
          {fresh ? 'יאללה, מתחילים!' : 'לשיעור הבא!'}
          <span className="next-track">{TRACK_LABEL[next]}</span>
        </button>
      </footer>
    </div>
  );
}
