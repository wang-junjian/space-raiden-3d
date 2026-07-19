# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Space Raiden 3D：经典雷电纵向卷轴 × 全 3D 画面的太空射击游戏。Three.js + Vite，**零外部资源**——所有模型（几何体组合）、音效/BGM（Web Audio 合成）、纹理（Canvas/GLSL）均为程序化生成。UI 文案为中文。

## 常用命令

```bash
npm run dev       # 开发服务器（默认 http://localhost:5173）
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物

# 冒烟测试（Playwright 驱动真实浏览器跑完整游戏流程）
npx vite --port 5199 --strictPort &   # 必须先启动且端口固定 5199
node scripts/smoke.mjs                # 验证状态机/战斗/炸弹/暂停/Boss/过关，控制台有错误则退出码 1
node scripts/shot-boss.mjs <cruiser|void|core>   # 截取指定 Boss 战画面到 /tmp
node scripts/shot-env.mjs / shot-lv3.mjs          # 截取关卡场景画面
```

Playwright 浏览器使用系统缓存（`~/Library/Caches/ms-playwright`），重装依赖时用 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright`。

## 架构要点

### 中枢：src/core/Game.js
`Game` 拥有渲染器/场景/相机/Bloom 后期与全部子系统实例，运行状态机（`STATE.TITLE/PLAYING/PAUSED/OVER/CLEAR/VICTORY`）与帧循环。所有实体和系统在构造时接收 `game` 引用互相协作，**任何模块都不要 import Game.js**（避免循环依赖）。

### 坐标与角度约定（全项目统一）
- 玩法平面为 **XZ**（俯视）：X = 屏幕横向，Z = 屏幕纵向；玩家机头朝 **-Z**（屏幕上方），敌机朝 +Z 涌来。逻辑全部在 y≈0 平面上做 2D 圆形碰撞，y 仅用于视觉层次。
- 战场边界在 `game.bounds`；敌机入场线 `game.spawnZ`。
- 子弹角度：`angle = 0` 表示朝 -Z；`vx = sin(a)*speed, vz = -cos(a)*speed`。瞄准玩家用 `atan2(dx, -dz)`（见 `Enemy._aimAngle` / `Boss._aimFrom`）。

### 性能模式（新增实体必须遵守）
- 子弹/粒子/碎片全部走 **InstancedMesh + 对象池**（`core/Pool.js`），单 drawcall；`Effects` 粒子用 SoA 的 Float32Array 存储 + swap-remove 压缩。
- update 热循环内**禁止每帧分配对象**（new Vector3、数组字面量等），复用临时变量。
- 背景点云（星星/银河）每帧 CPU 更新 position attribute，靠 `StarLayer.speed[i]` 做视差。

### 内容数据驱动
- 关卡波次：`src/data/levels.js`——时间轴数组（`{ t, type, n, gap, pattern, hpMul, speedMul }`），pattern 由 `WaveSystem._spawnOne` 解析。加关卡 = 加数据 + 在 `SpaceEnvironment.THEMES` 加配色。
- 武器：`src/data/weapons.js`——红/蓝各 5 级的齐射数组（angle/x/dmg/speed/size/pierce）。
- 敌机行为：`src/entities/Enemy.js` 的 `ENEMY_DEFS`（move: straight/sine/hover/dash；fire: aimed/burst/spread/ring）。
- Boss 全部波次打完后由 `WaveSystem` 自动触发警告并召唤。

### Boss 三文件结构（刻意为之）
`Boss.js`（基类）← `bosses.js`（3 个子类）← `BossManager.js`（注册表/生命周期）。**不要合并**——基类与管理器同文件时与子类形成 ESM 循环导入，运行时会抛 `Cannot access 'Boss' before initialization`。新 Boss：在 bosses.js 加子类（实现 `build()` 搭建模型注册 `addPart`、`combat(dt)` 写阶段逻辑），再到 BossManager 的 `BOSS_CLASSES` 注册。

### 背景层叠顺序（SpaceEnvironment）
透明对象按深度自动排序，唯一例外：银河点云对象坐标在原点（排序距离=近），必须设 `renderOrder = -1` 让暗尘埃云（普通混合的唯一遮挡物）画在它后面。其余全部 AdditiveBlending，顺序无关。深度栈（远→近）：星系 -78 → 主星云 -75 → 银河 -72 → 尘埃 -68 → 次星云 -62 → 远星 -55 → 中星 -30 → 近星 -14。

### UI 与音频
- HUD/界面是 index.html 里的 DOM 元素（HUD.js / Screens.js 直接操作），游戏画面是底下的 canvas；横幅用 `screens.banner(主, 副)`。
- 浏览器要求首次用户交互后才能出声：`audio.init()` 在 `startRun()` 里调用（Enter/点击触发）。

## 调试

浏览器控制台可直接访问 `window.__game`（main.js 暴露），冒烟/截图脚本全靠它注入状态（如 `__game.player.invincible = 9999`、`__game.waves.waveIdx = 99` 快进 Boss）。
