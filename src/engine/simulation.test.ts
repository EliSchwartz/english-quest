import { describe, expect, it } from 'vitest';
import { UNITS, unitsOf } from './content';
import { buildLesson, unitStatuses } from './lessonBuilder';
import { emptyProgress, finishLesson, recordAnswer } from './progress';
import { SKILL_OF } from './types';

const DAY = 86400000;

describe.each(['talk', 'read'] as const)('simulated learner on %s track (2 lessons/day, 90% correct)', (track) => {
  const UNITS_T = unitsOf(track, UNITS);
  it('progresses through units at a sensible pace', () => {
    let p = emptyProgress();
    let rng = 42;
    const rand = () => ((rng = (rng * 16807) % 2147483647) - 1) / 2147483646;
    const report: string[] = [];
    const start = new Date(2026, 10, 1, 16).getTime();
    for (let day = 0; day < 10; day++) {
      for (let l = 0; l < 2; l++) {
        const now = start + day * DAY + l * 3600000;
        const lesson = buildLesson(UNITS_T, p, now, rand);
        if (lesson.length < 8) report.push(`  short lesson (${lesson.length}): ${lesson.map((e) => e.kind).join(',')}`);
        let ok = 0;
        for (const e of lesson) {
          const correct = rand() < 0.9;
          ok += correct ? 1 : 0;
          const ids = e.kind === 'match-pairs' ? e.itemIds : [e.kind === 'word-bank' ? e.targetId : e.itemId];
          for (const id of ids) p = recordAnswer(p, { itemId: id, kind: e.kind, skill: SKILL_OF[e.kind], correct, retry: false, ms: 1, ts: now });
        }
        p = finishLesson(p, { startedAt: now, firstTryCorrect: ok, total: lesson.length }, now);
      }
      report.push(
        `day ${day + 1}: ` + unitStatuses(UNITS_T, p).map((s) => `${s.unit.id} ${Math.round(s.mastered * 100)}%${s.unlocked ? '' : '🔒'}`).join(', '),
      );
    }
    console.log(report.join('\n'));
    const st = unitStatuses(UNITS_T, p);
    expect(st[0].complete).toBe(true);
    expect(st[1].unlocked).toBe(true);
    expect(p.streak).toBe(10);
    expect(report.filter((r) => r.includes('short lesson'))).toEqual([]);
  });
});
