import { emptyProgress, type Progress } from '../engine/progress';
import type { Track } from '../engine/types';

const KEY = 'english-quest:v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Progress;
      if (p.version === 1) return { ...emptyProgress(), ...p };
    }
  } catch {
    /* storage unavailable: start fresh */
  }
  return emptyProgress();
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const TRACK_KEY = 'english-quest:track';

export function loadTrack(): Track {
  try {
    return localStorage.getItem(TRACK_KEY) === 'read' ? 'read' : 'talk';
  } catch {
    return 'talk';
  }
}

export function saveTrack(t: Track) {
  try {
    localStorage.setItem(TRACK_KEY, t);
  } catch {
    /* ignore */
  }
}
