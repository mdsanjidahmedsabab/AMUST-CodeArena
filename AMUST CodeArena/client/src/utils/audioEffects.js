/**
 * utils/audioEffects.js
 * ─────────────────────
 * Lightweight Web Audio API Synthesizer for AMUST CodeArena.
 * Provides instant sound cues without external asset downloads:
 *   - playAcceptedChime(): Triumphant 4-note ascending C-Major arpeggio on AC.
 *   - playFailedAttempt(): Soft, muted downward tone on WA/TLE/MLE/CE/RTE.
 *   - setAudioEnabled(bool): Persists mute toggle in localStorage.
 */

class SoundFxEngine {
  constructor() {
    this.audioCtx = null;
    this.enabled = typeof window !== 'undefined'
      ? localStorage.getItem('codearena_audio_enabled') !== 'false'
      : true;
  }

  getAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(val) {
    this.enabled = !!val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('codearena_audio_enabled', this.enabled ? 'true' : 'false');
    }
  }

  /**
   * Triumphant C-Major ascending arpeggio on Accepted (AC):
   * C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz) -> C6 (1046.50Hz)
   */
  playAcceptedChime() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.001, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.2, now + i * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.55);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.6);
      });
    } catch {}
  }

  /**
   * Soft, subtle downward tone on failed attempt.
   */
  playFailedAttempt() {
    if (!this.enabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(170, now + 0.16);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }
}

export const soundFx = new SoundFxEngine();
