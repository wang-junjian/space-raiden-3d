import * as THREE from 'three';
import { Pool } from '../core/Pool.js';

// ---------------------------------------------------------------------------
// 子弹系统：单个 InstancedMesh 承载所有子弹，对象池管理数据
// ---------------------------------------------------------------------------
export class BulletSystem {
  constructor(game, { isPlayer, capacity }) {
    this.game = game;
    this.isPlayer = isPlayer;
    this.capacity = capacity;

    const geo = isPlayer
      ? new THREE.BoxGeometry(0.17, 0.17, 1.1)   // 细长光弹
      : new THREE.SphereGeometry(0.26, 10, 8);    // 能量弹丸
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    game.scene.add(this.mesh);

    this._pool = new Pool(() => ({ x: 0, z: 0, vx: 0, vz: 0, dmg: 0, size: 1, r: 0.3, pierce: 0, hitIds: null, age: 0 }));
    this.list = [];
    this._dummy = new THREE.Object3D();
    this._color = new THREE.Color();
    this.time = 0;
  }

  get count() { return this.list.length; }

  /**
   * 发射一颗子弹
   * @param {number} angle 弧度，0 = -Z（向上），顺/逆时针以 atan2(vx, -vz) 计
   */
  spawn(x, z, angle, speed, { dmg = 10, size = 1, pierce = 0, color = 0xffffff, r = null } = {}) {
    if (this.list.length >= this.capacity) return null;
    const b = this._pool.obtain();
    b.x = x; b.z = z;
    b.vx = Math.sin(angle) * speed;
    b.vz = -Math.cos(angle) * speed;
    b.dmg = dmg; b.size = size; b.pierce = pierce;
    b.r = r ?? (this.isPlayer ? 0.35 * size : 0.3 * size);
    b.age = 0;
    if (b.hitIds) b.hitIds.clear();
    b.color = color;
    this.list.push(b);
    return b;
  }

  remove(i) {
    const b = this.list[i];
    const last = this.list.pop();
    if (i < this.list.length) this.list[i] = last;
    this._pool.release(b);
  }

  clearAll() {
    this._pool.releaseAll(this.list);
    this.mesh.count = 0;
  }

  update(dt) {
    this.time += dt;
    const b = this.game.bounds;
    const list = this.list;
    const dummy = this._dummy;
    const mesh = this.mesh;

    for (let i = list.length - 1; i >= 0; i--) {
      const bl = list[i];
      bl.x += bl.vx * dt;
      bl.z += bl.vz * dt;
      bl.age += dt;
      if (bl.z < b.minZ - 6 || bl.z > b.maxZ + 6 || bl.x < b.minX - 8 || bl.x > b.maxX + 8) {
        this.remove(i);
      }
    }

    // 写入实例矩阵
    for (let i = 0; i < list.length; i++) {
      const bl = list[i];
      dummy.position.set(bl.x, 0.1, bl.z);
      if (this.isPlayer) {
        dummy.rotation.set(0, Math.atan2(bl.vx, -bl.vz), 0);
        dummy.scale.set(bl.size, bl.size, bl.size * 1.6);
      } else {
        const pulse = bl.size * (1 + 0.18 * Math.sin(this.time * 14 + i));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(pulse);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, this._color.set(bl.color));
    }
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
}
