import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Input } from './Input.js';
import { AudioManager } from './AudioManager.js';
import { SpaceEnvironment } from '../world/SpaceEnvironment.js';
import { Player } from '../entities/Player.js';
import { BulletSystem } from '../entities/Bullets.js';
import { Effects } from '../entities/Effects.js';
import { EnemyManager } from '../entities/Enemy.js';
import { BossManager } from '../entities/BossManager.js';
import { PowerUpManager } from '../entities/PowerUp.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { LEVELS } from '../data/levels.js';
import { HUD } from '../ui/HUD.js';
import { Screens } from '../ui/Screens.js';

export const STATE = {
  TITLE: 'title', PLAYING: 'playing', PAUSED: 'paused',
  OVER: 'over', CLEAR: 'clear', VICTORY: 'victory',
};

const HISCORE_KEY = 'space-raiden-3d-hiscore';

function loadHiscore() {
  try { return parseInt(localStorage.getItem(HISCORE_KEY) || '0', 10); } catch { return 0; }
}
function saveHiscore(v) {
  try { localStorage.setItem(HISCORE_KEY, String(v)); } catch { /* 隐私模式等场景忽略 */ }
}

export class Game {
  constructor(canvas) {
    // ---- 渲染基础 ----
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x01030a);
    this.scene.fog = new THREE.Fog(0x02040c, 55, 160);

