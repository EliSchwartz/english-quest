import { useMemo, useState } from 'react';
import type { Item, MatchExercise } from '../../engine/types';
import { shuffle } from '../../engine/lessonBuilder';
import { speak } from '../../lib/speech';
import { sounds } from '../../lib/sounds';

interface Props {
  ex: MatchExercise;
  items: Map<string, Item>;
  onComplete: (mistakes: Set<string>) => void;
}

export function MatchView({ ex, items, onComplete }: Props) {
  const words = ex.itemIds;
  const pics = useMemo(() => shuffle(ex.itemIds, Math.random), [ex.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [word, setWord] = useState<string | null>(null);
  const [pic, setPic] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [bad, setBad] = useState<string[]>([]);
  const [mistakes] = useState<Set<string>>(() => new Set());

  const attempt = (w: string | null, p: string | null) => {
    if (!w || !p) return;
    if (w === p) {
      sounds.correct();
      const next = new Set(done).add(w);
      setDone(next);
      if (next.size === words.length) setTimeout(() => onComplete(mistakes), 350);
    } else {
      sounds.wrong();
      mistakes.add(w);
      mistakes.add(p);
      setBad([`w:${w}`, `p:${p}`]);
      setTimeout(() => setBad([]), 500);
    }
    setWord(null);
    setPic(null);
  };

  const cls = (side: 'w' | 'p', id: string, sel: string | null) =>
    ['option', done.has(id) ? 'matched' : '', sel === id ? 'selected' : '', bad.includes(`${side}:${id}`) ? 'shake wrong' : '']
      .filter(Boolean)
      .join(' ');

  return (
    <div className="exercise">
      <h2 className="prompt">התאימי זוגות</h2>
      <div className="match-grid">
        <div className="match-col">
          {words.map((id) => (
            <button
              key={id}
              className={cls('w', id, word)}
              disabled={done.has(id)}
              onClick={() => {
                const it = items.get(id)!;
                // Reading practice: don't read decodable words aloud before she matches them.
                if (it.type !== 'decodable') speak(it.type === 'letter' ? it.keyword ?? it.en : it.en);
                setWord(id);
                attempt(id, pic);
              }}
            >
              <bdi dir="ltr" lang="en" className="en">{items.get(id)!.en}</bdi>
            </button>
          ))}
        </div>
        <div className="match-col">
          {pics.map((id) => (
            <button
              key={id}
              className={cls('p', id, pic)}
              disabled={done.has(id)}
              onClick={() => {
                sounds.tap();
                setPic(id);
                attempt(word, id);
              }}
            >
              {items.get(id)!.type === 'phrase' ? (
                <span className="he">{items.get(id)!.he}</span>
              ) : (
                <span className="emoji-option small">{items.get(id)!.emoji}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
