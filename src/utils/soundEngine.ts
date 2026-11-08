// Procedural Web Audio API synthesizer for 3D Chemistry Lab & Eruptions
// Zero external MP3/WAV dependencies

class LabSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // Crisp mechanical click when equipping PPE gear or toggling steps
  public playUiClick(pitch = 520) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.4, now + 0.065);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  // Pouring liquid or dropping Orbeez into the vessel
  public playIngredientPour(step: 'peroxide' | 'soap' | 'orbeez' | 'catalyst') {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = 0.45;

    // Filtered noise + resonant glug oscillators
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq =
      step === 'peroxide' ? 650 : step === 'soap' ? 420 : step === 'orbeez' ? 980 : 820;
    filter.frequency.setValueAtTime(baseFreq, now);
    filter.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + duration);
    filter.Q.value = 4.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  // Rising-pitch acoustic glug as the vessel fills during continuous State 2 press/drag pouring
  public playPourPulse(
    step: 'peroxide' | 'soap' | 'orbeez' | 'catalyst',
    fillRatio: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = step === 'orbeez' ? 'triangle' : 'sine';

    const basePitch =
      step === 'peroxide' ? 280 : step === 'soap' ? 220 : step === 'orbeez' ? 520 : 380;
    const pitch = basePitch + Math.min(1.4, Math.max(0, fillRatio)) * 420;

    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.18, now + 0.09);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Warning beep when safety hazard is triggered
  public playSafetyAlert() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(330, now + 0.12);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.29);
  }

  // Full eruption soundscape: gantry clank + exothermic hiss + deep volcanic foam roar
  public playEruptionSound(intensity: number, isSteamFlash: boolean, durationSec: number) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dur = Math.min(8, Math.max(2.5, durationSec * 0.75));

    // 1. Mechanical gantry release clank
    const clankOsc = ctx.createOscillator();
    const clankGain = ctx.createGain();
    clankOsc.type = 'square';
    clankOsc.frequency.setValueAtTime(160, now);
    clankOsc.frequency.exponentialRampToValueAtTime(55, now + 0.18);
    clankGain.gain.setValueAtTime(0.15, now);
    clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    clankOsc.connect(clankGain);
    clankGain.connect(ctx.destination);
    clankOsc.start(now);
    clankOsc.stop(now + 0.21);

    // 2. Exothermic foam / steam roar (bandpass + lowpass white noise)
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = isSteamFlash ? 'highpass' : 'lowpass';
    const startCutoff = isSteamFlash ? 1200 : 180 + intensity * 450;
    filter.frequency.setValueAtTime(startCutoff, now + 0.1);
    filter.frequency.exponentialRampToValueAtTime(
      isSteamFlash ? 2800 : 950 + intensity * 600,
      now + 0.8
    );
    filter.frequency.exponentialRampToValueAtTime(220, now + dur);

    const roarGain = ctx.createGain();
    const peakGain = Math.min(0.28, 0.08 + intensity * 0.18);
    roarGain.gain.setValueAtTime(0.001, now);
    roarGain.gain.linearRampToValueAtTime(peakGain, now + 0.35);
    roarGain.gain.exponentialRampToValueAtTime(0.002, now + dur);

    noise.connect(filter);
    filter.connect(roarGain);
    roarGain.connect(ctx.destination);
    noise.start(now);
  }

  // Water hose cleanup spray sound
  public playHoseCleanup() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dur = 1.2;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.Q.value = 1.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.002, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  // Dramatic 3-2-1 countdown beep
  public playCountdownBeep(isFinalGo = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isFinalGo ? 'sawtooth' : 'sine';
    const freq = isFinalGo ? 880 : 440;
    osc.frequency.setValueAtTime(freq, now);
    if (isFinalGo) {
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.22);
    }

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinalGo ? 0.26 : 0.14));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isFinalGo ? 0.27 : 0.15));
  }

  // Celebratory brass/synth fanfare when a massive eruption hits peak height
  public playVictoryFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.34);
    });
  }

  // Comical wet bubble splat + cartoon boing when Dish Soap / Foam gets in your eyes!
  public playSoapSplatSound() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.36);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.002, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Awkward cricket chirps when the child forgets Catalyst or Peroxide
  public playCricketChirpSound() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.28, 0.56].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(3800, now + offset);
      osc.frequency.setValueAtTime(4100, now + offset + 0.04);
      gain.gain.setValueAtTime(0.04, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.13);
    });
  }

  // Bubbly slime burp when too much soap is measured in
  public playSlimeBurpSound() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(68, now + 0.35);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

export const soundEngine = new LabSoundEngine();


