import { CruiserBoss, VoidBoss, CoreBoss } from './bosses.js';

// ---------------------------------------------------------------------------
const BOSS_CLASSES = { cruiser: CruiserBoss, void: VoidBoss, core: CoreBoss };

export class BossManager {
  constructor(game) {
    this.game = game;
    this.current = null;
    this._clearTimer = -1;
  }

  spawnBoss(type) {
    const Cls = BOSS_CLASSES[type];
    this.current = new Cls(this.game);
    this.current.spawn();
    this._clearTimer = -1;
  }

  get active() { return !!(this.current && this.current.alive); }

  update(dt) {
    if (this.current) {
      this.current.update(dt);
      if (!this.current.alive && this._clearTimer < 0) {
        this._clearTimer = 2.6; // 观赏爆炸后过关
      }
    }
    if (this._clearTimer > 0) {
      this._clearTimer -= dt;
      if (this._clearTimer <= 0) {
        this.current = null;
        this.game.onLevelCleared();
      }
    }
  }

  /** 炸弹对 Boss 核心与炮塔造成伤害 */
  damage(n) {
    if (!this.active) return;
    for (const part of this.current.parts) this.current.damagePart(part, n, null);
    this.current.takeDamage(n, null);
  }

  clear() {
    if (this.current) {
      this.current.alive = false;
      this.current.group.removeFromParent();
      this.current = null;
    }
    this._clearTimer = -1;
    this.game.hud.hideBoss();
  }
}
