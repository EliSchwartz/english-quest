import type { Item, ItemType, Sentence, Track, Unit, UnitKind } from './types';

interface RawUnit {
  id: string;
  kind?: UnitKind;
  track?: Track;
  title: string;
  emoji: string;
  items: Omit<Item, 'unitId' | 'type'>[];
  sentences?: Omit<Sentence, 'unitId'>[];
}

const modules = import.meta.glob<RawUnit>('../../content/**/*.json', { eager: true, import: 'default' });

const ITEM_TYPE: Record<UnitKind, ItemType> = { words: 'word', phrases: 'phrase', letters: 'letter', decodable: 'decodable' };

export function buildUnits(raw: RawUnit[]): Unit[] {
  return raw.map((u) => ({
    id: u.id,
    kind: u.kind ?? 'words',
    track: u.track ?? 'talk',
    title: u.title,
    emoji: u.emoji,
    items: u.items.map((i) => ({ ...i, unitId: u.id, type: ITEM_TYPE[u.kind ?? 'words'] })),
    sentences: (u.sentences ?? []).map((s) => ({ ...s, unitId: u.id })),
  }));
}

export const UNITS: Unit[] = buildUnits(
  Object.keys(modules)
    .sort()
    .map((k) => modules[k]),
);

export const unitsOf = (track: Track, units: Unit[] = UNITS) => units.filter((u) => u.track === track);

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
