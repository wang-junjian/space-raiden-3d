// 碰撞系统：XZ 平面圆形碰撞
export class CollisionSystem {
  constructor(game) {
    this.game = game;
  }

  update() {
    const g = this.game;
    if (!g.player.alive && g.enemies.count === 0 && !g.bosses.active) return;
    this._playerBulletsVsEnemies();
    this._playerBulletsVsBoss();
    this._enemyBulletsVsPlayer();
    this._enemiesVsPlayer();
    this._powerupsVsPlayer();
  }

  _playerBulletsVsEnemies() {
    const g = this.game;
    const bl = g.playerBullets.list;
    const enemies = g.enemies.active;
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i];
      let removed = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = b.x - e.pos.x, dz = b.z - e.pos.z;
        const rr = b.r + e.radius;
        if (dx * dx + dz * dz > rr * rr) continue;
        if (b.hitIds && b.hitIds.has(e.id)) continue;
        // 命中
        const dead = e.takeDamage(b.dmg, { x: b.x, y: 0.4, z: b.z });
        if (b.pierce > 0) {
          b.pierce--;
          if (!b.hitIds) b.hitIds = new Set();
          b.hitIds.add(e.id);
        } else {
          g.playerBullets.remove(i);
          removed = true;
        }
        if (dead) g.shake(0.12, 0.12);
        if (removed) break;
      }
    }
  }

  _playerBulletsVsBoss() {
    const g = this.game;
    const boss = g.bosses.current;
    if (!boss || !boss.alive) return;
    const bl = g.playerBullets.list;
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i];
      // 炮塔部件
      let hit = false;
      for (const part of boss.parts) {
        if (!part.alive) continue;
        const dx = b.x - part.wx, dz = b.z - part.wz;
        const rr = b.r + part.radius;
        if (dx * dx + dz * dz > rr * rr) continue;
        boss.damagePart(part, b.dmg, { x: b.x, y: 0.5, z: b.z });
        hit = true;
        break;
      }
      if (!hit) {
        const dx = b.x - boss.pos.x, dz = b.z - boss.pos.z;
        const rr = b.r + boss.radius;
        if (dx * dx + dz * dz <= rr * rr) {
          boss.takeDamage(b.dmg, { x: b.x, y: 0.5, z: b.z });
          hit = true;
        }
      }
      if (hit) {
        if (b.pierce > 0) b.pierce--;
        else g.playerBullets.remove(i);
      }
    }
  }

  _enemyBulletsVsPlayer() {
    const g = this.game;
    const p = g.player;
    if (!p.alive || p.invincible > 0) return;
    const pos = p.group.position;
    const bl = g.enemyBullets.list;
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i];
      const dx = b.x - pos.x, dz = b.z - pos.z;
      const rr = b.r + p.radius;
      if (dx * dx + dz * dz > rr * rr) continue;
      g.enemyBullets.remove(i);
      p.takeHit();
      break;
    }
  }

  _enemiesVsPlayer() {
    const g = this.game;
    const p = g.player;
    if (!p.alive || p.invincible > 0) return;
    const pos = p.group.position;
    for (const e of g.enemies.active) {
      if (!e.alive) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      const rr = e.radius + p.radius;
      if (dx * dx + dz * dz > rr * rr) continue;
      e.die();
      p.takeHit();
      break;
    }
  }

  _powerupsVsPlayer() {
    const g = this.game;
    const p = g.player;
    if (!p.alive) return;
    const pos = p.group.position;
    for (const pu of g.powerups.active) {
      if (!pu.alive) continue;
      const dx = pu.group.position.x - pos.x, dz = pu.group.position.z - pos.z;
      if (dx * dx + dz * dz > 1.8 * 1.8) continue;
      pu.alive = false;
      g.powerups.apply(pu);
    }
  }
}