    this.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 400);
    this._camBase = new THREE.Vector3(0, 34, 15);
    this._camLook = new THREE.Vector3(0, 0, -3);
    this.camera.position.copy(this._camBase);
    this.camera.lookAt(this._camLook);

    // 灯光
    this.scene.add(new THREE.AmbientLight(0x334466, 1.4));
    const key = new THREE.DirectionalLight(0xbfd8ff, 2.2);
    key.position.set(6, 20, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6a4dff, 1.1);
    rim.position.set(-8, 12, -14);
    this.scene.add(rim);

    // 泛光后期
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.55, 0.5);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // ---- 玩法区域（XZ 平面） ----
    this.bounds = { minX: -13, maxX: 13, minZ: -19, maxZ: 8.5 };
    this.spawnZ = -24;           // 敌机入场线（屏幕上方之外）

    // ---- 子系统 ----
    this.input = new Input(canvas);
    this.audio = new AudioManager();
    this.environment = new SpaceEnvironment(this);
    this.effects = new Effects(this);
    this.playerBullets = new BulletSystem(this, { isPlayer: true, capacity: 320 });
    this.enemyBullets = new BulletSystem(this, { isPlayer: false, capacity: 900 });
    this.enemies = new EnemyManager(this);
    this.bosses = new BossManager(this);
    this.powerups = new PowerUpManager(this);
    this.waves = new WaveSystem(this);
    this.collision = new CollisionSystem(this);
    this.player = new Player(this);
    this.hud = new HUD(this);
    this.screens = new Screens(this);

    // ---- 运行状态 ----
    this.state = STATE.TITLE;
    this.score = 0;
    this.hiscore = loadHiscore();
    this.levelIndex = 0;
    this.timeScale = 1;
    this._pendingAction = null;  // 延时动作 { t, fn }
    this._shakeTime = 0; this._shakeDuration = 0; this._shakeIntensity = 0;

    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this._onResize());
    this._onResize();

    this.screens.showTitle();
  }

  // ---------------- 状态机 ----------------
  setState(s) {
    this.state = s;
  }

  start() {
    this.renderer.setAnimationLoop(() => this._frame());
  }

  /** 开始/重开一局；levelIdx=0 表示新游戏（清分数） */
  startRun(levelIdx = 0, keepScore = false) {
    this.audio.init();
    this.levelIndex = levelIdx;
    if (!keepScore) this.score = 0;
    this._pendingAction = null;
    this.timeScale = 1;

    this.enemies.clear();
    this.bosses.clear();
    this.powerups.clear();
    this.playerBullets.clearAll();
    this.enemyBullets.clearAll();
    this.effects.clear();

    this.player.reset(levelIdx === 0 || !keepScore);
    this.environment.setLevel(levelIdx);
    this.waves.startLevel(levelIdx);

    this.screens.hideAll();
    this.hud.show();
    this.hud.refresh();
    const lv = LEVELS[levelIdx];
    this.screens.banner(`STAGE ${levelIdx + 1}`, lv.name);
    this.audio.startMusic(levelIdx);
    this.setState(STATE.PLAYING);
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) { this.onVictory(); return; }
    // 过关奖励：保留分数、武器等级，补 1 颗炸弹
    this.player.bombs = Math.min(this.player.bombs + 1, 5);
    this.startRun(this.levelIndex + 1, true);
  }

  onLevelCleared() {
    const bonus = 5000 * (this.levelIndex + 1);
    this.addScore(bonus);
    this.audio.stopMusic();
    this._saveHiscore();
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.setState(STATE.VICTORY);
      this.screens.showVictory(this.score, this.hiscore, bonus);
    } else {
      this.setState(STATE.CLEAR);
      this.screens.showClear(this.score, this.hiscore, bonus, this.levelIndex);
    }
  }

  onVictory() {
    this.audio.stopMusic();
    this._saveHiscore();
    this.setState(STATE.VICTORY);
    this.screens.showVictory(this.score, this.hiscore, 0);
  }

  onGameOver() {
    this.audio.stopMusic();
    this._saveHiscore();
    this.setState(STATE.OVER);
    this.screens.showOver(this.score, this.hiscore);
  }

  /** 玩家死亡回调（由 Player 触发） */
  onPlayerDeath() {
    this.shake(0.9, 0.5);
    this.timeScale = 0.25; // 死亡慢动作
    if (this.player.lives > 0) {
      this._pendingAction = { t: 1.4, fn: () => { this.player.respawn(); this.timeScale = 1; } };
    } else {
      this._pendingAction = { t: 1.8, fn: () => { this.timeScale = 1; this.onGameOver(); } };
    }
  }

  addScore(n) {
    this.score += n;
    if (this.score > this.hiscore) this.hiscore = this.score;
    this.hud.setScore(this.score, this.hiscore);
  }

  _saveHiscore() {
    saveHiscore(this.hiscore);
  }

  /** 全屏炸弹 */
  useBomb() {
    if (this.player.bombs <= 0 || !this.player.alive) return;
    this.player.bombs--;
    this.hud.refresh();
    this.audio.bomb();
    this.shake(1.2, 0.7);
    this.effects.bombBlast(this.player.group.position);
    // 清屏敌弹 + 全屏伤害
    this.enemyBullets.clearAll();
    this.enemies.damageAll(70);
    this.bosses.damage(50);
  }

  shake(intensity, duration) {
    this._shakeIntensity = Math.max(this._shakeIntensity, intensity);
    this._shakeDuration = this._shakeTime = Math.max(this._shakeTime, duration);
  }

  togglePause() {
    if (this.state === STATE.PLAYING) {
      this.setState(STATE.PAUSED);
      this.screens.showPause();
      if (this.audio.ctx) this.audio.ctx.suspend();
    } else if (this.state === STATE.PAUSED) {
      this.setState(STATE.PLAYING);
      this.screens.hideAll();
      if (this.audio.ctx) this.audio.ctx.resume();
    }
  }

  // ---------------- 帧循环 ----------------
  _frame() {
    let dt = Math.min(this.clock.getDelta(), 0.05);
    const rawDt = dt;
    dt *= this.timeScale;

    this.input.poll();

    // 全局按键
    if (this.input.consumePause() && (this.state === STATE.PLAYING || this.state === STATE.PAUSED)) {
      this.togglePause();
    }
    if (this.input.consumeConfirm()) {
      if (this.state === STATE.TITLE) this.startRun(0);
      else if (this.state === STATE.OVER) this.startRun(0);
      else if (this.state === STATE.CLEAR) this.nextLevel();
      else if (this.state === STATE.VICTORY) { this.setState(STATE.TITLE); this.screens.showTitle(); }
    }

    // 延时动作（慢动作期间用真实时间推进，保证节奏感）
    if (this._pendingAction) {
      this._pendingAction.t -= rawDt;
      if (this._pendingAction.t <= 0) { const fn = this._pendingAction.fn; this._pendingAction = null; fn(); }
    }

    // 场景常动（标题界面也有氛围）
    const active = this.state !== STATE.PAUSED;
    if (active) {
      const scrollSpeed = this.state === STATE.PLAYING ? LEVELS[this.levelIndex].scrollSpeed : 4;
      this.environment.update(dt, scrollSpeed);
      this.effects.update(dt);
    }

    if (this.state === STATE.PLAYING) {
      this.player.update(dt);
      if (this.input.consumeBomb()) this.useBomb();
      this.waves.update(dt);
      this.enemies.update(dt);
      this.bosses.update(dt);
      this.powerups.update(dt);
      this.playerBullets.update(dt);
      this.enemyBullets.update(dt);
      this.collision.update();
      this.hud.tick();
    } else if (this.state !== STATE.PAUSED) {
      // 非战斗状态下也推进已发射的子弹与特效，画面不死
      this.playerBullets.update(dt);
      this.enemyBullets.update(dt);
    }

    // 相机震动
    if (this._shakeTime > 0) {
      this._shakeTime -= rawDt;
      const k = this._shakeIntensity * (this._shakeTime / this._shakeDuration);
      this.camera.position.set(
        this._camBase.x + (Math.random() - 0.5) * k * 2,
        this._camBase.y + (Math.random() - 0.5) * k * 1.2,
        this._camBase.z + (Math.random() - 0.5) * k * 2,
      );
    } else {
      this.camera.position.copy(this._camBase);
    }
    this.camera.lookAt(this._camLook);

    this.composer.render();
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    // 窄屏（竖屏手机）抬高相机，保证横向战场完整可见
    const fitWidth = 30;
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const needDist = fitWidth / (2 * Math.tan(vFov / 2) * this.camera.aspect);
    const baseDist = 37;
    const dist = Math.max(baseDist, needDist * 1.06);
    const dir = new THREE.Vector3(0, 34, 18).normalize();
    this._camBase.copy(dir).multiplyScalar(dist).add(new THREE.Vector3(0, 0, -3));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }
}
