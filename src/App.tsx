import { useEffect, useMemo, useState } from 'react';
import { Home } from './components/Home';
import { Lesson } from './components/Lesson';
import { LessonComplete } from './components/LessonComplete';
import { UNITS, indexContent } from './engine/content';
import { buildLesson } from './engine/lessonBuilder';
import { currentStreak, finishLesson, lessonRewards, recordAnswer, type LessonResult } from './engine/progress';
import type { Exercise } from './engine/types';
import { loadProgress, saveProgress } from './lib/storage';

type Screen =
  | { name: 'home' }
  | { name: 'lesson'; exercises: Exercise[]; id: number }
  | { name: 'done'; result: LessonResult };

export default function App() {
  const [progress, setProgress] = useState(loadProgress);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const { items, sentences } = useMemo(() => indexContent(UNITS), []);

  useEffect(() => saveProgress(progress), [progress]);

  const start = () => setScreen({ name: 'lesson', exercises: buildLesson(UNITS, progress, Date.now()), id: Date.now() });

  if (screen.name === 'lesson') {
    return (
      <Lesson
        key={screen.id}
        exercises={screen.exercises}
        items={items}
        sentences={sentences}
        onAnswer={(e) => setProgress((p) => recordAnswer(p, e))}
        onFinish={(result) => {
          setProgress((p) => finishLesson(p, result, Date.now()));
          setScreen({ name: 'done', result });
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
        onContinue={() => setScreen({ name: 'home' })}
      />
    );
  }

  return <Home units={UNITS} progress={progress} onStart={start} />;
}
