# Por el bien de la trama

Un juego narrativo en 3D que sabe que es un juego. Eres M0P-1, un robot de limpieza que empieza la partida leyendo una nota de su creador: está dentro de un juego, su trabajo es entretener a quien mira, y el Narrador hará lo que haga falta para que la historia funcione. Lo que haga falta incluye pianos.

Dura entre quince y veinte minutos. Hay ocho decisiones. Conviene jugarlo dos veces: el juego se acuerda de ti.

## Qué hay dentro

El Narrador cambia de género cada vez que el robot se queja, así que la partida pasa por:

- un tutorial de fregar y otro, que nadie pidió, de la **turbofregona** (mantén el botón y suelta)
- un piano, un duelo con barra de "pulsa para sentir tristeza" y unos créditos falsos a los tres minutos
- un **plataformas 2D** de 8 bits con sprites, porque se acabó el presupuesto 3D
- un **combate por turnos** donde Atacar, Magia, Objeto y Huir hacen lo mismo
- el combate de verdad, en **estilo cómic**, con barriles rojos que explotan en cadena
- un interludio de **sigilo en cine negro** con guardias de cartón
- un puente sin terminar con láseres giratorios, lluvia de pianos y **pianos con patas**
- un **matamarcianos** contra El Deadline
- un jefe final que te tira adverbios, te invierte los controles, te vende un DLC y cuelga el juego de mentira
- y el truco de cartas del final, con un giro más detrás

Por el camino: 8 páginas del guion escondidas, unos 30 logros absurdos, puntos de trama que no sirven para nada y un Narrador que comenta si cambias de pestaña, si le quitas el sonido, si te saltas los diálogos o si juegas de madrugada.

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

El mismo botón salta en el plataformas y suelta la bomba de espuma en el matamarcianos. La embestida atraviesa los láseres y la turbofregona rompe cajas, barriles y pianos con patas.

Funciona en vertical y en horizontal. En móvil el juego baja solo la resolución si el dispositivo no llega.

## Cómo está hecho

- **three.js** para el render: materiales PBR, sombras, bloom, tone mapping ACES y un pase final propio con cinco estilos intercambiables en caliente (normal, 8 bits con tramado, cine negro, cómic con tinta y semitonos, CRT), además de aberración cromática, desenfoque de velocidad, grano y glitch.
- Una capa **2D en canvas** a baja resolución con sprites de píxeles escritos a mano en el código, para el plataformas, el matamarcianos y el combate por turnos.
- **Rapier** (WASM) para las físicas. M0P-1 es un ragdoll activo: un cuerpo que se mantiene de pie corrigiendo su velocidad angular, con cabeza y brazos colgando de articulaciones esféricas. Cuando algo le da un golpe se queda sin control, rueda como un muñeco y luego se levanta. El jefe arrastra una manguera hecha de la misma forma.
- Todo es procedural. No hay modelos, texturas ni audio descargados: la geometría se genera en código, las texturas se pintan en canvas y la música y los efectos se sintetizan con Web Audio.
- La partida anterior se guarda en `localStorage` (solo cuántas veces has jugado y qué elegiste) para que el Narrador pueda echártelo en cara.
- Sin framework. Vite empaqueta y nginx sirve el resultado.

```
src/
  engine/   gfx.js (render y postprocesado), physics.js, input.js, audio.js
  game/     robot.js, actors.js, world.js, ui.js, story.js (el guion entero),
            mini2d.js (los juegos 2D), extras.js (coleccionables, gags, obstáculos)
  main.js   bucle principal
```

## Parámetros de URL

- `?q=low` o `?q=high` fuerza la calidad gráfica.
- `?auto=A` o `?auto=B` juega solo, eligiendo siempre la primera o la segunda opción. Sirve para probar que la historia llega al final.
