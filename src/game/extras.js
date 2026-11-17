// Side systems the story plugs in: collectibles, fourth-wall gags, memory
// between runs, and the extra hazards (barrels, searchlights, lasers,
// walking pianos, thrown adverbs).
import * as THREE from 'three';
import { GROUPS } from '../engine/physics.js';
import { canvasTex, textTex, lightCone } from '../engine/gfx.js';
import { MAT, shadowed } from './robot.js';
import { makePiano, spawnDebris } from './actors.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const dist = (p, x, z) => Math.hypot(p.x - x, p.z - z);

// ───────── memory between runs ─────────
const KEY = 'trama.v1';
export function loadMem() { try { return JSON.parse(localStorage.getItem(KEY)) || { runs: 0 }; } catch (e) { return { runs: 0 }; } }
export function saveMem(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) { /* private mode */ } }

// ───────── collectible script pages ─────────
const pageMat = new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xffe9a8, emissiveIntensity: 1.3, side: THREE.DoubleSide, roughness: 0.6 });
const pageGeo = new THREE.PlaneGeometry(0.5, 0.68);
export class Pages {
  constructor(game) {
    this.game = game; this.list = []; this.got = 0; this.total = 0;
    game.tickers.add(this.tick = (dt) => {
      const p = game.robot.position;
      for (const pg of this.list) {
        if (pg.done) continue;
        pg.mesh.rotation.y += dt * 2.2; pg.mesh.position.y = pg.y + 0.9 + Math.sin(game.time * 2.4 + pg.x) * 0.15;
        if (dist(p, pg.x, pg.z) < 1.15 && Math.abs(p.y - pg.y) < 2.5) {
          pg.done = true; game.gfx.scene.remove(pg.mesh); this.got++;
          game.audio.coin(); game.addScore(250, V(pg.x, pg.y + 1.6, pg.z));
          game.gfx.particles.burst(V(pg.x, pg.y + 1, pg.z), 30, { color: 0xffe9a8, speed: 5, life: 0.8, size: 0.16, gravity: 2 });
          game.ui.bark('creador', pg.text);
          game.ui.achieve('page', 'Ratón de biblioteca', 'Robar una página del guion');
          if (this.got === this.total && this.total >= 8) game.ui.achieve('pages', 'Editor jefe', 'Todas las páginas. No había premio.');
        }
      }
    });
  }
  dispose() { for (const pg of this.list) this.game.gfx.scene.remove(pg.mesh); this.list.length = 0; this.game.tickers.delete(this.tick); }
  add(x, y, z, text) {
    const mesh = new THREE.Mesh(pageGeo, pageMat); mesh.position.set(x, y + 0.9, z); this.game.gfx.scene.add(mesh);
    this.list.push({ mesh, x, y, z, text, done: false }); this.total++;
  }
}

// ───────── fourth-wall gags that react to how the player behaves ─────────
export function installGags(game) {
  const { ui, input, robot } = game, said = new Set();
  const once = (id, fn) => { if (!said.has(id)) { said.add(id); fn(); } };
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = performance.now();
    else if (performance.now() - hiddenAt > 3000 && !game.done) once('tab', () => { ui.bark('narrador', '¿Has ido a mirar otra pestaña? Estaba hablando.'); ui.achieve('tab', 'Déficit de atención', 'Cambiar de pestaña en mitad de la trama'); });
  });
  game.onMute = (m) => m && once('mute', () => { ui.bark('narrador', 'Me has quitado el sonido. Sigo en subtítulos. No te libras.'); ui.achieve('mute', 'Cine mudo', 'Silenciar al Narrador (en vano)'); });
  game.onSmash = (n) => { if (n === 1) { ui.bark('narrador', 'Eso era atrezo. Lo pagas tú.'); ui.achieve('smash', 'Vándalo', 'Romper una caja que no te había hecho nada'); } if (n === 5) ui.achieve('smash5', 'Inventario negativo', 'Cinco cajas menos'); };
  game.tickers.add(() => {
    if (ui.auto || game.done) return;
    if (input.enabled && ui.controls && performance.now() - input.lastInput > 25000) once('idle', () => { ui.bark('narrador', '¿Sigues ahí? Si te has ido, la trama sigue sin ti. Mentira. Te espero.'); ui.achieve('idle', 'Estatua', 'No hacer nada durante 25 segundos'); });
    if (ui.skips >= 6) once('skip', () => { ui.bark('narrador', 'Te estás saltando el texto. Me costó mucho escribirlo. Bueno, a mí no. A Claude.'); ui.achieve('skip', 'Lectura diagonal', 'Saltarse seis diálogos'); });
    if (robot.dashes >= 30) once('dash', () => ui.achieve('dash', 'Embestidor compulsivo', '30 embestidas. ¿Estás bien?'));
    if (robot.falls >= 8) once('falls', () => { ui.achieve('falls', 'Muñeco de trapo', 'Ocho porrazos'); ui.bark('narrador', 'Llevas ocho porrazos. El equipo de físicas te lo agradece.'); });
    if (game.score >= 5000) once('score', () => { ui.bark('narrador', 'Cinco mil puntos de trama. No se canjean por nada, pero qué bien sientan.'); });
  });
}

