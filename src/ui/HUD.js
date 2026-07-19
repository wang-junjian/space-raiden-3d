import { WEAPONS, MAX_WEAPON_LEVEL } from '../data/weapons.js';
import { LEVELS } from '../data/levels.js';

// HUD：DOM 元素管理
export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.elScore = document.getElementById('hud-score');
    this.elHi = document.getElementById('hud-hiscore');
    this.elLives = document.getElementById('hud-lives');
    this.elBombs = document.getElementById('hud-bombs');
    this.elWeapon = document.getElementById('hud-weapon');
    this.elShield = document.getElementById('hud-shield');
    this.elLevel = document.getElementById('hud-level');
    this.elBossBar = document.getElementById('boss-bar');
    this.elBossName = document.getElementById('boss-name');
    this.elBossHp = document.getElementById('boss-hp');
    this._lastScore = -1;
  }

  show() { this.root.classList.remove('hidden'); this.refresh(); }
  hide() { this.root.classList.add('hidden'); this.hideBoss(); }

  _fmt(n) { return String(n).padStart(8, '0'); }

  setScore(score, hiscore) {
    this.elScore.textContent = this._fmt(score);
    this.elHi.textContent = 'HI ' + this._fmt(hiscore);
  }

  refresh() {
    const g = this.game;
    const p = g.player;
    this.setScore(g.score, g.hiscore);
    this.elLives.textContent = p.lives > 0 ? '▲'.repeat(p.lives) : '—';
    this.elBombs.textContent = p.bombs > 0 ? '◆'.repeat(p.bombs) : '';
    // 武器
    const w = WEAPONS[p.weapon];
    const nameEl = this.elWeapon.querySelector('.wname');
    nameEl.textContent = w.name;
    nameEl.style.color = w.glow;
    const pips = this.elWeapon.querySelector('.pips');
    pips.style.color = w.glow;
    pips.innerHTML = '';
    for (let i = 0; i < MAX_WEAPON_LEVEL; i++) {
      const d = document.createElement('span');
      d.className = 'pip' + (i < p.weaponLevel ? ' on' : '');
      pips.appendChild(d);
    }
    // 护盾 / 关卡
    this.elShield.classList.toggle('on', p.shieldTime > 0);
    const lv = LEVELS[g.levelIndex];
    this.elLevel.textContent = `STAGE ${g.levelIndex + 1} · ${lv.name}`;
  }

  tick() {
    // 护盾状态变化时刷新（代价极小，每秒数次）
    const on = this.game.player.shieldTime > 0;
    if (on !== this._shieldWas) { this._shieldWas = on; this.elShield.classList.toggle('on', on); }
  }

  showBoss(name) {
    this.elBossName.textContent = name;
    this.elBossHp.style.width = '100%';
    this.elBossBar.classList.add('on');
  }

  setBossHp(frac) {
    this.elBossHp.style.width = (frac * 100).toFixed(1) + '%';
  }

  hideBoss() {
    this.elBossBar.classList.remove('on');
  }
}
