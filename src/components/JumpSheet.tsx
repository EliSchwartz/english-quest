import { JUMP_MAX_MISTAKES, JUMP_TEST_SIZE } from '../engine/lessonBuilder';
import type { Unit } from '../engine/types';

interface Props {
  unit: Unit;
  onStart: () => void;
  onClose: () => void;
}

export function JumpSheet({ unit, onStart, onClose }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-emoji">🚀</div>
        <h2>
          לקפוץ ליחידה "<bdi>{unit.title}</bdi>"?
        </h2>
        <p>
          {JUMP_TEST_SIZE} שאלות על היחידה. עד {JUMP_MAX_MISTAKES} טעויות – והיחידה נפתחת, יחד עם כל מה שלפניה!
        </p>
        <button className="btn btn-blue wide" onClick={onStart}>
          ⚡ יאללה, לקפוץ!
        </button>
        <button className="btn-text" onClick={onClose}>
          לא עכשיו
        </button>
      </div>
    </div>
  );
}
