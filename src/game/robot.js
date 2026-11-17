import * as THREE from 'three';
import { GROUPS, teleport } from '../engine/physics.js';

export const MAT = {
  shell: new THREE.MeshPhysicalMaterial({ color: 0xc4c2bd, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12 }),
  accent: new THREE.MeshPhysicalMaterial({ color: 0xff7a1a, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.85 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xaab0ba, roughness: 0.28, metalness: 1 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x030508, roughness: 0.06, metalness: 0.4, clearcoat: 1 }),
};
export const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _up = V(), _fw = V(), _ax = V(), _t = V(), _eul = new THREE.Euler();
const UP = V(0, 1, 0);

const FACES = {
  idle: (g) => { eye(g, 78, 64, 26, 34); eye(g, 178, 64, 26, 34); },
  blink: (g) => { g.fillRect(52, 60, 52, 8); g.fillRect(152, 60, 52, 8); },
  happy: (g) => { arc(g, 78, 74, 26, Math.PI, 0); arc(g, 178, 74, 26, Math.PI, 0); },
  shock: (g) => { ring(g, 78, 64, 30); ring(g, 178, 64, 30); },
  angry: (g) => { eye(g, 78, 70, 26, 26); eye(g, 178, 70, 26, 26); g.fillStyle = '#000'; tri(g, 40, 30, 120, 30, 120, 66); tri(g, 216, 30, 136, 30, 136, 66); },
  sad: (g) => { eye(g, 78, 70, 24, 28); eye(g, 178, 70, 24, 28); g.fillStyle = '#000'; tri(g, 40, 30, 120, 30, 40, 66); tri(g, 216, 30, 136, 30, 216, 66); },
  sus: (g) => { eye(g, 78, 64, 26, 34); g.fillRect(150, 58, 56, 14); },
  dizzy: (g) => { cross(g, 78, 64, 22); cross(g, 178, 64, 22); },
  off: () => {},
};
function eye(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); }
function ring(g, x, y, r) { g.lineWidth = 9; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
function arc(g, x, y, r, a, b) { g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.arc(x, y, r, a, b); g.stroke(); }
function tri(g, a, b, c, d, e, f) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.lineTo(e, f); g.fill(); }
function cross(g, x, y, r) { g.lineWidth = 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke(); }