// ───────── red barrels. They explode. It is the law. ─────────
export function makeBarrels(game, spots, y, onBoom) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xd0202a, roughness: 0.4, metalness: 0.5 });
  const lbl = new THREE.MeshBasicMaterial({ map: textTex('EXPLOTA', { w: 256, h: 64, bg: '#f2c14e', color: '#111', font: '800 44px system-ui' }) });
  const list = spots.map(([x, z]) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 20), mat));
    for (const h of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 6, 24), MAT.steel); r.rotation.x = Math.PI / 2; r.position.y = h; g.add(r); }
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), lbl); l.position.set(0, 0, 0.46); g.add(l);
    game.gfx.scene.add(shadowed(g));
    return game.physics.add({ mesh: g, pos: [x, y + 0.56, z], shapes: [{ kind: 'cyl', size: [0.45, 0.55] }], density: 0.5, friction: 0.5 });
  });
  const boom = (b) => {
    if (!b.alive) return;
    const t = b.body.translation(), p = V(t.x, t.y, t.z);
    game.physics.remove(b);
    game.audio.explode(); game.gfx.shake(0.8); game.gfx.flash = 0.35; game.hitstop(0.08); game.buzz(80);
    game.gfx.particles.burst(p, 90, { color: 0xff8030, speed: 13, life: 0.9, size: 0.5 });
    game.gfx.particles.burst(p, 40, { color: 0x333333, speed: 5, life: 1.6, size: 0.8, gravity: 2, drag: 2 });
    spawnDebris(game, p, 8, { color: 0xd0202a, size: 0.2, speed: 9 });
    game.pop(p.clone().setY(p.y + 1), '¡BUM!', '#ff8030', true);
    const rp = game.robot.position, d = dist(rp, p.x, p.z);
    if (d < 4.2) { const k = 9 / Math.max(1, d); game.robot.hurt(1, { x: (rp.x - p.x) * k, y: 9, z: (rp.z - p.z) * k }, 1.4); }
    for (const e of [...game.enemies]) if (dist(e.pos, p.x, p.z) < 4.5) e.hit(5, p); // barrels sweep enemies too
    onBoom && onBoom(p);
    setTimeout(() => list.forEach((o) => { if (o.alive && dist(o.body.translation(), p.x, p.z) < 3.4) boom(o); }), 180); // chain reaction
  };
  const tick = () => {
    const boss = game.boss, r = game.robot, rp = r.position;
    for (const b of list) {
      if (!b.alive) continue;
      const t = b.body.translation();
      if (r.superT > 0 && dist(rp, t.x, t.z) < 1.5) boom(b);
      else if (boss && boss.state === 'charge' && dist(boss.position, t.x, t.z) < 2.2) boom(b);
    }
  };
  game.tickers.add(tick);
  return { list, stop: () => game.tickers.delete(tick) };
}

