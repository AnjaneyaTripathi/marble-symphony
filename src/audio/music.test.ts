import { describe, expect, it } from 'vitest';
import { divisionBeats, midiToFrequency, noteName, quantizeTime, scaleNoteOptions, secondsPerDivision } from './music';
import { Transport } from './Transport';
import type { EmitterObject, MusicSettings } from '../model/types';

const settings: MusicSettings = { bpm: 120, root: 0, scale: 'major', masterVolume: 0.5, muted: false, snapNotes: false, snapDivision: 'eighth' };
const emitter: EmitterObject = { id: 'test', type: 'emitter', x: 0, y: 0, rotation: 0, speed: 0, marbleSize: 8, division: 'eighth', beatOffset: 0, enabled: true, color: '#cc7777' };

describe('musical calculations', () => {
  it('maps divisions to quarter-note beats and seconds', () => {
    expect(divisionBeats('quarter')).toBe(1);
    expect(divisionBeats('eighth')).toBe(0.5);
    expect(divisionBeats('sixteenth')).toBe(0.25);
    expect(secondsPerDivision(120, 'eighth')).toBe(0.25);
    expect(secondsPerDivision(90, 'quarter')).toBeCloseTo(2 / 3);
  });
  it('names, tunes, and offers scale-constrained MIDI pitches', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(noteName(60)).toBe('C4');
    expect(noteName(61)).toBe('C♯4');
    expect(scaleNoteOptions(0, 'pentatonic', 4)).toEqual([60, 62, 64, 67, 69]);
    expect(scaleNoteOptions(9, 'minor', 4)).toEqual([60, 62, 64, 65, 67, 69, 71]);
    expect(scaleNoteOptions(0, 'chromatic', 4)).toHaveLength(12);
  });
  it('snaps to the next subdivision without adding a whole interval on an exact boundary', () => {
    expect(quantizeTime(2.13, 2, 120, 'eighth')).toBe(2.25);
    expect(quantizeTime(2.25, 2, 120, 'eighth')).toBe(2.25);
  });
});

describe('audio-clock transport', () => {
  it('schedules each future release once and honors musical beat offset', () => {
    const transport = new Transport(settings);
    transport.start(10);
    expect(transport.poll(10, [emitter])).toEqual([{ emitterId: 'test', time: 10.025 }]);
    expect(transport.poll(10.02, [emitter])).toEqual([]);
    expect(transport.poll(10.18, [emitter])[0].time).toBeCloseTo(10.275);
    const offset = { ...emitter, id: 'offset', beatOffset: 0.5 };
    expect(transport.poll(10.2, [offset])[0].time).toBeCloseTo(10.275);
  });
  it('pauses emissions and reanchors resume without flooding missed beats', () => {
    const transport = new Transport(settings);
    transport.start(0);
    transport.poll(0, [emitter]);
    transport.pause();
    expect(transport.poll(300, [emitter])).toEqual([]);
    transport.start(300);
    expect(transport.poll(300, [emitter])).toEqual([{ emitterId: 'test', time: 300.025 }]);
    expect(transport.poll(300, [emitter])).toEqual([]);
  });
  it('skips a stalled-frame backlog and ignores disabled emitters', () => {
    const transport = new Transport(settings);
    transport.start(0);
    transport.poll(0, [emitter]);
    expect(transport.poll(300, [emitter])).toHaveLength(1);
    expect(transport.poll(301, [{ ...emitter, enabled: false }])).toEqual([]);
  });
  it('resets transient timing, and keeps optional note snapping distinct from immediate impacts', () => {
    const transport = new Transport(settings);
    transport.start(0);
    expect(transport.noteTime(0.13)).toBe(0.13);
    transport.setSettings({ ...settings, snapNotes: true });
    expect(transport.noteTime(0.13)).toBeCloseTo(0.275);
    transport.reset();
    expect(transport.poll(10, [emitter])).toEqual([]);
  });
});
