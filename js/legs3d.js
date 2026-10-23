// Agach base collection in three.js: each base from the workshop's catalogue, built from steel profiles,
// bent rods, chain links and turned brass. A new choice sinks the old base into the floor and raises the next.
// Epoxy 2.0 ilə eyni modellər (~/epoxy-az/src/sig/legs.js); gsap səhifədə qlobal yüklənir.
// Adlar və təsvirlər DOM-dan oxunur ki, i18n.js-in tərcüməsi WhatsApp mətninə də düşsün.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const { gsap } = window;

const H = 0.74; // dining height, m
const LOW = 0.42; // coffee table height
const T = 0.045; // top thickness
const X0 = 0.6; // end frames sit this far from the middle
const DZ = 0.34; // half width of an end frame
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);

/* ---------- geometry helpers ---------- */
// a straight profile from a to b: w runs along `side` (projected square to the bar), d across it
function bar(a, b, w, d, side = V(1, 0, 0)) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  dir.normalize();
  let x = side.clone().sub(dir.clone().multiplyScalar(side.dot(dir)));
  if (x.lengthSq() < 1e-6) x = (Math.abs(dir.y) < 0.9 ? Y : V(1, 0, 0)).clone().cross(dir);
  x.normalize();
  const z = x.clone().cross(dir);
  const g = new THREE.BoxGeometry(w, len, d);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, dir, z).setPosition(a.clone().add(b).multiplyScalar(0.5)));
  return g;
}
const tube = (pts, r, closed = false, seg = 64) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed, 'centripetal'), seg, r, 10, closed);
const ring = (r, y, t) => { const g = new THREE.TorusGeometry(r, t, 10, 96); g.rotateX(Math.PI / 2); g.translate(0, y, 0); return g; };
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
// turned parts: [r, y] control points smoothed into a lathe profile
function turned(ctrl, n = 120) {
  const c = new THREE.SplineCurve(ctrl.map(([r, y]) => new THREE.Vector2(r, y)));
  return new THREE.LatheGeometry(c.getSpacedPoints(n), 72);
}
// circular arc through three points in the x/y plane at depth z
function arc3([x1, y1], [x2, y2], [x3, y3], z, n = 40) {
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  const cx = ((x1 ** 2 + y1 ** 2) * (y2 - y3) + (x2 ** 2 + y2 ** 2) * (y3 - y1) + (x3 ** 2 + y3 ** 2) * (y1 - y2)) / d;
  const cy = ((x1 ** 2 + y1 ** 2) * (x3 - x2) + (x2 ** 2 + y2 ** 2) * (x1 - x3) + (x3 ** 2 + y3 ** 2) * (x2 - x1)) / d;
  const r = Math.hypot(x1 - cx, y1 - cy);
  let a1 = Math.atan2(y1 - cy, x1 - cx), a3 = Math.atan2(y3 - cy, x3 - cx);
  const a2 = Math.atan2(y2 - cy, x2 - cx);
  // walk the way that passes the middle point
  const within = (a, s, e) => { const k = (x) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return k(a - s) <= k(e - s); };
  if (!within(a2, a1, a3)) [a1, a3] = [a3, a1];
  const span = (((a3 - a1) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Array.from({ length: n + 1 }, (_, k) => { const a = a1 + (span * k) / n; return V(cx + r * Math.cos(a), cy + r * Math.sin(a), z); });
}

// a frame drawn in the end plane x: points are [z, y]; joints get a block so mitres read as welded
function frame(x, pts, { closed = false, w = 0.06, t = 0.05 } = {}) {
  const P = pts.map(([z, y]) => V(x, y, z));
  const out = [];
  const n = closed ? P.length : P.length - 1;
  for (let k = 0; k < n; k++) out.push(bar(P[k], P[(k + 1) % P.length], t, w));
  P.forEach((p) => out.push(box(t, w, w, p.x, p.y, p.z)));
  return out;
}
const ends = (fn) => [-1, 1].flatMap((s) => fn(s * X0, s));
// stadium-shaped chain link, long axis on y
function linkGeo() {
  const pts = [];
  const r = 0.016, s = 0.014;
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    pts.push(V(Math.cos(a) * r, Math.sin(a) * r + Math.sign(Math.sin(a)) * s, 0));
  }
  return tube(pts, 0.0055, true, 48);
}

/* ---------- the catalogue: each entry returns geometries in metres, legs standing on y = 0 ---------- */
const top = (kind) => ({ rect: { shape: 'rect', l: 1.8, d: 0.9, h: H }, square: { shape: 'rect', l: 1.0, d: 1.0, h: H }, round: { shape: 'round', r: 0.58, h: H }, coffee: { shape: 'round', r: 0.42, h: LOW } })[kind];
const yT = H - 0.03, yB = 0.03;

const MODELS = {
  xframe: { top: 'rect', geo: () => ends((x) => [
    ...frame(x, [[-DZ, yT], [DZ, yT]]), ...frame(x, [[-DZ, yB], [DZ, yB]]),
    bar(V(x, yB, -DZ + 0.03), V(x, yT, DZ - 0.03), 0.05, 0.06), bar(V(x, yB, DZ - 0.03), V(x, yT, -DZ + 0.03), 0.05, 0.06),
  ]) },
  trapeze: { top: 'rect', geo: () => ends((x) => frame(x, [[-0.27, yT], [0.27, yT], [0.37, yB], [-0.37, yB]], { closed: true, w: 0.07 })) },
  mw: { top: 'rect', geo: () => ends((x) => [
    ...frame(x, [[-DZ, yB + 0.012], [DZ, yB + 0.012], [DZ, yT], [-DZ, yT]], { closed: true, w: 0.07, t: 0.06 }),
    ...frame(x, [[-DZ, yT], [0, H * 0.36], [DZ, yT]], { w: 0.06, t: 0.06 }),
    ...frame(x, [[-DZ, yB + 0.012], [0, H * 0.64], [DZ, yB + 0.012]], { w: 0.06, t: 0.06 }),
    box(0.13, 0.012, DZ * 2 + 0.1, x, 0.006, 0),
  ]) },
  maze: { top: 'rect', geo: () => ends((x) => [
    ...[[-1, 0.62, -0.05, 1], [-0.55, 0.3, 0.45, 0.78], [0.12, 0.58, 1, 1], [-1, 0, -0.25, 0.45], [0.3, 0, 1, 0.4], [-0.1, 0.1, 0.62, 0.36]].flatMap(([u1, v1, u2, v2]) => {
      const z = (u) => u * (DZ - 0.02), y = (v) => 0.035 + v * (H - 0.06);
      return frame(x, [[z(u1), y(v1)], [z(u2), y(v1)], [z(u2), y(v2)], [z(u1), y(v2)]], { closed: true, w: 0.04, t: 0.04 });
    }),
    box(0.1, 0.014, DZ * 2 + 0.06, x, 0.007, 0),
  ]) },
  aframe: { top: 'rect', geo: () => [
    ...ends((x) => [
      ...frame(x, [[-DZ, yT], [DZ, yT]]),
      ...frame(x, [[-0.09, yT], [-DZ + 0.02, yB]]), ...frame(x, [[0.09, yT], [DZ - 0.02, yB]]),
      ...frame(x, [[-DZ + 0.05, yB + 0.02], [0, 0.28], [DZ - 0.05, yB + 0.02]], { w: 0.045 }),
    ]),
    ...[-1, 1].map((s) => bar(V(-X0, yT, s * DZ), V(X0, yT, s * DZ), 0.05, 0.05, Y)),
  ] },
  mikado: { top: 'rect', geo: () => [
    ...[[-0.55, -0.3, 0.55, -0.3], [0.55, -0.3, 0.55, 0.3], [0.55, 0.3, -0.55, 0.3], [-0.55, 0.3, -0.55, -0.3]].map(([x1, z1, x2, z2]) => bar(V(x1, yT, z1), V(x2, yT, z2), 0.05, 0.05, Y)),
    ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => bar(V(sx * 0.55, yT, sz * 0.3), V(-sx * 0.76, 0.02, -sz * 0.4), 0.05, 0.05, Y)),
  ] },
  vblade: { top: 'rect', geo: () => {
    const foot = new THREE.Shape();
    foot.moveTo(-0.5, 0); foot.quadraticCurveTo(0, 0.3, 0.5, 0); foot.quadraticCurveTo(0, -0.3, -0.5, 0);
    const f = new THREE.ExtrudeGeometry(foot, { depth: 0.024, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 24 });
    f.rotateX(-Math.PI / 2); f.translate(0, 0.004, 0);
    return [f,
      ...[-1, 1].map((s) => bar(V(s * 0.02, 0.03, 0), V(s * 0.6, yT, 0), 0.16, 0.045, V(0, 0, 1))),
      bar(V(-0.66, yT + 0.008, 0), V(0.66, yT + 0.008, 0), 0.12, 0.03, V(0, 0, 1))];
  } },
  arcs: { top: 'rect', geo: () => [
    ...ends((x) => frame(x, [[-DZ, yB], [DZ, yB], [DZ, yT], [-DZ, yT]], { closed: true, w: 0.05, t: 0.05 })),
    bar(V(-X0, yT, 0), V(X0, yT, 0), 0.05, 0.05, Y), bar(V(-X0, yB, 0), V(X0, yB, 0), 0.05, 0.05, Y),
    tube(arc3([-X0 + 0.02, yT], [0, 0.1], [X0 - 0.02, yT], 0), 0.017, false, 80),
    tube(arc3([-X0 + 0.02, yB], [0, H - 0.1], [X0 - 0.02, yB], 0), 0.017, false, 80),
  ] },
  twist: { top: 'square', geo: () => [0.62, -0.62].flatMap((yaw, k) => {
    const u = V(Math.cos(yaw), 0, Math.sin(yaw)), n = V(-Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(k ? -0.17 : 0.17);
    const at = (s, lean, y) => u.clone().multiplyScalar(s * 0.3).add(n.clone().multiplyScalar(lean)).setY(y);
    const P = [at(-1, -1, yB), at(1, -1, yB), at(1, 1, yT), at(-1, 1, yT)];
    return [...P.map((p, j) => bar(p, P[(j + 1) % 4], 0.05, 0.05, Y)), ...P.map((p) => box(0.05, 0.05, 0.05, p.x, p.y, p.z))];
  }) },
  xtrapeze: { top: 'round', geo: () => [0, Math.PI / 2].flatMap((yaw) => {
    const pts = [[-0.22, yT], [0.22, yT], [0.38, yB], [-0.38, yB]];
    return frame(0, pts, { closed: true, w: 0.06, t: 0.05 }).map((g) => g.rotateY(yaw));
  }) },
  column: { top: 'round', geo: () => [
    turned([[0.001, 0], [0.27, 0], [0.272, 0.01], [0.25, 0.024], [0.12, 0.034], [0.095, 0.05], [0.095, 0.4], [0.085, 0.44], [0.05, 0.48], [0.046, 0.6], [0.046, yT - 0.03], [0.07, yT - 0.012], [0.001, yT - 0.01]]),
    box(0.5, 0.012, 0.06, 0, yT + 0.014, 0), box(0.06, 0.012, 0.5, 0, yT + 0.014, 0),
  ] },
  cone: { top: 'round', geo: () => [
    turned([[0.001, 0], [0.245, 0], [0.248, 0.012], [0.235, 0.024], [0.15, 0.28], [0.085, 0.52], [0.06, 0.56], [0.05, 0.6], [0.05, yT - 0.012], [0.001, yT - 0.01]]),
    turned([[0.001, yT - 0.012], [0.21, yT - 0.012], [0.21, yT + 0.02], [0.001, yT + 0.02]], 20),
  ] },
  baluster: { top: 'round', geo: () => [
    turned([[0.001, 0], [0.24, 0], [0.242, 0.01], [0.225, 0.02], [0.07, 0.03], [0.05, 0.05], [0.055, 0.085], [0.036, 0.12], [0.05, 0.17], [0.075, 0.27], [0.07, 0.33], [0.045, 0.39], [0.035, 0.43], [0.052, 0.455], [0.034, 0.48], [0.032, 0.52], [0.032, yT - 0.02], [0.045, yT - 0.01], [0.001, yT - 0.008]], 160),
    box(0.46, 0.012, 0.07, 0, yT + 0.012, 0), box(0.07, 0.012, 0.46, 0, yT + 0.012, 0),
  ] },
  trumpet: { top: 'round', geo: () => [
    turned([[0.001, 0], [0.27, 0], [0.272, 0.006], ...Array.from({ length: 24 }, (_, k) => { const y = 0.012 + (k / 23) ** 1.6 * (yT - 0.04); return [0.034 + 0.235 * Math.exp(-y / 0.055), y]; }), [0.06, yT - 0.012], [0.001, yT - 0.01]], 160),
    turned([[0.001, yT - 0.012], [0.2, yT - 0.012], [0.2, yT + 0.016], [0.001, yT + 0.016]], 20),
  ] },
  tulip: { top: 'round', geo: () => {
    const N = 28;
    const rods = Array.from({ length: N }, (_, k) => {
      const a = (k / N) * Math.PI * 2;
      const p = (r, y, da) => V(Math.cos(a + da) * r, y, Math.sin(a + da) * r);
      return tube([p(0.3, yT, 0), p(0.24, H - 0.16, 0.12), p(0.12, 0.36, 0.36), p(0.075, 0.2, 0.5), p(0.13, 0.07, 0.62), p(0.215, 0.022, 0.68)], 0.0055, false, 48);
    });
    return [...rods, ring(0.3, yT, 0.011), ring(0.218, 0.014, 0.012), ring(0.076, 0.2, 0.012)];
  } },
  chain: { top: 'round', geo: () => {
    const out = [ring(0.27, 0.014, 0.014)];
    const sq = [[-0.24, -0.24], [0.24, -0.24], [0.24, 0.24], [-0.24, 0.24]];
    sq.forEach(([x, z], k) => { const [x2, z2] = sq[(k + 1) % 4]; out.push(bar(V(x, yT, z), V(x2, yT, z2), 0.03, 0.03, Y)); });
    const link = linkGeo();
    sq.forEach(([x, z], k) => {
      const a = Math.atan2(z, x) + Math.PI * 0.82; // each chain lands across the ring, so they cross in the middle
      const A = V(x, yT - 0.02, z), B = V(Math.cos(a) * 0.27, 0.03, Math.sin(a) * 0.27);
      const dir = B.clone().sub(A); const len = dir.length(); dir.normalize();
      const pitch = 0.046, n = Math.floor(len / pitch);
      for (let j = 0; j <= n; j++) {
        const g = link.clone();
        g.rotateY(j % 2 ? Math.PI / 2 : 0);
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir));
        const p = A.clone().addScaledVector(dir, (len * j) / n);
        g.translate(p.x, p.y, p.z);
        out.push(g);
      }
    });
    return out;
  } },
  spiral: { top: 'coffee', geo: () => {
    const N = 7, yt = LOW - 0.02;
    const rods = [1, -1].flatMap((s) => Array.from({ length: N }, (_, k) => tube(Array.from({ length: 33 }, (_, j) => {
      const v = j / 32, a = (k / N) * Math.PI * 2 + s * v * Math.PI * 1.7, r = 0.2 - 0.06 * Math.sin(Math.PI * v);
      return V(Math.cos(a) * r, 0.012 + v * (yt - 0.012), Math.sin(a) * r);
    }), 0.0055, false, 96)));
    return [...rods, ring(0.2, yt, 0.009), ring(0.2, 0.012, 0.009)];
  } },
  cage: { top: 'coffee', geo: () => {
    const N = 32, yt = LOW - 0.02, d = 1.5;
    const rods = Array.from({ length: N }, (_, k) => { const a = (k / N) * Math.PI * 2; return bar(V(Math.cos(a) * 0.25, 0.012, Math.sin(a) * 0.25), V(Math.cos(a + d) * 0.23, yt, Math.sin(a + d) * 0.23), 0.009, 0.009, Y); });
    return [...rods, ring(0.23, yt, 0.008), ring(0.25, 0.012, 0.009)];
  } },
};

