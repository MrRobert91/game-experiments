// El Crítico: a 2D fighting game with physics. Both fighters are verlet ragdolls (points + sticks) that a few
// springs try to keep standing; hits throw real impulses, heavy hits knock them limp. Crates fly about too.
// Stick: walk (push up to jump). Button: tap to punch, hold and release for a heavy blow.

const STICKS = [[0, 1, 9], [1, 2, 11], [1, 3, 10], [1, 4, 10], [2, 5, 12], [2, 6, 12], [0, 2, 20], [5, 6, 9]];
const QUIPS_HIT = ['★☆☆☆☆', '¡PREDECIBLE!', '¡SIN ALMA!', '¡DERIVATIVO!', '¡MUY VISTO!'];
const QUIPS_HURT = ['¡AUCH!', '¡ESO NO SALÍA EN EL GUION!', '¡MI MONÓCULO!', '¡UNA ESTRELLA MENOS!'];

class Fighter {
  constructor(x, floor, face, colors) {
    this.p = []; this.q = [];
    const rel = [[0, -38], [0, -29], [0, -18], [-6, -24], [6, -24], [-5, -6], [5, -6]];
    for (const [dx, dy] of rel) { this.p.push([x + dx, floor + dy]); this.q.push([x + dx, floor + dy]); }
    Object.assign(this, { face, colors, hp: 100, max: 100, ko: 0, punch: 0, heavy: false, cd: 0, hitDone: false, block: 0, grounded: false, walk: 0, charge: 0 });
  }
  vel(i) { return [this.p[i][0] - this.q[i][0], this.p[i][1] - this.q[i][1]]; }
  push(vx, vy) { for (let i = 0; i < 7; i++) { this.q[i][0] -= vx; this.q[i][1] -= vy; } }
  get x() { return this.p[2][0]; }
}