// ───────── noir stealth: searchlights and cardboard guards ─────────
export function makeStealth(game, y) {
  const scene = game.gfx.scene, lights = [], guards = [];
  let S0 = null;
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const cone = lightCone(14, 2.9, 0xffffff, 0.14); cone.position.y = 14; g.add(cone);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(2.7, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: i === 0 ? 0.06 : 0.22, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.04; g.add(disc);
    if (i === 0) S0 = game.gfx.spot(1, { intensity: 130, distance: 30, angle: 0.2, penumbra: 0.3, decay: 1.2, parent: g, pos: [0, 14, 0], target: [0, 0, 0] }); // one real light, the other two are faked
    g.position.y = y; scene.add(g); lights.push({ g, i });
  }
  const tex = canvasTex(128, 256, (c) => {
    c.fillStyle = '#b08a5a'; c.fillRect(0, 0, 128, 256); c.fillStyle = '#1a1a1a';
    c.beginPath(); c.arc(64, 46, 26, 0, 7); c.fill(); c.fillRect(30, 76, 68, 110); c.fillRect(34, 186, 24, 64); c.fillRect(70, 186, 24, 64); c.fillRect(14, 84, 16, 80); c.fillRect(98, 84, 16, 80);
    c.fillStyle = '#b08a5a'; c.fillRect(40, 20, 48, 8); c.fillStyle = '#fff'; c.font = '700 15px system-ui'; c.textAlign = 'center'; c.fillText('GUARDIA', 64, 120); c.fillText('(cartón)', 64, 140);
  });
  for (const x of [-3.2, 3.2]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.06), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 })); mesh.castShadow = true; scene.add(mesh);
    guards.push(game.physics.add({ mesh, pos: [x, y + 1.12, -14.5], shapes: [{ kind: 'box', size: [1.1, 2.2, 0.06] }], density: 0.15, group: GROUPS.prop }));
  }
  const S = { caught: null, on: true, pos: [V(), V(), V()] };
  const tick = () => {
    const t = game.time, rp = game.robot.position;
    lights.forEach(({ g, i }) => {
      const x = Math.sin(t * 0.55 + i * 2.1) * (8 - i), z = 7 - i * 7.5 + Math.cos(t * 0.4 + i) * 2.2;
      g.position.x = x; g.position.z = z; S.pos[i].set(x, y, z);
      if (S.on && dist(rp, x, z) < 2.5 && S.caught) S.caught();
    });
    if (Math.random() < 0.5) game.gfx.particles.burst(V(rp.x + (Math.random() - 0.5) * 24, y + 10, rp.z + (Math.random() - 0.5) * 20), 3, { color: 0xffffff, speed: 0.2, life: 0.55, size: 0.07, gravity: -45, spread: 6, drag: 0 });
  };
  game.tickers.add(tick);
  const park = () => { if (S0) { game.gfx.spot(1, { intensity: 0 }); S0 = null; } }; // hand the light back before hiding/removing its parent
  S.off = () => { S.on = false; park(); lights.forEach(({ g }) => (g.visible = false)); };
  S.dispose = () => { game.tickers.delete(tick); park(); lights.forEach(({ g }) => scene.remove(g)); guards.forEach((e) => game.temp.push({ e, t: 6 })); };
  return S;
}

// ───────── bridge hazards: spinning lasers and pianos with legs ─────────
export function makeLasers(game, y, zs) {
  const scene = game.gfx.scene, red = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff2030, emissiveIntensity: 5 });
  const list = zs.map((z, i) => {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 12), MAT.steel); pole.position.y = 0.55; g.add(pole);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.1, 0.1), red); bar.position.y = 0.55; g.add(bar);
    g.position.set(0, y, z); g.visible = false; scene.add(g);
    return { g, z, dir: i % 2 ? -1 : 1, a: i };
  });
  const tick = (dt) => {
    const r = game.robot, rp = r.position;
    for (const l of list) {
      if (!l.g.visible) continue;
      l.a += dt * 1.5 * l.dir; l.g.rotation.y = -l.a;
      const dx = rp.x, dz = rp.z - l.z, rr = Math.hypot(dx, dz);
      if (rr < 2.8 && rr > 0.25 && r.stun <= 0 && r.dashT <= 0 && rp.y < y + 0.7 && Math.abs(dx * Math.sin(l.a) - dz * Math.cos(l.a)) < 0.42) {
        r.hurt(1, { x: -Math.sin(l.a) * 6 * l.dir, y: 7, z: Math.cos(l.a) * 6 * l.dir }, 1);
        game.audio.laser(); game.gfx.shake(0.4); game.hitstop(0.06); game.pop(rp.clone().setY(rp.y + 1.5), '¡ZAS!', '#ff4050');
      }
    }
  };
  game.tickers.add(tick);
  return { show: () => list.forEach((l) => (l.g.visible = true)), dispose: () => { game.tickers.delete(tick); list.forEach((l) => scene.remove(l.g)); } };
}

