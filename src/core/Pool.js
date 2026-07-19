// 通用对象池：避免热循环中的 GC 抖动
export class Pool {
  /**
   * @param {() => T} factory  创建新对象
   * @param {(obj: T) => void} [reset] 回收时重置
   */
  constructor(factory, reset) {
    this._factory = factory;
    this._reset = reset;
    this._free = [];
  }

  obtain() {
    return this._free.length > 0 ? this._free.pop() : this._factory();
  }

  release(obj) {
    if (this._reset) this._reset(obj);
    this._free.push(obj);
  }

  releaseAll(list) {
    for (const obj of list) this.release(obj);
    list.length = 0;
  }
}
