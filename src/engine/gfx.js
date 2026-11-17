import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FinalFX = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uGlitch: { value: 0 }, uVignette: { value: 0.9 }, uAberration: { value: 0.0025 },
    uGrain: { value: 0.045 }, uFlash: { value: 0 }, uDesat: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uTint: { value: new THREE.Color(1, 1, 1) }, uMode: { value: 0 }, uPixel: { value: 1 }, uSpeed: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse; uniform float uTime, uGlitch, uVignette, uAberration, uGrain, uFlash, uDesat, uMode, uPixel, uSpeed; uniform vec2 uRes; uniform vec3 uTint;
    float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    void main(){
      vec2 uv = vUv; float g = uGlitch;
      if (uMode > 3.5) { vec2 cc = uv - .5; uv = .5 + cc * (1. + dot(cc, cc) * .22); }
      if (uPixel > 1.5) uv = (floor(uv * uRes / uPixel) + .5) * uPixel / uRes;
      if (g > 0.001) {
        float line = floor(uv.y * 36. + uTime * 5.);
        float n = hash(vec2(line, floor(uTime * 12.)));
        if (n > 1. - g * .3) uv.x += (hash(vec2(line, 3.)) - .5) * .1 * g;
        float blk = hash(floor(uv * vec2(9., 6.)) + floor(uTime * 6.));
        if (blk > 1. - g * .06) uv += (vec2(hash(vec2(blk, 1.)), hash(vec2(blk, 2.))) - .5) * .08;
      }
      vec2 d = uv - .5; float r2 = dot(d, d);
      float ab = uAberration * (.5 + r2 * 5.) + g * .008;
      vec3 c;
      c.r = texture2D(tDiffuse, uv + d * ab).r;
      c.g = texture2D(tDiffuse, uv).g;
      c.b = texture2D(tDiffuse, uv - d * ab).b;
      if (uSpeed > .01) { vec3 a = c; for (int i = 1; i < 6; i++) a += texture2D(tDiffuse, uv - d * uSpeed * .035 * float(i)).rgb; c = a / 6.; }
      if (uMode > .5 && uMode < 1.5) { // 8-bit: ordered dither + few colours
        vec2 px = floor(vUv * uRes / max(uPixel, 1.));
        float dth = (mod(px.x, 2.) + mod(px.y, 2.) * 2.) / 4. - .375;
        c = floor(c * 5. + .5 + dth) / 5.; c = mix(vec3(lum(c)), c, 1.35);
      } else if (uMode > 1.5 && uMode < 2.5) { // noir: only red survives
        float l0 = lum(c); float red = smoothstep(.12, .4, c.r - max(c.g, c.b));
        vec3 bw = vec3(clamp(pow(l0, 1.25) * 1.25, 0., 1.)) * vec3(1., .98, .93);
        c = mix(bw, vec3(l0 * 2.4, 0., 0.) + bw * .15, red);
        c *= .9 + .1 * step(.5, fract(vUv.y * 3. + uTime * .2));
      } else if (uMode > 2.5 && uMode < 3.5) { // comic: ink lines, flat colour, halftone shadows
        vec2 e = 1.4 / uRes; float gx = 0., gy = 0.;
        for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
          float s = lum(texture2D(tDiffuse, uv + vec2(float(i), float(j)) * e).rgb);
          gx += s * float(i) * (j == 0 ? 2. : 1.); gy += s * float(j) * (i == 0 ? 2. : 1.);
        }
        float edge = smoothstep(.25, .6, length(vec2(gx, gy)));
        float l0 = lum(c); c = floor(c * 5. + .5) / 5.; c = mix(vec3(lum(c)), c, 1.25);
        vec2 hp = vUv * uRes / 7.; hp = fract(mat2(.707, -.707, .707, .707) * hp) - .5;
        c *= 1. - step(length(hp), (.5 - l0) * .75) * .35;
        c = mix(c, vec3(.02, .01, .05), edge);
      } else if (uMode > 3.5) { // CRT
        c *= .82 + .18 * sin(vUv.y * uRes.y * 1.6); c *= 1.15;
        c.g *= .96 + .04 * sin(vUv.x * uRes.x * 2.);
        if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) c = vec3(0.);
      }
      c *= 1. - g * .1 * step(.5, fract(uv.y * uRes.y * .25));
      float l = dot(c, vec3(.299, .587, .114));
      c = mix(c, vec3(l), uDesat);
      c *= uTint;
      // gentle filmic split-toning: cool shadows, warm highlights
      c += (vec3(-.012, .0, .022) * (1. - l) + vec3(.02, .008, -.012) * l);
      float v = smoothstep(.95, .25, length(d * vec2(1.05, 1.25)));
      c *= mix(1., v, uVignette);
      c += (hash(uv * uRes + fract(uTime) * 91.7) - .5) * uGrain;
      c = mix(c, vec3(1.), uFlash);
      gl_FragColor = vec4(c, 1.);
    }`,
};

export class Gfx {
  constructor(canvas) {
    const qp = new URLSearchParams(location.search).get('q');
    const mobile = matchMedia('(hover: none) and (pointer: coarse)').matches;
    this.low = qp ? qp === 'low' : mobile;
    this.maxPR = this.low ? 1.35 : 1.75;
    this.pr = Math.min(devicePixelRatio || 1, this.maxPR);

    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    r.setPixelRatio(this.pr);
    r.setSize(innerWidth, innerHeight, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070a18, 0.011);
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 600);

    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pm.dispose();

    // lights
    this.hemi = new THREE.HemisphereLight(0x8fa8ff, 0x1a1024, 0.55);
    this.scene.add(this.hemi);
    const key = this.key = new THREE.DirectionalLight(0xffe2c0, 2.4);
    key.castShadow = true;
    const S = this.low ? 1024 : 2048;
    key.shadow.mapSize.set(S, S);
    Object.assign(key.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 110 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.04; key.shadow.radius = 3;
    this.keyDir = new THREE.Vector3(0.45, 1, 0.35).normalize();
    this.scene.add(key, key.target);
    const rim = this.rim = new THREE.DirectionalLight(0x5aa0ff, 0.9);
    rim.position.set(-30, 20, -40);
    this.scene.add(rim);

    // post
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.low ? 0 : 4 });
    const c = this.composer = new EffectComposer(r, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.5, 0.65, 0.92);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.fx = new ShaderPass(FinalFX);
    c.addPass(this.fx);
    this.u = this.fx.uniforms;

    this.sky = makeSky();
    this.scene.add(this.sky);

    this.particles = new Particles(this.low ? 900 : 1800);
    this.scene.add(this.particles.points);
    this.dust = makeDust(this.low ? 160 : 380);
    this.scene.add(this.dust);

    // camera rig
    this.cam = {
      target: new THREE.Vector3(), offset: new THREE.Vector3(0, 9, 12), curOffset: new THREE.Vector3(0, 9, 12), look: new THREE.Vector3(),
      lookUp: 0.8, trauma: 0, fov: 42, stiff: 4, pos: new THREE.Vector3(0, 9, 12), snap: true,
    };
    this.time = 0; this.flash = 0; this.glitch = 0; this.glitchKick = 0; this.speed = 0;
    this._ft = 16; this._ftN = 0;

    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.u.uRes.value.set(w * this.pr, h * this.pr);
  }

  shake(t) { this.cam.trauma = Math.min(1, this.cam.trauma + t); }

  update(dt, rawDt) {
    this.time += rawDt;
    const cam = this.cam, camera = this.camera;
    // portrait: pull back so the stage still fits
    const asp = camera.aspect, pull = asp < 1 ? 1 + (1 - asp) * 1.1 : 1;
    const k = cam.snap ? 1 : 1 - Math.exp(-rawDt * cam.stiff);
    cam.curOffset.lerp(cam.offset, cam.snap ? 1 : 1 - Math.exp(-rawDt * 1.6));
    _v.copy(cam.target).addScaledVector(cam.curOffset, pull);
    cam.pos.lerp(_v, k);
    _v.copy(cam.target); _v.y += cam.lookUp;
    cam.look.lerp(_v, cam.snap ? 1 : 1 - Math.exp(-rawDt * (cam.stiff + 2)));
    cam.snap = false;
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    cam.trauma = Math.max(0, cam.trauma - rawDt * 1.3);
    const s = cam.trauma * cam.trauma, t = this.time * 38;
    camera.position.x += Math.sin(t * 1.1) * s * 0.5; camera.position.y += Math.sin(t * 1.7 + 2) * s * 0.4;
    camera.rotation.z += Math.sin(t * 0.9 + 1) * s * 0.05;
    if (Math.abs(camera.fov - cam.fov) > 0.01) { camera.fov += (cam.fov - camera.fov) * Math.min(1, rawDt * 3); camera.updateProjectionMatrix(); }

    // shadow light follows the action
    this.key.target.position.copy(cam.target);
    this.key.position.copy(cam.target).addScaledVector(this.keyDir, 55);
    this.sky.position.copy(camera.position);
    this.sky.material.uniforms.uTime.value = this.time;
    this.sky.material.uniforms.uGlitch.value = this.glitch;

    this.particles.update(dt);
    updateDust(this.dust, camera.position, this.time);

    this.flash = Math.max(0, this.flash - rawDt * 1.8);
    this.glitchKick = Math.max(0, this.glitchKick - rawDt * 1.5);
    this.u.uTime.value = this.time;
    this.u.uFlash.value = this.flash;
    this.speed = Math.max(0, this.speed - rawDt * 2.2); this.u.uSpeed.value = this.speed;
    this.u.uGlitch.value = Math.min(1, this.glitch * (0.25 + 0.25 * Math.sin(this.time * 2.3) ** 2) + this.glitchKick);

    // dynamic resolution: back off if the device struggles
    this._ft += (rawDt * 1000 - this._ft) * 0.05;
    if (++this._ftN > 150) {
      this._ftN = 0;
      if (this._ft > 26 && this.pr > 0.7) { this.pr = Math.max(0.7, this.pr - 0.2); this.resize(); }
      else if (this._ft < 14 && this.pr < Math.min(devicePixelRatio, this.maxPR) - 0.05) { this.pr = Math.min(Math.min(devicePixelRatio, this.maxPR), this.pr + 0.1); this.resize(); }
    }
  }

  /** swap the whole look: 'normal' | 'retro' | 'noir' | 'comic' | 'crt' */
  style(name) {
    const m = { normal: [0, 1, 0.045], retro: [1, 4, 0], noir: [2, 1, 0.11], comic: [3, 1, 0.01], crt: [4, 1, 0.07] }[name] || [0, 1, 0.045];
    this.styleName = name; this.u.uMode.value = m[0]; this.u.uPixel.value = m[1]; this.u.uGrain.value = m[2];
    this.bloom.strength = name === 'comic' ? 0.2 : name === 'noir' ? 0.4 : 0.5;
  }
  render() { this.composer.render(); }
}
const _v = new THREE.Vector3();

// ---------- sky ----------
function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uGlitch: { value: 0 }, uTop: { value: new THREE.Color(0x02030a) }, uMid: { value: new THREE.Color(0x0a1030) }, uLow: { value: new THREE.Color(0x1c0f2e) } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `
      precision highp float; varying vec3 vDir; uniform float uTime, uGlitch; uniform vec3 uTop, uMid, uLow;
      float hash(vec3 p){ p = fract(p * .3183099 + .1); p *= 17.; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * noise(p); p *= 2.03; a *= .5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = mix(uLow, uMid, smoothstep(-.6, .1, h));
        c = mix(c, uTop, smoothstep(.0, .8, h));
        float n = fbm(d * 2.4 + vec3(0., uTime * .008, 0.));
        float n2 = fbm(d * 5. - vec3(uTime * .01));
        c += vec3(.22, .09, .42) * pow(n, 3.5) * .9 + vec3(.04, .22, .34) * pow(n2, 4.5) * .8;
        vec3 g = floor(d * 190.); float s = hash(g);
        float star = step(.9975, s) * (.5 + .5 * sin(uTime * (1. + s * 4.) + s * 50.));
        c += vec3(1., .95, .85) * star * 1.6 * smoothstep(-.25, .2, h + .3);
        if (uGlitch > .001) {
          vec2 q = vec2(atan(d.z, d.x) * 12., d.y * 24.);
          float grid = max(step(.96, fract(q.x)), step(.96, fract(q.y)));
          c = mix(c, vec3(.1, .9, .7) * .6, grid * uGlitch * .55);
        }
        gl_FragColor = vec4(c, 1.);
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 20), mat);
  m.frustumCulled = false; m.renderOrder = -10;
  return m;
}

