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
  'en-to-he': 'מה זה אומר?',
  'listen-meaning': 'הקשיבי – מה אמרו?',
};

type OptionShows = 'emoji' | 'en' | 'he';
const OPTION_SHOWS: Record<ChoiceExercise['kind'], OptionShows> = {
  'pick-picture': 'emoji',
  'listen-picture': 'emoji',
  'listen-word': 'en',
  'he-to-en': 'en',
  'en-to-he': 'he',
  'listen-meaning': 'he',
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
  const shows = OPTION_SHOWS[ex.kind];
  const listening = ex.kind === 'listen-picture' || ex.kind === 'listen-word' || ex.kind === 'listen-meaning';
  const seeEnglish = ex.kind === 'pick-picture' || ex.kind === 'en-to-he';
  const long = shows !== 'emoji' && ex.options.some((id) => (items.get(id)![shows] as string).length > 12);

  useEffect(() => {
    if (ex.kind !== 'he-to-en') speak(item.en);
  }, [ex.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="exercise">
      {ex.isNew && <div className="badge-new">✨ {item.type === 'phrase' ? 'משפט חדש!' : 'מילה חדשה!'}</div>}
      <h2 className="prompt">{PROMPT[ex.kind]}</h2>

      <div className="stimulus">
        {seeEnglish && (
          <div className="word-card">
            <SpeakerButton text={item.en} small />
            <bdi className={`en ${item.type === 'phrase' ? 'mid' : 'big'}`} dir="ltr" lang="en">
              {item.en}
            </bdi>
            {ex.isNew && ex.kind === 'pick-picture' && <span className="he-hint">{item.he}</span>}
            {ex.isNew && ex.kind === 'en-to-he' && <span className="emoji-hint">{item.emoji}</span>}
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
            <span className="he big-he">{item.he}</span>
          </div>
        )}
      </div>

      <div className={`options ${shows === 'emoji' ? 'pictures' : 'words'} ${long ? 'long' : ''}`}>
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
                if (shows === 'en' && ex.kind === 'he-to-en') speak(o.en);
                onSelect(id);
              }}
            >
              {shows === 'emoji' ? (
                <span className="emoji-option">{o.emoji}</span>
              ) : shows === 'en' ? (
                <bdi dir="ltr" lang="en" className="en">
                  {o.en}
                </bdi>
              ) : (
                <span className="he">{o.he}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