export class Robot {
  constructor(game, pos) {
    this.game = game;
    const { physics, gfx } = game, scene = gfx.scene;
    this.parts = [];
    this.stun = 0; this.dashT = 0; this.dashCd = 0; this.yaw = 0; this.dashDir = V(0, 0, 1);
    this.lastV = V(); this.onBonk = null; this.falls = 0; this.frozen = false; this.lookAt = null;
    this.holdT = 0; this.charge = 0; this.superT = 0; this.sq = 0; this.sqV = 0; this.st = 0; this.stV = 0; this.dustT = 0; this.dashSpeed = 15; this.dashes = 0;

    // --- chassis ---
    const body = new THREE.Group();
    const pts = [[0.0, -0.5], [0.2, -0.5], [0.33, -0.42], [0.4, -0.2], [0.42, 0.05], [0.38, 0.3], [0.28, 0.48], [0.14, 0.56], [0, 0.58]].map((p) => new THREE.Vector2(p[0], p[1]));
    const shell = new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(28), 40), MAT.shell);
    body.add(shell);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.415, 0.035, 12, 48), MAT.accent); band.rotation.x = Math.PI / 2; band.position.y = 0.02; body.add(band);
    const wheel = this.wheel = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), MAT.rubber); wheel.position.y = -0.4; body.add(wheel);
    const skirt = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 10, 32), MAT.steel); skirt.rotation.x = Math.PI / 2; skirt.position.y = -0.47; body.add(skirt);
    this.coreMat = new THREE.MeshStandardMaterial({ color: 0x08222c, emissive: 0x39d8ff, emissiveIntensity: 2.4, roughness: 0.3 });
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.085, 24), this.coreMat); core.position.set(0, 0.2, 0.405); core.rotation.x = -0.12; body.add(core);
    const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), MAT.steel); coreRing.position.copy(core.position); coreRing.rotation.x = -0.12; body.add(coreRing);
    for (const s of [-1, 1]) { const sh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), MAT.steel); sh.position.set(s * 0.4, 0.3, 0); body.add(sh); }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.16, 16), MAT.steel); neck.position.y = 0.62; body.add(neck);
    scene.add(shadowed(body));
    this.chassis = physics.add({ mesh: body, pos: [pos.x, pos.y + 0.62, pos.z], shapes: [{ kind: 'capsule', size: [0.36, 0.25] }], density: 2.2, friction: 0.25, restitution: 0.05,
      group: GROUPS.robot, linDamp: 0.1, angDamp: 0.6, ccd: true, canSleep: false, tag: 'robot' });

    // --- head ---
    const head = new THREE.Group();
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.27, 32, 24), MAT.shell); skull.scale.set(1.28, 0.9, 1.05); head.add(skull);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.262, 32, 16, -Math.PI * 0.42 + Math.PI / 2, Math.PI * 0.84, Math.PI * 0.3, Math.PI * 0.36), MAT.glass);
    visor.scale.set(1.3, 0.93, 1.1); visor.rotation.y = -Math.PI / 2 + Math.PI / 2; head.add(visor);
    this.faceCanvas = document.createElement('canvas'); this.faceCanvas.width = 256; this.faceCanvas.height = 128;
    this.faceTex = new THREE.CanvasTexture(this.faceCanvas); this.faceTex.colorSpace = THREE.SRGBColorSpace;
    this.faceMat = new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.268, 24, 12, Math.PI / 2 - 0.62, 1.24, Math.PI / 2 - 0.3, 0.6), this.faceMat);
    face.scale.set(1.3, 0.93, 1.1); head.add(face);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 20), MAT.accent); ear.rotation.z = Math.PI / 2; ear.position.set(s * 0.345, 0, 0); head.add(ear); }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), MAT.steel); ant.position.set(0.12, 0.36, -0.05); head.add(ant);
    this.tipMat = new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xff7a1a, emissiveIntensity: 3 });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), this.tipMat); tip.position.set(0.12, 0.52, -0.05); head.add(tip);
    scene.add(shadowed(head)); face.castShadow = false;
    this.head = physics.add({ mesh: head, pos: [pos.x, pos.y + 1.52, pos.z], shapes: [{ kind: 'ball', size: [0.25] }], density: 0.5, group: GROUPS.robot, angDamp: 2, linDamp: 0.2, canSleep: false });
    // a vertical hinge, not a ball joint: the head can turn to look at things but always stays on the neck,
    // even when the body is tumbling. The floppiness is added on top, visually, by a spring in update().
    physics.hinge(this.chassis, this.head, [0, 0.66, 0], [0, -0.24, 0], [0, 1, 0]);
    this.nod = new THREE.Vector2(); this.nodV = new THREE.Vector2(); this.lastHV = V();

    // --- arms (pure ragdoll: they just hang and swing) ---
    this.hands = [];
    for (const s of [-1, 1]) {
      const mk = (len, r, extra) => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), MAT.shell); g.add(m);
        extra && extra(g);
        scene.add(shadowed(g));
        return g;
      };
      const upper = physics.add({ mesh: mk(0.22, 0.065), pos: [pos.x + s * 0.5, pos.y + 0.72, pos.z], shapes: [{ kind: 'capsule', size: [0.065, 0.11] }], density: 0.6, group: GROUPS.robot, angDamp: 1.5, linDamp: 0.3, canSleep: false });
      physics.joint(this.chassis, upper, [s * 0.47, 0.3, 0], [0, 0.2, 0]);
      const fore = physics.add({
        mesh: mk(0.22, 0.06, (g) => {
          const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), MAT.accent); hand.position.y = -0.2; g.add(hand);
          const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), MAT.steel); elbow.position.y = 0.2; g.add(elbow);
          if (s === 1) { // the mop
            const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.0, 8), MAT.steel); stick.position.set(0, -0.3, 0.16); stick.rotation.x = -0.45; g.add(stick);
            const mop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.16, 0.14, 14), new THREE.MeshStandardMaterial({ color: 0x4fb7ff, roughness: 1 })); mop.position.set(0, -0.76, 0.38); g.add(mop);
          }
        }), pos: [pos.x + s * 0.5, pos.y + 0.32, pos.z], shapes: [{ kind: 'capsule', size: [0.06, 0.11] }], density: 0.5, group: GROUPS.robot, angDamp: 1.5, linDamp: 0.3, canSleep: false,
      });
      physics.joint(upper, fore, [0, -0.2, 0], [0, 0.2, 0]);
      this.parts.push(upper, fore); this.hands.push(fore);
    }
    this.parts.push(this.chassis, this.head);

    // marionette strings (hidden until the reveal)
    this.stringMat = new THREE.LineBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.strings = [this.head, this.hands[0], this.hands[1], this.chassis].map(() => {
      const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, this.stringMat); l.frustumCulled = false; scene.add(l); return l;
    });
    this.stringTop = 60;

    this.expr = ''; this.blinkT = 2; this.face('idle');
    this.pos = V(pos.x, pos.y, pos.z);
  }

  face(name) {
    if (this.expr === name) return;
    this.expr = name; this._draw(name);
  }
  _draw(name) {
    const g = this.faceCanvas.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = g.strokeStyle = name === 'angry' ? '#ff6a4d' : '#7fe9ff';
    g.shadowColor = g.fillStyle; g.shadowBlur = 14;
    (FACES[name] || FACES.idle)(g);
    this.faceTex.needsUpdate = true;
  }

  get position() { const t = this.chassis.body.translation(); return this.pos.set(t.x, t.y - 0.62, t.z); }
  get speed() { const v = this.chassis.body.linvel(); return Math.hypot(v.x, v.z); }

  teleport(x, y, z, yaw = this.yaw) {
    const t = this.chassis.body.translation(), dx = x - t.x, dy = y + 0.62 - t.y, dz = z - t.z;
    for (const p of this.parts) { const q = p.body.translation(); teleport(p, q.x + dx, q.y + dy, q.z + dz); }
    this.yaw = yaw; this.stun = 0; this.lastV.set(0, 0, 0);
    _q.setFromAxisAngle(UP, yaw);
    this.chassis.body.setRotation(_q, true); this.head.body.setRotation(_q, true);
    const hp = this.chassis.body.translation(); teleport(this.head, hp.x, hp.y + 0.9, hp.z);
  }

  /** go limp for `dur` seconds, optionally with a shove */
  knock(dur, impulse = null) {
    this.stun = Math.max(this.stun, dur); this.dashT = 0; this.charge = 0; this.holdT = 0; this.superT = 0;
    if (impulse) {
      this.chassis.body.applyImpulse(impulse, true);
      this.chassis.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 4 }, true);
    }
    if (dur < 50) this.face('dizzy');
  }

  /** called once per fixed physics step */
  step(dt, mx, mz, wantDash, held = false) {
    const b = this.chassis.body, v = b.linvel();
    // detect being hit by something (or bonking a wall mid-dash)
    const dv = Math.hypot(v.x - this.lastV.x, v.y - this.lastV.y, v.z - this.lastV.z);
    if (dv > 8.5 && this.stun <= 0 && !this.frozen) {
      const dashing = this.dashT > 0;
      this.knock(dashing ? 0.55 : 1.3);
      this.game.audio.clank(dashing ? 0.7 : 1);
      this.game.gfx.shake(dashing ? 0.25 : 0.45);
      this.game.gfx.particles.burst(this.position.clone().setY(this.pos.y + 0.6), 14, { color: 0xffc070, speed: 5, life: 0.5, size: 0.12 });
      if (dashing && this.onBonk) this.onBonk(this.position);
      this.sqV += 9; this.game.hitstop(dashing ? 0.05 : 0.09); this.game.buzz(dashing ? 25 : 60);
      this.game.pop(this.position.clone().setY(this.pos.y + 1.6), ['¡PAF!', '¡CLONC!', '¡AY!', '¡POM!', '¡ÑEC!'][(Math.random() * 5) | 0], '#ffd24a');
    }
    // landing
    if (this.lastV.y < -7 && v.y > -1.5 && dv <= 8.5) { this.sqV += 7; this.game.gfx.particles.burst(this.position.clone(), 16, { color: 0xbbbbcc, speed: 4, life: 0.5, size: 0.3, up: 0.2, gravity: -1, drag: 3 }); }
    this.superT -= dt;
    this.dashCd -= dt;
    if (this.stun > 0) {
      this.stun -= dt;
      this._turnHead(0); // just ride along with the body
      if (this.stun <= 0) { this.face('idle'); this.game.audio.beep(true); }
      this.lastV.set(v.x, v.y, v.z);
      return;
    }
    if (this.frozen) { mx = 0; mz = 0; wantDash = false; held = false; }
    const moving = Math.hypot(mx, mz) > 0.05;
    if (moving) this.yaw = Math.atan2(mx, mz);
    // hold to charge, release for a super dash
    if (held && this.dashT <= 0) {
      this.holdT += dt; const c = Math.min(1, Math.max(0, (this.holdT - 0.28) / 0.8));
      if (c > 0 && Math.floor(this.holdT * 12) !== Math.floor((this.holdT - dt) * 12)) this.game.audio.charge(c);
      this.charge = c;
      if (c > 0) {
        mx *= 0.4; mz *= 0.4; this.sq = -0.12 * c + Math.sin(this.holdT * 50) * 0.03 * c;
        const p = this.position; this.game.gfx.particles.burst(V(p.x, p.y + 0.5, p.z), 1, { color: c >= 1 ? 0xffffff : 0x6fe3ff, speed: 3 + c * 4, life: 0.3, size: 0.12 + c * 0.2, gravity: 4, spread: 2 });
        if (c >= 1) this.game.gfx.shake(0.06);
      }
    } else if (this.charge > 0.3) {
      const c = this.charge; this.charge = 0; this.holdT = 0;
      this.dashT = 0.3 + c * 0.16; this.superT = this.dashT + 0.12; this.dashCd = 0.9; this.dashSpeed = 17 + c * 9; this.dashes++;
      this.dashDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.game.audio.superDash(); this.game.gfx.speed = 1; this.game.gfx.shake(0.3); this.stV -= 14; this.game.buzz(40);
      this.game.gfx.cam.fov = 50; setTimeout(() => (this.game.gfx.cam.fov = 42), 420);
      this.game.gfx.particles.burst(this.position.clone().setY(this.pos.y + 0.4), 40, { color: 0x6fe3ff, speed: 8, life: 0.6, size: 0.25, gravity: 0 });
      this.game.pop(this.position.clone().setY(this.pos.y + 1.8), '¡TURBOFREGONA!', '#6fe3ff');
    } else { this.charge = 0; if (!held) this.holdT = 0; }
    if (wantDash && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashT = 0.26; this.dashCd = 0.75; this.dashSpeed = 15; this.stV -= 8; this.game.gfx.speed = Math.max(this.game.gfx.speed, 0.5); this.dashes++;
      this.dashDir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.game.audio.dash();
      this.game.gfx.cam.fov = 46; setTimeout(() => (this.game.gfx.cam.fov = 42), 260);
    }
    let tx = mx * 6.4, tz = mz * 6.4, k = 1 - Math.exp(-dt * 11);
    if (this.dashT > 0) {
      this.dashT -= dt; tx = this.dashDir.x * this.dashSpeed; tz = this.dashDir.z * this.dashSpeed; k = 1 - Math.exp(-dt * 40);
      this.game.gfx.particles.burst(this.position.clone().setY(this.pos.y + 0.3), 2, { color: this.superT > 0 ? 0xffffff : 0x6fe3ff, speed: 1, life: 0.4, size: this.superT > 0 ? 0.4 : 0.2, gravity: 0 });
    }
    const nx = v.x + (tx - v.x) * k, nz = v.z + (tz - v.z) * k;
    b.setLinvel({ x: nx, y: v.y, z: nz }, true);
    this.lastV.set(nx, v.y, nz);

    // stay upright (and lean into the motion) by steering angular velocity
    const r = b.rotation(); _q.set(r.x, r.y, r.z, r.w);
    _up.set(0, 1, 0).applyQuaternion(_q); _fw.set(0, 0, 1).applyQuaternion(_q);
    _t.set((tx - v.x) * 0.02 + nx * 0.012, 1, (tz - v.z) * 0.02 + nz * 0.012).normalize();
    _ax.crossVectors(_up, _t).multiplyScalar(16);
    let dy = this.yaw - Math.atan2(_fw.x, _fw.z); dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    _ax.y += dy * 10;
    const av = b.angvel(), ka = 1 - Math.exp(-dt * 16);
    b.setAngvel({ x: av.x + (_ax.x - av.x) * ka, y: av.y + (_ax.y - av.y) * ka, z: av.z + (_ax.z - av.z) * ka }, true);

    // head: turns on its hinge to look where it is going (or at something)
    const hb = this.head.body, hr = hb.rotation(); _q.set(hr.x, hr.y, hr.z, hr.w);
    _fw.set(0, 0, 1).applyQuaternion(_q);
    let hy = this.yaw;
    if (this.lookAt) { const p = hb.translation(); hy = Math.atan2(this.lookAt.x - p.x, this.lookAt.z - p.z); }
    let dh = hy - Math.atan2(_fw.x, _fw.z); dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    this._turnHead(THREE.MathUtils.clamp(dh * 9, -12, 12));
  }

  /** head spin = body spin + a turn around the neck: never fights the hinge */
  _turnHead(rate) {
    const cb = this.chassis.body, r = cb.rotation(), av = cb.angvel();
    _q.set(r.x, r.y, r.z, r.w); _up.set(0, 1, 0).applyQuaternion(_q);
    this.head.body.setAngvel({ x: av.x + _up.x * rate, y: av.y + _up.y * rate, z: av.z + _up.z * rate }, true);
  }

  update(dt, time) {
    this.wheel.rotation.x += this.speed * dt * 4;
    // squash & stretch springs
    this.sqV += (-this.sq * 220 - this.sqV * 13) * dt; this.sq += this.sqV * dt;
    this.stV += (-this.st * 200 - this.stV * 12) * dt; this.st += this.stV * dt;
    const sq = THREE.MathUtils.clamp(this.sq, -0.4, 0.5), st = THREE.MathUtils.clamp(-this.st, -0.3, 0.6);
    this.chassis.mesh.scale.set(1 + sq * 0.5 - st * 0.35, 1 - sq - st * 0.25, 1 + sq * 0.5 + st);
    this.head.mesh.scale.setScalar(1 + sq * 0.25);
    // bobble-head: a spring tips the head away from sudden changes of speed, pivoting on the neck
    if (dt > 0) {
      const v = this.chassis.body.linvel(), ax = (v.x - this.lastHV.x) / dt, az = (v.z - this.lastHV.z) / dt; this.lastHV.set(v.x, v.y, v.z);
      const k = 140, c = 9, tx = THREE.MathUtils.clamp(-az * 0.012, -0.5, 0.5), tz = THREE.MathUtils.clamp(ax * 0.012, -0.5, 0.5);
      this.nodV.x += ((tx - this.nod.x) * k - this.nodV.x * c) * dt; this.nodV.y += ((tz - this.nod.y) * k - this.nodV.y * c) * dt;
      this.nod.addScaledVector(this.nodV, dt);
      const hm = this.head.mesh;
      _ax.set(0, -0.24, 0).applyQuaternion(hm.quaternion).add(hm.position); // neck, world space
      _q.setFromEuler(_eul.set(this.nod.x, 0, this.nod.y));
      _t.copy(hm.position).sub(_ax).applyQuaternion(_q); hm.position.copy(_ax).add(_t);
      hm.quaternion.premultiply(_q);
    }
    this.coreMat.emissive.setHex(this.charge >= 1 ? 0xffffff : 0x39d8ff);
    // wheel dust
    this.dustT -= dt;
    if (this.dustT < 0 && this.speed > 3.5 && this.stun <= 0 && Math.abs(this.chassis.body.linvel().y) < 1) {
      this.dustT = 0.09; const p = this.position;
      this.game.gfx.particles.burst(V(p.x, p.y + 0.08, p.z), 1, { color: 0x8890a0, speed: 0.8, life: 0.5, size: 0.28, gravity: 1.5, up: 0.3, drag: 3 });
    }
    this.coreMat.emissiveIntensity = 2 + Math.sin(time * 3) * 0.6 + this.charge * 6;
    if (this.expr === 'idle' || this.expr === 'blink') {
      this.blinkT -= dt;
      if (this.blinkT < 0 && this.expr === 'idle') { this.expr = 'blink'; this._draw('blink'); this.blinkT = 0.12; }
      else if (this.blinkT < 0) { this.expr = 'idle'; this._draw('idle'); this.blinkT = 1.5 + Math.random() * 3; }
    }
    if (this.stringMat.opacity > 0.001) {
      const src = [this.head, this.hands[0], this.hands[1], this.chassis];
      this.strings.forEach((l, i) => {
        const p = src[i].mesh.position, a = l.geometry.attributes.position.array;
        a[0] = p.x; a[1] = p.y; a[2] = p.z; a[3] = p.x * 0.6 + this.pos.x * 0.4; a[4] = p.y + this.stringTop; a[5] = p.z;
        l.geometry.attributes.position.needsUpdate = true;
      });
    }
  }
}
