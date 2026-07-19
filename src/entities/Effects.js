import * as THREE from 'three';

const PARTICLE_VERT = /* glsl */`
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (210.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const PARTICLE_FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.03, d);
    gl_FragColor = vec4(vColor, a);
  }
`;

// ---------------------------------------------------------------------------
// 特效系统：软粒子(Points) + 碎片(InstancedMesh) + 冲击波环 + 动态光
// ---------------------------------------------------------------------------
export class Effects {
  constructor(game) {
    this.game = game;
    const scene = game.scene;

    // ---- 软粒子（SoA） ----
    const MAX = 1600;
    this.max = MAX; this.n = 0;
    this.px = new Float32Array(MAX); this.py = new Float32Array(MAX); this.pz = new Float32Array(MAX);
    this.vx = new Float32Array(MAX); this.vy = new Float32Array(MAX); this.vz = new Float32Array(MAX);
    this.life = new Float32Array(MAX); this.maxLife = new Float32Array(MAX);
    this.size = new Float32Array(MAX);
    this.cr = new Float32Array(MAX); this.cg = new Float32Array(MAX); this.cb = new Float32Array(MAX);
    this.drag = new Float32Array(MAX); this.grav = new Float32Array(MAX);

    this.pGeo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3);
    this.aCol = new THREE.BufferAttribute(new Float32Array(MAX * 3), 3);
    this.aSize = new THREE.BufferAttribute(new Float32Array(MAX), 1);
    this.aPos.setUsage(THREE.DynamicDrawUsage); this.aCol.setUsage(THREE.DynamicDrawUsage); this.aSize.setUsage(THREE.DynamicDrawUsage);
    this.pGeo.setAttribute('position', this.aPos);
    this.pGeo.setAttribute('aColor', this.aCol);
    this.pGeo.setAttribute('aSize', this.aSize);
    this.pGeo.setDrawRange(0, 0);
    const pMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT, fragmentShader: PARTICLE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(this.pGeo, pMat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // ---- 碎片（InstancedMesh 四面体） ----
    const SMAX = 240;
    this.sMax = SMAX;
    this.shards = [];
    this.shardMesh = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.24),
      new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      SMAX,
    );
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardMesh.frustumCulled = false;
    this.shardMesh.count = 0;
    scene.add(this.shardMesh);
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();

    // ---- 冲击波环池 ----
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.82, 1, 64);
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, life: 0, maxLife: 1, maxR: 6 });
    }

    // ---- 动态光源池 ----
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 22, 1.8);
      scene.add(l);
      this.lights.push({ light: l, life: 0, maxLife: 1, peak: 0 });
    }
  }

  // ---------------- 粒子 ----------------
  spawnP(x, y, z, vx, vy, vz, life, size, color, drag = 2.5, grav = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.life[i] = this.maxLife[i] = life;
    this.size[i] = size;
    this.cr[i] = ((color >> 16) & 255) / 255;
    this.cg[i] = ((color >> 8) & 255) / 255;
    this.cb[i] = (color & 255) / 255;
    this.drag[i] = drag; this.grav[i] = grav;
  }

  spawnShard(x, y, z, color, speed = 10, scale = 1) {
    if (this.shards.length >= this.sMax) return;
    const a = Math.random() * Math.PI * 2, up = Math.random() * 6 + 2;
    this.shards.push({
      x, y, z,
      vx: Math.cos(a) * speed * (0.3 + Math.random() * 0.7),
      vy: up, vz: Math.sin(a) * speed * (0.3 + Math.random() * 0.7),
      rx: Math.random() * 6, ry: Math.random() * 6,
      life: 0.6 + Math.random() * 0.5, maxLife: 1, scale: scale * (0.6 + Math.random() * 0.8),
      color,
    });
  }

  ring(x, y, z, color, maxR = 6, life = 0.5) {
    const r = this.rings.find(r => r.life <= 0);
    if (!r) return;
    r.life = r.maxLife = life; r.maxR = maxR;
    r.mesh.position.set(x, y, z);
    r.mesh.material.color.set(color);
    r.mesh.visible = true;
  }

  flash(x, y, z, color, intensity = 5, life = 0.3) {
    const f = this.lights.find(l => l.life <= 0) || this.lights[0];
    f.life = f.maxLife = life; f.peak = intensity;
    f.light.position.set(x, y + 2, z);
    f.light.color.set(color);
  }

  // ---------------- 组合效果 ----------------
  explosion(pos, color = 0xffa050, scale = 1) {
    const { x, y, z } = pos;
    const embers = Math.floor(22 * scale);
    for (let i = 0; i < embers; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (3 + Math.random() * 9) * scale;
      this.spawnP(x, y + 0.3, z,
        Math.cos(a) * sp, (Math.random() - 0.2) * 5, Math.sin(a) * sp,
        0.4 + Math.random() * 0.5, 1.6 * scale * (0.5 + Math.random()), Math.random() < 0.3 ? 0xffffff : color,
        3.2);
    }
    for (let i = 0; i < Math.floor(6 * scale); i++) this.spawnShard(x, y, z, color, 9 * scale, scale);
    this.ring(x, y + 0.2, z, color, 4.5 * scale, 0.4);
    this.flash(x, y, z, color, 4 * scale, 0.25);
  }

  bigExplosion(pos) {
    const { x, y, z } = pos;
    for (let k = 0; k < 3; k++) {
      const ox = (Math.random() - 0.5) * 3, oz = (Math.random() - 0.5) * 3;
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 13;
        this.spawnP(x + ox, y + 0.4, z + oz,
          Math.cos(a) * sp, (Math.random() - 0.1) * 7, Math.sin(a) * sp,
          0.6 + Math.random() * 0.8, 2.6 * (0.5 + Math.random()),
          [0xff6030, 0xffa040, 0xffe080, 0xffffff][Math.floor(Math.random() * 4)], 2.6);
      }
    }
    for (let i = 0; i < 22; i++) this.spawnShard(x, y, z, 0xff8050, 14, 1.6);
    this.ring(x, y + 0.3, z, 0xffa060, 14, 0.7);
    this.ring(x, y + 0.3, z, 0xffffff, 8, 0.5);
    this.flash(x, y, z, 0xffb060, 12, 0.5);
  }

  hitSpark(pos, color = 0xffe080) {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawnP(pos.x, pos.y ?? 0.2, pos.z,
        Math.cos(a) * 4, Math.random() * 2, Math.sin(a) * 4,
        0.18 + Math.random() * 0.15, 0.9, color, 4);
    }
  }

  trail(pos, color = 0x55ccff) {
    this.spawnP(
      pos.x + (Math.random() - 0.5) * 0.12, pos.y, pos.z + 0.2,
      (Math.random() - 0.5) * 0.6, 0, 5 + Math.random() * 2,
      0.28 + Math.random() * 0.14, 1.0 + Math.random() * 0.6, color, 1.5);
  }

  bombBlast(pos) {
    this.ring(pos.x, 0.4, pos.z, 0x80eaff, 42, 0.85);
    this.ring(pos.x, 0.4, pos.z, 0xffffff, 26, 0.6);
    for (let i = 0; i < 130; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 12 + Math.random() * 26;
      this.spawnP(pos.x, 0.5, pos.z,
        Math.cos(a) * sp, (Math.random() - 0.3) * 6, Math.sin(a) * sp,
        0.5 + Math.random() * 0.6, 2.2 * (0.5 + Math.random()),
        Math.random() < 0.5 ? 0x80eaff : 0xffffff, 2.2);
    }
    this.flash(pos.x, 2, pos.z, 0xaaf0ff, 16, 0.6);
  }

  shieldPop(pos) {
    this.ring(pos.x, 0.4, pos.z, 0x60d0ff, 5, 0.4);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      this.spawnP(pos.x + Math.cos(a) * 1.6, 0.4, pos.z + Math.sin(a) * 1.6,
        Math.cos(a) * 6, 1, Math.sin(a) * 6, 0.4, 1.2, 0x60d0ff, 3);
    }
  }

  // ---------------- 帧更新 ----------------
  update(dt) {
    // 软粒子
    let n = this.n;
    for (let i = n - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // 与末尾交换删除
        const j = --n;
        if (i !== j) {
          this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.pz[i] = this.pz[j];
          this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j]; this.vz[i] = this.vz[j];
          this.life[i] = this.life[j]; this.maxLife[i] = this.maxLife[j];
          this.size[i] = this.size[j];
          this.cr[i] = this.cr[j]; this.cg[i] = this.cg[j]; this.cb[i] = this.cb[j];
          this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j];
        }
        continue;
      }
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vx[i] *= dr; this.vz[i] *= dr; this.vy[i] = this.vy[i] * dr - this.grav[i] * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
    }
    this.n = n;
    const pa = this.aPos.array, ca = this.aCol.array, sa = this.aSize.array;
    for (let i = 0; i < n; i++) {
      pa[i * 3] = this.px[i]; pa[i * 3 + 1] = this.py[i]; pa[i * 3 + 2] = this.pz[i];
      const f = this.life[i] / this.maxLife[i];
      const ff = f * f;
      ca[i * 3] = this.cr[i] * ff; ca[i * 3 + 1] = this.cg[i] * ff; ca[i * 3 + 2] = this.cb[i] * ff;
      sa[i] = this.size[i] * (0.6 + 0.4 * f);
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
    this.pGeo.setDrawRange(0, n);

    // 碎片
    const dummy = this._dummy;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const s = this.shards[i];
      s.life -= dt;
      if (s.life <= 0) { this.shards.splice(i, 1); continue; }
      s.vy -= 14 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      if (s.y < 0.1) { s.y = 0.1; s.vy *= -0.4; }
      s.rx += 6 * dt; s.ry += 8 * dt;
    }
    for (let i = 0; i < this.shards.length; i++) {
      const s = this.shards[i];
      const f = Math.min(1, s.life / 0.4);
      dummy.position.set(s.x, s.y, s.z);
      dummy.rotation.set(s.rx, s.ry, 0);
      dummy.scale.setScalar(s.scale * f);
      dummy.updateMatrix();
      this.shardMesh.setMatrixAt(i, dummy.matrix);
      this.shardMesh.setColorAt(i, this._col.set(s.color).multiplyScalar(f));
    }
    this.shardMesh.count = this.shards.length;
    this.shardMesh.instanceMatrix.needsUpdate = true;
    if (this.shardMesh.instanceColor) this.shardMesh.instanceColor.needsUpdate = true;

    // 冲击波环
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) { r.mesh.visible = false; continue; }
      const t = 1 - r.life / r.maxLife;
      const e = 1 - (1 - t) * (1 - t); // easeOutQuad
      const s = 0.3 + e * r.maxR;
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = (1 - t) * 0.85;
    }

    // 光源衰减
    for (const f of this.lights) {
      if (f.life <= 0) { f.light.intensity = 0; continue; }
      f.life -= dt;
      const t = Math.max(0, f.life / f.maxLife);
      f.light.intensity = f.peak * t * t;
    }
  }

  clear() {
    this.n = 0;
    this.pGeo.setDrawRange(0, 0);
    this.shards.length = 0;
    this.shardMesh.count = 0;
    for (const r of this.rings) { r.life = 0; r.mesh.visible = false; }
    for (const f of this.lights) { f.life = 0; f.light.intensity = 0; }
  }
}
