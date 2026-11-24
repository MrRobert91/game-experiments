// "Gran Premio de la Trama": an arcade kart race against El Productor on a long circuit with grandstands,
// a crowd, trees, mountains, a pit building, start lights and a balloon. Auto-throttle, steer with the stick,
// hold the button while turning to drift and let go for a mini-turbo. Three laps; lose and it is re-shot.
import * as THREE from 'three';
import { canvasTex, textTex, noiseTex } from '../engine/gfx.js';
import { MAT, shadowed, robotStatue } from './robot.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const KART = { x: -300, z: 0 };
const PTS = [[0, -70], [45, -72], [85, -58], [100, -30], [88, -4], [60, 6], [52, 28], [72, 52], [60, 82], [24, 92], [-6, 74], [-26, 86], [-58, 92], [-90, 70], [-96, 36], [-76, 14], [-92, -12], [-86, -46], [-52, -66]];
const HALF = 5.4, N = 720, LAPS = 3, GRID = 34;

const numberTex = (n) => canvasTex(128, 128, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#111'; g.font = '900 80px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 64, 70); });
function kartMesh(color, number, driver) {
  const g = new THREE.Group(), paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, metalness: 0.1 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.45, metalness: 0.3 });
  // tub: a rounded side profile extruded across the kart
  const sh = new THREE.Shape(); sh.moveTo(-1.25, 0.2); sh.lineTo(1.1, 0.2); sh.quadraticCurveTo(1.55, 0.22, 1.6, 0.42); sh.lineTo(1.2, 0.6); sh.lineTo(0.35, 0.62); sh.quadraticCurveTo(0.1, 0.95, -0.35, 0.95); sh.lineTo(-0.9, 0.9); sh.quadraticCurveTo(-1.3, 0.85, -1.3, 0.5); sh.closePath();
  const tubGeo = new THREE.ExtrudeGeometry(sh, { depth: 1.1, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 10 });
  tubGeo.translate(0, 0, -0.55); tubGeo.rotateY(-Math.PI / 2);
  g.add(new THREE.Mesh(tubGeo, paint)); g.paint = paint;
  for (const s of [-1, 1]) { // side pods with the race number
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 1.1, 6, 12), paint); pod.rotation.x = Math.PI / 2; pod.position.set(s * 0.72, 0.38, -0.05); g.add(pod);
    const num = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshStandardMaterial({ map: numberTex(number), roughness: 0.5 })); num.position.set(s * 0.91, 0.42, -0.05); num.rotation.y = s * Math.PI / 2; g.add(num);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 16), paint); nose.rotation.x = Math.PI / 2; nose.scale.set(1.6, 1, 0.6); nose.position.set(0, 0.36, 1.55); g.add(nose);
  const bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 8), MAT.steel); bumper.rotation.z = Math.PI / 2; bumper.position.set(0, 0.3, 1.85); g.add(bumper);
  const rbump = bumper.clone(); rbump.position.z = -1.45; g.add(rbump);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.12), carbon); seat.position.set(0, 0.85, -0.55); seat.rotation.x = -0.25; g.add(seat);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.5), carbon); engine.position.set(0, 0.62, -1.05); g.add(engine);
  for (const s of [-1, 1]) { const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 10, 1, true), MAT.steel); ex.rotation.x = Math.PI / 2 - 0.3; ex.position.set(s * 0.2, 0.72, -1.4); g.add(ex); }
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.42), paint); wing.position.set(0, 1.18, -1.32); g.add(wing);
  for (const s of [-1, 1]) { const ep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.5), carbon); ep.position.set(s * 0.9, 1.1, -1.32); g.add(ep); const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), MAT.steel); st.position.set(s * 0.35, 0.92, -1.3); g.add(st); }
  const swc = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), MAT.steel); swc.position.set(0, 0.75, 0.32); swc.rotation.x = -0.9; g.add(swc);
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 18), carbon); sw.position.set(0, 0.92, 0.18); sw.rotation.x = -0.6; g.add(sw);
  g.wheels = []; g.steer = [];
  const tire = new THREE.CylinderGeometry(0.36, 0.36, 0.34, 20), rim = new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12), spokeGeo = new THREE.BoxGeometry(0.37, 0.05, 0.4);
  for (const [x, z, front] of [[-0.82, 1.05, 1], [0.82, 1.05, 1], [-0.86, -0.95, 0], [0.86, -0.95, 0]]) {
    const holder = new THREE.Group(); holder.position.set(x, 0.36, z); g.add(holder);
    const w = new THREE.Group(); const t = new THREE.Mesh(tire, MAT.rubber); t.rotation.z = Math.PI / 2; w.add(t);
    const r = new THREE.Mesh(rim, MAT.steel); r.rotation.z = Math.PI / 2; w.add(r); w.add(new THREE.Mesh(spokeGeo, MAT.steel));
    if (!front) w.scale.set(1.15, 1.08, 1.08);
    holder.add(w); g.wheels.push(w); if (front) g.steer.push(holder);
  }
  g.add(driver); driver.position.set(0, 0.62, -0.25);
  return shadowed(g);
}
function robotDriver() {
  const d = new THREE.Group(), m = robotStatue('idle', 1.2); // the real model, legs tucked into the cockpit
  m.scale.setScalar(0.85); m.position.y = -0.3; d.add(m);
  return d;
}
function producerDriver() {
  const d = new THREE.Group(), suit = new THREE.MeshStandardMaterial({ color: 0x3a1a5a, roughness: 0.6 }), skin = new THREE.MeshStandardMaterial({ color: 0xe8b48a, roughness: 0.7 });
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.38, 6, 14), suit); b.position.y = 0.45; d.add(b);
  const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 1, roughness: 0.25 });
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.05), gold); tie.position.set(0, 0.55, 0.4); d.add(tie);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 6, 20, Math.PI), gold); chain.position.set(0, 0.62, 0.3); chain.rotation.set(-0.4, 0, Math.PI); d.add(chain);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 14), skin); h.position.y = 1.12; d.add(h);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.08), MAT.glass); gl.position.set(0, 1.17, 0.3); d.add(gl);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 18), MAT.rubber); hat.position.y = 1.6; d.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 18), MAT.rubber); brim.position.y = 1.37; d.add(brim);
  const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a })); cig.rotation.x = Math.PI / 2; cig.position.set(0.12, 1.02, 0.42); d.add(cig);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff5020, emissiveIntensity: 4 })); ember.position.set(0.12, 1.02, 0.58); d.add(ember);
  return d;
}

