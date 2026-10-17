"use client";
import { DRONES, beepHz, engineParams, type Scene } from "./params";

/**
 * Procedural Web Audio engine. All sounds are synthesized at runtime (no audio assets).
 * The AudioContext is created only after a user gesture (browser autoplay policy) and the app starts muted.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private eng!: GainNode;
  private noise: AudioBuffer | null = null;
  private drone: { nodes: AudioNode[]; out: GainNode } | null = null;
  private engine: { src: AudioBufferSourceNode; lp: BiquadFilterNode; g: GainNode; osc: OscillatorNode; og: GainNode; trem: GainNode; lfo: OscillatorNode; lfoG: GainNode } | null = null;
  private scene: Scene | null = null;
  muted = true;
  volume = 0.6;
  ambientOn = true;
  uiOn = true;
  calm = false;

  get ready() { return !!this.ctx && this.ctx.state === "running"; }

  /** Call from a user gesture handler. Safe to call repeatedly. */
  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: "interactive" });
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 4;
      this.master = this.ctx.createGain(); this.master.gain.value = 0;
      this.sfx = this.ctx.createGain(); this.amb = this.ctx.createGain(); this.eng = this.ctx.createGain();
      this.sfx.connect(this.master); this.amb.connect(this.master); this.eng.connect(this.master);
      this.master.connect(comp).connect(this.ctx.destination);
      this.noise = this.makeBrownNoise(3);
      this.applyLevels();
      if (this.scene) this.startDrone(this.scene);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  configure(o: { muted: boolean; volume: number; ambient: boolean; ui: boolean; calm: boolean }) {
    const ambChanged = o.ambient !== this.ambientOn || o.calm !== this.calm;
    Object.assign(this, { muted: o.muted, volume: o.volume, ambientOn: o.ambient, uiOn: o.ui, calm: o.calm });
    if (!o.muted) this.unlock();
    this.applyLevels();
    if (ambChanged && this.scene) this.setScene(this.scene, true);
  }

  private applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * this.volume, t, 0.08);
  }

  private makeBrownNoise(seconds: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    return buf;
  }

  /** Soft UI tick (short filtered sine blip). */
  tick() {
    if (!this.ctx || this.muted || !this.uiOn) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(this.calm ? 1500 : 2200, t); o.frequency.exponentialRampToValueAtTime(1200, t + 0.03);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(this.calm ? 0.025 : 0.045, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.06);
  }

  /** Countdown beep. */
  beep(secondsLeft: number) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "triangle"; o.frequency.value = beepHz(secondsLeft);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.2);
  }

  /** Staging "thunk": low pitch-drop thump plus a noise transient. */
  thunk() {
    if (!this.ctx || this.muted || !this.noise) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.45);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.65);
    const n = c.createBufferSource(), lp = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = this.noise; lp.type = "lowpass"; lp.frequency.value = 900;
    ng.gain.setValueAtTime(0.6, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(lp).connect(ng).connect(this.sfx); n.start(t); n.stop(t + 0.4);
  }

  /** Switch the ambient drone (crossfade). */
  setScene(scene: Scene | null, force = false) {
    if (scene === this.scene && !force) return;
    this.scene = scene;
    this.stopDrone();
    if (scene) this.startDrone(scene);
  }

  private startDrone(scene: Scene) {
    if (!this.ctx || !this.ambientOn || this.calm) return;
    const c = this.ctx, t = c.currentTime, p = DRONES[scene];
    const out = c.createGain(); out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(p.level, t + 3);
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = p.cutoff; lp.Q.value = 0.7;
    const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = p.lfoHz; lfoG.gain.value = p.cutoff * 0.45;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    const nodes: AudioNode[] = [lp, lfo, lfoG];
    p.ratios.forEach((r, i) => {
      for (const det of [-4, 4]) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = i === 0 ? "sine" : "triangle"; o.frequency.value = p.root * r; o.detune.value = det + i * 1.5;
        g.gain.value = 0.22 / (i + 1);
        o.connect(g).connect(lp); o.start(); nodes.push(o, g);
      }
    });
    if (p.noise > 0 && this.noise) {
      const n = c.createBufferSource(), ng = c.createGain(); n.buffer = this.noise; n.loop = true; ng.gain.value = p.noise;
      n.connect(ng).connect(lp); n.start(); nodes.push(n, ng);
    }
    lp.connect(out).connect(this.amb);
    this.drone = { nodes, out };
  }

  private stopDrone() {
    const d = this.drone; if (!d || !this.ctx) { this.drone = null; return; }
    const t = this.ctx.currentTime;
    d.out.gain.cancelScheduledValues(t); d.out.gain.setTargetAtTime(0.0001, t, 0.6);
    setTimeout(() => { for (const n of d.nodes) { try { (n as OscillatorNode).stop?.(); } catch { /* already stopped */ } n.disconnect(); } d.out.disconnect(); }, 3000);
    this.drone = null;
  }

  /** ASCENT engine rumble; call every frame or at ~10 Hz. Pass throttle 0 to silence. */
  setEngine(throttle: number, qPa: number, densityFrac: number) {
    if (!this.ctx || !this.noise) return;
    const c = this.ctx, t = c.currentTime;
    if (!this.engine) {
      if (throttle <= 0) return;
      const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.9;
      const g = c.createGain(); g.gain.value = 0;
      const trem = c.createGain(); trem.gain.value = 1;
      const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 9; lfoG.gain.value = 0; lfo.connect(lfoG).connect(trem.gain); lfo.start();
      const osc = c.createOscillator(), og = c.createGain(); osc.type = "sawtooth"; og.gain.value = 0.18; osc.connect(og).connect(lp); osc.start();
      src.connect(lp).connect(trem).connect(g).connect(this.eng); src.start();
      this.engine = { src, lp, g, osc, og, trem, lfo, lfoG };
    }
    const e = this.engine, p = engineParams(throttle, qPa, densityFrac);
    e.g.gain.setTargetAtTime(p.gain, t, 0.08);
    e.lp.frequency.setTargetAtTime(p.cutoff, t, 0.1);
    e.osc.frequency.setTargetAtTime(p.rumbleHz, t, 0.2);
    e.lfoG.gain.setTargetAtTime(p.buffet * 0.5, t, 0.2);
  }

  stopEngine() {
    const e = this.engine; if (!e || !this.ctx) return;
    this.engine = null;
    const t = this.ctx.currentTime;
    e.g.gain.setTargetAtTime(0, t, 0.15);
    setTimeout(() => { for (const n of [e.src, e.osc, e.lfo]) { try { n.stop(); } catch { /* noop */ } } }, 1200);
  }
}

export const audio = new AudioEngine();
