import { useEffect } from 'react';
import type { WordBankExercise } from '../../engine/types';
import { speak } from '../../lib/speech';
import { SpeakerButton } from '../SpeakerButton';
import { sounds } from '../../lib/sounds';

interface Props {
  ex: WordBankExercise;
  sentence: { en: string; he: string; emoji: string };
  chosen: number[]; // indices into ex.tiles
  locked: boolean;
  onChange: (chosen: number[]) => void;
}

export function WordBankView({ ex, sentence, chosen, locked, onChange }: Props) {
  useEffect(() => {
    if (ex.letters) speak(sentence.en);
  }, [ex.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="exercise">
      <h2 className="prompt">{ex.letters ? 'כתבי את המילה' : 'סדרי את המשפט באנגלית'}</h2>
      <div className="word-card sentence">
        <span className="emoji-big">{sentence.emoji}</span>
        {ex.letters ? <SpeakerButton text={sentence.en} small /> : <span className="he">{sentence.he}</span>}
      </div>

      <div className={`answer-line ${ex.letters ? 'spelling' : ''}`} dir="ltr">
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

      <div className={`bank ${ex.letters ? 'spelling' : ''}`} dir="ltr">
        {ex.tiles.map((w, t) => {
          const used = chosen.includes(t);
          return (
            <button
              key={t}
              className={`tile ${used ? 'used' : ''}`}
              disabled={used || locked}
              lang="en"
              onClick={() => {
                if (ex.letters) sounds.tap();
                else speak(w);
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
