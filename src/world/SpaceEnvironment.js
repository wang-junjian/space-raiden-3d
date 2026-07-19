import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 关卡主题
// ---------------------------------------------------------------------------
const THEMES = [
  { // 第 1 关「碎石星环」深蓝
    nebulaA: new THREE.Color(0x071a3d), nebulaB: new THREE.Color(0x1d4aa8),
    nebulaC: new THREE.Color(0x062a3a), nebulaD: new THREE.Color(0x0f5a7a),
    dust: new THREE.Color(0x030308),
    planet: true, planetColor: 0x7fb2ff,
    asteroids: 64, asteroidTint: 0x8a93a8, deck: false, ionStorm: false,
  },
  { // 第 2 关「幽灵星云」紫罗兰
    nebulaA: new THREE.Color(0x26084d), nebulaB: new THREE.Color(0x7a1fb0),
    nebulaC: new THREE.Color(0x3a0830), nebulaD: new THREE.Color(0x90206a),
    dust: new THREE.Color(0x060210),
    planet: false, planetColor: 0xb07fff,
    asteroids: 36, asteroidTint: 0x9a7fc0, deck: false, ionStorm: true,
  },
  { // 第 3 关「湮灭母舰」暗红 + 甲板网格
    nebulaA: new THREE.Color(0x1a0406), nebulaB: new THREE.Color(0x5a1016),
    nebulaC: new THREE.Color(0x200a04), nebulaD: new THREE.Color(0x7a2f0c),
    dust: new THREE.Color(0x050202),
    planet: false, planetColor: 0xff7f6a,
    asteroids: 0, asteroidTint: 0x6a5550, deck: true, ionStorm: false,
  },
];

// ---------------------------------------------------------------------------
// 着色器
// ---------------------------------------------------------------------------
const STAR_VERT = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uTwinkle;
  varying vec3 vColor;
  varying float vTw;
  void main() {
    vColor = aColor;
    vTw = 1.0 - uTwinkle * (0.5 + 0.5 * sin(uTime * (0.8 + aPhase * 2.2) + aPhase * 40.0));
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (0.6 + 0.4 * vTw) * (170.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
// 普通恒星：柔和圆点
const STAR_FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vTw;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.04, d);
    gl_FragColor = vec4(vColor * (0.5 + vTw * 0.8), a);
  }
`;
// 亮星：星核 + 十字衍射芒
const HERO_FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vTw;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.13, 0.02, d) * 1.7;
    float sx = max(0.0, 1.0 - abs(c.y) * 17.0) * max(0.0, 1.0 - abs(c.x) * 2.1);
    float sy = max(0.0, 1.0 - abs(c.x) * 17.0) * max(0.0, 1.0 - abs(c.y) * 2.1);
    float spikes = (sx + sy) * 0.5;
    float mask = smoothstep(0.5, 0.42, d);
    float a = clamp(core + spikes, 0.0, 1.0) * mask * vTw;
    gl_FragColor = vec4(vColor * (core + spikes) * (0.7 + vTw * 0.5), a);
  }
`;

const NEBULA_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// 发射星云（加色）：fbm 双噪声 + 亮丝
const NEBULA_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec2 uOffset;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uScale;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.55; }
    return v;
  }
  void main() {
    vec2 uv = vUv * uScale + uOffset;
    float n = fbm(uv + vec2(uTime * 0.020, uTime * 0.012));
    float m = fbm(uv * 1.6 - vec2(uTime * 0.014, 0.0) + n * 1.4);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.85, m));
    float alpha = smoothstep(0.30, 0.95, n * m * 1.9);
    col += vec3(0.35, 0.45, 0.6) * pow(max(0.0, m - 0.55) * 2.2, 2.0);
    gl_FragColor = vec4(col * (0.30 + m * 0.85), alpha * 0.85);
  }
`;
// 暗尘埃云（普通混合）：遮挡银河，制造深度
const DUST_FRAG = /* glsl */`
  uniform float uTime;
  uniform vec2 uOffset;
  uniform vec3 uColor;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.11 + 7.3; a *= 0.55; }
    return v;
  }
  void main() {
    vec2 uv = vUv * 5.5 + uOffset;
    float n = fbm(uv + vec2(uTime * 0.004, 0.0));
    float m = fbm(uv * 2.3 + n * 1.2);
    float a = smoothstep(0.42, 0.85, n * m * 1.8) * 0.9;
    gl_FragColor = vec4(uColor, a);
  }
