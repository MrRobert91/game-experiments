const $ = (s) => document.querySelector(s);
const NAMES = { narrador: 'NARRADOR', robot: 'M0P-1', pelusa: 'PELUSA', villano: 'EL ASPIRADOR', creador: 'EL CREADOR', sistema: 'SISTEMA' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class UI {
  constructor(game) {
    this.game = game;
    this.auto = null; // 'A' | 'B' → test autopilot picks the first / last option
    this.fast = false; // autopilot also compresses every wait (smoke test); otherwise it plays at human pace
    this.el = { dialog: $('#dialog'), who: $('#dialog .who'), text: $('#dialog .text'), choices: $('#choices'), note: $('#note'), hud: $('#hud'), sub: $('#subtitle'),
      chapter: $('#chapter'), fade: $('#fade'), touch: $('#touch'), fake: $('#fake'), reveal: $('#reveal'), obj: $('#objective-text'), awFill: $('#awareness-fill'), awNum: $('#awareness-num') };
    this.toastQ = []; this.toastBusy = false; this.achieved = new Set(); this.skips = 0; this.names = { ...NAMES };
    this._advance = null; this.blocking = 0; this.barkQ = []; this.barkBusy = false; this.aware = 0;
    addEventListener('pointerdown', (e) => {
      if (!this._advance) return;
      if (e.target.closest('button')) return;
      this._advance();
    });
  }
  wait(ms) { return wait(this.fast ? Math.min(ms, 60) : ms); }
  /** how long the autopilot "thinks" before answering a prompt */
  botDelay(ms) { return wait(this.fast ? 40 : ms); }

  _block(on) {
    this.blocking += on ? 1 : -1;
    const b = this.blocking > 0;
    this.game.input.enabled = !b;
    this.el.touch.classList.toggle('hidden', b || !this.game.input.isTouch || !this.controls);
  }
  showControls(on) { this.controls = on; this.el.touch.classList.toggle('hidden', !on || !this.game.input.isTouch || this.blocking > 0); }

  /** blocking line of dialogue with typewriter; resolves when the player advances */
  async say(speaker, text, { shake = false } = {}) {
    const { dialog, who, text: tx } = this.el;
    this._block(true);
    dialog.className = `sp-${speaker}` + (shake ? ' shake' : '');
    who.textContent = this.names[speaker]; tx.textContent = '';
    this.game.onSpeak && this.game.onSpeak(speaker);
    if (this.fast) { tx.textContent = text; await wait(25); }
    else {
      let i = 0, skip = false;
      this.game.input.advance();
      await new Promise((res) => {
        this._advance = () => { if (i < text.length) { skip = true; this.skips++; } else res(); };
        const tick = () => {
          if (this.game.input.advance()) this._advance();
          if (i < text.length) {
            if (skip) i = text.length; else {
              i += 1;
              const ch = text[i - 1];
              if (i % 2 === 0 && ch !== ' ') this.game.audio.blip(speaker);
              if (!skip && '.,!?…:'.includes(ch) && i < text.length) { tx.textContent = text.slice(0, i); this._t = setTimeout(tick, ch === ',' ? 90 : 190); return; }
            }
            tx.textContent = text.slice(0, i);
            if (i >= text.length) { dialog.classList.add('done'); if (this.auto) setTimeout(res, 350); }
          }
          this._t = setTimeout(tick, i < text.length ? 22 : 50);
        };
        tick();
      });
      clearTimeout(this._t); this._advance = null; this.game.audio.ui();
    }
    dialog.className = 'hidden';
    this._block(false);
  }

  /** non-blocking subtitle shown while the player keeps playing */
  bark(speaker, text, dur = 0) {
    this.barkQ.push({ speaker, text, dur: dur || 1400 + text.length * 48 });
    if (!this.barkBusy) this._nextBark();
  }
  async _nextBark() {
    const b = this.barkQ.shift();
    if (!b) { this.barkBusy = false; return; }
    this.barkBusy = true;
    const el = this.el.sub;
    el.className = `sp-${b.speaker}`; el.firstElementChild.textContent = this.names[b.speaker]; el.lastElementChild.textContent = b.text;
    this.game.onSpeak && this.game.onSpeak(b.speaker);
    for (let i = 0; i < 5; i++) setTimeout(() => this.game.audio.blip(b.speaker), i * 60);
    await wait(this.fast ? 300 : b.dur);
    el.classList.add('hidden');
    await wait(this.fast ? 30 : 250);
    this._nextBark();
  }
  clearBarks() { this.barkQ.length = 0; }
  async barksDone() { while (this.barkBusy) await wait(100); }

  async choose(prompt, a, b) {
    const el = this.el.choices, cards = [...el.querySelectorAll('.card')];
    this._block(true); this.modal(true);
    el.querySelector('.prompt').textContent = prompt;
    cards[0].lastElementChild.textContent = a; cards[1].lastElementChild.textContent = b;
    cards.forEach((c) => (c.className = 'card'));
    el.classList.remove('hidden');
    this.game.audio.chime();
    let pick;
    if (this.auto) { await this.botDelay(900); pick = this.auto === 'B' ? 1 : 0; }
    else pick = await new Promise((res) => {
      const done = (i) => { removeEventListener('keydown', key); cards.forEach((c) => (c.onclick = null)); res(i); };
      const key = (e) => { if (e.code === 'Digit1' || e.code === 'Numpad1') done(0); if (e.code === 'Digit2' || e.code === 'Numpad2') done(1); };
      setTimeout(() => { addEventListener('keydown', key); cards.forEach((c, i) => (c.onclick = () => done(i))); }, 450);
    });
    this.game.audio.choice();
    cards[pick].classList.add('picked'); cards[1 - pick].classList.add('dropped');
    await this.wait(900);
    el.classList.add('hidden'); this.modal(false);
    this._block(false);
    this.game.input.advance(); this.game.input.action();
    return pick;
  }

  async note(html, button = 'Seguir') {
    const el = this.el.note;
    this._block(true); this.modal(true);
    el.querySelector('.body').innerHTML = html;
    const btn = el.querySelector('.btn'); btn.textContent = button;
    el.classList.remove('hidden'); el.querySelector('article').scrollTop = 0;
    if (this.auto) await this.botDelay(1200);
    else await new Promise((res) => {
      const done = () => { removeEventListener('keydown', key); btn.onclick = null; res(); };
      const key = (e) => { if (e.code === 'Enter' || e.code === 'Space') done(); };
      setTimeout(() => { btn.onclick = done; addEventListener('keydown', key); }, 600);
    });
    this.game.audio.ui();
    el.classList.add('hidden'); this.modal(false);
    this._block(false);
    this.game.input.advance(); this.game.input.action();
  }

  // ----- juice -----
  pop(x, y, text, color, big) {
    const el = document.createElement('span');
    el.className = 'pop' + (big ? ' big' : ''); el.textContent = text; el.style.color = color;
    el.style.left = Math.max(40, Math.min(innerWidth - 40, x)) + 'px'; el.style.top = Math.max(120, Math.min(innerHeight - 150, y)) + 'px';
    document.getElementById('pops').appendChild(el);
    setTimeout(() => el.remove(), big ? 1300 : 900);
  }
  score(n) { const b = document.querySelector('#score b'); b.textContent = n.toLocaleString('es-ES'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  /** absurd achievement toast; each id only once */
  achieve(id, title, desc = '') {
    if (this.achieved.has(id)) return;
    this.achieved.add(id); this.toastQ.push([title, desc]);
    if (!this.toastBusy) this._nextToast();
  }
  async _nextToast() {
    const t = this.toastQ.shift(); if (!t) { this.toastBusy = false; return; }
    this.toastBusy = true;
    const el = document.getElementById('toast');
    el.querySelector('b').textContent = t[0]; el.querySelector('span').textContent = t[1];
    el.classList.remove('hidden'); this.game.audio.trophy();
    await wait(this.fast ? 200 : 3000); el.classList.add('hidden'); await wait(this.fast ? 50 : 450);
    this._nextToast();
  }
  /** "press to feel": the meter fills whether you mash or not */
  async qte(text, button, selfLine) {
    const el = document.getElementById('qte'), fill = el.querySelector('i'), btn = el.querySelector('button');
    this._block(true); this.modal(true);
    el.querySelector('p').textContent = text; btn.textContent = button; fill.style.width = '0%'; el.classList.remove('hidden');
    let v = 0, presses = 0, idle = 0;
    if (this.fast) await wait(60);
    else await new Promise((res) => {
      const hit = () => { v += 9; presses++; idle = 0; this.game.audio.blip('pelusa'); this.game.gfx.shake(0.08); };
      btn.onclick = hit;
      const key = (e) => { if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) hit(); };
      addEventListener('keydown', key);
      const iv = setInterval(() => {
        idle += 0.1; if (idle > 2.2) v += 2.5; else v = Math.max(0, v - 0.6);
        fill.style.width = Math.min(100, v) + '%';
        if (v >= 100) { clearInterval(iv); removeEventListener('keydown', key); btn.onclick = null; res(); }
      }, 100);
    });
    el.classList.add('hidden'); this.modal(false); this._block(false); this.game.input.advance(); this.game.input.action();
    return presses;
  }
  /** retro battle menu: returns index of chosen option */
  async rpgMenu(log, options) {
    const el = document.getElementById('rpg'), lg = el.querySelector('.log'), menu = el.querySelector('.menu');
    // the buttons go in straight away but stay invisible while the log types, so the box never changes height under the player
    if (options) { menu.innerHTML = options.map((o, i) => `<button data-i="${i}" class="${options.length === 1 ? 'wide' : ''}">${o}</button>`).join(''); menu.classList.add('pending'); }
    else if (!menu.children.length) menu.innerHTML = '';
    el.classList.remove('hidden');
    await this.rpgLog(log);
    if (!options) return -1;
    this._block(true);
    menu.classList.remove('pending');
    let pick = 0;
    if (this.auto) { await this.botDelay(700); pick = this.auto === 'B' ? options.length - 1 : 0; }
    else pick = await new Promise((res) => menu.querySelectorAll('button').forEach((b) => (b.onclick = () => res(+b.dataset.i))));
    menu.classList.add('pending'); this.game.audio.ui(); this._block(false); this.game.input.advance(); this.game.input.action();
    return pick;
  }
  async rpgLog(text) {
    const lg = document.querySelector('#rpg .log');
    if (this.fast) { lg.textContent = text; await wait(20); return; }
    for (let i = 1; i <= text.length; i++) { lg.textContent = text.slice(0, i); if (i % 3 === 0) this.game.audio.blip('sistema'); await wait(16); }
    await wait(900);
  }
  rpgHide() { const el = document.getElementById('rpg'); el.classList.add('hidden'); el.querySelector('.menu').innerHTML = ''; }
  async shop() {
    const el = this.el.fake;
    el.className = 'dark';
    el.innerHTML = `<div class="win"><header>Tienda de la trama</header><div class="c"><i style="background:#f2a52e">€</i><div><b>Final verdadero (DLC)</b><br/>Desbloquea el final que el Narrador no quiere que veas. Incluye un sombrero. <b>4,99 €</b></div></div><footer><button>No, gracias</button><button>Comprar</button></footer></div>`;
    this._block(true); this.modal(true); this.game.audio.chime();
    let pick = 0;
    if (this.auto) await this.botDelay(900);
    else pick = await new Promise((res) => el.querySelectorAll('button').forEach((b, i) => (b.onclick = () => res(i))));
    el.querySelector('.c div').innerHTML = '<b>Compra realizada. ¡Gracias!</b><br/>Se han cargado 4,99 € de mentira en tu cuenta de mentira.';
    el.querySelector('footer').innerHTML = '';
    await this.wait(2200);
    this._block(false); this.modal(false); this.hideFake(); this.game.input.advance(); this.game.input.action();
    return pick;
  }

  objective(html) { this.el.obj.innerHTML = html; document.getElementById('objective').classList.toggle('hidden', !html); if (html) { this.el.hud.classList.remove('hidden'); this.game.audio.beep(true); } }
  /** full-screen overlays hide the top stack so nothing shows through them */
  modal(on) { document.body.classList.toggle('modal', on); }
  awareness(pct) { this.aware = pct; this.el.awFill.style.width = pct + '%'; this.el.awNum.textContent = pct + '%'; }
  cine(on) { document.body.classList.toggle('cine', on); }
  glitch(on) { document.body.classList.toggle('glitch', on); }

  async chapter(small, title, ms = 2600) {
    const el = this.el.chapter;
    el.querySelector('small').textContent = small; el.querySelector('h2').textContent = title;
    el.classList.remove('hidden');
    await this.wait(ms);
    el.classList.add('hidden');
  }
  async fade(out, ms = 1200, white = false) {
    const f = this.el.fade;
    f.classList.toggle('white', white);
    f.style.transitionDuration = (this.fast ? 50 : ms) + 'ms';
    f.classList.toggle('clear', !out);
    await this.wait(ms);
  }

  async fakeCredits() {
    const el = this.el.fake;
    el.className = 'dark'; document.body.classList.add('credits'); // the cast keeps talking over the credits
    el.innerHTML = `<div class="credits"><h3>Fin</h3><p><small>ESCRITO Y DIRIGIDO POR</small>El Narrador</p><p><small>PROTAGONIZADO POR</small>El Narrador (voz)</p><p><small>PIANOS</small>Cuarenta, amortizados</p><p><small>CON LA COLABORACIÓN DE</small>un robot de limpieza</p><p><small>NINGÚN HILO FUE DAÑADO</small>en la realización de este final</p></div>`;
    await this.wait(4200);
  }
  hideFake() { this.el.fake.className = 'hidden'; this.el.fake.innerHTML = ''; document.body.classList.remove('credits'); }
  async fakeCrash() {
    const el = this.el.fake;
    el.className = 'dark';
    el.innerHTML = `<div class="win"><header>trama.exe</header><div class="c"><i>!</i><div><b>trama.exe no responde</b><br/>El protagonista ha realizado una operación no prevista en el guion. ¿Qué quieres hacer?</div></div><footer><button>Esperar</button><button>Cerrar la trama</button></footer></div>`;
    this._block(true); this.modal(true);
    this.game.audio.alarm();
    let pick = 0;
    if (this.auto) await this.botDelay(900);
    else pick = await new Promise((res) => el.querySelectorAll('button').forEach((b, i) => (b.onclick = () => res(i))));
    this._block(false); this.modal(false);
    this.hideFake();
    this.game.input.advance(); this.game.input.action();
    return pick;
  }

  /** the magic trick: every pair of options collapses into the same card */
  async reveal(tricks, stats) {
    const el = this.el.reveal;
    this._block(true); this.modal(true);
    el.innerHTML = `<div class="wrap"><h3>Elige una carta. La que quieras.</h3><p class="sub">Esto es lo que elegiste. Y esto es lo que habría pasado si no.</p>
      ${tricks.map((t) => t.opts
        ? `<div class="trick multi"><div class="opts">${t.opts.map((o, i) => `<div class="opt ${t.pick === i ? 'you' : ''}"><small>${t.pick === i ? 'TÚ ELEGISTE' : ''}</small>${o}</div>`).join('')}</div><div class="same">${t.same}</div></div>`
        : `<div class="trick"><div class="opt ${t.pick === 0 ? 'you' : ''}"><small>${t.pick === 0 ? 'TÚ ELEGISTE' : ''}</small>${t.a}</div><div class="eq">=</div><div class="opt ${t.pick === 1 ? 'you' : ''}"><small>${t.pick === 1 ? 'TÚ ELEGISTE' : ''}</small>${t.b}</div><div class="same">${t.same}</div></div>`).join('')}
      <div class="stats hidden">${stats}</div><div class="row"><button class="btn hidden">Seguir</button></div></div>`;
    el.classList.remove('hidden');
    const rows = [...el.querySelectorAll('.trick')];
    await this.wait(1400);
    for (const r of rows) { r.classList.add('show'); this.game.audio.ui(); await this.wait(300); }
    await this.wait(900);
    for (const r of rows) { r.classList.add('flip'); r.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); this.game.audio.choice(); await this.wait(900); }
    el.querySelector('.stats').classList.remove('hidden');
    const btn = el.querySelector('.btn'); btn.classList.remove('hidden'); btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (this.auto) await this.botDelay(1500); else await new Promise((res) => (btn.onclick = res));
    el.classList.add('hidden'); this.modal(false);
    this._block(false);
    this.game.input.advance(); this.game.input.action();
  }

  async ending(stats) {
    const el = this.el.reveal; this.modal(true);
    el.innerHTML = `<div class="wrap"><p class="end">Fin<br/><em>(por el bien de la trama)</em></p><p class="sub">Gracias por jugar. No tenías elección.</p><div class="stats">${stats}</div>
      <div class="row"><button class="btn big">Volver a empezar</button></div></div>`;
    el.classList.remove('hidden');
    el.querySelector('.btn').onclick = () => location.reload();
  }
}
