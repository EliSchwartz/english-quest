import { useEffect, useMemo, useState } from 'react';
import { Home } from './components/Home';
import { Lesson } from './components/Lesson';
import { LessonComplete } from './components/LessonComplete';
import { UNITS, indexContent } from './engine/content';
import { JUMP_MAX_MISTAKES, buildJumpTest, buildLesson, itemsUpTo } from './engine/lessonBuilder';
import { currentStreak, finishLesson, lessonRewards, markKnown, recordAnswer, type LessonResult } from './engine/progress';
import type { Exercise } from './engine/types';
import { loadProgress, saveProgress } from './lib/storage';

type Screen =
  | { name: 'home' }
  | { name: 'lesson'; exercises: Exercise[]; id: number; jumpTo?: string }
  | { name: 'done'; result: LessonResult; variant: 'lesson' | 'jump-pass' | 'jump-fail' };

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const { items, sentences } = useMemo(() => indexContent(UNITS), []);

  useEffect(() => saveProgress(progress), [progress]);

  const start = () => setScreen({ name: 'lesson', exercises: buildLesson(UNITS, progress, Date.now()), id: Date.now() });
  const jump = (unitId: string) =>
    setScreen({ name: 'lesson', exercises: buildJumpTest(UNITS, unitId), id: Date.now(), jumpTo: unitId });

  if (screen.name === 'lesson') {
    return (
      <Lesson
        key={screen.id}
        exercises={screen.exercises}
        items={items}
        sentences={sentences}
        test={!!screen.jumpTo}
        onAnswer={(e) => setProgress((p) => recordAnswer(p, e))}
        onFinish={(result) => {
          const now = Date.now();
          const jumpTo = screen.jumpTo;
          const passed = !!jumpTo && result.total - result.firstTryCorrect <= JUMP_MAX_MISTAKES;
          setProgress((p) => {
            const done = finishLesson(p, result, now, !!jumpTo);
            return passed ? markKnown(done, itemsUpTo(UNITS, jumpTo), now) : done;
          });
          setScreen({ name: 'done', result, variant: !jumpTo ? 'lesson' : passed ? 'jump-pass' : 'jump-fail' });
        }}
        onQuit={() => setScreen({ name: 'home' })}
      />
    );
  }

  if (screen.name === 'done') {
    const r = lessonRewards(screen.result);
    return (
      <LessonComplete
        xp={r.xp}
        gems={r.gems}
        accuracy={r.accuracy}
        perfect={r.perfect}
        streak={currentStreak(progress, Date.now())}
        variant={screen.variant}
        onContinue={() => setScreen({ name: 'home' })}
      />
    );
  }

  return <Home units={UNITS} progress={progress} onStart={start} onJump={jump} />;
}