`;

const DECK_VERT = NEBULA_VERT;
const DECK_FRAG = /* glsl */`
  uniform float uTime;
  uniform float uScroll;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 g = vUv * vec2(36.0, 64.0);
    g.y += uScroll;
    vec2 f = abs(fract(g) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.05, min(f.x, f.y));
    float major = 1.0 - smoothstep(0.0, 0.02, min(abs(fract(g.x / 4.0) - 0.5), abs(fract(g.y / 4.0) - 0.5)));
    line = max(line * 0.4, major);
    float pulse = 0.65 + 0.35 * sin(uTime * 2.2 + vUv.y * 24.0);
    float fade = smoothstep(0.02, 0.3, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    gl_FragColor = vec4(uColor * pulse, line * 0.34 * fade);
  }
`;

const ATMOS_VERT = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const ATMOS_FRAG = /* glsl */`
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 2.6);
    gl_FragColor = vec4(uColor * rim * 1.6, rim);
  }
`;

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
function gauss() {
  // Box-Muller 高斯分布
  const u = Math.max(Math.random(), 1e-6), v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 真实恒星温度配色：蓝白居多，少量黄/橙/红 */
function starColor(out) {
  const r = Math.random();
  let h, s;
  if (r < 0.30)      { h = 0.60 + Math.random() * 0.04; s = 0.5 + Math.random() * 0.3; } // 蓝白
  else if (r < 0.68) { h = 0.58; s = Math.random() * 0.15; }                              // 白
  else if (r < 0.84) { h = 0.11 + Math.random() * 0.03; s = 0.45 + Math.random() * 0.2; } // 黄
  else if (r < 0.95) { h = 0.06 + Math.random() * 0.02; s = 0.6 + Math.random() * 0.2; }  // 橙
  else               { h = 0.01; s = 0.7; }                                               // 红
  // 幂律亮度：多数暗星，少数亮星
  const l = 0.3 + Math.pow(Math.random(), 2.0) * 0.6;
  out.setHSL(h, s, l);
  return out;
}

/** 滚动的点云星星层（单 drawcall，CPU 更新位置） */
class StarLayer {
  constructor(scene, count, { frag = STAR_FRAG, twinkle = 0.38 }) {
    this.count = count;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const color = new Float32Array(count * 3);
    this.speed = new Float32Array(count);
    this.pos = pos;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const s = this.gen(i, c);
      pos[i * 3] = s.x; pos[i * 3 + 1] = s.y; pos[i * 3 + 2] = s.z;
      this.speed[i] = s.speed;
      size[i] = s.size;
      phase[i] = Math.random();
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT, fragmentShader: frag,
      uniforms: { uTime: { value: 0 }, uTwinkle: { value: twinkle } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  gen(i, c) { return { x: 0, y: 0, z: 0, speed: 1, size: 1 }; } // 子类/调用方覆盖

  update(dt, scroll, time) {
    this.mat.uniforms.uTime.value = time;
    const arr = this.points.geometry.attributes.position.array;
    for (let i = 0; i < this.count; i++) {
      arr[i * 3 + 2] += scroll * this.speed[i] * dt;
      if (arr[i * 3 + 2] > 52) {
        arr[i * 3 + 2] -= 152;
        if (this.onRespawn) this.onRespawn(arr, i);
        else arr[i * 3] = (Math.random() - 0.5) * 150;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// 程序化旋涡星系纹理
// ---------------------------------------------------------------------------
const _galaxyTexCache = [];
function galaxyTextures() {
  if (_galaxyTexCache.length) return _galaxyTexCache;
  const palettes = [
    ['#cfe0ff', '#7f9fd0'], ['#ffe8c8', '#c09068'], ['#f0c8ff', '#9060b0'],
    ['#c8fff0', '#68a090'], ['#ffd0d0', '#b06868'],
  ];
  for (const [coreCss, armCss] of palettes) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const ctx = cv.getContext('2d');
    ctx.translate(128, 128);
    ctx.rotate(Math.random() * Math.PI);
    ctx.scale(1, 0.42 + Math.random() * 0.2); // 椭圆倾角
    // 旋臂：沿对数螺线撒点
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 260; i++) {
        const t = i / 260;
        const ang = arm * Math.PI + t * 4.2 + gauss() * 0.14;
        const r = 12 + t * 100 * (0.85 + Math.random() * 0.3);
        const a = (1 - t) * 0.16;
        ctx.fillStyle = armCss;
        ctx.globalAlpha = a * (0.5 + Math.random() * 0.5);
        const sz = 1 + Math.random() * 2.6;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * r + gauss() * 4, Math.sin(ang) * r + gauss() * 4, sz, 0, 7);
        ctx.fill();
      }
    }
    // 星系核
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    grad.addColorStop(0, coreCss);
    grad.addColorStop(0.35, armCss);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, 7);
    ctx.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    _galaxyTexCache.push(tex);
  }
  return _galaxyTexCache;
}

// ---------------------------------------------------------------------------
// 太空环境
// 深度层次（远→近）：星系 -78 · 主星云 -75 · 银河带 -72 · 尘埃 -68 ·
//                    次星云 -62 · 远星 -55 · 中星 -30 · 近星 -14
// ---------------------------------------------------------------------------
export class SpaceEnvironment {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.levelIdx = 0;
    this.time = 0;
    this._streakTimer = 2;

    this._buildStarLayers();
    this._buildMilkyWay();
    this._buildNebulas();
    this._buildDust();
    this._buildGalaxies();
    this._buildPlanet();
    this._buildAsteroids();
    this._buildDeck();
    this._buildIonStreaks();

    this.setLevel(0);
  }

  // ---- 前景恒星（三层视差，真实配色 + 亮星星芒） ----
  _buildStarLayers() {
    // 近/中/远普通恒星
    const layers = [
      { count: 480, y: -14, speed: 1.6, size: 2.6 },
      { count: 430, y: -30, speed: 0.85, size: 2.0 },
      { count: 380, y: -55, speed: 0.4, size: 1.5 },
    ];
    this.starLayers = layers.map(({ count, y, speed, size }) => {
      const layer = new StarLayer(this.scene, count, { twinkle: 0.4 });
      // 重新填充位置（StarLayer 构造时用的是默认 gen，这里覆写数据）
      const pos = layer.points.geometry.attributes.position.array;
      const sz = layer.points.geometry.attributes.aSize.array;
      const col = layer.points.geometry.attributes.aColor.array;
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 150;
        pos[i * 3 + 1] = y + (Math.random() - 0.5) * 6;
        pos[i * 3 + 2] = -100 + Math.random() * 150;
        layer.speed[i] = speed;
        sz[i] = size * (0.7 + Math.random() * 0.7);
        starColor(c);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      return layer;
    });

    // 亮星（十字衍射芒，慢闪烁）
    this.heroStars = new StarLayer(this.scene, 42, { frag: HERO_FRAG, twinkle: 0.25 });
    const pos = this.heroStars.points.geometry.attributes.position.array;
    const sz = this.heroStars.points.geometry.attributes.aSize.array;
    const col = this.heroStars.points.geometry.attributes.aColor.array;
    const c = new THREE.Color();
    for (let i = 0; i < 42; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 140;
      pos[i * 3 + 1] = -52 + (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = -100 + Math.random() * 148;
      this.heroStars.speed[i] = 0.42;
      sz[i] = 5.5 + Math.random() * 4;
      starColor(c).multiplyScalar(1.25);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
  }

  // ---- 银河光带 + 球状星团 ----
  _buildMilkyWay() {
    const BAND_TH = 0.62;          // 光带走向（XZ 平面内角度）
    const cosT = Math.cos(BAND_TH), sinT = Math.sin(BAND_TH);
    const toWorld = (u, v) => ({ x: u * cosT - v * sinT, z: u * sinT + v * cosT - 25 });

    const COUNT = 4200;
    this.milkyWay = new StarLayer(this.scene, COUNT, { twinkle: 0.15 });
    // 先渲染（renderOrder=-1），让暗尘埃云（0）可以遮挡它
    this.milkyWay.points.renderOrder = -1;
    // 回收时保持光带结构
    this.milkyWay.onRespawn = (arr, i) => {
      const u = (Math.random() * 2 - 1) * 95;
      const v = gauss() * 12;
      const w = toWorld(u, v);
      arr[i * 3] = w.x;
      arr[i * 3 + 2] = Math.min(w.z, 40);
    };
    const pos = this.milkyWay.points.geometry.attributes.position.array;
    const sz = this.milkyWay.points.geometry.attributes.aSize.array;
    const col = this.milkyWay.points.geometry.attributes.aColor.array;
    const c = new THREE.Color();

    // 星团中心（沿光带分布）
    const clusters = [
      { u: -62, v: 4, n: 320 }, { u: -18, v: -6, n: 260 },
      { u: 30, v: 5, n: 300 }, { u: 72, v: -3, n: 220 },
    ];
    const clusterTotal = clusters.reduce((s, k) => s + k.n, 0);
    let idx = 0;
    const put = (x, y, z) => {
      pos[idx * 3] = x; pos[idx * 3 + 1] = y; pos[idx * 3 + 2] = z;
      this.milkyWay.speed[idx] = 0.2;
      sz[idx] = 0.5 + Math.random() * 0.9;
      // 银河恒星偏蓝白，少数暖色
      if (Math.random() < 0.85) c.setHSL(0.58 + Math.random() * 0.06, 0.25 + Math.random() * 0.25, 0.4 + Math.pow(Math.random(), 1.8) * 0.45);
      else c.setHSL(0.08 + Math.random() * 0.04, 0.5, 0.5 + Math.random() * 0.3);
      col[idx * 3] = c.r; col[idx * 3 + 1] = c.g; col[idx * 3 + 2] = c.b;
      idx++;
    };
    // 光带星：沿线密集，横向高斯衰减
    for (; idx < COUNT - clusterTotal;) {
      const u = (Math.random() * 2 - 1) * 105;
      const v = gauss() * 12;
      const w = toWorld(u, v);
      put(w.x, -72 + gauss() * 3, w.z);
    }
    // 星团
    for (const cl of clusters) {
      for (let k = 0; k < cl.n && idx < COUNT; k++) {
        const w = toWorld(cl.u + gauss() * 5.5, cl.v + gauss() * 4);
        put(w.x, -72 + gauss() * 2.5, w.z);
      }
    }
  }

  // ---- 双层发射星云 ----
  _buildNebulas() {
    const mk = (y, scale, opa) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
        uniforms: {
          uTime: { value: 0 }, uOffset: { value: new THREE.Vector2() },
          uColorA: { value: new THREE.Color() }, uColorB: { value: new THREE.Color() },
          uScale: { value: scale },
        },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(430, 430), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, y, -40);
      mesh.material.opacity = opa;
      this.scene.add(mesh);
      return { mesh, mat };
    };
    this.nebulaA = mk(-75, 7.0, 1.0);    // 主星云（深、大纹理）
    this.nebulaB = mk(-62, 3.2, 0.55);   // 次星云（浅、细纹理，滚动更快 → 视差）
  }

  // ---- 暗尘埃云（遮挡银河） ----
  _buildDust() {
    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: NEBULA_VERT, fragmentShader: DUST_FRAG,
      uniforms: {
        uTime: { value: 0 }, uOffset: { value: new THREE.Vector2(3.7, 8.2) },
        uColor: { value: new THREE.Color(0x030308) },
      },
      transparent: true, depthWrite: false,
    });
    this.dust = new THREE.Mesh(new THREE.PlaneGeometry(430, 430), this.dustMat);
    this.dust.rotation.x = -Math.PI / 2;
    this.dust.position.set(0, -68, -40);
    this.scene.add(this.dust);
  }

  // ---- 远景旋涡星系 ----
  _buildGalaxies() {
    this.galaxies = [];
    const texs = galaxyTextures();
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: texs[i % texs.length], transparent: true,
        opacity: 0.35 + Math.random() * 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI * 2;
      const s = 7 + Math.random() * 11;
      m.scale.set(s, s, 1);
      m.position.set((Math.random() - 0.5) * 170, -78, -125 + Math.random() * 165);
      this.scene.add(m);
      this.galaxies.push(m);
    }
  }

  // ---- 远景行星 + 大气辉光 ----
  _buildPlanet() {
    this.planet = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(20, 48, 32),
      new THREE.MeshStandardMaterial({ color: 0x2a4a8f, roughness: 0.85, metalness: 0.1, emissive: 0x0a1a3d, emissiveIntensity: 0.6, fog: false }),
    );
    this.planetBody = body;
    this.atmosMat = new THREE.ShaderMaterial({
      vertexShader: ATMOS_VERT, fragmentShader: ATMOS_FRAG,
      uniforms: { uColor: { value: new THREE.Color(0x7fb2ff) } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    });
    const atmos = new THREE.Mesh(new THREE.SphereGeometry(22.5, 48, 32), this.atmosMat);
    // 行星环
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(26, 38, 96),
      new THREE.MeshBasicMaterial({ color: 0x5f7fb8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, fog: false }),
    );
    ring.rotation.x = -Math.PI / 2.35;
    this.planet.add(body, atmos, ring);
    this.planet.position.set(-52, -34, -130);
    this.scene.add(this.planet);
  }

  // ---- 小行星带（InstancedMesh 翻滚岩石） ----
  _buildAsteroids() {
    const MAX = 64;
    const geo = new THREE.IcosahedronGeometry(1, 1);
    // 顶点扰动，做成不规则岩块
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      v.multiplyScalar(0.8 + Math.random() * 0.45);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    this.asteroidMat = new THREE.MeshStandardMaterial({ color: 0x8a93a8, roughness: 0.95, metalness: 0.15 });
    this.asteroidMesh = new THREE.InstancedMesh(geo, this.asteroidMat, MAX);
    this.asteroidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.asteroidMesh.frustumCulled = false;
    this.scene.add(this.asteroidMesh);

    this.asteroids = [];
    for (let i = 0; i < MAX; i++) {
      this.asteroids.push({
        x: 0, y: 0, z: 0,
        scale: 0.6 + Math.random() * 1.8,
        rotAxis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        rotSpeed: (Math.random() - 0.5) * 1.6,
        rot: Math.random() * Math.PI * 2,
        drift: 0.45 + Math.random() * 0.4,
      });
      this._resetAsteroid(this.asteroids[i], true);
    }
    this.asteroidActive = MAX;
    this._asteroidDummy = new THREE.Object3D();
  }

  _resetAsteroid(a, randomZ = false) {
    a.x = (Math.random() - 0.5) * 90;
    a.y = -4 - Math.random() * 9;
    a.z = randomZ ? -110 + Math.random() * 160 : -110 - Math.random() * 30;
  }

  // ---- 母舰甲板网格（第 3 关） ----
  _buildDeck() {
    this.deckMat = new THREE.ShaderMaterial({
      vertexShader: DECK_VERT, fragmentShader: DECK_FRAG,
      uniforms: {
        uTime: { value: 0 }, uScroll: { value: 0 },
        uColor: { value: new THREE.Color(0xff3a2a) },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.deck = new THREE.Mesh(new THREE.PlaneGeometry(160, 300), this.deckMat);
    this.deck.rotation.x = -Math.PI / 2;
    this.deck.position.set(0, -7, -60);
    this.deck.visible = false;
    this.scene.add(this.deck);

    // 甲板上的暗色建筑结构（剪影）
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x14080a, roughness: 0.9, metalness: 0.4 });
    this.deckBlocks = new THREE.InstancedMesh(geo, mat, 26);
    this.deckBlocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.deckBlocks.frustumCulled = false;
    this.deckBlocks.visible = false;
    this.scene.add(this.deckBlocks);
    this.blocks = [];
    for (let i = 0; i < 26; i++) {
      this.blocks.push({
        x: (Math.random() - 0.5) * 70,
        z: -140 + Math.random() * 180,
        w: 3 + Math.random() * 8, h: 1.5 + Math.random() * 5, d: 4 + Math.random() * 12,
      });
    }
    this._blockDummy = new THREE.Object3D();
  }

  // ---- 离子风暴光带（第 2 关） ----
  _buildIonStreaks() {
    this.streaks = [];
    const geo = new THREE.PlaneGeometry(26, 0.35);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xb060ff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      this.scene.add(m);
      this.streaks.push({ mesh: m, life: 0, vx: 0 });
    }
  }

  // ------------------------------------------------------------------
  setLevel(idx) {
    this.levelIdx = idx;
    const t = THEMES[idx % THEMES.length];
    this.theme = t;
    this.nebulaA.mat.uniforms.uColorA.value.copy(t.nebulaA);
    this.nebulaA.mat.uniforms.uColorB.value.copy(t.nebulaB);
    this.nebulaB.mat.uniforms.uColorA.value.copy(t.nebulaC);
    this.nebulaB.mat.uniforms.uColorB.value.copy(t.nebulaD);
    this.dustMat.uniforms.uColor.value.copy(t.dust);
    this.planet.visible = t.planet;
    this.planetBody.material.color.set(t.planetColor).multiplyScalar(0.55);
    this.atmosMat.uniforms.uColor.value.set(t.planetColor);
    this.asteroidActive = t.asteroids;
    this.asteroidMesh.visible = t.asteroids > 0;
    this.asteroidMat.color.set(t.asteroidTint);
    this.deck.visible = t.deck;
    this.deckBlocks.visible = t.deck;
    this._streakTimer = 2;
    for (const s of this.streaks) { s.life = 0; s.mesh.visible = false; }
  }

  update(dt, scrollSpeed) {
    this.time += dt;

    // 前景恒星层
    for (const layer of this.starLayers) layer.update(dt, scrollSpeed, this.time);
    this.heroStars.update(dt, scrollSpeed, this.time);
    this.milkyWay.update(dt, scrollSpeed, this.time);

    // 星云：时间演化 + 滚动偏移（深层慢 → 视差）
    const t = this.time;
    this.nebulaA.mat.uniforms.uTime.value = t;
    this.nebulaB.mat.uniforms.uTime.value = t;
    this.dustMat.uniforms.uTime.value = t;
    this.nebulaA.mat.uniforms.uOffset.value.y += scrollSpeed * dt * 0.0016;
    this.dustMat.uniforms.uOffset.value.y += scrollSpeed * dt * 0.0022;
    this.nebulaB.mat.uniforms.uOffset.value.y += scrollSpeed * dt * 0.0030;

    // 远景星系缓慢漂移回收
    for (const g of this.galaxies) {
      g.position.z += scrollSpeed * 0.18 * dt;
      if (g.position.z > 55) {
        g.position.z = -125 - Math.random() * 20;
        g.position.x = (Math.random() - 0.5) * 170;
      }
    }

    // 行星缓慢自转
    if (this.planet.visible) this.planetBody.rotation.y += dt * 0.03;

    // 小行星翻滚漂移
    if (this.asteroidMesh.visible) {
      const dummy = this._asteroidDummy;
      for (let i = 0; i < this.asteroidActive; i++) {
        const a = this.asteroids[i];
        a.z += scrollSpeed * a.drift * dt;
        a.rot += a.rotSpeed * dt;
        if (a.z > 40) this._resetAsteroid(a);
        dummy.position.set(a.x, a.y, a.z);
        dummy.quaternion.setFromAxisAngle(a.rotAxis, a.rot);
        dummy.scale.setScalar(a.scale);
        dummy.updateMatrix();
        this.asteroidMesh.setMatrixAt(i, dummy.matrix);
      }
      this.asteroidMesh.count = this.asteroidActive;
      this.asteroidMesh.instanceMatrix.needsUpdate = true;
    }

    // 母舰甲板
    if (this.deck.visible) {
      this.deckMat.uniforms.uTime.value = this.time;
      this.deckMat.uniforms.uScroll.value += scrollSpeed * dt * 0.55;
      const dummy = this._blockDummy;
      for (let i = 0; i < this.blocks.length; i++) {
        const b = this.blocks[i];
        b.z += scrollSpeed * dt;
        if (b.z > 45) { b.z = -140 - Math.random() * 30; b.x = (Math.random() - 0.5) * 70; }
        dummy.position.set(b.x, -7 + b.h / 2, b.z);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        this.deckBlocks.setMatrixAt(i, dummy.matrix);
      }
      this.deckBlocks.instanceMatrix.needsUpdate = true;
    }

    // 离子风暴
    if (this.theme.ionStorm) {
      this._streakTimer -= dt;
      if (this._streakTimer <= 0) {
        this._streakTimer = 1.2 + Math.random() * 2.5;
        const s = this.streaks.find(s => s.life <= 0);
        if (s) {
          s.life = 0.7;
          s.vx = (Math.random() < 0.5 ? -1 : 1) * (50 + Math.random() * 40);
          s.mesh.position.set(-Math.sign(s.vx) * 45, 0.5 + Math.random() * 3.5, -25 + Math.random() * 30);
          s.mesh.visible = true;
        }
      }
    }
    for (const s of this.streaks) {
      if (s.life > 0) {
        s.life -= dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.material.opacity = Math.sin((s.life / 0.7) * Math.PI) * 0.7;
        if (s.life <= 0) s.mesh.visible = false;
      }
    }
  }
}
