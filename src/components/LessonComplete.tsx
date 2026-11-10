import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { sounds } from '../lib/sounds';

interface Props {
  xp: number;
  gems: number;
  accuracy: number;
  perfect: boolean;
  streak: number;
  onContinue: () => void;
}

export function LessonComplete({ xp, gems, accuracy, perfect, streak, onContinue }: Props) {
  useEffect(() => {
    sounds.fanfare();
    const burst = (x: number) => confetti({ particleCount: 90, spread: 70, origin: { x, y: 0.6 } });
    burst(0.3);
    const t = setTimeout(() => burst(0.7), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="done-screen">
      <div className="trophy">{perfect ? '🏆' : '🎉'}</div>
      <h1>{perfect ? 'שיעור מושלם!' : 'סיימת את השיעור!'}</h1>
      <div className="stats">
        <div className="stat stat-xp">
          <div className="stat-label">נקודות</div>
          <div className="stat-value">⭐ +{xp}</div>
        </div>
        <div className="stat stat-acc">
          <div className="stat-label">דיוק</div>
          <div className="stat-value">🎯 {Math.round(accuracy * 100)}%</div>
        </div>
        <div className="stat stat-gems">
          <div className="stat-label">יהלומים</div>
          <div className="stat-value">💎 +{gems}</div>
        </div>
      </div>
      {streak > 0 && <div className="streak-note">🔥 {streak === 1 ? 'יום ראשון ברצף!' : `${streak} ימים ברצף!`}</div>}
      <button className="btn btn-green wide" onClick={onContinue}>
        המשך
      </button>
    </div>
  );
}
