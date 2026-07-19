// 输入系统：键盘 + 触屏拖动
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.axisX = 0;          // -1 .. 1（由键盘计算）
    this.axisZ = 0;
    this.bombPressed = false;    // 边沿触发，消费后清零
    this.confirmPressed = false;
    this.pausePressed = false;

    // 触屏
    this.touchActive = false;
    this.touchDX = 0;
    this.touchDZ = 0;
    this._lastTouch = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { this._prevent(e); return; }
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyB') this.bombPressed = true;
      if (e.code === 'Enter') this.confirmPressed = true;
      if (e.code === 'KeyP' || e.code === 'Escape') this.pausePressed = true;
      this._prevent(e);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // 触屏：拖动控制移动，单击 UI 覆盖层由 Screens 处理
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this.touchActive = true;
      this._lastTouch = { x: t.clientX, y: t.clientY };
      this.confirmPressed = true; // 标题界面点击开始
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (!this._lastTouch) return;
      const t = e.changedTouches[0];
      this.touchDX += (t.clientX - this._lastTouch.x) * 0.045;
      this.touchDZ += (t.clientY - this._lastTouch.y) * 0.045;
      this._lastTouch = { x: t.clientX, y: t.clientY };
      e.preventDefault();
    }, { passive: false });
    const endTouch = () => { this.touchActive = false; this._lastTouch = null; };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  _prevent(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }

  // 每帧调用：汇总键盘轴向
  poll() {
    const k = this.keys;
    this.axisX = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
    this.axisZ = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
  }

  // 消费触屏位移（调用后清零）
  consumeTouchDelta() {
    const d = { x: this.touchDX, z: this.touchDZ };
    this.touchDX = 0; this.touchDZ = 0;
    return d;
  }

  consumeBomb()    { const v = this.bombPressed;    this.bombPressed = false;    return v; }
  consumeConfirm() { const v = this.confirmPressed; this.confirmPressed = false; return v; }
  consumePause()   { const v = this.pausePressed;   this.pausePressed = false;   return v; }
}
