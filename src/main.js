import * as THREE from 'three';
import { Gfx } from './engine/gfx.js';
import { Physics } from './engine/physics.js';
import { Input } from './engine/input.js';
import { Audio } from './engine/audio.js';
import { UI } from './game/ui.js';
import { Robot, loadRobotModel } from './game/robot.js';
import { buildWorld, ARENA_Y } from './game/world.js';
import { spawnDebris, Pelusa, Boss, makePiano } from './game/actors.js';
import { makeBarrels, makeLasers, makeStealth, makeWords, Pages } from './game/extras.js';
import { installProgress, installEnemies, installWeapon, spawnEnemy, clearEnemies, makeStains } from './game/combat.js';
import { buildWarehouse } from './game/levels.js';
import { buildKartTrack } from './game/kart.js';
import { runStory } from './game/story.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

class Game {
  async init() {
    this.gfx = new Gfx(document.getElementById('scene'));
    [this.physics] = await Promise.all([Physics.create(), loadRobotModel()]);
    this.input = new Input();
    this.audio = new Audio();
    this.ui = new UI(this);
    this.temp = []; this.tickers = new Set(); this.steppers = new Set();
    this.time = 0; this.timeScale = 1; this.playTime = 0;
    this.floorY = 0; this.checkpoint = V(0, 0, 2); this.falling = false; this.onFall = null;
    this.focus = null; this.focusMix = 0.5; this.botTarget = null; this.botDash = false;
    this.pelusa = null; this.boss = null; this.pianos = 0; this.lampKick = 0; this.stopT = 0; this.score = 0; this.crates = []; this.smashed = 0;
    this.world = buildWorld(this);
    this.robot = new Robot(this, V(0, 0, 2));
    this.robot.face('off'); this.robot.frozen = true;
    installProgress(this); installEnemies(this); installWeapon(this);
    this.levels = { warehouse: buildWarehouse(this, ARENA_Y), kart: buildKartTrack(this, ARENA_Y) }; // hidden until their scenes; the warm-up compiles them
    this.perf = { worst: 0, long: 0, frames: 0, phys: 0 };
    this._warmup();

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

  /**
   * Build one of everything that appears later, draw a single frame with every object
   * forced visible, then throw the extras away. This compiles all shaders and uploads all
   * textures behind the loading screen instead of stalling the first time each thing shows up.
   */
  _warmup() {
    const { gfx, physics } = this, scene = gfx.scene, far = -400, bodies = [];
    const pel = new Pelusa(this, [0, far, 0]); bodies.push(pel.ent);
    bodies.push(makePiano(this, [4, far, 0]));
    const boss = new Boss(this, V(10, far, 0)); bodies.push(boss.ent, ...boss.hose);
    const br = makeBarrels(this, [[16, 0]], far); br.stop(); bodies.push(...br.list);
    const ls = makeLasers(this, far, [0]), st = makeStealth(this, far), wd = makeWords(this, V(0, far, 0));
    const pg = new Pages(this); pg.add(0, far, 4, '');
    for (const t of ['pelusa', 'calcetin', 'grapadora', 'extra']) spawnEnemy(this, t, 20, far, 0);
    const st0 = makeStains(this, [[22, 0]], far);
    this.onWarmup && this.onWarmup(far);
    spawnDebris(this, V(0, far, 8), 2, { emissive: 0.5 });
    const state = [];
    scene.traverse((o) => { state.push([o, o.visible, o.frustumCulled]); o.visible = true; o.frustumCulled = false; });
    gfx.cam.snap = true; gfx.update(0, 0); gfx.render();
    for (const [o, v, f] of state) { o.visible = v; o.frustumCulled = f; }
    gfx.point(99, { intensity: 0 }); // the boss borrowed the last pool light: take it back before deleting the boss
    ls.dispose(); st.dispose(); wd.dispose(); pg.dispose(); st0.dispose(); clearEnemies(this); this.prog.kills = 0;
    for (const e of bodies) physics.remove(e);
    for (const t of this.temp) physics.remove(t.e);
    this.temp.length = 0; this.pianos = 0; this.crates = this.crates.filter((c) => c.alive);
  }

  _autopilot(mode) {
    this.ui.auto = mode; this.ui.fast = !new URLSearchParams(location.search).get('real');
    let holdT = 0;
    this.input.bot = () => {
      const tgt = typeof this.botTarget === 'function' ? this.botTarget() : this.botTarget;
      if (!tgt || !this.input.enabled) return null;
      const p = this.robot.position, dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.25) return { x: 0, y: 0, action: false };
      // charge-and-release when asked to (the bot really performs the super dash)
      let hold = false;
      if (this.botCharge && d < 4.5) { holdT += 1 / 60; hold = holdT % 1.9 < 1.4; } else holdT = 0;
      const { fx, fz } = this._camBasis();
      const wx = dx / d, wz = dz / d;
      return { x: wx * -fz + wz * fx, y: -(wx * fx + wz * fz), action: this.botDash === 'spam' ? Math.random() < 0.08 : this.botDash && d < 3.5, hold };
    };
  }

