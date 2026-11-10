import type { Sentence, WordBankExercise } from '../../engine/types';
import { speak } from '../../lib/speech';
import { sounds } from '../../lib/sounds';

interface Props {
  ex: WordBankExercise;
  sentence: Sentence;
  chosen: number[]; // indices into ex.tiles
  locked: boolean;
  onChange: (chosen: number[]) => void;
}

export function WordBankView({ ex, sentence, chosen, locked, onChange }: Props) {
  return (
    <div className="exercise">
      <h2 className="prompt">סדרי את המשפט באנגלית</h2>
      <div className="word-card sentence">
        <span className="emoji-big">{sentence.emoji}</span>
        <span className="he">{sentence.he}</span>
      </div>

      <div className="answer-line" dir="ltr">
        {chosen.map((t) => (
          <button
            key={t}
            className="tile"
            disabled={locked}
            lang="en"
            onClick={() => {
              sounds.tap();
              onChange(chosen.filter((c) => c !== t));
            }}
          >
            {ex.tiles[t]}
          </button>
        ))}
      </div>

      <div className="bank" dir="ltr">
        {ex.tiles.map((w, t) => {
          const used = chosen.includes(t);
          return (
            <button
              key={t}
              className={`tile ${used ? 'used' : ''}`}
              disabled={used || locked}
              lang="en"
              onClick={() => {
                speak(w);
                onChange([...chosen, t]);
              }}
            >
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}
