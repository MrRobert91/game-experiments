// "Gran Premio de la Trama": an arcade kart race against El Productor. Auto-throttle, steer with the stick,
// hold the button to drift and let go for a mini-turbo. Three laps; lose and the race is re-shot.
import * as THREE from 'three';
import { canvasTex, textTex, noiseTex } from '../engine/gfx.js';
import { MAT, shadowed, robotStatue } from './robot.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const KART = { x: -260, z: 0 };
const PTS = [[0, -44], [30, -42], [52, -24], [50, 6], [30, 20], [36, 40], [12, 48], [-12, 36], [-28, 44], [-50, 32], [-56, 0], [-46, -26], [-24, -40]];
const HALF = 5.2, N = 480, LAPS = 3;

function kartMesh(color, driver) {
  const g = new THREE.Group(), paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 2.4), paint); body.position.y = 0.38; g.add(body);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.7), paint); nose.position.set(0, 0.42, 1.35); nose.rotation.x = 0.25; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.4), MAT.rubber); wing.position.set(0, 0.95, -1.15); g.add(wing);
  for (const x of [-0.6, 0.6]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), MAT.steel); s.position.set(x, 0.72, -1.15); g.add(s); }
  g.wheels = [];
  for (const [x, z] of [[-0.85, 0.85], [0.85, 0.85], [-0.85, -0.85], [0.85, -0.85]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.32, 16), MAT.rubber); w.rotation.z = Math.PI / 2; w.position.set(x, 0.34, z); g.add(w); g.wheels.push(w); }
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 6, 16), MAT.rubber); sw.position.set(0, 0.85, 0.45); sw.rotation.x = -0.9; g.add(sw);
  g.add(driver); driver.position.set(0, 0.6, -0.15);
  return shadowed(g);
}
function robotDriver() {
  const d = new THREE.Group(), m = robotStatue('idle', 1.2); // the real model, legs tucked into the cockpit
  m.scale.setScalar(0.85); m.position.y = -0.3; d.add(m);
  return d;
}
function producerDriver() {
  const d = new THREE.Group(), suit = new THREE.MeshStandardMaterial({ color: 0x3a1a5a, roughness: 0.6 }), skin = new THREE.MeshStandardMaterial({ color: 0xe8b48a, roughness: 0.7 });
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.4, 6, 14), suit); b.position.y = 0.45; d.add(b);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.05), new THREE.MeshStandardMaterial({ color: 0xf2c14e })); tie.position.set(0, 0.55, 0.42); d.add(tie);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), skin); h.position.y = 1.15; d.add(h);
  const gl = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.08), MAT.glass); gl.position.set(0, 1.2, 0.3); d.add(gl);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 18), MAT.rubber); hat.position.y = 1.62; d.add(hat);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 18), MAT.rubber); brim.position.y = 1.4; d.add(brim);
  const cig = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a })); cig.rotation.x = Math.PI / 2; cig.position.set(0.12, 1.05, 0.42); d.add(cig);
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), new THREE.MeshStandardMaterial({ color: 0, emissive: 0xff5020, emissiveIntensity: 4 })); ember.position.set(0.12, 1.05, 0.58); d.add(ember);
  return d;
}

