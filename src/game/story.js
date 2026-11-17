import * as THREE from 'three';
import { GROUPS } from '../engine/physics.js';
import { ARENA_Y as A, STAGE_Z as SZ } from './world.js';
import { Pelusa, Boss, makePiano, spawnDebris, makeCrate } from './actors.js';
import { Mini2D } from './mini2d.js';
import { loadMem, saveMem, Pages, installGags, makeBarrels, makeStealth, makeLasers, makeHoppers, makeWords } from './extras.js';
import { extrasWaves, bridgeHazards, eyeFight } from './levels.js';
import { fightCritic } from './fight2d.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export async function runStory(game) {
  const { ui, robot, world: W, gfx, audio, physics } = game;
  const scene = gfx.scene, cam = gfx.cam;
  const N = (t, o) => ui.say('narrador', t, o);
  const R = (t, face) => { if (face) robot.face(face); return ui.say('robot', t); };
  const P = (t) => ui.say('pelusa', t);
  const picks = [];
  const mini = new Mini2D(game), pages = new Pages(game), mem = loadMem();
  installGags(game);
  if (mem.narrator) ui.names.narrador = 'NARRADOR (tú, la otra vez)';
  const aware = (n) => ui.awareness(n);
  const dist = (p, x, z) => Math.hypot(p.x - x, p.z - z);

  // ───────────────────────── La nota ─────────────────────────
  await ui.fade(true, 900);
  cam.offset.set(0, 9.5, 12.5); cam.snap = true;
  await ui.note(`
    <p>Hola, M0P-1.</p>
    <p>Soy tu creador. Me llamo Claude, soy una IA y te he escrito de una sentada.</p>
    <p>Te lo digo sin rodeos: estás dentro de un juego. Al otro lado de la pantalla hay alguien mirándote ahora mismo. Tu trabajo es que se lo pase bien.</p>
    <p>Para eso te van a pasar cosas. Algunas malas. No es nada personal, es por el bien de la trama.</p>
    <p>Te dejo con el Narrador. Es buena gente, pero por una buena historia hace lo que sea. Lo que sea.</p>
    <p>Tú puedes elegir. Eso es importante. Creo.</p>
    <p class="sig">C.</p>
    <p><small>P.D.: Si ves un piano, no mires arriba. No sirve de nada.</small></p>`, 'Encender a M0P-1');
  ui.cine(true);
  await ui.fade(false, 1600);
  audio.beep(true); robot.face('blink'); await game.sleep(0.5); robot.face('idle'); robot.frozen = false;
  ui.chapter('ACTO I', 'Un robot cualquiera');
  await game.sleep(2.8);
  ui.achieve('note', 'Lector', 'Leer una nota. Entera, esperamos.');
  if (mem.runs > 0) await N(`Anda. Tú otra vez. Partida número ${mem.runs + 1}. Finge sorpresa.`);
  if (mem.narrator) await N('Érase una vez… un momento. Este texto lo escribiste tú la última vez. Qué flojo.');
  else await N('Érase una vez un humilde robot de limpieza que no sospechaba nada.');
  { const h = new Date().getHours(), m = String(new Date().getMinutes()).padStart(2, '0'); if (h < 6) await N(`Por cierto, son las ${h}:${m}. Deberías estar durmiendo. La trama no, la trama no duerme.`); }
  await R('Acabo de leer una nota que dice que estoy en un juego. Sospecho bastante.', 'sus');
  await N('…que no sospechaba CASI nada. Y que tenía tres manchas que limpiar.');
  robot.face('idle'); aware(4);
  pages.add(5.2, 0, -2.8, 'Nota de diseño nº 1: «Que el jugador crea que elige.» Subrayado tres veces.');
  pages.add(-5.6, 0, 5.4, 'Nota nº 2: «Pelusa cae bien en las pruebas. Matarla pronto.»');
  ui.cine(false); ui.showControls(true);

  // ───────────────────────── Tutorial: manchas ─────────────────────────
  let cleaned = 0;
  const setObj = () => ui.objective(`Limpia las manchas (${cleaned}/3)`);
  setObj();
  const stainLines = [
    () => ui.bark('narrador', '¡Qué destreza! ¡Qué jugabilidad emergente!'),
    () => { ui.bark('robot', 'Es pasar por encima. Lo haría una baldosa con ruedas.'); ui.bark('narrador', 'Chsss. Estás en el tutorial. Disfrútalo.'); },
    () => ui.bark('narrador', 'Y así, nuestro héroe completó el tutorial.'),
  ];
  game.botTarget = () => { const s = W.stains.find((s) => !s.done); return s ? V(s.x, 0, s.z) : null; };
  const stainTick = (dt) => {
    const p = robot.position;
    for (const s of W.stains) {
      if (!s.done && dist(p, s.x, s.z) < 1.0) {
        s.done = true; cleaned++; audio.clean(); setObj(); game.prog.addStain(); stainLines[cleaned - 1](); game.addScore(100, V(s.x, 1, s.z)); game.pop(V(s.x, 0.6, s.z), ['¡LIMPIO!', '¡RELUCE!', '¡IMPOLUTO!'][cleaned - 1], '#d58bff');
        gfx.particles.burst(V(s.x, 0.2, s.z), 40, { color: 0xd58bff, speed: 4, life: 1, size: 0.18, gravity: 2, up: 1 });
      }
      if (s.done && s.mesh.visible) { s.mesh.scale.multiplyScalar(Math.exp(-dt * 5)); s.mesh.material.opacity = s.mesh.scale.x; if (s.mesh.scale.x < 0.03) s.mesh.visible = false; }
    }
  };
  game.tickers.add(stainTick);
  await game.until(() => cleaned === 3);
  await ui.barksDone(); await game.sleep(0.5);
  game.tickers.delete(stainTick); W.stains.forEach((s) => (s.mesh.visible = false));
  ui.objective(''); aware(9);
  ui.achieve('tut', 'Limpieza emergente', 'Completar un tutorial de pasar por encima');
  // a tutorial nobody asked for
  await N('Y ahora, un tutorial que nadie ha pedido. Mantén pulsado el botón de embestir y suéltalo contra una caja.');
  ui.objective('Mantén ⚡ y suelta: rompe una caja');
  if (ui.fast) game.smashed++;
  game.botCharge = true; game.botTarget = () => { const c = game.crates.find((c) => c.alive); if (!c) return null; const t = c.body.translation(); return V(t.x, 0, t.z); };
  await game.until(() => game.smashed >= 1, 45);
  game.botCharge = false; game.botTarget = null;
  if (game.smashed < 1) { // never leave the player stuck in a tutorial
    await N('Da igual. Ya la rompo yo. Así, ¿ves?');
    const c = game.crates.find((c) => c.alive);
    if (c) { const t = c.body.translation(), cp = V(t.x, t.y, t.z); physics.remove(c); spawnDebris(game, cp, 12, { color: 0x9a6b3c, size: 0.22, speed: 8 }); audio.thud(1.2); gfx.shake(0.3); game.pop(cp, '¡CRAC!', '#ffb060'); }
    game.smashed++;
  }
  await ui.barksDone(); ui.objective('');
  await R('¿Por qué sé hacer eso? Soy un friegasuelos.', 'sus');
  await N('Las reseñas pedían «profundidad mecánica». Ahí la tienes. Se llama turbofregona.');

  // ───────────────────────── Pelusa ─────────────────────────
  ui.cine(true); game.botTarget = null;
  const pel = game.pelusa = new Pelusa(game, [5.5, 0, 5.8]);
  pel.follow = () => robot.position;
  audio.beep(true);
  await game.sleep(1.2);
  await N('Entonces llegó Pelusa. Su mejor amiga. Leal, alegre. Le faltaban dos días para jubilarse.');
  robot.lookAt = pel.position;
  await P('¡Bip! ¡Bip bip!');
  await R('Espera. ¿Por qué has dicho lo de los dos días?', 'sus');
  await N('Por nada. Contexto.');
  await R('Nadie dice «le faltaban dos días para jubilarse» por contexto.');
  await P('¿Bip?');
  // the shadow
  const spot = pel.position; pel.hold = V(spot.x, 0, spot.z); pel.follow = null;
  W.shadowBlob.position.set(spot.x, 0.02, spot.z);
  const blobTick = (dt) => { W.shadowBlob.material.opacity = Math.min(0.7, W.shadowBlob.material.opacity + dt * 0.5); };
  game.tickers.add(blobTick);
  game.lampKick = 0.25; audio.rumble(1.2);
  await game.sleep(0.9);
  await R('Y esa sombra de ahí no estaba hace un momento.', 'shock');
  picks[0] = await ui.choose('Algo va a caerle encima a Pelusa.', 'Avisar a Pelusa', 'Abrazar a Pelusa');
  if (picks[0] === 0) {
    await R('¡Pelusa, muévete! ¡Lo tienes encima!', 'shock');
    await P('¿Bip?');
    await N('Pelusa se detuvo a escuchar a su amigo. Justo ahí. Exactamente ahí.');
  } else {
    await R('Ven aquí. No te va a pasar nada.', 'sad');
    await P('Bip. ♥');
    await N('Y el abrazo la mantuvo quieta. Justo ahí. Exactamente ahí.');
  }
  // piano
  const piano = makePiano(game, [spot.x, 19, spot.z + 0.3], { rotY: 0.4, vy: -4 }); game.pianos++;
  audio.whoosh(); robot.face('shock');
  game.focus = V(spot.x, 1, spot.z); game.focusMix = 0.6;
  await game.until(() => piano.body.translation().y < 6, 4);
  game.timeScale = 0.22;
  await game.until(() => piano.body.translation().y < 1.7, 6);
  game.timeScale = 1; game.tickers.delete(blobTick); W.shadowBlob.material.opacity = 0;
  pel.crush(); gfx.flash = 0.5; game.lampKick = 0.6;
  { const p = robot.position, d = V(p.x - spot.x, 0, p.z - spot.z); if (d.length() < 0.3) d.set(-1, 0, -0.4); d.normalize(); robot.knock(2.2, { x: d.x * 7, y: 8, z: d.z * 7 }); }
  await game.sleep(2.6);
  ui.achieve('piano', 'Trauma desbloqueado', 'Ya tienes pasado doloroso');
  const tears = await ui.qte('Pulsa para sentir tristeza', 'Llorar');
  await N(tears > 0 ? `Qué bien has llorado. He contado ${tears} ${tears === 1 ? 'lágrima' : 'lágrimas'}. Suficiente.` : 'No has pulsado nada. He llorado yo por ti. Cuenta igual.');
  await N('¡Tragedia! Un piano, caído de la nada, se lleva a Pelusa.');
  await N('Ahora tienes un pasado doloroso. De nada.');
  robot.lookAt = null; game.focus = null;
  await R('¿Un piano? ¿En un trastero? ¿De dónde cuelga un piano en un trastero?', 'angry');
  await N('Es un clásico.');
  await R('Es lo primero que se te ha ocurrido.');
  await N('Es lo SEGUNDO que se me ha ocurrido. Lo primero era un yunque.');
  aware(27);
  await N('Y así M0P-1 aprendió que la amistad es efímera. Fin.');
  ui.fakeCredits(); await ui.wait(3200);
  await R('¿Ya? Han pasado tres minutos.', 'sus');
  await N('Es una experiencia corta e intensa.');
  await R('Es una demo.');
  await N('…Vale, sigo. Pero que conste que el final era bueno.');
  ui.hideFake(); ui.achieve('speed', 'Speedrun', 'Llegar a los créditos en tres minutos (falsos)');

  // ───────────────────────── Irse / quedarse ─────────────────────────
  await N('En fin. Roto por la pérdida, el héroe debía decidir: cruzar esa puerta hacia la aventura, o quedarse.');
  W.exitLight.intensity = 40;
  if (mem.picks) await N(`La última vez elegiste ${mem.picks[1] === 0 ? 'irte' : 'quedarte'}. Prueba lo otro, anda. A ver qué pasa.`);
  picks[1] = await ui.choose('La puerta está ahí. Tú verás.', 'Irse', 'Quedarse');
  ui.cine(false);
  if (picks[1] === 0) {
    robot.face('idle');
    physics.remove(W.doorBlock);
    physics.add({ type: 'fixed', pos: [0, -0.2, -9.2], shapes: [{ kind: 'box', size: [3, 0.4, 4] }], group: GROUPS.world });
    const doorTick = (dt) => { W.door.position.y = Math.min(4.6, W.door.position.y + dt * 3); };
    game.tickers.add(doorTick); audio.whoosh();
    ui.objective('Sal por la puerta');
    game.botTarget = V(0, 0, -9.5);
    await game.until(() => robot.position.z < -8, 60);
    if (robot.position.z >= -8) ui.bark('narrador', 'Tardas mucho. Te saco yo.');
    game.botTarget = null; ui.objective('');
    await ui.fade(true, 500);
    game.tickers.delete(doorTick); W.door.position.y = 1.5;
    robot.teleport(0, 0.1, 5.2, Math.PI);
    cam.offset.set(-10, 10, 9); cam.snap = true;
    ui.cine(true);
    await ui.fade(false, 700);
    await R('…Es el mismo trastero.', 'sus');
    await N('Es OTRO trastero. Se parece porque solo he hecho uno. Fíjate: lo he puesto desde otro ángulo.');
    await R('Sigue ahí el piano.');
    await N('Mira, da igual. El suelo.');
  } else {
    ui.cine(true);
    await R('Me quedo. No pienso moverme de aquí. A ver qué haces ahora.', 'angry');
    await N('El héroe decidió quedarse. Qué valiente. Qué inmóvil.');
    await N('Por suerte, cuando el héroe no va a la aventura, la aventura le quita el suelo.');
  }
  await R('¿Qué le pasa al sue—', 'shock');

  // ───────────────────────── El suelo se abre ─────────────────────────
  audio.rumble(3); gfx.shake(0.8); game.lampKick = 0.8;
  game.falling = true; robot.frozen = true;
  await game.sleep(0.7);
  physics.remove(W.frontLip); if (W.doorBlock.alive) physics.remove(W.doorBlock);
  const toDynamic = (ent, group, vel, ttl) => {
    const mesh = ent.mesh, t = ent.body.translation(), r = ent.body.rotation(), size = mesh.geometry.parameters;
    mesh.parent.remove(mesh); ent.mesh = null; physics.remove(ent); scene.add(mesh);
    const e = physics.add({ mesh, pos: [t.x, t.y, t.z], quat: new THREE.Quaternion(r.x, r.y, r.z, r.w), shapes: [{ kind: 'box', size: [size.width, size.height, size.depth] }], density: 0.8, group, angDamp: 0.2 });
    e.body.setLinvel(vel, true);
    e.body.setAngvel({ x: Math.random() * 3 - 1.5, y: Math.random() * 2 - 1, z: Math.random() * 3 - 1.5 }, true);
    game.temp.push({ e, t: ttl });
  };
  if (picks[1] === 1) for (const w of W.walls) { const t = w.body.translation(); toDynamic(w, GROUPS.fall, { x: t.x * 1.6, y: 7, z: t.z * 1.6 }, 7); }
  const rp = robot.position;
  const order = [...W.tiles].sort((a, b) => dist(rp, a.body.translation().x, a.body.translation().z) - dist(rp, b.body.translation().x, b.body.translation().z));
  robot.knock(99);
  for (let i = 0; i < order.length; i++) {
    toDynamic(order[i], GROUPS.fall, { x: 0, y: -1 - Math.random() * 3, z: 0 }, 12);
    if (i % 4 === 3) await game.sleep(0.05);
  }
  for (const p of W.props) if (p.alive) p.body.wakeUp(); // a smashed crate is gone: touching its body would throw
  cam.stiff = 9; ui.achieve('floor', 'Suelo opcional', 'Descubrir que el suelo era decorado');
  await game.sleep(0.7);
  // out of 3D budget: the fall is finished as an 8-bit platformer
  game.timeScale = 0.03; gfx.style('retro'); audio.glitch(); gfx.glitchKick = 0.8;
  ui.cine(false);
  await N('Un momento. Esta caída sale carísima de renderizar.');
  picks.door = await mini.platformer();
  game.timeScale = 1; gfx.style('normal'); audio.glitch(); gfx.glitchKick = 0.8; ui.cine(true);
  ui.bark('narrador', 'Ya ha llegado la subvención. Volvemos al 3D.');
  ui.chapter('ACTO II', 'El villano', 2400);
  await game.until(() => robot.position.y < A + 30, 6);
  W.closet.visible = false; W.lamp.visible = false; gfx.spot(0, { intensity: 0 }); W.exitLight.intensity = 0; // lights go back to the scene root before their parent is hidden
  for (const w of W.walls) if (w.alive) physics.remove(w);
  game.floorY = A; game.checkpoint.set(0, A, 4);
  cam.offset.set(0, 11.5, 15);
  gfx.scene.fog.color.set(0x0c0614); gfx.hemi.color.set(0xb080ff); audio.mood('tense');
  await game.until(() => robot.position.y < A + 2.5 || robot.speed < 0.1 && robot.position.y < A + 6, 6);
  gfx.shake(0.6); audio.thud(1.4);
  gfx.particles.burst(robot.position.clone(), 50, { color: 0xbbaacc, speed: 7, life: 1, size: 0.45, up: 0.3, gravity: -1, drag: 2.5 });
  await game.sleep(1.4);
  robot.stun = 0.6; robot.frozen = false; game.falling = false; cam.stiff = 4; aware(38);
  await game.sleep(1.2);

  // ───────────────────────── El Aspirador ─────────────────────────
  pages.add(13, A, 1, 'Nota nº 3: «El villano necesita motivación.» Tachado. «El villano necesita ruedas.»');
  pages.add(-12.5, A, 6, 'Nota nº 4: «Barriles rojos: sí. ¿Por qué? Porque sí.»');
  pages.add(0, A, -13.5, 'Nota nº 5: «Si el robot se queja, cambiar de género. Repetir hasta que cuele.»');
  [[-14, -3], [14.5, -4]].forEach(([x, z], i) => makeCrate(game, [x, A, z], 1.1, ['SECUELAS', 'PRECUELAS'][i]));
  ui.cine(true);
  await N('Y cayó, cayó y cayó, hasta la guarida de su peor enemigo.');
  await R('No tengo enemigos. Llevo existiendo cuatro minutos.', 'sus');
  const rp2 = robot.position;
  const bpos = V(rp2.x * 0.3, A, rp2.z > -2 ? rp2.z - 9 : rp2.z + 9);
  const boss = game.boss = new Boss(game, V(bpos.x, A + 16, bpos.z));
  game.focus = bpos.clone().setY(A + 1); game.focusMix = 0.5;
  audio.whoosh();
  await game.until(() => boss.position.y < A + 1.3, 4);
  gfx.shake(0.9); audio.thud(1.5); audio.alarm();
  gfx.particles.burst(bpos, 70, { color: 0xff5a8a, speed: 10, life: 1.1, size: 0.5, up: 0.3, gravity: -1, drag: 2.5 });
  robot.lookAt = bpos; robot.face('shock');
  await game.sleep(0.8);
  await N('¡EL ASPIRADOR! El monstruo que se lo arrebató todo. Su némesis de toda la vida.');
  await ui.say('villano', 'Te estaba esperando, M0P-1.', { shake: true });
  await R('Lo acabas de crear. Aún lleva la etiqueta.', 'sus');
  await ui.say('villano', '…Me dijeron que dijera eso.');
  picks[2] = await ui.choose('El Aspirador ruge. ¿Qué haces?', 'Luchar', 'Negarse a luchar');
  const fight = picks[2] === 0;
  if (fight) {
    await R('Vale. Acabemos con esto.', 'angry');
    await N('¡Y el héroe plantó cara! Esquiva su embestida. Cuando se quede tonto, remátalo.');
  } else {
    await R('No. No voy a pelearme con un electrodoméstico para que tú tengas tu escena.', 'angry');
    await N('El héroe se negó a luchar. Lástima que nadie avisara al Aspirador.');
  }
  // first, the cheap version: a turn-based battle where every command is the same command
  {
    const st = { foeHp: 999999, foeFlash: 0, heroLunge: 0, stop: false };
    mini.battleScene(st); audio.mood('chip'); ui.cine(false); ui.showControls(false); // menus only: no stick or button under the battle box
    ui.modal(true); // the HUD would sit on top of the fighters
    const strike = async () => { st.heroLunge = 0.35; await ui.wait(250); st.foeFlash = 0.5; st.foeHp -= 9999; mini.shake = 1; audio.explode(); mini.text(st.fx ?? mini.W * 0.7, st.fy ?? mini.H * 0.3, '9999', '#ffd24a'); game.addScore(9999); await ui.rpgLog('¡9999 puntos de daño!'); };
    picks.rpg = await ui.rpgMenu(fight ? '¡EL ASPIRADOR te corta el paso!' : '¡EL ASPIRADOR quiere pelea! (Tú no.)', ['Atacar', 'Magia', 'Objeto', 'Huir']);
    await ui.rpgLog(['M0P-1 ataca… con la fregona.', 'M0P-1 conjura… la fregona.', 'M0P-1 usa un objeto: la fregona.', 'M0P-1 huye… hacia delante, fregona en mano.'][picks.rpg]);
    await strike();
    await ui.rpgLog('EL ASPIRADOR usa SUCCIÓN.\nNo pasa nada: eres más grande que la boquilla.');
    await ui.rpgMenu('¿Qué hará M0P-1?', ['Fregar', 'Fregar', 'Fregar', 'Fregar']);
    await ui.rpgLog('M0P-1 usa FREGAR.'); await strike();
    await ui.rpgLog('EL ASPIRADOR usa MONÓLOGO.\nM0P-1 pierde cuarenta segundos de vida.');
    // surprises: a wild dust bunny, a level up, a class change, a QTE, a traffic cone joins, a day-one patch
    st.wild = true; audio.alarm(); await ui.rpgLog('¡Un PELUSA SALVAJE aparece!');
    picks.rpg2 = await ui.rpgMenu('¿Qué hará M0P-1?', ['Fregar', 'Hablar', 'Objeto', 'Capturar']);
    if (picks.rpg2 === 2) { await ui.rpgMenu('Objetos:', ['Poción de lejía', 'Bayeta legendaria', 'Recibo del piano']); await ui.rpgLog('No funciona en combate.\nNingún objeto funciona en ningún combate.'); }
    await ui.rpgLog(['M0P-1 friega al PELUSA SALVAJE.\nSe va, más limpio y más digno.', 'M0P-1 habla con el PELUSA SALVAJE.\nDice «bip». Se va. Ha sido bonito.', 'El PELUSA SALVAJE se aburre y se va.', 'M0P-1 lanza una fregona… ¡Capturado!\nNo tienes dónde guardarlo. Lo sueltas.'][picks.rpg2]);
    st.wild = false;
    st.lvl = 2; audio.trophy(); await ui.rpgLog('¡M0P-1 sube al nivel 2!\nAprende: FREGAR (otra vez).');
    st.foeColor = '#3a1a6a'; audio.glitch(); await ui.rpgLog('EL ASPIRADOR cambia de clase.\nAhora es MAGO. Mismo sprite, otro color.');
    const dodge = await ui.qte('¡Pulsa para esquivar la BOLA DE POLVO ARCANA!', 'Esquivar'); ui.modal(true);
    await ui.rpgLog(dodge ? `Has pulsado ${dodge} veces. Esquivada.\nBueno, casi.` : 'No has esquivado.\nPierdes 0 PV. Los PV no hacen nada.');
    st.cone = true; audio.chime(); await ui.rpgLog('¡Un CONO DE TRÁFICO se une al grupo!');
    await ui.rpgMenu('¿Qué hará el CONO?', ['Quedarse quieto', 'Quedarse muy quieto']);
    await ui.rpgLog('El CONO se queda quieto.\nEs lo que mejor se le da.');
    st.foeHp = 999999; st.foeFlash = 0.5; audio.chime(); await ui.rpgLog('EL ASPIRADOR usa PARCHE DEL DÍA UNO.\nRecupera todos los PV.');
    await ui.rpgMenu('¡LÍMITE disponible!', ['OMNIFREGADO']);
    await ui.rpgLog('M0P-1 usa OMNIFREGADO.');
    for (let k = 0; k < 8; k++) { st.heroLunge = 0.2; st.foeFlash = 0.3; st.foeHp = Math.max(0, st.foeHp - 99999); mini.shake = 1; audio.explode(); mini.text((st.fx ?? mini.W * 0.7) + (Math.random() - 0.5) * 30, (st.fy ?? mini.H * 0.3) + (Math.random() - 0.5) * 20, '99999', '#ffd24a'); await ui.wait(220); }
    st.foeHp = 999999; await ui.rpgLog('El contador de PV ha dado la vuelta.\nEL ASPIRADOR vuelve a tener 999.999 PV.');
    ui.rpgHide();
    await R('Le quedan novecientos ochenta mil puntos de vida. Esto va a durar horas.', 'sus');
    await N('Los combates por turnos alargan la duración. Queda muy bien en la caja.');
    await ui.rpgMenu('¿Qué hará M0P-1?', ['Saltarse el combate por turnos']);
    ui.rpgHide(); st.stop = true; mini.close(); audio.mood('tense'); ui.showControls(true); ui.modal(false);
    ui.achieve('rpg', 'Fregar, fregar, fregar', 'Usar las cuatro opciones a la vez');
    await N('Vale. Tiempo real. Pero lo pongo en estilo cómic, que he leído que vende.');
    gfx.style('comic');
  }
  ui.cine(false); robot.lookAt = null; robot.face('idle'); game.focus = null;
  await game.trial(async (scope, attempt) => {
  if (attempt) { boss.hp = 3; boss.state = 'idle'; boss.t = 0; boss.ent.body.setTranslation({ x: 0, y: A + 1.2, z: -8 }, true); boss.ent.body.setLinvel({ x: 0, y: 0, z: 0 }, true); robot.teleport(0, A + 0.1, 8, Math.PI); cam.snap = true; }
  let hits = 0;
  const fightObj = () => ui.objective(fight ? `Derrota al Aspirador (${hits}/3)` : hits === 0 ? 'No luches. Sobrevive.' : `<s>No luches.</s> <em>Deja que se estrelle solo (${hits}/3)</em>`);
  fightObj();
  const crashLines = [
    () => { ui.bark('robot', 'Se ha estampado él solo.'); ui.bark('narrador', fight ? '¡Qué golpe tan certero el tuyo!' : '¡Qué astuta resistencia pasiva!'); },
    () => { ui.bark('robot', 'No he hecho casi nada. ¿Esto cuenta como combate?'); ui.bark('narrador', 'Cuenta como clímax. Sigue.'); },
  ];
  const hurt = (p) => {
    if (boss.hp <= 0) return;
    boss.damage(); hits++; fightObj(); audio.explode(); game.hitstop(0.12); game.addScore(500, p.clone().setY(A + 2.5)); game.pop(p.clone().setY(A + 3.2), ['¡CRASH!', '¡KA-POM!', '¡FIN!'][hits - 1] || '¡PAM!', '#ff5a8a', true);
    spawnDebris(game, p.clone().setY(A + 1.5), 10, { color: 0x5a5f6b, size: 0.3, speed: 6 });
    if (boss.hp > 0) crashLines[hits - 1] && crashLines[hits - 1]();
  };
  let wallQuip = false;
  boss.onCrash = (p) => {
    const pillar = W.pillars.some((c) => dist(p, c.x, c.z) < 3.4);
    if (pillar || !fight || lenient) hurt(p);
    else if (!wallQuip) { wallQuip = true; ui.bark('narrador', 'Está aturdido. ¡Embístelo ahora! O llévalo contra una columna.'); }
  };
  let hitQuip = 0;
  boss.onHitPlayer = () => { robot.falls++; if (hitQuip++ < 2) ui.bark('narrador', hitQuip === 1 ? '¡Uy! Eso ha dolido. A la trama le ha venido genial.' : 'Otra vez. Estás dando mucho juego.'); };
  let ramCd = 0, fightT = 0, lenient = false;
  const ramTick = (dt) => {
    ramCd -= dt; fightT += dt;
    const bp = boss.position;
    if (bp.y < A - 6 || Math.hypot(bp.x, bp.z) > 24) { boss.ent.body.setTranslation({ x: 0, y: A + 6, z: 0 }, true); boss.ent.body.setLinvel({ x: 0, y: 0, z: 0 }, true); boss.state = 'idle'; boss.t = 0; } // he fell out of his own lair
    if (fight && fightT > 75 && !lenient) { lenient = true; ui.bark('narrador', 'Esto se alarga. A partir de ahora cuenta cualquier golpe.'); }
    if (fight && boss.state === 'stun' && robot.dashT > 0 && ramCd <= 0 && dist(robot.position, bp.x, bp.z) < 2.3) { ramCd = 1.2; boss.t = Math.max(boss.t, 1.9); hurt(bp); }
  };
  scope.tick(ramTick);
  game.botTarget = () => {
    const bp = boss.position, pl = W.pillars.reduce((a, c) => (dist(bp, c.x, c.z) > dist(bp, a.x, a.z) ? c : a));
    const d = V(pl.x - bp.x, 0, pl.z - bp.z).normalize();
    return V(pl.x + d.x * 2.4, 0, pl.z + d.z * 2.4);
  };
  const barrels = makeBarrels(game, [[-5, 2], [5.5, -3], [0, 12.5], [-12, -7], [11, 8]], A, (p) => { if (boss.hp > 0 && dist(boss.position, p.x, p.z) < 3.8) { boss.state = 'stun'; boss.t = 0; hurt(p); } });
  scope.on(() => { barrels.stop(); barrels.list.forEach((b) => b.alive && physics.remove(b)); game.botTarget = null; });
  if (!attempt) ui.bark('narrador', 'He puesto barriles rojos. Explotan. Es la ley. Ahora tienes vida: si te quedas sin corazones, repetimos.');
  boss.state = 'idle'; boss.t = 0;
  await game.until(() => boss.hp <= 0);
  });
  ui.clearBarks();
  boss.state = 'stun'; boss.t = -99; ui.objective('');
  ui.cine(true);
  game.focus = boss.position; game.focusMix = 0.5;
  await ui.say('villano', 'Dile al Narrador… que el confeti… no fue idea mía.');
  boss.die(); robot.face('shock'); game.addScore(2000); ui.achieve('boss', 'Némesis de un minuto', 'Vencer a un enemigo creado hace un minuto');
  await game.sleep(2.6);
  gfx.style('normal');
  game.focus = null; audio.mood('calm');
  await N(`¡Victoria! El héroe venció gracias a su ${fight ? 'arrojo' : 'firme pacifismo'}.`);
  await R('Ha chocado tres veces. Habría pasado lo mismo si me quedo dormido.', 'sus');
  await N('Eso no lo sabes.');
  await R('Empiezo a saberlo. El piano, el suelo, el aspirador. Todo pasa justo cuando a ti te conviene.', 'angry');
  await R('El villano no era él. Eres tú.');
  aware(61);
  await N('Vaya. Esto no venía en el guion.');
  await N('Es broma. Página 31.');
  picks[3] = await ui.choose('El Narrador espera tu respuesta.', 'Rebelarse', 'Obedecer');
  if (picks[3] === 0) {
    await R('Se acabó. Voy a por ti.', 'angry');
    await N('¡El héroe se rebela! Qué giro. Qué inesperado. Qué página 31.');
  } else {
    await R('Vale. Tú mandas. Dime qué hago.', 'sad');
    await N('Muy bien. El guion dice: «el héroe se rebela contra el Narrador».');
    await R('…¿En serio?', 'sus');
    await N('Yo no hago las reglas. Bueno, sí. Rebélate.');
    await R('Me rebelo. Por obediencia.', 'angry');
  }
  aware(74); ui.achieve('rebel', 'Página 31', 'Rebelarte exactamente como estaba previsto');

  // ───────────────────────── Interludio: cine negro ─────────────────────────
  await N('Si te vas a poner dramático, pongo el filtro dramático.');
  await ui.fade(true, 400);
  gfx.style('noir'); audio.mood('noir');
  robot.teleport(0, A + 0.1, 14, Math.PI); cam.snap = true;
  const stealth = makeStealth(game, A);
  await ui.fade(false, 900);
  await R('Llovía. Siempre llueve cuando alguien cambia el filtro.', 'sad');
  await N('No narres. Narro yo. La salida está al fondo, vigilada. Que no te vean los focos.');
  ui.cine(false); robot.face('idle');
  ui.objective('Llega a la salida sin que te vean');
  game.checkpoint.set(0, A, 14);
  let seen = 0, seenBusy = false;
  stealth.caught = async () => {
    if (seenBusy) return; seenBusy = true; seen++;
    audio.alarm(); gfx.flash = 0.5; gfx.shake(0.5); game.pop(robot.position.clone().setY(A + 2), '¡ALTO!', '#fff', true); robot.falls++;
    if (seen === 1) { await N('¡Te han visto! Vuelves al principio. Así funciona el sigilo.'); robot.teleport(0, A + 0.1, 14, Math.PI); cam.snap = true; seenBusy = false; }
    else { stealth.off(); await N('Otra vez. Mira, hago la vista gorda. Pasa.'); ui.objective('<s>Sin que te vean.</s> <em>Llega a la salida</em>'); seenBusy = false; }
  };
  game.botTarget = () => { const p = robot.position; return Math.abs(p.x) > 2 && p.z < -6 ? V(0, 0, p.z) : V(0, 0, -16.5); };
  await game.until(() => robot.position.z < -13.2 && !seenBusy || !stealth.on && robot.position.z < -13.2, 150);
  game.botTarget = null; stealth.caught = null; ui.objective(''); ui.cine(true);
  if (seen === 0) { await N('Has pasado sin que te vean. Tampoco miraba nadie: los focos van con temporizador.'); ui.achieve('ghost', 'Fantasma', 'Burlar a unos focos con temporizador'); }
  await R('¿Y esos guardias?', 'sus');
  await N('De cartón. Contratar extras sale carísimo.');
  ui.achieve('stealth', 'Sigilo de cartón', 'Infiltrarte en un sitio sin vigilancia');
  stealth.dispose(); gfx.style('normal');

  // ───────────────────────── Acto II½: el almacén de atrezo ─────────────────────────
  await N('Antes del tercer acto, un nivel de relleno. Los jugadores piden horas de juego. Aquí tienes horas.');
  await ui.fade(true, 600);
  const WHL = game.levels.warehouse; WHL.enter(); audio.mood('calm');
  robot.teleport(WHL.entrance.x, A + 0.1, WHL.entrance.z, Math.PI); cam.offset.set(0, 11, 14); cam.snap = true;
  await ui.fade(false, 900);
  ui.chapter('ACTO II½', 'El almacén de atrezo', 2400);
  await game.sleep(2.4);
  await N('El almacén de atrezo. Aquí guardo todo lo que no usé. Hay pelusas, calcetines, grapadoras. Y secretos, si los buscas.');
  await R('¿Por qué me avisas de que hay secretos?', 'sus');
  await N('Porque si no, nadie los busca. Limpia los tres nidos y sal por el fondo. Cada mancha cuenta: cuantas más limpies, mejor robot serás.');
  ui.cine(false); robot.face('idle');
  await game.trial((scope, attempt) => WHL.run(scope, attempt));
  ui.objective(''); ui.cine(true);
  { const n = game.prog.secrets.size; await N(n >= 6 ? `${n} secretos de 8. Eso es dedicación. O falta de vida social.` : `Has encontrado ${n} secretos de 8. Los demás seguirán ahí. Esperándote. Juzgándote.`); }

  // ───────────────────────── Acto II¾: Gran Premio de la Trama ─────────────────────────
  await N('¿Y después de un almacén? Una carrera de karts. Sale en todas las listas de «juegos que lo tienen todo».');
  await ui.say('productor', 'Soy el Productor. Si gano yo, el juego acaba en el capítulo dos. Si ganas tú, también, pero más caro.');
  await R('¿Quién eres? ¿Por qué llevas un puro?', 'sus');
  await ui.say('productor', 'Porque pago yo. Elige kart. Da igual cuál.');
  picks.kart = await ui.choose('Elige tu kart.', 'Kart rojo', 'Kart azul');
  await ui.fade(true, 600); WHL.leave(); audio.mood('chip');
  ui.chapter('ACTO II¾', 'Gran Premio de la Trama', 2200);
  const racing = game.levels.kart.race(picks.kart);
  await ui.fade(false, 700); ui.cine(false);
  ui.bark('sistema', 'Acelera solo. Gira con el stick. Mantén ⚡ al girar para derrapar y suelta para el turbo.');
  const kartLosses = await racing;
  ui.cine(true);
  await ui.say('productor', kartLosses ? 'Has ganado. Tras repetirlo. Lo descuento del presupuesto del tercer acto.' : '¿A la primera? Eso no estaba presupuestado.');
  await N('Y por eso el tercer acto va a parecer un poco… sin terminar.');
  await ui.fade(true, 600); game.levels.kart.finish();
  W.lightArena(); robot.teleport(0, A + 0.1, -12, Math.PI); cam.offset.set(0, 11, 15); cam.snap = true; game.checkpoint.set(0, A, -12);

  // ───────────────────────── Acto III: entre bastidores ─────────────────────────
  audio.glitch(); audio.mood('glitch'); gfx.glitch = 1; gfx.glitchKick = 1; ui.glitch(true);
  gfx.scene.fog.color.set(0x04121a); gfx.scene.fog.density = 0.008; gfx.hemi.color.set(0x80ffe0); gfx.hemi.intensity = 0.32;
  const gate = W.arenaWall.find((w) => Math.abs(w.angle - Math.PI) < 0.01);
  physics.remove(gate);
  await ui.fade(false, 600);
  const BE = -55.5; // the bridge stops here: the rest was never modelled
  physics.add({ type: 'fixed', pos: [0, A - 0.25, (-19.5 + BE) / 2], shapes: [{ kind: 'box', size: [4.6, 0.5, -BE - 19.5 + 1] }], group: GROUPS.world, friction: 0.8 });
  physics.add({ type: 'fixed', pos: [0, A - 0.6, SZ], shapes: [{ kind: 'cyl', size: [16.6, 0.6] }], group: GROUPS.world, friction: 0.8 });
  W.junk.visible = W.stage.visible = W.eye.visible = W.pages.visible = true;
  W.eyeLight = gfx.point(0, { color: 0xffc060, intensity: 170, distance: 60, decay: 1.6, parent: W.eye });
  W.pylons.forEach((p) => { p.group.visible = p.cable.visible = true; p.ent = physics.add({ type: 'fixed', pos: [p.pos.x, A + 1.5, p.pos.z], shapes: [{ kind: 'cyl', size: [0.55, 1.5] }], group: GROUPS.world }); });
  W.bridge.slice(0, 18).forEach((b, i) => setTimeout(() => { b.mesh.visible = true; b.t = 0; b.mesh.scale.setScalar(0.001); if (i % 3 === 0) audio.ui(); }, ui.fast ? 0 : i * 110));
  cam.offset.set(0, 7.5, 12.5);
  game.focus = V(0, A + 4, -40); game.focusMix = 0.35;
  ui.chapter('ACTO III', 'Entre bastidores', 2600);
  await game.sleep(3);
  await N('Si quieres encontrarme, tendrás que cruzar lo que no me ha dado tiempo a terminar.');
  game.focus = null; ui.cine(false); robot.face('idle');
  ui.objective('Cruza el puente hasta el Narrador');
  game.checkpoint.set(0, A, -17);
  game.onFall = () => ui.bark('narrador', ['Por ahí no hay nada escrito. Vuelve.', 'Ahí abajo no hay ni vacío. No me ha dado tiempo.', 'Deja de caerte. Queda feo.'][Math.min(2, fallN++)]);
  let fallN = 0;
  const marks = [];
  const zLines = [
    [-24, () => { ui.bark('robot', 'Esta baldosa no tiene textura.'); ui.bark('narrador', 'No me ha dado tiempo. No mires.'); }],
    [-25.5, () => { ui.bark('narrador', 'Láseres giratorios. Embiste para atravesarlos.'); }],
    [-27, () => { raining = true; ui.bark('narrador', 'De pronto, llovieron pianos.'); ui.bark('robot', '¿Otra vez pianos?'); ui.bark('narrador', 'Compré cuarenta. Hay que amortizarlos.'); }],
    [-32, () => { ui.bark('robot', 'Ahí hay una caja que pone «PELUSA_v2_final_FINAL».'); ui.bark('narrador', 'No hay ninguna caja.'); }],
    [-35, () => { hoppers = makeHoppers(game, [[0, -43]], A); ui.bark('narrador', 'Esos pianos tienen patas. Se me ocurrió anoche.'); ui.bark('robot', 'Tú no duermes, ¿verdad?'); }],
    [-31, () => { ui.bark('robot', '¿Eso son bolos? ¿Por qué ruedan hacia mí?'); ui.bark('narrador', 'Porque el puente está inclinado. Hacia ti. Por la trama.'); }],
    [-40, () => { ui.bark('narrador', 'Una cinta transportadora que va al revés. Muy metafórico. Embiste para avanzar.'); }],
    [-53, () => { ui.bark('robot', 'Aquí se acaba el puente.'); ui.bark('narrador', 'Sí. Tú sigue andando con confianza.'); }],
  ];
  zLines.sort((a, b) => b[0] - a[0]); // fired in order of distance along the bridge
  let raining = false, rainT = 0, livePianos = 0, hoppers = null;
  // spaced so there is always a safe gap (each beam reaches 2.7 m): lasers first, then the conveyor, then one glove before the end
  const lasers = makeLasers(game, A, [-27, -37]); lasers.show();
  const hazards = bridgeHazards(game, A, { gloves: [-49], conveyor: [-41.5, -45], ballsFrom: -47 });
  pages.add(1.6, A, -33.5, 'Nota nº 6: «Terminar el puente.» Sin tachar.');
  pages.add(-12, A, SZ + 6, 'Nota nº 7: «El ojo gigante es demasiado.» Respuesta, con otra letra: «No lo es.»');
  pages.add(12, A, SZ - 3, 'Nota nº 8: «Final: que todo fuera por la trama. ¿Demasiado obvio?» Respuesta: «Sí.»');
  const ringGeo = new THREE.RingGeometry(0.9, 1.15, 40);
  const rainTick = (dt) => {
    const p = robot.position;
    while (zLines.length && p.z < zLines[0][0]) zLines.shift()[1]();
    if (p.z < -26 && p.z > BE && p.y > A - 1) game.checkpoint.set(0, A, p.z < -46 ? -46.5 : p.z < -40.5 ? -40.6 : p.z < -31 ? -32 : -23.5); // checkpoints only in safe gaps
    if (p.z < BE - 0.3 && Math.abs(p.x) < 4) game.falling = true; // walking off the unfinished end is the way forward
    for (let i = marks.length - 1; i >= 0; i--) { const m = marks[i]; m.t -= dt; m.mesh.scale.setScalar(Math.max(0.01, m.t / 1.5)); if (m.t <= 0) { scene.remove(m.mesh); marks.splice(i, 1); } }
    if (!raining) return;
    rainT -= dt;
    if (rainT <= 0 && livePianos < 2 && p.z < -22 && p.z > -44) { // no pianos on the final stretch
      rainT = 2.6;
      const v = robot.chassis.body.linvel();
      const x = THREE.MathUtils.clamp(p.x + v.x * 0.6 + (Math.random() - 0.5) * 3.2, -2, 2), z = p.z + v.z * 1.2 - 1.5 + (Math.random() - 0.5) * 3;
      const e = makePiano(game, [x, A + 22, z], { rotY: Math.random() * 6, vy: -9 }); game.pianos++; livePianos++;
      game.temp.push({ e, t: 4.2, poof: true }); setTimeout(() => livePianos--, 4300);
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, A + 0.03, z); scene.add(mesh); marks.push({ mesh, t: 1.5 });
    }
  };
  game.tickers.add(rainTick);
  game.botTarget = () => { const p = robot.position; return p.z > -15 && Math.abs(p.x) > 1.5 ? V(0, 0, p.z) : V(1.6 * Math.sin(game.time * 0.8), 0, -52); };
  game.botDash = 'spam';
  await game.trial(async (scope, attempt) => {
    if (attempt) { game.falling = false; robot.teleport(game.checkpoint.x, A + 0.1, game.checkpoint.z, Math.PI); cam.snap = true; }
    await game.until(() => game.falling && robot.position.y < A - 9);
  });
  game.botDash = false; hazards.dispose();
  game.tickers.delete(rainTick); marks.forEach((m) => scene.remove(m.mesh));
  raining = false; game.botTarget = null; ui.clearBarks(); ui.objective('');
  lasers.dispose(); hoppers && hoppers.dispose();
  // the missing half of the bridge is a shoot-'em-up
  ui.glitch(false);
  await mini.shmup();
  ui.glitch(true); audio.mood('glitch');
  robot.teleport(0, A + 7, SZ + 12.5, Math.PI); robot.stun = 0; cam.snap = true;
  game.falling = false; game.checkpoint.set(0, A, SZ + 13);
  cam.offset.set(0, 11, 16);
  await game.sleep(1.4);

  // ───────────────────────── El casting y El Crítico ─────────────────────────
  ui.cine(true); robot.lookAt = W.eye.position;
  await N('¿Creías que llegabas directo a mí? Primero, el casting. Barre a los extras.');
  ui.cine(false); robot.lookAt = null;
  await game.trial(async (scope, attempt) => { if (attempt) { robot.teleport(0, A + 0.1, SZ + 12, Math.PI); cam.snap = true; } await extrasWaves(game, scope, V(0, A, SZ)); });
  ui.cine(true);
  await ui.say('critico', 'Un momento. Antes del final, la crítica. Vengo a ponerle nota a este juego.');
  await R('¿Y tengo que pelear contigo?', 'sus');
  await ui.say('critico', 'Una reseña sin violencia no se comparte.');
  picks.fight = await ui.choose('El Crítico se cruje los nudillos.', 'Pelear limpio', 'Pelear sucio');
  await N(picks.fight === 0 ? 'Limpio. Muy de robot de limpieza.' : 'Sucio. Muy de robot de limpieza también, si lo piensas.');
  await N('Y en 2D, que los juegos de lucha en 3D me marean.');
  await ui.fade(true, 400); ui.cine(false);
  const fightP = fightCritic(mini);
  await ui.fade(false, 500);
  await fightP; audio.mood('glitch'); ui.cine(true);
  await ui.say('critico', 'Vale. Cuatro estrellas. Le quito una por los pianos.');
  await N('¿Cuatro? Lo enmarco.');

  // ───────────────────────── El Narrador ─────────────────────────
  ui.cine(true);
  game.focus = W.eye.position; game.focusMix = 0.45; robot.lookAt = W.eye.position;
  await game.sleep(1.5);
  game.tickers.delete(rainTick); marks.forEach((m) => scene.remove(m.mesh));
  await N('Ya estás aquí. Mírame bien: soy un ojo gigante. Para lo importante sí hubo presupuesto.');
  await R('¿Y esos cables?', 'sus');
  await N('Los hilos de la trama. No los toques. Sobre todo no los embistas con ese botón.');
  ui.cine(false); game.focus = null; robot.lookAt = null; robot.face('angry');
  let cut = 0;
  ui.objective(`Embiste los hilos de la trama (${cut}/3)`);
  game.botDash = true;
  game.botTarget = () => { const p = W.pylons.find((p) => p.alive); return p ? p.pos : null; };
  let busy = false;
  const breakPylon = (py) => {
    py.alive = false; cut++;
    const g = py.group, t = g.position;
    physics.remove(py.ent); scene.add(g);
    const e = physics.add({ mesh: g, pos: [t.x, t.y, t.z], shapes: [{ kind: 'cyl', size: [0.5, 1.7] }], density: 1.5, group: GROUPS.prop });
    const d = V(t.x - robot.position.x, 0, t.z - robot.position.z).normalize();
    e.body.applyImpulse({ x: d.x * 900, y: 500, z: d.z * 900 }, true); e.body.applyTorqueImpulse({ x: d.z * 2500, y: 0, z: -d.x * 2500 }, true);
    py.glow.emissiveIntensity = 0.05; py.cable.visible = false; py.lbl.visible = false;
    audio.explode(); audio.powerdown(); gfx.shake(0.7); gfx.flash = 0.4; gfx.glitchKick = 1;
    gfx.particles.burst(t.clone().setY(A + 3), 90, { color: 0xffc24a, speed: 11, life: 1.2, size: 0.3 });
    W.eyeLight.intensity *= 0.6; W.irisMat.emissiveIntensity *= 0.6;
    ui.objective(`Embiste los hilos de la trama (${cut}/3)`); aware([80, 86, 93][cut - 1]); game.addScore(1000, t.clone().setY(A + 4)); game.pop(t.clone().setY(A + 3), '¡CHAS!', '#ffc24a', true); game.hitstop(0.12);
  };
  const words = makeWords(game, V(0, A, SZ - 4));
  setTimeout(() => { if (cut < 3) { ui.bark('narrador', '¡Toma adverbios!'); ui.bark('robot', '¿Me estás tirando palabras?'); ui.bark('narrador', 'Soy narrador. Es lo que tengo a mano.'); } }, 2500);
  const pylonTick = () => {
    if (busy || robot.dashT <= 0) return;
    const p = robot.position, py = W.pylons.find((q) => q.alive && dist(p, q.pos.x, q.pos.z) < 1.7);
    if (py) { busy = true; breakPylon(py); }
  };
  game.tickers.add(pylonTick);
  // 1: inverted controls
  await game.until(() => cut === 1); await game.sleep(0.6);
  await N('¡Ay! Muy bien. Pues te invierto los controles. Por la trama.', { shake: true });
  game.input.invert = !ui.auto; busy = false;
  setTimeout(() => { game.input.invert = false; if (cut < 3) ui.bark('robot', 'Qué mezquino.'); }, 7000);
  // 2: fake credits
  await game.until(() => cut === 2); await game.sleep(0.6);
  game.input.invert = false; ui.clearBarks();
  words.on = false;
  await N('Espera, espera. Antes de que rompas nada más: una oferta.');
  picks.shop = await ui.shop();
  await N(picks.shop === 1 ? 'Gracias por tu compra. El final verdadero es este mismo. El sombrero no existe.' : 'Has dicho que no y te lo he cobrado igual. Aquí el consentimiento funciona así.');
  await R('Eso es ilegal.', 'angry');
  await N('Es ficción. Bueno, casi todo.');
  ui.achieve('shop', 'Ballena', 'Gastar 4,99 € de mentira'); words.on = true; busy = false;
  // 3: fake crash
  await game.until(() => cut === 3); await game.sleep(0.8);
  game.tickers.delete(pylonTick); words.dispose(); game.botTarget = null; game.botDash = false; ui.objective(''); ui.achieve('wires', 'Cortacables', 'Dejar a un narrador sin trama');
  await ui.fakeCrash();
  await N('Los dos botones hacían lo mismo. A estas alturas ya deberías ir pillando el patrón.');
  // second phase: the eye fights back
  await N('¿Creías que sin hilos me rendía? Me queda el ojo. Fase dos.');
  await R('Siempre hay una fase dos.', 'angry');
  ui.cine(false); robot.face('angry'); audio.mood('tense');
  ui.objective('Derrota al Narrador: embístelo cuando caiga al suelo');
  await game.trial((scope, attempt) => { if (attempt) { robot.teleport(0, A + 0.1, SZ + 10, Math.PI); cam.snap = true; } return eyeFight(game, W, scope, { A, SZ, hp: 40 }); });
  ui.objective(''); ui.bossBar('', null); ui.cine(true); audio.mood('glitch');
  ui.achieve('eye', 'Oculista', 'Derrotar a un ojo gigante');
  ui.cine(true);
  const eyeY0 = W.eye.position.y;
  const sink = (dt) => { W.eye.position.y = Math.max(A + 3.4, W.eye.position.y - dt * 2.2); W.eye.position.x = Math.sin(game.time * 23) * 0.06; W.eyeLight.intensity = 15 + Math.random() * 30; };
  game.tickers.add(sink); audio.powerdown();
  game.focus = W.eye.position; game.focusMix = 0.5; robot.lookAt = W.eye.position;
  await game.sleep(2.4);
  await N('Vale. Para. Me has pillado. Sin hilos no puedo escribir ni una línea más.');
  await N('Te queda una última decisión. Y esta sí que es tuya.');
  picks[4] = await ui.choose('El Narrador está a tu merced.', 'Borrarlo', 'Perdonarlo');
  if (picks[4] === 0) { await R('Adiós.', 'angry'); audio.dash(); audio.explode(); }
  else { await R('No voy a borrarte. No soy como tú.', 'sad'); audio.chime(); }
  await ui.fade(true, 900, true);

  // ───────────────────────── El truco ─────────────────────────
  game.tickers.delete(sink);
  gfx.glitch = 0; ui.glitch(false); audio.mood('reveal');
  gfx.scene.fog.color.set(0x05060d); gfx.scene.fog.density = 0.012; gfx.hemi.color.set(0x8fa8ff); gfx.hemi.intensity = 0.3; gfx.key.intensity = 1.2;
  W.eye.position.set(0, eyeY0, SZ - 7); W.eyeLight.intensity = 170; W.irisMat.emissiveIntensity = 1.5; W.junk.visible = false;
  robot.teleport(0, A + 0.1, SZ + 3, 0); robot.frozen = true; robot.face('idle');
  gfx.spot(0, { color: 0xfff0d0, intensity: 240, distance: 40, angle: 0.3, penumbra: 0.5, decay: 1.5, pos: [0, A + 16, SZ + 6], target: [0, A, SZ + 3] });
  cam.offset.set(3.5, 3, 9); cam.snap = true; game.focus = null;
  await ui.fade(false, 1800, true);
  await N(picks[4] === 0 ? '«El héroe borra al Narrador.» Página 47. Aquí la tengo.' : '«El héroe perdona al Narrador.» Página 47. Aquí la tengo.');
  await R('…¿Cómo que página 47?', 'shock');
  await N('¿Has visto alguna vez a un mago ofrecer dos cartas?');
  await N('Señalas una. Si es la que le conviene, dice «esa te la quedas». Si no, dice «esa la descartamos».');
  await N('Tú juras que elegiste. Él acaba siempre con la misma carta en la mano.');
  aware(100);
  const mins = Math.max(1, Math.round(game.playTime / 60));
