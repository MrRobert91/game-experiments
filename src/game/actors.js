import * as THREE from 'three';
import { GROUPS } from '../engine/physics.js';
import { canvasTex, noiseTex } from '../engine/gfx.js';
import { MAT, shadowed } from './robot.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const _q = new THREE.Quaternion(), _up = V(), _fw = V(), _ax = V();

// ---------- debris ----------
const debrisGeo = new THREE.BoxGeometry(1, 1, 1);
export function spawnDebris(game, pos, n, { color = 0x888888, size = 0.18, speed = 6, life = 6, mat = null, up = 1, emissive = 0 } = {}) {
  const m = mat || new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: emissive ? color : 0, emissiveIntensity: emissive });
  for (let i = 0; i < n; i++) {
    const s = [size * (0.5 + Math.random()), size * (0.4 + Math.random() * 0.8), size * (0.5 + Math.random())];
    const mesh = new THREE.Mesh(debrisGeo, m); mesh.scale.set(...s); mesh.castShadow = true;
    game.gfx.scene.add(mesh);
    const e = game.physics.add({ mesh, pos: [pos.x + (Math.random() - 0.5) * 0.8, pos.y + Math.random() * 0.6, pos.z + (Math.random() - 0.5) * 0.8], shapes: [{ kind: 'box', size: s }], density: 0.6, group: GROUPS.debris, angDamp: 0.4 });
    const a = Math.random() * 6.28, sp = speed * (0.4 + Math.random() * 0.8);
    e.body.setLinvel({ x: Math.cos(a) * sp, y: sp * up * (0.5 + Math.random()), z: Math.sin(a) * sp }, true);
    e.body.setAngvel({ x: Math.random() * 16 - 8, y: Math.random() * 16 - 8, z: Math.random() * 16 - 8 }, true);
    game.temp.push({ e, t: life * (0.7 + Math.random() * 0.6) });
  }
}

