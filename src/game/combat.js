// Health, defeat and retry, progression (XP, levels, stains), small enemies and the auto-firing weapon.
import * as THREE from 'three';
import { canvasTex } from '../engine/gfx.js';
import { MAT, shadowed } from './robot.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
export const DEATH = Symbol('death');

const LEVELS = [0, 120, 300, 550, 850, 1250, 1750, 2400];
const DEATH_LINES = [
  ['DERROTA', 'Por la trama, otra toma.'],
  ['DERROTA', 'Eso no estaba en el guion. Repetimos desde un poco antes.'],
  ['DERROTA', 'Morir es dramático. Repetir, más todavía.'],
  ['DERROTA', 'Corten. Desde el último punto de control.'],
  ['DERROTA', 'El público ha suspirado. Otra vez.'],
];

/** wires health, XP, stains and retries into the game; call once */
export function installProgress(game) {
  const { ui, robot, audio, gfx } = game;
  const P = game.prog = { stains: 0, xp: 0, lvl: 1, kills: 0, deaths: 0, secrets: new Set(), weapon: false, fireMul: 1, perks: new Set() };
  robot.maxHp = 5; robot.hp = 5; robot.inv = 0; robot.chargeMul = 1; robot.cdMul = 1;
  game.danger = false; game.dead = false; game.epoch = 0; game.enemies = new Set(); game.targets = new Set();

  const hud = () => ui.status(robot.hp, robot.maxHp, P.lvl, P.stains);
  P.hud = hud; hud();

  P.addXp = (n, pos) => {
    P.xp += n;
    while (P.lvl < LEVELS.length && P.xp >= LEVELS[P.lvl]) {
      P.lvl++; robot.maxHp = Math.min(9, robot.maxHp + 1); robot.hp = robot.maxHp; robot.cdMul *= 0.92;
      audio.trophy(); audio.chime(); game.pop(robot.position.clone().setY(robot.position.y + 2.4), `¡NIVEL ${P.lvl}!`, '#6fe3ff', true);
      ui.bark('sistema', `Nivel ${P.lvl}: +1 corazón máximo, embestida más rápida.`);
      gfx.particles.burst(robot.position.clone().setY(robot.position.y + 1), 60, { color: 0x6fe3ff, speed: 6, life: 1, size: 0.2, gravity: 2 });
    }
    hud();
  };
  P.addStain = (pos) => {
    P.stains++; P.addXp(12);
    const perk = { 10: ['charge', 'Fregona reforzada: la turbofregona carga el doble de rápido.'], 25: ['heart', 'Manchas 25: un corazón más.'], 40: ['spray', 'Manchas 40: el pulverizador dispara el doble.'] }[P.stains];
    if (perk && !P.perks.has(perk[0])) {
      P.perks.add(perk[0]); ui.achieve('perk' + P.stains, `${P.stains} manchas`, perk[1]); ui.bark('sistema', perk[1]);
      if (perk[0] === 'charge') robot.chargeMul = 2;
      if (perk[0] === 'heart') { robot.maxHp = Math.min(9, robot.maxHp + 1); robot.hp = robot.maxHp; }
      if (perk[0] === 'spray') P.fireMul = 2;
    }
    hud();
  };
  P.secret = (id, title, desc) => {
    if (P.secrets.has(id)) return false;
    P.secrets.add(id); P.addXp(40); ui.achieve('secret-' + id, title, desc); return true;
  };

  /** take damage. Dashing dodges; i-frames after a hit. Outside gameplay (game.danger false) it only knocks you about. */
  robot.hurt = (n = 1, impulse = null, dur = 1.1) => {
    if (robot.dashT > 0 || robot.superT > 0) { if (robot.inv <= 0) game.pop(robot.position.clone().setY(robot.position.y + 2), '¡ESQUIVA!', '#6fe3ff'); return false; }
    if (robot.inv > 0) return false;
    robot.knock(dur, impulse); robot.falls++;
    if (!game.danger) return true;
    robot.hp = Math.max(0, robot.hp - n); robot.inv = 1.4; hud();
    audio.hurt(); gfx.shake(0.5); game.hitstop(0.08); game.buzz(70); gfx.u.uTint.value.setRGB(1.6, 0.6, 0.6); setTimeout(() => gfx.u.uTint.value.setRGB(1, 1, 1), 160);
    if (robot.hp <= 0) game.dead = true;
    return true;
  };
  robot.heal = (n = 1) => { robot.hp = Math.min(robot.maxHp, robot.hp + n); hud(); };
  game.tickers.add((dt) => { robot.inv -= dt; });

  /**
   * Run a gameplay section that can kill you. setup(scope, attempt) must (re)build the section from scratch and
   * return a promise that resolves when it is beaten. On death everything the scope registered is torn down, the
   * Narrator quips, and setup runs again with full health ("from a bit earlier").
   */
  game.trial = async (setup, { assistAfter = 2 } = {}) => {
    for (let attempt = 0; ; attempt++) {
      if (attempt === assistAfter) { robot.maxHp += 2; ui.bark('narrador', 'Te regalo dos corazones. Que no se entere nadie.'); }
      robot.hp = robot.maxHp; robot.inv = 1; game.dead = false; game.danger = true; hud();
      const scope = { cleanups: [], tick(f) { game.tickers.add(f); this.cleanups.push(() => game.tickers.delete(f)); return f; }, on(f) { this.cleanups.push(f); } };
      const died = new Promise((res) => scope.tick(() => { if (game.dead && ui.blocking === 0) res(DEATH); }));
      const r = await Promise.race([setup(scope, attempt), died]);
      for (const f of scope.cleanups.reverse()) { try { f(); } catch (e) { console.error(e); } }
      game.danger = false;
      if (r !== DEATH) { game.dead = false; return r; }
      // defeat: freeze the old attempt (its pending waits never resolve), then show the card and retry
      game.epoch++; P.deaths++; clearEnemies(game);
      robot.frozen = true; robot.face('dizzy'); audio.powerdown(); ui.clearBarks();
      const [a, b] = DEATH_LINES[P.deaths % DEATH_LINES.length];
      ui.cine(true); gfx.glitchKick = 1; audio.glitch(); await ui.chapter(a, b, 1900); ui.cine(false); gfx.cam.snap = true; robot.frozen = false; robot.face('idle');
      if (P.deaths === 1) ui.achieve('death', 'Toma falsa', 'Morir por primera vez. Por la trama.');
    }
  };
}

