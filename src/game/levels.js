// Bigger 3D content: the prop warehouse (explore, sweep nests, secrets, the weapon), the wave of extras,
// the extra bridge hazards and the Narrator's second phase.
import * as THREE from 'three';
import { GROUPS } from '../engine/physics.js';
import { canvasTex, textTex, noiseTex, lightCone } from '../engine/gfx.js';
import { MAT, shadowed } from './robot.js';
import { makeCrate, makePiano, spawnDebris } from './actors.js';
import { makeBarrels, makeWords } from './extras.js';
import { spawnEnemy, clearEnemies, makeStains, aliveCount } from './combat.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const dist = (a, x, z) => Math.hypot(a.x - x, a.z - z);
export const WH = { x: 230, z: 0, half: 30 };

const label = (text, color = '#fff2c0', w = 3) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(text, { w: 512, h: 128, color, font: '800 56px system-ui', glow: '#000' }), transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(w, w / 4, 1); return s;
};

// ───────────────────────── the prop warehouse ─────────────────────────
export function buildWarehouse(game, A) {
  const { gfx, physics } = game, scene = gfx.scene, X = WH.x, Z = WH.z, H = WH.half;
  const root = new THREE.Group(); root.visible = false; scene.add(root);
  const floorTex = canvasTex(512, 512, (g) => {
    g.fillStyle = '#4a4e57'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) { const v = 60 + Math.random() * 40; g.fillStyle = `rgba(${v},${v},${v + 6},.35)`; g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    g.fillStyle = '#e8b23a'; g.fillRect(0, 250, 512, 10);
  }, { repeat: [6, 6] });
  const box = (size, pos, mat, collide = true, parent = root) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); m.position.set(...pos); m.castShadow = m.receiveShadow = true; parent.add(m);
    if (collide) physics.add({ type: 'fixed', pos, shapes: [{ kind: 'box', size }], group: GROUPS.world, friction: 0.8 });
    return m;
  };
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a6070, roughness: 0.85, bumpMap: noiseTex(128, { contrast: 1.5 }), bumpScale: 0.5 });
  const floor = box([H * 2, 0.6, H * 2 + 12], [X, A - 0.3, Z - 6], new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75, metalness: 0.15 }));
  floor.castShadow = false;
  box([H * 2, 5, 0.6], [X, A + 2.5, Z + H], wallMat);
  box([0.6, 5, H * 2], [X - H, A + 2.5, Z], wallMat); box([0.6, 5, H * 2], [X + H, A + 2.5, Z], wallMat);
  box([H - 3, 5, 0.6], [X - H / 2 - 1.5, A + 2.5, Z - H], wallMat); box([H - 3, 5, 0.6], [X + H / 2 + 1.5, A + 2.5, Z - H], wallMat);
  box([6, 0.5, 0.6], [X, A + 4.75, Z - H], wallMat);
  box([0.6, 3, 12], [X - 3.3, A + 1.5, Z - H - 6], wallMat); box([0.6, 3, 12], [X + 3.3, A + 1.5, Z - H - 6], wallMat); // corridor out
  // the exit door
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x8a2d2d, roughness: 0.4, metalness: 0.5 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 0.3), doorMat); door.position.set(X, A + 2.25, Z - H); door.castShadow = true; root.add(door);
  let doorBody = physics.add({ type: 'fixed', pos: [X, A + 2.25, Z - H], shapes: [{ kind: 'box', size: [6, 4.5, 0.6] }], group: GROUPS.world });
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: textTex('SALIDA', { w: 512, h: 128, bg: '#130303', color: '#ff5050', glow: '#ff5050', font: '800 90px system-ui' }), toneMapped: false }));
  exitSign.position.set(X, A + 5.4, Z - H + 0.35); root.add(exitSign);
  const big = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.2), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, map: textTex(['ALMACÉN DE ATREZO', 'material descartado · no tocar'], { w: 2048, h: 280, color: '#f2c14e', glow: '#ff9a30', font: '800 110px system-ui' }) }));
  big.position.set(X, A + 9, Z - H - 0.5); root.add(big);
  // shelf rows split the space in three lanes, with a cross aisle at z = -2
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6d7482, roughness: 0.4, metalness: 0.8 });
  const propGeo = new THREE.BoxGeometry(1, 1, 1), props = new THREE.InstancedMesh(propGeo, new THREE.MeshStandardMaterial({ roughness: 0.55 }), 220);
  let pn = 0; const col = new THREE.Color(), o = new THREE.Object3D(), pal = [0xff7a1a, 0x4fb7ff, 0xf2c14e, 0x7dff9a, 0xff8fc7, 0xeeeeee, 0xb06aff];
  for (const sx of [X - 12, X + 12]) for (const [z0, z1] of [[Z - 22, Z - 5], [Z + 1, Z + 16]]) {
    const len = z1 - z0, cz = (z0 + z1) / 2;
    physics.add({ type: 'fixed', pos: [sx, A + 2, cz], shapes: [{ kind: 'box', size: [1.6, 4, len] }], group: GROUPS.world });
    for (let l = 0; l < 4; l++) box([1.6, 0.08, len], [sx, A + 0.35 + l * 1.15, cz], shelfMat, false);
    for (const dz of [z0 + 0.1, z1 - 0.1]) for (const dx of [-0.75, 0.75]) box([0.08, 4.2, 0.08], [sx + dx, A + 2.1, dz], shelfMat, false);
    for (let l = 0; l < 3; l++) for (let z = z0 + 0.6; z < z1 - 0.5; z += 0.8 + Math.random() * 0.6) {
      if (pn >= 220 || Math.random() < 0.2) continue;
      const h = 0.35 + Math.random() * 0.6; o.position.set(sx + (Math.random() - 0.5) * 0.5, A + 0.4 + l * 1.15 + h / 2, z); o.scale.set(0.4 + Math.random() * 0.5, h, 0.5); o.rotation.y = Math.random() * 0.4; o.updateMatrix();
      props.setMatrixAt(pn, o.matrix); props.setColorAt(pn, col.setHex(pal[(Math.random() * pal.length) | 0])); pn++;
    }
  }
  props.count = pn; props.castShadow = true; root.add(props);
  for (const [x, z, t] of [[X - 12, Z - 23.5, 'PASILLO 3: CLICHÉS'], [X + 12, Z - 23.5, 'PASILLO 7: GIROS'], [X - 12, Z + 17.5, 'PASILLO 1: PRÓLOGOS'], [X + 12, Z + 17.5, 'PASILLO 9: SECUELAS']]) { const s = label(t, '#ffffff', 4); s.position.set(x, A + 4.8, z); root.add(s); }
  const fl = lightCone(10, 4, 0xffd2a0, 0.08); fl.position.set(X, A + 12, Z); root.add(fl);

  // ---- interactables and secrets ----
  const things = [];
  const thing = (x, z, build, touch, { r = 1.4, cd = 2.5, tag = null } = {}) => { const g = new THREE.Group(); build(g); g.position.set(x, A, z); root.add(shadowed(g)); if (tag) { const s = label(tag, '#9fefff', 2.6); s.position.set(0, 2.6, 0); g.add(s); } things.push({ g, x, z, r, cd, t: 0, n: 0, touch }); return g; };
  const red = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 2 });
  const P = () => game.prog, ui = game.ui;
  thing(X - 15, Z + 22, (g) => { box([0.8, 1, 0.8], [0, 0.5, 0], MAT.rubber, false, g); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.18, 24), red); b.position.y = 1.08; g.add(b); }, (it) => {
    game.audio.beep(false); game.gfx.particles.burst(V(X - 15, A + 1.5, Z + 22), 60, { color: [0xff5a8a, 0x6fe3ff, 0xf2c14e][it.n % 3], speed: 7, life: 1.4, size: 0.2, gravity: -4, up: 1.5 });
    if (it.n === 1) ui.bark('narrador', 'Pone «NO PULSAR». En mayúsculas.');
    else if (it.n === 2) { ui.bark('narrador', 'Te lo he advertido.'); const rp = game.robot.position; makePiano(game, [rp.x + 4, A + 14, rp.z - 2], { vy: -6 }); game.pianos++; }
    else if (it.n === 3) { ui.bark('narrador', 'Vale. Tú ganas. Toma un logro y deja el botón en paz.'); P().secret('button', 'Botón rojo', 'Pulsar tres veces lo que no se pulsa'); }
  }, { tag: 'NO PULSAR' });
  thing(X + 27, Z + 24, (g) => { box([1.4, 2.4, 1], [0, 1.2, 0], new THREE.MeshStandardMaterial({ color: 0x1f6e4a, roughness: 0.4, metalness: 0.4 }), false, g); const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.2), new THREE.MeshBasicMaterial({ map: textTex(['CAFÉ', 'DEL', 'GUIONISTA'], { w: 256, h: 300, bg: '#0d2a1d', color: '#7dffb0', font: '800 46px system-ui' }), toneMapped: false })); s.position.set(0, 1.5, 0.51); g.add(s); }, () => {
    game.robot.heal(9); game.audio.chime(); ui.bark('narrador', 'Café del guionista. Recupera toda la vida. Y la ansiedad.'); P().secret('coffee', 'Cafeína narrativa', 'Tomarte el café del guionista');
  }, { cd: 18, tag: 'CAFÉ' });
  const moods = ['chip', 'noir', 'tense', 'calm'];
  thing(X - 27, Z + 24, (g) => { box([1.4, 1.9, 0.9], [0, 0.95, 0], new THREE.MeshStandardMaterial({ color: 0x5a2a12, roughness: 0.4 }), false, g); const t = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff8fc7, emissiveIntensity: 3 })); t.position.set(0, 1.9, 0.46); g.add(t); }, (it) => {
    game.audio.mood(moods[it.n % 4]); ui.bark('robot', ['♪ Temazo.', '♪ Esta es más triste.', '♪ Esta da miedo.', '♪ Vuelvo a la de antes.'][(it.n - 1) % 4]); P().secret('jukebox', 'DJ del atrezo', 'Cambiar la música del almacén');
  }, { tag: 'GRAMOLA' });
  thing(X - 4, Z + 27, (g) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.4), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, map: canvasTex(256, 440, (c) => { c.fillStyle = '#c9a36b'; c.fillRect(0, 0, 256, 440); c.fillStyle = '#d97757'; c.beginPath(); c.arc(128, 110, 70, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = '800 34px system-ui'; c.textAlign = 'center'; c.fillText('CLAUDE', 128, 250); c.font = '500 22px system-ui'; c.fillText('(tamaño real)', 128, 285); c.fillText('(es broma)', 128, 315); }) })); m.position.y = 1.3; m.rotation.y = Math.PI; g.add(m); }, () => {
    if (P().secret('claude', 'Cameo', 'Encontrar al creador en cartón')) ui.bark('creador', 'Hola. Sí, soy yo. En cartón. Sale más barato que aparecer en persona.');
  }, { cd: 999 });
  thing(X + 28, Z - 8, (g) => { const fr = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 1.6), MAT.steel); fr.position.y = 1.3; g.add(fr); const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.3), new THREE.MeshStandardMaterial({ color: 0xbfd8ff, metalness: 1, roughness: 0.02 })); gl.position.set(-0.11, 1.3, 0); gl.rotation.y = -Math.PI / 2; g.add(gl); }, () => {
    if (P().secret('mirror', 'Narcisismo', 'Mirarte en el espejo')) { ui.bark('robot', 'Me veo… renderizado.'); ui.bark('narrador', 'Es tu mejor ángulo. Lo elegí yo.'); }
  }, { cd: 999 });
  thing(X - 28, Z - 27, (g) => { const pts = [[0, -0.07], [0.3, -0.07], [0.36, 0], [0.32, 0.07], [0, 0.085]].map((p) => new THREE.Vector2(p[0], p[1])); const b = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.6 })); b.position.y = 0.1; g.add(b); }, () => {
    if (P().secret('pelusa1', 'Pelusa v1', 'Encontrar el prototipo sin colorear')) { ui.bark('pelusa', 'Bip… (versión 1, sin texturas)'); ui.bark('robot', '¿Pelusa? ¿Cuántas versiones de ti hay?'); }
  }, { cd: 999 });
  thing(X + 15, Z - 27, (g) => { box([1.6, 0.5, 1.6], [0, 0.25, 0], new THREE.MeshStandardMaterial({ color: 0xdedede, roughness: 0.5 }), false, g); const t = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: textTex('ESC', { w: 256, h: 128, color: '#222', font: '800 90px system-ui' }), transparent: true })); t.rotation.x = -Math.PI / 2; t.position.y = 0.51; g.add(t); }, () => {
    if (P().secret('esc', 'Sin escapatoria', 'Pisar la tecla ESC')) ui.bark('sistema', 'No hay escape. Literalmente: esa tecla no está asignada.');
  }, { cd: 999 });
  thing(X + 10, Z + 22, (g) => { box([1.6, 1, 1], [0, 0.5, 0], new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7 }), false, g); }, (it) => {
    const alts = ['Final alternativo nº 4: M0P-1 abre una pastelería. Descartado: demasiado feliz.', 'Final alternativo nº 9: todo era un sueño de Pelusa. Descartado: demasiado visto.', 'Final alternativo nº 12: el jugador apaga el juego. Ese no lo controlo.'];
    ui.bark('narrador', alts[(it.n - 1) % 3]); P().secret('drawer', 'Finales descartados', 'Leer un final que nunca existió');
  }, { cd: 6, tag: 'FINALES ALTERNATIVOS' });
  // the weapon
  const ped = new THREE.Group(); ped.position.set(X - 25, A, Z - 24); root.add(ped);
  box([1.2, 1, 1.2], [0, 0.5, 0], new THREE.MeshPhysicalMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.25 }), false, ped);
  const gunShow = new THREE.Group(); gunShow.position.y = 1.6; ped.add(gunShow);
  const gb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.7), new THREE.MeshPhysicalMaterial({ color: 0x29d3ff, clearcoat: 1, roughness: 0.3 })); gunShow.add(gb);
  const gt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 12), new THREE.MeshPhysicalMaterial({ color: 0xff8fc7, roughness: 0.2 })); gt.position.y = 0.4; gunShow.add(gt);
  const gl = label('PULVERIZADOR 3000', '#6fe3ff', 3.4); gl.position.y = 3; ped.add(gl);
  const pedCone = lightCone(6, 1.4, 0x6fe3ff, 0.25); pedCone.position.y = 6; ped.add(pedCone);

  // nests of dust bunnies (each wakes up when you get close)
  const NESTS = [
    { id: 'n1', x: X - 22, z: Z - 12, waves: [[['pelusa', 5]], [['pelusa', 3], ['calcetin', 1]]] },
    { id: 'n2', x: X + 22, z: Z + 6, waves: [[['pelusa', 4], ['calcetin', 2]], [['calcetin', 3], ['grapadora', 1]]] },
    { id: 'n3', x: X, z: Z - 18, waves: [[['grapadora', 2], ['pelusa', 4]], [['calcetin', 2], ['grapadora', 2], ['pelusa', 3]]] },
  ];
  const moundGeo = new THREE.SphereGeometry(1.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const n of NESTS) { n.m = new THREE.Mesh(moundGeo, new THREE.MeshStandardMaterial({ color: 0x55505c, roughness: 1, flatShading: true })); n.m.position.set(n.x, A, n.z); n.m.scale.y = 0.6; root.add(n.m); n.state = 'idle'; }
  const crates = [], stainSpots = [[-26, 14], [-20, 4], [-6, 10], [4, 18], [16, 10], [26, -2], [20, -16], [6, -10], [-8, -24], [-16, -2], [-26, -18], [0, 4], [10, 26], [-12, 22]];

  const W = {
    root, NESTS, entrance: V(X, A, Z + 24),
    enter() {
      root.visible = true;
      gfx.point(1, { color: 0xffc890, intensity: 120, distance: 34, pos: [X - 14, A + 7, Z - 8] });
      gfx.point(2, { color: 0x90c8ff, intensity: 120, distance: 34, pos: [X + 14, A + 7, Z + 6] });
      gfx.point(99, { color: 0xff9a60, intensity: 80, distance: 26, pos: [X, A + 6, Z - 22] });
      if (!crates.length) {
        [[-26, 6], [-25, 7.2], [26, 18], [25, 16.8], [-4, -26], [4, -26], [14, 14], [-18, -20]].forEach(([x, z], i) => crates.push(makeCrate(game, [X + x, A, Z + z], 1, ['UTILERÍA', 'DECORADOS', 'EXTRAS', 'VESTUARIO'][i % 4])));
        W.barrels = makeBarrels(game, [[X - 20, Z - 15], [X - 24, Z - 10], [X + 19, Z + 9], [X + 3, Z - 21], [X - 3, Z - 21]], A);
        W.stains = makeStains(game, stainSpots.map(([x, z]) => [X + x, Z + z]), A);
      }
    },
    leave() { root.visible = false; },
    /** one attempt at the level (used inside game.trial) */
    run(scope, attempt) {
      const r = game.robot, P = game.prog;
      r.teleport(W.entrance.x, A + 0.1, W.entrance.z, Math.PI); gfx.cam.snap = true;
      game.floorY = A; game.checkpoint.copy(W.entrance);
      for (const n of NESTS) if (n.state === 'active') { n.state = 'idle'; clearEnemies(game, (e) => e.tag === n.id); }
      const objective = () => { const c = NESTS.filter((n) => n.state === 'clear').length; ui.objective(c < 3 ? `Despeja los nidos de pelusas (${c}/3)` : 'Sal por la puerta del fondo'); };
      objective();
      const spawnWave = (n) => { const w = n.waves[n.wave]; let k = 0; for (const [t, c] of w) for (let i = 0; i < c; i++, k++) { const a = k * 2.1 + Math.random() * 0.4, rr = 2 + Math.random() * 2.5; spawnEnemy(game, t, n.x + Math.cos(a) * rr, A, n.z + Math.sin(a) * rr, { tag: n.id, bounds: [X - H + 1, X + H - 1, Z - H + 1, Z + H - 1] }); } };
      let doorOpen = !doorBody, doorY = door.position.y;
      scope.tick((dt) => {
        const p = r.position;
        for (const n of NESTS) {
          if (n.state === 'idle' && dist(p, n.x, n.z) < 9) { n.state = 'active'; n.wave = 0; spawnWave(n); game.audio.alarm(); ui.bark('narrador', ['¡Un nido de pelusas! Las dejé ahí para que tuvieras algo que barrer.', 'Más pelusas. Y calcetines desparejados. El atrezo tiene vida propia.', 'El último nido. Con grapadoras. Grapan guiones. Y robots.'][NESTS.indexOf(n)]); }
          if (n.state === 'active' && aliveCount(game, n.id) === 0) {
            n.wave++;
            if (n.wave < n.waves.length) spawnWave(n);
            else {
              n.state = 'clear'; P.addXp(80); game.addScore(1500); game.audio.chime(); n.m.visible = false;
              gfx.particles.burst(V(n.x, A + 0.8, n.z), 120, { color: 0xb0aab8, speed: 9, life: 1.4, size: 0.5, gravity: -1, drag: 2 });
              game.pop(V(n.x, A + 2.5, n.z), '¡NIDO LIMPIO!', '#7dffb0', true); objective();
              if (NESTS.every((m) => m.state === 'clear')) { ui.bark('narrador', 'Almacén despejado. La puerta del fondo está abierta. Por fin un nivel con sentido.'); ui.achieve('warehouse', 'Mozo de almacén', 'Despejar los tres nidos'); }
            }
          }
        }
        // touchables
        for (const it of things) { it.t -= dt; if (it.t <= 0 && dist(p, it.x, it.z) < it.r && Math.abs(p.y - A) < 2) { it.t = it.cd; it.n++; it.touch(it); } }
        // the weapon pedestal
        gunShow.rotation.y += dt * 1.5; gunShow.position.y = 1.6 + Math.sin(game.time * 2) * 0.12;
        if (!P.weapon && dist(p, ped.position.x, ped.position.z) < 1.6) {
          P.giveWeapon(); gunShow.visible = false; pedCone.visible = false; gl.visible = false; game.audio.trophy(); game.pop(p.clone().setY(A + 2.6), '¡PULVERIZADOR 3000!', '#6fe3ff', true);
          ui.bark('narrador', 'El Pulverizador 3000. Dispara solo. Como los buenos guiones: sin que hagas nada.'); ui.achieve('weapon', 'Armado y limpio', 'Conseguir el Pulverizador 3000');
        }
        // the door opens when every nest is clear
        if (!doorOpen && NESTS.every((n) => n.state === 'clear')) { doorOpen = true; physics.remove(doorBody); doorBody = null; game.audio.whoosh(); }
        if (doorOpen && door.position.y < A + 6.5) door.position.y += dt * 2.5;
      });
      // autopilot: nests, then the weapon, then out; walk round the shelves through the cross aisle
      game.botDash = true;
      game.botTarget = () => {
        const p = r.position, foe = [...game.enemies].sort((a, b) => dist(p, a.pos.x, a.pos.z) - dist(p, b.pos.x, b.pos.z))[0];
        let t = foe && dist(p, foe.pos.x, foe.pos.z) < 12 ? foe.pos : null;
        if (!t) { const n = NESTS.find((n) => n.state !== 'clear'); t = n ? V(n.x, A, n.z + 2) : !P.weapon ? ped.position.clone().setZ(ped.position.z + 1.6) : V(X, A, Z - H - 6); }
        // a shelf row in the way: go to the cross aisle, then straight through it to the far side
        for (const sx of [X - 12, X + 12]) if ((p.x - sx) * (t.x - sx) < 0) return Math.abs(p.z - (Z - 2)) > 1.2 ? V(p.x + Math.sign(p.x - sx) * 0.5, A, Z - 2) : V(sx - Math.sign(p.x - sx) * 3, A, Z - 2);
        return t;
      };
      scope.on(() => { game.botTarget = null; game.botDash = false; });
      return game.until(() => r.position.z < Z - H - 3);
    },
  };
  return W;
}

