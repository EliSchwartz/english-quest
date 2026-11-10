export interface Item {
  id: string;
  en: string;
  he: string;
  emoji: string;
  audio?: string;
  unitId: string;
  /**
   * 'word': vocabulary practised with pictures; 'phrase': meanings and sentence building;
   * 'letter': a letter and its sound; 'decodable': a word to practise reading and spelling.
   */
  type: ItemType;
  /** Letters: a word she knows that starts with this sound (e.g. "ball" for b). */
  keyword?: string;
  /** Letters: more pictures of words starting with this sound. */
  examples?: Picture[];
  /** Letters: letters never used as distractors for this one (c/k sound the same, פּ/פ look alike). */
  confusable?: string[];
  /** Letters: vowels have no clean Hebrew equivalent, so they're taught only through keywords. */
  vowel?: boolean;
}

export type ItemType = 'word' | 'phrase' | 'letter' | 'decodable';

export interface Picture {
  en: string;
  emoji: string;
}

export interface Sentence {
  id: string;
  en: string;
  he: string;
  emoji: string;
  distractors: string[];
  unitId: string;
}

export type UnitKind = 'words' | 'phrases' | 'letters' | 'decodable';
export type Track = 'talk' | 'read';

export interface Unit {
  id: string;
  kind: UnitKind;
  track: Track;
  title: string;
  emoji: string;
  items: Item[];
  sentences: Sentence[];
}

export type Skill = 'recognition' | 'listening' | 'recall' | 'production' | 'reading' | 'phonics';

export type ExerciseKind =
  | 'pick-picture' // see + hear English word -> pick the picture
  | 'listen-picture' // hear only -> pick the picture
  | 'listen-word' // hear only -> pick the written English word
  | 'he-to-en' // see Hebrew + picture -> pick the English word/phrase
  | 'en-to-he' // see + hear English phrase -> pick the Hebrew meaning
  | 'listen-meaning' // hear English only -> pick the Hebrew meaning
  | 'letter-sound' // see a letter -> pick its Hebrew sound (b -> ב)
  | 'hear-letter' // hear a word (+ picture) -> pick the letter it starts with
  | 'read-pick' // read a word (no audio) -> pick the picture
  | 'sound-start' // see a letter -> pick the picture that starts with its sound
  | 'match-pairs' // match English words to pictures
  | 'word-bank'; // build the English sentence/phrase (or a word, from letters) from tiles

export type ChoiceKind = Exclude<ExerciseKind, 'match-pairs' | 'word-bank' | 'sound-start'>;

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

export interface SoundStartExercise extends Base {
  kind: 'sound-start';
  itemId: string; // the letter
  pictures: Picture[];
  answer: number; // index into pictures
}

export interface MatchExercise extends Base {
  kind: 'match-pairs';
  itemIds: string[];
}

export interface WordBankExercise extends Base {
  kind: 'word-bank';
  targetId: string; // a sentence id, a phrase item id, or a decodable word id
  tiles: string[];
  /** Spelling: tiles are letters and join without spaces. */
  letters?: boolean;
}

export type Exercise = ChoiceExercise | SoundStartExercise | MatchExercise | WordBankExercise;

export const SKILL_OF: Record<ExerciseKind, Skill> = {
  'pick-picture': 'recognition',
  'match-pairs': 'recognition',
  'listen-picture': 'listening',
  'listen-word': 'listening',
  'listen-meaning': 'listening',
  'en-to-he': 'recognition',
  'he-to-en': 'recall',
  'word-bank': 'production',
  'letter-sound': 'phonics',
  'hear-letter': 'phonics',
  'sound-start': 'phonics',
  'read-pick': 'reading',
};
