export class AudioManager {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
    this.bgmOscillators = [];
    this.bgmGain = null;
    this.isPlayingBGM = false;
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

  // 基础音效
  playExplosion() { this.playSound(120, 'sawtooth', 0.35, 0.15); }
  playShoot() {
    // 大量单位交火时节流，避免节点爆炸式创建
    var ac = this.getCtx();
    var now = ac ? ac.currentTime : Date.now() / 1000;
    if (this._lastShoot && now - this._lastShoot < 0.03) return;
    this._lastShoot = now;
    this.playSound(900, 'square', 0.06, 0.04);
  }
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
  
  // 坦克移动音效
  playTankMove() {
    this.playSound(80, 'sawtooth', 0.3, 0.03);
  }
  
  // 采矿车音效
  playHarvest() {
    this.playSound(200, 'sine', 0.1, 0.05);
  }
  
  // 建造完成音效
  playConstructionComplete() {
    var self = this;
    self.playSound(523, 'sine', 0.1, 0.08, false);
    setTimeout(function() { self.playSound(659, 'sine', 0.1, 0.08, false); }, 100);
    setTimeout(function() { self.playSound(784, 'sine', 0.15, 0.08, false); }, 200);
  }
  
  // 单位损失音效
  playUnitLost() {
    this.playSound(200, 'sawtooth', 0.4, 0.1);
  }
  
  // 资金不足音效
  playInsufficientFunds() {
    this.playSound(150, 'square', 0.15, 0.08);
  }
  
  // 电力不足音效
  playLowPower() {
    this.playSound(300, 'sawtooth', 0.3, 0.06);
  }
  
  // 激光音效
  playLaser() {
    this.playSound(1200, 'sine', 0.15, 0.08);
    var self = this;
    setTimeout(function() { self.playSound(800, 'sine', 0.1, 0.05); }, 50);
  }
  
  // 特斯拉电击音效
  playTesla() {
    this.playSound(600, 'sawtooth', 0.2, 0.1);
    var self = this;
    setTimeout(function() { self.playSound(900, 'sawtooth', 0.15, 0.08); }, 50);
    setTimeout(function() { self.playSound(1200, 'sawtooth', 0.1, 0.06); }, 100);
  }
  
  // 核弹警报
  playNukeSiren() {
    var self = this;
    for (let i = 0; i < 5; i++) {
      setTimeout(function() {
        self.playSound(800, 'square', 0.3, 0.1);
        setTimeout(function() { self.playSound(600, 'square', 0.3, 0.1); }, 300);
      }, i * 600);
    }
  }
  
  // 超时空传送音效
  playChrono() {
    var self = this;
    self.playSound(400, 'sine', 0.1, 0.08);
    setTimeout(function() { self.playSound(600, 'sine', 0.1, 0.08); }, 50);
    setTimeout(function() { self.playSound(800, 'sine', 0.1, 0.08); }, 100);
    setTimeout(function() { self.playSound(1000, 'sine', 0.15, 0.08); }, 150);
  }
  
  // 铁幕音效
  playIronCurtain() {
    var self = this;
    self.playSound(200, 'sawtooth', 0.2, 0.1);
    setTimeout(function() { self.playSound(300, 'sawtooth', 0.3, 0.12); }, 100);
    setTimeout(function() { self.playSound(400, 'sawtooth', 0.4, 0.15); }, 200);
  }
  
  // 背景音乐 - 简单的节奏
  startBGM() {
    if (this.isPlayingBGM || this.muted) return;
    var ac = this.getCtx();
    if (!ac) return;
    
    this.isPlayingBGM = true;
    this.bgmGain = ac.createGain();
    this.bgmGain.gain.value = 0.03;
    this.bgmGain.connect(ac.destination);
    
    // 简单的低音节奏
    this.playBassLine();
  }
  
  playBassLine() {
    if (!this.isPlayingBGM) return;
    var ac = this.getCtx();
    var self = this;
    
    // 低音音符序列
    var notes = [65, 65, 73, 65, 55, 55, 65, 73]; // C, C, D, C, A, A, C, D
    var index = 0;
    
    var playNote = function() {
      if (!self.isPlayingBGM) return;
      
      var osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = notes[index];
      osc.connect(self.bgmGain);
      
      var noteGain = ac.createGain();
      noteGain.gain.setValueAtTime(0.5, ac.currentTime);
      noteGain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.4);
      
      osc.connect(noteGain);
      noteGain.connect(ac.destination);
      
      osc.start(ac.currentTime);
      osc.stop(ac.currentTime + 0.4);
      
      index = (index + 1) % notes.length;
      setTimeout(playNote, 500);
    };
    
    playNote();
  }
  
  stopBGM() {
    this.isPlayingBGM = false;
    if (this.bgmGain) {
      try {
        this.bgmGain.disconnect();
      } catch(e) {}
    }
  }
  
  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
    return this.muted;
  }
}

export const audioManager = new AudioManager();