// ───────────────────────── waves of extras on the Narrator's stage ─────────────────────────
export async function extrasWaves(game, scope, center, R = 13) {
  const { ui } = game, A = center.y;
  const waves = [
    { say: '¡Primera oleada! Extras sin frase. Cobran por día.', list: [['extra', 5]] },
    { say: 'Segunda oleada: extras con pelusas. Presupuesto ajustado.', list: [['extra', 4], ['pelusa', 4]] },
    { say: 'Última oleada. Los extras caros. Con grapadora.', list: [['calcetin', 3], ['grapadora', 2], ['extra', 3]] },
  ];
  game.botDash = true;
  game.botTarget = () => { const p = game.robot.position, e = [...game.enemies].sort((a, b) => dist(p, a.pos.x, a.pos.z) - dist(p, b.pos.x, b.pos.z))[0]; return e ? e.pos : V(center.x, A, center.z + 6); };
  scope.on(() => { game.botTarget = null; game.botDash = false; clearEnemies(game, (e) => e.tag === 'extras'); });
  for (let i = 0; i < waves.length; i++) {
    const w = waves[i]; ui.objective(`Barre a los extras (oleada ${i + 1}/3)`); ui.bark('narrador', w.say); game.audio.alarm();
    let k = 0; for (const [t, c] of w.list) for (let j = 0; j < c; j++, k++) { const a = k * 0.9 + i; spawnEnemy(game, t, center.x + Math.cos(a) * R * 0.8, A, center.z + Math.sin(a) * R * 0.8, { tag: 'extras', bounds: [center.x - R, center.x + R, center.z - R, center.z + R] }); }
    await game.until(() => aliveCount(game, 'extras') === 0);
    game.audio.chime(); await game.sleep(1.2);
  }
  ui.objective(''); ui.achieve('extras', 'Recorte de plantilla', 'Despedir a todos los extras');
}