// ───────────────────────── stains you can actually count ─────────────────────────
const stainTex = canvasTex(128, 128, (g) => {
  g.fillStyle = '#fff';
  for (let i = 0; i < 14; i++) { g.beginPath(); const a = Math.random() * 7, r = Math.random() * 30; g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 12 + Math.random() * 20, 0, 7); g.fill(); }
});
const stainColors = [0xc04dff, 0x4dd2ff, 0x9dff4d, 0xff7a4d];
export function makeStains(game, spots, y) {
  const list = spots.map(([x, z], i) => {
    const c = stainColors[i % stainColors.length];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x110818, emissive: c, emissiveIntensity: 1.5, alphaMap: stainTex, transparent: true, depthWrite: false, roughness: 0.1 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(x, y + 0.03, z); m.renderOrder = 1; game.gfx.scene.add(m);
    return { m, x, z, done: false, k: 1 };
  });
  let got = 0;
  const tick = (dt) => {
    const p = game.robot.position;
    for (const s of list) {
      if (!s.done && dist(p, s.x, s.z) < 1.05 && Math.abs(p.y - y) < 1.5) {
        s.done = true; got++; game.audio.clean(); game.prog.addStain();
        game.pop(V(s.x, y + 0.8, s.z), ['¡LIMPIO!', '¡RELUCE!', '¡IMPOLUTO!', '¡FREGADO!'][got % 4], '#d58bff');
        game.gfx.particles.burst(V(s.x, y + 0.2, s.z), 30, { color: 0xd58bff, speed: 4, life: 0.9, size: 0.18, gravity: 2, up: 1 });
      }
      if (s.done && s.k > 0) { s.k = Math.max(0, s.k - dt * 3); s.m.scale.setScalar(Math.max(0.01, s.k)); s.m.material.opacity = s.k; if (s.k === 0) s.m.visible = false; }
    }
  };
  game.tickers.add(tick);
  return { get got() { return got; }, total: list.length, next: () => list.find((s) => !s.done), dispose: () => { game.tickers.delete(tick); list.forEach((s) => game.gfx.scene.remove(s.m)); } };
}

