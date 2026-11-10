export interface Item {
  id: string;
  en: string;
  he: string;
  emoji: string;
  audio?: string;
  unitId: string;
}

export interface Sentence {
  id: string;
  en: string;
  he: string;
  emoji: string;
  distractors: string[];
  unitId: string;
}

export interface Unit {
  id: string;
  title: string;
  emoji: string;
  items: Item[];
  sentences: Sentence[];
}

export type Skill = 'recognition' | 'listening' | 'recall' | 'production';

export type ExerciseKind =
  | 'pick-picture' // see + hear English word -> pick the picture
  | 'listen-picture' // hear only -> pick the picture
  | 'listen-word' // hear only -> pick the written English word
  | 'he-to-en' // see Hebrew + picture -> pick the English word
  | 'match-pairs' // match English words to pictures
  | 'word-bank'; // build the English sentence from tiles

export type ChoiceKind = Exclude<ExerciseKind, 'match-pairs' | 'word-bank'>;

interface Base {
  key: string; // unique per queued instance
  origin: string; // key of the original exercise (same for re-queued retries)
}

export interface ChoiceExercise extends Base {
  kind: ChoiceKind;
  itemId: string;
  options: string[]; // item ids, includes itemId
  isNew?: boolean;
}

export interface MatchExercise extends Base {
  kind: 'match-pairs';
  itemIds: string[];
}

export interface WordBankExercise extends Base {
  kind: 'word-bank';
  sentenceId: string;
  tiles: string[];
}

export type Exercise = ChoiceExercise | MatchExercise | WordBankExercise;

export const SKILL_OF: Record<ExerciseKind, Skill> = {
  'pick-picture': 'recognition',
  'match-pairs': 'recognition',
  'listen-picture': 'listening',
  'listen-word': 'listening',
  'he-to-en': 'recall',
  'word-bank': 'production',
};
