import { speak } from '../lib/speech';

export function SpeakerButton({ text, slow = false, small = false }: { text: string; slow?: boolean; small?: boolean }) {
  return (
    <button
      className={`speaker ${small ? 'small' : ''} ${slow ? 'slow' : ''}`}
      aria-label={slow ? 'השמעה איטית' : 'השמעה'}
      onClick={() => speak(text, slow)}
    >
      {slow ? '🐢' : '🔊'}
    </button>
  );
}
