import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 程序化飞船建模：几何体组合 + 自发光，零外部模型资源
// 约定：玩家机头朝 -Z；敌机统一在构建时转向 +Z（面向玩家）
// ---------------------------------------------------------------------------

export function bodyMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, metalness: opts.metalness ?? 0.75, roughness: opts.roughness ?? 0.32,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
}

export function glowMat(color) {
  // MeshBasicMaterial 直接输出高亮色，稳定触发泛光
  return new THREE.MeshBasicMaterial({ color });
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** 通用：后掠翼（左右一对） */
function addWings(group, { span, chord, thick, sweep, color, tipColor, z = 0.3, y = 0 }) {
  const wingGeo = new THREE.BoxGeometry(span, thick, chord);
  const tipGeo = new THREE.BoxGeometry(0.16, thick * 1.3, chord * 0.9);
  for (const side of [-1, 1]) {
    const w = mesh(wingGeo, bodyMat(color), side * (span / 2 + 0.25), y, z);
    w.rotation.y = -side * sweep;
    group.add(w);
    if (tipColor) {
      const tip = mesh(tipGeo, glowMat(tipColor), side * (span + 0.25), y, z - Math.sin(sweep) * span * 0.4);
      tip.rotation.y = -side * sweep;
      group.add(tip);
    }
  }
}

// ---------------------------------------------------------------------------
// 玩家战机「雷电-X」
// ---------------------------------------------------------------------------
export function buildPlayerShip() {
  const g = new THREE.Group();
  const hullColor = 0xd8e2f2, accent = 0x35d5ff;

  // 主机身（箭头形）
  const fus = mesh(new THREE.ConeGeometry(0.55, 2.7, 6), bodyMat(hullColor));
  fus.rotation.x = -Math.PI / 2; // 机头朝 -Z
  g.add(fus);

  // 背部座舱
  const cockpit = mesh(new THREE.SphereGeometry(0.3, 12, 8), glowMat(0x66eaff), 0, 0.28, 0.25);
  cockpit.scale.set(0.7, 0.5, 1.6);
  g.add(cockpit);

  // 主翼 + 发光翼尖
  addWings(g, { span: 1.15, chord: 1.05, thick: 0.09, sweep: 0.55, color: 0x8fa8d8, tipColor: accent, z: 0.55 });

  // 前翼（鸭翼）
  addWings(g, { span: 0.5, chord: 0.5, thick: 0.06, sweep: 0.6, color: 0x8fa8d8, tipColor: null, z: -0.75, y: 0.05 });

  // 垂尾
  const fin = mesh(new THREE.BoxGeometry(0.07, 0.55, 0.75), bodyMat(0x8fa8d8), 0, 0.35, 0.85);
  fin.rotation.x = 0.25;
  g.add(fin);

  // 双引擎 + 喷口辉光
  const engineGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.55, 8);
  const nozzleGeo = new THREE.CylinderGeometry(0.13, 0.17, 0.12, 8);
  const engines = [];
  for (const side of [-1, 1]) {
    const e = mesh(engineGeo, bodyMat(0x5a6a8f), side * 0.45, 0, 0.95);
    e.rotation.x = Math.PI / 2;
    g.add(e);
    const noz = mesh(nozzleGeo, glowMat(0x55ccff), side * 0.45, 0, 1.26);
    noz.rotation.x = Math.PI / 2;
    g.add(noz);
    engines.push(new THREE.Vector3(side * 0.45, 0, 1.3));
  }

  // 机鼻炮管
  const gunGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6);
  for (const side of [-1, 1]) {
    const gun = mesh(gunGeo, bodyMat(0x39445f), side * 0.22, 0, -1.2);
    gun.rotation.x = Math.PI / 2;
    g.add(gun);
  }

  g.userData.engines = engines;
  g.userData.noseZ = -1.5; // 子弹出生点
  return g;
}

// ---------------------------------------------------------------------------
// 敌机
// ---------------------------------------------------------------------------
export function buildEnemyShip(type) {
  let g;
  switch (type) {
    case 'scout':       g = _buildScout(); break;
    case 'interceptor': g = _buildInterceptor(); break;
    case 'gunboat':     g = _buildGunboat(); break;
    case 'bomber':      g = _buildBomber(); break;
    case 'elite':       g = _buildElite(); break;
    default:            g = _buildScout();
  }
  g.rotation.y = Math.PI; // 面向 +Z（玩家方向）
  return g;
}

