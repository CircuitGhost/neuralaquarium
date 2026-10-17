/**
 * Procedural Web Audio API Sound Generator for Synapse
 * Provides rich oceanic ambient hydrophone resonance, ocean current noise,
 * pentatonic water droplets, and feeding chimes.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.masterGain = null;
    this.ambientNodes = [];
    this.chimeInterval = null;
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();

      // Master output bus
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupOceanicCurrents();
      this.setupHarmonicDrone();
      this.startAmbientChimes();

      // Ensure AudioContext resumes if suspended
      if (this.ctx.state === 'suspended') {
        const resumeOnFirstInput = () => {
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
          }
          window.removeEventListener('click', resumeOnFirstInput);
          window.removeEventListener('keydown', resumeOnFirstInput);
        };
        window.addEventListener('click', resumeOnFirstInput);
        window.addEventListener('keydown', resumeOnFirstInput);
      }
    } catch (e) {
      console.warn('Web Audio initialization error:', e);
    }
  }

  setupOceanicCurrents() {
    if (!this.ctx) return;
    // 1. Procedural Pink Noise buffer for realistic underwater current rush
    const bufferSize = this.ctx.sampleRate * 3; // 3 second loop
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Resonant low-pass filter modulated by slow swell LFO
    const swellFilter = this.ctx.createBiquadFilter();
    swellFilter.type = 'lowpass';
    swellFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    swellFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    // Swell LFO (0.08 Hz slow rolling tidal swell)
    const swellLFO = this.ctx.createOscillator();
    swellLFO.frequency.setValueAtTime(0.08, this.ctx.currentTime);
    const swellGain = this.ctx.createGain();
    swellGain.gain.setValueAtTime(140, this.ctx.currentTime);

    swellLFO.connect(swellGain);
    swellGain.connect(swellFilter.frequency);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    whiteNoise.connect(swellFilter);
    swellFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    whiteNoise.start();
    swellLFO.start();
  }

  setupHarmonicDrone() {
    if (!this.ctx) return;
    // 2. Warm A2 (110 Hz) fundamental + E3 (165 Hz) fifth underwater drone
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(110.0, this.ctx.currentTime);

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(164.8, this.ctx.currentTime);

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(260, this.ctx.currentTime);

    // Subtle gentle tremolo LFO (0.15 Hz)
    const tremoloLFO = this.ctx.createOscillator();
    tremoloLFO.frequency.setValueAtTime(0.15, this.ctx.currentTime);
    const tremoloGain = this.ctx.createGain();
    tremoloGain.gain.setValueAtTime(0.04, this.ctx.currentTime);

    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(0.16, this.ctx.currentTime);

    tremoloLFO.connect(tremoloGain);
    tremoloGain.connect(droneGain.gain);

    osc1.connect(droneFilter);
    osc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    tremoloLFO.start();
  }

  startAmbientChimes() {
    if (this.chimeInterval) return;
    // Pentatonic scale frequencies for peaceful aquatic droplet chimes:
    // C4 (261.6), E4 (329.6), G4 (392.0), A4 (440.0), C5 (523.3), E5 (659.3)
    const notes = [261.63, 329.63, 392.0, 440.0, 523.25, 659.25];

    const scheduleNextChime = () => {
      const delay = 4500 + Math.random() * 5500; // every 4.5 to 10 seconds
      this.chimeInterval = setTimeout(() => {
        if (!this.isMuted && this.ctx && this.ctx.state === 'running') {
          const freq = notes[Math.floor(Math.random() * notes.length)];
          this.playDropletChime(freq);
        }
        scheduleNextChime();
      }, delay);
    };

    scheduleNextChime();
  }

  playDropletChime(freq = 523.25) {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      // Gentle pitch dip mimicking underwater acoustic refraction
      osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 1.2);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 1.9);
    } catch (e) {
      // Ignore audio interruption
    }
  }

  toggleMute() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0 : 0.48;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    }
    console.log(`[Audio] Soundscape is now: ${this.isMuted ? 'Muted' : 'Unmuted'}`);
    return this.isMuted;
  }

  playFeed(volMultiplier = 1.0) {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;

      // Primary bubbly harmonic sweep
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.14);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(660, now);
      osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.14);

      const targetGain = 0.18 * volMultiplier;
      gain.gain.setValueAtTime(targetGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);
    } catch (e) {
      // AudioContext interrupted
    }
  }

  playStimulate() {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      // AudioContext interrupted
    }
  }
}

export const soundEngine = new SoundEngine();