export function makeHoppers(game, spots, y) {
  const list = spots.map(([x, z]) => { game.pianos++; const e = makePiano(game, [x, y + 1.2, z], { rotY: Math.PI }); e.fresh = false; e.hopT = Math.random(); return e; });
  const tick = (dt) => {
    const r = game.robot, rp = r.position;
    for (const e of list) {
      if (!e.alive) continue;
      const t = e.body.translation(), d = dist(rp, t.x, t.z);
      if (r.superT > 0 && d < 2.1) {
        const p = V(t.x, t.y, t.z); game.physics.remove(e); game.audio.pianoCrash(); game.gfx.shake(0.6); game.hitstop(0.1);
        spawnDebris(game, p, 14, { color: 0x0a0a0a, size: 0.25, speed: 9 }); spawnDebris(game, p, 10, { color: 0xf4f0e6, size: 0.1, speed: 10 });
        game.pop(p.setY(p.y + 1), '¡DO MAYOR!', '#fff', true); game.addScore(500); game.ui.achieve('tuner', 'Afinador', 'Desafinar un piano con patas para siempre');
        continue;
      }
      e.hopT -= dt;
      if (e.hopT <= 0 && Math.abs(e.body.linvel().y) < 0.6 && d < 16 && t.y < y + 2) {
        e.hopT = 1.2; const k = 4.5 / Math.max(1, d);
        e.body.setLinvel({ x: (rp.x - t.x) * k, y: 9, z: (rp.z - t.z) * k }, true); e.body.setAngvel({ x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 2 }, true);
        game.audio.jump();
      }
    }
  };
  game.tickers.add(tick);
  return { dispose: () => { game.tickers.delete(tick); list.forEach((e) => e.alive && game.temp.push({ e, t: 0.1, poof: true })); } };
}

// ───────── the Narrator throws adverbs at you ─────────
const WORDS = ['DE PRONTO', 'SIN EMBARGO', 'CASUALMENTE', 'POR DESGRACIA', 'ENTONCES', 'DE REPENTE', 'INEXPLICABLEMENTE', 'NO OBSTANTE', 'ADJETIVO'];
const wordMats = {}, wordGeo = new THREE.PlaneGeometry(5.6, 1.1);
export function makeWords(game, origin) {
  const scene = game.gfx.scene, live = [];
  const pool = WORDS.map((w) => { const m = new THREE.Mesh(wordGeo, (wordMats[w] ||= new THREE.MeshBasicMaterial({ map: textTex(w, { w: 1024, h: 200, color: '#fff2c0', glow: '#ffb030', font: 'italic 800 130px Georgia, serif' }), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }))); m.rotation.x = -0.7; m.visible = false; scene.add(m); return m; });
  let t = 1.5, n = 0;
  const S = { on: true };
  const tick = (dt) => {
    const r = game.robot, rp = r.position;
    t -= dt;
    if (S.on && t <= 0 && live.length < 5) {
      t = 1.5; const w = WORDS[n++ % WORDS.length];
      const mesh = pool[(n - 1) % pool.length]; if (mesh.visible) return;
      mesh.visible = true; mesh.position.set(origin.x, origin.y + 0.7, origin.z);
      const d = V(rp.x - origin.x, 0, rp.z - origin.z).normalize();
      live.push({ mesh, d, life: 5, w }); game.audio.whoosh();
    }
    for (let i = live.length - 1; i >= 0; i--) {
      const o = live[i]; o.life -= dt; o.mesh.position.addScaledVector(o.d, 7.5 * dt); o.mesh.position.y = origin.y + 0.7 + Math.sin(o.life * 6) * 0.12;
      const hit = r.stun <= 0 && Math.abs(rp.y - origin.y) < 1.2 && dist(rp, o.mesh.position.x, o.mesh.position.z) < 1.25 && r.hurt(1, { x: o.d.x * 6, y: 7, z: o.d.z * 6 }, 1);
      if (hit) { game.gfx.shake(0.4); game.hitstop(0.07); game.pop(rp.clone().setY(rp.y + 1.6), '¡' + o.w + '!', '#ffd24a'); game.audio.thud(1); }
      if (hit || o.life <= 0) { o.mesh.visible = false; live.splice(i, 1); }
    }
  };
  game.tickers.add(tick);
  S.dispose = () => { game.tickers.delete(tick); pool.forEach((m) => scene.remove(m)); };
  return S;
}
