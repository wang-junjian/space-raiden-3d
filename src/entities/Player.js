import * as THREE from 'three';
import { buildPlayerShip, glowMat } from './ShipFactory.js';
import { WEAPONS, MAX_WEAPON_LEVEL } from '../data/weapons.js';

const START_POS = new THREE.Vector3(0, 0.5, 5.5);

export class Player {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.ship = buildPlayerShip();
    this.group.add(this.ship);

    // 护盾泡
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.7, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x40c8ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.shieldMesh.visible = false;
    this.group.add(this.shieldMesh);

    // 引擎点光（氛围）
    this.engineLight = new THREE.PointLight(0x40b8ff, 2.2, 7, 1.6);
    this.engineLight.position.set(0, 0.4, 1.4);
    this.group.add(this.engineLight);

    game.scene.add(this.group);

    this.radius = 0.7;
    this.speed = 19;
    this._fireTimer = 0;
    this._blink = 0;
    this._t = 0;
    this.reset(true);
  }

  reset(full = true) {
    if (full) {
      this.lives = 3;
      this.bombs = 3;
      this.weapon = 'red';
      this.weaponLevel = 1;
    }
    this.alive = true;
    this.invincible = 2.2;
    this.shieldTime = 0;
    this.group.position.copy(START_POS);
    this.group.visible = true;
    this.ship.rotation.set(0, 0, 0);
    this._fireTimer = 0;
  }

  respawn() {
    if (this.lives <= 0) return;
    this.alive = true;
    this.invincible = 3;
    this.shieldTime = 0;
    // 经典规则：死亡掉一级火力
    this.weaponLevel = Math.max(1, this.weaponLevel - 1);
    this.group.position.copy(START_POS);
    this.group.visible = true;
    this.game.hud.refresh();
  }

  get weaponCfg() {
    return WEAPONS[this.weapon].levels[this.weaponLevel - 1];
  }

  powerUp() {
    if (this.weaponLevel < MAX_WEAPON_LEVEL) {
      this.weaponLevel++;
    } else {
      this.game.addScore(500); // 满级转为分数
    }
    this.game.hud.refresh();
  }

  switchWeapon(type) {
    if (this.weapon !== type) {
      this.weapon = type;
    } else {
      this.powerUp();
    }
    this.game.hud.refresh();
  }

  addShield() {
    this.shieldTime = 8;
    this.game.audio.shieldUp();
    this.game.hud.refresh();
  }

  takeHit() {
    if (!this.alive || this.invincible > 0) return false;
    if (this.shieldTime > 0) {
      this.shieldTime = 0;
      this.game.effects.shieldPop(this.group.position);
      this.game.audio.shieldUp();
      this.invincible = 1.2;
      return false;
    }
    this.die();
    return true;
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.group.visible = false;
    this.lives--;
    this.game.effects.bigExplosion(this.group.position);
    this.game.audio.playerHit();
    this.game.audio.explosion(1.6);
    this.game.hud.refresh();
    this.game.onPlayerDeath();
  }

  update(dt) {
    if (!this.alive) return;
    const g = this.game;
    const pos = this.group.position;

    // ---- 移动 ----
    let mx = g.input.axisX, mz = g.input.axisZ;
    const td = g.input.consumeTouchDelta();
    if (td.x !== 0 || td.z !== 0) {
      pos.x += td.x;
      pos.z += td.z;
      mx = THREE.MathUtils.clamp(td.x * 3, -1, 1); // 倾斜反馈
      mz = THREE.MathUtils.clamp(td.z * 3, -1, 1);
    }
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz) || 1;
      pos.x += (mx / len) * this.speed * dt;
      pos.z += (mz / len) * this.speed * dt;
    }
    const b = g.bounds;
    pos.x = THREE.MathUtils.clamp(pos.x, b.minX + 1, b.maxX - 1);
    pos.z = THREE.MathUtils.clamp(pos.z, b.minZ + 2, b.maxZ - 1);

    // 倾斜姿态
    const targetRoll = -mx * 0.55;
    const targetPitch = mz * 0.28;
    this.ship.rotation.z += (targetRoll - this.ship.rotation.z) * Math.min(1, dt * 10);
    this.ship.rotation.x += (targetPitch - this.ship.rotation.x) * Math.min(1, dt * 10);

    // ---- 自动射击 ----
    const cfg = this.weaponCfg;
    this._fireTimer -= dt;
    if (this._fireTimer <= 0) {
      this._fireTimer = cfg.interval;
      const wcfg = WEAPONS[this.weapon];
      for (const s of cfg.shots) {
        g.playerBullets.spawn(
          pos.x + s.x, pos.z - 1.2,
          THREE.MathUtils.degToRad(s.angle), s.speed,
          { dmg: s.dmg, size: s.size, pierce: s.pierce ?? 0, color: wcfg.color },
        );
      }
      g.audio.shoot(this.weapon);
    }

    // ---- 引擎尾焰 ----
    for (const e of this.ship.userData.engines) {
      g.effects.trail(new THREE.Vector3(e.x + pos.x, 0.35, e.z + pos.z), 0x4fc8ff);
    }
    this._t += dt;
    this.engineLight.intensity = 1.8 + Math.sin(this._t * 26) * 0.35 + Math.random() * 0.35;

    // ---- 无敌闪烁 ----
    if (this.invincible > 0) {
      this.invincible -= dt;
      this._blink += dt * 20;
      this.ship.visible = Math.sin(this._blink) > -0.4;
      if (this.invincible <= 0) this.ship.visible = true;
    }

    // ---- 护盾 ----
    if (this.shieldTime > 0) {
      this.shieldTime -= dt;
      this.shieldMesh.visible = true;
      this.shieldMesh.material.opacity = 0.13 + 0.06 * Math.sin(performance.now() * 0.006);
      const s = 1 + 0.05 * Math.sin(performance.now() * 0.004);
      this.shieldMesh.scale.setScalar(s);
      if (this.shieldTime <= 0) { this.shieldMesh.visible = false; g.hud.refresh(); }
    }
  }
}
