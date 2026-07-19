import * as THREE from 'three';
import { Boss } from './Boss.js';
import { bodyMat, glowMat } from './ShipFactory.js';

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// ---------------------------------------------------------------------------
// Boss 1：哨戒巡洋舰 —— 双炮塔 + 主炮，半血狂暴
// ---------------------------------------------------------------------------
export class CruiserBoss extends Boss {
  constructor(game) {
    super(game);
    this.name = '哨戒巡洋舰 · SENTINEL CRUISER';
    this.maxHp = 950;
    this.scoreValue = 8000;
    this.radius = 2.9;
    this.anchorZ = -12;
  }

  build() {
    const steel = bodyMat(0x6a7488, { metalness: 0.8, roughness: 0.32 });
    const dark = bodyMat(0x3a4358, { metalness: 0.7, roughness: 0.42 });
    this.bossLight.color.set(0xff8060);

    // 主舰体（舰首朝 +Z 面向玩家）
    const hull = mesh(new THREE.BoxGeometry(3.4, 1.1, 7.6), steel);
    this.group.add(hull);
    // 甲板发光带
    const deckGlow = mesh(new THREE.BoxGeometry(2.6, 0.08, 6.8), glowMat(0x8a97b8), 0, 0.58, 0);
    this.group.add(deckGlow);
    const nose = mesh(new THREE.ConeGeometry(1.55, 3, 4), dark, 0, 0, 5.2);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    this.group.add(nose);
    // 舰桥
    const bridge = mesh(new THREE.BoxGeometry(1.7, 0.9, 2.4), dark, 0, 0.95, -1);
    this.group.add(bridge);
    const bridgeLight = mesh(new THREE.BoxGeometry(1.2, 0.18, 0.18), glowMat(0xff4040), 0, 1.1, 0.3);
    this.group.add(bridgeLight);
    // 舷灯
    for (const s of [-1, 1]) {
      const strip = mesh(new THREE.BoxGeometry(0.12, 0.12, 6.5), glowMat(0xff6040), s * 1.75, 0.2, 0);
      this.group.add(strip);
      // 引擎（舰尾 -Z）
      const eng = mesh(new THREE.CylinderGeometry(0.55, 0.65, 1, 8), dark, s * 1.1, 0, -4.1);
      eng.rotation.x = Math.PI / 2;
      this.group.add(eng);
      const noz = mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.2, 8), glowMat(0x60c0ff), s * 1.1, 0, -4.65);
      noz.rotation.x = Math.PI / 2;
      this.group.add(noz);
    }
    // 主炮（指向玩家）
    const cannon = mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.2, 8), bodyMat(0x3a4256), 0, 0.3, 4.6);
    cannon.rotation.x = Math.PI / 2;
    this.group.add(cannon);
    const muzzle = mesh(new THREE.SphereGeometry(0.3, 8, 6), glowMat(0xff7040), 0, 0.3, 5.6);
    this.group.add(muzzle);

    // 双炮塔部件
    for (const s of [-1, 1]) {
      const t = new THREE.Group();
      const base = mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.5, 8), dark);
      t.add(base);
      const dome = mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), steel, 0, 0.25, 0);
      t.add(dome);
      const barrel = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 6), glowMat(0xff9060), 0, 0.4, 0.9);
      barrel.rotation.x = Math.PI / 2;
      t.add(barrel);
      this.addPart(s < 0 ? 'turretL' : 'turretR', t, s * 2.7, 0, 1.5, 1.05, 150);
    }
  }

  combat(dt) {
    const g = this.game, p = this.pos;
    const p2 = this.hp < this.maxHp * 0.5;
    if (p2 && this.phase === 0) {
      this.phase = 1;
      g.screens.banner('⚠', '敌舰火力增强');
      g.audio.bossWarn();
    }

    p.x = Math.sin(this.age * (p2 ? 0.85 : 0.5)) * 6.5;

    // 炮塔三连
    for (const part of this.parts) {
      if (!part.alive) continue;
      part.fireT -= dt;
      if (part.fireT <= 0) {
        part.fireT = p2 ? 1.8 : 2.6;
        const a = this._aimFrom(part.wx, part.wz);
        for (let i = -1; i <= 1; i++) {
          g.enemyBullets.spawn(part.wx, part.wz + 0.8, a + i * 0.1, 13, { dmg: 10, color: 0xff8060, size: 1 });
        }
        g.audio.enemyShoot();
      }
    }

    // 主炮扇形
    this._streamT -= dt;
    if (this._streamT <= 0) {
      this._streamT = p2 ? 2.4 : 3.6;
      const a = this._aimFrom(p.x, p.z + 2);
      const n = p2 ? 7 : 5;
      for (let i = 0; i < n; i++) {
        g.enemyBullets.spawn(p.x, p.z + 2.2, a + (i - (n - 1) / 2) * 0.17, 12, { dmg: 10, color: 0xff5040, size: 1.2 });
      }
      g.audio.enemyShoot();
    }

    // 狂暴后召唤侦察机
    if (p2) {
      this._spawnT -= dt;
      if (this._spawnT <= 0) {
        this._spawnT = 9;
        for (const s of [-1, 1]) g.enemies.spawn('scout', p.x + s * 5, p.z - 3);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Boss 2：虚空拦截者 —— 高速机动 + 螺旋弹幕
// ---------------------------------------------------------------------------
export class VoidBoss extends Boss {
  constructor(game) {
    super(game);
    this.name = '虚空拦截者 · VOID INTERCEPTOR';
    this.maxHp = 1300;
    this.scoreValue = 12000;
    this.radius = 2.4;
    this.anchorZ = -11;
  }

  build() {
    const hullMat = bodyMat(0x3a2458, { metalness: 0.85, roughness: 0.25 });
    const dark = bodyMat(0x241640, { metalness: 0.8, roughness: 0.3 });
    this.bossLight.color.set(0xb060ff);

    const fus = mesh(new THREE.ConeGeometry(0.95, 4.4, 6), hullMat, 0, 0, 0);
    fus.rotation.x = Math.PI / 2; // 机头朝 +Z（面向玩家）
    this.group.add(fus);
    const cockpit = mesh(new THREE.SphereGeometry(0.4, 12, 8), glowMat(0xd080ff), 0, 0.35, -0.4);
    cockpit.scale.set(0.7, 0.5, 1.5);
    this.group.add(cockpit);
    // 前掠巨翼
    for (const s of [-1, 1]) {
      const wing = mesh(new THREE.BoxGeometry(2.6, 0.14, 1.3), dark, s * 1.7, 0, 0.6);
      wing.rotation.y = s * 0.5;
      this.group.add(wing);
      const tip = mesh(new THREE.BoxGeometry(0.2, 0.18, 1.1), glowMat(0xb050ff), s * 3.0, 0, 1.15);
      tip.rotation.y = s * 0.5;
      this.group.add(tip);
      const eng = mesh(new THREE.CylinderGeometry(0.3, 0.36, 1.1, 8), hullMat, s * 0.75, 0, -2.1);
      eng.rotation.x = Math.PI / 2;
      this.group.add(eng);
      const noz = mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.18, 8), glowMat(0x9060ff), s * 0.75, 0, -2.7);
      noz.rotation.x = Math.PI / 2;
      this.group.add(noz);
    }
    // 能量爪
    for (const s of [-1, 1]) {
      const claw = mesh(new THREE.BoxGeometry(0.16, 0.16, 1.6), glowMat(0xe060ff), s * 0.5, 0, 2.2);
      claw.rotation.y = -s * 0.25;
      this.group.add(claw);
    }
    this._spiralA = 0;
  }

  combat(dt) {
    const g = this.game, p = this.pos;
    const p2 = this.hp < this.maxHp * 0.55;
    if (p2 && this.phase === 0) {
      this.phase = 1;
      g.screens.banner('⚠', '拦截者解除限制');
      g.audio.bossWarn();
    }

    // 高速穿梭
    p.x = Math.sin(this.age * (p2 ? 1.45 : 1.0)) * 9;
    p.z = this.anchorZ + Math.sin(this.age * 0.7) * 2.5;
    this.group.rotation.z = -Math.cos(this.age * (p2 ? 1.45 : 1.0)) * 0.35;

    // 螺旋弹幕
    this._streamT -= dt;
    if (this._streamT <= 0) {
      this._streamT = p2 ? 0.09 : 0.13;
      this._spiralA += p2 ? 0.46 : 0.35;
      g.enemyBullets.spawn(p.x, p.z + 1, this._spiralA, 11, { dmg: 10, color: 0xc060ff, size: 1 });
      g.enemyBullets.spawn(p.x, p.z + 1, this._spiralA + Math.PI, 11, { dmg: 10, color: 0xc060ff, size: 1 });
    }

    // 瞄准三连
    this._aimT = (this._aimT ?? 1.6) - dt;
    if (this._aimT <= 0) {
      this._aimT = p2 ? 1.5 : 2.1;
      const a = this._aimFrom(p.x, p.z);
      for (let i = -1; i <= 1; i++) {
        g.enemyBullets.spawn(p.x, p.z + 1.4, a + i * 0.09, 16, { dmg: 10, color: 0xe090ff, size: 1 });
      }
      g.audio.enemyShoot();
    }

    // 环形爆发
    if (p2) {
      this._ringT = (this._ringT ?? 2.5) - dt;
      if (this._ringT <= 0) {
        this._ringT = 3.0;
        for (let i = 0; i < 16; i++) {
          g.enemyBullets.spawn(p.x, p.z, (i / 16) * Math.PI * 2 + this.age, 9, { dmg: 10, color: 0xff60d0, size: 1.1 });
        }
        g.audio.enemyShoot();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Boss 3：湮灭核心 —— 环绕炮塔 + 旋转弹幕，三阶段最终战
// ---------------------------------------------------------------------------
export class CoreBoss extends Boss {
  constructor(game) {
    super(game);
    this.name = '湮灭核心 · ANNIHILATION CORE';
    this.maxHp = 1900;
    this.scoreValue = 20000;
    this.radius = 3.0;
    this.anchorZ = -12;
    this.orbit = 0;
  }

  build() {
    const dark = bodyMat(0x401c22, { metalness: 0.85, roughness: 0.3 });
    this.bossLight.color.set(0xff4030);

    // 核心球体（红热裂纹感：自发光内球 + 外壳）
    this.coreMat = new THREE.MeshStandardMaterial({
      color: 0x58161a, metalness: 0.6, roughness: 0.35,
      emissive: 0xff2a20, emissiveIntensity: 0.9,
    });
    const core = mesh(new THREE.SphereGeometry(2.0, 24, 18), this.coreMat, 0, 0.4, 0);
    this.group.add(core);
    const shell = mesh(new THREE.SphereGeometry(2.25, 8, 6), bodyMat(0x1a0c0e, { metalness: 0.9, roughness: 0.4 }), 0, 0.4, 0);
    shell.material.wireframe = true;
    this.group.add(shell);
    this._shell = shell;

    // 外环
    const ring = mesh(new THREE.TorusGeometry(3.1, 0.22, 10, 40), dark, 0, 0.4, 0);
    ring.rotation.x = Math.PI / 2;
    this.group.add(ring);
    this._ring = ring;

    // 环绕炮塔 ×4
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Group();
      const pod = mesh(new THREE.OctahedronGeometry(0.62), dark);
      pod.scale.set(1, 0.6, 1.2);
      t.add(pod);
      const eye = mesh(new THREE.SphereGeometry(0.22, 8, 6), glowMat(0xff4030), 0, 0.1, 0.5);
      t.add(eye);
      const part = this.addPart('orb' + i, t, 0, 0, 0.95, 140);
      this.parts[this.parts.length - 1].fireT = 0.6 + i * 0.55; // 交错开火
      void part;
    }
  }

  combat(dt) {
    const g = this.game, p = this.pos;
    const frac = this.hp / this.maxHp;
    const p2 = frac < 0.66, p3 = frac < 0.33;
    if (p2 && this.phase === 0) {
      this.phase = 1;
      g.screens.banner('⚠', '核心外壳剥离');
      g.audio.bossWarn();
      g.effects.explosion(p, 0xff5040, 1.6);
    }
    if (p3 && this.phase === 1) {
      this.phase = 2;
      g.screens.banner('⚠ ⚠', '核心过载 · 最终形态');
      g.audio.bossWarn();
      g.effects.explosion(p, 0xff3020, 2);
      g.shake(0.8, 0.6);
    }

    // 机动：缓慢摇摆；最终阶段追踪玩家
    if (p3) {
      const px = g.player.group.position.x;
      p.x += THREE.MathUtils.clamp(px - p.x, -1, 1) * 3.2 * dt;
      p.x = THREE.MathUtils.clamp(p.x, -8, 8);
    } else {
      p.x = Math.sin(this.age * 0.4) * 5;
    }
    this._ring.rotation.z += dt * (p3 ? 1.6 : 0.7);
    this._shell.rotation.y += dt * 0.8;
    this.coreMat.emissiveIntensity = (p3 ? 1.6 : 0.9) + Math.sin(this.age * 4) * 0.35;

    // 环绕炮塔
    const orbitSpeed = p3 ? 1.5 : p2 ? 1.0 : 0.65;
    this.orbit += dt * orbitSpeed;
    for (let i = 0; i < this.parts.length; i++) {
      const part = this.parts[i];
      const a = this.orbit + (i / this.parts.length) * Math.PI * 2;
      part.ox = Math.cos(a) * 4.4;
      part.oz = Math.sin(a) * 4.4;
      if (!part.alive) continue;
      part.fireT -= dt;
      if (part.fireT <= 0) {
        part.fireT = p3 ? 1.7 : 2.3;
        const ang = this._aimFrom(part.wx, part.wz);
        g.enemyBullets.spawn(part.wx, part.wz, ang, 14, { dmg: 10, color: 0xff6040, size: 1 });
        g.audio.enemyShoot();
      }
    }

    // 旋转四臂弹幕
    this._streamT -= dt;
    if (this._streamT <= 0) {
      this._streamT = p3 ? 0.11 : 0.16;
      this._rotA = (this._rotA || 0) + 0.3;
      for (let k = 0; k < 4; k++) {
        g.enemyBullets.spawn(p.x, p.z, this._rotA + (k / 4) * Math.PI * 2, 10, { dmg: 10, color: 0xff4030, size: 1.05 });
      }
    }

    // 扇形齐射
    if (p2) {
      this._fanT = (this._fanT ?? 3) - dt;
      if (this._fanT <= 0) {
        this._fanT = 4.0;
        const a = this._aimFrom(p.x, p.z);
        for (let i = 0; i < 9; i++) {
          g.enemyBullets.spawn(p.x, p.z + 1, a + (i - 4) * 0.14, 13, { dmg: 10, color: 0xffa040, size: 1.1 });
        }
        g.audio.enemyShoot();
      }
    }

    // 最终阶段环形爆发
    if (p3) {
      this._ringT = (this._ringT ?? 2) - dt;
      if (this._ringT <= 0) {
        this._ringT = 2.6;
        for (let i = 0; i < 18; i++) {
          g.enemyBullets.spawn(p.x, p.z, (i / 18) * Math.PI * 2 + this.orbit, 9.5, { dmg: 10, color: 0xff3020, size: 1.15 });
        }
        g.audio.enemyShoot();
      }
    }
  }
}
