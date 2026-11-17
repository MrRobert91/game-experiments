import * as THREE from 'three';
import { GROUPS } from '../engine/physics.js';
import { canvasTex, noiseTex, textTex, lightCone } from '../engine/gfx.js';
import { MAT, shadowed } from './robot.js';
import { makeCrate, makeCone } from './actors.js';

export const ARENA_Y = -70;
export const STAGE_Z = -78;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const rough = noiseTex(256, { contrast: 0.9, scratches: 90, repeat: [1, 1] });
const bump = noiseTex(256, { contrast: 1.5, scratches: 60 });
const tileMap = canvasTex(256, 256, (g) => {
  g.fillStyle = '#23262e'; g.fillRect(0, 0, 256, 256);
  const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, 'rgba(255,255,255,.07)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#0c0d11'; g.lineWidth = 6; g.strokeRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 2; g.strokeRect(6, 6, 244, 244);
});
export const checker = canvasTex(64, 64, (g) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#ff00ff' : '#000'; g.fillRect(i * 16, j * 16, 16, 16); } });
checker.magFilter = THREE.NearestFilter;
const gridTex = canvasTex(128, 128, (g) => { g.fillStyle = '#04141a'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#35f0c8'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128); g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.stroke(); });

const M = {
  tile: new THREE.MeshStandardMaterial({ map: tileMap, roughness: 0.42, roughnessMap: rough, metalness: 0.5, bumpMap: bump, bumpScale: 0.04 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.85, bumpMap: bump, bumpScale: 0.8 }),
  wallTrim: new THREE.MeshStandardMaterial({ color: 0x1d2029, roughness: 0.5, metalness: 0.6 }),
  arena: new THREE.MeshStandardMaterial({ color: 0x14161d, roughness: 0.3, roughnessMap: rough, metalness: 0.7, bumpMap: bump, bumpScale: 0.04 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x5a5f6b, roughness: 0.9, bumpMap: bump, bumpScale: 1.2 }),
  checker: new THREE.MeshBasicMaterial({ map: checker }),
  grid: new THREE.MeshStandardMaterial({ map: gridTex, emissive: 0x35f0c8, emissiveMap: gridTex, emissiveIntensity: 0.7, roughness: 0.6 }),
  white: new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.9 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.22, metalness: 1 }),
  neon: (c, i = 3) => new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i }),
};
[rough, bump].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });

export function buildWorld(game) {
  const { gfx, physics } = game, scene = gfx.scene;
  const W = { stains: [], tiles: [], closet: new THREE.Group(), pylons: [], pianoSpots: [] };
  const fixedBox = (size, pos, mat, { rotY = 0, parent = scene, cast = true, tag = null } = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh);
    return physics.add({ mesh, type: 'fixed', pos, rotY, shapes: [{ kind: 'box', size }], group: GROUPS.world, friction: 0.8, tag });
  };

  // ================= ACT I: el trastero =================
  scene.add(W.closet);
  for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
    W.tiles.push(fixedBox([2, 0.4, 2], [-6 + i * 2, -0.2, -6 + j * 2], M.tile, { cast: false, parent: W.closet }));
  }
  const wallH = 5.5;
  W.walls = [
    fixedBox([5.6, wallH, 0.4], [-4.2, wallH / 2, -7.2], M.wall, { parent: W.closet }),
    fixedBox([5.6, wallH, 0.4], [4.2, wallH / 2, -7.2], M.wall, { parent: W.closet }),
    fixedBox([2.8, wallH - 3, 0.4], [0, 3 + (wallH - 3) / 2, -7.2], M.wall, { parent: W.closet }),
    fixedBox([0.4, wallH, 14.8], [-7.2, wallH / 2, 0], M.wall, { parent: W.closet }),
    fixedBox([0.4, wallH, 14.8], [7.2, wallH / 2, 0], M.wall, { parent: W.closet }),
  ];
  // invisible front lip so nobody rolls out of the set early
  W.frontLip = physics.add({ type: 'fixed', pos: [0, 1, 7.3], shapes: [{ kind: 'box', size: [15, 3, 0.4] }], group: GROUPS.world });
  // door
  const door = W.door = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3, 0.16), new THREE.MeshStandardMaterial({ color: 0x8a2d2d, roughness: 0.4, metalness: 0.5 }));
  door.position.set(0, 1.5, -7.2); door.castShadow = true; W.closet.add(door);
  W.doorBlock = physics.add({ type: 'fixed', pos: [0, 1.5, -7.2], shapes: [{ kind: 'box', size: [2.8, 3, 0.4] }], group: GROUPS.world });
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.42), new THREE.MeshBasicMaterial({ map: textTex('SALIDA', { w: 512, h: 144, bg: '#03130a', color: '#5dffa0', glow: '#5dffa0', font: '800 100px system-ui' }), toneMapped: false }));
  exit.position.set(0, 3.45, -6.98); W.closet.add(exit);
  W.exitLight = gfx.point(0, { color: 0x5dffa0, intensity: 0, distance: 9, pos: [0, 2.6, -6.2] });
  // trims, sign, poster
  for (const x of [-7, 7]) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 14.4), M.wallTrim); t.position.set(x * 0.995, 0.12, 0); W.closet.add(t); }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshStandardMaterial({ map: textTex('TRASTERO 7', { bg: '#141821', color: '#f2c14e', border: '#f2c14e' }), roughness: 0.4 }));
  sign.position.set(-4.2, 4.2, -6.98); W.closet.add(sign);
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.9), new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(512, 680, (g) => {
    g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 512, 680); g.fillStyle = '#b3261e'; g.fillRect(0, 0, 512, 150);
    g.fillStyle = '#fff'; g.font = '800 64px system-ui'; g.textAlign = 'center'; g.fillText('RECUERDA', 256, 100);
    g.fillStyle = '#1b1b1b'; g.font = '800 54px system-ui'; ['TODO PASA', 'POR ALGO'].forEach((t, i) => g.fillText(t, 256, 260 + i * 70));
    g.font = 'italic 400 38px Georgia'; g.fillText('(por la trama)', 256, 430);
    g.beginPath(); g.arc(256, 550, 60, 0, 7); g.lineWidth = 12; g.strokeStyle = '#1b1b1b'; g.stroke(); g.beginPath(); g.arc(256, 550, 20, 0, 7); g.fill();
  }) }));
  poster.position.set(4.3, 2.4, -6.98); poster.rotation.z = 0.03; W.closet.add(poster);
  // shelves
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x6d7482, roughness: 0.4, metalness: 0.8 });
  for (const [x, rot] of [[-6.6, Math.PI / 2], [6.6, -Math.PI / 2]]) {
    const sh = new THREE.Group();
    for (let l = 0; l < 4; l++) { const b = new THREE.Mesh(new THREE.BoxGeometry(5, 0.07, 0.8), shelfMat); b.position.y = 0.4 + l * 1.05; sh.add(b); }
    for (const sx of [-2.45, 2.45]) for (const sz of [-0.36, 0.36]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 3.9, 0.07), shelfMat); p.position.set(sx, 1.95, sz); sh.add(p); }
    const cols = [0xff7a1a, 0x4fb7ff, 0xf2c14e, 0x7dff9a, 0xff8fc7, 0xeeeeee];
    for (let l = 0; l < 3; l++) for (let k = 0; k < 6; k++) {
      if (Math.random() < 0.25) continue;
      const h = 0.3 + Math.random() * 0.45, r = 0.12 + Math.random() * 0.1;
      const it = new THREE.Mesh(Math.random() < 0.5 ? new THREE.CylinderGeometry(r, r, h, 14) : new THREE.BoxGeometry(r * 2.4, h, r * 2), new THREE.MeshStandardMaterial({ color: cols[(Math.random() * 6) | 0], roughness: 0.45 }));
      it.position.set(-2 + k * 0.8 + Math.random() * 0.2, 0.44 + l * 1.05 + h / 2, (Math.random() - 0.5) * 0.3); sh.add(it);
    }
    sh.position.set(x, 0, -1.5); sh.rotation.y = rot; W.closet.add(shadowed(sh));
    physics.add({ type: 'fixed', pos: [x, 2, -1.5], shapes: [{ kind: 'box', size: [0.9, 4, 5] }], group: GROUPS.world });
  }
  W.props = [
    makeCrate(game, [-4.6, 0, -5.4], 1.2, 'ATREZO'), makeCrate(game, [-3.3, 0, -5.6], 1.0, 'CLICHÉS'), makeCrate(game, [-4.2, 1.2, -5.5], 0.9, 'GIROS|DE GUION'),
    makeCrate(game, [5.2, 0, 4.6], 1.1, 'FRÁGIL|(como tú)'), makeCrate(game, [4.4, 0, -5.5], 1.0, 'MOTIVACIONES'),
    makeCone(game, [2.6, 0, 3.4]), makeCone(game, [-5, 0, 3.6]), makeCone(game, [-5.6, 0, 2.8]),
  ];
  // hanging lamp
  const lamp = W.lamp = new THREE.Group(); lamp.position.set(0, 9, 0);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 3.4, 6), MAT.rubber); cord.position.y = -1.7; lamp.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c2a22, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide })); shade.position.y = -3.5; lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.neon(0xffd9a0, 6)); bulb.position.y = -3.65; lamp.add(bulb);
  W.lampLight = gfx.spot(0, { color: 0xffd2a0, intensity: 60, distance: 30, angle: 0.8, penumbra: 0.7, decay: 1.3, parent: lamp, pos: [0, -3.6, 0], target: [0, -12, 0] });
  const cone = lightCone(6, 4.6, 0xffd2a0, 0.1); cone.position.y = -3.5; lamp.add(cone);
  scene.add(lamp); // not under W.closet: hiding a light's parent changes the light count and recompiles every shader
  // stains
  const stainTex = canvasTex(128, 128, (g) => {
    g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) { g.beginPath(); const a = Math.random() * 7, r = Math.random() * 30; g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 12 + Math.random() * 20, 0, 7); g.fill(); }
  });
  for (const [x, z] of [[-3.5, 1.5], [3.6, -1.2], [0.5, 4.4]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshStandardMaterial({ color: 0x220a2e, emissive: 0xc04dff, emissiveIntensity: 1.6, alphaMap: stainTex, transparent: true, depthWrite: false, roughness: 0.1 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6; m.position.set(x, 0.012, z); m.renderOrder = 1; W.closet.add(m);
    W.stains.push({ mesh: m, x, z, done: false });
  }
  W.shadowBlob = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
  W.shadowBlob.rotation.x = -Math.PI / 2; W.shadowBlob.position.y = 0.02; W.shadowBlob.renderOrder = 2; scene.add(W.shadowBlob);

  // ================= ACT II: la fábrica =================
  const A = ARENA_Y;
  const arena = W.arena = new THREE.Group(); arena.position.y = A; scene.add(arena);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(19, 17.5, 1.4, 72), M.arena); disc.position.y = -0.7; disc.receiveShadow = true; arena.add(disc);
  physics.add({ type: 'fixed', pos: [0, A - 0.7, 0], shapes: [{ kind: 'cyl', size: [19, 0.7] }], group: GROUPS.world, friction: 0.8 });
  W.arenaNeon = [];
  for (const [r, c] of [[18.4, 0xff2a6d], [9, 0x29d3ff], [3, 0xff2a6d]]) {
    const mat = M.neon(c, 2.6), t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 120), mat); t.rotation.x = Math.PI / 2; t.position.y = 0.03; arena.add(t); W.arenaNeon.push(mat);
  }
  W.arenaWall = [];
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, x = Math.sin(a) * 18.6, z = Math.cos(a) * 18.6;
    const e = fixedBox([4.05, 1.8, 0.5], [x, A + 0.9, z], M.wallTrim, { rotY: a });
    e.angle = a; W.arenaWall.push(e);
  }
  W.pillars = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * 9.5, z = Math.cos(a) * 9.5;
    const g = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 8, 28), M.concrete); col.position.y = 4; g.add(col);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.07, 8, 40), M.neon(i % 2 ? 0x29d3ff : 0xff2a6d, 3)); ring.rotation.x = Math.PI / 2; ring.position.y = 1.4; g.add(ring);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.0, 0.5, 28), M.wallTrim); cap.position.y = 8.2; g.add(cap);
    g.position.set(x, A, z); scene.add(shadowed(g));
    physics.add({ type: 'fixed', pos: [x, A + 4, z], shapes: [{ kind: 'cyl', size: [1.1, 4] }], group: GROUPS.world });
    W.pillars.push(V(x, A, z));
    if (!gfx.low || i % 2 === 0) gfx.point(gfx.low ? 1 + i / 2 : 1 + i, { color: i % 2 || (gfx.low && i === 2) ? 0x29d3ff : 0xff2a6d, intensity: gfx.low ? 90 : 60, distance: gfx.low ? 30 : 22, pos: [x * 0.8, A + 3.2, z * 0.8] });
  }
  const bigSign = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.6), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, map: textTex(['FÁBRICA DE GIROS', 'ARGUMENTALES S.L.'], { w: 2048, h: 340, color: '#ff5a8a', glow: '#ff2a6d', font: '800 130px system-ui' }) }));
  bigSign.position.set(0, A + 11, -19.5); scene.add(bigSign);
  for (const x of [-8, 8]) { const c = lightCone(18, 6, 0xff5a8a, 0.1); c.position.set(x, A + 18, -6); scene.add(c); }

  // ================= ACT III: entre bastidores =================
  W.bridge = [];
  const bz0 = -19.5, nT = 21;
  for (let i = 0; i < nT; i++) {
    const kind = i < 2 ? M.arena : [M.grid, M.checker, M.white, M.grid, M.arena, M.checker][i % 6];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 2.02), kind); mesh.receiveShadow = true; mesh.visible = false; scene.add(mesh);
    const z = bz0 - 1 - i * 2;
    mesh.position.set(0, A - 0.25, z);
    W.bridge.push({ mesh, z, t: -1 });
  }
  W.bridgeEnd = bz0 - nT * 2; // -61.5
  const SZ = STAGE_Z;
  const stage = W.stage = new THREE.Group(); stage.position.set(0, A, SZ); stage.visible = false; scene.add(stage);
  const sd = new THREE.Mesh(new THREE.CylinderGeometry(16.6, 15, 1.2, 72), new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 0.45, metalness: 0.5, roughnessMap: rough })); sd.position.y = -0.6; sd.receiveShadow = true; stage.add(sd);
  for (const r of [16.2, 8, 7.6]) { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 120), M.neon(0xf2c14e, 1.6)); t.rotation.x = Math.PI / 2; t.position.y = 0.03; stage.add(t); }
  W.stageBody = null;

  // the Narrator: an eye, because of course it is
  const eye = W.eye = new THREE.Group(); eye.position.set(0, A + 8.5, SZ - 7); eye.visible = false; scene.add(eye);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(2.4, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0xfff6e0, roughness: 0.15, clearcoat: 1, emissive: 0xffe9c0, emissiveIntensity: 0.35 })); eye.add(ball);
  const irisTex = canvasTex(512, 512, (g) => {
    const gr = g.createRadialGradient(256, 256, 40, 256, 256, 250); gr.addColorStop(0, '#fff2b0'); gr.addColorStop(0.35, '#f2a52e'); gr.addColorStop(0.8, '#7a2a05'); gr.addColorStop(1, '#2a0a00');
    g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 250, 0, 7); g.fill();
    for (let i = 0; i < 220; i++) { const a = Math.random() * 7; g.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,240,180' : '60,15,0'},${0.15 + Math.random() * 0.3})`; g.lineWidth = 1 + Math.random() * 2.5; g.beginPath(); g.moveTo(256 + Math.cos(a) * 95, 256 + Math.sin(a) * 95); g.lineTo(256 + Math.cos(a) * 245, 256 + Math.sin(a) * 245); g.stroke(); }
    g.fillStyle = '#000'; g.beginPath(); g.arc(256, 256, 96, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(210, 205, 26, 0, 7); g.fill();
  });
  W.irisMat = new THREE.MeshStandardMaterial({ map: irisTex, emissive: 0xffa040, emissiveMap: irisTex, emissiveIntensity: 1.5, roughness: 0.1 });
  const iris = new THREE.Mesh(new THREE.CircleGeometry(1.25, 48), W.irisMat); iris.position.z = 2.2; eye.add(iris);
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(1.45, 32, 16, 0, Math.PI * 2, 0, 0.9), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0, clearcoat: 1 })); cornea.rotation.x = Math.PI / 2; cornea.position.z = 1.45; eye.add(cornea);
  W.eyeRings = [];
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(3.3 + i * 0.7, 0.07 + i * 0.02, 10, 96), M.gold); r.rotation.set(Math.random() * 3, Math.random() * 3, 0); eye.add(r); W.eyeRings.push(r); }
  W.eyeLight = null; // borrowed from the pool when act III starts
  shadowed(eye); cornea.castShadow = false;
  // floating manuscript pages
  const pageTex = canvasTex(128, 180, (g) => { g.fillStyle = '#f6efdc'; g.fillRect(0, 0, 128, 180); g.fillStyle = '#444'; for (let i = 0; i < 17; i++) g.fillRect(14, 16 + i * 9, 60 + Math.random() * 40, 2.5); });
  const pages = W.pages = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ map: pageTex, side: THREE.DoubleSide, roughness: 0.8, emissive: 0xffffff, emissiveMap: pageTex, emissiveIntensity: 0.25 }), 70);
  pages.userData.seed = Array.from({ length: 70 }, () => [Math.random() * 6.28, 4 + Math.random() * 9, (Math.random() - 0.5) * 9, 0.1 + Math.random() * 0.25, Math.random() * 6]);
  pages.frustumCulled = false; pages.visible = false; scene.add(pages);

  // plot threads: three pylons wired to the eye
  const pyPos = [[-9, 2], [9, 2], [0, 9.5]];
  for (let i = 0; i < 3; i++) {
    const [px, pz] = pyPos[i], wx = px, wz = SZ + pz;
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.5, 24), M.wallTrim); base.position.y = -1.5; g.add(base);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 3, 20), M.gold); g.add(col);
    const glow = M.neon(0xffc24a, 2.2), orb = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), glow); orb.position.y = 1.9; g.add(orb);
    const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), new THREE.MeshBasicMaterial({ map: textTex('HILO DE LA TRAMA', { w: 512, h: 128, color: '#ffe9b0', font: '800 48px system-ui' }), transparent: true, toneMapped: false })); lbl.position.set(0, 3.0, 0); g.add(lbl);
    g.position.set(wx, A + 1.75, wz); g.visible = false; scene.add(shadowed(g)); lbl.castShadow = false;
    const curve = new THREE.CatmullRomCurve3([V(wx, A + 3.7, wz), V(wx * 0.7, A + 9 + i, wz - 2), V(wx * 0.25, A + 6, SZ - 4), V(0, A + 8.5, SZ - 7)]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.06, 8), M.neon(0xffc24a, 1.6)); cable.visible = false; scene.add(cable);
    W.pylons.push({ group: g, cable, glow, pos: V(wx, A, wz), alive: true, ent: null, lbl });
  }

  // backstage clutter floating beside the bridge (no colliders: it is not really there)
  const junk = W.junk = new THREE.Group(); junk.visible = false; scene.add(junk);
  const floatBox = (label, size, pos, color = '#c9a36b') => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ roughness: 0.8, map: canvasTex(512, 256, (g) => {
      g.fillStyle = color; g.fillRect(0, 0, 512, 256); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 242);
      g.fillStyle = '#1a1206'; g.font = '800 44px ui-monospace, monospace'; g.textAlign = 'center'; label.split('|').forEach((l, i, a) => g.fillText(l, 256, 128 + (i - (a.length - 1) / 2) * 54 + 14, 470));
    }) }));
    m.position.set(...pos); m.rotation.set(Math.random() * 0.5, Math.random() * 3, Math.random() * 0.5); m.userData.float = Math.random() * 6; junk.add(m); return m;
  };
  W.pelusaBox = floatBox('PELUSA_v2|_final_FINAL.glb', [1.6, 1.1, 1.6], [5.2, A + 1.2, -34], '#ffb0d6');
  floatBox('PIANOS (x40)', [3.2, 2.4, 3.2], [-7, A + 2, -30]);
  floatBox('TODO: terminar|el nivel', [3, 1.5, 0.2], [6.5, A + 3.2, -47], '#ffe14d');
  floatBox('motivacion_heroe|.txt (vacío)', [2.2, 1.2, 0.2], [-6, A + 3.5, -52], '#e8e8e8');
  floatBox('final_alternativo|(no usar)', [2, 1.4, 2], [-5.5, A + 0.5, -42]);
  // T-pose mannequin
  const tp = new THREE.Group(), wire = new THREE.MeshBasicMaterial({ color: 0x35f0c8, wireframe: true });
  const add = (geo, x, y, z) => { const m = new THREE.Mesh(geo, wire); m.position.set(x, y, z); tp.add(m); };
  add(new THREE.CapsuleGeometry(0.35, 0.9, 3, 8), 0, 1.6, 0); add(new THREE.SphereGeometry(0.3, 8, 6), 0, 2.7, 0);
  add(new THREE.BoxGeometry(2.6, 0.2, 0.2), 0, 2.1, 0); add(new THREE.BoxGeometry(0.22, 1.1, 0.22), -0.2, 0.5, 0); add(new THREE.BoxGeometry(0.22, 1.1, 0.22), 0.2, 0.5, 0);
  tp.position.set(6.2, A + 0.6, -25); tp.rotation.y = -0.6; tp.userData.float = 1; junk.add(tp);
  // wireframe scaffolding rings around the bridge
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(11, 0.03, 4, 6), new THREE.MeshBasicMaterial({ color: 0x35f0c8, transparent: true, opacity: 0.35 })); r.position.set(0, A + 2, -24 - i * 7); r.rotation.z = i * 0.3; r.userData.spin = 0.05 + i * 0.01; junk.add(r); }

  W.M = M;
  return W;
}
