import type { Language, Settings } from './types';
import type { Biome } from './campaign';

class Soundscape {
  private context: AudioContext | null = null;
  private effects: GainNode | null = null;
  private music: GainNode | null = null;
  private master: GainNode | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private muted = false;
  private soundVolume = 0.65;
  private musicVolume = 0.3;
  private biome: Biome = 'village';
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private motor: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private voicesEnabled = true;

  start() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.effects = this.context.createGain();
        this.music = this.context.createGain();
        this.effects.connect(this.master);
        this.music.connect(this.master);
        this.master.connect(this.context.destination);
        this.applyVolume();
        this.ambient();
        this.interval = setInterval(() => this.phrase(), 1900);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      // Audio is optional on browsers that restrict the Web Audio API.
    }
  }

  configure(settings: Settings, muted = this.muted) {
    this.soundVolume = settings.sound / 100;
    this.musicVolume = settings.music / 100;
    this.voicesEnabled = settings.voices;
    this.muted = muted;
    this.applyVolume();
    if (!settings.voices || muted || settings.sound === 0) this.stopVoice();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyVolume();
    if (muted) this.stopVoice();
  }

  private applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    if (this.effects) this.effects.gain.value = this.soundVolume;
    if (this.music) this.music.gain.value = this.musicVolume;
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType = 'sine', endFrequency?: number, music = false, delay = 0) {
    const ctx = this.context;
    const bus = music ? this.music : this.effects;
    if (!ctx || !bus) return;
    const start = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + Math.min(0.025, duration / 3));
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }

  private ambient() {
    const ctx = this.context;
    if (!ctx || !this.effects) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < samples.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.025) / 1.025;
      samples[i] = last;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    const gain = ctx.createGain();
    gain.gain.value = 0.32;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    source.start();
    this.ambientFilter = filter;
    this.ambientGain = gain;
    this.setRegion(this.biome);
  }

  private phrase() {
    // An original sparse modal motif; every sound is synthesized in the browser.
    const motifs: Partial<Record<Biome, number[]>> = {
      village: [146.83, 220, 196, 174.61, 220, 293.66, 196, 146.83],
      mountain: [196, 293.66, 220, 196, 146.83, 220, 293.66, 196],
      desert: [146.83, 155.56, 220, 207.65, 174.61, 155.56, 220, 146.83],
      oasis: [146.83, 174.61, 220, 293.66, 261.63, 220, 174.61, 146.83],
      port: [130.81, 196, 155.56, 174.61, 196, 261.63, 155.56, 130.81],
      highland: [174.61, 196, 261.63, 349.23, 293.66, 261.63, 196, 174.61],
      river: [164.81, 220, 246.94, 329.63, 293.66, 246.94, 220, 164.81],
      citadel: [110, 116.54, 164.81, 146.83, 110, 164.81, 130.81, 110],
    };
    const motif = motifs[this.biome] ?? [146.83, 220, 155.56, 185, 220, 196, 185, 146.83];
    const note = motif[this.step % motif.length];
    this.tone(note, 3.6, 0.09, 'sine', undefined, true);
    this.tone(note * 2, 2.5, 0.028, 'triangle', undefined, true, 0.14);
    if (this.step % 4 === 0) this.tone(73.42, 6, 0.045, 'sine', undefined, true);
    if (this.step % 5 === 0 && !['desert', 'citadel', 'border'].includes(this.biome)) {
      this.tone(1900, 0.16, 0.02, 'sine', 2600, false, 0.4);
      this.tone(2300, 0.13, 0.012, 'sine', 1700, false, 0.65);
    }
    this.step++;
  }

  setRegion(biome: Biome) {
    this.biome = biome;
    this.step = 0;
    if (this.ambientFilter) this.ambientFilter.frequency.setTargetAtTime(['desert', 'mountain'].includes(biome) ? 1250 : biome === 'river' ? 2300 : 650, this.context!.currentTime, 1.5);
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(biome === 'river' || biome === 'port' ? 0.5 : biome === 'desert' ? 0.38 : 0.21, this.context!.currentTime, 1.5);
  }

  vehicle(speed: number, active: boolean) {
    const ctx = this.context;
    if (!ctx || !this.effects) return;
    if (!this.motor && active) {
      this.motor = ctx.createOscillator(); this.motor.type = 'triangle';
      this.motorGain = ctx.createGain(); this.motorGain.gain.value = 0;
      this.motor.connect(this.motorGain); this.motorGain.connect(this.effects); this.motor.start();
    }
    this.motor?.frequency.setTargetAtTime(45 + Math.abs(speed) * 3.7, ctx.currentTime, 0.12);
    this.motorGain?.gain.setTargetAtTime(active ? 0.065 + Math.min(Math.abs(speed), 19) * 0.003 : 0, ctx.currentTime, 0.12);
  }

  speak(line: string, language: Language, actor = '') {
    if (!this.voicesEnabled || this.muted || this.soundVolume <= 0 || !('speechSynthesis' in window)) return;
    const voice = speechSynthesis.getVoices().find(v => v.localService && v.lang.toLowerCase().startsWith(language));
    if (!voice) return;
    speechSynthesis.cancel();
    // Short utterances also work on browsers that truncate long speech requests.
    const words = line.split(/\s+/); const chunks: string[] = []; let current = '';
    for (const word of words) {
      if (current.length + word.length > 180) { chunks.push(current); current = ''; }
      current += `${current ? ' ' : ''}${word}`;
    }
    if (current) chunks.push(current);
    for (const chunk of chunks) {
      const utterance = new SpeechSynthesisUtterance(chunk);
      utterance.voice = voice; utterance.lang = voice.lang;
      utterance.volume = this.soundVolume * 0.85; utterance.rate = 0.96;
      utterance.pitch = ['idris', 'murad', 'tarek'].includes(actor) ? 0.82 : ['liane', 'nour', 'mira', 'ines'].includes(actor) ? 1.08 : 0.96;
      speechSynthesis.speak(utterance);
    }
  }

  stopVoice() { if ('speechSynthesis' in window) speechSynthesis.cancel(); }

  ui() { this.tone(520, 0.07, 0.06, 'sine', 780); }
  fire() { this.tone(540, 0.14, 0.16, 'triangle', 90); this.tone(1200, 0.06, 0.05, 'sine', 350); }
  hit() { this.tone(760, 0.13, 0.12, 'sine', 1100); this.tone(1140, 0.2, 0.06, 'triangle'); }
  collect() { [440, 554.37, 659.25, 880].forEach((n, i) => this.tone(n, 0.42, 0.1, 'sine', undefined, false, i * 0.07)); }
  damage() { this.tone(100, 0.22, 0.16, 'triangle', 38); }
  footstep() { this.tone(65 + Math.random() * 20, 0.045, 0.07, 'triangle', 30); }
  jump() { this.tone(120, 0.15, 0.05, 'sine', 260); }
  reload() { [280, 350, 420].forEach((n, i) => this.tone(n, 0.1, 0.05, 'triangle', undefined, false, i * 0.3)); }
  win() { [293.66, 369.99, 440, 587.33].forEach((n, i) => this.tone(n, 1.8, 0.14, 'sine', undefined, false, i * 0.18)); }
  stop() { if (this.interval) clearInterval(this.interval); void this.context?.close(); this.context = null; }
}

export const sound = new Soundscape();