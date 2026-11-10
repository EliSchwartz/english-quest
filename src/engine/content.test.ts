import { describe, expect, it } from 'vitest';
import { UNITS, indexContent } from './content';

describe('content', () => {
  it('has unique ids across all units', () => {
    expect(() => indexContent(UNITS)).not.toThrow();
  });

  it.each(UNITS.map((u) => [u.id, u] as const))('%s: items look different and have enough options', (_, u) => {
    const faces = u.items.map((i) => (i.type === 'phrase' ? i.he : i.emoji));
    expect(new Set(faces).size).toBe(faces.length);
    expect(new Set(u.items.map((i) => i.en)).size).toBe(u.items.length);
    expect(u.items.length).toBeGreaterThanOrEqual(5);
  });

  it('letter keywords and examples start with their letter', () => {
    for (const i of UNITS.flatMap((u) => u.items).filter((i) => i.type === 'letter')) {
      for (const w of [i.keyword!, ...(i.examples ?? []).map((e) => e.en)]) expect(w[0]).toBe(i.en);
    }
  });
});