  _camBasis() {
    const o = this.gfx.cam.curOffset, l = Math.hypot(o.x, o.z) || 1;
    return { fx: -o.x / l, fz: -o.z / l };
  }

  hitstop(sec) { this.stopT = Math.max(this.stopT, sec); }
  buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported */ } }
  /** comic-book popup at a world position */
  pop(pos, text, color = '#fff', big = false) {
    _v.copy(pos).project(this.gfx.camera);
    if (_v.z > 1) return;
    this.ui.pop((_v.x * 0.5 + 0.5) * innerWidth, (-_v.y * 0.5 + 0.5) * innerHeight, text, color, big);
  }
  addScore(n, pos) { this.score += n; this.ui.score(this.score); if (pos) this.pop(pos, '+' + n, '#f2c14e'); }
  // waits started before a defeat never resolve: the abandoned attempt simply stops (see game.trial)
  sleep(sec) { if (this.ui.fast) sec = Math.min(sec, 0.12); const ep = this.epoch; return new Promise((res) => { let t = 0; const f = (dt) => { if (this.epoch !== ep) { this.tickers.delete(f); return; } t += dt; if (t >= sec) { this.tickers.delete(f); res(); } }; this.tickers.add(f); }); }
  until(cond, timeout = 1e9) { const ep = this.epoch; return new Promise((res) => { let t = 0; const f = (dt) => { if (this.epoch !== ep) { this.tickers.delete(f); return; } t += dt; if (cond() || t > timeout) { this.tickers.delete(f); res(); } }; this.tickers.add(f); }); }

  start() {
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const gap = now - last, pf = this.perf;
      pf.frames++; if (gap > pf.worst) pf.worst = gap; if (gap > 120) pf.long++;
      // never negative: after a long task (the shader warm-up) the first rAF timestamp can be seconds older than `last`,
      // and a negative step makes flash and camera shake grow instead of decay
      const raw = Math.min(0.05, Math.max(0, gap / 1000)); last = Math.max(last, now);
      const c0 = performance.now();
      try { step(raw); } catch (e) { if (!this.crashed) { this.crashed = e; console.error('frame error', e); } }
      const cpu = performance.now() - c0; pf.cpu = (pf.cpu || 0) + cpu; if (cpu > (pf.cpuWorst || 0)) pf.cpuWorst = cpu;
      pf.programs = this.gfx.renderer.info.programs.length;
    };
    const step = (raw) => {
      let dt = raw * this.timeScale;
      if (this.stopT > 0) { this.stopT -= raw; dt *= 0.04; }
      if (this.paused3d) dt = 0;
      this.time += dt; this.playTime += raw;
      const { input, robot, gfx, world: W } = this;
      input.update();
      if (this.paused3d) { input.btn.classList.remove('cool'); return; } // a 2D minigame owns the screen: skip the whole 3D frame
      const { fx, fz } = this._camBasis();
      const mx = input.move.x * -fz + -input.move.y * fx, mz = input.move.x * fx + -input.move.y * fz;
      let dash = input.action();
      this.input.btn.classList.toggle('cool', robot.dashCd > 0);
      this.physics.update(dt, (h) => {
        robot.step(h, mx, mz, dash, input.held); dash = false;
        this.pelusa && this.pelusa.step(h);
        this.boss && this.boss.step(h, robot);
        for (const s of this.steppers) s(h);
      });
      this.physics.sync();
      robot.update(dt, this.time);
      this.boss && this.boss.update(dt);
      if (!this.paused3d) for (const t of [...this.tickers]) t(dt, raw);

      // temporary bodies
      for (let i = this.temp.length - 1; i >= 0; i--) {
        const t = this.temp[i]; t.t -= dt;
        if (!t.e.alive) { this.temp.splice(i, 1); continue; } // removed elsewhere: touching a freed Rapier body panics the whole physics world
        if (t.t <= 0 || t.e.body.translation().y < this.floorY - 60) {
          if (t.poof && t.e.alive) { const p = t.e.body.translation(); gfx.particles.burst(V(p.x, p.y, p.z), 30, { color: 0x35f0c8, speed: 5, life: 0.6, size: 0.25, gravity: 0 }); }
          this.physics.remove(t.e); this.temp.splice(i, 1);
        }
      }

      // a super dash goes through crates
      if (robot.superT > 0) for (let i = this.crates.length - 1; i >= 0; i--) {
        const c = this.crates[i]; if (!c.alive) { this.crates.splice(i, 1); continue; }
        const t = c.body.translation(), p = robot.position;
        if (Math.hypot(t.x - p.x, t.z - p.z) < 1.5 && Math.abs(t.y - p.y - 0.6) < 1.6) {
          const cp = V(t.x, t.y, t.z); this.physics.remove(c); this.crates.splice(i, 1); this.smashed++;
          spawnDebris(this, cp, 12, { color: 0x9a6b3c, size: 0.22, speed: 8 }); this.audio.thud(1.2); this.hitstop(0.05); this.gfx.shake(0.3);
          this.pop(cp, '¡CRAC!', '#ffb060'); this.addScore(100, cp.setY(cp.y + 0.8));
          this.onSmash && this.onSmash(this.smashed);
        }
      }

      // fell out of the world
      const rp = robot.position;
      if (!this.falling && rp.y < this.floorY - 14) {
        robot.falls++;
        if (this.danger) { robot.hp = Math.max(0, robot.hp - 1); this.prog.hud(); if (robot.hp <= 0) this.dead = true; } // falling off costs a heart
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
  mute.onclick = () => { game.audio.setMuted(!game.audio.muted); mute.classList.toggle('off', game.audio.muted); game.onMute && game.onMute(game.audio.muted); };
  const go = () => {
    btn.onclick = null; game.focus = null;
    game.audio.start();
    document.getElementById('title').classList.add('hidden');
    runStory(game).catch((e) => {
      // a real error, not one of the Narrator's: say so and offer the only honest way out
      console.error('story error', e); game.storyError = e;
      document.body.classList.remove('cine', 'glitch', 'modal');
      const f = document.getElementById('fake'); f.className = 'dark';
      f.innerHTML = '<div class="win"><header>Por el bien de la trama</header><div class="c"><i>!</i><div><b>El guion se ha roto de verdad</b><br/>Esto no es un chiste del Narrador: ha fallado algo en el juego. Recarga para volver a empezar.</div></div><footer><button>Recargar</button></footer></div>';
      f.querySelector('button').onclick = () => location.reload();
    });
  };
  btn.onclick = go;
  const only = new URLSearchParams(location.search).get('mini'); // debug: jump straight into a 2D minigame
  if (only) {
    import('./game/mini2d.js').then(async ({ Mini2D }) => {
      document.getElementById('title').classList.add('hidden'); game.audio.start(); game.ui.showControls(true);
      const m = new Mini2D(game); window.__mini = m;
      if (only === 'fight') { const { fightCritic } = await import('./game/fight2d.js'); console.log('mini result', await fightCritic(m)); }
      else if (m[only]) console.log('mini result', await m[only]());
    });
  } else if (game.ui.auto) go();
}).catch((e) => {
  console.error(e);
  document.getElementById('btn-start').textContent = 'Tu navegador no soporta WebGL2';
});
