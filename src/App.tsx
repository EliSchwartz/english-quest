import { useEffect, useMemo, useState } from 'react';
import { Home } from './components/Home';
import { Lesson } from './components/Lesson';
import { LessonComplete } from './components/LessonComplete';
import { UNITS, indexContent, unitsOf } from './engine/content';
import { JUMP_MAX_MISTAKES, buildJumpTest, buildLesson, itemsUpTo } from './engine/lessonBuilder';
import { currentStreak, finishLesson, lessonRewards, markKnown, recordAnswer, type LessonResult } from './engine/progress';
import type { Exercise, Track } from './engine/types';
import { loadProgress, loadTrack, saveProgress, saveTrack } from './lib/storage';

type Screen =
  | { name: 'home' }
  | { name: 'lesson'; exercises: Exercise[]; id: number; jumpTo?: string }
  | { name: 'done'; result: LessonResult; variant: 'lesson' | 'jump-pass' | 'jump-fail' };

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [track, setTrack] = useState<Track>(loadTrack);
  const { items, sentences } = useMemo(() => indexContent(UNITS), []);
  const units = useMemo(() => unitsOf(track), [track]);

  useEffect(() => saveProgress(progress), [progress]);
  useEffect(() => saveTrack(track), [track]);

  const start = () => setScreen({ name: 'lesson', exercises: buildLesson(units, progress, Date.now()), id: Date.now() });
  const jump = (unitId: string) =>
    setScreen({ name: 'lesson', exercises: buildJumpTest(units, unitId), id: Date.now(), jumpTo: unitId });

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
            return passed ? markKnown(done, itemsUpTo(units, jumpTo), now) : done;
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

  return <Home units={units} track={track} onTrack={setTrack} progress={progress} onStart={start} onJump={jump} />;
}
