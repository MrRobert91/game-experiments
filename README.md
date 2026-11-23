# Por el bien de la trama

Un juego narrativo en 3D que sabe que es un juego. Eres M0P-1, un robot de limpieza que empieza la partida leyendo una nota de su creador: está dentro de un juego, su trabajo es entretener a quien mira, y el Narrador hará lo que haga falta para que la historia funcione. Lo que haga falta incluye pianos.

Dura unos cuarenta minutos. Hay once decisiones. Conviene jugarlo dos veces: el juego se acuerda de ti.

## Qué hay dentro

El Narrador cambia de género cada vez que el robot se queja, así que la partida pasa por:

- un tutorial de fregar y otro, que nadie pidió, de la **turbofregona** (mantén el botón y suelta)
- un piano, un "pulsa para sentir tristeza" y unos créditos falsos a los tres minutos
- un **plataformas 2D** de 8 bits, largo, con plataformas móviles, muelles y tres corazones: si los pierdes, el nivel empieza de nuevo
- un **combate por turnos** donde todas las órdenes hacen lo mismo, con Pelusa salvaje, subida de nivel, cambio de clase, un cono que se une al grupo y un parche del día uno
- el combate contra El Aspirador en **estilo cómic**, con barriles rojos que explotan en cadena
- un interludio de **sigilo en cine negro** con guardias de cartón
- el **Almacén de Atrezo**: un nivel grande para explorar, con tres nidos de pelusas, calcetines y grapadoras que barrer, 8 secretos, objetos con los que interactuar y el **Pulverizador 3000**, un arma que dispara sola
- una **carrera de karts** a tres vueltas contra El Productor, con derrapes, turbos y cáscaras de plátano
- un puente sin terminar con láseres, guantes de boxeo, una cinta transportadora que va al revés, bolos rodando y **pianos con patas**
- un **matamarcianos** contra El Deadline
- tres oleadas de extras que barrer en el escenario del Narrador
- un **juego de lucha 2D con físicas** contra El Crítico: dos muñecos de trapo que se zurran
- el jefe final en dos fases: primero cortar los hilos de la trama, luego un ojo gigante con barra de vida que lanza rayos, ondas, pianos, adverbios y extras
- y el truco de cartas del final, con un giro más detrás

## Progresión

M0P-1 tiene **corazones**. Los golpes quitan uno (salvo si estás embistiendo: la embestida esquiva). Si te quedas sin corazones, el Narrador repite la toma desde un poco antes; tras dos derrotas seguidas te regala corazones extra.

Barrer enemigos y limpiar manchas da **experiencia**: cada nivel suma un corazón y acorta la recarga de la embestida. El HUD lleva la cuenta de las **manchas limpiadas**, y a las 10, 25 y 40 desbloqueas mejoras (turbofregona más rápida, un corazón más, pulverizador doble).

Por el camino: 8 páginas del guion, 8 secretos en el almacén, unos 40 logros absurdos y un Narrador que comenta si cambias de pestaña, le quitas el sonido, te saltas los diálogos o juegas de madrugada.

## El protagonista

