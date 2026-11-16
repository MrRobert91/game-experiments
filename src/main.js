import * as THREE from 'three';
import { Gfx } from './engine/gfx.js';
import { Physics } from './engine/physics.js';
import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { UI } from './game/ui.js';
import { Robot } from './game/robot.js';
import { buildWorld, ARENA_Y } from './game/world.js';
import { spawnDebris } from './game/actors.js';
import { runStory } from './game/story.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Game {
  async init() {
    this.gfx = new Gfx(document.getElementById('scene'));
    this.physics = await Physics.create();
    this.input = new Input();
    this.audio = new Audio();
    this.ui = new UI(this);
    this.temp = []; this.tickers = new Set(); this.steppers = new Set();
    this.time = 0; this.timeScale = 1; this.playTime = 0;
    this.floorY = 0; this.checkpoint = V(0, 0, 2); this.falling = false; this.onFall = null;
    this.focus = null; this.focusMix = 0.5; this.botTarget = null; this.botDash = false;
    this.pelusa = null; this.boss = null; this.pianos = 0; this.lampKick = 0;
    this.world = buildWorld(this);
    this.robot = new Robot(this, V(0, 0, 2));
    this.robot.face('off'); this.robot.frozen = true;

    let lastSfx = 0;
    this.physics.onImpact = (a, b, f) => {
      const piano = a?.tag === 'piano' ? a : b?.tag === 'piano' ? b : null;
      if (piano && piano.fresh) {
        piano.fresh = false;
        const t = piano.body.translation(), p = V(t.x, t.y, t.z);
        this.audio.pianoCrash(); this.gfx.shake(0.75);
        this.gfx.particles.burst(p, 40, { color: 0xd8c8a8, speed: 9, life: 1.2, size: 0.5, up: 0.25, gravity: -1, drag: 2.5 });
        spawnDebris(this, p, 9, { color: 0xf4f0e6, size: 0.1, speed: 8, life: 4 });
        spawnDebris(this, p, 5, { color: 0x0a0a0a, size: 0.16, speed: 7, life: 4 });
        return;
      }
      if (this.time - lastSfx > 0.09 && f > 500) { lastSfx = this.time; this.audio.thud(Math.min(1, f / 6000)); }
    };

    const q = new URLSearchParams(location.search);
    if (q.get('auto')) this._autopilot(q.get('auto').toUpperCase());
    return this;
  }

  _autopilot(mode) {
    this.ui.auto = mode;
    this.input.bot = () => {
      const tgt = typeof this.botTarget === 'function' ? this.botTarget() : this.botTarget;
      if (!tgt || !this.input.enabled) return null;
      const p = this.robot.position, dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.25) return { x: 0, y: 0, action: false };
      const { fx, fz } = this._camBasis();
      const wx = dx / d, wz = dz / d;
      return { x: wx * -fz + wz * fx, y: -(wx * fx + wz * fz), action: this.botDash && d < 3.5 };
    };
  }

  _camBasis() {
    const o = this.gfx.cam.curOffset, l = Math.hypot(o.x, o.z) || 1;
    return { fx: -o.x / l, fz: -o.z / l };
  }

  sleep(sec) { if (this.ui.auto) sec = Math.min(sec, 0.12); return new Promise((res) => { let t = 0; const f = (dt) => { t += dt; if (t >= sec) { this.tickers.delete(f); res(); } }; this.tickers.add(f); }); }
  until(cond, timeout = 1e9) { return new Promise((res) => { let t = 0; const f = (dt) => { t += dt; if (cond() || t > timeout) { this.tickers.delete(f); res(); } }; this.tickers.add(f); }); }

  start() {
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const raw = Math.min(0.05, (now - last) / 1000); last = now;
      const dt = raw * this.timeScale;
      this.time += dt; this.playTime += raw;
      const { input, robot, gfx, world: W } = this;
      input.update();
      const { fx, fz } = this._camBasis();
      const mx = input.move.x * -fz + -input.move.y * fx, mz = input.move.x * fx + -input.move.y * fz;
      let dash = input.action();
      this.input.btn.classList.toggle('cool', robot.dashCd > 0);
      this.physics.update(dt, (h) => {
        robot.step(h, mx, mz, dash); dash = false;
        this.pelusa && this.pelusa.step(h);
        this.boss && this.boss.step(h, robot);
        for (const s of this.steppers) s(h);
      });
      this.physics.sync();
      robot.update(dt, this.time);
      this.boss && this.boss.update(dt);
      for (const t of [...this.tickers]) t(dt, raw);

      // temporary bodies
      for (let i = this.temp.length - 1; i >= 0; i--) {
        const t = this.temp[i]; t.t -= dt;
        if (t.t <= 0 || t.e.body.translation().y < this.floorY - 60) {
          if (t.poof && t.e.alive) { const p = t.e.body.translation(); gfx.particles.burst(V(p.x, p.y, p.z), 30, { color: 0x35f0c8, speed: 5, life: 0.6, size: 0.25, gravity: 0 }); }
          this.physics.remove(t.e); this.temp.splice(i, 1);
        }
      }

      // fell out of the world
      const rp = robot.position;
      if (!this.falling && rp.y < this.floorY - 14) {
        robot.falls++;
        robot.teleport(this.checkpoint.x, this.checkpoint.y + 1.5, this.checkpoint.z);
        gfx.cam.snap = true; gfx.glitchKick = 0.6; this.audio.glitch();
        this.onFall && this.onFall();
      }

      // set dressing
      this.lampKick *= Math.exp(-dt * 0.6);
      W.lamp.rotation.z = Math.sin(this.time * 1.3) * (0.07 + this.lampKick);
      W.lamp.rotation.x = Math.cos(this.time * 0.9) * (0.04 + this.lampKick * 0.6);
      if (W.eye.visible) {
        _m.lookAt(W.eye.position, _v.copy(rp).setY(rp.y + 1), UP); _q.setFromRotationMatrix(_m);
        _q2.setFromAxisAngle(UP, Math.PI); _q.multiply(_q2);
        W.eye.quaternion.slerp(_q, 1 - Math.exp(-raw * 3));
        W.eyeRings.forEach((r, i) => { r.rotation.x += raw * (0.3 + i * 0.17); r.rotation.y += raw * (0.2 - i * 0.13); });
        const seed = W.pages.userData.seed, e = W.eye.position;
        for (let i = 0; i < seed.length; i++) {
          const s = seed[i], a = s[0] + this.time * s[3];
          _o.position.set(e.x + Math.cos(a) * s[1], e.y + s[2] + Math.sin(this.time * 0.5 + s[4]) * 0.6, e.z + Math.sin(a) * s[1]);
          _o.rotation.set(this.time * s[3] * 2 + s[4], a, s[4]); _o.updateMatrix(); W.pages.setMatrixAt(i, _o.matrix);
        }
        W.pages.instanceMatrix.needsUpdate = true;
      }
      if (W.junk.visible) for (const j of W.junk.children) {
        if (j.userData.float !== undefined) { j.position.y += Math.sin(this.time * 0.7 + j.userData.float) * raw * 0.25; j.rotation.y += raw * 0.12; }
        if (j.userData.spin) j.rotation.z += raw * j.userData.spin;
      }
      for (const b of W.bridge) if (b.t >= 0 && b.t < 1) { b.t = Math.min(1, b.t + raw * 2.2); const s = 1 - Math.pow(1 - b.t, 3); b.mesh.scale.set(s, s, s); b.mesh.position.y = ARENA_Y - 0.25 - (1 - s) * 6; }

      // camera
      const cam = gfx.cam;
      if (this.focus) cam.target.copy(rp).lerp(this.focus, this.focusMix); else cam.target.copy(rp);
      gfx.update(dt, raw);
      gfx.render();
    };
    requestAnimationFrame(frame);
  }
}
const UP = V(0, 1, 0), _v = V(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _o = new THREE.Object3D();

const game = new Game();
window.__game = game;
game.init().then(() => {
  game.start();
  // idle title shot
  game.gfx.cam.offset.set(-4.2, 2.6, 6.5); game.gfx.cam.snap = true; game.focus = new THREE.Vector3(-2.6, 0.4, 2); game.focusMix = 1;
  document.getElementById('fade').classList.add('clear');
  const btn = document.getElementById('btn-start');
  btn.disabled = false; btn.textContent = 'Empezar';
  const mute = document.getElementById('btn-mute');
  mute.onclick = () => { game.audio.setMuted(!game.audio.muted); mute.classList.toggle('off', game.audio.muted); };
  const go = () => {
    btn.onclick = null; game.focus = null;
    game.audio.start();
    document.getElementById('title').classList.add('hidden');
    mute.classList.remove('hidden');
    runStory(game).catch((e) => console.error(e));
  };
  btn.onclick = go;
  if (game.ui.auto) go();
}).catch((e) => {
  console.error(e);
  document.getElementById('btn-start').textContent = 'Tu navegador no soporta WebGL2';
});
