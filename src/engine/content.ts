import type { Item, Sentence, Unit } from './types';

interface RawUnit {
  id: string;
  kind?: 'words' | 'phrases';
  title: string;
  emoji: string;
  items: Omit<Item, 'unitId' | 'type'>[];
  sentences?: Omit<Sentence, 'unitId'>[];
}

const modules = import.meta.glob<RawUnit>('../../content/units/*.json', { eager: true, import: 'default' });

export function buildUnits(raw: RawUnit[]): Unit[] {
  return raw.map((u) => ({
    id: u.id,
    kind: u.kind ?? 'words',
    title: u.title,
    emoji: u.emoji,
    items: u.items.map((i) => ({ ...i, unitId: u.id, type: u.kind === 'phrases' ? ('phrase' as const) : ('word' as const) })),
    sentences: (u.sentences ?? []).map((s) => ({ ...s, unitId: u.id })),
  }));
}

export const UNITS: Unit[] = buildUnits(
  Object.keys(modules)
    .sort()
    .map((k) => modules[k]),
);

export function indexContent(units: Unit[]) {
  const items = new Map<string, Item>();
  const sentences = new Map<string, Sentence>();
  for (const u of units) {
    for (const i of u.items) {
      if (items.has(i.id)) throw new Error(`Duplicate item id: ${i.id}`);
      items.set(i.id, i);
    }
    for (const s of u.sentences) sentences.set(s.id, s);
  }
  return { items, sentences };
}
