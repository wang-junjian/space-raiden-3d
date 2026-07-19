// 音频系统：Web Audio API 程序化合成，零外部音频资源
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this._musicTimer = null;
    this._lastShot = 0;
  }

  // 浏览器要求首次用户交互后才能启动音频
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.32;
    this.musicGain.connect(this.master);
  }

  _now() { return this.ctx.currentTime; }

  // ---- 基础合成工具 ----
  _osc(type, freq, t0, dur, gainEnv, dest, freqEnd) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainEnv, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest || this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  _noise(t0, dur, gainEnv, filterFreq, filterType = 'lowpass', q = 0.8, dest) {
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(filterFreq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, filterFreq * 0.15), t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainEnv, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(dest || this.sfxGain);
    src.start(t0); src.stop(t0 + dur);
  }

  // ---- SFX ----
  shoot(weapon) {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    if (t - this._lastShot < 0.045) return; // 限流，避免刺耳
    this._lastShot = t;
    if (weapon === 'blue') {
      this._osc('sawtooth', 1400, t, 0.09, 0.10, null, 300);
      this._osc('square', 700, t, 0.06, 0.05, null, 200);
    } else {
      this._osc('square', 880, t, 0.055, 0.08, null, 320);
    }
  }

  enemyShoot() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    this._osc('triangle', 420, t, 0.08, 0.05, null, 180);
  }

  explosion(size = 1) {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    this._noise(t, 0.35 * size, 0.35, 900 * size > 900 ? 900 : 900 * size, 'lowpass');
    this._osc('sine', 120, t, 0.3 * size, 0.3, null, 35);
  }

  bigExplosion() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    this._noise(t, 1.1, 0.5, 1400);
    this._noise(t + 0.12, 0.9, 0.4, 700);
    this._osc('sine', 90, t, 0.9, 0.5, null, 28);
  }

  hit() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    this._noise(t, 0.08, 0.12, 2400, 'bandpass', 1.5);
  }

  playerHit() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    this._osc('sawtooth', 300, t, 0.35, 0.35, null, 60);
    this._noise(t, 0.4, 0.4, 800);
  }

  powerup() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    const seq = [523, 659, 784, 1047];
    seq.forEach((f, i) => this._osc('square', f, t + i * 0.055, 0.09, 0.10));
  }

  shieldUp() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    this._osc('sine', 300, t, 0.4, 0.18, null, 900);
    this._osc('sine', 450, t + 0.1, 0.35, 0.12, null, 1200);
  }

  bomb() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    this._noise(t, 1.4, 0.55, 2000);
    this._osc('sine', 60, t, 1.2, 0.55, null, 24);
    this._osc('sawtooth', 200, t + 0.05, 0.8, 0.2, null, 40);
  }

  bossWarn() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    for (let i = 0; i < 3; i++) {
      this._osc('square', 220, t + i * 0.32, 0.22, 0.16);
      this._osc('square', 165, t + i * 0.32 + 0.14, 0.16, 0.14);
    }
  }

  bossDown() {
    if (!this.ctx || !this.enabled) return;
    const t = this._now();
    for (let i = 0; i < 5; i++) this._noise(t + i * 0.16, 0.5, 0.3, 1000 - i * 120);
    this._osc('sine', 70, t, 1.6, 0.5, null, 24);
  }

  // ---- BGM：琶音循环（未来感合成器）----
  startMusic(levelIdx = 0) {
    if (!this.ctx || !this.enabled) return;
    this.stopMusic();
    // 每关不同的和弦进行（Hz）
    const PROG = [
      [110.0, 130.81, 164.81, 196.0],   // A C E G — 小调太空感
      [98.0, 116.54, 146.83, 174.61],   // G Bb D F
      [87.31, 110.0, 130.81, 164.81],   // F A C E
    ][levelIdx % 3];
    const BPM = 132, beat = 60 / BPM, step16 = beat / 4;
    let step = 0;
    const barLen = 16;
    const scheduleAhead = 0.15;
    let nextTime = this._now() + 0.06;

    this._musicTimer = setInterval(() => {
      if (!this.ctx) return;
      while (nextTime < this._now() + scheduleAhead) {
        const bar = Math.floor(step / barLen) % 4;
        const s16 = step % barLen;
        const root = PROG[bar];
        // 低音脉冲
        if (s16 % 4 === 0) this._osc('triangle', root / 2, nextTime, beat * 0.9, 0.34, this.musicGain);
        // 琶音
        const arpNotes = [root, root * 1.5, root * 2, root * 3, root * 2, root * 1.5];
        const arp = arpNotes[(s16 * 5 + bar * 3) % arpNotes.length];
        if (s16 % 2 === 0) this._osc('sawtooth', arp, nextTime, step16 * 1.8, 0.055, this.musicGain);
        // 高音铺底（每小节开头）
        if (s16 === 0) {
          this._osc('sine', root * 4, nextTime, beat * 3.5, 0.05, this.musicGain);
          this._osc('sine', root * 4 * 1.007, nextTime, beat * 3.5, 0.05, this.musicGain); // 微失谐，空间感
        }
        // 鼓点：噪声 hat
        if (s16 % 4 === 2) this._noise(nextTime, 0.05, 0.05, 8000, 'highpass', 0.7, this.musicGain);
        step++;
        nextTime += step16;
      }
    }, 40);
  }

  stopMusic() {
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
  }
}
