import { useEffect, useMemo, useState } from 'react';
import { Home } from './components/Home';
import { Lesson } from './components/Lesson';
import { LessonComplete } from './components/LessonComplete';
import { UNITS, indexContent, unitsOf } from './engine/content';
import { JUMP_MAX_MISTAKES, buildJumpTest, buildLesson, itemsUpTo } from './engine/lessonBuilder';
import { currentStreak, finishLesson, lessonRewards, markKnown, recordAnswer, type LessonResult } from './engine/progress';
import type { Exercise, Track, Unit } from './engine/types';
import { loadProgress, saveProgress } from './lib/storage';

type Screen =
  | { name: 'home' }
  | { name: 'lesson'; exercises: Exercise[]; id: number; track: Track; jumpTo?: string }
  | { name: 'done'; result: LessonResult; variant: 'lesson' | 'jump-pass' | 'jump-fail' };

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const { items, sentences } = useMemo(() => indexContent(UNITS), []);
  const talkUnits = useMemo(() => unitsOf('talk'), []);
  const readUnits = useMemo(() => unitsOf('read'), []);
  const unitsFor = (t: Track) => (t === 'talk' ? talkUnits : readUnits);

  useEffect(() => saveProgress(progress), [progress]);

  const start = (track: Track) =>
    setScreen({ name: 'lesson', exercises: buildLesson(unitsFor(track), progress, Date.now()), id: Date.now(), track });
  const jump = (unit: Unit) =>
    setScreen({
      name: 'lesson',
      exercises: buildJumpTest(unitsFor(unit.track), unit.id),
      id: Date.now(),
      track: unit.track,
      jumpTo: unit.id,
    });

  if (screen.name === 'lesson') {
    return (
      <Lesson
        key={screen.id}
        exercises={screen.exercises}
        items={items}
        sentences={sentences}
        test={!!screen.jumpTo}
        onAnswer={(e) => setProgress((p) => recordAnswer(p, e))}
        onFinish={(r) => {
          const result = { ...r, track: screen.track };
          const now = Date.now();
          const jumpTo = screen.jumpTo;
          const passed = !!jumpTo && result.total - result.firstTryCorrect <= JUMP_MAX_MISTAKES;
          setProgress((p) => {
            const done = finishLesson(p, result, now, !!jumpTo);
            return passed ? markKnown(done, itemsUpTo(unitsFor(screen.track), jumpTo), now) : done;
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

  return <Home talkUnits={talkUnits} readUnits={readUnits} progress={progress} onStart={start} onJump={jump} />;
}
