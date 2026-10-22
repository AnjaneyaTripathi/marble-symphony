import type { MusicSettings, Voice } from '../model/types';
import { midiToFrequency } from './music';

interface ActiveVoice {
  gain: GainNode;
  oscillators: OscillatorNode[];
  nodes: AudioNode[];
  start: number;
  end: number;
  disposed: boolean;
  silenced: boolean;
}
const MAX_VOICES = 32;

/** Small, self-contained instrument rack; no samples, network requests, or audio worklets. */
export class Synth {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private voices = new Set<ActiveVoice>();
  private volume = 0.55;
  private muted = false;

  get ready(): boolean { return this.context?.state === 'running'; }
  get currentTime(): number { return this.ready ? this.context!.currentTime : performance.now() / 1000; }
  get activeVoiceCount(): number { return [...this.voices].filter(voice => !voice.silenced).length; }

  /** Call only from a user gesture. Errors are surfaced so visual playback can continue. */
  async initialize(): Promise<void> {
    try {
      if (!this.context || this.context.state === 'closed') {
        const AudioConstructor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioConstructor) throw new Error('This browser does not provide Web Audio.');
        this.context = new AudioConstructor({ latencyHint: 'interactive' });
        this.master = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -15;
        this.compressor.knee.value = 18;
        this.compressor.ratio.value = 5;
        this.compressor.attack.value = 0.004;
        this.compressor.release.value = 0.2;
        this.master.gain.value = this.muted ? 0 : this.volume * 0.62;
        this.master.connect(this.compressor);
        this.compressor.connect(this.context.destination);
      }
      await this.context.resume();
      if (this.context.state !== 'running') throw new Error('The browser kept audio suspended.');
    } catch (error) {
      throw new Error(`Sound could not start. You can still use the visual machine. Try Start music again or check your browser sound settings. ${error instanceof Error ? error.message : ''}`);
    }
  }

  setSettings(settings: Pick<MusicSettings, 'masterVolume' | 'muted'>): void {
    this.volume = Math.max(0, Math.min(1, settings.masterVolume));
    this.muted = settings.muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.62, this.context.currentTime, 0.015);
    }
  }

  play(note: number, voice: Voice, volume: number, velocity: number, when?: number): void {
    const context = this.context;
    if (!context || !this.master || !this.ready) return;
    // Steal the oldest voice before creating nodes, so scheduled notes count toward the cap.
    while (this.voices.size >= MAX_VOICES) this.release(this.voices.values().next().value!);
    const time = Math.max(context.currentTime, when ?? context.currentTime);
    const duration = voice === 'bell' ? 1.55 : voice === 'warm' ? 0.85 : 0.72;
    const level = Math.max(0, Math.min(1, volume)) * Math.max(0.08, Math.min(1, velocity)) * 0.3;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(level, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    gain.gain.linearRampToValueAtTime(0, time + duration + 0.025);
    gain.connect(this.master);
    const active: ActiveVoice = { gain, oscillators: [], nodes: [gain], start: time, end: time + duration + 0.04, disposed: false, silenced: false };
    const frequency = midiToFrequency(Math.max(24, Math.min(108, note)));
    // Inharmonic upper partials make the bell; octave harmonics give the other voices body.
    const partials: [number, number, OscillatorType][] = voice === 'bell'
      ? [[1, 0.7, 'sine'], [2.76, 0.18, 'sine'], [4.08, 0.07, 'sine']]
      : voice === 'warm' ? [[1, 0.75, 'sine'], [2, 0.16, 'triangle']]
      : [[1, 0.85, 'sine'], [4, 0.12, 'sine']];
    for (const [ratio, weight, type] of partials) {
      const oscillator = context.createOscillator();
      const partialGain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency * ratio, time);
      partialGain.gain.setValueAtTime(weight, time);
      if (ratio > 1) partialGain.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.6);
      oscillator.connect(partialGain);
      partialGain.connect(gain);
      active.oscillators.push(oscillator);
      active.nodes.push(oscillator, partialGain);
      oscillator.start(time);
      oscillator.stop(active.end);
    }
    this.voices.add(active);
    active.oscillators[0].onended = () => this.release(active);
  }

  private release(voice: ActiveVoice): void {
    if (voice.disposed) return;
    voice.disposed = true;
    for (const oscillator of voice.oscillators) {
      oscillator.onended = null;
      try { oscillator.stop(); } catch { /* Already stopped. */ }
    }
    for (const node of voice.nodes) node.disconnect();
    this.voices.delete(voice);
  }

  silence(): void {
    const now = this.context?.currentTime ?? 0;
    for (const voice of [...this.voices]) {
      // Future snapped notes must never begin. Sounding notes get a tiny click-free release.
      if (voice.start > now || voice.silenced) { this.release(voice); continue; }
      voice.silenced = true;
      if (typeof voice.gain.gain.cancelAndHoldAtTime === 'function') voice.gain.gain.cancelAndHoldAtTime(now);
      else voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0, now, 0.0015);
      for (const oscillator of voice.oscillators) oscillator.stop(now + 0.008);
      // onended disposes the nodes. Fading voices still count toward the hard node cap.
    }
  }

  dispose(): void {
    for (const voice of [...this.voices]) this.release(voice);
    this.master?.disconnect();
    this.compressor?.disconnect();
    if (this.context?.state !== 'closed') void this.context?.close().catch(() => { /* Browser already disposed the context. */ });
    this.context = null;
    this.master = null;
    this.compressor = null;
  }
}
