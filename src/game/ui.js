const $ = (s) => document.querySelector(s);
const NAMES = { narrador: 'NARRADOR', robot: 'M0P-1', pelusa: 'PELUSA', villano: 'EL ASPIRADOR', creador: 'EL CREADOR', sistema: 'SISTEMA' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export class UI {
  constructor(game) {
    this.game = game;
    this.auto = null; // 'A' | 'B' → test autopilot
    this.el = { dialog: $('#dialog'), who: $('#dialog .who'), text: $('#dialog .text'), choices: $('#choices'), note: $('#note'), hud: $('#hud'), sub: $('#subtitle'),
      chapter: $('#chapter'), fade: $('#fade'), touch: $('#touch'), fake: $('#fake'), reveal: $('#reveal'), obj: $('#objective-text'), awFill: $('#awareness-fill'), awNum: $('#awareness-num') };
    this._advance = null; this.blocking = 0; this.barkQ = []; this.barkBusy = false; this.aware = 0;
    addEventListener('pointerdown', (e) => {
      if (!this._advance) return;
      if (e.target.closest('button')) return;
      this._advance();
    });
  }
  get speed() { return this.auto ? 0 : 1; }
  wait(ms) { return wait(this.auto ? Math.min(ms, 60) : ms); }

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
    who.textContent = NAMES[speaker]; tx.textContent = '';
    this.game.onSpeak && this.game.onSpeak(speaker);
    if (this.auto) { tx.textContent = text; await wait(25); }
    else {
      let i = 0, skip = false;
      this.game.input.advance();
      await new Promise((res) => {
        this._advance = () => { if (i < text.length) skip = true; else res(); };
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
            if (i >= text.length) dialog.classList.add('done');
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
    el.className = `sp-${b.speaker}`; el.firstElementChild.textContent = NAMES[b.speaker]; el.lastElementChild.textContent = b.text;
    this.game.onSpeak && this.game.onSpeak(b.speaker);
    for (let i = 0; i < 5; i++) setTimeout(() => this.game.audio.blip(b.speaker), i * 60);
    await wait(this.auto ? 300 : b.dur);
    el.classList.add('hidden');
    await wait(this.auto ? 30 : 250);
    this._nextBark();
  }
  clearBarks() { this.barkQ.length = 0; }
  async barksDone() { while (this.barkBusy) await wait(100); }

  async choose(prompt, a, b) {
    const el = this.el.choices, cards = [...el.querySelectorAll('.card')];
    this._block(true);
    el.querySelector('.prompt').textContent = prompt;
    cards[0].lastElementChild.textContent = a; cards[1].lastElementChild.textContent = b;
    cards.forEach((c) => (c.className = 'card'));
    el.classList.remove('hidden');
    this.game.audio.chime();
    let pick;
    if (this.auto) { await wait(40); pick = this.auto === 'B' ? 1 : 0; }
    else pick = await new Promise((res) => {
      const done = (i) => { removeEventListener('keydown', key); cards.forEach((c) => (c.onclick = null)); res(i); };
      const key = (e) => { if (e.code === 'Digit1' || e.code === 'Numpad1') done(0); if (e.code === 'Digit2' || e.code === 'Numpad2') done(1); };
      setTimeout(() => { addEventListener('keydown', key); cards.forEach((c, i) => (c.onclick = () => done(i))); }, 450);
    });
    this.game.audio.choice();
    cards[pick].classList.add('picked'); cards[1 - pick].classList.add('dropped');
    await this.wait(900);
    el.classList.add('hidden');
    this._block(false);
    this.game.input.advance(); this.game.input.action();
    return pick;
  }

  async note(html, button = 'Seguir') {
    const el = this.el.note;
    this._block(true);
    el.querySelector('.body').innerHTML = html;
    const btn = el.querySelector('.btn'); btn.textContent = button;
    el.classList.remove('hidden'); el.querySelector('article').scrollTop = 0;
    if (this.auto) await wait(40);
    else await new Promise((res) => {
      const done = () => { removeEventListener('keydown', key); btn.onclick = null; res(); };
      const key = (e) => { if (e.code === 'Enter' || e.code === 'Space') done(); };
      setTimeout(() => { btn.onclick = done; addEventListener('keydown', key); }, 600);
    });
    this.game.audio.ui();
    el.classList.add('hidden');
    this._block(false);
    this.game.input.advance(); this.game.input.action();
  }

  objective(html) { this.el.obj.innerHTML = html; this.el.hud.classList.toggle('hidden', !html); if (html) this.game.audio.beep(true); }
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
    f.style.transitionDuration = (this.auto ? 50 : ms) + 'ms';
    f.classList.toggle('clear', !out);
    await this.wait(ms);
  }

  async fakeCredits() {
    const el = this.el.fake;
    el.className = 'dark';
    el.innerHTML = `<div class="credits"><h3>Fin</h3><p><small>ESCRITO Y DIRIGIDO POR</small>El Narrador</p><p><small>PROTAGONIZADO POR</small>El Narrador (voz)</p><p><small>PIANOS</small>Cuarenta, amortizados</p><p><small>CON LA COLABORACIÓN DE</small>un robot de limpieza</p><p><small>NINGÚN HILO FUE DAÑADO</small>en la realización de este final</p></div>`;
    await this.wait(4200);
  }
  hideFake() { this.el.fake.className = 'hidden'; this.el.fake.innerHTML = ''; }
  async fakeCrash() {
    const el = this.el.fake;
    el.className = 'dark';
    el.innerHTML = `<div class="win"><header>trama.exe</header><div class="c"><i>!</i><div><b>trama.exe no responde</b><br/>El protagonista ha realizado una operación no prevista en el guion. ¿Qué quieres hacer?</div></div><footer><button>Esperar</button><button>Cerrar la trama</button></footer></div>`;
    this._block(true);
    this.game.audio.alarm();
    let pick = 0;
    if (this.auto) await wait(40);
    else pick = await new Promise((res) => el.querySelectorAll('button').forEach((b, i) => (b.onclick = () => res(i))));
    this._block(false);
    this.hideFake();
    this.game.input.advance(); this.game.input.action();
    return pick;
  }

  /** the magic trick: every pair of options collapses into the same card */
  async reveal(tricks, stats) {
    const el = this.el.reveal;
    this._block(true);
    el.innerHTML = `<div class="wrap"><h3>Elige una carta. La que quieras.</h3><p class="sub">Esto es lo que elegiste. Y esto es lo que habría pasado si no.</p>
      ${tricks.map((t) => `<div class="trick"><div class="opt ${t.pick === 0 ? 'you' : ''}"><small>${t.pick === 0 ? 'TÚ ELEGISTE' : ''}</small>${t.a}</div><div class="eq">=</div><div class="opt ${t.pick === 1 ? 'you' : ''}"><small>${t.pick === 1 ? 'TÚ ELEGISTE' : ''}</small>${t.b}</div><div class="same">${t.same}</div></div>`).join('')}
      <div class="stats hidden">${stats}</div><div class="row"><button class="btn hidden">Seguir</button></div></div>`;
    el.classList.remove('hidden');
    const rows = [...el.querySelectorAll('.trick')];
    await this.wait(1400);
    for (const r of rows) { r.classList.add('show'); this.game.audio.ui(); await this.wait(420); }
    await this.wait(900);
    for (const r of rows) { r.classList.add('flip'); this.game.audio.choice(); await this.wait(1250); }
    el.querySelector('.stats').classList.remove('hidden');
    const btn = el.querySelector('.btn'); btn.classList.remove('hidden');
    if (this.auto) await wait(60); else await new Promise((res) => (btn.onclick = res));
    el.classList.add('hidden');
    this._block(false);
    this.game.input.advance(); this.game.input.action();
  }

  async ending(stats) {
    const el = this.el.reveal;
    el.innerHTML = `<div class="wrap"><p class="end">Fin<br/><em>(por el bien de la trama)</em></p><p class="sub">Gracias por jugar. No tenías elección.</p><div class="stats">${stats}</div>
      <div class="row"><button class="btn big">Volver a empezar</button></div></div>`;
    el.classList.remove('hidden');
    el.querySelector('.btn').onclick = () => location.reload();
  }
}
