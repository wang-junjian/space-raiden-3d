import { LEVELS } from '../data/levels.js';

// ---------------------------------------------------------------------------
// 波次系统：按时间轴刷怪，全部清完触发 Boss 警告并召唤 Boss
// ---------------------------------------------------------------------------
export class WaveSystem {
  constructor(game) {
    this.game = game;
    this.active = false;
  }

  startLevel(idx) {
    this.level = LEVELS[idx];
    this.t = 0;
    this.waveIdx = 0;
    this.pending = [];
    this.bossWarned = false;
    this.bossTimer = -1;
    this.active = true;
  }

  stop() { this.active = false; this.pending.length = 0; }

  update(dt) {
    if (!this.active) return;
    const g = this.game;
    if (g.bosses.current) return; // Boss 战期间不再刷兵（Boss 自行召唤）

    if (this.bossTimer > 0) {
      this.bossTimer -= dt;
      if (this.bossTimer <= 0) g.bosses.spawnBoss(this.level.boss);
      return;
    }

    this.t += dt;
    const waves = this.level.waves;
    while (this.waveIdx < waves.length && waves[this.waveIdx].t <= this.t) {
      const w = waves[this.waveIdx];
      // 纵队等模式在入队时固定一个 x
      this.pending.push({ ...w, left: w.n, timer: 0, k: 0, fx: w.x ?? (Math.random() * 2 - 1) * 8 });
      this.waveIdx++;
    }

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.timer -= dt;
      while (p.left > 0 && p.timer <= 0) {
        this._spawnOne(p);
        p.timer += p.gap;
      }
      if (p.left <= 0) this.pending.splice(i, 1);
    }

    if (this.waveIdx >= waves.length && this.pending.length === 0 && g.enemies.count === 0 && !this.bossWarned) {
      this.bossWarned = true;
      this.bossTimer = 3.4;
      g.screens.banner('⚠ WARNING ⚠', this.level.bossName);
      g.audio.bossWarn();
    }
  }

  _spawnOne(p) {
    const g = this.game;
    const n = p.n, k = p.k;
    const B = g.bounds;
    let x = 0, z = g.spawnZ;
    const opts = { hpMul: p.hpMul ?? 1, speedMul: p.speedMul ?? 1 };

    switch (p.pattern) {
      case 'line':
        x = n > 1 ? -9 + 18 * (k / (n - 1)) : 0;
        break;
      case 'vee': {
        const off = k - (n - 1) / 2;
        x = off * 2.4;
        z = g.spawnZ - Math.abs(off) * 1.8;
        break;
      }
      case 'column':
        x = p.fx;
        break;
      case 'sides':
        x = (k % 2 === 0 ? -1 : 1) * (5 + Math.random() * 5);
        break;
      case 'dash': {
        const dir = k % 2 === 0 ? -1 : 1;
        opts.dir = dir;
        x = -dir * (B.maxX + 4);
        z = -15 + Math.random() * 8;
        break;
      }
      case 'single':
        x = p.fx;
        break;
      case 'random':
      default:
        x = (Math.random() * 2 - 1) * 10;
        break;
    }
    g.enemies.spawn(p.type, x, z, opts);
    p.k++;
    p.left--;
  }
}