// ───────────────────────── small enemies ─────────────────────────
const fluffGeo = (() => { const g = new THREE.IcosahedronGeometry(0.45, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.85 + Math.random() * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
const M = {
  fluff: new THREE.MeshStandardMaterial({ color: 0x8a8590, roughness: 1, flatShading: true }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }),
  black: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2 }),
  sock: new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(128, 64, (g) => { g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, 128, 64); ['#e0304a', '#3a6fff', '#f2c14e'].forEach((c, i) => { g.fillStyle = c; g.fillRect(14 + i * 34, 0, 12, 64); }); }) }),
  staple: new THREE.MeshStandardMaterial({ color: 0xb01e2e, roughness: 0.35, metalness: 0.3 }),
  extra: new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide, map: canvasTex(128, 256, (c) => {
    c.fillStyle = '#b08a5a'; c.fillRect(0, 0, 128, 256); c.fillStyle = '#3a2a1a';
    c.beginPath(); c.arc(64, 46, 26, 0, 7); c.fill(); c.fillRect(30, 76, 68, 110); c.fillRect(34, 186, 24, 64); c.fillRect(70, 186, 24, 64); c.fillRect(14, 84, 16, 80); c.fillRect(98, 84, 16, 80);
    c.fillStyle = '#fff'; c.font = '700 17px system-ui'; c.textAlign = 'center'; c.fillText('EXTRA', 64, 120); c.fillText('nº ' + ((Math.random() * 90) | 0 + 10), 64, 142);
  }) }),
  bullet: new THREE.MeshStandardMaterial({ color: 0x001018, emissive: 0x6fe3ff, emissiveIntensity: 3 }),
  shot: new THREE.MeshStandardMaterial({ color: 0x200008, emissive: 0xff5a7a, emissiveIntensity: 3 }),
};
const eyes = (g, y, z, s = 1) => { for (const x of [-0.14, 0.14]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 10, 8), M.white); e.position.set(x * s, y, z); g.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 8, 6), M.black); p.position.set(x * s, y, z + 0.08 * s); g.add(p); } };
const TYPES = {
  pelusa: { hp: 1, r: 0.45, speed: 3.4, xp: 15, build: (g) => { g.add(new THREE.Mesh(fluffGeo, M.fluff)); eyes(g, 0.1, 0.36); } },
  calcetin: { hp: 2, r: 0.45, speed: 5.6, xp: 25, build: (g) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.75, 4, 10), M.sock); b.rotation.x = Math.PI / 2; g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), M.sock); h.position.set(0, 0.05, 0.42); g.add(h); eyes(g, 0.18, 0.55, 0.8); } },
  grapadora: { hp: 3, r: 0.6, speed: 1.8, xp: 35, build: (g) => { const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.1), M.black); g.add(base); const top = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 1.05), M.staple); top.position.set(0, 0.22, -0.05); top.rotation.x = -0.18; g.add(top); eyes(g, 0.38, 0.38, 0.9); } },
  extra: { hp: 2, r: 0.5, speed: 2.8, xp: 20, build: (g) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), M.extra); m.position.y = 0.55; g.add(m); const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.4), MAT.rubber); b.position.y = -0.33; g.add(b); } },
};
const DIE = ['¡BARRIDO!', '¡A LA BASURA!', '¡POLVO ERES!', '¡RECOGIDO!', '¡FUERA!'];
const shots = [];

