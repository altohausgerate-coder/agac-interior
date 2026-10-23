// Qoz ağacı teksturası fon axınında hesablanır ki, səhifə donmasın (js/table3d.js istifadə edir).
const L = 2.2; // length, m
const D = 0.95; // depth
const T = 0.05; // slab thickness
const LEG = 0.72; // underside of the top
const N = 180; // samples along the river

// the river's centre line and width wander along the table; each bank gets its own live-edge ripple
const centre = (x) => 0.1 * Math.sin(2.1 * x + 0.6) + 0.045 * Math.sin(5.3 * x + 1.7);
const width = (x) => 0.17 + 0.07 * Math.sin(3.3 * x + 0.4) + 0.035 * Math.sin(7.9 * x + 2.1);
const lo = (x) => centre(x) - width(x) / 2 + 0.009 * Math.sin(41 * x) + 0.005 * Math.sin(67 * x + 1);
const hi = (x) => centre(x) + width(x) / 2 + 0.008 * Math.sin(37 * x + 2) + 0.006 * Math.sin(73 * x + 0.3);

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
  const W = 2048, H = 900;
  const img = { data: new Uint8ClampedArray(W * H * 4) };
  const n1 = noise2(7), n2 = noise2(19), n3 = noise2(31);
  const fbm = (n, x, y) => n(x, y) * 0.55 + n(x * 2.1, y * 2.1) * 0.3 + n(x * 4.3, y * 4.3) * 0.15;
  const mix = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k); };
  const loA = new Float32Array(W), hiA = new Float32Array(W);
  for (let u = 0; u < W; u++) { const x = (u / W - 0.5) * L; loA[u] = lo(x); hiA[u] = hi(x); }
  for (let v = 0; v < H; v++) {
    const y = (0.5 - v / H) * D;
    for (let u = 0; u < W; u++) {
      const x = (u / W - 0.5) * L;
      // growth rings stretched along the length, bent by two scales of noise
      const g = y * 15 + fbm(n1, x * 0.7 + 3, y * 1.6) * 7.5 + fbm(n2, x * 2.6, y * 5) * 1.6 + Math.sin(x * 2.3 + y * 4) * 0.8;
      const ring = 0.5 + 0.5 * Math.sin(g * Math.PI * 2);
      const figure = fbm(n3, x * 1.4, y * 5);
      const tone = Math.min(1, Math.max(0, (figure - 0.3) * 1.6));
      let r = mix(58, 132, tone), gg = mix(36, 84, tone), b = mix(23, 50, tone);
      const late = Math.pow(1 - ring, 4) * 0.3 + Math.pow(1 - ring, 14) * 0.25;
      r *= 1 - late; gg *= 1 - late; b *= 1 - late;
      const pore = n2(x * 90, y * 900) * 0.12;
      r *= 1 - pore; gg *= 1 - pore; b *= 1 - pore;
      // pale sapwood and a dark bark line along each live edge
      const d = y < (loA[u] + hiA[u]) / 2 ? loA[u] - y : y - hiA[u];
      if (d > -0.01) {
        const sap = ss(0.045, 0.014, d) * (0.75 + 0.25 * figure);
        r = mix(r, 205, sap); gg = mix(gg, 168, sap); b = mix(b, 118, sap);
        const bark = ss(0.008, 0.001, d);
        r = mix(r, 46, bark); gg = mix(gg, 32, bark); b = mix(b, 24, bark);
      }
      const i = (v * W + u) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  return { W, H, data: img.data };
}


onmessage = () => {
  const t = walnut();
  postMessage(t, [t.data.buffer]);
};
