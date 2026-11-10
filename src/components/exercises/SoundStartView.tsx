import type { Item, SoundStartExercise } from '../../engine/types';
import { speak } from '../../lib/speech';

interface Props {
  ex: SoundStartExercise;
  letter: Item;
  selected: string | null;
  locked: boolean;
  onSelect: (index: string) => void;
}

/** "Which picture starts with the sound of this letter?" Tapping a picture says its word. */
export function SoundStartView({ ex, letter, selected, locked, onSelect }: Props) {
  return (
    <div className="exercise">
      <h2 className="prompt">איזו תמונה מתחילה בצליל של האות?</h2>
      <div className="stimulus">
        <div className="word-card letter-card">
          <bdi className="en letter-big" dir="ltr" lang="en">
            {letter.en}
          </bdi>
        </div>
      </div>
      <p className="tip">💡 לחצי על תמונה כדי לשמוע אותה</p>
      <div className="options pictures">
        {ex.pictures.map((pic, i) => {
          const id = String(i);
          return (
            <button
              key={pic.en}
              className={`option ${selected === id ? 'selected' : ''} ${locked && i === ex.answer ? 'right' : ''} ${
                locked && selected === id && i !== ex.answer ? 'wrong' : ''
              }`}
              disabled={locked}
              onClick={() => {
                speak(pic.en);
                onSelect(id);
              }}
            >
              <span className="emoji-option">{pic.emoji}</span>
              {locked && (
                <bdi dir="ltr" lang="en" className="en pic-caption">
                  {pic.en}
                </bdi>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
