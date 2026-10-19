/**
 * Original sound effects, synthesised with Web Audio (SPEC section 3.1: no
 * clips from the show or games). Nothing is loaded from disk or network.
 *
 * Every effect takes a start time so the same code can render into an
 * OfflineAudioContext (used to preview/verify the sounds without speakers).
 */

const MASTER_GAIN = 0.55;
const MIN_STRIKE_GAP_MS = 45; // fast typing: don't stack dozens of hits

export class SoundFx {
  private ctx: BaseAudioContext | null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastStrike = 0;
  /** Buses of the long Kamehameha sounds, so a drag can cut them off. */
  private long = new Set<GainNode>();
  enabled: boolean;

  /** Pass a context to render offline; omit to create a live one lazily. */
  constructor(enabled: boolean, ctx?: BaseAudioContext) {
    this.enabled = enabled;
    this.ctx = ctx ?? null;
  }

  private context(): BaseAudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext({ latencyHint: "interactive" });
      } catch {
        return null; // no audio device: stay silent
      }
    }
    if (this.ctx instanceof AudioContext && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.value = MASTER_GAIN;
      // Gentle limiter so overlapping effects never clip.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 12;
      this.master.connect(limiter).connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    if (!this.noise) {
      // Deterministic white noise (seeded LCG) so renders are repeatable.
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      let seed = 0x2545f491;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        data[i] = (seed / 0xffffffff) * 2 - 1;
      }
    }
    return this.noise;
  }

  private ready(at?: number): { ctx: BaseAudioContext; t: number; out: GainNode } | null {
    if (!this.enabled) return null;
    const ctx = this.context();
    if (!ctx || !this.master) return null;
    return { ctx, t: at ?? ctx.currentTime, out: this.master };
  }

  /** Short attack/decay envelope on a fresh gain node. */
  private env(ctx: BaseAudioContext, t: number, peak: number, attack: number, decay: number, out: AudioNode): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  }

  private thump(ctx: BaseAudioContext, t: number, from: number, to: number, peak: number, len: number, out: AudioNode): void {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + len);
    osc.connect(this.env(ctx, t, peak, 0.004, len, out));
    osc.start(t);
    osc.stop(t + len + 0.05);
  }

  private noiseBurst(
    ctx: BaseAudioContext,
    t: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    peak: number,
    attack: number,
    len: number,
    out: AudioNode
  ): void {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = filter;
    bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + attack + len);
    src.connect(bp).connect(this.env(ctx, t, peak, attack, len, out));
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + len + 0.05);
  }

  /** A bus for one long effect; cancelLong() fades it out. */
  private longBus(ctx: BaseAudioContext, out: AudioNode, lengthSec: number): GainNode {
    const bus = ctx.createGain();
    bus.connect(out);
    this.long.add(bus);
    setTimeout(() => this.long.delete(bus), (lengthSec + 0.5) * 1000);
    return bus;
  }

  /** Quickly fade out any charge/beam sound still playing. */
  cancelLong(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const bus of this.long) {
      bus.gain.cancelScheduledValues(ctx.currentTime);
      bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
      bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.06);
    }
    this.long.clear();
  }

  private rateLimited(): boolean {
    const now = performance.now();
    if (now - this.lastStrike < MIN_STRIKE_GAP_MS) return true;
    this.lastStrike = now;
    return false;
  }

  /** Punch: quick air snap + light body thump. */
  punch(at?: number): void {
    if (at === undefined && this.rateLimited()) return;
    const r = this.ready(at);
    if (!r) return;
    const { ctx, t, out } = r;
    this.noiseBurst(ctx, t, "bandpass", 2400, 900, 1.0, 0.9, 0.003, 0.07, out);
    this.thump(ctx, t + 0.012, 170, 70, 1.0, 0.1, out);
  }

  /** Kick: longer rising whoosh, then a heavier thump. */
  kick(at?: number): void {
    if (at === undefined && this.rateLimited()) return;
    const r = this.ready(at);
    if (!r) return;
    const { ctx, t, out } = r;
    this.noiseBurst(ctx, t, "bandpass", 500, 2600, 1.6, 0.45, 0.04, 0.11, out);
    this.thump(ctx, t + 0.09, 130, 48, 0.9, 0.13, out);
  }

  /**
   * Kamehameha charge: a hum that rises in pitch and brightness with a slow
   * shimmer on top. Lasts durationMs.
   */
  charge(durationMs: number, at?: number): void {
    const r = this.ready(at);
    if (!r) return;
    const { ctx, t } = r;
    const d = durationMs / 1000;
    const out = this.longBus(ctx, r.out, d);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.exponentialRampToValueAtTime(2400, t + d);
    const g = ctx.createGain();
    // Audible straight away, swelling towards the release.
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.5, t + d * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.08);
    lp.connect(g).connect(out);

    // Tremolo that speeds up as it charges.
    const trem = ctx.createGain();
    trem.gain.value = 0.75;
    trem.connect(lp);
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(5, t);
    lfo.frequency.linearRampToValueAtTime(14, t + d);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.25;
    lfo.connect(lfoDepth).connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + d + 0.1);

    for (const detune of [-9, 0, 11]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.detune.value = detune;
      osc.frequency.setValueAtTime(98, t);
      osc.frequency.exponentialRampToValueAtTime(196, t + d);
      osc.connect(trem);
      osc.start(t);
      osc.stop(t + d + 0.1);
    }

    // Airy shimmer.
    this.noiseBurst(ctx, t, "highpass", 3500, 6000, 0.7, 0.06, d * 0.8, d * 0.2, out);
  }

  /**
   * Beam: punchy attack, a roaring body for the hold, released as the beam
   * fades. Lasts durationMs.
   */
  beam(durationMs: number, at?: number): void {
    const r = this.ready(at);
    if (!r) return;
    const { ctx, t } = r;
    const d = durationMs / 1000;
    const out = this.longBus(ctx, r.out, d);
    const release = 0.35;
    const hold = Math.max(0.05, d - release);

    const body = ctx.createGain();
    body.gain.setValueAtTime(0.0001, t);
    body.gain.exponentialRampToValueAtTime(0.9, t + 0.025);
    body.gain.setValueAtTime(0.75, t + hold);
    body.gain.exponentialRampToValueAtTime(0.0001, t + d);
    body.connect(out);

    // Roar: filtered noise that darkens over time.
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + d);
    src.connect(lp).connect(body);
    src.start(t);
    src.stop(t + d + 0.05);

    // Energy tone with vibrato.
    const tone = ctx.createOscillator();
    tone.type = "sawtooth";
    tone.frequency.setValueAtTime(220, t);
    tone.frequency.exponentialRampToValueAtTime(150, t + d);
    const vib = ctx.createOscillator();
    vib.frequency.value = 9;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 7;
    vib.connect(vibDepth).connect(tone.frequency);
    const toneLp = ctx.createBiquadFilter();
    toneLp.type = "lowpass";
    toneLp.frequency.value = 1400;
    const toneGain = ctx.createGain();
    toneGain.gain.value = 0.22;
    tone.connect(toneLp).connect(toneGain).connect(body);
    tone.start(t);
    vib.start(t);
    tone.stop(t + d + 0.05);
    vib.stop(t + d + 0.05);

    // Sub boom at the moment of release.
    this.thump(ctx, t, 90, 38, 1.0, 0.45, out);
  }
}