export function buildKartTrack(game, A) {
  const { gfx } = game, scene = gfx.scene, root = new THREE.Group(); root.position.set(KART.x, A, KART.z); root.visible = false; scene.add(root);
  const curve = new THREE.CatmullRomCurve3(PTS.map(([x, z]) => V(x, 0, z)), true, 'catmullrom', 0.5);
  const pts = curve.getSpacedPoints(N).slice(0, N), tan = pts.map((_, i) => curve.getTangentAt(i / N)), len = curve.getLength();
  const nearTrack = (x, z, d) => { for (let i = 0; i < N; i += 3) if ((pts[i].x - x) ** 2 + (pts[i].z - z) ** 2 < d * d) return true; return false; };
  const o = new THREE.Object3D(), col = new THREE.Color();
  const inst = (geo, mat, n, cast = true) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = cast; m.receiveShadow = true; m.count = 0; root.add(m); m.n = 0; m.put = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, c = null, rx = 0) => { if (m.n >= n) return -1; o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, 0); o.updateMatrix(); m.setMatrixAt(m.n, o.matrix); if (c != null) m.setColorAt(m.n, col.set(c)); m.count = ++m.n; return m.n - 1; }; return m; };
  const at = (i, side, h = 0) => { const p = pts[(i + N) % N], t = tan[(i + N) % N]; return V(p.x - t.z * side, h, p.z + t.x * side); };
  const yaw = (i) => Math.atan2(tan[(i + N) % N].x, tan[(i + N) % N].z);

  // ---- ground: grass with mown stripes ----
  const grassTex = canvasTex(256, 256, (g) => { g.fillStyle = '#3d7a3c'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#367234'; g.fillRect(0, 0, 128, 256); for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${20 + Math.random() * 40},${90 + Math.random() * 50},${20 + Math.random() * 30},.5)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 3); } }, { repeat: [60, 60] });
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.05; grass.receiveShadow = true; root.add(grass);

  // ---- the road: asphalt with muted kerbs and lines, so nothing glares ----
  const asphalt = canvasTex(256, 512, (g) => {
    g.fillStyle = '#2f3137'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 4000; i++) { const v = 34 + Math.random() * 30; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
    g.fillStyle = '#a9a69e'; g.fillRect(22, 0, 5, 512); g.fillRect(229, 0, 5, 512);
    g.fillStyle = '#b8902e'; for (let y = 0; y < 512; y += 128) g.fillRect(125, y, 6, 64);
    for (let y = 0; y < 512; y += 32) { g.fillStyle = (y / 32) % 2 ? '#a3262f' : '#b9b4aa'; g.fillRect(0, y, 18, 32); g.fillRect(238, y, 18, 32); }
  });
  asphalt.wrapT = THREE.RepeatWrapping;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N], t = tan[i % N], nx = -t.z, nz = t.x, v = (i / N) * len / 10;
    pos.push(p.x + nx * HALF, 0.02, p.z + nz * HALF, p.x - nx * HALF, 0.02, p.z - nz * HALF); uv.push(0, v, 1, v);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  const track = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.85, color: 0xd0d0d0 })); track.receiveShadow = true; root.add(track);
  // gravel run-off strip just outside the road
  const gpos = [], gidx = [];
  for (let i = 0; i <= N; i++) { const p = pts[i % N], t = tan[i % N], nx = -t.z, nz = t.x; for (const s of [1, -1]) gpos.push(p.x + nx * s * HALF, 0.01, p.z + nz * s * HALF, p.x + nx * s * (HALF + 2.6), 0.01, p.z + nz * s * (HALF + 2.6)); if (i < N) { const a = i * 4; gidx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5, a + 2, a + 3, a + 6, a + 3, a + 7, a + 6); } }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3)); gg.setIndex(gidx); gg.computeVertexNormals();
  const gravel = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: 0xa08a60, roughness: 1, side: THREE.DoubleSide })); gravel.receiveShadow = true; root.add(gravel);
  // barriers: red and white blocks all the way round both sides
  const barriers = inst(new THREE.BoxGeometry(1, 0.7, 2.6), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 600);
  for (let i = 0; i < N; i += 3) { const p = pts[i], t = tan[i]; for (const s of [1, -1]) barriers.put(p.x - t.z * s * (HALF + 3.1), 0.35, p.z + t.x * s * (HALF + 3.1), 1, 1, 1, Math.atan2(t.x, t.z), (i / 3) % 2 ? 0xa8242d : 0xcfcbc2); }
  // tyre walls on the outside of the sharpest bends
  const tires = inst(new THREE.TorusGeometry(0.45, 0.22, 8, 16), MAT.rubber, 500);
  for (let i = 0; i < N; i += 4) { const a = tan[(i + 8) % N], b = tan[i], turn = a.x * b.z - a.z * b.x; if (Math.abs(turn) < 0.05) continue; const s = turn > 0 ? -1 : 1, p = pts[i]; for (let k = 0; k < 3; k++) tires.put(p.x - b.z * s * (HALF + 4.3), 0.25 + k * 0.42, p.z + b.x * s * (HALF + 4.3), 1, 1, 1, 0, null, Math.PI / 2); }

  // ---- finish line and arch (well behind the grid, so the chase camera never sits under it); start lights ahead ----
  const chk = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 1.4), new THREE.MeshStandardMaterial({ roughness: 0.8, map: canvasTex(128, 32, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#1a1a1a' : '#c9c6bf'; g.fillRect(x * 8, y * 8, 8, 8); } }) }));
  chk.rotation.x = -Math.PI / 2; chk.rotation.z = -yaw(0); chk.position.set(pts[0].x, 0.04, pts[0].z); root.add(chk);
  const arch = new THREE.Group(); arch.position.copy(pts[0]); arch.rotation.y = yaw(0);
  for (const x of [-HALF - 1.4, HALF + 1.4]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9, 0.7), MAT.accent); c.position.set(x, 4.5, 0); arch.add(c); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 3.5, 1.6, 0.3), new THREE.MeshBasicMaterial({ map: textTex('GRAN PREMIO DE LA TRAMA', { w: 1024, h: 140, bg: '#14161d', color: '#f2c14e', font: '800 84px system-ui' }), toneMapped: false })); banner.position.y = 9; arch.add(banner);
  root.add(shadowed(arch));
  const gantry = new THREE.Group(); gantry.position.copy(at(GRID + 18, 0)); gantry.rotation.y = yaw(GRID + 18);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 2, 0.7, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.5 })); beam.position.y = 6.2; gantry.add(beam);
  for (const x of [-HALF - 1, HALF + 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.35, 6.5, 0.35), MAT.steel); c.position.set(x, 3.2, 0); gantry.add(c); }
  const lights = [-2.4, -1.2, 0, 1.2, 2.4].map((x) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1a0000, emissive: 0x000000, emissiveIntensity: 4 })); m.position.set(x, 6.2, -0.3); gantry.add(m); return m; });
  root.add(shadowed(gantry));

  // ---- grandstands with a cheering crowd ----
  const standMat = new THREE.MeshStandardMaterial({ color: 0x8a8f9c, roughness: 0.7 }), roofMat = new THREE.MeshStandardMaterial({ color: 0xb0263a, roughness: 0.5 });
  const crowd = inst(new THREE.CapsuleGeometry(0.22, 0.35, 3, 6), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 1100, false);
  const people = [], pal = [0xe0304a, 0x29d3ff, 0xf2c14e, 0x7dff9a, 0xff8fc7, 0xffffff, 0xb06aff, 0xff7a1a];
  for (const [from, to, side] of [[GRID - 26, GRID + 62, 1], [GRID - 6, GRID + 46, -1], [300, 360, 1], [470, 530, -1]]) {
    const mid = ((from + to) / 2 + N) % N, L = (to - from) * len / N * 0.95, g = new THREE.Group();
    g.position.copy(at(mid, side * (HALF + 12))); g.rotation.y = yaw(mid) + (side > 0 ? Math.PI / 2 : -Math.PI / 2); root.add(g);
    for (let tier = 0; tier < 6; tier++) { const s = new THREE.Mesh(new THREE.BoxGeometry(L, 0.8, 6 - tier * 0.9), standMat); s.position.set(0, 0.4 + tier * 0.8, -tier * 0.45); g.add(s); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L + 1, 0.25, 7), roofMat); roof.position.set(0, 8.2, -0.6); roof.rotation.x = -0.1; g.add(roof);
    for (let k = -L / 2 + 2; k < L / 2; k += 8) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 8), MAT.steel); post.position.set(k, 4, -3.4); g.add(post); }
    shadowed(g); g.updateMatrixWorld(true); root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    for (let tier = 0; tier < 6; tier++) for (let k = -L / 2 + 0.6; k < L / 2; k += 0.75) {
      if (Math.random() < 0.12) continue;
      const wp = V(k, 1.25 + tier * 0.8, 2.6 - tier * 0.9).applyMatrix4(g.matrixWorld).applyMatrix4(inv);
      const id = crowd.put(wp.x, wp.y, wp.z, 1, 1, 1, 0, pal[(Math.random() * pal.length) | 0]); if (id >= 0) people.push({ id, x: wp.x, y: wp.y, z: wp.z, ph: Math.random() * 6, sp: 5 + Math.random() * 5 });
    }
  }
  // ---- pit building, ads, flags ----
  const pit = new THREE.Group(); pit.position.copy(at(GRID + 24, -(HALF + 11))); pit.rotation.y = yaw(GRID + 24) - Math.PI / 2;
  const pitBody = new THREE.Mesh(new THREE.BoxGeometry(40, 5, 8), new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.7 })); pitBody.position.y = 2.5; pit.add(pitBody);
  const doors = new THREE.Mesh(new THREE.PlaneGeometry(38, 3.4), new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTex(1024, 96, (g) => { g.fillStyle = '#2a2d35'; g.fillRect(0, 0, 1024, 96); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#3a3f4a' : '#343944'; g.fillRect(i * 128 + 6, 6, 116, 90); g.fillStyle = '#f2c14e'; g.font = '700 30px system-ui'; g.fillText('BOX ' + (i + 1), i * 128 + 30, 50); } }) }));
  doors.position.set(0, 1.8, 4.01); pit.add(doors);
  const pitSign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2), new THREE.MeshBasicMaterial({ map: textTex('BOXES · PRODUCCIONES TRAMA', { w: 1024, h: 150, bg: '#14161d', color: '#e8e6e0', font: '800 76px system-ui' }), toneMapped: false })); pitSign.position.set(0, 6.1, 4.02); pit.add(pitSign);
  root.add(shadowed(pit));
  const ads = ['PATROCINA: LA TRAMA', 'EL PRODUCTOR TE VIGILA', 'CUARENTA PIANOS S.A.', 'SECUELA EN 2027', 'FREGONAS M0P', 'CAFÉ DEL GUIONISTA', 'NO HAY ATAJOS', 'PELUSA FAN CLUB'];
  ads.forEach((t, i) => { const k = ((i + 0.3) / ads.length * N) | 0, side = i % 2 ? 1 : -1, p = at(k, side * (HALF + 6.6), 1.6); const s = new THREE.Mesh(new THREE.PlaneGeometry(9, 2), new THREE.MeshStandardMaterial({ roughness: 0.6, map: textTex(t, { w: 1024, h: 220, bg: ['#a8242d', '#1f7fb0', '#b88a26', '#2f8f50', '#a84a80', '#5a3a1a', '#3a3f4a', '#b05418'][i], color: '#f4f2ec', font: '800 92px system-ui' }) })); s.position.copy(p); s.rotation.y = yaw(k) + (side > 0 ? Math.PI / 2 : -Math.PI / 2); root.add(s); const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 2), MAT.rubber); back.position.copy(p); back.rotation.y = s.rotation.y + Math.PI; root.add(back); });
  const flagPoles = inst(new THREE.CylinderGeometry(0.06, 0.06, 7, 6), MAT.steel, 40), flags = inst(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 }), 40, false);
  for (let i = 0; i < 40; i++) { const k = GRID - 24 + i * 3, side = i % 2 ? 1 : -1, p = at(k, side * (HALF + 5.2)); flagPoles.put(p.x, 3.5, p.z); flags.put(p.x, 6.4, p.z, 1, 1, 1, yaw(k), pal[i % pal.length]); }

  // ---- nature: trees, mountains, clouds, a balloon ----
  const foliage = inst(new THREE.ConeGeometry(1.6, 4.2, 9), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), 420);
  const trunks = inst(new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 }), 420);
  for (let n = 0; n < 2500 && foliage.n < 420; n++) {
    const x = (Math.random() - 0.5) * 330, z = (Math.random() - 0.5) * 310; if (nearTrack(x, z, HALF + 15)) continue;
    const s = 0.7 + Math.random() * 0.9; trunks.put(x, 0.8 * s, z, s, s, s); foliage.put(x, 3.7 * s, z, s, s * (0.9 + Math.random() * 0.4), s, Math.random() * 6, [0x2f6a35, 0x3d7d3a, 0x26592e, 0x4a8a40][(Math.random() * 4) | 0]);
  }
  const mountains = inst(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: 0x5a7286, roughness: 1, flatShading: true }), 24, false);
  const snow = inst(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.9, flatShading: true }), 24, false);
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2 + Math.random() * 0.2, r = 240 + Math.random() * 60, h = 50 + Math.random() * 60, w = 40 + Math.random() * 30; mountains.put(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r, w, h, w, Math.random() * 3); snow.put(Math.cos(a) * r, h * 0.86 - 2, Math.sin(a) * r, w * 0.3, h * 0.3, w * 0.3); }
  const clouds = inst(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xbcd4ff, emissiveIntensity: 0.25 }), 60, false);
  for (let c = 0; c < 14; c++) { const x = (Math.random() - 0.5) * 420, y = 60 + Math.random() * 40, z = (Math.random() - 0.5) * 420; for (let k = 0; k < 4; k++) clouds.put(x + k * 7 - 10, y + Math.random() * 3, z + Math.random() * 6, 9 + Math.random() * 5, 4 + Math.random() * 2, 7); }
  const balloon = new THREE.Group(); balloon.position.set(20, 38, 10);
  const env = new THREE.Mesh(new THREE.SphereGeometry(6, 24, 18), new THREE.MeshStandardMaterial({ roughness: 0.6, map: canvasTex(512, 256, (g) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#5a2a8a' : '#d8a83e'; g.fillRect(i * 32, 0, 32, 256); } g.fillStyle = '#fff'; g.font = '900 40px system-ui'; g.textAlign = 'center'; g.fillText('EL PRODUCTOR', 256, 140); }) })); env.scale.y = 1.2; balloon.add(env);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 2), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 })); basket.position.y = -9; balloon.add(basket);
  root.add(shadowed(balloon));
  // boost pads
  const padMat = new THREE.MeshStandardMaterial({ color: 0x221a00, emissive: 0xffb020, emissiveIntensity: 1.1, transparent: true, opacity: 0.9, map: canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(8, 40 - i * 22); g.lineTo(32, 18 - i * 22 + 22); g.lineTo(56, 40 - i * 22); g.lineTo(56, 52 - i * 22); g.lineTo(32, 30 - i * 22 + 22); g.lineTo(8, 52 - i * 22); g.fill(); } }) });
  const pads = [120, 250, 400, 560, 660].map((k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), padMat); m.rotation.x = -Math.PI / 2; m.rotation.z = -yaw(k) + Math.PI; m.position.set(pts[k].x, 0.05, pts[k].z); root.add(m); return k; });

  const player = kartMesh(0xc8283a, '7', robotDriver()), boss = kartMesh(0x5a2a8a, '1', producerDriver());
  root.add(player, boss);
  const bananaGeo = new THREE.TorusGeometry(0.35, 0.12, 6, 12, Math.PI * 1.3), bananaMat = new THREE.MeshStandardMaterial({ color: 0xe8c838, roughness: 0.5 });
  const sparkMat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0x6fe3ff, emissiveIntensity: 5 });
  const sparks = [-0.6, 0.6].map((x) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), sparkMat); s.position.set(x, 0.2, -1.2); s.visible = false; player.add(s); return s; });
  const nearest = (x, z, hint) => { let best = hint, bd = Infinity; for (let k = -40; k <= 40; k++) { const i = (hint + k + N) % N, d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } return [best, Math.sqrt(bd)]; };
  const cheer = () => { for (const p of people) p.boost = 1.5; };

  return {
    root, player, boss,
    /** run the race until the player wins (re-shooting it after a loss). paint: 0 red, 1 blue */
    async race(paint = 0) {
      const { ui, input, audio, robot } = game, P = game.prog;
      player.paint.color.setHex(paint ? 0x2458d8 : 0xc8283a);
      root.visible = true; robot.frozen = true; robot.parts.forEach((p) => (p.mesh.visible = false)); robot.strings.forEach((s) => (s.visible = false));
      // a clear sunny day, without the glare
      const sky = gfx.sky.material.uniforms, saved = { top: sky.uTop.value.clone(), mid: sky.uMid.value.clone(), low: sky.uLow.value.clone(), fog: gfx.scene.fog.color.clone(), fogD: gfx.scene.fog.density, hemi: gfx.hemi.intensity, hc: gfx.hemi.color.clone(), key: gfx.key.intensity, bloom: gfx.bloom.strength };
      sky.uTop.value.set(0x1f5fc8); sky.uMid.value.set(0x6fa8f0); sky.uLow.value.set(0xc8dcf0); gfx.scene.fog.color.set(0x9dbde0); gfx.scene.fog.density = 0.0022;
      gfx.hemi.intensity = 0.85; gfx.hemi.color.set(0xcfe4ff); gfx.key.intensity = 2.3; gfx.bloom.strength = 0.18;
      const cam = gfx.cam; cam.offK = 8; cam.stiff = 11; cam.noPull = true; cam.fov = 54; game.focusMix = 1;
      const crowdTick = (dt) => { // the crowd bounces, harder right after something happens
        for (let k = 0; k < people.length; k++) { const p = people[k]; p.boost = Math.max(0, (p.boost || 0) - dt); o.position.set(p.x, p.y + Math.max(0, Math.sin(game.time * p.sp + p.ph)) * (0.12 + p.boost * 0.3), p.z); o.scale.set(1, 1, 1); o.rotation.set(0, 0, 0); o.updateMatrix(); crowd.setMatrixAt(p.id, o.matrix); }
        crowd.instanceMatrix.needsUpdate = true; balloon.position.y = 38 + Math.sin(game.time * 0.3) * 2; balloon.rotation.y += dt * 0.05;
      };
      game.tickers.add(crowdTick);
      let losses = 0, result = null;
      while (result !== 'win') {
        // ---- grid: you on the right, the Producer a few metres ahead on the left: both in view ----
        const K = { i: GRID, h: yaw(GRID), v: 0, lap: 0, half: false, drift: 0, boost: 0, spin: 0, spinA: 0, hop: 0 };
        let { x: kx, z: kz } = at(GRID, -1.4);
        const B = { s: (GRID + 12) / N * len, lap: 0, banT: 5, gas: true, half: false, prevI: GRID + 12 };
        const bananas = [], focus = V();
        const camUpdate = () => { const fx = Math.sin(K.h), fz = Math.cos(K.h), tall = gfx.camera.aspect < 1, d = tall ? 10.5 : 8.2; focus.set(KART.x + kx + fx * (tall ? 5 : 2.5), A + 0.9, KART.z + kz + fz * (tall ? 5 : 2.5)); game.focus = focus; cam.offset.set(-fx * d, tall ? 4.6 : 3.3, -fz * d); cam.fov = tall ? 64 : 54; }; // portrait: higher, wider, looking further ahead
        robot.teleport(KART.x + kx, A + 0.2, KART.z + kz);
        player.position.set(kx, 0, kz); player.rotation.set(0, K.h, 0);
        { const bp = at(GRID + 12, 1.2); boss.position.set(bp.x, 0, bp.z); boss.rotation.y = yaw(GRID + 12); }
        camUpdate(); cam.snap = true;
        ui.objective(`Vuelta 1/${LAPS}`);
        // start lights: red, red, red… green
        lights.forEach((l) => l.material.emissive.setHex(0));
        for (const pair of [[0, 4], [1, 3], [2]]) { await game.sleep(0.75); pair.forEach((n) => lights[n].material.emissive.setHex(0xff2020)); audio.beep(false); }
        await game.sleep(0.8);
        lights.forEach((l) => l.material.emissive.setHex(0x30ff60)); audio.beep(true); audio.revUp(); cheer();
        game.pop(V(KART.x + kx + Math.sin(K.h) * 6, A + 3, KART.z + kz + Math.cos(K.h) * 6), '¡YA!', '#7dff9a', true);
        let drifting = false;
        result = await new Promise((done) => {
          const tick = (dt) => {
            if (!dt) return;
            let steer = input.move.x, held = input.held, brake = input.move.y > 0.6;
            if (ui.auto) { const a = pts[(K.i + 22) % N], want = Math.atan2(a.x - kx, a.z - kz); let d = want - K.h; d = Math.atan2(Math.sin(d), Math.cos(d)); steer = Math.max(-1, Math.min(1, -d * 2.2)); held = false; brake = Math.abs(d) > 0.55 && K.v > 18; }
            input.action();
            const [i, off] = nearest(kx, kz, K.i), prev = K.i; K.i = i;
            const onTrack = off < HALF + 0.3;
            K.spin = Math.max(0, K.spin - dt); K.boost = Math.max(0, K.boost - dt);
            // a banana spins the kart round once on the spot: the direction of travel and the camera never change
            K.spinA = K.spin > 0 ? (1 - K.spin / 0.9) * Math.PI * 2 : 0;
            const top = K.spin > 0 ? 9 : K.boost > 0 ? 38 : onTrack ? 28 : 15;
            K.v += (top - K.v) * Math.min(1, dt * (K.v < top ? 0.9 : 2.5)); if (brake) K.v = Math.max(0, K.v - 30 * dt);
            if (held && Math.abs(steer) > 0.3 && K.v > 14 && K.spin <= 0) { if (!drifting) { drifting = true; K.drift = 0; K.hop = 0.25; audio.jump(); } K.drift += dt; }
            else if (drifting) { drifting = false; if (K.drift > 0.7) { K.boost = K.drift > 1.6 ? 1.5 : 0.9; audio.superDash(); gfx.speed = 0.55; game.pop(V(KART.x + kx, A + 2.5, KART.z + kz), K.drift > 1.6 ? '¡SUPERTURBO!' : '¡TURBO!', '#6fe3ff'); } }
            const turn = K.spin > 0 ? 0 : -steer * 2.7 * Math.min(1, Math.max(0.35, K.v / 16)) * (drifting ? 1.4 : 1);
            K.h += turn * dt;
            kx += Math.sin(K.h) * K.v * dt; kz += Math.cos(K.h) * K.v * dt;
            if (off > HALF + 2.6) { const c = pts[i], k = (off - HALF - 2.6) / off; kx += (c.x - kx) * k; kz += (c.z - kz) * k; K.v *= 0.9; if (Math.random() < 0.15) { audio.thud(0.4); gfx.shake(0.1); } }
            for (const k of pads) if (Math.abs(i - k) < 3 && off < 2.5 && K.boost < 0.5) { K.boost = 1.2; audio.superDash(); gfx.speed = 0.55; }
            if (prev > N * 0.8 && i < N * 0.2 && K.half) { K.lap++; K.half = false; cheer(); if (K.lap < LAPS) { audio.chime(); if (K.lap === LAPS - 1) ui.bark('narrador', 'Última vuelta. Aquí es donde el Productor saca la cartera.'); } }
            if (i > N * 0.45 && i < N * 0.55) K.half = true;
            // ---- El Productor ----
            const bi = Math.floor(B.s / len * N) % N;
            const pTot = K.lap * N + ((i - GRID + N) % N), bTot = B.lap * N + ((bi - GRID + N) % N);
            let bv = 27 + Math.max(-6, Math.min(7, (pTot - bTot) * len / N * 0.06));
            bv *= 1 - losses * 0.07;
            if (losses >= 2 && B.lap === LAPS - 1 && bi > N * 0.6) { if (B.gas) { B.gas = false; ui.bark('narrador', 'Al Productor se le ha acabado la gasolina. Recortes.'); } bv = 6; }
            B.s = (B.s + bv * dt) % len;
            const nbi = Math.floor(B.s / len * N) % N;
            if (B.prevI > N * 0.8 && nbi < N * 0.2 && B.half) { B.lap++; B.half = false; } if (nbi > N * 0.45 && nbi < N * 0.55) B.half = true; B.prevI = nbi;
            const bp = pts[nbi], bt = tan[nbi], lat = 2.3 * Math.sin(game.time * 0.5);
            const bx = bp.x - bt.z * lat, bz = bp.z + bt.x * lat;
            boss.position.set(bx, 0, bz); boss.rotation.y = Math.atan2(bt.x, bt.z);
            B.banT -= dt;
            if (B.banT <= 0) { B.banT = 5 + Math.random() * 2; const m = new THREE.Mesh(bananaGeo, bananaMat); m.position.set(bx - bt.x * 2, 0.15, bz - bt.z * 2); m.rotation.x = Math.PI / 2; m.castShadow = true; root.add(m); bananas.push(m); if (bananas.length === 1) ui.bark('narrador', 'El Productor tira cáscaras de plátano. Es su forma de dar notas.'); }
            for (let j = bananas.length - 1; j >= 0; j--) { const m = bananas[j]; if (Math.hypot(m.position.x - kx, m.position.z - kz) < 1.3 && K.spin <= 0) { K.spin = 0.9; K.v *= 0.45; drifting = false; audio.hurt(); gfx.shake(0.35); game.pop(V(KART.x + kx, A + 2, KART.z + kz), '¡PLÁTANO!', '#ffe14d'); root.remove(m); bananas.splice(j, 1); } }
            const dbx = kx - bx, dbz = kz - bz, db = Math.hypot(dbx, dbz);
            if (db < 2.2) { kx += dbx / db * (2.2 - db); kz += dbz / db * (2.2 - db); K.v *= 0.92; audio.clank(0.5); gfx.shake(0.15); }
            // ---- visuals ----
            K.hop = Math.max(0, K.hop - dt);
            player.position.set(kx, Math.sin(K.hop / 0.25 * Math.PI) * 0.4, kz);
            player.rotation.set(0, K.h + K.spinA + (drifting ? -Math.sign(steer) * 0.35 : 0), drifting ? Math.sign(steer) * 0.06 : 0);
            for (const h of player.steer) h.rotation.y = -steer * 0.4;
            for (const w of player.wheels) w.rotation.x += K.v * dt * 3; for (const w of boss.wheels) w.rotation.x += bv * dt * 3;
            sparks.forEach((s) => { s.visible = drifting && K.drift > 0.7; s.scale.setScalar(0.7 + Math.random() * 0.6); }); sparkMat.emissive.setHex(K.drift > 1.6 ? 0xff8fc7 : 0x6fe3ff);
            if (K.v > 12 && Math.random() < 0.5) gfx.particles.burst(V(KART.x + kx - Math.sin(K.h) * 1.5, A + 0.3, KART.z + kz - Math.cos(K.h) * 1.5), 1, { color: K.boost > 0 ? 0x6fe3ff : onTrack ? 0x8890a0 : 0x9a8a5a, speed: 1, life: 0.5, size: K.boost > 0 ? 0.5 : 0.3, gravity: 1, drag: 3 });
            robot.teleport(KART.x + kx, A + 0.2, KART.z + kz); // the hidden robot rides along so checkpoints and focus stay right
            camUpdate();
            const ahead = pTot >= bTot;
            if (Math.floor(game.time * 2) !== Math.floor((game.time - dt) * 2)) ui.objective(`Vuelta ${Math.min(LAPS, K.lap + 1)}/${LAPS} · ${ahead ? '1º' : '2º'}`);
            if (K.lap >= LAPS) { game.tickers.delete(tick); bananas.forEach((m) => root.remove(m)); cheer(); done('win'); }
            else if (B.lap >= LAPS) { game.tickers.delete(tick); bananas.forEach((m) => root.remove(m)); done('lose'); }
          };
          game.tickers.add(tick);
        });
        if (result === 'lose') { losses++; P.deaths++; audio.powerdown(); await ui.chapter('2º PUESTO', losses === 1 ? 'El Productor gana. Por la trama, se repite la carrera.' : 'Otra vez segundo. Le he quitado presupuesto al Productor.', 2200); }
      }
      game.tickers.delete(crowdTick);
      game.addScore(5000); audio.trophy(); ui.achieve('kart', 'Piloto de pruebas', 'Ganar el Gran Premio de la Trama' + (losses ? ' (a la ' + (losses + 1) + 'ª)' : ''));
      if (!losses) ui.achieve('kart1', 'Pole position', 'Ganar la carrera a la primera');
      ui.objective('');
      sky.uTop.value.copy(saved.top); sky.uMid.value.copy(saved.mid); sky.uLow.value.copy(saved.low); gfx.scene.fog.color.copy(saved.fog); gfx.scene.fog.density = saved.fogD;
      gfx.hemi.intensity = saved.hemi; gfx.hemi.color.copy(saved.hc); gfx.key.intensity = saved.key; gfx.bloom.strength = saved.bloom;
      cam.offK = 0; cam.stiff = 4; cam.noPull = false; cam.fov = 42; game.focus = null;
      return losses;
    },
    finish() { root.visible = false; const r = game.robot; r.parts.forEach((p) => (p.mesh.visible = true)); r.strings.forEach((s) => (s.visible = true)); r.frozen = false; },
  };
}