// finishes: a single shared metal whose colour and polish glide between them
const FINISH = {
  black: { color: 0x161616, metalness: 0.55, roughness: 0.46, env: 0.35 },
  raw: { color: 0x7d7f80, metalness: 0.92, roughness: 0.36, env: 0.9 },
  brass: { color: 0xd2a75c, metalness: 1, roughness: 0.3, env: 1 },
  gold: { color: 0xeac37a, metalness: 1, roughness: 0.07, env: 1.15 },
  chrome: { color: 0xf0f1f2, metalness: 1, roughness: 0.05, env: 1.15 },
};

/* ---------- walnut for the top ---------- */
function noise2(seed) {
  const p = new Uint8Array(512);
  const r = Array.from({ length: 256 }, (_, i) => i);
  let s = seed;
  for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [r[i], r[j]] = [r[j], r[i]]; }
  for (let i = 0; i < 512; i++) p[i] = r[i & 255];
  const f = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = f(x - xi), v = f(y - yi);
    const h = (i, j) => p[p[(xi + i) & 255] + ((yi + j) & 255)] / 255;
    return (h(0, 0) * (1 - u) + h(1, 0) * u) * (1 - v) + (h(0, 1) * (1 - u) + h(1, 1) * u) * v;
  };
}
function walnut() {
  const W = 768, Hc = 768; // covers 2 × 2 m
  const c = document.createElement('canvas');
  c.width = W; c.height = Hc;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(W, Hc);
  const n1 = noise2(11), n2 = noise2(23), n3 = noise2(41);
  const fbm = (n, x, y) => n(x, y) * 0.55 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.15;
  for (let v = 0; v < Hc; v++) {
    const y = (v / Hc - 0.5) * 2;
    for (let u = 0; u < W; u++) {
      const x = (u / W - 0.5) * 2;
      const g = y * 13 + fbm(n1, x * 0.8 + 3, y * 1.6) * 7 + fbm(n2, x * 2.6, y * 5) * 1.4;
      const ring = 0.5 + 0.5 * Math.sin(g * Math.PI * 2);
      const tone = Math.min(1, Math.max(0, (fbm(n3, x * 1.4, y * 5) - 0.3) * 1.6));
      const late = Math.pow(1 - ring, 4) * 0.3 + Math.pow(1 - ring, 14) * 0.22;
      const pore = 1 - n2(x * 90, y * 900) * 0.1;
      const k = (1 - late) * pore;
      const i = (v * W + u) * 4;
      img.data[i] = (62 + 72 * tone) * k; img.data[i + 1] = (39 + 46 * tone) * k; img.data[i + 2] = (25 + 26 * tone) * k; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function topGeo(t) {
  const s = new THREE.Shape();
  if (t.shape === 'round') s.absarc(0, 0, t.r, 0, Math.PI * 2, false);
  else {
    const l = t.l / 2, d = t.d / 2, r = 0.02;
    s.moveTo(-l + r, -d); s.lineTo(l - r, -d); s.quadraticCurveTo(l, -d, l, -d + r); s.lineTo(l, d - r); s.quadraticCurveTo(l, d, l - r, d);
    s.lineTo(-l + r, d); s.quadraticCurveTo(-l, d, -l, d - r); s.lineTo(-l, -d + r); s.quadraticCurveTo(-l, -d, -l + r, -d);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: T - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 72 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.004, 0);
  return g;
}

function legs(sec, { reduced }) {
  const txt = (sel, el = sec) => el.querySelector(sel).textContent.trim();
  const cfg = { wa: sec.dataset.wa, hello: txt('.legs-hello'), g: { model: txt('.legs-g-model'), finish: txt('.legs-g-finish') } };
  const stage = sec.querySelector('.legs-stage');
  const canvas = sec.querySelector('.legs-canvas');
  const form = sec.querySelector('.legs-form');
  const cta = sec.querySelector('.legs-cta');
  const idx = sec.querySelector('.legs-i');
  const nameEl = sec.querySelector('.legs-name');
  const descEl = sec.querySelector('.legs-desc');
  const radios = [...form.querySelectorAll('input[name="l-model"]')];
  const D = reduced ? 0 : 1;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    sec.classList.add('no-gl');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap; // soft contact shadows on the studio floor
  renderer.setClearColor(0x000000, 0); // the studio backdrop is CSS

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  const key = new THREE.DirectionalLight(0xfff3e2, 2.2);
  key.position.set(0.9, 5, 1.3); // nearly overhead, so the shadow pools under the table
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2.2, right: 2.2, top: 2.2, bottom: -2.2, near: 2, far: 9 });
  key.shadow.radius = 14;
  key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0006;
  const rim = new THREE.DirectionalLight(0xdfe8ff, 1.1);
  rim.position.set(-2.5, 2, -2.5);
  scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xd8cfc2, 0.6));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ color: 0x3a2c1c, opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // clipping at the floor: bases rise out of it and sink back into it
  const clip = [new THREE.Plane(Y, 0)];
  const metal = new THREE.MeshStandardMaterial({ clippingPlanes: clip, clipShadows: true });
  const setFinish = (f) => { metal.color.setHex(f.color); metal.metalness = f.metalness; metal.roughness = f.roughness; metal.envMapIntensity = f.env; };

  const map = new THREE.CanvasTexture(walnut());
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(0.5, 0.5);
  map.offset.set(0.5, 0.5);
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const wood = new THREE.MeshPhysicalMaterial({ map, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.22, envMapIntensity: 0.6 });

  const world = new THREE.Group();
  scene.add(world);

  const cache = {};
  function base(id) {
    if (cache[id]) return cache[id];
    const g = new THREE.Group();
    for (const geo of MODELS[id].geo()) {
      const m = new THREE.Mesh(geo, metal);
      m.castShadow = true;
      g.add(m);
    }
    return (cache[id] = g);
  }
  const tops = {};
  function slab(kind) {
    if (tops[kind]) return tops[kind];
    const m = new THREE.Mesh(topGeo(top(kind)), wood);
    m.castShadow = m.receiveShadow = true;
    return (tops[kind] = m);
  }

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
  const view = { az: 0.7, el: 0.2, R: 5, fit: 1.9, h: H };
  let W = 1, Hh = 1;
  function size() {
    W = stage.clientWidth; Hh = stage.clientHeight;
    renderer.setSize(W, Hh, false);
    camera.aspect = W / Hh;
    camera.updateProjectionMatrix();
    draw();
  }
  // distance that keeps the whole table inside the frame at this aspect
  const reach = (span) => Math.max(span / 2 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * Math.min(camera.aspect, 1.25) * 0.78), 2.2);

  let spin = 0;
  function draw() {
    const az = view.az + spin;
    const R = reach(view.fit);
    camera.position.set(Math.sin(az) * Math.cos(view.el) * R, view.h * 0.5 + Math.sin(view.el) * R, Math.cos(az) * Math.cos(view.el) * R);
    camera.lookAt(0, view.h * 0.46, 0);
    renderer.render(scene, camera);
  }

  /* ---------- switching ---------- */
  let cur = null, curTop = null, tl = null;
  const order = () => {
    const m = form.querySelector('input[name="l-model"]:checked').nextElementSibling;
    const f = form.querySelector('input[name="l-finish"]:checked').nextElementSibling;
    const kind = txt(`.legs-kind[data-kind="${m.dataset.kind}"]`);
    const text = [`${cfg.hello}:`, `${cfg.g.model}: ${txt('.lm-t', m)} (${kind})`, `${cfg.g.finish}: ${txt('.visually-hidden', f)}`].join('\n');
    cta.href = `https://wa.me/${cfg.wa}?text=${encodeURIComponent(text)}`;
  };
  const finishTo = (id) => {
    const f = FINISH[id];
    const c = new THREE.Color(f.color);
    gsap.to(metal.color, { r: c.r, g: c.g, b: c.b, duration: 0.8 * D, ease: 'power2.inOut' });
    gsap.to(metal, { metalness: f.metalness, roughness: f.roughness, envMapIntensity: f.env, duration: 0.8 * D, ease: 'power2.inOut' });
  };

  function show(id, first = false) {
    const kind = MODELS[id].top;
    const t = top(kind);
    const next = base(id);
    const nextTop = slab(kind);
    const old = cur, oldTop = curTop;
    if (old === next) return;
    cur = next; curTop = nextTop;
    tl?.progress(1);
    const fit = t.shape === 'round' ? t.r * 2.3 : Math.hypot(t.l, t.d) * 0.98;
    if (first) {
      world.add(next, nextTop);
      next.position.y = 0; nextTop.position.y = t.h; nextTop.scale.setScalar(1);
      Object.assign(view, { fit, h: t.h });
      return;
    }
    const oldH = old ? old.userData.h : H;
    next.userData.h = t.h;
    next.position.y = -t.h - 0.05;
    world.add(next);
    tl = gsap.timeline({ defaults: { ease: 'power3.inOut' } });
    // the top lifts clear, the old base sinks, the new one rises, the top settles on it
    tl.to(oldTop.position, { y: Math.max(oldH, t.h) + 0.22, duration: 0.55 * D }, 0);
    if (old) tl.to(old.position, { y: -oldH - 0.05, duration: 0.6 * D, ease: 'power3.in' }, 0.1 * D);
    tl.add(() => old && world.remove(old));
    if (oldTop !== nextTop) {
      world.add(nextTop);
      nextTop.position.y = Math.max(oldH, t.h) + 0.22;
      nextTop.scale.setScalar(0.001);
      tl.to(oldTop.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.45 * D, ease: 'power2.in' }, 0.35 * D)
        .add(() => world.remove(oldTop))
        .to(nextTop.scale, { x: 1, y: 1, z: 1, duration: 0.6 * D, ease: 'power3.out' }, 0.75 * D);
    }
    tl.to(next.position, { y: 0, duration: 0.8 * D, ease: 'power3.out' }, 0.7 * D)
      .to(view, { fit, h: t.h, duration: 1.2 * D }, 0.3 * D)
      .to(nextTop.position, { y: t.h, duration: 0.55 * D, ease: 'power2.inOut' }, 1.35 * D);
  }

  form.addEventListener('change', (e) => {
    const lab = e.target.nextElementSibling;
    if (e.target.name === 'l-model') {
      const k = radios.indexOf(e.target);
      idx.textContent = String(k + 1).padStart(2, '0');
      nameEl.textContent = txt('.lm-t', lab);
      descEl.textContent = txt('.lm-d', lab);
      // each base arrives in the finish we make it in; the swatch can change it after
      const fin = form.querySelector(`input[name="l-finish"][value="${lab.dataset.finish}"]`);
      if (fin && !fin.checked) { fin.checked = true; sec.querySelector('.legs-val[data-for="finish"]').textContent = txt('.visually-hidden', fin.nextElementSibling); finishTo(fin.value); }
      sec.querySelector('.legs-val[data-for="model"]').textContent = txt('.lm-t', lab);
      show(e.target.value);
    } else {
      sec.querySelector('.legs-val[data-for="finish"]').textContent = txt('.visually-hidden', lab);
      finishTo(e.target.value);
    }
    order();
  });
  const step = (d) => {
    const k = radios.findIndex((r) => r.checked);
    const r = radios[(k + d + radios.length) % radios.length];
    r.checked = true;
    r.dispatchEvent(new Event('change', { bubbles: true }));
  };
  sec.querySelector('.legs-prev').addEventListener('click', () => step(-1));
  sec.querySelector('.legs-next').addEventListener('click', () => step(1));

  // drag to turn the table; vertical swipes still scroll the page
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, az: view.az, el: view.el }; canvas.setPointerCapture(e.pointerId); stage.classList.add('is-drag'); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    view.az = drag.az - (e.clientX - drag.x) * 0.008;
    view.el = gsap.utils.clamp(0.02, 0.75, drag.el + (e.clientY - drag.y) * 0.004);
    stage.classList.add('is-turned');
  });
  const up = () => { drag = null; stage.classList.remove('is-drag'); };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  setFinish(FINISH[form.querySelector('input[name="l-finish"]:checked').value]);
  const first = form.querySelector('input[name="l-model"]:checked').value;
  base(first).userData.h = top(MODELS[first].top).h;
  show(first, true);
  new ResizeObserver(size).observe(stage);
  size();

  // render only while on screen; an idle table turns slowly on its own
  let on = false;
  const tick = (time, dt) => {
    if (!reduced && !drag) spin += dt * 0.00009;
    draw();
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting === on) return;
    on = e.isIntersecting;
    on ? gsap.ticker.add(tick) : gsap.ticker.remove(tick);
  }, { rootMargin: '10% 0px' }).observe(stage);
  // pre-build the rest in idle time so the first switch to each one does not stutter
  const ids = Object.keys(MODELS);
  const warm = () => { const id = ids.find((k) => !cache[k]); if (!id) return; base(id).userData.h = top(MODELS[id].top).h; (window.requestIdleCallback || setTimeout)(warm); };
  (window.requestIdleCallback || setTimeout)(warm);
}

const sec = document.querySelector('.nx-legs');
if (sec && gsap) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // build only when the section is about to come into view
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); legs(sec, { reduced }); } }, { rootMargin: '100% 0px' });
  io.observe(sec);
}