export function spawnEnemy(game, type, x, y, z, { bounds = null, onDie = null, tag = null } = {}) {
  const T = TYPES[type], g = new THREE.Group(); T.build(g); shadowed(g); g.position.set(x, y + 0.45, z); game.gfx.scene.add(g);
  const e = { type, T, g, pos: g.position, vel: V(), hp: T.hp, r: T.r, y, t: Math.random() * 2, cd: 1 + Math.random(), alive: true, bounds, onDie, tag, flash: 0 };
  e.hit = (n = 1, from = null) => damageEnemy(game, e, n, from);
  game.enemies.add(e); game.targets.add(e);
  game.gfx.particles.burst(V(x, y + 0.4, z), 16, { color: 0xbbbbcc, speed: 3, life: 0.6, size: 0.35, gravity: 1, drag: 3 });
  return e;
}
function damageEnemy(game, e, n, from) {
  if (!e.alive) return;
  e.hp -= n; e.flash = 0.15;
  if (from) { const d = V(e.pos.x - from.x, 0, e.pos.z - from.z).normalize(); e.vel.addScaledVector(d, 9); }
  if (e.hp > 0) { game.audio.stomp(); return; }
  e.alive = false; game.enemies.delete(e); game.targets.delete(e); game.gfx.scene.remove(e.g);
  game.prog.kills++; game.prog.addXp(e.T.xp); game.addScore(100);
  game.audio.stomp(); game.audio.clank(0.6); game.hitstop(0.04);
  game.gfx.particles.burst(e.pos.clone(), 40, { color: e.type === 'pelusa' ? 0xb0aab8 : 0xffd24a, speed: 7, life: 0.8, size: 0.3, gravity: -2 });
  game.pop(e.pos.clone().setY(e.pos.y + 1.2), DIE[(Math.random() * DIE.length) | 0], '#ffe9a8');
  if (game.prog.kills === 1) game.ui.achieve('kill', 'Personal de limpieza', 'Barrer a tu primer enemigo');
  if (game.prog.kills === 50) game.ui.achieve('kill50', 'Exterminador de pelusas', 'Cincuenta enemigos barridos');
  e.onDie && e.onDie(e);
}
export function clearEnemies(game, filter = null) {
  for (const e of [...game.enemies]) if (!filter || filter(e)) { e.alive = false; game.enemies.delete(e); game.targets.delete(e); game.gfx.scene.remove(e.g); }
  for (const s of shots) s.m.visible = false;
}
export const aliveCount = (game, tag) => [...game.enemies].filter((e) => !tag || e.tag === tag).length;

/** per-frame update for every enemy and enemy projectile (installed once) */
export function installEnemies(game) {
  const scene = game.gfx.scene, shotGeo = new THREE.BoxGeometry(0.08, 0.08, 0.5);
  for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(shotGeo, M.shot); m.visible = false; scene.add(m); shots.push({ m, v: V(), t: 0 }); }
  const fire = (from, to) => { const s = shots.find((s) => !s.m.visible); if (!s) return; s.m.visible = true; s.m.position.copy(from); s.v.set(to.x - from.x, 0, to.z - from.z).normalize().multiplyScalar(9); s.m.lookAt(from.clone().add(s.v)); s.t = 2.5; game.audio.shoot(); };
  game.tickers.add((dt) => {
    if (!dt) return;
    const r = game.robot, rp = r.position;
    for (const e of game.enemies) {
      e.t += dt; e.cd -= dt; e.flash -= dt;
      const dx = rp.x - e.pos.x, dz = rp.z - e.pos.z, d = Math.hypot(dx, dz) || 1, near = d < 22 && Math.abs(rp.y - e.y) < 3;
      let want = 0;
      if (near) {
        if (e.type === 'pelusa') { if (e.cd <= 0) { e.cd = 0.55 + Math.random() * 0.3; e.vel.set(dx / d * e.T.speed * 1.6, 0, dz / d * e.T.speed * 1.6); e.hop = 0.35; } }
        else if (e.type === 'grapadora') { want = d > 7 ? 1 : d < 4.5 ? -1 : 0; if (e.cd <= 0 && d < 13) { e.cd = 2.2; fire(e.pos.clone().setY(e.y + 0.6), rp); e.chomp = 0.25; } }
        else want = 1;
        if (want) { const wob = e.type === 'calcetin' ? Math.sin(e.t * 7) * 0.6 : 0; const s = e.T.speed * want; e.vel.x += ((dx / d + -dz / d * wob) * s - e.vel.x) * Math.min(1, dt * 4); e.vel.z += ((dz / d + dx / d * wob) * s - e.vel.z) * Math.min(1, dt * 4); }
      }
      e.vel.multiplyScalar(Math.exp(-dt * (e.type === 'pelusa' ? 3 : 2)));
      e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt;
      if (e.bounds) { const b = e.bounds; e.pos.x = Math.max(b[0], Math.min(b[1], e.pos.x)); e.pos.z = Math.max(b[2], Math.min(b[3], e.pos.z)); }
      e.hop = Math.max(0, (e.hop || 0) - dt); e.chomp = Math.max(0, (e.chomp || 0) - dt);
      e.pos.y = e.y + 0.45 + Math.sin((0.35 - e.hop) / 0.35 * Math.PI) * 0.5 * (e.hop > 0 ? 1 : 0);
      e.g.rotation.y = Math.atan2(dx, dz); if (e.type === 'grapadora') e.g.children[1].rotation.x = -0.18 + e.chomp * 1.4;
      const sq = e.flash > 0 ? 1.35 : 1 + Math.sin(e.t * 9) * 0.04; e.g.scale.set(sq, e.flash > 0 ? 0.7 : 2 - sq, sq);
      // contact: a dash sweeps them away, otherwise they hurt
      if (d < e.r + 0.6 && Math.abs(rp.y + 0.6 - e.pos.y) < 1.4) {
        if (r.dashT > 0 || r.superT > 0) e.hit(r.superT > 0 ? 3 : 2, rp);
        else if (r.stun <= 0 && r.hurt(1, { x: dx / d * 7, y: 6, z: dz / d * 7 })) e.vel.set(-dx / d * 6, 0, -dz / d * 6);
      }
    }
    for (const s of shots) {
      if (!s.m.visible) continue;
      s.t -= dt; s.m.position.addScaledVector(s.v, dt);
      if (s.t <= 0) { s.m.visible = false; continue; }
      if (dist(rp, s.m.position.x, s.m.position.z) < 0.6 && Math.abs(rp.y + 0.7 - s.m.position.y) < 1) { s.m.visible = false; r.hurt(1, { x: s.v.x * 0.6, y: 5, z: s.v.z * 0.6 }, 0.7); }
    }
  });
}

