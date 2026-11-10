import { unitStatuses, currentUnit } from '../engine/lessonBuilder';
import { DAILY_GOAL, currentStreak, lessonsToday, type Progress } from '../engine/progress';
import type { Unit } from '../engine/types';

interface Props {
  units: Unit[];
  progress: Progress;
  onStart: () => void;
}

export function Home({ units, progress, onStart }: Props) {
  const now = Date.now();
  const statuses = unitStatuses(units, progress);
  const cur = currentUnit(statuses);
  const today = lessonsToday(progress, now);
  const streak = currentStreak(progress, now);
  const goalDone = today >= DAILY_GOAL;

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
        {statuses.map((s, i) => {
          const isCur = s.unit.id === cur.unit.id;
          const state = !s.unlocked ? 'locked' : s.complete && !isCur ? 'complete' : 'current';
          return (
            <div key={s.unit.id} className={`node-wrap ${i % 2 ? 'right' : 'left'}`}>
              <button
                className={`node ${state}`}
                disabled={!isCur}
                onClick={onStart}
                style={{ ['--p' as string]: `${Math.round(s.mastered * 100)}%` }}
                aria-label={s.unit.title}
              >
                <span className="node-emoji">{state === 'locked' ? '🔒' : state === 'complete' ? '👑' : s.unit.emoji}</span>
              </button>
              <div className="node-label">
                {s.unit.title}
                {s.unlocked && <span className="node-pct"> · {Math.round(s.mastered * 100)}%</span>}
              </div>
            </div>
          );
        })}
      </section>

      <footer className="home-footer">
        <button className="btn btn-green wide big" onClick={onStart}>
          {progress.lessons.length === 0 ? 'יאללה, מתחילים!' : 'לשיעור הבא!'}
        </button>
      </footer>
    </div>
  );
}