// ---------- particles ----------
const softDot = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();

const pointMat = (blend) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: blend, uniforms: { uMap: { value: softDot } },
  vertexShader: `attribute float aSize; attribute vec4 aColor; varying vec4 vC;
    void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * (320. / -mv.z); }`,
  fragmentShader: `uniform sampler2D uMap; varying vec4 vC; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); }`,
});

class Particles {
  constructor(n) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.col = new Float32Array(n * 4); this.size = new Float32Array(n);
    this.life = new Float32Array(n); this.max = new Float32Array(n); this.grav = new Float32Array(n); this.base = new Float32Array(n); this.drag = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.points = new THREE.Points(g, pointMat(THREE.AdditiveBlending));
    this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  burst(p, count, { color = 0xffffff, speed = 4, life = 1, size = 0.25, gravity = -6, up = 0.5, spread = 1, drag = 1.5, dir = null } = {}) {
    const c = _c.set(color);
    for (let k = 0; k < count; k++) {
      const i = this.i = (this.i + 1) % this.n, a = Math.random() * 6.283, u = Math.random() * 2 - 1, s = Math.sqrt(1 - u * u), sp = speed * (0.3 + Math.random() * 0.7);
      this.pos[i * 3] = p.x + (Math.random() - 0.5) * spread * 0.3; this.pos[i * 3 + 1] = p.y + (Math.random() - 0.5) * spread * 0.3; this.pos[i * 3 + 2] = p.z + (Math.random() - 0.5) * spread * 0.3;
      this.vel[i * 3] = Math.cos(a) * s * sp * spread + (dir ? dir.x * speed : 0);
      this.vel[i * 3 + 1] = Math.abs(u) * sp * up * 2 + (dir ? dir.y * speed : 0);
      this.vel[i * 3 + 2] = Math.sin(a) * s * sp * spread + (dir ? dir.z * speed : 0);
      const j = 0.8 + Math.random() * 0.4;
      this.col[i * 4] = c.r * j; this.col[i * 4 + 1] = c.g * j; this.col[i * 4 + 2] = c.b * j; this.col[i * 4 + 3] = 1;
      this.life[i] = this.max[i] = life * (0.5 + Math.random() * 0.7); this.base[i] = size * (0.5 + Math.random()); this.grav[i] = gravity; this.drag[i] = drag;
    }
  }
  update(dt) {
    const { pos, vel, col, size, life, max } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) { if (size[i] !== 0) { size[i] = 0; col[i * 4 + 3] = 0; } continue; }
      life[i] -= dt;
      const d = Math.exp(-dt * this.drag[i]);
      vel[i * 3] *= d; vel[i * 3 + 2] *= d; vel[i * 3 + 1] = vel[i * 3 + 1] * d + this.grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const t = Math.max(0, life[i] / max[i]);
      col[i * 4 + 3] = t; size[i] = this.base[i] * (0.4 + 0.6 * t);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = g.attributes.aColor.needsUpdate = g.attributes.aSize.needsUpdate = true;
  }
}
const _c = new THREE.Color();

