import { STATE } from '../core/Game.js';
import { LEVELS } from '../data/levels.js';

// 界面管理：标题 / 暂停 / 结算 / 横幅
export class Screens {
  constructor(game) {
    this.game = game;
    this.title = document.getElementById('screen-title');
    this.pause = document.getElementById('screen-pause');
    this.over = document.getElementById('screen-over');
    this.clear = document.getElementById('screen-clear');
    this.victory = document.getElementById('screen-victory');
    this.bannerEl = document.getElementById('banner');
    this._bannerTimer = null;

    // 覆盖层点击 = 确认键（触屏友好）
    for (const el of [this.title, this.over, this.clear, this.victory]) {
      el.addEventListener('click', () => { game.input.confirmPressed = true; });
    }
  }

  hideAll() {
    for (const el of [this.title, this.pause, this.over, this.clear, this.victory]) {
      el.classList.add('hidden');
    }
  }

  showTitle() {
    this.hideAll();
    this.game.hud.hide();
    document.getElementById('hiscore-title').textContent =
      this.game.hiscore > 0 ? `HI-SCORE ${this.game.hiscore}` : '';
    this.title.classList.remove('hidden');
    this.game.setState(STATE.TITLE);
  }

  showPause() {
    this.hideAll();
    this.pause.classList.remove('hidden');
  }

  _fillStats(el, rows) {
    el.querySelector('.panel-stats').innerHTML = rows.join('<br/>');
    // 新纪录标记
    const old = el.querySelector('.new-record');
    if (old) old.remove();
  }

  _maybeRecord(el, score, hiscore) {
    if (score > 0 && score >= hiscore) {
      const d = document.createElement('div');
      d.className = 'new-record';
      d.textContent = '★ NEW RECORD ★';
      el.querySelector('.panel-stats').insertAdjacentElement('afterend', d);
    }
  }

  showOver(score, hiscore) {
    this.hideAll();
    this._fillStats(this.over, [`击坠得分 <b>${score}</b>`, `最高纪录 ${hiscore}`]);
    this._maybeRecord(this.over, score, hiscore);
    this.over.classList.remove('hidden');
  }

  showClear(score, hiscore, bonus, levelIdx) {
    this.hideAll();
    this._fillStats(this.clear, [
      `区域奖励 <b>+${bonus}</b>`,
      `当前得分 <b>${score}</b>`,
      `下一空域 ${LEVELS[levelIdx + 1] ? LEVELS[levelIdx + 1].name : '未知'}`,
    ]);
    this._maybeRecord(this.clear, score, hiscore);
    this.clear.classList.remove('hidden');
  }

  showVictory(score, hiscore, bonus) {
    this.hideAll();
    this._fillStats(this.victory, [
      '湮灭舰队旗舰已被摧毁，银河重归安宁。',
      bonus > 0 ? `最终奖励 <b>+${bonus}</b><br/>最终得分 <b>${score}</b>` : `最终得分 <b>${score}</b>`,
      `最高纪录 ${hiscore}`,
    ]);
    this._maybeRecord(this.victory, score, hiscore);
    this.victory.classList.remove('hidden');
  }

  /** 中央横幅（关卡名 / 警告） */
  banner(main, sub = '') {
    this.bannerEl.innerHTML = `${main}${sub ? `<div class="sub">${sub}</div>` : ''}`;
    this.bannerEl.classList.add('show');
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => this.bannerEl.classList.remove('show'), 2400);
  }
}
