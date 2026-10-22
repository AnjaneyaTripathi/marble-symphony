import type { Division, Scale } from '../model/types';

export const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const divisionBeats = (division: Division): number => ({ quarter: 1, eighth: 0.5, sixteenth: 0.25 })[division];
export const secondsPerDivision = (bpm: number, division: Division): number => 60 / bpm * divisionBeats(division);
export const midiToFrequency = (note: number): number => 440 * 2 ** ((note - 69) / 12);
export const noteName = (note: number): string => `${NOTE_NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;

const INTERVALS: Record<Scale, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

/** MIDI numbers remain the stored representation, including when the scale changes. */
export function scaleNoteOptions(root: number, scale: Scale, octave?: number): number[] {
  const min = octave === undefined ? 36 : (octave + 1) * 12;
  const max = octave === undefined ? 96 : min + 11;
  return Array.from({ length: max - min + 1 }, (_, i) => min + i)
    .filter(note => INTERVALS[scale].includes(((note - root) % 12 + 12) % 12));
}

export function quantizeTime(now: number, origin: number, bpm: number, division: Division): number {
  const interval = secondsPerDivision(bpm, division);
  return origin + Math.max(0, Math.ceil((now - origin) / interval - 1e-9)) * interval;
}