export async function fightCritic(mini, { assist = 0 } = {}) {
  const game = mini.game, { ui, input, audio } = game;
  mini.open(); audio.mood('tense');
  const W = mini.W, H = mini.H, floor = () => H - mini.pad - 14, G = 640;
  let me, foe, crates, stars, t, over, overT, firstHit;
  const reset = () => {
    me = new Fighter(W * 0.28, floor(), 1, { body: '#e8e6e0', limb: '#b9b7b2', accent: '#ff7a1a', eye: '#6fe3ff' });
    foe = new Fighter(W * 0.72, floor(), -1, { body: '#2a2340', limb: '#4a3a6a', accent: '#f2c14e', eye: '#ff4d6a' });
    foe.max = foe.hp = Math.round(100 * (1 - assist * 0.25));
    crates = [[W * 0.5 - 6, floor() - 12], [W * 0.5 + 6, floor() - 30]].map(([x, y]) => { const pts = [[x, y], [x + 11, y], [x + 11, y + 11], [x, y + 11]]; return { p: pts.map((a) => [...a]), q: pts.map((a) => [...a]) }; });
    stars = []; t = 0; over = null; overT = 0; firstHit = false;
  };
  reset();
  ui.objective('Derrota a El Crítico'); ui.bark('narrador', 'El Crítico. Ha venido a ponerle nota al juego. Pelea, que eso puntúa.');
  ui.bark('sistema', 'Toca: puñetazo. Mantén y suelta: fregonazo. Arriba: saltar.');
  let heldT = 0, wasHeld = false, jumpLatch = false, botT = 0;

  const attack = (f, heavy) => { if (f.cd > 0 || f.ko > 0) return; f.punch = heavy ? 0.32 : 0.2; f.heavy = heavy; f.cd = heavy ? 0.75 : 0.32; f.hitDone = false; audio.dash(); };
  const hitCheck = (a, b) => {
    if (a.punch <= 0 || a.hitDone) return;
    const hand = a.p[a.face > 0 ? 4 : 3];
    for (const k of [0, 1, 2]) {
      const dx = b.p[k][0] - hand[0], dy = b.p[k][1] - hand[1];
      if (dx * dx + dy * dy < (a.heavy ? 110 : 64)) {
        a.hitDone = true;
        let dmg = a.heavy ? 16 : 6; const blocked = b.block > 0 && b.ko <= 0 && Math.sign(a.x - b.x) === b.face;
        if (blocked) { dmg = Math.round(dmg * 0.3); mini.text(b.x, b.p[0][1] - 12, '¡BLOQUEO!', '#9fefff'); }
        b.hp = Math.max(0, b.hp - dmg);
        const kb = (a.heavy ? 5.5 : 2.2) * (blocked ? 0.4 : 1);
        b.push(a.face * kb, a.heavy ? -3.5 : -1.2);
        if (a.heavy && !blocked) { b.ko = 0.9; mini.shake = 1.2; audio.thud(1.4); game.hitstop(0.12); } else { mini.shake = 0.5; audio.clank(0.8); game.hitstop(0.05); }
        game.buzz(a.heavy ? 70 : 25);
        if (b === foe) { mini.text(b.x, b.p[0][1] - 16, QUIPS_HURT[(Math.random() * QUIPS_HURT.length) | 0], '#ffd24a'); if (!firstHit) { firstHit = true; ui.bark('robot', 'Toma crítica constructiva.'); } }
        else mini.text(b.x, b.p[0][1] - 16, QUIPS_HIT[(Math.random() * QUIPS_HIT.length) | 0], '#ff6a8a');
        return;
      }
    }
  };
  const control = (f, mx, jump, dt) => {
    f.cd -= dt; f.punch -= dt; f.block -= dt;
    if (f.ko > 0) { f.ko -= dt; return; }
    const hip = f.p[2], fl = floor();
    f.grounded = f.p[5][1] >= fl - 1 || f.p[6][1] >= fl - 1;
    // walk by moving the hip; a spring keeps head and chest above it (the "active ragdoll")
    if (Math.abs(mx) > 0.15) { const s = mx * 70 * dt; for (const i of [0, 1, 2]) f.p[i][0] += s; f.walk += dt * 10 * Math.abs(mx); }
    const up = (i, tx, ty, k) => { f.p[i][0] += (tx - f.p[i][0]) * k; f.p[i][1] += (ty - f.p[i][1]) * k; };
    const stand = f.grounded ? 0.35 : 0.08;
    up(2, hip[0], Math.min(hip[1], fl - 17), stand * 0.6);
    up(1, hip[0], hip[1] - 11, 0.45); up(0, hip[0] + f.face * 1, hip[1] - 20, 0.45);
    const step = Math.sin(f.walk) * (Math.abs(mx) > 0.15 ? 4 : 0);
    up(5, hip[0] - 5 + step, fl, f.grounded ? 0.2 : 0.05); up(6, hip[0] + 5 - step, fl, f.grounded ? 0.2 : 0.05);
    // fists: guard position, or a punch towards the other fighter
    const front = f.face > 0 ? 4 : 3, back = f.face > 0 ? 3 : 4, ch = f.p[1];
    if (f.punch > 0) { const reach = f.heavy ? 22 : 17, k = f.punch > (f.heavy ? 0.18 : 0.1) ? 0.6 : 0.3; up(front, ch[0] + f.face * reach, ch[1] - 1, k); }
    else up(front, ch[0] + f.face * 8, ch[1] - 4, 0.3);
    up(back, ch[0] + f.face * 3 - f.face * (f.charge * 8), ch[1] - 2, 0.25);
    if (jump && f.grounded) { f.push(0, -6.5); audio.jump(); }
  };
  const physics = (f, dt) => {
    const fl = floor();
    for (let i = 0; i < f.p.length; i++) {
      const p = f.p[i], q = f.q[i], vx = (p[0] - q[0]) * 0.985, vy = (p[1] - q[1]) * 0.985;
      q[0] = p[0]; q[1] = p[1]; p[0] += vx; p[1] += vy + G * dt * dt;
    }
    for (let it = 0; it < 4; it++) {
      for (const [a, b, L] of STICKS) {
        const pa = f.p[a], pb = f.p[b], dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1, k = (d - L) / d * 0.5;
        pa[0] += dx * k; pa[1] += dy * k; pb[0] -= dx * k; pb[1] -= dy * k;
      }
      for (let i = 0; i < f.p.length; i++) { const p = f.p[i]; if (p[1] > fl) { p[1] = fl; f.q[i][0] += (p[0] - f.q[i][0]) * 0.3; } p[0] = Math.max(6, Math.min(W - 6, p[0])); }
    }
  };
  const crateStep = (c, dt) => {
    const fl = floor();
    for (let i = 0; i < 4; i++) { const p = c.p[i], q = c.q[i], vx = (p[0] - q[0]) * 0.99, vy = (p[1] - q[1]) * 0.99; q[0] = p[0]; q[1] = p[1]; p[0] += vx; p[1] += vy + G * dt * dt; }
    const S = [[0, 1, 11], [1, 2, 11], [2, 3, 11], [3, 0, 11], [0, 2, 15.6], [1, 3, 15.6]];
    for (let it = 0; it < 3; it++) {
      for (const [a, b, L] of S) { const pa = c.p[a], pb = c.p[b], dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1, k = (d - L) / d * 0.5; pa[0] += dx * k; pa[1] += dy * k; pb[0] -= dx * k; pb[1] -= dy * k; }
      for (let i = 0; i < 4; i++) { const p = c.p[i]; if (p[1] > fl) { p[1] = fl; c.q[i][0] += (p[0] - c.q[i][0]) * 0.4; } p[0] = Math.max(4, Math.min(W - 4, p[0])); }
    }
    // fighters' fists and feet shove crates around
    for (const f of [me, foe]) for (const k of [3, 4, 5, 6]) {
      const cx = (c.p[0][0] + c.p[2][0]) / 2, cy = (c.p[0][1] + c.p[2][1]) / 2, dx = cx - f.p[k][0], dy = cy - f.p[k][1], d = Math.hypot(dx, dy);
      if (d < 9 && d > 0.01) { const [vx, vy] = f.vel(k), push = (9 - d) / d * 0.5 + Math.hypot(vx, vy) * 0.06; for (const p of c.p) { p[0] += dx * push; p[1] += dy * push - 0.3; } }
    }
  };
  const drawFighter = (g, f, critic) => {
    const P = f.p, c = f.colors, flash = f.ko > 0 && Math.floor(t * 20) % 2;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const limb = (a, b, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(P[a][0], P[a][1]); g.lineTo(P[b][0], P[b][1]); g.stroke(); };
    limb(2, 5, 3.4, c.limb); limb(2, 6, 3.4, c.limb); limb(1, 3, 3, c.limb); limb(1, 4, 3, c.limb);
    limb(1, 2, 7, flash ? '#fff' : c.body);
    g.fillStyle = c.accent; g.fillRect(P[2][0] - 4, P[2][1] - 2, 8, 2);
    for (const k of [3, 4]) { g.fillStyle = c.accent; g.beginPath(); g.arc(P[k][0], P[k][1], f.punch > 0 && k === (f.face > 0 ? 4 : 3) && f.heavy ? 3.4 : 2.4, 0, 7); g.fill(); }
    g.fillStyle = flash ? '#fff' : c.body; g.beginPath(); g.arc(P[0][0], P[0][1], 6, 0, 7); g.fill();
    g.fillStyle = '#05070a'; g.fillRect(P[0][0] - 4 + f.face, P[0][1] - 2, 8, 3);
    g.fillStyle = c.eye; g.fillRect(P[0][0] - 3 + f.face * 2, P[0][1] - 1, 2, 1); g.fillRect(P[0][0] + f.face * 2, P[0][1] - 1, 2, 1);
    if (critic) { g.fillStyle = '#c0283a'; g.beginPath(); g.ellipse(P[0][0] - f.face, P[0][1] - 6, 7, 2.5, 0, 0, 7); g.fill(); g.fillRect(P[0][0] - 1, P[0][1] - 9, 2, 2); g.strokeStyle = '#f2c14e'; g.lineWidth = 0.8; g.beginPath(); g.arc(P[0][0] + f.face * 2, P[0][1] - 0.5, 2, 0, 7); g.stroke(); }
    else { g.strokeStyle = '#aab0ba'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(P[0][0] + 2, P[0][1] - 6); g.lineTo(P[0][0] + 3, P[0][1] - 10); g.stroke(); g.fillStyle = '#ff7a1a'; g.fillRect(P[0][0] + 2, P[0][1] - 11, 2, 2); }
  };
  const bar = (x, w, f, name, right) => { const g = mini.g, y = Math.min(floor() - 72, mini.top + 40); /* below the subtitles, above the fighters */ g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, w + 2, 7); g.fillStyle = '#3a1020'; g.fillRect(x, y, w, 5); g.fillStyle = f.hp > 30 ? '#7dff9a' : '#ff4d6a'; const fw = w * f.hp / f.max; g.fillRect(right ? x + w - fw : x, y, fw, 5); mini.label(name, right ? x + w : x, y + 14, '#fff', 7, right ? 'right' : 'left'); };

  let losses = 0;
  for (;;) {
    const res = await mini.run((dt) => {
      t += dt;
      // ---- player input ----
      let mx = input.move.x, jump = input.move.y < -0.55, tap = input.action(), held = input.held;
      if (ui.auto) { const dx = foe.x - me.x; mx = Math.abs(dx) > 20 ? Math.sign(dx) : 0; botT -= dt; tap = false; held = false; if (botT <= 0 && Math.abs(dx) < 26) { tap = true; botT = 0.3; } jump = stars.some((s) => Math.abs(s.x - me.x) < 22 && s.vx * (me.x - s.x) > 0); if (ui.fast && t > 6) foe.hp = 0; }
      if (tap && !over) attack(me, false);
      if (held) heldT += dt; me.charge = Math.min(1, Math.max(0, (heldT - 0.2) / 0.5));
      if (!held && wasHeld && heldT > 0.45 && !over) { me.cd = 0; attack(me, true); mini.text(me.x, me.p[0][1] - 18, '¡FREGONAZO!', '#6fe3ff'); }
      if (!held) heldT = 0; wasHeld = held;
      const j = jump && !jumpLatch; jumpLatch = jump;
      me.face = foe.x > me.x ? 1 : -1; foe.face = me.x > foe.x ? 1 : -1;
      // ---- the critic ----
      const dx = me.x - foe.x, ad = Math.abs(dx);
      let fmx = ad > 18 ? Math.sign(dx) * 0.8 : ad < 12 ? -Math.sign(dx) * 0.5 : 0;
      if (foe.ko <= 0 && !over) {
        if (ad < 22 && foe.cd <= 0 && Math.random() < dt * 2.2) attack(foe, Math.random() < 0.22);
        if (me.punch > 0.12 && ad < 26 && Math.random() < dt * 6) foe.block = 0.4;
        if (Math.floor(t / 5.5) !== Math.floor((t - dt) / 5.5)) { stars.push({ x: foe.x + foe.face * 8, y: foe.p[1][1], vx: foe.face * 95 }); audio.shoot(); mini.text(foe.x, foe.p[0][1] - 16, '¡UNA ESTRELLA!', '#f2c14e'); }
      }
      control(me, over ? 0 : mx, j && !over, dt); control(foe, over ? 0 : fmx, !over && foe.grounded && Math.random() < dt * 0.4, dt);
      physics(me, dt); physics(foe, dt); for (const c of crates) crateStep(c, dt);
      // fighters can't walk through each other
      const sep = foe.p[2][0] - me.p[2][0]; if (Math.abs(sep) < 10) { const k = (10 - Math.abs(sep)) / 2 * Math.sign(sep || 1); for (const i of [0, 1, 2]) { me.p[i][0] -= k; foe.p[i][0] += k; } }
      if (!over) { hitCheck(me, foe); hitCheck(foe, me); }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]; s.x += s.vx * dt;
        if (Math.abs(s.x - me.x) < 6 && Math.abs(s.y - me.p[1][1]) < 12 && !over) { me.hp = Math.max(0, me.hp - 6); me.push(Math.sign(s.vx) * 2, -2); audio.hurt(); mini.shake = 0.6; mini.text(me.x, me.p[0][1] - 16, '★☆☆☆☆', '#f2c14e'); stars.splice(i, 1); continue; }
        if (s.x < -10 || s.x > W + 10) stars.splice(i, 1);
      }
      if (!over && foe.hp <= 0) { over = 'win'; foe.ko = 99; foe.push(me.face * 4, -5); audio.explode(); game.hitstop(0.25); mini.shake = 1.5; }
      if (!over && me.hp <= 0) { over = 'lose'; me.ko = 99; audio.powerdown(); }
      if (over) overT += dt;

      // ---- draw ----
      const g = mini.g, sh = mini.shake * 3, fl = floor();
      g.setTransform(1, 0, 0, 1, 0, 0);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a0a1a'); bg.addColorStop(0.7, '#5a1a2a'); bg.addColorStop(1, '#1a0610');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,200,120,.08)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(W * (0.1 + i * 0.2), 0); g.lineTo(W * (0.05 + i * 0.2), fl); g.lineTo(W * (0.18 + i * 0.2), fl); g.fill(); }
      for (let i = 0; i < 14; i++) { const x = (i / 13) * W; g.fillStyle = '#12040a'; g.beginPath(); g.arc(x, fl - 22 + Math.sin(t * 3 + i) * 1.5, 7, 0, 7); g.fill(); g.fillRect(x - 6, fl - 22, 12, 22); }
      mini.label('CRÍTICA EN DIRECTO', W / 2, fl - 40, 'rgba(242,193,78,.5)', 8);
      g.fillStyle = '#3a1a10'; g.fillRect(0, fl, W, H - fl); g.fillStyle = '#5a2a18'; g.fillRect(0, fl, W, 2);
      g.translate(Math.round((Math.random() - 0.5) * sh), Math.round((Math.random() - 0.5) * sh));
      for (const c of crates) { g.fillStyle = '#9a6b3c'; g.strokeStyle = '#5a3a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(c.p[0][0], c.p[0][1]); for (let i = 1; i < 4; i++) g.lineTo(c.p[i][0], c.p[i][1]); g.closePath(); g.fill(); g.stroke(); }
      for (const s of stars) { g.fillStyle = '#f2c14e'; g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.fillText('★', s.x, s.y + 3); }
      drawFighter(g, foe, true); drawFighter(g, me, false);
      if (me.charge > 0) { g.strokeStyle = me.charge >= 1 ? '#fff' : '#6fe3ff'; g.lineWidth = 1.5; g.beginPath(); g.arc(me.p[1][0], me.p[1][1], 14, -Math.PI / 2, -Math.PI / 2 + me.charge * 6.28); g.stroke(); }
      g.setTransform(1, 0, 0, 1, 0, 0);
      mini.drawTexts(dt);
      const bw = Math.min(110, W * 0.4); bar(6, bw, me, 'M0P-1', false); bar(W - 6 - bw, bw, foe, 'EL CRÍTICO', true);
      if (over) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, H / 2 - 20, W, 40); mini.label(over === 'win' ? '¡K.O.!' : 'DERROTA', W / 2, H / 2 + 4, over === 'win' ? '#f2c14e' : '#ff4d6a', 14); }
      if (overT > (ui.fast ? 0.3 : 2.4)) return true;
      return false;
    });
    if (over === 'win') break;
    losses++; game.prog && game.prog.deaths++;
    ui.bark('narrador', losses === 1 ? 'El Crítico te ha dado una estrella. Repetimos el asalto.' : 'Le he quitado vida al Crítico. Que no se diga que no ayudo.');
    if (losses >= 1) assist = Math.min(2, losses);
    reset();
  }
  ui.objective(''); mini.close();
  game.addScore(4000); ui.achieve('critic', 'Cinco estrellas', 'Noquear a El Crítico');
  return losses;
}