// ───────────────────────── Pulverizador 3000: fires by itself ─────────────────────────
export function installWeapon(game) {
  const scene = game.gfx.scene, r = game.robot, P = game.prog;
  const geo = new THREE.SphereGeometry(0.13, 10, 8), pool = [];
  for (let i = 0; i < 24; i++) { const m = new THREE.Mesh(geo, M.bullet); m.visible = false; scene.add(m); pool.push({ m, v: V(), t: 0, tgt: null }); }
  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.34), new THREE.MeshPhysicalMaterial({ color: 0x29d3ff, roughness: 0.3, clearcoat: 1 })); gun.add(body);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 12), new THREE.MeshPhysicalMaterial({ color: 0xff8fc7, roughness: 0.2, transparent: true, opacity: 0.8 })); tank.position.set(0, 0.2, -0.05); gun.add(tank);
  const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.2, 8), MAT.steel); nz.rotation.x = Math.PI / 2; nz.position.z = 0.26; gun.add(nz);
  gun.position.set(0, -0.26, 0.1); gun.visible = false; r.hands[0].mesh.add(shadowed(gun));
  let cd = 0;
  P.giveWeapon = () => { P.weapon = true; gun.visible = true; };
  game.tickers.add((dt) => {
    if (!dt) return;
    cd -= dt;
    if (P.weapon && cd <= 0 && game.danger && r.stun <= 0 && !r.frozen) {
      const rp = r.position; let best = null, bd = 12;
      for (const t of game.targets) { const tp = t.aim ? t.aim() : t.pos, d = Math.hypot(tp.x - rp.x, tp.z - rp.z); if (d < bd && Math.abs(tp.y - rp.y) < 8) { bd = d; best = t; } }
      if (best) {
        cd = 0.34 / P.fireMul;
        const b = pool.find((b) => !b.m.visible);
        if (b) { const from = rp.clone().setY(rp.y + 1); b.m.visible = true; b.m.position.copy(from); b.tgt = best; b.t = 1.2; game.audio.shoot(); }
      }
    }
    for (const b of pool) {
      if (!b.m.visible) continue;
      b.t -= dt;
      const tp = b.tgt.aim ? b.tgt.aim() : b.tgt.pos;
      b.v.copy(tp).sub(b.m.position); const d = b.v.length(); b.v.multiplyScalar(24 / (d || 1));
      b.m.position.addScaledVector(b.v, dt);
      if (d < 0.6 || b.t <= 0 || (b.tgt.alive === false)) {
        b.m.visible = false;
        if (d < 0.6 && b.tgt.alive !== false) { b.tgt.hit(b.tgt.weaponDmg ?? 1, b.m.position); game.gfx.particles.burst(b.m.position.clone(), 10, { color: 0x9fefff, speed: 4, life: 0.4, size: 0.15 }); }
      }
    }
  });
}
