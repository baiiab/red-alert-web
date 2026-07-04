export class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
  }

  getCtx() {
    if (!this.audioCtx) {
      try { this.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    return this.audioCtx;
  }

  playSound(freq, type, dur, vol, slide) {
    try {
      var ac = this.getCtx();
      if (!ac || this.muted) return;
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (slide !== false) osc.frequency.exponentialRampToValueAtTime(Math.max(50, freq * 0.3), ac.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.1, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + dur);
    } catch(e) {}
  }

  playExplosion() { this.playSound(120, 'sawtooth', 0.35, 0.15); }
  playShoot() { this.playSound(900, 'square', 0.06, 0.04); }
  playBuild() {
    this.playSound(440, 'sine', 0.18, 0.08, false);
    var self = this;
    setTimeout(function() { self.playSound(660, 'sine', 0.18, 0.08, false); }, 120);
  }
  playSelect() { this.playSound(700, 'sine', 0.08, 0.04, false); }
  playReady() {
    this.playSound(523, 'sine', 0.12, 0.08, false);
    var self = this;
    setTimeout(function() { self.playSound(784, 'sine', 0.15, 0.08, false); }, 100);
  }
  playAlert() {
    this.playSound(880, 'square', 0.15, 0.1);
    var self = this;
    setTimeout(function() { self.playSound(660, 'square', 0.15, 0.1); }, 150);
  }
  playCancel() { this.playSound(330, 'square', 0.1, 0.05); }
}

export const audioManager = new AudioManager();