function _buildScout() {
  const g = new THREE.Group();
  const fus = mesh(new THREE.ConeGeometry(0.42, 1.7, 5), bodyMat(0x8f3a4a, { metalness: 0.6 }));
  fus.rotation.x = -Math.PI / 2;
  g.add(fus);
  addWings(g, { span: 0.7, chord: 0.7, thick: 0.07, sweep: 0.7, color: 0x5f2430, tipColor: 0xff4a5a, z: 0.35 });
  const eye = mesh(new THREE.SphereGeometry(0.16, 8, 6), glowMat(0xff6a5a), 0, 0.12, -0.5);
  g.add(eye);
  return g;
}

function _buildInterceptor() {
  const g = new THREE.Group();
  const fus = mesh(new THREE.ConeGeometry(0.5, 2.3, 6), bodyMat(0x4a3a8f, { metalness: 0.7 }));
  fus.rotation.x = -Math.PI / 2;
  g.add(fus);
  // 前掠翼
  addWings(g, { span: 0.95, chord: 0.8, thick: 0.08, sweep: -0.45, color: 0x352a6f, tipColor: 0xb060ff, z: 0.1 });
  const cockpit = mesh(new THREE.SphereGeometry(0.22, 10, 8), glowMat(0xc880ff), 0, 0.2, 0.1);
  cockpit.scale.set(0.7, 0.5, 1.4);
  g.add(cockpit);
  const fin = mesh(new THREE.BoxGeometry(0.06, 0.45, 0.6), bodyMat(0x352a6f), 0, 0.3, 0.8);
  g.add(fin);
  return g;
}

function _buildGunboat() {
  const g = new THREE.Group();
  const hull = mesh(new THREE.BoxGeometry(1.5, 0.55, 2.1), bodyMat(0x7a5230, { metalness: 0.55, roughness: 0.5 }));
  g.add(hull);
  // 顶部炮塔
  const dome = mesh(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), bodyMat(0x8f6238), 0, 0.28, 0);
  g.add(dome);
  const barrel = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6), glowMat(0xffa040), 0, 0.45, -0.5);
  barrel.rotation.x = Math.PI / 2;
  g.add(barrel);
  // 侧舱
  for (const side of [-1, 1]) {
    const pod = mesh(new THREE.BoxGeometry(0.4, 0.4, 1.2), bodyMat(0x5f3d22), side * 0.95, 0, 0.2);
    g.add(pod);
    const light = mesh(new THREE.SphereGeometry(0.1, 6, 5), glowMat(0xff8030), side * 0.95, 0, -0.45);
    g.add(light);
  }
  return g;
}

function _buildBomber() {
  const g = new THREE.Group();
  // 六边形重甲平台
  const hull = mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.55, 6), bodyMat(0x6a2a2a, { metalness: 0.65, roughness: 0.45 }));
  g.add(hull);
  const core = mesh(new THREE.SphereGeometry(0.55, 12, 10), glowMat(0xff4030), 0, 0.3, 0);
  core.scale.y = 0.55;
  g.add(core);
  // 六个角的警示灯
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const light = mesh(new THREE.SphereGeometry(0.11, 6, 5), glowMat(0xffc040), Math.cos(a) * 1.45, 0.1, Math.sin(a) * 1.45);
    g.add(light);
  }
  return g;
}

function _buildElite() {
  const g = new THREE.Group();
  // 隐身棱形机身
  const fus = mesh(new THREE.OctahedronGeometry(0.9), bodyMat(0x1a3a2a, { metalness: 0.85, roughness: 0.25 }));
  fus.scale.set(0.75, 0.35, 1.6);
  g.add(fus);
  addWings(g, { span: 0.85, chord: 0.9, thick: 0.06, sweep: 0.75, color: 0x14281e, tipColor: 0x40ff90, z: 0.25 });
  const slit = mesh(new THREE.BoxGeometry(0.5, 0.06, 0.12), glowMat(0x50ffa0), 0, 0.15, -0.55);
  g.add(slit);
  return g;
}