function makeDust(n) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), col = new Float32Array(n * 4), s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    p[i * 3] = (Math.random() - 0.5) * 50; p[i * 3 + 1] = Math.random() * 16; p[i * 3 + 2] = (Math.random() - 0.5) * 50;
    col[i * 4] = 1; col[i * 4 + 1] = 0.9; col[i * 4 + 2] = 0.75; col[i * 4 + 3] = 0.1 + Math.random() * 0.28; s[i] = 0.04 + Math.random() * 0.1;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(s, 1));
  const m = new THREE.Points(g, pointMat(THREE.AdditiveBlending)); m.frustumCulled = false; m.userData.seed = p.slice();
  return m;
}
function updateDust(d, cam, t) {
  const p = d.geometry.attributes.position.array, s = d.userData.seed, n = p.length / 3;
  for (let i = 0; i < n; i++) {
    const x = s[i * 3] + Math.sin(t * 0.2 + i) * 1.2, y = s[i * 3 + 1] + Math.sin(t * 0.13 + i * 1.7) * 0.8, z = s[i * 3 + 2] + Math.cos(t * 0.17 + i) * 1.2;
    p[i * 3] = cam.x + ((((x - cam.x) % 50) + 75) % 50) - 25;
    p[i * 3 + 1] = cam.y - 8 + (((y - cam.y) % 16) + 16) % 16;
    p[i * 3 + 2] = cam.z + ((((z - cam.z) % 50) + 75) % 50) - 25;
  }
  d.geometry.attributes.position.needsUpdate = true;
}

