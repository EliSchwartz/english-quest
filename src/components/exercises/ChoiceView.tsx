import { useEffect } from 'react';
import type { ChoiceExercise, Item } from '../../engine/types';
import { speak } from '../../lib/speech';
import { sounds } from '../../lib/sounds';
import { SpeakerButton } from '../SpeakerButton';

const PROMPT: Record<ChoiceExercise['kind'], string> = {
  'pick-picture': 'בחרי את התמונה הנכונה',
  'listen-picture': 'הקשיבי ובחרי תמונה',
  'listen-word': 'הקשיבי ובחרי את המילה',
  'he-to-en': 'איך אומרים באנגלית?',
};

interface Props {
  ex: ChoiceExercise;
  items: Map<string, Item>;
  selected: string | null;
  locked: boolean;
  onSelect: (id: string) => void;
}

export function ChoiceView({ ex, items, selected, locked, onSelect }: Props) {
  const item = items.get(ex.itemId)!;
  const pictures = ex.kind === 'pick-picture' || ex.kind === 'listen-picture';
  const listening = ex.kind === 'listen-picture' || ex.kind === 'listen-word';

  useEffect(() => {
    if (ex.kind !== 'he-to-en') speak(item.en);
  }, [ex.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="exercise">
      {ex.isNew && <div className="badge-new">✨ מילה חדשה!</div>}
      <h2 className="prompt">{PROMPT[ex.kind]}</h2>

      <div className="stimulus">
        {ex.kind === 'pick-picture' && (
          <div className="word-card">
            <SpeakerButton text={item.en} small />
            <bdi className="en big" dir="ltr" lang="en">{item.en}</bdi>
            {ex.isNew && <span className="he-hint">{item.he}</span>}
          </div>
        )}
        {listening && (
          <div className="listen-row">
            <SpeakerButton text={item.en} />
            <SpeakerButton text={item.en} slow />
          </div>
        )}
        {ex.kind === 'he-to-en' && (
          <div className="word-card">
            <span className="emoji-big">{item.emoji}</span>
            <span className="he big">{item.he}</span>
          </div>
        )}
      </div>

      <div className={`options ${pictures ? 'pictures' : 'words'}`}>
        {ex.options.map((id) => {
          const o = items.get(id)!;
          return (
            <button
              key={id}
              className={`option ${selected === id ? 'selected' : ''} ${locked && id === ex.itemId ? 'right' : ''} ${
                locked && selected === id && id !== ex.itemId ? 'wrong' : ''
              }`}
              disabled={locked}
              onClick={() => {
                sounds.tap();
                if (ex.kind === 'he-to-en') speak(o.en);
                onSelect(id);
              }}
            >
              {pictures ? (
                <span className="emoji-option">{o.emoji}</span>
              ) : (
                <bdi dir="ltr" lang="en" className="en">{o.en}</bdi>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
