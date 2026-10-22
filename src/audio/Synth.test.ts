import { afterEach, describe, expect, it, vi } from 'vitest';
import { Synth } from './Synth';

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  cancelAndHoldAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
}
class FakeNode {
  connect = vi.fn();
  disconnect = vi.fn();
}
class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam();
  onended: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}
class FakeContext {
  static latest: FakeContext;
  state = 'suspended';
  currentTime = 1;
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  gains: (FakeNode & { gain: FakeParam })[] = [];
  constructor() { FakeContext.latest = this; }
  createGain() { const node = Object.assign(new FakeNode(), { gain: new FakeParam() }); this.gains.push(node); return node; }
  createDynamicsCompressor() { return Object.assign(new FakeNode(), { threshold: new FakeParam(), knee: new FakeParam(), ratio: new FakeParam(), attack: new FakeParam(), release: new FakeParam() }); }
  createOscillator() { const node = new FakeOscillator(); this.oscillators.push(node); return node; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}

afterEach(() => vi.unstubAllGlobals());

describe('synth lifecycle', () => {
  it('waits for explicit initialization, caps polyphony and disposes stolen/ended voices', async () => {
    vi.stubGlobal('window', { AudioContext: FakeContext });
    const synth = new Synth();
    expect(synth.ready).toBe(false);
    synth.play(60, 'bell', 0.5, 0.5);
    expect(synth.activeVoiceCount).toBe(0);
    await synth.initialize();
    expect(synth.ready).toBe(true);
    for (let i = 0; i < 40; i++) synth.play(60 + i % 12, 'bell', 0.5, 0.5, 1.25);
    expect(synth.activeVoiceCount).toBe(32);
    expect(FakeContext.latest.oscillators[0].disconnect).toHaveBeenCalled();
    FakeContext.latest.oscillators[24].onended?.();
    expect(synth.activeVoiceCount).toBe(31);
    synth.silence();
    expect(synth.activeVoiceCount).toBe(0);
    expect(FakeContext.latest.oscillators.every(node => node.disconnect.mock.calls.length > 0)).toBe(true);
    synth.dispose();
  });
  it('uses attack/decay envelopes and cancels future snapped notes on silence', async () => {
    vi.stubGlobal('window', { AudioContext: FakeContext });
    const synth = new Synth();
    await synth.initialize();
    synth.play(69, 'warm', 0.4, 0.8, 2);
    const gain = FakeContext.latest.gains[1].gain;
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(expect.any(Number), 2.008);
    expect(gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    synth.silence();
    expect(FakeContext.latest.oscillators[0].stop).toHaveBeenLastCalledWith();
    expect(synth.activeVoiceCount).toBe(0);
  });
  it('applies master mute independently and explains unavailable audio', async () => {
    vi.stubGlobal('window', { AudioContext: FakeContext });
    const synth = new Synth();
    await synth.initialize();
    synth.setSettings({ masterVolume: 0.8, muted: true });
    expect(FakeContext.latest.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, 0.015);
    synth.dispose();
    vi.stubGlobal('window', {});
    await expect(new Synth().initialize()).rejects.toThrow('visual machine');
  });
  it('keeps a progressing visual clock when a browser rejects audio resume', async () => {
    class BlockedContext extends FakeContext {
      override async resume() { throw new Error('Playback blocked'); }
    }
    vi.stubGlobal('window', { AudioContext: BlockedContext });
    const synth = new Synth();
    await expect(synth.initialize()).rejects.toThrow('visual machine');
    expect(synth.ready).toBe(false);
    const clock = vi.spyOn(performance, 'now').mockReturnValue(12345);
    expect(synth.currentTime).toBe(12.345);
    clock.mockReturnValue(12400);
    expect(synth.currentTime).toBe(12.4);
    clock.mockRestore();
    synth.dispose();
  });
  it('fades a sounding note for eight milliseconds on pause and releases its nodes', async () => {
    vi.stubGlobal('window', { AudioContext: FakeContext });
    const synth = new Synth();
    await synth.initialize();
    synth.play(60, 'marimba', 0.5, 0.6);
    FakeContext.latest.currentTime = 1.1;
    synth.silence();
    expect(synth.activeVoiceCount).toBe(0);
    expect(FakeContext.latest.gains[1].gain.cancelAndHoldAtTime).toHaveBeenCalledWith(1.1);
    expect(FakeContext.latest.oscillators[0].stop).toHaveBeenLastCalledWith(1.108);
    FakeContext.latest.oscillators[0].onended?.();
    expect(FakeContext.latest.oscillators[0].disconnect).toHaveBeenCalled();
    synth.dispose();
  });
});