// ---------- crates & cones ----------
const woodTex = (label) => canvasTex(256, 256, (g) => {
  g.fillStyle = '#9a6b3c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(${60 + Math.random() * 40},${35 + Math.random() * 20},10,.35)`; g.fillRect(0, i * 51 + 2, 256, 47); }
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(40,20,5,${Math.random() * 0.25})`; g.beginPath(); const y = Math.random() * 256; g.moveTo(0, y); g.bezierCurveTo(80, y + Math.random() * 8 - 4, 170, y + Math.random() * 8 - 4, 256, y); g.stroke(); }
  g.strokeStyle = '#5a3a1a'; g.lineWidth = 22; g.strokeRect(11, 11, 234, 234);
  g.save(); g.translate(128, 128); g.rotate(-0.12); g.fillStyle = 'rgba(20,10,0,.8)'; g.font = '800 30px system-ui, sans-serif'; g.textAlign = 'center';
  const ls = label.split('|'); ls.forEach((l, i) => g.fillText(l, 0, (i - (ls.length - 1) / 2) * 34 + 10, 200)); g.restore();
});
const crateBump = noiseTex(128, { contrast: 2 });
export function makeCrate(game, pos, size = 1, label = 'ATREZO') {
  const mat = new THREE.MeshStandardMaterial({ map: woodTex(label), roughness: 0.8, bumpMap: crateBump, bumpScale: 0.6 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat); mesh.castShadow = mesh.receiveShadow = true;
  game.gfx.scene.add(mesh);
  return game.physics.add({ mesh, pos: [pos[0], pos[1] + size / 2, pos[2]], rotY: Math.random() * 0.6 - 0.3, shapes: [{ kind: 'box', size: [size, size, size] }], density: 0.35, friction: 0.6, impact: 250, tag: 'crate' });
}
export function makeCone(game, pos) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0xff5a1a, roughness: 0.5 })); c.position.y = 0.05; g.add(c);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.14, 0.1, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })); st.position.y = 0.04; g.add(st);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), MAT.rubber); base.position.y = -0.25; g.add(base);
  game.gfx.scene.add(shadowed(g));
  return game.physics.add({ mesh: g, pos: [pos[0], pos[1] + 0.28, pos[2]], shapes: [{ kind: 'cyl', size: [0.2, 0.27] }], density: 0.25 });
}

// ---------- Pelusa ----------
export class Pelusa {
  constructor(game, pos) {
    this.game = game; this.alive = true; this.follow = null; this.hold = null; this.t = 0;
    const g = this.mesh = new THREE.Group();
    const bodyM = new THREE.MeshPhysicalMaterial({ color: 0xff9ccc, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    const pts = [[0, -0.07], [0.3, -0.07], [0.36, -0.03], [0.36, 0.03], [0.32, 0.07], [0, 0.085]].map((p) => new THREE.Vector2(p[0], p[1]));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 40), bodyM));
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32), MAT.glass); top.position.y = 0.085; g.add(top);
    const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.022, 8, 40), MAT.steel); bumper.rotation.x = Math.PI / 2; g.add(bumper);
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x220011, emissive: 0xffffff, emissiveIntensity: 3 });
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), this.eyeMat); e.position.set(s * 0.09, 0.09, 0.26); e.scale.y = 0.7; g.add(e); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.4, 6), MAT.steel); pole.position.set(0, 0.28, -0.2); g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.12), new THREE.MeshStandardMaterial({ color: 0xffe14d, side: THREE.DoubleSide, emissive: 0xffe14d, emissiveIntensity: 0.4 })); flag.position.set(0.09, 0.42, -0.2); g.add(flag);
    game.gfx.scene.add(shadowed(g));
    this.ent = game.physics.add({ mesh: g, pos: [pos[0], pos[1] + 0.09, pos[2]], shapes: [{ kind: 'cyl', size: [0.36, 0.075] }], density: 1.2, friction: 0.1, group: GROUPS.prop, angDamp: 4, linDamp: 1, canSleep: false });
    this.ent.body.setEnabledRotations(false, true, false, true);
  }
  get position() { const t = this.ent.body.translation(); return V(t.x, t.y, t.z); }
  step(dt) {
    if (!this.alive) return;
    this.t += dt;
    const b = this.ent.body, p = b.translation(), v = b.linvel();
    let tx = 0, tz = 0, face = null;
    const goal = this.hold || (this.follow && this.follow());
    if (goal) {
      const dx = goal.x - p.x, dz = goal.z - p.z, d = Math.hypot(dx, dz), min = this.hold ? 0.12 : 1.5;
      if (d > min) { const s = Math.min(5.5, (d - min) * 4 + 0.6); tx = dx / d * s; tz = dz / d * s; }
      face = Math.atan2(dx, dz);
    }
    b.setLinvel({ x: v.x + (tx - v.x) * 0.2, y: v.y, z: v.z + (tz - v.z) * 0.2 }, true);
    if (face !== null) {
      const r = b.rotation(); _q.set(r.x, r.y, r.z, r.w); _fw.set(0, 0, 1).applyQuaternion(_q);
      let d = face - Math.atan2(_fw.x, _fw.z); d = Math.atan2(Math.sin(d), Math.cos(d));
      b.setAngvel({ x: 0, y: d * 8 + Math.sin(this.t * 6) * 0.6, z: 0 }, true);
    }
  }
  crush() {
    if (!this.alive) return;
    this.alive = false;
    const p = this.position, game = this.game;
    game.physics.remove(this.ent);
    spawnDebris(game, p, 14, { color: 0xff9ccc, size: 0.14, speed: 7 });
    spawnDebris(game, p, 6, { color: 0xaab0ba, size: 0.08, speed: 8 });
    game.gfx.particles.burst(p, 60, { color: 0xffb0d8, speed: 8, life: 1.1, size: 0.2 });
  }
}

// ---------- piano ----------
const keysTex = canvasTex(512, 64, (g) => {
  g.fillStyle = '#f4f0e6'; g.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 36; i++) { g.fillStyle = '#222'; g.fillRect(i * 14.2, 0, 1.2, 64); if (![2, 6].includes(i % 7)) { g.fillStyle = '#0a0a0a'; g.fillRect(i * 14.2 + 9.5, 0, 8.5, 38); } }
});
const pianoMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, metalness: 0.1 });
const brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 1 });
let pianoGeo = null;
export function makePiano(game, pos, { rotY = 0, vy = 0 } = {}) {
  if (!pianoGeo) {
    const s = new THREE.Shape();
    s.moveTo(-0.78, 0.55); s.lineTo(0.78, 0.55); s.lineTo(0.78, -0.2);
    s.bezierCurveTo(0.78, -0.75, 0.3, -0.6, 0.15, -1.0); s.bezierCurveTo(0.0, -1.4, -0.78, -1.45, -0.78, -0.9); s.closePath();
    pianoGeo = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 20 });
    pianoGeo.rotateX(Math.PI / 2); pianoGeo.translate(0, 0.18, 0);
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(pianoGeo, pianoMat); body.position.y = 0.34; g.add(body);
  const lid = new THREE.Mesh(pianoGeo, pianoMat); lid.scale.y = 0.08; lid.position.set(-0.78, 0.56, 0); lid.rotation.z = 0.55; lid.geometry = pianoGeo.clone().translate(0.78, 0, 0); g.add(lid);
  const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), brass); prop.position.set(0.45, 0.82, -0.35); prop.rotation.z = -0.25; g.add(prop);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.24), new THREE.MeshStandardMaterial({ map: keysTex, roughness: 0.3 })); kb.position.set(0, 0.26, 0.68); g.add(kb);
  const kbase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.3), pianoMat); kbase.position.set(0, 0.19, 0.66); g.add(kbase);
  for (const [x, z] of [[-0.62, 0.45], [0.62, 0.45], [-0.25, -1.1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.035, 0.7, 12), pianoMat); leg.position.set(x, -0.2, z); g.add(leg);
    const w = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), brass); w.position.set(x, -0.56, z); g.add(w);
  }
  game.gfx.scene.add(shadowed(g));
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 0.5 - 0.25, rotY, Math.random() * 0.5 - 0.25));
  const e = game.physics.add({ mesh: g, pos, quat: q, shapes: [{ kind: 'box', size: [1.56, 0.5, 2.0], pos: [0, 0.3, -0.35] }, { kind: 'box', size: [1.3, 0.6, 1.5], pos: [0, -0.28, -0.3], density: 0.4 }], density: 2.2, friction: 0.6, impact: 900, ccd: true, tag: 'piano' });
  e.body.setLinvel({ x: 0, y: vy, z: 0 }, true);
  e.body.setAngvel({ x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 }, true);
  e.fresh = true;
  return e;
}

// ---------- El Aspirador ----------
export class Boss {
  constructor(game, pos) {
    this.game = game; this.hp = 3; this.state = 'intro'; this.t = 0; this.dir = V(0, 0, 1); this.yaw = Math.PI; this.hitDone = false;
    this.onCrash = null; this.onHitPlayer = null; this.flash = 0; this.wallCounts = false;
    const g = new THREE.Group();
    const black = new THREE.MeshPhysicalMaterial({ color: 0x0b0c10, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, metalness: 0.3 });
    this.bodyMat = black;
    const pts = [[0, -0.9], [0.95, -0.9], [1.05, -0.75], [1.05, 0.45], [0.95, 0.72], [0.6, 0.9], [0, 0.95]].map((p) => new THREE.Vector2(p[0], p[1]));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(30), 48), black));
    this.glowMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a2e, emissiveIntensity: 2.5 });
    for (const y of [-0.55, 0.5]) { const r = new THREE.Mesh(new THREE.TorusGeometry(1.06, 0.03, 8, 64), this.glowMat); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    const chrome = new THREE.Mesh(new THREE.TorusGeometry(1.07, 0.06, 10, 64), MAT.steel); chrome.rotation.x = Math.PI / 2; chrome.position.y = -0.05; g.add(chrome);
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.2, 32), MAT.steel); socket.rotation.x = Math.PI / 2; socket.position.set(0, 0.2, 0.98); g.add(socket);
    this.eyeMat = new THREE.MeshStandardMaterial({ color: 0x110000, emissive: 0xff2a2a, emissiveIntensity: 4 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), this.eyeMat); eye.position.set(0, 0.2, 1.0); eye.scale.z = 0.5; g.add(eye);
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.045, 0.05), MAT.steel); s.position.set(0, -0.3 - i * 0.09, 1.04); g.add(s); }
    for (const [x, z] of [[-0.8, 0.6], [0.8, 0.6], [-0.8, -0.6], [0.8, -0.6]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 20), MAT.rubber); w.rotation.z = Math.PI / 2; w.position.set(x * 1.15, -0.72, z); g.add(w); }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.24), new THREE.MeshStandardMaterial({ map: canvasTex(256, 128, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#c00'; c.font = '800 34px system-ui'; c.textAlign = 'center'; c.fillText('NÉMESIS', 128, 50); c.fillStyle = '#222'; c.font = '600 22px system-ui'; c.fillText('creada hace 1 min', 128, 92); }), side: THREE.DoubleSide }));
    label.position.set(1.1, 0.75, 0.3); label.rotation.set(0, Math.PI / 2, 0.3); g.add(label);
    this.light = new THREE.PointLight(0xff2030, 30, 14, 2); this.light.position.set(0, 0.4, 1.6); g.add(this.light);
    game.gfx.scene.add(shadowed(g));
    this.ent = game.physics.add({ mesh: g, pos: [pos.x, pos.y + 0.95, pos.z], rotY: Math.PI, shapes: [{ kind: 'cyl', size: [1.05, 0.92] }], density: 3, friction: 0.3, group: GROUPS.boss, angDamp: 1, linDamp: 0.2, ccd: true, canSleep: false, tag: 'boss' });

    // ragdoll hose
    this.hose = [];
    let prev = this.ent, anchor = [0, 0.95, -0.3];
    const hoseMat = new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.5, metalness: 0.4 });
    for (let i = 0; i < 6; i++) {
      const last = i === 5, m = new THREE.Group();
      if (last) {
        const nz = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.45), black); m.add(nz);
        const lip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.5), this.glowMat); lip.position.y = -0.12; m.add(lip);
      } else {
        m.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.36, 4, 12), hoseMat));
        for (const y of [-0.12, 0, 0.12]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 6, 20), MAT.steel); r.rotation.x = Math.PI / 2; r.position.y = y; m.add(r); }
      }
      game.gfx.scene.add(shadowed(m));
      const e = game.physics.add({ mesh: m, pos: [pos.x, pos.y + 2.2 + i * 0.5, pos.z + 0.3], shapes: [last ? { kind: 'box', size: [0.75, 0.2, 0.45] } : { kind: 'capsule', size: [0.15, 0.18] }], density: 0.25, group: GROUPS.boss, angDamp: 1.2, linDamp: 0.4, canSleep: false });
      game.physics.joint(prev, e, anchor, [0, -0.3, 0]);
      prev = e; anchor = [0, 0.3, 0]; this.hose.push(e);
    }
  }
  get position() { const t = this.ent.body.translation(); return V(t.x, t.y, t.z); }

  damage() {
    if (this.state === 'dead') return;
    this.hp--; this.flash = 1;
    const p = this.position;
    this.game.gfx.particles.burst(p, 50, { color: 0xff5030, speed: 9, life: 0.8, size: 0.25 });
    spawnDebris(this.game, p.clone().setY(p.y + 0.5), 6, { color: 0x15161a, size: 0.2, speed: 7 });
  }
  die() {
    this.state = 'dead';
    const b = this.ent.body, game = this.game, p = this.position;
    b.setAngularDamping(0.1);
    b.applyImpulse({ x: (Math.random() - 0.5) * 400, y: 2600, z: (Math.random() - 0.5) * 400 }, true);
    b.applyTorqueImpulse({ x: 1500, y: 300, z: 900 }, true);
    this.eyeMat.emissiveIntensity = 0; this.glowMat.emissiveIntensity = 0.1; this.light.intensity = 0;
    game.audio.explode(); game.gfx.shake(0.9); game.gfx.flash = 0.6;
    game.gfx.particles.burst(p, 120, { color: 0xff7030, speed: 14, life: 1.2, size: 0.4 });
    for (const c of [0xff4d5e, 0x6fe3ff, 0xf2c14e, 0xff8fc7, 0x7dff9a]) {
      game.gfx.particles.burst(p.clone().setY(p.y + 2), 50, { color: c, speed: 11, life: 3, size: 0.16, gravity: -4, up: 1.4, drag: 1.2 });
      spawnDebris(game, p.clone().setY(p.y + 1.5), 10, { color: c, size: 0.1, speed: 10, up: 1.5, life: 9, emissive: 0.6 });
    }
  }

  step(dt, player) {
    const b = this.ent.body, v = b.linvel(), p = b.translation();
    this.t += dt;
    if (this.state === 'dead') return;
    let tx = 0, tz = 0, k = 0.12;
    const pp = player.position, dx = pp.x - p.x, dz = pp.z - p.z, dist = Math.hypot(dx, dz);
    if (this.state === 'idle') {
      this.yaw = Math.atan2(dx, dz);
      tx = dx / (dist || 1) * 1.6; tz = dz / (dist || 1) * 1.6;
      if (this.t > 1.4) { this.state = 'aim'; this.t = 0; this.game.audio.revUp(); }
    } else if (this.state === 'aim') {
      this.yaw = Math.atan2(dx, dz);
      this.eyeMat.emissiveIntensity = 4 + this.t * 14;
      tx = -Math.sin(this.yaw) * 1.2; tz = -Math.cos(this.yaw) * 1.2; // rears back
      if (this.t > 1.15) { this.state = 'charge'; this.t = 0; this.dir.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); this.hitDone = false; this.game.audio.whoosh(); }
    } else if (this.state === 'charge') {
      tx = this.dir.x * 19; tz = this.dir.z * 19; k = 0.22;
      this.game.gfx.particles.burst(V(p.x, p.y - 0.8, p.z), 3, { color: 0xff5030, speed: 2, life: 0.5, size: 0.3, gravity: 1 });
      if (!this.hitDone && dist < 1.9 && player.stun <= 0) {
        this.hitDone = true;
        player.knock(1.8, { x: this.dir.x * 7 + dx * 1.5, y: 8, z: this.dir.z * 7 + dz * 1.5 });
        this.game.audio.thud(1.3); this.game.gfx.shake(0.6);
        this.onHitPlayer && this.onHitPlayer();
      }
      const sp = Math.hypot(v.x, v.z);
      if (this.t > 0.45 && sp < 6) {
        this.state = 'stun'; this.t = 0; this.eyeMat.emissiveIntensity = 1;
        b.setLinvel({ x: -this.dir.x * 4, y: 5, z: -this.dir.z * 4 }, true);
        b.applyTorqueImpulse({ x: this.dir.z * 900, y: 0, z: -this.dir.x * 900 }, true);
        this.game.audio.thud(1.5); this.game.audio.clank(1.2); this.game.gfx.shake(0.7);
        this.onCrash && this.onCrash(V(p.x + this.dir.x * 1.2, p.y, p.z + this.dir.z * 1.2));
        return;
      }
      if (this.t > 3.2) { this.state = 'idle'; this.t = 0; }
    } else if (this.state === 'stun') {
      if (Math.random() < 0.3) this.game.gfx.particles.burst(V(p.x, p.y + 1.6, p.z), 1, { color: 0xffe070, speed: 2, life: 0.7, size: 0.22, gravity: 0 });
      if (this.t > 2.6) { this.state = 'idle'; this.t = 0; this.eyeMat.emissiveIntensity = 4; }
    }
    if (this.state !== 'stun' || this.t > 0.6) {
      b.setLinvel({ x: v.x + (tx - v.x) * k, y: v.y, z: v.z + (tz - v.z) * k }, true);
      const r = b.rotation(); _q.set(r.x, r.y, r.z, r.w);
      _up.set(0, 1, 0).applyQuaternion(_q); _fw.set(0, 0, 1).applyQuaternion(_q);
      _ax.crossVectors(_up, UP).multiplyScalar(this.state === 'stun' ? 5 : 12);
      let dy = this.yaw - Math.atan2(_fw.x, _fw.z); dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      _ax.y += dy * 7;
      const av = b.angvel(), ka = 0.2;
      b.setAngvel({ x: av.x + (_ax.x - av.x) * ka, y: av.y + (_ax.y - av.y) * ka, z: av.z + (_ax.z - av.z) * ka }, true);
    }
  }
  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.bodyMat.emissive.setRGB(this.flash, this.flash * 0.2, this.flash * 0.1);
    if (this.state !== 'dead') this.light.intensity = 20 + this.eyeMat.emissiveIntensity * 4;
  }
}
