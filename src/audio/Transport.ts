import type { EmitterObject, MusicSettings } from '../model/types';
import { divisionBeats, quantizeTime } from './music';

export interface EmissionEvent { emitterId: string; time: number }
const DEFAULT_SETTINGS: MusicSettings = {
  bpm: 100, root: 0, scale: 'pentatonic', masterVolume: 0.55, muted: false,
  snapNotes: false, snapDivision: 'eighth',
};

/** Schedules releases against the audio clock. The physics runtime consumes the timestamps. */
export class Transport {
  private settings: MusicSettings;
  private origin = 0;
  private running = false;
  private lastTime = 0;
  private next = new Map<string, { signature: string; index: number }>();
  readonly lookAhead = 0.1;

  constructor(settings: MusicSettings = DEFAULT_SETTINGS) { this.settings = { ...settings }; }

  start(now: number): void {
    if (this.running) return;
    this.running = true;
    this.origin = now + 0.025;
    this.lastTime = now;
    this.next.clear();
  }

  pause(): void { this.running = false; this.next.clear(); }
  reset(): void { this.pause(); this.origin = 0; this.lastTime = 0; }

  setSettings(settings: MusicSettings): void {
    if (settings.bpm !== this.settings.bpm) {
      const beat = (this.lastTime - this.origin) * this.settings.bpm / 60;
      this.origin = this.lastTime - beat * 60 / settings.bpm;
      this.next.clear();
    }
    this.settings = { ...settings };
  }

  getBeat(now: number): number {
    return Math.max(0, ((this.running ? now : this.lastTime) - this.origin) * this.settings.bpm / 60);
  }

  noteTime(now: number, settings: MusicSettings = this.settings): number {
    return settings.snapNotes ? quantizeTime(now, this.origin, settings.bpm, settings.snapDivision) : now;
  }

  poll(now: number, emitters: readonly EmitterObject[]): EmissionEvent[] {
    if (!this.running) return [];
    this.lastTime = now;
    const secondsPerBeat = 60 / this.settings.bpm;
    const horizon = now + this.lookAhead;
    const events: EmissionEvent[] = [];
    const enabledIds = new Set<string>();
    for (const emitter of emitters) {
      if (!emitter.enabled) continue;
      enabledIds.add(emitter.id);
      const step = divisionBeats(emitter.division);
      const offset = emitter.beatOffset;
      const interval = secondsPerBeat * step;
      const firstTime = this.origin + offset * secondsPerBeat;
      const signature = `${emitter.division}:${offset}`;
      let state = this.next.get(emitter.id);
      if (!state || state.signature !== signature) {
        state = { signature, index: Math.max(0, Math.ceil((now - firstTime) / interval - 1e-7)) };
        this.next.set(emitter.id, state);
      }
      // A stalled frame never attempts to replay an accumulated backlog.
      if (firstTime + state.index * interval < now - 0.06) {
        state.index = Math.max(state.index, Math.ceil((now - firstTime) / interval));
      }
      for (let count = 0; count < 8; count++) {
        const time = firstTime + state.index * interval;
        if (time > horizon + 1e-8) break;
        events.push({ emitterId: emitter.id, time });
        state.index++;
      }
    }
    for (const id of this.next.keys()) if (!enabledIds.has(id)) this.next.delete(id);
    return events.sort((a, b) => a.time - b.time);
  }
}
