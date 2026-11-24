// El Crítico: a 2D fighting game with physics, best of three rounds. Both fighters are verlet ragdolls
// (points + sticks) that a few springs keep standing; hits throw real impulses, heavy blows launch the other
// fighter into the ropes. Stick or A/D: walk. Stick up (or diagonally up) without the button: jump that way.
// Button: tap to punch, hold and release for a mop swing; both go wherever the stick points (up: uppercut, down: spike).

const S = 1.45, HZ = 60, H_STEP = 1 / HZ, G = 900 * H_STEP * H_STEP; // fixed 60 Hz steps; velocities in px per step
const STICKS = [[0, 1], [1, 2], [1, 3], [1, 4], [2, 5], [2, 6], [0, 2], [5, 6]];
const QUIPS_HIT = ['★☆☆☆☆', '¡PREDECIBLE!', '¡SIN ALMA!', '¡DERIVATIVO!', '¡MUY VISTO!'];
const QUIPS_HURT = ['¡AUCH!', '¡ESO NO SALÍA EN EL GUION!', '¡MI MONÓCULO!', '¡UNA ESTRELLA MENOS!'];
const SIGNS = ['¡M0P-1!', '★★★★★', '¡BUUU!', 'FREGONA ♥', '¿5★?', 'PELUSA TE QUIERE', '¡KO!', 'CRÍTICO VENDIDO'];

class Fighter {
  constructor(x, floor, face, robot) {
    const rel = robot ? [[0, -40], [0, -28], [0, -15], [-7, -23], [7, -23], [-3.5, -3], [3.5, -3]] : [[0, -42], [0, -30], [0, -18], [-7, -25], [7, -25], [-5, -2], [5, -2]];
    this.p = rel.map(([dx, dy]) => [x + dx * S, floor + dy * S]); this.q = this.p.map((a) => [...a]);
    this.L = STICKS.map(([a, b]) => Math.hypot(this.p[a][0] - this.p[b][0], this.p[a][1] - this.p[b][1]));
    Object.assign(this, { face, robot, hp: 100, max: 100, ko: 0, air: 0, atk: null, cd: 0, block: 0, walk: 0, charge: 0, trail: [], wallCd: 0, wins: 0, blink: 2 });
  }
  get x() { return this.p[2][0]; }
  push(vx, vy) { for (let i = 0; i < 7; i++) { this.q[i][0] -= vx; this.q[i][1] -= vy; } }
}

