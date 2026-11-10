import { useEffect } from 'react';
import type { ChoiceExercise, Item } from '../../engine/types';
import { speak } from '../../lib/speech';
import { sounds } from '../../lib/sounds';
import { SpeakerButton } from '../SpeakerButton';

type Kind = ChoiceExercise['kind'];
type OptionShows = 'emoji' | 'en' | 'he' | 'letter' | 'sound';
type Stimulus = 'en-card' | 'listen' | 'he-card' | 'letter-card' | 'keyword' | 'read';

interface KindConfig {
  prompt: string;
  options: OptionShows;
  stimulus: Stimulus;
  /** What to say when the exercise appears (null = stay quiet, e.g. reading practice). */
  say: (item: Item, isNew: boolean) => string | null;
}

/** For letters, speak the keyword ("ball"): TTS can't reliably say an isolated sound. */
export const spoken = (item: Item) => (item.type === 'letter' ? item.keyword ?? item.en : item.en);

const CONFIG: Record<Kind, KindConfig> = {
  'pick-picture': { prompt: 'בחרי את התמונה הנכונה', options: 'emoji', stimulus: 'en-card', say: (i) => i.en },
  'listen-picture': { prompt: 'הקשיבי ובחרי תמונה', options: 'emoji', stimulus: 'listen', say: (i) => i.en },
  'listen-word': { prompt: 'הקשיבי ובחרי את המילה', options: 'en', stimulus: 'listen', say: (i) => i.en },
  'he-to-en': { prompt: 'איך אומרים באנגלית?', options: 'en', stimulus: 'he-card', say: () => null },
  'en-to-he': { prompt: 'מה זה אומר?', options: 'he', stimulus: 'en-card', say: (i) => i.en },
  'listen-meaning': { prompt: 'הקשיבי – מה אמרו?', options: 'he', stimulus: 'listen', say: (i) => i.en },
  'letter-sound': {
    prompt: 'איזה צליל עושה האות?',
    options: 'sound',
    stimulus: 'letter-card',
    say: (i, isNew) => (isNew ? spoken(i) : null),
  },
  'hear-letter': { prompt: 'באיזו אות מתחילה המילה?', options: 'letter', stimulus: 'keyword', say: (i) => spoken(i) },
  'read-pick': { prompt: 'קראי ובחרי תמונה', options: 'emoji', stimulus: 'read', say: (i, isNew) => (isNew ? i.en : null) },
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
  const cfg = CONFIG[ex.kind];
  const isNew = !!ex.isNew;
  const label = (o: Item) => (cfg.options === 'he' || cfg.options === 'sound' ? o.he : o.en);
  const long = cfg.options !== 'emoji' && ex.options.some((id) => label(items.get(id)!).length > 12);

  useEffect(() => {
    const text = cfg.say(item, isNew);
    if (text) speak(text);
  }, [ex.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const newBadge =
    item.type === 'phrase' ? 'משפט חדש!' : item.type === 'letter' ? 'אות חדשה!' : 'מילה חדשה!';

  return (
    <div className="exercise">
      {isNew && <div className="badge-new">✨ {newBadge}</div>}
      <h2 className="prompt">{cfg.prompt}</h2>

      <div className="stimulus">
        {cfg.stimulus === 'en-card' && (
          <div className="word-card">
            <SpeakerButton text={item.en} small />
            <bdi className={`en ${item.type === 'phrase' ? 'mid' : 'big'}`} dir="ltr" lang="en">
              {item.en}
            </bdi>
            {isNew && ex.kind === 'pick-picture' && <span className="he-hint">{item.he}</span>}
            {isNew && ex.kind === 'en-to-he' && <span className="emoji-hint">{item.emoji}</span>}
          </div>
        )}
        {cfg.stimulus === 'listen' && (
          <div className="listen-row">
            <SpeakerButton text={item.en} />
            <SpeakerButton text={item.en} slow />
          </div>
        )}
        {cfg.stimulus === 'he-card' && (
          <div className="word-card">
            <span className="emoji-big">{item.emoji}</span>
            <span className="he big-he">{item.he}</span>
          </div>
        )}
        {cfg.stimulus === 'letter-card' && (
          <div className="word-card letter-card">
            <bdi className="en letter-big" dir="ltr" lang="en">
              {item.en}
            </bdi>
            {isNew && (
              <span className="keyword-hint">
                <SpeakerButton text={spoken(item)} small />
                <span className="emoji-big">{item.emoji}</span>
                <bdi dir="ltr" lang="en" className="en">
                  <b>{item.en}</b>
                  {spoken(item).slice(1)}
                </bdi>
              </span>
            )}
          </div>
        )}
        {cfg.stimulus === 'keyword' && (
          <div className="word-card">
            <span className="emoji-big">{item.emoji}</span>
            <SpeakerButton text={spoken(item)} />
            {isNew && (
              <span className="he-hint">
                <bdi dir="ltr" lang="en" className="en">
                  <b>{item.en}</b>
                  {spoken(item).slice(1)}
                </bdi>{' '}
                · {item.he}
              </span>
            )}
          </div>
        )}
        {cfg.stimulus === 'read' && (
          <div className="word-card">
            {isNew && <SpeakerButton text={item.en} small />}
            <bdi className="en read-big" dir="ltr" lang="en">
              {item.en}
            </bdi>
            {isNew && <span className="he-hint">{item.he}</span>}
          </div>
        )}
      </div>

      <div className={`options ${cfg.options === 'emoji' ? 'pictures' : 'words'} ${long ? 'long' : ''}`}>
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
              {cfg.options === 'emoji' ? (
                <span className="emoji-option">{o.emoji}</span>
              ) : cfg.options === 'en' ? (
                <bdi dir="ltr" lang="en" className="en">
                  {o.en}
                </bdi>
              ) : cfg.options === 'letter' ? (
                <bdi dir="ltr" lang="en" className="en letter-option">
                  {o.en}
                </bdi>
              ) : (
                <span className={`he ${cfg.options === 'sound' ? 'sound-option' : ''}`}>{o.he}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