export function buildKartTrack(game, A) {
  const { gfx } = game, scene = gfx.scene, root = new THREE.Group(); root.position.set(KART.x, A, KART.z); root.visible = false; scene.add(root);
  const curve = new THREE.CatmullRomCurve3(PTS.map(([x, z]) => V(x, 0, z)), true, 'catmullrom', 0.5);
  const pts = curve.getSpacedPoints(N).slice(0, N), tan = pts.map((_, i) => curve.getTangentAt(i / N));
  const len = curve.getLength();
  // ground
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: 0x3f8a4a, roughness: 1, map: noiseTex(256, { contrast: 1.2, base: 170, repeat: [30, 30] }) }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.04; grass.receiveShadow = true; root.add(grass);
  // asphalt ribbon
  const asphalt = canvasTex(256, 512, (g) => {
    g.fillStyle = '#34363d'; g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 3000; i++) { const v = 40 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * 256, Math.random() * 512, 2, 2); }
    g.fillStyle = '#e8e6e0'; g.fillRect(6, 0, 8, 512); g.fillRect(242, 0, 8, 512); g.fillStyle = '#f2c14e'; for (let y = 0; y < 512; y += 128) g.fillRect(124, y, 8, 64);
    for (let y = 0; y < 512; y += 32) { g.fillStyle = (y / 32) % 2 ? '#e0304a' : '#ffffff'; g.fillRect(0, y, 6, 32); g.fillRect(250, y, 6, 32); }
  }, { repeat: [1, 1] });
  asphalt.wrapT = THREE.RepeatWrapping;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const p = pts[i % N], t = tan[i % N], nx = -t.z, nz = t.x;
    pos.push(p.x + nx * HALF, 0.02, p.z + nz * HALF, p.x - nx * HALF, 0.02, p.z - nz * HALF);
    const v = (i / N) * len / 10; uv.push(0, v, 1, v);
    if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  const track = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.7 })); track.receiveShadow = true; root.add(track);
  // start line, arch and decor
  const chk = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 1.4), new THREE.MeshStandardMaterial({ map: canvasTex(128, 32, (g) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 8, y * 8, 8, 8); } }) }));
  chk.rotation.x = -Math.PI / 2; chk.rotation.z = -Math.atan2(tan[0].x, tan[0].z); chk.position.set(pts[0].x, 0.04, pts[0].z); root.add(chk);
  const arch = new THREE.Group(); arch.position.copy(pts[0]); arch.rotation.y = Math.atan2(tan[0].x, tan[0].z);
  for (const x of [-HALF - 0.6, HALF + 0.6]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), MAT.accent); c.position.set(x, 3, 0); arch.add(c); }
  const banner = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 2, 1.4, 0.3), new THREE.MeshBasicMaterial({ map: textTex('GRAN PREMIO DE LA TRAMA', { w: 1024, h: 140, bg: '#14161d', color: '#f2c14e', font: '800 84px system-ui' }), toneMapped: false })); banner.position.y = 6; arch.add(banner);
  root.add(shadowed(arch));
  // tyre stacks on the outside of every bend: one instanced mesh, one draw call
  const tires = new THREE.InstancedMesh(new THREE.TorusGeometry(0.45, 0.22, 8, 16), MAT.rubber, 400), to = new THREE.Object3D(); let tn = 0;
  for (let i = 0; i < N; i += 9) {
    const a = tan[(i + 6) % N], b = tan[i], turn = a.x * b.z - a.z * b.x; if (Math.abs(turn) < 0.02) continue;
    const side = turn > 0 ? -1 : 1, p = pts[i], nx = -b.z * side, nz = b.x * side;
    for (let k = 0; k < 3 && tn < 400; k++) { to.rotation.set(Math.PI / 2, 0, 0); to.position.set(p.x + nx * (HALF + 1.2), 0.25 + k * 0.42, p.z + nz * (HALF + 1.2)); to.updateMatrix(); tires.setMatrixAt(tn++, to.matrix); }
  }
  tires.count = tn; tires.castShadow = true; root.add(tires);
  const ads = ['PATROCINA: LA TRAMA', 'EL PRODUCTOR TE VIGILA', 'CUARENTA PIANOS S.A.', 'SECUELA EN 2027', 'FREGONAS M0P'];
  ads.forEach((t, i) => { const k = ((i + 0.5) / ads.length * N) | 0, p = pts[k], b = tan[k]; const s = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshBasicMaterial({ map: textTex(t, { w: 1024, h: 240, bg: ['#e0304a', '#29d3ff', '#f2c14e', '#7dff9a', '#ff8fc7'][i], color: '#111', font: '800 100px system-ui' }) })); s.position.set(p.x - b.z * (HALF + 7), 2.6, p.z + b.x * (HALF + 7)); s.rotation.y = Math.atan2(b.x, b.z) + Math.PI / 2; root.add(s); const back = s.clone(); back.rotation.y += Math.PI; root.add(back); }); // readable from both sides
  // boost pads
  const padMat = new THREE.MeshStandardMaterial({ color: 0, emissive: 0xffc24a, emissiveIntensity: 2.5, transparent: true, opacity: 0.9, map: canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(8, 40 - i * 22); g.lineTo(32, 18 - i * 22 + 22); g.lineTo(56, 40 - i * 22); g.lineTo(56, 52 - i * 22); g.lineTo(32, 30 - i * 22 + 22); g.lineTo(8, 52 - i * 22); g.fill(); } }) });
  const pads = [70, 190, 330, 420].map((k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), padMat); m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(tan[k].x, tan[k].z) + Math.PI; m.position.set(pts[k].x, 0.05, pts[k].z); root.add(m); return k; });
  const player = kartMesh(0xe0304a, robotDriver()), boss = kartMesh(0x6a2a9a, producerDriver());
  root.add(player, boss);
  const bananaGeo = new THREE.TorusGeometry(0.35, 0.12, 6, 12, Math.PI * 1.3), bananaMat = new THREE.MeshStandardMaterial({ color: 0xffe14d, roughness: 0.5 });
  const sparks = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshStandardMaterial({ color: 0, emissive: 0x6fe3ff, emissiveIntensity: 5 })); sparks.visible = false; player.add(sparks); sparks.position.set(0, 0.25, -1.3);

  const nearest = (x, z, hint) => { let best = hint, bd = Infinity; for (let o = -30; o <= 30; o++) { const i = (hint + o + N) % N, d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } return [best, Math.sqrt(bd)]; };

  return {
    root, player, boss,
    /** run the race until the player wins (re-shooting it after a loss). paint: 0 red, 1 blue */
    async race(paint = 0) {
      const { ui, input, audio, robot } = game, P = game.prog;
      player.children[0].material.color.setHex(paint ? 0x2a6aff : 0xe0304a);
      root.visible = true; robot.frozen = true; robot.parts.forEach((p) => (p.mesh.visible = false)); robot.strings.forEach((s) => (s.visible = false));
      robot.teleport(KART.x + pts[0].x, A + 0.2, KART.z + pts[0].z);
      // a sunny day, just for the race
      const sky = gfx.sky.material.uniforms, saved = { top: sky.uTop.value.clone(), mid: sky.uMid.value.clone(), low: sky.uLow.value.clone(), fog: gfx.scene.fog.color.clone(), fogD: gfx.scene.fog.density, hemi: gfx.hemi.intensity, hc: gfx.hemi.color.clone(), key: gfx.key.intensity };
      sky.uTop.value.set(0x2a6ad8); sky.uMid.value.set(0x7ab4ff); sky.uLow.value.set(0xffd8a8); gfx.scene.fog.color.set(0xa8c8ff); gfx.scene.fog.density = 0.0045;
      gfx.hemi.intensity = 1.25; gfx.hemi.color.set(0xcfe4ff); gfx.key.intensity = 3.2;
      gfx.cam.offK = 7; gfx.cam.stiff = 10; game.focusMix = 1;
      let losses = 0, result = null;
      while (result !== 'win') {
        // ---- set up a run ----
        const K = { i: 0, h: Math.atan2(tan[0].x, tan[0].z), v: 0, lap: 0, half: false, drift: 0, boost: 0, spin: 0, hop: 0, total: 0 };
        const placeAt = (i, side) => { const p = pts[i], t = tan[i]; return V(p.x - t.z * side, 0, p.z + t.x * side); };
        const kp = placeAt(8, 2.2); let kx = kp.x, kz = kp.z; K.i = 8; K.h = Math.atan2(tan[8].x, tan[8].z); // rolling start, just past the line
        const B = { s: 8 / N * len, lap: 0, last: 0, banT: 4, gas: true };
        const bananas = [];
        const kartFocus = V();
        const cam = () => { kartFocus.set(KART.x + kx, A + 0.8, KART.z + kz); game.focus = kartFocus; gfx.cam.offset.set(-Math.sin(K.h) * 8.5, 3.6, -Math.cos(K.h) * 8.5); };
        cam(); gfx.cam.snap = true;
        ui.objective(`Vuelta 1/${LAPS}`);
        // countdown
        for (const n of ['3', '2', '1']) { game.pop(V(KART.x + kx + Math.sin(K.h) * 4, A + 3, KART.z + kz + Math.cos(K.h) * 4), n, '#ffffff', true); audio.beep(false); await game.sleep(0.8); }
        game.pop(V(KART.x + kx + Math.sin(K.h) * 4, A + 3, KART.z + kz + Math.cos(K.h) * 4), '¡YA!', '#7dff9a', true); audio.beep(true); audio.revUp();
        let drifting = false;
        result = await new Promise((done) => {
          const tick = (dt) => {
            if (!dt) return;
            // ---- input ----
            let steer = input.move.x, held = input.held, brake = input.move.y > 0.6;
            if (ui.auto) { const a = pts[(K.i + 18) % N], want = Math.atan2(a.x - kx, a.z - kz); let d = want - K.h; d = Math.atan2(Math.sin(d), Math.cos(d)); steer = Math.max(-1, Math.min(1, -d * 2.2)); held = false; brake = Math.abs(d) > 0.55 && K.v > 18; }
            input.action();
            // ---- player kart ----
            const [i, off] = nearest(kx, kz, K.i); const prev = K.i; K.i = i;
            const onTrack = off < HALF + 0.3;
            K.spin = Math.max(0, K.spin - dt); K.boost = Math.max(0, K.boost - dt);
            const top = K.spin > 0 ? 8 : K.boost > 0 ? 38 : onTrack ? 28 : 16;
            K.v += (top - K.v) * Math.min(1, dt * (K.v < top ? 0.9 : 2.5)); if (brake) K.v = Math.max(0, K.v - 30 * dt);
            if (held && Math.abs(steer) > 0.3 && K.v > 14) { if (!drifting) { drifting = true; K.drift = 0; K.hop = 0.25; audio.jump(); } K.drift += dt; }
            else if (drifting) { drifting = false; if (K.drift > 0.7) { K.boost = K.drift > 1.6 ? 1.5 : 0.9; audio.superDash(); gfx.speed = 1; game.pop(V(KART.x + kx, A + 2.5, KART.z + kz), K.drift > 1.6 ? '¡SUPERTURBO!' : '¡TURBO!', '#6fe3ff'); } }
            const turn = -steer * 2.7 * Math.min(1, Math.max(0.35, K.v / 16)) * (drifting ? 1.4 : 1);
            K.h += turn * dt + (K.spin > 0 ? dt * 12 : 0);
            kx += Math.sin(K.h) * K.v * dt; kz += Math.cos(K.h) * K.v * dt;
            if (off > HALF + 3) { const c = pts[i]; kx += (c.x - kx) * 0.12; kz += (c.z - kz) * 0.12; K.v *= 0.92; if (Math.random() < 0.1) audio.thud(0.4); }
            for (const k of pads) if (Math.abs(i - k) < 3 && off < 2.5 && K.boost < 0.5) { K.boost = 1.2; audio.superDash(); gfx.speed = 1; }
            if (prev > N * 0.8 && i < N * 0.2 && K.half) { K.lap++; K.half = false; if (K.lap < LAPS) { ui.objective(`Vuelta ${K.lap + 1}/${LAPS}`); audio.chime(); if (K.lap === LAPS - 1) ui.bark('narrador', 'Última vuelta. Aquí es donde el Productor saca la cartera.'); } }
            if (i > N * 0.45 && i < N * 0.55) K.half = true;
            K.total = K.lap * N + i + (K.half || i > N * 0.5 ? 0 : 0);
            // ---- El Productor ----
            const pTot = K.lap * len + (i / N) * len, bTot = B.lap * len + B.s;
            let bv = 27 + Math.max(-6, Math.min(7, (pTot - bTot) * 0.08));
            bv *= 1 - losses * 0.07;
            if (losses >= 2 && B.lap === LAPS - 1 && B.s > len * 0.6) { if (B.gas) { B.gas = false; ui.bark('narrador', 'Al Productor se le ha acabado la gasolina. Recortes.'); } bv = 6; }
            B.s += bv * dt; if (B.s >= len) { B.s -= len; B.lap++; }
            const bi = Math.floor(B.s / len * N) % N, bp = pts[bi], bt = tan[bi], lat = Math.sin(game.time * 0.7) * 2;
            const bx = bp.x - bt.z * lat, bz = bp.z + bt.x * lat;
            boss.position.set(bx, 0, bz); boss.rotation.y = Math.atan2(bt.x, bt.z);
            B.banT -= dt;
            if (B.banT <= 0) { B.banT = 5 + Math.random() * 2; const m = new THREE.Mesh(bananaGeo, bananaMat); m.position.set(bx - bt.x * 2, 0.15, bz - bt.z * 2); m.rotation.x = Math.PI / 2; root.add(m); bananas.push(m); if (bananas.length === 1) ui.bark('narrador', 'El Productor tira cáscaras de plátano. Es su forma de dar notas.'); }
            for (let j = bananas.length - 1; j >= 0; j--) { const m = bananas[j]; if (Math.hypot(m.position.x - kx, m.position.z - kz) < 1.3 && K.spin <= 0) { K.spin = 0.9; K.v *= 0.4; audio.hurt(); gfx.shake(0.4); game.pop(V(KART.x + kx, A + 2, KART.z + kz), '¡PLÁTANO!', '#ffe14d'); root.remove(m); bananas.splice(j, 1); } }
            const dbx = kx - bx, dbz = kz - bz, db = Math.hypot(dbx, dbz);
            if (db < 2.1) { kx += dbx / db * (2.1 - db); kz += dbz / db * (2.1 - db); K.v *= 0.9; audio.clank(0.5); gfx.shake(0.15); }
            // ---- visuals ----
            K.hop = Math.max(0, K.hop - dt);
            player.position.set(kx, Math.sin(K.hop / 0.25 * Math.PI) * 0.4, kz); player.rotation.set(0, K.h + (drifting ? -Math.sign(steer) * 0.35 : 0) + (K.spin > 0 ? K.spin * 20 : 0), drifting ? Math.sign(steer) * 0.06 : 0);
            for (const w of player.wheels) w.rotation.x += K.v * dt * 3; for (const w of boss.wheels) w.rotation.x += bv * dt * 3;
            sparks.visible = drifting && K.drift > 0.7; sparks.material.emissive.setHex(K.drift > 1.6 ? 0xff8fc7 : 0x6fe3ff);
            if (K.v > 12 && Math.random() < 0.4) gfx.particles.burst(V(KART.x + kx - Math.sin(K.h) * 1.3, A + 0.3, KART.z + kz - Math.cos(K.h) * 1.3), 1, { color: K.boost > 0 ? 0x6fe3ff : 0x8890a0, speed: 1, life: 0.5, size: K.boost > 0 ? 0.5 : 0.3, gravity: 1, drag: 3 });
            robot.teleport(KART.x + kx, A + 0.2, KART.z + kz); // the real robot rides along (hidden) so checkpoints and focus stay right
            cam();
            const ahead = pTot >= bTot;
            if (Math.floor(game.time * 2) !== Math.floor((game.time - dt) * 2)) ui.objective(`Vuelta ${Math.min(LAPS, K.lap + 1)}/${LAPS} · ${ahead ? '1º' : '2º'}`);
            // ---- finish ----
            if (K.lap >= LAPS) { game.tickers.delete(tick); bananas.forEach((m) => root.remove(m)); done('win'); }
            else if (B.lap >= LAPS) { game.tickers.delete(tick); bananas.forEach((m) => root.remove(m)); done('lose'); }
          };
          game.tickers.add(tick);
        });
        if (result === 'lose') { losses++; P.deaths++; audio.powerdown(); await ui.chapter('2º PUESTO', losses === 1 ? 'El Productor gana. Por la trama, se repite la carrera.' : 'Otra vez segundo. Le he quitado presupuesto al Productor.', 2200); }
      }
      game.addScore(5000); audio.trophy(); ui.achieve('kart', 'Piloto de pruebas', 'Ganar el Gran Premio de la Trama' + (losses ? ' (a la ' + (losses + 1) + 'ª)' : ''));
      if (!losses) ui.achieve('kart1', 'Pole position', 'Ganar la carrera a la primera');
      ui.objective('');
      // restore the night
      sky.uTop.value.copy(saved.top); sky.uMid.value.copy(saved.mid); sky.uLow.value.copy(saved.low); gfx.scene.fog.color.copy(saved.fog); gfx.scene.fog.density = saved.fogD;
      gfx.hemi.intensity = saved.hemi; gfx.hemi.color.copy(saved.hc); gfx.key.intensity = saved.key; gfx.cam.offK = 0; gfx.cam.stiff = 4; game.focus = null;
      return losses;
    },
    finish() { root.visible = false; const r = game.robot; r.parts.forEach((p) => (p.mesh.visible = true)); r.strings.forEach((s) => (s.visible = true)); r.frozen = false; },
  };
}
