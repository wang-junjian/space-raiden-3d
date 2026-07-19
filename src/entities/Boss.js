import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Boss 基类：多阶段 + 可破坏炮塔部件 + 血条
// 子类实现 build() 与 combat(dt)
// ---------------------------------------------------------------------------
export class Boss {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.parts = [];       // { key, group, ox, oz, radius, hp, maxHp, alive, wx, wz, fireT }
    this.radius = 3;       // 核心碰撞半径
    this.alive = false;
    this.entering = false;
    this.age = 0;
    this.phase = 0;
    this.anchorZ = -12;
    this._streamT = 0;
    this._spawnT = 0;
    // Boss 随身光：让大型敌舰在暗星云中保持立体感
    this.bossLight = new THREE.PointLight(0xffffff, 0, 30, 1.5);
    this.bossLight.position.set(0, 4, 0);
    this.group.add(this.bossLight);
    game.scene.add(this.group);
    this.build();
    this.group.visible = false;
  }

  build() {}             // 子类：搭建模型、注册 parts
  combat(dt) {}          // 子类：阶段逻辑与开火

  get pos() { return this.group.position; }

  addPart(key, group, ox, oz, radius, hp) {
    group.position.set(ox, 0, oz);
    this.group.add(group);
    this.parts.push({ key, group, ox, oz, radius, hp, maxHp: hp, alive: true, wx: ox, wz: oz, fireT: 1 + Math.random() });
  }

  spawn() {
    this.alive = true;
    this.entering = true;
    this.hp = this.maxHp;
    this.age = 0;
    this.phase = 0;
    this.group.position.set(0, 0.5, this.game.spawnZ - 14);
    this.group.visible = true;
    for (const p of this.parts) {
      p.alive = true; p.hp = p.maxHp; p.group.visible = true;
    }
    this.bossLight.intensity = 7;
    this.game.hud.showBoss(this.name);
  }

  _aimFrom(x, z) {
    const t = this.game.player.group.position;
    return Math.atan2(t.x - x, -(t.z - z));
  }

  takeDamage(dmg, hitPos) {
    if (!this.alive) return;
    this.hp -= dmg;
    if (hitPos) this.game.effects.hitSpark(hitPos, 0xaad4ff);
    this.game.audio.hit();
    this.game.hud.setBossHp(Math.max(0, this.hp / this.maxHp));
    if (this.hp <= 0) this.die();
  }

  damagePart(part, dmg, hitPos) {
    if (!this.alive || !part.alive) return;
    part.hp -= dmg;
    if (hitPos) this.game.effects.hitSpark(hitPos, 0xffe0a0);
    this.game.audio.hit();
    if (part.hp <= 0) {
      part.alive = false;
      part.group.visible = false;
      this.game.effects.explosion({ x: part.wx, y: 0.6, z: part.wz }, 0xffa050, 1.4);
      this.game.audio.explosion(1.3);
      this.game.addScore(600);
      this.game.shake(0.35, 0.3);
    }
  }

  die() {
    this.alive = false;
    const g = this.game;
    g.enemyBullets.clearAll(); // 击杀瞬间清弹，给玩家喘息
    g.effects.bigExplosion(this.pos);
    // 连锁爆炸
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (g.state === 'playing') {
          g.effects.explosion(
            { x: this.pos.x + (Math.random() - 0.5) * 6, y: 0.6, z: this.pos.z + (Math.random() - 0.5) * 6 },
            [0xff6030, 0xffa040, 0xffe080][i % 3], 1.8);
          g.audio.explosion(1.5);
        }
      }, 200 + i * 220);
    }
    g.audio.bossDown();
    g.addScore(this.scoreValue);
    g.shake(1.5, 1.0);
    g.hud.hideBoss();
    this.bossLight.intensity = 0;
    this.group.visible = false;
  }

  update(dt) {
    if (!this.alive) return;
    this.age += dt;
    const p = this.pos;

    if (this.entering) {
      p.z += 5.5 * dt;
      if (p.z >= this.anchorZ) { p.z = this.anchorZ; this.entering = false; }
    } else {
      this.combat(dt);
    }

    // 更新部件世界坐标（含环绕运动，ox/oz 可能被子类改写）
    for (const part of this.parts) {
      part.group.position.set(part.ox, 0, part.oz);
      part.wx = p.x + part.ox;
      part.wz = p.z + part.oz;
    }
  }
}
