import * as THREE from 'three';
import { glowMat } from './ShipFactory.js';

// ---------------------------------------------------------------------------
// 道具：P 火力 / 红蓝武器 / B 炸弹 / S 护盾 / 1UP / 勋章
// ---------------------------------------------------------------------------
const TYPES = {
  P:     { letter: 'P', color: 0xffd040, css: '#ffd040' },
  red:   { letter: 'R', color: 0xff5a5a, css: '#ff5a5a' },
  blue:  { letter: 'L', color: 0x5ab0ff, css: '#5ab0ff' },
  B:     { letter: 'B', color: 0x50ff90, css: '#50ff90' },
  S:     { letter: 'S', color: 0x60e0ff, css: '#60e0ff' },
  '1UP': { letter: '1UP', color: 0xff8fd0, css: '#ff8fd0' },
  medal: { letter: '◆', color: 0xffd76a, css: '#ffd76a' },
};

// 掉落权重
const DROP_TABLE = [
  ['P', 26], ['red', 16], ['blue', 16], ['medal', 24],
  ['B', 8], ['S', 7], ['1UP', 3],
];

const _texCache = new Map();
function letterTexture(type) {
  if (_texCache.has(type)) return _texCache.get(type);
  const t = TYPES[type];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = `900 ${type === '1UP' ? 44 : 72}px 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = t.css;
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(t.letter, 64, 68);
  ctx.shadowBlur = 6;
  ctx.fillStyle = t.css;
  ctx.fillText(t.letter, 64, 68);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  _texCache.set(type, tex);
  return tex;
}

class PowerUp {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    // 字母牌
    this.sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    );
    this.sprite.rotation.x = -Math.PI / 2.4;
    this.sprite.position.y = 0.9;
    // 发光核心
    this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), glowMat(0xffffff));
    this.core.position.y = 0.5;
    this.group.add(this.sprite, this.core);
    this.group.visible = false;
    game.scene.add(this.group);
    this.alive = false;
  }

  reset(type, x, z) {
    this.type = type;
    this.alive = true;
    this.age = 0;
    const t = TYPES[type];
    this.sprite.material.map = letterTexture(type);
    this.sprite.material.needsUpdate = true;
    this.core.material = glowMat(t.color);
    this.group.position.set(x, 0, z);
    this.group.visible = true;
  }
}

export class PowerUpManager {
  constructor(game) {
    this.game = game;
    this.active = [];
    this._free = [];
  }

  /** 按概率掉落 */
  dropRoll(x, z, chance) {
    if (Math.random() > chance) return;
    const total = DROP_TABLE.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    let type = 'medal';
    for (const [t, w] of DROP_TABLE) { r -= w; if (r <= 0) { type = t; break; } }
    this.spawn(type, x, z);
  }

  spawn(type, x, z) {
    if (this.active.length >= 24) return;
    const p = this._free.pop() || new PowerUp(this.game);
    p.reset(type, x, z);
    this.active.push(p);
  }

  apply(p) {
    const g = this.game;
    const pl = g.player;
    g.audio.powerup();
    g.effects.ring(p.group.position.x, 0.5, p.group.position.z, TYPES[p.type].color, 3, 0.35);
    switch (p.type) {
      case 'P': pl.powerUp(); break;
      case 'red': case 'blue': pl.switchWeapon(p.type); break;
      case 'B': pl.bombs = Math.min(pl.bombs + 1, 5); break;
      case 'S': pl.addShield(); break;
      case '1UP': pl.lives = Math.min(pl.lives + 1, 6); break;
      case 'medal': g.addScore(500); break;
    }
    g.hud.refresh();
  }

  update(dt) {
    const g = this.game;
    const pl = g.player;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.age += dt;
      const pos = p.group.position;
      // 缓慢下落 + 横向摆动
      pos.z += 2.6 * dt;
      pos.x += Math.sin(p.age * 2.2) * 0.7 * dt;
      p.core.rotation.y += dt * 3;
      p.core.position.y = 0.5 + Math.sin(p.age * 4) * 0.12;
      // 磁吸
      if (pl.alive) {
        const dx = pl.group.position.x - pos.x, dz = pl.group.position.z - pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 14) {
          const d = Math.sqrt(d2) || 1;
          const pull = 26 * dt;
          pos.x += (dx / d) * pull;
          pos.z += (dz / d) * pull;
        }
      }
      if (pos.z > g.bounds.maxZ + 3) {
        p.alive = false;
      }
      if (!p.alive) {
        p.group.visible = false;
        this.active.splice(i, 1);
        this._free.push(p);
      }
    }
  }

  clear() {
    for (const p of this.active) { p.group.visible = false; this._free.push(p); }
    this.active.length = 0;
  }
}
