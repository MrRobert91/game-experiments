// The 2D layer: when the Narrator "runs out of 3D budget" the game drops to a
// low-res canvas with hand-typed pixel sprites. Three genres live here:
// a platformer, a shoot-'em-up and the backdrop of a turn-based battle.

const PAL = { w: '#e8e6e0', k: '#101418', c: '#6fe3ff', o: '#ff7a1a', a: '#b9b7b2', s: '#8a9098', r: '#e0304a', g: '#3a3f4a', y: '#f2c14e', p: '#ff8fc7', d: '#7a1020', b: '#5a3a1a', t: '#c9a36b' };
function sprite(rows) {
  const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (PAL[ch]) { g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}
const SPR = {
  robot: sprite(['.......o....', '..wwwwwwww..', '.wkkkkkkkkw.', '.wkckkkkckw.', '.wkckkkkckw.', '..wwwwwwww..', '....ssss....', '.awwwwwwwwa.', '.awwwccwwwa.', '.aoooooooow.', '..wwwwwwww..', '...wwwwww...', '....kkkk....', '....kkkk....']),
  cliche: sprite(['..rrrrrr..', '.rrrrrrrr.', 'rkkrrrrkkr', 'rwkrrrrwkr', 'rrrrrrrrrr', 'rrdkkkkdrr', '.rrrrrrrr.', '..rrrrrr..', '.kk....kk.', 'kkk....kkk']),
  piano: sprite(['kkkkkkkkkkkkkkkk', 'kggggggggggggggk', 'kkkkkkkkkkkkkkkk', 'krkkkkkkkkkkkrkk', 'kkkkkkkkkkkkkkkk', 'wkwkwwkwkwkwwkwk', 'wkwkwwkwkwkwwkwk', 'wwwwwwwwwwwwwwww', 'kkkkkkkkkkkkkkkk', '.kk..........kk.', '.kk..........kk.', '.yy..........yy.']),
  page: sprite(['.wwwwww.', '.wkkkww.', '.wwwwww.', '.wkkkkw.', '.wwwwww.', '.wkkwww.', '.wwwwww.', '........']),
  pelusa: sprite(['....y.......', '....s.......', '..pppppppp..', '.pppppppppp.', 'ppwkppppwkpp', 'pppppppppppp', '.ssssssssss.', '..kk....kk..']),
};

export class Mini2D {
  constructor(game) {
    this.game = game;
    this.cv = document.getElementById('c2d'); this.g = this.cv.getContext('2d');
    this.active = false;
    addEventListener('resize', () => this.active && this._size());
  }
  _size() {
    const a = innerWidth / innerHeight, base = 200;
    this.W = Math.round(a >= 1 ? Math.min(440, base * a) : base); this.H = Math.round(a >= 1 ? base : Math.min(440, base / a));
    this.cv.width = this.W; this.cv.height = this.H; this.g.imageSmoothingEnabled = false;
    // on a portrait phone the stick and button sit over the bottom of the picture: keep the action above them
    this.pad = this.game.input.isTouch && a < 1 ? Math.round(180 / (innerHeight / this.H)) : 0;
    this.top = Math.round(70 / (innerHeight / this.H)); // canvas rows hidden behind the HUD
  }
  open() { this.active = true; this._size(); this.cv.classList.remove('hidden'); document.body.classList.add('mode2d'); this.game.paused3d = true; this.shake = 0; this.texts = []; }
  close() { this.active = false; this.cv.classList.add('hidden'); document.body.classList.remove('mode2d'); this.game.paused3d = false; }
  /** run update(dt) every frame until it returns true */
  run(update) {
    return new Promise((res) => {
      let last = performance.now();
      const f = (now) => {
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = Math.max(last, now);
        this.game.mini2dFrames = (this.game.mini2dFrames || 0) + 1; // lets tests tell a running minigame from a frozen one
        this.shake = Math.max(0, this.shake - dt * 3);
        if (update(dt)) return res();
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
  }
  text(x, y, s, color = '#fff') { this.texts.push({ x, y, s, color, t: 0.9 }); }
  drawTexts(dt, ox = 0) {
    const g = this.g; g.font = 'bold 9px monospace'; g.textAlign = 'center';
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i]; t.t -= dt; t.y -= dt * 22;
      const hw = g.measureText(t.s).width / 2 + 2, x = Math.max(hw, Math.min(this.W - hw, t.x - ox)); // never cut off at the edges
      g.fillStyle = '#000'; g.fillText(t.s, x + 1, t.y + 1); g.fillStyle = t.color; g.fillText(t.s, x, t.y);
      if (t.t <= 0) this.texts.splice(i, 1);
    }
  }
  label(s, x, y, color = '#fff', size = 8, align = 'center') { const g = this.g; g.font = `bold ${size}px monospace`; g.textAlign = align; g.fillStyle = '#000'; g.fillText(s, x + 1, y + 1); g.fillStyle = color; g.fillText(s, x, y); }

  // ───────────────────────── platformer ─────────────────────────
  async platformer() {
    const { game } = this, { ui, input, audio } = game, T = 16, ROWS = 11;
    this.open();
    const solid = new Set(), key = (x, y) => x + ',' + y;
    const fill = (x0, x1, y0 = 9, y1 = 10) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) solid.add(key(x, y)); };
    fill(0, 17); fill(20, 33); fill(24, 27, 6, 6); fill(35, 35, 7, 7); fill(37, 53);
    fill(40, 41, 7, 7); fill(44, 51, 5, 5); // floating steps up to the upper door
    fill(56, 75); fill(73, 73, 8, 8); fill(74, 75, 7, 8); fill(79, 103);
    // second half (twice the level): moving platforms over a pit, springs, flying pages, a piano corridor
    fill(119, 136); fill(124, 126, 6, 6); fill(139, 139, 7, 8); fill(140, 160); fill(146, 152, 3, 3); fill(163, 166, 7, 8); fill(167, 199);
    fill(176, 177, 6, 8); fill(185, 186, 7, 8);
    const spikes = [[32, 8], [33, 8], [70, 8], [71, 8], [84, 8], [128, 8], [129, 8], [155, 8], [156, 8], [157, 8], [181, 8], [182, 8]];
    const movers = [{ x0: 105 * T, x1: 110 * T, y: 7 * T, w: 3 * T, ph: 0 }, { x0: 111 * T, x1: 116 * T, y: 6 * T, w: 3 * T, ph: 2.2 }].map((m) => ({ ...m, x: m.x0, dx: 0 }));
    const springs = [[143, 8], [170, 8]];
    const fliers0 = [[123, 4], [134, 5], [150, 2], [171, 4], [189, 5]];
    const coins0 = [[106, 5], [107, 5], [113, 4], [114, 4], [125, 4], [143, 2], [147, 1], [148, 1], [149, 1], [150, 1], [176, 4], [186, 5], [192, 6]];
    const coins = [[6, 6], [7, 6], [8, 6], [24, 4], [25, 4], [26, 4], [27, 4], [35, 5], [47, 3], [48, 3], [60, 6], [61, 6], [66, 6], [80, 6], [81, 6]].map(([x, y]) => ({ x: x * T + 4, y: y * T + 4, got: false }));
    const freshCoins = () => coins.concat(coins0.map(([x, y]) => ({ x: x * T + 4, y: y * T + 4, got: false }))).map((c) => ({ ...c, got: false }));
    const freshEnemies = () => [12, 30, 40, 60, 65, 82, 87, 122, 131, 145, 158, 172, 179, 190].map((x) => ({ x: x * T, y: 9 * T - 10, vx: -28, alive: true, t: 0 }));
    const freshThwomps = () => [38, 62, 68, 86, 141, 153, 168, 174, 183].map((x) => ({ x: x * T, y: 1 * T, y0: 1 * T, vy: 0, st: 'idle', t: 0 }));
    const freshFliers = () => fliers0.map(([x, y]) => ({ x: x * T, y0: y * T, y: y * T, t: Math.random() * 6, alive: true }));
    let allCoins = freshCoins(), enemies = freshEnemies(), thwomps = freshThwomps(), fliers = freshFliers();
    const doors = [{ x: 50 * T, y: 9 * T - 26, name: 'ABAJO', i: 0 }, { x: 50 * T, y: 5 * T - 26, name: 'ARRIBA', i: 1 }];
    const flagX = 193 * T, END = 200;
    let maxHp = 3, deaths = 0, over = 0;
    const P = { x: 24, y: 100, vx: 0, vy: 0, w: 10, h: 13, ground: false, coy: 0, buf: 0, face: 1, inv: 0, sq: 0, safe: 24, hp: maxHp };
    this.dbg = P;
    const isSolid = (px, py) => solid.has(key(Math.floor(px / T), Math.floor(py / T)));
    let camX = 0, pick = -1, done = false, t = 0, stuck = 0, falls = 0, fade = 0, stomps = 0;
    const said = new Set();
    const once = (id, fn) => { if (!said.has(id)) { said.add(id); fn(); } };
    audio.mood('chip');
    ui.objective('Llega a la bandera');
    ui.bark('narrador', 'Se me ha acabado el presupuesto 3D. Apáñate con esto.');
    ui.bark('robot', '¿Tengo píxeles? ¿Por qué tengo píxeles?');
    const hurt = (dir) => { if (P.inv > 0 || over) return; P.inv = 1.1; P.vx = dir * 130; P.vy = -190; P.hp--; audio.hurt(); this.shake = 0.5; game.buzz(40); this.text(P.x, P.y - 4, '¡AY!', '#ff6a6a'); game.robot.falls++; once('hurt', () => ui.bark('narrador', 'Tienes tres corazones. Si los pierdes, el nivel entero otra vez. Es la tradición.')); };
    // losing every heart restarts the whole 2D level, like the old days
    const restart = () => {
      deaths++; over = 0; game.prog && game.prog.deaths++;
      if (deaths === 2) { maxHp = 5; ui.bark('narrador', 'Dos veces. Te pongo cinco corazones. No se lo digas a los puristas.'); }
      else if (deaths === 1) ui.bark('narrador', 'Desde el principio. Así se hacían las cosas antes. Peor.');
      else ui.bark('narrador', ['Otra vez desde el principio. Lo estás disfrutando, ¿verdad?', 'Ya me sé el nivel de memoria. Y eso que lo hice yo.'][deaths % 2]);
      allCoins = freshCoins(); enemies = freshEnemies(); thwomps = freshThwomps(); fliers = freshFliers();
      Object.assign(P, { x: 24, y: 100, vx: 0, vy: 0, inv: 1, safe: 24, hp: maxHp }); camX = 0; pick = -1; fade = 1;
    };
    await this.run((dt) => {
      t += dt;
      const held = input.held, jump = input.action();
      let mx = input.move.x;
      if (ui.auto) { // bot
        mx = 1; const ahead = P.x + P.w + 10, feet = P.y + P.h + 4;
        const danger = !isSolid(ahead, feet) || isSolid(ahead, P.y + 6) || enemies.some((e) => e.alive && e.x > P.x && e.x - P.x < 34) || spikes.some(([sx]) => sx * T > P.x && sx * T - P.x < 26);
        if (P.ground && (danger || stuck > 0.5)) { P.buf = 0.1; stuck = 0; }
        if (ui.fast && t > 40 && !P.tp) { P.tp = true; P.x = flagX - 30; P.y = 100; camX = flagX - 120; }
      }
      if (t > 420 && !done && P.x < flagX - 40) { ui.bark('narrador', 'Vale, ya te llevo yo a la bandera.'); pick = Math.max(0, pick); camX = flagX - 80; P.x = flagX - 30; P.y = 60; P.vx = P.vy = 0; }
      if (over) { over -= dt; if (over <= 0) restart(); }
      else if (P.hp <= 0) { over = ui.fast ? 0.05 : 1.8; audio.powerdown(); this.shake = 1; game.buzz(120); }
      for (const m of movers) { const nx = m.x0 + (m.x1 - m.x0) * (0.5 - 0.5 * Math.cos(t * 1.1 + m.ph)); m.dx = nx - m.x; m.x = nx; }
      stuck = Math.abs(P.vx) < 5 ? stuck + dt : 0;
      if (jump && !over) P.buf = 0.12;
      P.buf -= dt; P.coy -= dt; P.inv -= dt; P.sq *= Math.exp(-dt * 10);
      if (Math.abs(mx) > 0.15 && P.inv < 0.8) { P.vx += mx * 900 * dt; P.face = mx > 0 ? 1 : -1; } else P.vx *= Math.exp(-dt * (P.ground ? 14 : 3));
      P.vx = Math.max(-115, Math.min(115, P.vx));
      P.vy = Math.min(380, P.vy + 900 * dt);
      if (P.buf > 0 && P.coy > 0) { P.vy = -305; P.buf = 0; P.coy = 0; P.sq = -0.35; audio.jump(); once('jump', () => { ui.bark('robot', '¿Puedo saltar? ¿Desde cuándo salto?'); ui.bark('narrador', 'Desde que esto es un plataformas.'); }); }
      if (!held && !ui.auto && P.vy < -110) P.vy = -110; // variable jump height
      // move X
      P.x += P.vx * dt;
      if (P.x < camX) P.x = camX;
      const dirx = Math.sign(P.vx);
      if (dirx && (isSolid(P.x + (dirx > 0 ? P.w : 0), P.y + 1) || isSolid(P.x + (dirx > 0 ? P.w : 0), P.y + P.h - 1))) { P.x = dirx > 0 ? Math.floor((P.x + P.w) / T) * T - P.w - 0.01 : Math.ceil(P.x / T) * T + 0.01; P.vx = 0; }
      // move Y
      P.y += P.vy * dt; const was = P.ground; P.ground = false;
      for (const m of movers) if (P.vy >= 0 && P.x + P.w > m.x && P.x < m.x + m.w && P.y + P.h >= m.y && P.y + P.h - P.vy * dt <= m.y + 2) { P.y = m.y - P.h; P.vy = 0; P.ground = true; P.coy = 0.1; P.x += m.dx; }
      for (const [sx, sy] of springs) if (P.vy > 0 && Math.abs(sx * T + 8 - P.x - 5) < 10 && P.y + P.h >= sy * T + 6 && P.y + P.h <= sy * T + 16) { P.vy = -480; P.sq = -0.5; audio.jump(); audio.coin(); this.text(sx * T + 8, sy * T, '¡BOING!', '#6fe3ff'); once('spring', () => ui.bark('narrador', 'Un muelle. Innovación pura.')); }
      if (P.vy > 0 && (isSolid(P.x + 1, P.y + P.h) || isSolid(P.x + P.w - 1, P.y + P.h))) { P.y = Math.floor((P.y + P.h) / T) * T - P.h; if (!was && P.vy > 150) P.sq = 0.3; P.vy = 0; P.ground = true; P.coy = 0.1; if (P.inv <= 0) P.safe = P.x; }
      else if (P.vy < 0 && (isSolid(P.x + 1, P.y) || isSolid(P.x + P.w - 1, P.y))) { P.y = Math.ceil(P.y / T) * T; P.vy = 0; }
      if (P.y > ROWS * T + 40 && !over) { falls++; game.robot.falls++; P.hp--; P.x = P.safe - 6 * Math.sign(P.vx || 1); P.y = 40; P.vx = P.vy = 0; P.inv = 1; audio.hurt(); if (falls === 1) ui.bark('narrador', 'El foso no lleva a ningún sitio. No dibujé el fondo.'); else if (falls === 3) ui.bark('narrador', 'Tres caídas. En el tráiler esto parecía más fácil.'); }
      // things
      for (const f of fliers) {
        if (!f.alive) continue;
        f.t += dt; f.x -= 22 * dt; f.y = f.y0 + Math.sin(f.t * 2.4) * 18;
        if (Math.abs(f.x - P.x) < 10 && Math.abs(f.y - P.y - 3) < 11) {
          if (P.vy > 40 && P.y + P.h < f.y + 6) { f.alive = false; P.vy = -240; audio.stomp(); game.addScore(150); this.text(f.x, f.y, '¡RECORTADO!', '#fff'); }
          else hurt(P.x < f.x ? -1 : 1);
        }
      }
      for (const c of allCoins) if (!c.got && Math.abs(c.x - P.x - 1) < 10 && Math.abs(c.y - P.y - 3) < 12) { c.got = true; audio.coin(); game.addScore(50); this.text(c.x, c.y, '+50', '#f2c14e'); once('coin', () => ui.achieve('coin', 'Coleccionista de relleno', 'Las páginas no sirven para nada')); }
      for (const e of enemies) {
        if (!e.alive) { e.t += dt; continue; }
        e.x += e.vx * dt;
        if (isSolid(e.x + (e.vx > 0 ? 10 : 0), e.y + 4) || !isSolid(e.x + (e.vx > 0 ? 10 : 0), e.y + 12)) e.vx *= -1;
        if (Math.abs(e.x - P.x) < 10 && Math.abs(e.y - P.y - 2) < 12) {
          if (P.vy > 40 && P.y + P.h < e.y + 8) { e.alive = false; P.vy = -230; audio.stomp(); stomps++; game.addScore(100); this.text(e.x + 5, e.y, ['¡TÓPICO!', '¡CLICHÉ!', '¡PLOF!'][stomps % 3], '#fff'); this.shake = 0.3; once('stomp', () => { ui.bark('narrador', 'Has pisado un cliché. Tranquilo, tengo más.'); ui.achieve('stomp', 'Crítico literario', 'Aplastar un cliché'); }); }
          else hurt(P.x < e.x ? -1 : 1);
        }
      }
      for (const w of thwomps) {
        w.t += dt;
        if (w.st === 'idle' && Math.abs(w.x + 8 - P.x - 5) < 26) { w.st = 'fall'; w.vy = 0; }
        else if (w.st === 'fall') { w.vy += 700 * dt; w.y += w.vy * dt; if (isSolid(w.x + 8, w.y + 13)) { w.y = Math.floor((w.y + 13) / T) * T - 12; w.st = 'rest'; w.t = 0; this.shake = 0.6; audio.thud(1); game.pianos++; once('thw', () => ui.bark('robot', 'Hasta en 2D hay pianos.')); } }
        else if (w.st === 'rest' && w.t > 1) w.st = 'rise';
        else if (w.st === 'rise') { w.y -= 40 * dt; if (w.y <= w.y0) { w.y = w.y0; w.st = 'idle'; } }
        if (w.st !== 'rise' && Math.abs(w.x + 8 - P.x - 5) < 12 && Math.abs(w.y + 6 - P.y - 6) < 12) hurt(P.x < w.x + 8 ? -1 : 1);
      }
      for (const [sx, sy] of spikes) if (Math.abs(sx * T + 8 - P.x - 5) < 11 && P.y + P.h > sy * T + 8 && P.y < sy * T + 16) { if (P.inv <= 0) { hurt(-P.face); P.vy = -240; } }
      if (P.x > 100 * T) once('half', () => { ui.bark('narrador', 'Mitad del nivel. Sí, hay otra mitad. Me sobraba un fin de semana.'); });
      if (pick < 0) {
        if (P.x > 40 * T) once('doors', () => { ui.bark('narrador', 'Dos puertas: arriba o abajo. Esta decisión sí cambia el nivel.'); });
        for (const d of doors) if (Math.abs(d.x + 8 - P.x - 5) < 9 && Math.abs(d.y + 13 - P.y - 6) < 14) { pick = d.i; fade = 1; audio.whoosh(); P.x = 57 * T; P.y = 9 * T - P.h; P.vx = P.vy = 0; P.safe = P.x; camX = 55 * T; ui.bark('robot', 'Es la misma pantalla.'); ui.bark('narrador', 'Es la misma pantalla con otra puerta detrás. Matiz.'); }
        if (P.x > 52 * T) P.x = 52 * T; // the level ends at the doors
      }
      if (P.x > flagX - 6 && !done) { done = true; t = 0; audio.chime(); game.addScore(1000); ui.achieve('flag', 'Tu trama está en otro género', 'Tocar una bandera porque sí'); }
      camX = Math.max(camX, Math.min(P.x - this.W * 0.38, END * T - this.W));
      fade = Math.max(0, fade - dt * 2);

      // ---- draw ----
      const g = this.g, W = this.W, H = this.H, oy = H - ROWS * T - this.pad, sh = this.shake * 3;
      g.setTransform(1, 0, 0, 1, 0, 0);
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1a1040'); sky.addColorStop(0.6, '#5a3a8a'); sky.addColorStop(1, '#ff9a6a');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff4c0'; g.fillRect(W - 60, Math.round(H * 0.34), 18, 18);
      for (let i = 0; i < 9; i++) { const hx = ((i * 97 - camX * 0.25) % (W + 120)) - 60; g.fillStyle = '#3a2468'; g.beginPath(); g.moveTo(hx, H); g.lineTo(hx + 50, H - 70 - (i % 3) * 22); g.lineTo(hx + 100, H); g.fill(); }
      for (let i = 0; i < 6; i++) { const cx = ((i * 131 - camX * 0.5) % (W + 100)) - 50; g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(cx, 30 + (i % 3) * 22 + oy * 0.3, 26, 6); g.fillRect(cx + 5, 26 + (i % 3) * 22 + oy * 0.3, 14, 4); }
      g.translate(Math.round(-camX + (Math.random() - 0.5) * sh), Math.round(oy + (Math.random() - 0.5) * sh));
      const x0 = Math.floor(camX / T) - 1, x1 = x0 + Math.ceil(W / T) + 2;
      for (let x = x0; x <= x1; x++) for (let y = 0; y < ROWS; y++) if (solid.has(key(x, y))) {
        const top = !solid.has(key(x, y - 1));
        g.fillStyle = top ? '#4fd08a' : '#7a4a2a'; g.fillRect(x * T, y * T, T, T);
        g.fillStyle = top ? '#2f9a62' : '#5a3418'; g.fillRect(x * T, y * T + (top ? 4 : 0), T, top ? 2 : 1); g.fillRect(x * T + ((x + y) % 2) * 8, y * T + 8, 1, 8);
        if (!top) { g.fillStyle = '#8f5a36'; g.fillRect(x * T + 3, y * T + 4, 4, 2); g.fillRect(x * T + 10, y * T + 11, 3, 2); }
      }
      for (const [sx, sy] of spikes) { g.fillStyle = '#d8dce6'; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(sx * T + k * 4, sy * T + 16); g.lineTo(sx * T + k * 4 + 2, sy * T + 8); g.lineTo(sx * T + k * 4 + 4, sy * T + 16); g.fill(); } }
      for (const d of doors) { g.fillStyle = '#2a1a3a'; g.fillRect(d.x, d.y, 16, 26); g.fillStyle = d.i ? '#6fe3ff' : '#ff8fc7'; g.fillRect(d.x + 2, d.y + 2, 12, 24); g.fillStyle = '#101418'; g.fillRect(d.x + 10, d.y + 13, 2, 2); this.label(d.name, d.x + 8, d.y - 4, '#fff', 7); }
      for (const m of movers) { g.fillStyle = '#c9a36b'; g.fillRect(Math.round(m.x), m.y, m.w, 6); g.fillStyle = '#5a3a1a'; g.fillRect(Math.round(m.x), m.y + 6, m.w, 2); }
      for (const [sx, sy] of springs) { g.fillStyle = '#e0304a'; g.fillRect(sx * T + 2, sy * T + 8, 12, 4); g.fillStyle = '#aab0ba'; for (let k = 0; k < 3; k++) g.fillRect(sx * T + 4, sy * T + 12 + k * 1.5, 8, 1); }
      for (const f of fliers) if (f.alive) { g.save(); g.translate(Math.round(f.x), Math.round(f.y)); g.rotate(Math.sin(f.t * 5) * 0.4); g.drawImage(SPR.page, -4, -4, 10, 10); g.restore(); }
      this.label('MITAD', 101 * T, 7 * T, '#f2c14e', 8); this.label('(hay más)', 101 * T, 7 * T + 9, '#fff', 6);
      for (const c of allCoins) if (!c.got) g.drawImage(SPR.page, c.x, c.y + Math.round(Math.sin(t * 5 + c.x) * 2));
      for (const w of thwomps) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(w.x + 7, 0, 1, w.y); g.drawImage(SPR.piano, w.x, Math.round(w.y)); }
      for (const e of enemies) { if (e.alive) g.drawImage(SPR.cliche, Math.round(e.x), e.y + (Math.floor(t * 8) % 2)); else if (e.t < 0.4) g.drawImage(SPR.cliche, Math.round(e.x), e.y + 7, 10, 3); }
      g.fillStyle = '#e8e6e0'; g.fillRect(flagX, 3 * T, 2, 6 * T); g.fillStyle = '#f2c14e'; g.beginPath(); g.moveTo(flagX + 2, 3 * T); g.lineTo(flagX + 22, 3 * T + 7); g.lineTo(flagX + 2, 3 * T + 14); g.fill();
      this.label('MUNDO 1-1', 5 * T, 3 * T, '#fff', 10); this.label('(el único)', 5 * T, 3 * T + 11, '#f2c14e', 7);
      if (P.inv <= 0 || Math.floor(t * 20) % 2) {
        const sw = 12 * (1 + P.sq * 0.6), shh = 14 * (1 - P.sq);
        g.save(); g.translate(Math.round(P.x + 5), Math.round(P.y + P.h)); g.scale(P.face, 1); g.drawImage(SPR.robot, -sw / 2, -shh, sw, shh); g.restore();
      }
      this.drawTexts(dt);
      g.setTransform(1, 0, 0, 1, 0, 0);
      { const hy = this.top + 8; g.font = 'bold 10px monospace'; g.textAlign = 'left'; for (let i = 0; i < maxHp; i++) { g.fillStyle = '#000'; g.fillText('♥', 7 + i * 11, hy + 1); g.fillStyle = i < P.hp ? '#ff4d6a' : '#3a2a40'; g.fillText('♥', 6 + i * 11, hy); } }
      if (over) { g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(0, H / 2 - 22, W, 44); this.label('GAME OVER', W / 2, H / 2 - 2, '#ff4d6a', 12); this.label('(desde el principio)', W / 2, H / 2 + 12, '#fff', 7); }
      if (this.pad) { g.fillStyle = '#3a2010'; g.fillRect(0, H - this.pad, W, this.pad); g.fillStyle = '#2a1608'; for (let i = 0; i < W; i += 16) g.fillRect(i + ((i / 16) % 2) * 6, H - this.pad + 6 + (i % 3) * 9, 5, 2); }
      if (done) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, H / 2 - 26, W, 52); this.label('GRACIAS, M0P-1.', W / 2, H / 2 - 6, '#fff', 10); this.label('PERO TU TRAMA ESTÁ EN OTRO GÉNERO.', W / 2, H / 2 + 10, '#f2c14e', Math.min(9, W / 24)); }
      if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
      return done && t > (ui.fast ? 0.2 : 3);
    });
    ui.clearBarks(); ui.objective('');
    this.close();
    return Math.max(0, pick);
  }

  // ───────────────────────── shoot-'em-up ─────────────────────────
  async shmup() {
    const { game } = this, { ui, input, audio } = game;
    this.open();
    const W = this.W, H = this.H;
    const P = { x: W / 2, y: H - 36 - this.pad, inv: 0, fire: 0, bomb: 0 };
    const shots = [], foes = [], bullets = [], stars = Array.from({ length: 50 }, () => [Math.random() * W, Math.random() * H, 20 + Math.random() * 90]);
    let t = 0, spawn = 0, dignity = 3, boss = null, done = false, endT = 0, kills = 0, flash = 0;
    audio.mood('chip');
    ui.objective('Sobrevive a la caída');
    ui.bark('narrador', 'El resto del puente no lo modelé. Mientras caes, un matamarcianos.');
    ui.bark('robot', '¿Por qué caigo hacia arriba?');
    ui.bark('narrador', 'El nivel estaba al revés y ya no lo toco.');
    const boom = (x, y, n = 8, col = '#ffd24a') => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 20 + Math.random() * 90; bullets.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, fx: 0.5, col }); } };
    const hurt = () => { if (P.inv > 0) return; P.inv = 1.4; dignity--; audio.hurt(); this.shake = 0.7; game.buzz(50); game.robot.falls++; this.text(P.x, P.y - 12, 'DIGNIDAD ' + dignity, '#ff6a6a'); if (dignity === 0) ui.bark('narrador', 'Dignidad a cero. No pasa nada, sigue bajando en negativo.'); };
    await this.run((dt) => {
      t += dt; flash = Math.max(0, flash - dt * 3);
      let mx = input.move.x, my = input.move.y; const bomb = input.action();
      if (ui.auto) { mx = Math.sin(t * 1.7); my = 0; if (ui.fast) { if (t > 9 && !boss) t = 27; if (boss && boss.t > 3) boss.hp = 0; } }
      P.x = Math.max(8, Math.min(W - 8, P.x + mx * 140 * dt)); P.y = Math.max(this.top + 76, Math.min(H - 14 - this.pad, P.y + my * 120 * dt));
      P.inv -= dt; P.fire -= dt; P.bomb -= dt;
      if (P.fire <= 0) { P.fire = 0.14; shots.push({ x: P.x - 3, y: P.y - 8 }, { x: P.x + 3, y: P.y - 8 }); if (Math.floor(t * 7) % 2) audio.shoot(); }
      if (bomb && P.bomb <= 0) { P.bomb = 3.5; flash = 1; audio.explode(); this.shake = 1; this.text(P.x, P.y - 20, '¡ESPUMA!', '#6fe3ff'); bullets.length = 0; for (const f of foes) f.hp -= 6; if (boss) boss.hp -= 6; }
      // spawns
      spawn -= dt;
      if (!boss && spawn <= 0 && !done) {
        spawn = t < 10 ? 0.7 : 0.5;
        const r = Math.random();
        if (t < 8 || r < 0.4) { foes.push({ k: 'piano', x: 12 + Math.random() * (W - 24), y: -14, vy: 50 + Math.random() * 50, hp: 2, w: 16 }); game.pianos++; }
        else if (r < 0.75) foes.push({ k: 'cliche', x: Math.random() * W, y: -10, vy: 45, hp: 1, w: 10, ph: Math.random() * 6 });
        else foes.push({ k: 'hole', x: 20 + Math.random() * (W - 40), y: -20, vy: 26, hp: 7, w: 22 });
        if (t > 26) { boss = { x: W / 2, y: -40, hp: 60, max: 60, t: 0 }; ui.clearBarks(); ui.bark('narrador', '¡EL DEADLINE! El único enemigo que me da miedo a mí.'); audio.alarm(); }
      }
      for (const s of shots) s.y -= 260 * dt;
      for (const f of foes) {
        f.y += f.vy * dt; if (f.k === 'cliche') f.x += Math.sin(t * 3 + f.ph) * 60 * dt;
        for (const s of shots) if (!s.dead && Math.abs(s.x - f.x) < f.w / 2 + 2 && Math.abs(s.y - f.y) < f.w / 2 + 2) { s.dead = true; f.hp--; }
        if (f.hp <= 0) { f.dead = true; kills++; boom(f.x, f.y, 6, f.k === 'hole' ? '#b06aff' : '#ffd24a'); audio.stomp(); game.addScore(f.k === 'hole' ? 300 : 100); this.text(f.x, f.y, f.k === 'hole' ? 'AGUJERO DE GUION TAPADO' : f.k === 'piano' ? 'DO-RE-¡MI!' : '¡PLOF!', '#fff'); if (kills === 5) ui.achieve('shmup', 'Fumigador de tópicos', 'Reventar cinco cosas con pompas'); }
        else if (Math.abs(f.x - P.x) < f.w / 2 + 4 && Math.abs(f.y - P.y) < f.w / 2 + 5) { hurt(); f.dead = true; boom(f.x, f.y, 5); }
        if (f.y > H + 30) f.dead = true;
      }
      if (boss) {
        boss.t += dt; boss.y = Math.min(this.top + 44, boss.y + 40 * dt);
        if (boss.t > 45 && boss.hp > 0) { boss.hp = 0; this.text(boss.x, boss.y + 30, '¡SE LE PASÓ EL PLAZO!', '#fff'); } boss.x = W / 2 + Math.sin(boss.t * 0.9) * (W / 2 - 34);
        for (const s of shots) if (!s.dead && Math.abs(s.x - boss.x) < 22 && Math.abs(s.y - boss.y) < 22) { s.dead = true; boss.hp--; boss.hit = 0.08; }
        boss.hit = (boss.hit || 0) - dt;
        if (Math.floor(boss.t / 0.8) !== Math.floor((boss.t - dt) / 0.8)) for (const a of [-0.35, 0, 0.35]) { const d = Math.atan2(P.y - boss.y, P.x - boss.x) + a; bullets.push({ x: boss.x, y: boss.y + 14, vx: Math.cos(d) * 80, vy: Math.sin(d) * 80, col: '#ff4d5e', bad: true }); }
        if (Math.floor(boss.t / 3.2) !== Math.floor((boss.t - dt) / 3.2)) { for (let i = 0; i < 12; i++) bullets.push({ x: boss.x, y: boss.y, vx: Math.cos(i * 0.5236) * 60, vy: Math.sin(i * 0.5236) * 60, col: '#ffb030', bad: true }); this.text(boss.x, boss.y + 30, ['¡PARA AYER!', '¡ENTREGA YA!', '¿CÓMO VAS?'][Math.floor(boss.t / 3.2) % 3], '#ffb030'); }
        if (boss.hp <= 0 && !done) { done = true; for (let i = 0; i < 6; i++) boom(boss.x + (Math.random() - 0.5) * 40, boss.y + (Math.random() - 0.5) * 40, 14, i % 2 ? '#ff4d5e' : '#ffd24a'); audio.explode(); this.shake = 1.5; flash = 1; game.addScore(5000); bullets.forEach((b) => (b.bad = false)); ui.clearBarks(); ui.bark('narrador', 'Has matado al Deadline. Ojalá fuera tan fácil.'); ui.achieve('deadline', 'Fuera de plazo', 'Derrotar al único enemigo real'); boss = null; }
      }
      for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.fx !== undefined) { b.fx -= dt; if (b.fx <= 0) b.dead = true; } if (b.bad && Math.abs(b.x - P.x) < 5 && Math.abs(b.y - P.y) < 6) { hurt(); b.dead = true; } if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) b.dead = true; }
      for (const arr of [shots, foes, bullets]) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].dead || arr[i].y < -30) arr.splice(i, 1);
      if (done) endT += dt;

      // ---- draw ----
      const g = this.g, sh = this.shake * 3;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#07061a'; g.fillRect(0, 0, W, H);
      for (const s of stars) { s[1] = (s[1] + s[2] * dt) % H; g.fillStyle = s[2] > 70 ? '#fff' : '#6a6aa0'; g.fillRect(s[0], s[1], 1, s[2] > 70 ? 3 : 1); }
      g.translate(Math.round((Math.random() - 0.5) * sh), Math.round((Math.random() - 0.5) * sh));
      for (const f of foes) {
        if (f.k === 'piano') g.drawImage(SPR.piano, Math.round(f.x - 8), Math.round(f.y - 6));
        else if (f.k === 'cliche') g.drawImage(SPR.cliche, Math.round(f.x - 5), Math.round(f.y - 5));
        else { g.fillStyle = '#2a0a4a'; g.beginPath(); g.arc(f.x, f.y, 11, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(f.x + Math.cos(t * 4) * 2, f.y + Math.sin(t * 4) * 2, 7, 0, 7); g.fill(); g.strokeStyle = '#b06aff'; g.beginPath(); g.arc(f.x, f.y, 11, t * 3, t * 3 + 4); g.stroke(); }
      }
      if (boss) {
        const bx = Math.round(boss.x), by = Math.round(boss.y);
        g.fillStyle = boss.hit > 0 ? '#fff' : '#e8e6e0'; g.beginPath(); g.arc(bx, by, 22, 0, 7); g.fill();
        g.strokeStyle = '#e0304a'; g.lineWidth = 3; g.beginPath(); g.arc(bx, by, 22, 0, 7); g.stroke(); g.lineWidth = 1;
        g.fillStyle = '#101418'; for (let i = 0; i < 12; i++) g.fillRect(bx + Math.cos(i * 0.5236) * 18 - 1, by + Math.sin(i * 0.5236) * 18 - 1, 2, 2);
        g.strokeStyle = '#101418'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(boss.t * 5) * 15, by + Math.sin(boss.t * 5) * 15); g.moveTo(bx, by); g.lineTo(bx + Math.cos(boss.t * 0.8) * 10, by + Math.sin(boss.t * 0.8) * 10); g.stroke(); g.lineWidth = 1;
        g.fillStyle = '#e0304a'; g.fillRect(bx - 12, by - 9, 8, 3); g.fillRect(bx + 4, by - 9, 8, 3);
        const hb = this.top + 10; g.fillStyle = '#300'; g.fillRect(W / 2 - 60, hb, 120, 5); g.fillStyle = '#e0304a'; g.fillRect(W / 2 - 60, hb, 120 * Math.max(0, boss.hp / boss.max), 5); this.label('EL DEADLINE', W / 2, hb - 2, '#fff', 7);
      }
      g.fillStyle = '#9fefff'; for (const s of shots) { g.beginPath(); g.arc(s.x, s.y, 2, 0, 7); g.fill(); }
      for (const b of bullets) { g.fillStyle = b.col; g.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, b.bad ? 4 : 2, b.bad ? 4 : 2); }
      if (P.inv <= 0 || Math.floor(t * 20) % 2) { g.drawImage(SPR.robot, Math.round(P.x - 6), Math.round(P.y - 7)); g.fillStyle = '#6fe3ff'; g.fillRect(P.x - 2, P.y + 7, 4, 2 + Math.floor(t * 30) % 3); }
      this.drawTexts(dt);
      g.setTransform(1, 0, 0, 1, 0, 0);
      this.label('DIGNIDAD ' + dignity, W / 2, H - 16, dignity > 0 ? '#fff' : '#ff6a6a', 7);
      this.label(P.bomb <= 0 ? 'ESPUMA LISTA' : 'espuma…', W / 2, H - 6, P.bomb <= 0 ? '#6fe3ff' : '#667', 7);
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.8})`; g.fillRect(0, 0, W, H); }
      return done && endT > (ui.fast ? 0.2 : 2.6);
    });
    ui.clearBarks(); ui.objective('');
    this.close();
    return dignity;
  }

  // ───────────────────────── turn-based battle backdrop ─────────────────────────
  /** draws the battle scene until stop() is called; state.hit triggers damage numbers */
  battleScene(state) {
    this.open();
    let t = 0, lay = null;
    const SW = 230, SH = 146, HZ = 88; // stage in its own units: fighters on top, each name plate right under its fighter
    this.run((dt) => {
      t += dt;
      const g = this.g, W = this.W, H = this.H, sh = this.shake * 3;
      // fit the stage between the HUD and the battle menu, whatever the screen shape
      const k = H / innerHeight, menu = document.getElementById('rpg');
      const mr = menu && !menu.classList.contains('hidden') ? menu.getBoundingClientRect() : null;
      const topU = document.body.classList.contains('modal') ? 4 : this.top + 2;
      if (mr) state.botU = Math.min(state.botU ?? Infinity, mr.top * k - 3); // once the menu has claimed space the stage never grows back under it
      const botU = state.botU ?? H - 4;
      const want = { s: Math.max(0.4, Math.min((botU - topU) / SH, W / SW, 2)) };
      want.ox = (W - SW * want.s) / 2; want.oy = topU + Math.max(0, (botU - topU - SH * want.s) / 2);
      if (!lay) lay = { ...want }; else for (const key in want) lay[key] += (want[key] - lay[key]) * Math.min(1, dt * 8);
      const { s: sc, ox, oy } = lay, hzS = oy + HZ * sc;
      state.fx = ox + 168 * sc; state.fy = oy + 40 * sc; // where damage numbers pop (screen units)

      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#12082e'; g.fillRect(0, 0, W, H);
      const bg = g.createLinearGradient(0, 0, 0, hzS); bg.addColorStop(0, '#12082e'); bg.addColorStop(1, '#4a1a5a');
      g.fillStyle = bg; g.fillRect(0, 0, W, hzS); g.fillStyle = '#1a1030'; g.fillRect(0, hzS, W, H - hzS);
      g.strokeStyle = 'rgba(255,90,138,.5)';
      for (let i = 0; i < 9; i++) { const y = hzS + Math.pow(i / 8, 2) * (H - hzS); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(W / 2 + i * 14, hzS); g.lineTo(W / 2 + i * 70, H); g.stroke(); }
      g.setTransform(sc, 0, 0, sc, ox + Math.round((Math.random() - 0.5) * sh), oy + Math.round((Math.random() - 0.5) * sh));

      // the foe (right)
      const ex = 168, ey = HZ - 6 + Math.sin(t * 2) * 2, fl = state.foeFlash > 0 && Math.floor(t * 30) % 2;
      state.foeFlash -= dt;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(ex, HZ + 14, 30, 6, 0, 0, 7); g.fill();
      g.strokeStyle = '#2a2d35'; g.lineWidth = 5; g.beginPath(); g.moveTo(ex, ey - 56); g.quadraticCurveTo(ex - 50, ey - 74 + Math.sin(t * 3) * 6, ex - 46, ey - 30); g.stroke(); g.lineWidth = 1;
      g.fillStyle = '#15161c'; g.fillRect(ex - 56, ey - 32, 20, 7);
      g.fillStyle = fl ? '#fff' : (state.foeColor || '#15161c'); g.fillRect(ex - 24, ey - 50, 48, 62); g.fillRect(ex - 20, ey - 56, 40, 6);
      g.fillStyle = '#e0304a'; g.fillRect(ex - 24, ey - 40, 48, 2); g.fillRect(ex - 24, ey, 48, 2);
      g.fillStyle = '#8a9098'; g.fillRect(ex - 12, ey - 34, 24, 24); g.fillStyle = '#ff2a2a'; g.fillRect(ex - 8, ey - 30, 16, 16); g.fillStyle = '#fff'; g.fillRect(ex - 5, ey - 27, 4, 4);
      g.fillStyle = '#101418'; g.fillRect(ex - 30, ey + 6, 10, 10); g.fillRect(ex + 20, ey + 6, 10, 10);
      // the hero (left)
      const lunge = state.heroLunge > 0 ? 30 : 0, hx = 60, hy = HZ + 22 + Math.abs(Math.sin(t * 3)) * -2 + (lunge ? -6 : 0);
      state.heroLunge -= dt;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(hx + lunge, HZ + 23, 16, 4, 0, 0, 7); g.fill();
      g.drawImage(SPR.robot, Math.round(hx - 18 + lunge), Math.round(hy - 42), 36, 42);
      if (state.cone) { g.fillStyle = '#ff5a1a'; g.beginPath(); g.moveTo(hx - 34, HZ + 22); g.lineTo(hx - 27, HZ - 2); g.lineTo(hx - 20, HZ + 22); g.fill(); g.fillStyle = '#fff'; g.fillRect(hx - 30, HZ + 8, 6, 3); }
      if (state.wild) { const wy = HZ + 6 + Math.abs(Math.sin(t * 6)) * -6; g.drawImage(SPR.pelusa, 106, Math.round(wy), 24, 16); }

      // name plates, each directly under its own fighter, with a little tab pointing up at it
      const plate = (cx, name, line2, col) => {
        const x = cx - 52, y = HZ + 30;
        g.fillStyle = '#1c2a8c'; g.beginPath(); g.moveTo(cx - 6, y); g.lineTo(cx, y - 6); g.lineTo(cx + 6, y); g.fill();
        g.fillRect(x, y, 104, 26); g.strokeStyle = '#fff'; g.strokeRect(x + 0.5, y + 0.5, 103, 25);
        this.label(name, x + 6, y + 11, '#fff', 8, 'left'); this.label(line2, x + 6, y + 22, col, 8, 'left');
      };
      plate(hx, `M0P-1  Nv ${state.lvl || 1}`, 'PV 7/7  PM 0', '#9fefff');
      plate(ex, 'EL ASPIRADOR', 'PV ' + state.foeHp.toLocaleString('es-ES'), '#ff8a8a');

      g.setTransform(1, 0, 0, 1, 0, 0);
      this.drawTexts(dt);
      return state.stop;
    });
  }
}