// ───────────────────────── extra bridge hazards: punching gloves, bowling balls, a conveyor ─────────────────────────
export function bridgeHazards(game, A, { gloves = [-33, -46], conveyor = [-40, -44], ballsFrom = -54 } = {}) {
  const { scene } = game.gfx, r = game.robot, items = [];
  const gloveMat = new THREE.MeshPhysicalMaterial({ color: 0xd0202a, roughness: 0.3, clearcoat: 1 });
  const G = gloves.map((z, i) => {
    const g = new THREE.Group(); const fist = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), gloveMat); fist.scale.set(1.1, 0.9, 0.9); g.add(fist);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 10), MAT.steel); arm.rotation.z = Math.PI / 2; arm.position.x = -2.2; g.add(arm);
    const side = i % 2 ? 1 : -1; g.position.set(side * 4.2, A + 0.7, z); g.rotation.y = side > 0 ? Math.PI : 0; scene.add(shadowed(g));
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), MAT.rubber); post.position.set(side * 5.6, A + 0.4, z); scene.add(post);
    return { g, z, side, t: i * 1.3, post };
  });
  const arrows = canvasTex(256, 64, (c) => { c.fillStyle = '#20232b'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#f2c14e'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(20 + i * 64, 10); c.lineTo(52 + i * 64, 32); c.lineTo(20 + i * 64, 54); c.lineTo(32 + i * 64, 32); c.fill(); } }, { repeat: [1, 3] });
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(4.4, conveyor[0] - conveyor[1]), new THREE.MeshStandardMaterial({ map: arrows, roughness: 0.6 }));
  belt.rotation.x = -Math.PI / 2; belt.rotation.z = Math.PI / 2; belt.position.set(0, A + 0.02, (conveyor[0] + conveyor[1]) / 2); scene.add(belt);
  const signs = [[-27, 'ZONA DE OBRAS'], [-37, 'CINTA TRANSPORTADORA (va al revés)'], [-50, 'NO MIRES ABAJO']].map(([z, t], i) => { const s = label(t, '#ffe14d', 4.4); s.position.set(i % 2 ? 3.4 : -3.4, A + 2.4, z); scene.add(s); return s; });
  let ballT = 2, alive = true, lane = 1;
  const tick = (dt) => {
    if (!alive) return;
    const p = r.position;
    for (const gl of G) {
      gl.t += dt; const ph = (gl.t % 2.6) / 2.6, ext = ph < 0.12 ? ph / 0.12 : ph < 0.35 ? 1 : ph < 0.7 ? 1 - (ph - 0.35) / 0.35 : 0;
      const x = gl.side * (4.2 - ext * 5.6); gl.g.position.x = x;
      if (ext > 0.6 && ph < 0.35 && Math.abs(p.z - gl.z) < 1 && Math.abs(p.x - x) < 1.1 && p.y < A + 1.5 && r.hurt(1, { x: -gl.side * 11, y: 6, z: 0 }, 1.2)) { game.audio.thud(1.2); game.pop(p.clone().setY(A + 2), '¡PUÑETAZO DE GUION!', '#ff5a6a'); }
    }
    arrows.offset.x -= dt * 0.9;
    if (p.z < conveyor[0] && p.z > conveyor[1] && Math.abs(p.x) < 2.3 && p.y < A + 1.2 && r.dashT <= 0) { const b = r.chassis.body, t = b.translation(); b.setTranslation({ x: t.x, y: t.y, z: t.z + 2.6 * dt }, true); }
    ballT -= dt;
    if (ballT <= 0 && p.z < -30 && p.z > ballsFrom + 5) { // never right at the end you are heading for
      ballT = 2.8; lane = -lane;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 20, 16), new THREE.MeshPhysicalMaterial({ color: [0x29d3ff, 0xff8fc7, 0x7dff9a][items.length % 3], roughness: 0.15, clearcoat: 1 })); m.castShadow = true; scene.add(m);
      const e = game.physics.add({ mesh: m, pos: [lane * 1.3, A + 0.7, ballsFrom], /* alternate lanes: one side is always free */ shapes: [{ kind: 'ball', size: [0.6] }], density: 3, friction: 0.4, restitution: 0.2, linDamp: 0.02, angDamp: 0.05 });
      e.body.setLinvel({ x: 0, y: 0, z: 6.5 }, true); game.temp.push({ e, t: 9, poof: true }); items.push(e); game.audio.rumble(0.5);
    }
  };
  game.tickers.add(tick);
  return { dispose() { alive = false; game.tickers.delete(tick); G.forEach((g) => { scene.remove(g.g); scene.remove(g.post); }); scene.remove(belt); signs.forEach((s) => scene.remove(s)); items.forEach((e) => game.physics.remove(e)); } };
}