M0P-1 es un pequeño robot naranja generado, riggeado y animado con la API de [Tripo3D](https://www.tripo3d.ai/) (`src/assets/m0p1.glb`, 2,5 MB). Lleva diez animaciones de Tripo (reposo, andar, correr, salto, caída, voltereta, golpe…) que se mezclan según lo que hace el cuerpo físico, y las caras de siempre se dibujan sobre su visor. Para regenerarlo:

```bash
export TRIPO_API_KEY=...
python3 tools/tripo.py model "..."      # el prompt exacto está en tools/tripo.py
python3 tools/tripo.py rig <tarea>
python3 tools/tripo.py retarget <rig> preset:idle preset:walk preset:run preset:jump preset:fall
python3 tools/tripo.py wait <tarea> salida.glb
blender -b --python tools/merge_clips.py -- animA.glb animB.glb src/assets/m0p1.glb
```

## Jugar

Con Docker:

```bash
docker compose up --build
# http://localhost:8080
```

o sin compose:

```bash
docker build -t por-el-bien-de-la-trama .
docker run --rm -p 8080:80 por-el-bien-de-la-trama
```

En local, con Node 20 o superior:

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # genera dist/
```

## Controles

Un stick y un botón.

| | Moverse | Embestir | Diálogos y decisiones |
|---|---|---|---|
| Teclado | WASD o flechas | Espacio (mantener y soltar: turbofregona) | Espacio / Enter, teclas 1 y 2, o clic |
| Móvil | arrastrar en cualquier parte de la pantalla | botón de la derecha (mantener y soltar: turbofregona) | tocar |

El mismo botón salta en el plataformas, suelta la bomba de espuma en el matamarcianos, derrapa en el kart (mantener al girar) y pega en la pelea 2D (tocar: puñetazo; mantener y soltar: fregonazo; stick arriba: saltar). La embestida atraviesa los láseres y la turbofregona rompe cajas, barriles y pianos con patas.

Funciona en vertical y en horizontal. En móvil el juego baja solo la resolución si el dispositivo no llega.

## Cómo está hecho

- **three.js** para el render: materiales PBR, sombras, bloom, tone mapping ACES y un pase final propio con cinco estilos intercambiables en caliente (normal, 8 bits con tramado, cine negro, cómic con tinta y semitonos, CRT), además de aberración cromática, desenfoque de velocidad, grano y glitch.
- Una capa **2D en canvas** a baja resolución con sprites de píxeles escritos a mano en el código, para el plataformas, el matamarcianos y el combate por turnos.
- **Rapier** (WASM) para las físicas. M0P-1 es un ragdoll activo: un cuerpo que se mantiene de pie corrigiendo su velocidad angular, con la cabeza en una bisagra que el hueso de la cabeza del modelo copia encima de la animación. Cuando algo le da un golpe se queda sin control, rueda como un muñeco y luego se levanta. El jefe arrastra una manguera hecha de la misma forma.
- Todo es procedural salvo el protagonista (un GLB de Tripo3D): el resto de la geometría se genera en código, las texturas se pintan en canvas y la música y los efectos se sintetizan con Web Audio.
- La partida anterior se guarda en `localStorage` (solo cuántas veces has jugado y qué elegiste) para que el Narrador pueda echártelo en cara.
- Rendimiento: las luces locales salen de un grupo fijo que las escenas se van prestando (cambiar el número de luces recompila todos los shaders), y al cargar se dibuja un fotograma con todo visible para compilar shaders y subir texturas detrás de la pantalla de carga. En móvil el bloom va a un cuarto de resolución y la resolución general se ajusta sola.
- Ningún tramo puede dejarte atascado: si tardas demasiado en un tutorial, una puerta o un minijuego, el Narrador se impacienta y te lleva él.
- Sin framework. Vite empaqueta y nginx sirve el resultado.

```
src/
  assets/   m0p1.glb (el protagonista, generado y animado con Tripo3D)
  engine/   gfx.js (render y postprocesado), physics.js, input.js, audio.js
  game/     robot.js, actors.js, world.js, ui.js, story.js (el guion entero),
            mini2d.js (plataformas, matamarcianos, combate por turnos), fight2d.js (la pelea),
            kart.js (la carrera), levels.js (almacén, oleadas, obstáculos, jefe final),
            combat.js (vida, derrotas, experiencia, enemigos, arma), extras.js (gags y peligros)
  main.js   bucle principal
tools/      tripo.py (cliente de la API de Tripo3D), merge_clips.py (une las animaciones en Blender)
```

## Parámetros de URL

- `?q=low` o `?q=high` fuerza la calidad gráfica.
- `?auto=A` o `?auto=B` juega solo, eligiendo siempre la primera o la última opción, con todas las esperas comprimidas. Sirve de prueba rápida de que la historia llega al final.
- `?auto=A&real=1` hace lo mismo a ritmo humano: escribe los diálogos, carga la turbofregona de verdad y juega los minijuegos enteros. Es la prueba que detecta bloqueos.
- `?mini=platformer`, `?mini=shmup` o `?mini=fight` abre directamente un minijuego 2D.
