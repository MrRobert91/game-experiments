# Por el bien de la trama

Un juego narrativo en 3D que sabe que es un juego. Eres M0P-1, un robot de limpieza que empieza la partida leyendo una nota de su creador: está dentro de un juego, su trabajo es entretener a quien mira, y el Narrador hará lo que haga falta para que la historia funcione. Lo que haga falta incluye pianos.

Dura unos diez minutos. Hay cinco decisiones. Conviene jugarlo dos veces.

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
| Teclado | WASD o flechas | Espacio | Espacio / Enter, teclas 1 y 2, o clic |
| Móvil | arrastrar en cualquier parte de la pantalla | botón de la derecha | tocar |

Funciona en vertical y en horizontal. En móvil el juego baja solo la resolución si el dispositivo no llega.

## Cómo está hecho

- **three.js** para el render: materiales PBR, sombras, bloom, tone mapping ACES y un pase final propio (aberración cromática, viñeta, grano y el efecto de glitch del tercer acto).
- **Rapier** (WASM) para las físicas. M0P-1 es un ragdoll activo: un cuerpo que se mantiene de pie corrigiendo su velocidad angular, con cabeza y brazos colgando de articulaciones esféricas. Cuando algo le da un golpe se queda sin control, rueda como un muñeco y luego se levanta. El jefe arrastra una manguera hecha de la misma forma.
- Todo es procedural. No hay modelos, texturas ni audio descargados: la geometría se genera en código, las texturas se pintan en canvas y la música y los efectos se sintetizan con Web Audio.
- Sin framework. Vite empaqueta y nginx sirve el resultado.

```
src/
  engine/   gfx.js (render y postprocesado), physics.js, input.js, audio.js
  game/     robot.js, actors.js, world.js, ui.js, story.js (el guion entero)
  main.js   bucle principal
```

## Parámetros de URL

- `?q=low` o `?q=high` fuerza la calidad gráfica.
- `?auto=A` o `?auto=B` juega solo, eligiendo siempre la primera o la segunda opción. Sirve para probar que la historia llega al final.