// ───────────────────────── the Narrator, second phase ─────────────────────────
export function eyeFight(game, W, scope, { A, SZ, hp = 40 }) {
  const { gfx, ui, audio } = game, r = game.robot, eye = W.eye, scene = gfx.scene;
  const home = V(0, A + 8.5, SZ - 7), center = V(0, A, SZ);
  const E = { hp, max: hp, vuln: 0, alive: true, weaponDmg: 1 };
  E.aim = () => eye.position; E.pos = eye.position;
  E.hit = (n, from) => { if (E.hp <= 0) return; E.hp -= E.vuln > 0 ? n : n * 0.2; W.irisMat.emissive.setRGB(3, 0.6, 0.4); setTimeout(() => W.irisMat.emissive.setHex(0xffa040), 90); ui.bossBar('EL NARRADOR', E.hp / E.max); if (E.vuln > 0) game.pop(eye.position.clone().setY(eye.position.y + 2), '¡CRÍTICA!', '#ffd24a'); };
  game.targets.add(E); scope.on(() => { game.targets.delete(E); ui.bossBar('', null); });
  ui.bossBar('EL NARRADOR', 1);
  // beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(32, 0.25, 0.7), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff3030, emissiveIntensity: 5 })); beam.position.set(center.x, A + 0.35, center.z); beam.visible = false; scene.add(beam);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.18, 8, 80), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffc24a, emissiveIntensity: 4 })); ring.rotation.x = Math.PI / 2; ring.visible = false; scene.add(ring);
  const words = makeWords(game, V(0, A, SZ - 4)); words.on = false;
  const marks = [], ringGeo = new THREE.RingGeometry(0.9, 1.15, 40);
  scope.on(() => { scene.remove(beam); scene.remove(ring); words.dispose(); marks.forEach((m) => scene.remove(m.mesh)); eye.position.copy(home); clearEnemies(game, (e) => e.tag === 'eye'); });
  let atk = null, t = 0, step = 0, ringR = 0, slamTo = null, dashCd = 0, pianoT = 0;
  const ORDER = ['beam', 'slam', 'pianos', 'slam', 'words', 'summon', 'slam'];
  const next = () => {
    const angry = E.hp < E.max * 0.45;
    atk = ORDER[step++ % ORDER.length]; t = 0;
    const lines = { beam: 'Rayo narrativo. Muy simbólico.', slam: '¡Giro de guion!', pianos: 'Los últimos pianos. Los buenos.', words: 'Adverbios. Muchos.', summon: '¡Extras, a escena!' };
    ui.bark('narrador', (angry ? '¡¡' : '') + lines[atk] + (angry ? '!!' : ''));
    if (atk === 'beam') { beam.visible = true; beam.rotation.y = Math.atan2(r.position.x - center.x, r.position.z - center.z) + Math.PI / 2 + 0.9; audio.laser(); }
    if (atk === 'words') words.on = true;
    if (atk === 'summon') for (let i = 0; i < (angry ? 5 : 3); i++) spawnEnemy(game, i % 2 ? 'calcetin' : 'pelusa', center.x + Math.cos(i * 2) * 8, A, center.z + Math.sin(i * 2) * 8, { tag: 'eye', bounds: [-15, 15, SZ - 15, SZ + 15] });
    if (atk === 'slam') { slamTo = V(Math.max(-9, Math.min(9, r.position.x)), A + 2.4, Math.max(SZ - 9, Math.min(SZ + 9, r.position.z))); audio.revUp(); }
  };
  next();
  scope.tick((dt) => {
    if (!dt) return;
    const angry = E.hp < E.max * 0.45, sp = angry ? 1.35 : 1, p = r.position;
    t += dt * sp; dashCd -= dt; E.vuln -= dt;
    if (atk === 'beam') {
      beam.rotation.y += dt * (angry ? 1.25 : 0.9);
      const a = beam.rotation.y, dx = p.x - center.x, dz = p.z - center.z, perp = Math.abs(dz * Math.cos(a) + dx * Math.sin(a)); // distance from the beam's line
      if (perp < 0.55 && Math.hypot(dx, dz) < 16 && p.y < A + 1.2 && r.hurt(1, { x: Math.sin(a) * 6, y: 6, z: Math.cos(a) * 6 }, 1)) { audio.laser(); game.pop(p.clone().setY(A + 2), '¡ZAS!', '#ff4050'); }
      if (t > 6) { beam.visible = false; next(); }
    } else if (atk === 'slam') {
      if (t < 1.1) { eye.position.lerp(V(slamTo.x, A + 9, slamTo.z), Math.min(1, dt * 4)); }
      else if (t < 1.35) { eye.position.lerp(slamTo, Math.min(1, dt * 18)); }
      else if (!E.slammed) { E.slammed = true; eye.position.copy(slamTo); gfx.shake(1); audio.explode(); game.hitstop(0.1); ringR = 1; ring.visible = true; ring.position.set(slamTo.x, A + 0.3, slamTo.z); E.vuln = 3.6 / sp; ui.bark('narrador', '¡Ay! ¡Estoy en el suelo! No me embistas.'); game.pop(slamTo.clone().setY(A + 4.5), '¡VULNERABLE!', '#7dffb0', true); }
      if (ring.visible) {
        ringR += dt * 7.5; ring.scale.setScalar(ringR);
        const d = dist(p, ring.position.x, ring.position.z);
        if (Math.abs(d - ringR) < 0.55 && p.y < A + 1 && r.hurt(1, { x: (p.x - ring.position.x) / d * 8, y: 7, z: (p.z - ring.position.z) / d * 8 }, 1)) game.pop(p.clone().setY(A + 2), '¡ONDA!', '#ffc24a');
        if (ringR > 17) ring.visible = false;
      }
      if (E.vuln > 0 && dashCd <= 0 && (r.dashT > 0 || r.superT > 0) && dist(p, eye.position.x, eye.position.z) < 3.2) { dashCd = 0.8; E.hit(r.superT > 0 ? 7 : 4); audio.thud(1.4); gfx.shake(0.6); game.hitstop(0.12); }
      if (t > 1.35 + 3.8 / sp) { eye.position.lerp(home, Math.min(1, dt * 3)); if (eye.position.distanceTo(home) < 0.4) { E.slammed = false; ring.visible = false; next(); } }
    } else if (atk === 'pianos') {
      pianoT -= dt;
      if (pianoT <= 0) {
        pianoT = angry ? 0.7 : 1; const v = r.chassis.body.linvel();
        const x = p.x + v.x * 0.6 + (Math.random() - 0.5) * 3, z = p.z + v.z * 0.6 + (Math.random() - 0.5) * 3;
        const e = makePiano(game, [x, A + 20, z], { rotY: Math.random() * 6, vy: -10 }); game.pianos++; game.temp.push({ e, t: 4, poof: true });
        const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, A + 0.03, z); scene.add(m); marks.push({ mesh: m, t: 1.4 });
      }
      if (t > 6) next();
    } else if (atk === 'words') { if (t > 6) { words.on = false; next(); } }
    else if (atk === 'summon') { if (t > 2 && (t > 14 || ![...game.enemies].some((e) => e.tag === 'eye'))) next(); }
    for (let i = marks.length - 1; i >= 0; i--) { const m = marks[i]; m.t -= dt; m.mesh.scale.setScalar(Math.max(0.01, m.t / 1.4)); if (m.t <= 0) { scene.remove(m.mesh); marks.splice(i, 1); } }
    if (E.vuln > 0) W.irisMat.emissiveIntensity = 1.5 + Math.sin(game.time * 20) * 1;
  });
  // autopilot: keep moving, dive at the eye when it is down
  game.botDash = true;
  game.botTarget = () => (E.vuln > 0 ? V(eye.position.x, A, eye.position.z) : V(Math.sin(game.time * 0.6) * 9, A, SZ + Math.cos(game.time * 0.6) * 9));
  scope.on(() => { game.botTarget = null; game.botDash = false; });
  return game.until(() => E.hp <= 0);
}