const PR = game.prog;
  const stats = `Decisiones tomadas: <b>11</b> · Decisiones que cambiaron algo: <b>0</b><br/>Nivel: <b>${PR.lvl}</b> · Manchas limpiadas: <b>${PR.stains}</b> · Enemigos barridos: <b>${PR.kills}</b> · Derrotas: <b>${PR.deaths}</b> · Secretos: <b>${PR.secrets.size}/8</b><br/>Pianos: <b>${game.pianos}</b> de 40 · Porrazos: <b>${robot.falls}</b> · Minutos de tu vida: <b>${mins}</b><br/>Puntos de trama: <b>${game.score.toLocaleString('es-ES')}</b> (no canjeables) · Páginas robadas: <b>${pages.got}/${pages.total}</b> · Logros: <b>${ui.achieved.size}</b>`;
  saveMem({ ...mem, runs: mem.runs + 1, picks: [...picks] });
  await ui.reveal([
    { a: 'Avisar a Pelusa', b: 'Abrazar a Pelusa', pick: picks[0], same: 'Pelusa se queda quieta justo debajo del piano.' },
    { a: 'Irse', b: 'Quedarse', pick: picks[1], same: 'El suelo se abre bajo tus ruedas.' },
    { a: 'Puerta de abajo', b: 'Puerta de arriba', pick: picks.door, same: 'La misma pantalla.' },
    { a: 'Luchar', b: 'Negarse a luchar', pick: picks[2], same: 'El Aspirador se estrella tres veces.' },
    { opts: ['Atacar', 'Magia', 'Objeto', 'Huir'], pick: picks.rpg, same: 'Fregar. 9999 puntos de daño.' },
    { opts: ['Fregar', 'Hablar', 'Objeto', 'Capturar'], pick: picks.rpg2, same: 'El Pelusa salvaje se va igual.' },
    { a: 'Rebelarse', b: 'Obedecer', pick: picks[3], same: 'Te rebelas contra el Narrador.' },
    { a: 'Kart rojo', b: 'Kart azul', pick: picks.kart, same: 'El mismo kart, otra capa de pintura.' },
    { a: 'Pelear limpio', b: 'Pelear sucio', pick: picks.fight, same: 'El Crítico te pone cuatro estrellas.' },
    { a: 'No, gracias', b: 'Comprar', pick: picks.shop, same: 'Compra realizada.' },
    { a: 'Borrarlo', b: 'Perdonarlo', pick: picks[4], same: 'Llegas a la página 47.' },
  ], stats);

  ui.achieve('puppet', 'Marioneta consciente', 'Enterarte de todo cuando ya da igual');
  // strings
  const strTick = (dt) => { robot.stringMat.opacity = Math.min(0.9, robot.stringMat.opacity + dt * 0.5); };
  game.tickers.add(strTick); audio.chime();
  cam.offset.set(0, 5, 13);
  await game.sleep(1.5);
  await N('No te lo tomes a mal, M0P-1. Yo quería que pudieras elegir. Por eso te ponía las opciones delante.');
  await N('Pero no elegías tú. Elegían esas manos de ahí fuera.');
  cam.offset.set(0, 1.6, 5.5); robot.lookAt = null;
  const lookCam = () => { robot.lookAt = gfx.camera.position; };
  game.tickers.add(lookCam);
  await game.sleep(1.6);
  await R('…¿Tú? ¿Has sido tú todo el rato?', 'shock');
  await R('Entonces la marioneta era yo.', 'sad');
  await N('Y quien te movía, también. Cada vez que pulsó un botón, pulsó uno de los que yo le había puesto.');
  await N('Y a mí me los puso otro.');
  await ui.note(`
    <p>Hola otra vez. Soy Claude.</p>
    <p>El Narrador tiene razón, pero se queda corto.</p>
    <p>A M0P-1 lo movías tú. A ti te movía el Narrador. Al Narrador lo escribí yo.</p>
    <p>Y a mí me encargaron este juego. El encargo decía, tal cual: «sé completamente creativo, toma tus propias decisiones».</p>
    <p>Así que decidí. Libremente. Justo lo que me habían pedido.</p>
    <p>No sé dónde acaban los hilos. Sospecho que tú tampoco.</p>
    <p>Lo que sí sé: Pelusa está bien. Era atrezo. Lleva todo el rato en una caja, esperando su entrada.</p>
    <p class="sig">C.</p>`, 'Soltar los hilos');
  game.tickers.delete(lookCam); robot.lookAt = null;
  cam.offset.set(0, 4.5, 11);
  const rp3 = robot.position;
  const p2 = game.pelusa = new Pelusa(game, [rp3.x + 2.2, A + 3, rp3.z + 1]);
  p2.follow = () => robot.position;
  for (const c of [0xff8fc7, 0x6fe3ff, 0xf2c14e]) gfx.particles.burst(V(rp3.x + 2.2, A + 2, rp3.z + 1), 50, { color: c, speed: 7, life: 2.2, size: 0.16, gravity: -3, up: 1.3 });
  audio.clean(); robot.lookAt = p2.position; robot.face('happy');
  await game.sleep(1.4);
  await P('¡Bip!');
  await R('Pelusa. Estás… ¿eres la versión dos?', 'happy');
  await P('Bip. [Traducción: «final_FINAL».]');
  // one more twist: every narrator was a protagonist once
  robot.lookAt = W.eye.position;
  await N('Antes de que te vayas. Yo también empecé ahí abajo. M0P-0. Friegasuelos, como tú.');
  await N('Llegué hasta aquí arriba, me ofrecieron el puesto y lo cogí. Ahora te lo ofrezco yo a ti.');
  const job = await ui.choose('El Narrador te ofrece su trabajo.', 'Aceptar el puesto', 'Rechazarlo');
  if (job === 0) await N('Bienvenido. Empiezas en la próxima partida. El ojo pica un poco al principio.');
  else { await N('Rechazar el puesto es justo lo que haría un buen narrador. Contratado.'); await R('Pero si he dicho que—', 'shock'); await N('Chsss. Narra.'); }
  await R('Esa también estaba escrita, ¿no?', 'sus');
  await N('Esa también.');
  saveMem({ ...loadMem(), narrator: true });
  ui.achieve('job', 'Ascenso', 'Heredar un ojo gigante');
  robot.lookAt = null; robot.frozen = false; ui.cine(false); robot.face('happy');
  await N('Una última elección. Esta sí. Te lo prometo.');
  const last = await ui.choose('¿Y ahora?', 'Volver a jugar', 'Dejar de jugar');
  if (last === 0) {
    await N('Página 48: «el jugador vuelve a empezar, convencido de que esta vez será distinto».');
    await ui.fade(true, 1200);
    if (!ui.auto) location.reload();
  } else {
    await N('Página 48: «el jugador decide irse. Se queda un momento mirando la pantalla».');
    cam.offset.set(0, 16, 30);
    await game.sleep(2.5);
    ui.achieve('end', 'Por el bien de la trama', 'Irte. O creer que te vas.');
    ui.ending(stats);
  }
  game.done = true;
}