// ---------- helpers ----------
export function lightCone(height, radius, color, opacity = 0.16) {
  const geo = new THREE.ConeGeometry(radius, height, 40, 1, true);
  geo.translate(0, -height / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOp: { value: opacity }, uH: { value: height } },
    vertexShader: `varying float vY; varying vec3 vN, vV; uniform float uH;
      void main(){ vY = -position.y / uH; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOp; varying float vY; varying vec3 vN, vV;
      void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = f * (1. - smoothstep(.0, 1., vY)) * smoothstep(0., .06, vY) * uOp; gl_FragColor = vec4(uColor, a); }`,
  });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 4;
  return m;
}

export function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function noiseTex(size = 256, { contrast = 1, base = 150, scratches = 0, repeat = [1, 1] } = {}) {
  return canvasTex(size, size, (g, w, h) => {
    g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, w, h);
    for (let o = 0; o < 4; o++) {
      const n = 60 * (o + 1) * (o + 1), r = (w / 6) / (o + 1);
      for (let i = 0; i < n; i++) {
        const v = Math.random() < 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${0.05 * contrast})`;
        g.beginPath(); g.arc(Math.random() * w, Math.random() * h, r * (0.4 + Math.random()), 0, 7); g.fill();
      }
    }
    for (let i = 0; i < scratches; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.15})`; g.lineWidth = 0.5 + Math.random();
      const x = Math.random() * w, y = Math.random() * h, a = Math.random() * 7, l = 10 + Math.random() * 60;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, { srgb: false, repeat });
}

export function textTex(lines, { w = 1024, h = 256, bg = null, color = '#fff', font = '700 110px system-ui, sans-serif', glow = null, border = null } = {}) {
  return canvasTex(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28); }
    g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
    if (glow) { g.shadowColor = glow; g.shadowBlur = 30; }
    const arr = Array.isArray(lines) ? lines : [lines];
    arr.forEach((t, i) => g.fillText(t, w / 2, h * (i + 0.5) / arr.length + 4, w - 60));
  });
}
