import * as THREE from 'three';
import { buildEnemyShip } from './ShipFactory.js';

// ---------------------------------------------------------------------------
// 敌机行为定义（数据驱动）
// move: straight 直下 | sine 正弦 | hover 悬停炮击 | dash 侧向突袭
// fire: aimed 单发瞄准 | burst 连发瞄准 | spread 扇形 | ring 环形 | none
// ---------------------------------------------------------------------------
export const ENEMY_DEFS = {
  scout: {
    hp: 12, score: 100, radius: 0.95, speed: 8.5, color: 0xff6a5a, scale: 1,
    move: 'straight', fire: { type: 'aimed', delay: 1.1, speed: 13, dmg: 10, color: 0xff8a6a },
    drop: 0.06, boomScale: 1,
  },
  interceptor: {
    hp: 20, score: 200, radius: 1.05, speed: 7, color: 0xc080ff, scale: 1,
    move: 'sine', fire: { type: 'burst', count: 2, gap: 0.18, period: 1.7, speed: 15, dmg: 10, color: 0xd090ff },
    drop: 0.08, boomScale: 1,
  },
  gunboat: {
    hp: 55, score: 400, radius: 1.35, speed: 5, color: 0xffa040, scale: 1,
    move: 'hover', fire: { type: 'spread', n: 3, fan: 40, period: 2.3, speed: 12, dmg: 10, color: 0xffb060 },
    drop: 0.3, boomScale: 1.3,
  },
  bomber: {
    hp: 110, score: 650, radius: 1.75, speed: 2.8, color: 0xff5040, scale: 1,
    move: 'straight', fire: { type: 'ring', n: 10, period: 2.9, speed: 9, dmg: 10, color: 0xff7050 },
    drop: 0.5, boomScale: 1.7,
  },
  elite: {
    hp: 70, score: 1000, radius: 1.15, speed: 10, color: 0x50ffa0, scale: 1,
    move: 'dash', fire: { type: 'spread', n: 5, fan: 60, period: 1.5, speed: 14, dmg: 10, color: 0x70ffb0 },
    drop: 0.85, boomScale: 1.5,
  },
};

let _enemyId = 1;

class Enemy {
  constructor(game, type) {
    this.game = game;
    this.type = type;
    this.def = ENEMY_DEFS[type];
    this.group = buildEnemyShip(type);
    this.group.visible = false;
    game.scene.add(this.group);
    this.id = _enemyId++;
    this.alive = false;
  }

  reset(x, z, opts = {}) {
    const d = this.def;
    this.hp = this.maxHp = Math.round(d.hp * (opts.hpMul ?? 1));
    this.alive = true;
    this.age = 0;
    this.baseX = x;
    this.phase = Math.random() * Math.PI * 2;
    this.fireTimer = d.fire.delay ?? (d.fire.period ? d.fire.period * (0.5 + Math.random() * 0.5) : 1);
    this.burstLeft = 0;
    this.burstGap = 0;
    this.holdZ = -6 - Math.random() * 8;
    this.dir = opts.dir ?? 1;           // dash 方向
    this.speed = d.speed * (opts.speedMul ?? 1);
    this._flash = 0;
    this.group.position.set(x, 0.5, z);
    this.group.scale.setScalar(d.scale);
    this.group.visible = true;
  }

  get pos() { return this.group.position; }
  get radius() { return this.def.radius; }

