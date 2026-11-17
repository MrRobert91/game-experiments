// Keyboard + touch (floating joystick + one action button). One stick, one button: that is all.
export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.keys = new Set();
    this._action = false; this.btnDown = false; this.lastInput = performance.now();
    this._advance = false;
    this.enabled = true;
    this.invert = false;
    this.isTouch = matchMedia('(hover: none) and (pointer: coarse)').matches || 'ontouchstart' in window;
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.bot = null; // optional autopilot: () => ({x,y,action})

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { this._action = true; this._advance = true; e.preventDefault(); }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    const stickEl = document.getElementById('stick');
    const knob = stickEl.firstElementChild;
    const btn = document.getElementById('btn-action');
    this.stickEl = stickEl; this.btn = btn;
    const R = 52;

    const place = (x, y) => { stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; };
    this.restStick = () => { place(90, innerHeight - 110); stickEl.classList.add('rest'); knob.style.transform = ''; };
    this.restStick();
    addEventListener('resize', () => { if (this.stick.id === null) this.restStick(); });

    const canvas = document.getElementById('scene');
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (this.stick.id !== null) return;
      this.stick.id = e.pointerId; this.stick.ox = e.clientX; this.stick.oy = e.clientY; this.stick.x = this.stick.y = 0;
      place(e.clientX, e.clientY); stickEl.classList.remove('rest'); stickEl.classList.add('on');
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / R; this.stick.y = dy / R;
    });
    const end = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.id = null; this.stick.x = this.stick.y = 0; stickEl.classList.remove('on'); this.restStick();
    };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);

    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this._action = true; this.btnDown = true; btn.classList.add('down'); });
    const up = () => { btn.classList.remove('down'); this.btnDown = false; };
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
    addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (this.stick.id !== null) { x = this.stick.x; y = this.stick.y; }
    this.held = this.enabled && (this.btnDown || k.has('Space') || k.has('KeyE'));
    if (x || y || this._action || this.held) this.lastInput = performance.now();
    if (this.bot) { const b = this.bot(); if (b) { x = b.x; y = b.y; if (b.action) this._action = true; if (b.hold) this.held = true; } }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    if (l < 0.12) { x = 0; y = 0; }
    if (this.invert) { x = -x; y = -y; }
    if (!this.enabled) { x = 0; y = 0; }
    this.move.x = x; this.move.y = y;
  }

  /** edge-triggered action (dash). Consumed on read. */
  action() { const a = this._action && this.enabled; this._action = false; return a; }
  advance() { const a = this._advance; this._advance = false; return a; }
}