export async function fightCritic(mini, { assist = 0 } = {}) {
  const game = mini.game, { ui, input, audio } = game;
  mini.open(); audio.mood('tense');
  const W = mini.W, H = mini.H, floor = () => H - mini.pad - 14, wallL = 12, wallR = () => W - 12;
  let me, foe, stars, sparks, t, acc, over, overT, round, flash, crowdHype, intro;
  const crowd = Array.from({ length: Math.ceil(W / 9) * 3 }, (_, i) => ({ row: i % 3, x: (Math.floor(i / 3) * 9 + (i % 3) * 3) % (W + 9), ph: Math.random() * 6, col: ['#2a2033', '#3a2a40', '#45304a', '#30263a'][(Math.random() * 4) | 0], sign: Math.random() < 0.12 ? SIGNS[(Math.random() * SIGNS.length) | 0] : null }));
  const setup = (keepWins) => {
    const wins = keepWins ? [me.wins, foe.wins] : [0, 0];
    me = new Fighter(W * 0.3, floor(), 1, true); foe = new Fighter(W * 0.7, floor(), -1, false);
    me.wins = wins[0]; foe.wins = wins[1];
    foe.max = foe.hp = Math.round(100 * (1 - assist * 0.2));
    stars = []; sparks = []; t = 0; acc = 0; over = null; overT = 0; flash = 0; crowdHype = 0; intro = 1.8;
  };
  round = 1; setup(false);
  ui.objective('Gana dos asaltos a El Crítico'); ui.bark('narrador', 'El Crítico. Ha venido a ponerle nota al juego. Al mejor de tres asaltos.');
  ui.bark('sistema', 'Toca: puñetazo. Mantén y suelta: fregonazo. Los golpes van hacia donde apuntes con el stick. Stick arriba sin el botón: saltar; en diagonal, salto en diagonal.');
  let heldT = 0, wasHeld = false, jumpLatch = false, jumpWait = -1, jumpQ = false, botT = 0;
  mini.dbgFight = () => ({ hipY: me.p[2][1], floor: floor(), wins: [me.wins, foe.wins], intro, hp: [Math.round(me.hp), Math.round(foe.hp)], round, over, ko: [me.ko > 0, foe.ko > 0], x: [Math.round(me.x), Math.round(foe.x)], aim: me.atk ? [+me.atk.ax.toFixed(2), +me.atk.ay.toFixed(2)] : null });

  const burst = (x, y, n, col, sp = 2.5) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = sp * (0.4 + Math.random()); sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 0.4 + Math.random() * 0.3, col, size: 1 + Math.random() * 2 }); } };
  // attacks have a wind-up you can see, a strike, and a recovery
  // aim: a unit vector; a stick left centred (or a bot) punches straight ahead
  const aimOf = (f, x, y) => { const l = Math.hypot(x, y); return l < 0.35 ? [f.face, 0] : [x / l, y / l]; };
  const attack = (f, heavy, aim = [f.face, 0]) => { if (f.cd > 0 || f.ko > 0 || f.atk) return; f.atk = { heavy, ax: aim[0], ay: aim[1], t: 0, wind: heavy ? 0.32 : 0.14, strike: heavy ? 0.16 : 0.11, rec: heavy ? 0.28 : 0.16, hit: false }; f.cd = heavy ? 0.95 : 0.5; };
  const strikeHand = (f) => f.p[f.face > 0 ? 4 : 3];
  const hitCheck = (a, b) => {
    const k = a.atk; if (!k || k.hit || k.t < k.wind || k.t > k.wind + k.strike) return;
    const hand = strikeHand(a), reach = (k.heavy ? 11 : 7) * S;
    for (const i of [0, 1, 2]) {
      const dx = b.p[i][0] - hand[0], dy = b.p[i][1] - hand[1];
      if (dx * dx + dy * dy > reach * reach) continue;
      k.hit = true;
      const blocked = b.block > 0 && b.ko <= 0 && Math.sign(a.x - b.x) === b.face;
      const dmg = Math.round((k.heavy ? 18 : 7) * (blocked ? 0.3 : 1));
      b.hp = Math.max(0, b.hp - dmg);
      // the blow throws the other fighter along the aim: an uppercut launches, a spike slams down (and bounces off the floor)
      const air = Math.max(b.p[2][1], b.p[5][1], b.p[6][1]) < floor() - 3, lift = (v) => (v > 0 && !air ? -1.2 : v);
      if (k.heavy && !blocked) { b.push(k.ax * 6.5, lift(k.ay * 6.5 - 4.2 * (1 - Math.abs(k.ay)))); b.ko = 1.1; game.hitstop(0.14); mini.shake = 1.3; flash = 0.5; audio.thud(1.5); crowdHype = 1.5; mini.text(hand[0], hand[1] - 10, '¡FREGONAZO!', '#6fe3ff'); }
      else { b.push(k.ax * (blocked ? 0.8 : 2.4), lift(k.ay * (blocked ? 0.8 : 2.8) - 1.2 * (1 - Math.abs(k.ay)))); game.hitstop(0.06); mini.shake = 0.6; audio.clank(0.9); crowdHype = Math.max(crowdHype, 0.6); }
      if (blocked) mini.text(b.x, b.p[0][1] - 14, '¡BLOQUEO!', '#9fefff');
      else mini.text(b.x, b.p[0][1] - 16, b === foe ? QUIPS_HURT[(Math.random() * QUIPS_HURT.length) | 0] : QUIPS_HIT[(Math.random() * QUIPS_HIT.length) | 0], b === foe ? '#ffd24a' : '#ff6a8a');
      burst(hand[0], hand[1], k.heavy ? 26 : 12, k.heavy ? '#ffffff' : '#ffd24a', k.heavy ? 4 : 2.5);
      a.impact = { x: hand[0], y: hand[1], t: 0.18, big: k.heavy };
      game.buzz(k.heavy ? 80 : 25);
      return;
    }
  };
  // pose springs move a point and its previous position together: they shape the body without pumping velocity into it
  const spring = (f, i, tx, ty, k) => { const dx = (tx - f.p[i][0]) * k, dy = (ty - f.p[i][1]) * k; f.p[i][0] += dx; f.p[i][1] += dy; f.q[i][0] += dx; f.q[i][1] += dy; };
  const control = (f, mx, jump, jdx = 0) => {
    f.cd -= H_STEP; f.block -= H_STEP; f.air -= H_STEP; f.wallCd -= H_STEP; f.blink -= H_STEP;
    if (f.atk) { f.atk.t += H_STEP; if (f.atk.t > f.atk.wind + f.atk.strike + f.atk.rec) f.atk = null; }
    if (f.ko > 0) { f.ko -= H_STEP; f.atk = null; return; } // limp
    const hip = f.p[2], fl = floor(), grounded = Math.max(f.p[2][1], f.p[5][1], f.p[6][1]) >= fl - 2; // lying down counts too, so a fallen fighter gets back up
    if (Math.abs(mx) > 0.15 && !(f.atk && f.atk.heavy)) { const s = mx * 38 * H_STEP * (grounded ? 1 : 0.7); for (const i of [0, 1, 2, 5, 6]) f.p[i][0] += s; f.walk += H_STEP * 9 * Math.abs(mx); }
    const air = f.air > 0 || !grounded;
    if (!air) { for (const i of [0, 1, 2]) f.q[i][1] = f.p[i][1]; spring(f, 2, hip[0], fl - (f.robot ? 12 : 16) * S, f.ko > -0.6 ? 0.08 : 0.3); } // standing: no vertical drift, hip at standing height (slower while getting up)
    if (f.ko > -0.6) f.ko -= H_STEP;
    spring(f, 1, hip[0], hip[1] - 13 * S, 0.4); spring(f, 0, hip[0] + f.face * S, hip[1] - 25 * S, 0.4);
    const step = Math.sin(f.walk) * (Math.abs(mx) > 0.15 ? (f.robot ? 3 : 4) * S : 0);
    if (!air) { spring(f, 5, hip[0] - (f.robot ? 3.5 : 5) * S + step, fl, 0.2); spring(f, 6, hip[0] + (f.robot ? 3.5 : 5) * S - step, fl, 0.2); }
    const ch = f.p[1], front = f.face > 0 ? 4 : 3, back = f.face > 0 ? 3 : 4, k = f.atk;
    if (k && k.t < k.wind) spring(f, front, ch[0] - k.ax * (k.heavy ? 9 : 4) * S, ch[1] - k.ay * (k.heavy ? 9 : 4) * S - (k.heavy ? 6 : 1) * S, 0.3); // wind-up: pull the arm back
    else if (k && k.t < k.wind + k.strike) spring(f, front, ch[0] + k.ax * (k.heavy ? 20 : 16) * S, ch[1] + k.ay * (k.heavy ? 20 : 16) * S - (k.heavy ? 6 : 1) * S * (1 - Math.abs(k.ay)), 0.55);
    else spring(f, front, ch[0] + f.face * 8 * S, ch[1] - 4 * S, 0.25);
    spring(f, back, ch[0] + f.face * 2 * S, ch[1] - 2 * S, 0.22);
    if (jump && grounded && f.air <= 0) { f.push(jdx * 1.6, -4.8); f.air = 0.35; audio.jump(); } // diagonal stick: diagonal jump
  };
  const physics = (f) => {
    const fl = floor(), wr = wallR();
    for (let i = 0; i < 7; i++) { const p = f.p[i], q = f.q[i], vx = (p[0] - q[0]) * 0.99, vy = (p[1] - q[1]) * 0.99; q[0] = p[0]; q[1] = p[1]; p[0] += vx; p[1] += vy + G; }
    for (let it = 0; it < 5; it++) {
      STICKS.forEach(([a, b], j) => { const pa = f.p[a], pb = f.p[b], dx = pb[0] - pa[0], dy = pb[1] - pa[1], d = Math.hypot(dx, dy) || 1, k = (d - f.L[j]) / d * 0.5; pa[0] += dx * k; pa[1] += dy * k; pb[0] -= dx * k; pb[1] -= dy * k; });
      for (let i = 0; i < 7; i++) {
        const p = f.p[i], q = f.q[i];
        if (p[1] > fl) { p[1] = fl; q[1] = fl; q[0] += (p[0] - q[0]) * 0.25; } // the floor stops vertical motion dead
        if (p[0] < wallL || p[0] > wr) { // the ropes throw you back
          const vx = p[0] - q[0], side = p[0] < wallL ? -1 : 1; p[0] = side < 0 ? wallL : wr; q[0] = p[0] + vx * 0.55;
          if (Math.abs(vx) > 2.6 && f.wallCd <= 0 && i <= 2) { f.wallCd = 0.5; f.hp = Math.max(0, f.hp - 5); mini.shake = 1; audio.thud(1.2); game.hitstop(0.08); crowdHype = 1.5; burst(p[0], p[1], 18, '#e8e6e0', 3); mini.text(p[0] - side * 30, p[1] - 14, '¡CONTRA LAS CUERDAS!', '#ff9a5a'); }
        }
      }
    }
  };
  const fighterStep = (mx, jump, jdx, fmx, fjump) => {
    control(me, over ? 0 : mx, jump && !over, jdx); control(foe, over ? 0 : fmx, fjump && !over);
    physics(me); physics(foe);
    const sep = foe.p[2][0] - me.p[2][0]; if (Math.abs(sep) < 11 * S && me.ko <= 0 && foe.ko <= 0) { const k = (11 * S - Math.abs(sep)) / 2 * Math.sign(sep || 1); for (const i of [0, 1, 2, 5, 6]) { me.p[i][0] -= k; foe.p[i][0] += k; } }
    if (!over && intro <= 0) { hitCheck(me, foe); hitCheck(foe, me); }
    for (const f of [me, foe]) { const h = strikeHand(f); f.trail.push([h[0], h[1]]); if (f.trail.length > 7) f.trail.shift(); }
  };

  // ---------- drawing ----------
  const ellipse = (g, x, y, rx, ry, rot, fill, stroke) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, 7); g.fillStyle = fill; g.fill(); if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } g.restore(); };
  const drawRobot = (g, f) => { // the orange M0P-1: big round helmet, dark visor with two round cyan eyes, grey ear discs, antenna, short legs
    const P = f.p, fl = f.ko > 0 && Math.floor(t * 20) % 2, orange = fl ? '#ffffff' : '#f07a2a', dark = '#b0481a', grey = '#c0c4cc';
    const ang = Math.atan2(P[1][0] - P[2][0], -(P[1][1] - P[2][1]));
    g.lineCap = 'round';
    for (const k of [5, 6]) { // legs and feet
      g.strokeStyle = '#e2552a'; g.lineWidth = 3 * S; g.beginPath(); g.moveTo(P[2][0] + (k === 5 ? -2 : 2) * S, P[2][1]); g.lineTo(P[k][0], P[k][1] - 1.5 * S); g.stroke();
      g.fillStyle = '#c8402a'; g.beginPath(); g.ellipse(P[k][0] + f.face * S, P[k][1] - 1.2 * S, 3 * S, 1.6 * S, 0, 0, 7); g.fill();
    }
    const back = f.face > 0 ? 3 : 4, front = f.face > 0 ? 4 : 3;
    const arm = (h) => { g.strokeStyle = orange; g.lineWidth = 2.4 * S; g.beginPath(); g.moveTo(P[1][0], P[1][1] + 1.5 * S); g.lineTo(P[h][0], P[h][1]); g.stroke(); g.fillStyle = grey; g.beginPath(); g.arc(P[h][0], P[h][1], 1.9 * S, 0, 7); g.fill(); };
    arm(back);
    const bx = (P[1][0] + P[2][0]) / 2, by = (P[1][1] + P[2][1]) / 2 + 1.5 * S;
    ellipse(g, bx, by, 6 * S, 7.5 * S, ang, orange, dark); // small body
    g.save(); g.translate(bx, by); g.rotate(ang); g.fillStyle = '#2a3a6a'; g.fillRect(-4.5 * S, -7 * S, 9 * S, 2.4 * S); g.fillStyle = grey; g.fillRect(-5 * S, -4.4 * S, 10 * S, 1.2 * S); g.restore();
    // the helmet: bigger than the body, like the 3D model
    const hx = P[0][0], hy = P[0][1] - 2 * S;
    g.strokeStyle = '#8a8f98'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(hx - f.face * 4 * S, hy - 7 * S); g.lineTo(hx - f.face * 6 * S, hy - 13 * S); g.stroke();
    g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(hx - f.face * 6 * S, hy - 13.5 * S, 1.6 * S, 0, 7); g.fill();
    for (const sx of [-1, 1]) { g.fillStyle = '#9aa0aa'; g.beginPath(); g.arc(hx + sx * 9 * S, hy + 0.5 * S, 2.3 * S, 0, 7); g.fill(); }
    g.fillStyle = orange; g.beginPath(); g.arc(hx, hy, 9 * S, 0, 7); g.fill(); g.strokeStyle = dark; g.lineWidth = 1; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(hx - 3 * S, hy - 5.5 * S, 3 * S, 1.4 * S, -0.4, 0, 7); g.fill();
    g.fillStyle = '#0a0c12'; g.beginPath(); g.ellipse(hx + f.face * 1.2 * S, hy + 0.8 * S, 6.6 * S, 5.2 * S, 0, 0, 7); g.fill();
    const blink = f.blink < 0.12; if (f.blink < 0) f.blink = 2 + Math.random() * 2;
    for (const ex of [-1.6, 2.6]) {
      const x = hx + f.face * (ex + 0.6) * S, y = hy + 0.6 * S;
      if (f.ko > 0) { g.strokeStyle = '#ff6a4d'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 1.3 * S, y - 1.3 * S); g.lineTo(x + 1.3 * S, y + 1.3 * S); g.moveTo(x + 1.3 * S, y - 1.3 * S); g.lineTo(x - 1.3 * S, y + 1.3 * S); g.stroke(); }
      else { g.fillStyle = '#9ff2ff'; g.shadowColor = '#6fe3ff'; g.shadowBlur = 4; g.beginPath(); g.ellipse(x, y, 1.7 * S, blink ? 0.3 * S : 1.9 * S, 0, 0, 7); g.fill(); g.shadowBlur = 0; }
    }
    arm(front);
    const k = f.atk; // the mop comes out for the heavy swing
    if (k && k.heavy) { const h = P[front], dx = k.ax, dy = k.ay - 0.45 * (1 - Math.abs(k.ay)), mx = h[0] + dx * 13 * S, my = h[1] + dy * 13 * S; g.strokeStyle = '#aab0ba'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(h[0] - dx * 4 * S, h[1] - dy * 4 * S); g.lineTo(mx, my); g.stroke(); g.fillStyle = '#4fb7ff'; g.beginPath(); g.ellipse(mx, my, 3 * S, 2 * S, -dx * 0.5, 0, 7); g.fill(); }
  };
  const drawCritic = (g, f) => {
    const P = f.p, fl = f.ko > 0 && Math.floor(t * 20) % 2, coat = fl ? '#ffffff' : '#3a2350';
    g.lineCap = 'round';
    const limb = (a, b, w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(P[a][0], P[a][1]); g.lineTo(P[b][0], P[b][1]); g.stroke(); };
    limb(2, 5, 2.6 * S, '#1e1828'); limb(2, 6, 2.6 * S, '#1e1828');
    for (const k of [5, 6]) { g.fillStyle = '#0a0a0a'; g.fillRect(P[k][0] - 2.5 * S, P[k][1] - 1.4 * S, 5 * S, 1.6 * S); }
    const back = f.face > 0 ? 3 : 4, front = f.face > 0 ? 4 : 3;
    limb(1, back, 2.4 * S, '#2c1a3e'); g.fillStyle = '#e8b48a'; g.beginPath(); g.arc(P[back][0], P[back][1], 1.8 * S, 0, 7); g.fill();
    limb(1, 2, 7.5 * S, coat);
    g.strokeStyle = '#c0283a'; g.lineWidth = 2.4 * S; g.beginPath(); g.moveTo(P[1][0] - 3 * S, P[1][1] - 2 * S); g.lineTo(P[1][0] + 3 * S, P[1][1] - 2 * S); g.lineTo(P[1][0] + f.face * 2 * S, P[1][1] + 6 * S); g.stroke(); // scarf
    const hx = P[0][0], hy = P[0][1];
    g.fillStyle = fl ? '#fff' : '#e8b48a'; g.beginPath(); g.arc(hx, hy, 6 * S, 0, 7); g.fill();
    g.fillStyle = '#c0283a'; g.beginPath(); g.ellipse(hx - f.face * S, hy - 5.5 * S, 7.5 * S, 2.6 * S, -f.face * 0.15, 0, 7); g.fill(); g.fillRect(hx - 0.6 * S, hy - 9 * S, 1.2 * S, 2 * S); // beret
    g.fillStyle = '#1a1a1a'; g.fillRect(hx + f.face * 1 * S - (f.face < 0 ? 4 * S : 0), hy + 2.2 * S, 4 * S, 1 * S); // moustache
    g.strokeStyle = '#f2c14e'; g.lineWidth = 0.9; g.beginPath(); g.arc(hx + f.face * 3 * S, hy - 0.5 * S, 1.8 * S, 0, 7); g.stroke(); g.beginPath(); g.moveTo(hx + f.face * 3 * S, hy + 1.3 * S); g.lineTo(hx + f.face * 2 * S, hy + 6 * S); g.stroke(); // monocle
    g.fillStyle = '#111'; g.fillRect(hx + f.face * 3 * S - 0.6, hy - 1, 1.4, 1.4); g.fillRect(hx - f.face * 0.5 * S - 0.6, hy - 1, 1.4, 1.4);
    limb(1, front, 2.4 * S, '#2c1a3e'); g.fillStyle = '#e8b48a'; g.beginPath(); g.arc(P[front][0], P[front][1], 2 * S, 0, 7); g.fill();
  };
  const drawTrail = (g, f) => { const k = f.atk; if (!k || k.t < k.wind || k.t > k.wind + k.strike + 0.05) return; g.strokeStyle = k.heavy ? 'rgba(111,227,255,.8)' : 'rgba(255,255,255,.7)'; g.lineWidth = (k.heavy ? 4 : 2.5) * S * 0.6; g.lineCap = 'round'; g.beginPath(); f.trail.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
  const drawImpact = (g, f) => { const m = f.impact; if (!m || m.t <= 0) return; m.t -= 1 / 60; const r = (m.big ? 16 : 9) * S * (1 - m.t / 0.18 * 0.4); g.fillStyle = m.big ? '#ffffff' : '#ffd24a'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, rr = i % 2 ? r * 0.45 : r; g.lineTo(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr); } g.fill(); };
  const bar = (x, w, f, name, right) => {
    const g = mini.g, y = Math.min(floor() - 75, mini.top + 58); /* clear of a two-line subtitle */
    g.fillStyle = '#000'; g.fillRect(x - 1, y - 1, w + 2, 7); g.fillStyle = '#3a1020'; g.fillRect(x, y, w, 5);
    g.fillStyle = f.hp > 30 ? '#7dff9a' : '#ff4d6a'; const fw = w * f.hp / f.max; g.fillRect(right ? x + w - fw : x, y, fw, 5);
    mini.label(name, right ? x + w : x, y + 14, '#fff', 7, right ? 'right' : 'left');
    for (let i = 0; i < 2; i++) { g.fillStyle = i < f.wins ? '#f2c14e' : '#3a3040'; g.beginPath(); g.arc(right ? x + w - 4 - i * 9 : x + 4 + i * 9, y + 20, 3, 0, 7); g.fill(); } // rounds won
  };

  let losses = 0;
  for (;;) {
    await mini.run((dt) => {
      t += dt; flash = Math.max(0, flash - dt * 3); crowdHype = Math.max(0, crowdHype - dt * 0.8); intro -= dt;
      // ---- input ----
      let mx = input.move.x, my = input.move.y, up = my < -0.55, tap = input.action(), held = input.held;
      if (ui.auto) { const dx = foe.x - me.x; mx = Math.abs(dx) > 26 * S * 0.75 ? Math.sign(dx) : 0; my = 0; botT -= dt; tap = false; held = false; if (botT <= 0 && Math.abs(dx) < 30 * S * 0.75) { tap = true; botT = 0.45; } up = stars.some((s) => Math.abs(s.x - me.x) < 26 && s.vx * (me.x - s.x) > 0); if (ui.fast && t > 4) foe.hp = 0; }
      if (intro > 0 || over) { mx = 0; my = 0; up = false; tap = false; }
      // stick up alone jumps; stick up plus the button hits upwards. So the jump waits a moment for the button,
      // and pressing it (or already holding it) turns the jump into an aimed blow
      if (up && !jumpLatch) jumpWait = held || tap ? -1 : ui.auto ? 0 : 0.09;
      if (!up || tap || held) jumpWait = -1;
      else if (jumpWait >= 0) { jumpWait -= dt; if (jumpWait < 0) jumpQ = true; }
      jumpLatch = up;
      if (tap) attack(me, false, aimOf(me, mx, my));
      if (held && intro <= 0) heldT += dt; me.charge = Math.min(1, Math.max(0, (heldT - 0.2) / 0.5));
      if (!held && wasHeld && heldT > 0.45 && !over) { me.cd = 0; me.atk = null; attack(me, true, aimOf(me, mx, my)); }
      if (!held) heldT = 0; wasHeld = held;
      // face the other fighter, except while throwing a blow the other way
      const turnTo = (f, o) => { if (f.ko > 0) return; const a = f.atk; f.face = a && Math.abs(a.ax) > 0.3 ? Math.sign(a.ax) : o.x > f.x ? 1 : -1; };
      turnTo(me, foe); turnTo(foe, me);
      // ---- the critic ----
      const dx = me.x - foe.x, ad = Math.abs(dx);
      let fmx = ad > 22 * S ? Math.sign(dx) * 0.85 : ad < 14 * S ? -Math.sign(dx) * 0.4 : 0, fj = false;
      if (foe.ko <= 0 && !over && intro <= 0) {
        if (ad < 24 * S && foe.cd <= 0 && Math.random() < dt * 1.4) attack(foe, Math.random() < 0.22, aimOf(foe, dx, Math.min(0, me.p[1][1] - foe.p[1][1]) * 1.5)); // aims up at a robot in the air
        if (me.atk && me.atk.t < me.atk.wind && ad < 30 * S && Math.random() < dt * 4) foe.block = 0.45;
        if (Math.floor(t / 6) !== Math.floor((t - dt) / 6)) { stars.push({ x: foe.x + foe.face * 10, y: foe.p[1][1], vx: foe.face * 70 }); audio.shoot(); mini.text(foe.x, foe.p[0][1] - 16, '¡UNA ESTRELLA!', '#f2c14e'); }
        fj = Math.random() < dt * 0.25;
      }
      acc += Math.min(dt, 0.1);
      while (acc >= H_STEP) { fighterStep(mx, jumpQ, Math.abs(mx) > 0.3 ? mx : 0, fmx, fj); jumpQ = false; acc -= H_STEP; }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]; s.x += s.vx * dt;
        if (Math.abs(s.x - me.x) < 6 * S && Math.abs(s.y - me.p[1][1]) < 10 * S && !over) { me.hp = Math.max(0, me.hp - 6); me.push(Math.sign(s.vx) * 2, -2); audio.hurt(); mini.shake = 0.6; mini.text(me.x, me.p[0][1] - 16, '★☆☆☆☆', '#f2c14e'); stars.splice(i, 1); continue; }
        if (s.x < -10 || s.x > W + 10) stars.splice(i, 1);
      }
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.x += s.vx; s.y += s.vy; s.vy += 0.15; s.life -= dt; if (s.life <= 0) sparks.splice(i, 1); }
      if (!over && foe.hp <= 0) { over = 'win'; me.wins++; foe.ko = 99; foe.push(me.face * 5, -5); audio.explode(); game.hitstop(0.25); mini.shake = 1.5; crowdHype = 2; for (let k = 0; k < 4; k++) burst(W * (0.2 + k * 0.2), floor() - 60, 20, ['#ff5a8a', '#6fe3ff', '#f2c14e', '#7dff9a'][k], 3); }
      if (!over && me.hp <= 0) { over = 'lose'; foe.wins++; me.ko = 99; audio.powerdown(); crowdHype = 1; }
      if (over) overT += dt;

      // ---- draw ----
      const g = mini.g, sh = mini.shake * 3, fl = floor();
      g.setTransform(1, 0, 0, 1, 0, 0);
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a0614'); bg.addColorStop(0.6, '#4a1426'); bg.addColorStop(1, '#14040c');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 2; i++) { const sx = W / 2 + Math.sin(t * 0.6 + i * 2.5) * W * 0.35; g.fillStyle = 'rgba(255,220,160,.07)'; g.beginPath(); g.moveTo(sx - 4, 0); g.lineTo(sx - 30, fl); g.lineTo(sx + 30, fl); g.lineTo(sx + 4, 0); g.fill(); }
      // the crowd: three rows that bounce, raise their arms when something happens, and wave signs
      for (const c of crowd) {
        const base = fl - 26 - (2 - c.row) * 12, jump = Math.max(0, Math.sin(t * (6 + crowdHype * 4) + c.ph)) * (1.5 + crowdHype * 3.5), x = c.x - 4, y = base - jump;
        g.fillStyle = c.col; g.fillRect(x - 3.5, y, 7, 14); g.beginPath(); g.arc(x, y - 3, 3.4, 0, 7); g.fill();
        if (crowdHype > 0.5) { g.fillRect(x - 5, y - 9, 1.6, 8); g.fillRect(x + 3.4, y - 9, 1.6, 8); }
        if (c.sign && c.row === 0) { g.fillStyle = '#e8e6e0'; g.fillRect(x - 17, y - 19 - jump * 0.5, 34, 11); g.fillStyle = '#1a0614'; g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.fillText(c.sign, x, y - 10.8 - jump * 0.5, 32); }
      }
      if (Math.random() < 0.06 + crowdHype * 0.1) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(Math.random() * W, fl - 20 - Math.random() * 40, 1.6, 0, 7); g.fill(); } // camera flashes
      // the ring
      g.fillStyle = '#26315a'; g.fillRect(0, fl, W, H - fl); g.fillStyle = '#3a4a80'; g.fillRect(0, fl, W, 2);
      for (const px of [wallL - 4, wallR() + 1]) { g.fillStyle = px < W / 2 ? '#c0283a' : '#2a5ac0'; g.fillRect(px, fl - 46, 3, 46); }
      for (let r = 0; r < 3; r++) { g.strokeStyle = ['#e8e6e0', '#c0283a', '#e8e6e0'][r]; g.lineWidth = 1; g.beginPath(); g.moveTo(wallL - 3, fl - 14 - r * 12); g.lineTo(wallR() + 3, fl - 14 - r * 12); g.stroke(); }
      mini.label('CRÍTICA EN DIRECTO', W / 2, fl + 9, 'rgba(242,193,78,.6)', 7);
      g.translate(Math.round((Math.random() - 0.5) * sh), Math.round((Math.random() - 0.5) * sh));
      for (const s of stars) { g.fillStyle = '#f2c14e'; g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.fillText('★', s.x, s.y + 4); }
      drawTrail(g, foe); drawCritic(g, foe); drawTrail(g, me); drawRobot(g, me);
      if (me.charge > 0) { g.strokeStyle = me.charge >= 1 ? '#fff' : '#6fe3ff'; g.lineWidth = 1.5; g.beginPath(); g.arc(me.p[1][0], me.p[1][1], 16 * S, -Math.PI / 2, -Math.PI / 2 + me.charge * 6.28); g.stroke(); }
      drawImpact(g, me); drawImpact(g, foe);
      for (const s of sparks) { g.fillStyle = s.col; g.globalAlpha = Math.min(1, s.life * 3); g.fillRect(s.x, s.y, s.size, s.size); } g.globalAlpha = 1;
      g.setTransform(1, 0, 0, 1, 0, 0);
      mini.drawTexts(dt);
      const bw = Math.min(110, W * 0.4); bar(6, bw, me, 'M0P-1', false); bar(W - 6 - bw, bw, foe, 'EL CRÍTICO', true);
      if (intro > 0) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, H / 2 - 22, W, 44); mini.label(intro > 0.7 ? `ASALTO ${round}` : '¡PELEA!', W / 2, H / 2 + 4, intro > 0.7 ? '#ffffff' : '#f2c14e', 14); }
      if (over) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, H / 2 - 20, W, 40); mini.label(over === 'win' ? '¡K.O.!' : 'DERROTA', W / 2, H / 2 + 4, over === 'win' ? '#f2c14e' : '#ff4d6a', 14); }
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.5})`; g.fillRect(0, 0, W, H); }
      return overT > (ui.fast ? 0.3 : 2.4);
    });
    if (me.wins >= 2) break;
    if (foe.wins >= 2) { // the match is lost: start again from round one, with a weaker critic
      losses++; game.prog && game.prog.deaths++; assist = Math.min(2, losses);
      ui.bark('narrador', losses === 1 ? 'El Crítico gana el combate. Repetimos desde el primer asalto.' : 'Le he quitado vida al Crítico. Que no se diga que no ayudo.');
      round = 1; setup(false); continue;
    }
    round++; ui.bark('narrador', over === 'win' ? `Asalto para M0P-1. Vamos al ${round}º.` : `Asalto para El Crítico. Vamos al ${round}º.`);
    setup(true);
  }
  ui.objective(''); mini.close();
  game.addScore(4000); ui.achieve('critic', 'Cinco estrellas', 'Ganar a El Crítico al mejor de tres');
  return losses;
}