  takeDamage(dmg, hitPos) {
    if (!this.alive) return false;
    this.hp -= dmg;
    this._flash = 0.09;
    if (hitPos) this.game.effects.hitSpark(hitPos, 0xffe0a0);
    this.game.audio.hit();
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    this.alive = false;
    this.group.visible = false;
    const d = this.def;
    this.game.effects.explosion(this.pos, d.color, d.boomScale);
    this.game.audio.explosion(d.boomScale);
    this.game.addScore(d.score);
    this.game.powerups.dropRoll(this.pos.x, this.pos.z, d.drop);
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    const p = this.pos;
    const d = this.def;
    const g = this.game;

    // ---- 移动 ----
    switch (d.move) {
      case 'straight':
        p.z += this.speed * dt;
        break;
      case 'sine':
        p.z += this.speed * dt;
        p.x = THREE.MathUtils.clamp(this.baseX + Math.sin(this.age * 2.4 + this.phase) * 3.4, g.bounds.minX + 1, g.bounds.maxX - 1);
        break;
      case 'hover':
        if (p.z < this.holdZ) {
          p.z += this.speed * 2.2 * dt;
        } else {
          p.x = THREE.MathUtils.clamp(this.baseX + Math.sin(this.age * 0.9 + this.phase) * 4.5, g.bounds.minX + 1.5, g.bounds.maxX - 1.5);
          p.z = this.holdZ + Math.sin(this.age * 1.7) * 0.5;
        }
        break;
      case 'dash':
        p.x += this.dir * this.speed * dt;
        p.z += Math.sin(this.age * 3 + this.phase) * 3.5 * dt;
        break;
    }

    // 轻微姿态摆动
    this.group.rotation.z = Math.sin(this.age * 2 + this.phase) * 0.06;

    // ---- 开火 ----
    const f = d.fire;
    if (f.type !== 'none' && p.z > g.bounds.minZ && p.z < g.bounds.maxZ) {
      this.fireTimer -= dt;
      // 连发处理
      if (this.burstLeft > 0) {
        this.burstGap -= dt;
        if (this.burstGap <= 0) {
          this.burstLeft--;
          this.burstGap = f.gap;
          this._fireAimed(f.speed, f.dmg, f.color);
        }
      } else if (this.fireTimer <= 0) {
        switch (f.type) {
          case 'aimed':
            this.fireTimer = f.period ?? 99999; // 无 period = 只打一次
            this._fireAimed(f.speed, f.dmg, f.color);
            break;
          case 'burst':
            this.fireTimer = f.period;
            this.burstLeft = f.count;
            this.burstGap = 0;
            break;
          case 'spread': {
            this.fireTimer = f.period;
            const base = this._aimAngle();
            const n = f.n, fan = THREE.MathUtils.degToRad(f.fan);
            for (let i = 0; i < n; i++) {
              const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * fan);
              g.enemyBullets.spawn(p.x, p.z + 0.5, a, f.speed, { dmg: f.dmg, color: f.color, size: 1 });
            }
            g.audio.enemyShoot();
            break;
          }
          case 'ring': {
            this.fireTimer = f.period;
            const off = this.phase + this.age;
            for (let i = 0; i < f.n; i++) {
              const a = off + (i / f.n) * Math.PI * 2;
              g.enemyBullets.spawn(p.x, p.z, a, f.speed, { dmg: f.dmg, color: f.color, size: 1 });
            }
            g.audio.enemyShoot();
            break;
          }
        }
      }
    }

    // 受击闪白（缩放脉冲代替材质共享问题）
    if (this._flash > 0) {
      this._flash -= dt;
      const s = d.scale * (1 + this._flash * 1.6);
      this.group.scale.setScalar(s);
    }

    // 出屏回收
    if (p.z > g.bounds.maxZ + 5 || p.x < g.bounds.minX - 6 || p.x > g.bounds.maxX + 6) {
      this.alive = false;
      this.group.visible = false;
    }
  }

  _aimAngle() {
    const p = this.pos, t = this.game.player.group.position;
    return Math.atan2(t.x - p.x, -(t.z - p.z));
  }

  _fireAimed(speed, dmg, color) {
    const p = this.pos;
    this.game.enemyBullets.spawn(p.x, p.z + 0.5, this._aimAngle(), speed, { dmg, color, size: 1 });
    this.game.audio.enemyShoot();
  }
}

// ---------------------------------------------------------------------------
export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.active = [];
    this._free = new Map(); // type -> Enemy[]
  }

  spawn(type, x, z, opts = {}) {
    let pool = this._free.get(type);
    if (!pool) { pool = []; this._free.set(type, pool); }
    const e = pool.pop() || new Enemy(this.game, type);
    e.reset(x, z, opts);
    this.active.push(e);
    return e;
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.update(dt);
      if (!e.alive) {
        this.active.splice(i, 1);
        this._free.get(e.type).push(e);
      }
    }
  }

  damageAll(dmg) {
    // 倒序遍历，die 不会立刻移出列表，安全
    for (const e of this.active) e.takeDamage(dmg, e.pos);
  }

  clear() {
    for (const e of this.active) { e.alive = false; e.group.visible = false; this._free.get(e.type).push(e); }
    this.active.length = 0;
  }

  get count() { return this.active.length; }
}
