// Agach river table in three.js: walnut slabs, an emerald resin river, a clear top coat and steel X legs.
// The pinned section's scroll pulls the table apart into its layers and puts it back together.
// Epoxy 2.0-dan köçürülüb (~/epoxy-az/src/sig/table.js); gsap və ScrollTrigger səhifədə qlobal yüklənir.
import * as THREE from 'three';
const { gsap, ScrollTrigger } = window;

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
const xs = Array.from({ length: N + 1 }, (_, k) => -L / 2 + (L * k) / N);

function shape(pts) {
  const s = new THREE.Shape();
  pts.forEach(([x, y], k) => (k ? s.lineTo(x, y) : s.moveTo(x, y)));
  return s;
}
// extrude a plan shape and stand it up: shape y becomes -z, the extrusion becomes height
function slab(pts, depth, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape(pts), { depth, steps: 1, curveSegments: 1, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

/* ---------- walnut texture, painted once on a canvas ---------- */
function woodCanvas({ W, H, data }) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
  return c;
}

function shadowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.75)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function build(renderer, wood0) {
  const scene = new THREE.Scene();
  // no PMREM environment: generating it stalls the page for ~0.4 s; a soft front light stands in for it

  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(0.6, 6, -2.6); // high and behind, so its glint never lands in the lens
  const rim = new THREE.DirectionalLight(0xcfe3ff, 1.6);
  rim.position.set(-3, 2.2, -3.5);
  const fill = new THREE.HemisphereLight(0xfff4e6, 0x1a1512, 1.1);
  const front = new THREE.DirectionalLight(0xffe9cc, 0.9);
  front.position.set(3, 2.5, 4);
  scene.add(key, rim, fill, front);

  const map = new THREE.CanvasTexture(woodCanvas(wood0));
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1 / L, 1 / D);
  map.offset.set(0.5, 0.5);
  map.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const wood = new THREE.MeshPhysicalMaterial({ map, roughness: 0.62, specularIntensity: 0.35, clearcoat: 0.12, clearcoatRoughness: 0.45 });
  const resin = new THREE.MeshPhysicalMaterial({
    color: 0x2a9c79, transparent: true, opacity: 0.9, roughness: 0.05,
    clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0x0a4a38, emissiveIntensity: 0.75,
  });
  const coat = new THREE.MeshPhysicalMaterial({ color: 0xf4efe6, roughness: 0.04, metalness: 0, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 1.4, side: THREE.DoubleSide });
  const edge = new THREE.LineBasicMaterial({ color: 0xe9d7b4, transparent: true, opacity: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x151515, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.22 });

  const bankA = [[-L / 2, -D / 2], [L / 2, -D / 2], ...xs.slice().reverse().map((x) => [x, lo(x)])];
  const bankB = [...xs.map((x) => [x, hi(x)]), [L / 2, D / 2], [-L / 2, D / 2]];
  const river = [...xs.map((x) => [x, lo(x)]), ...xs.slice().reverse().map((x) => [x, hi(x)])];

  const top = new THREE.Group();
  const slabA = new THREE.Mesh(slab(bankA, T - 0.006, 0.003), wood);
  const slabB = new THREE.Mesh(slab(bankB, T - 0.006, 0.003), wood);
  slabA.position.y = slabB.position.y = 0.003;
  const epoxy = new THREE.Mesh(slab(river, T), resin);
  const r = 0.012;
  const plate = new THREE.Shape();
  plate.moveTo(-L / 2 + r, -D / 2); plate.lineTo(L / 2 - r, -D / 2); plate.quadraticCurveTo(L / 2, -D / 2, L / 2, -D / 2 + r);
  plate.lineTo(L / 2, D / 2 - r); plate.quadraticCurveTo(L / 2, D / 2, L / 2 - r, D / 2); plate.lineTo(-L / 2 + r, D / 2);
  plate.quadraticCurveTo(-L / 2, D / 2, -L / 2, D / 2 - r); plate.lineTo(-L / 2, -D / 2 + r); plate.quadraticCurveTo(-L / 2, -D / 2, -L / 2 + r, -D / 2);
  const coatG = new THREE.ExtrudeGeometry(plate, { depth: 0.006, bevelEnabled: false, curveSegments: 4 });
  coatG.rotateX(-Math.PI / 2);
  const clear = new THREE.Mesh(coatG, coat);
  clear.renderOrder = 2;
  clear.add(new THREE.LineSegments(new THREE.EdgesGeometry(coatG, 30), edge));
  top.add(slabA, slabB, epoxy, clear);

  // two X frames with a rail top and bottom
  const legs = new THREE.Group();
  const span = D - 0.17;
  const len = Math.hypot(span, LEG - 0.04);
  const ang = Math.atan2(span, LEG - 0.04);
  for (const sx of [-1, 1]) {
    const f = new THREE.Group();
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.05), steel);
      bar.position.y = LEG / 2;
      bar.rotation.x = s * ang;
      f.add(bar);
    }
    for (const y of [0.015, LEG - 0.015]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, span + 0.08), steel);
      rail.position.y = y;
      f.add(rail);
    }
    f.position.x = sx * (L / 2 - 0.34);
    legs.add(f);
  }

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.45, D * 1.9), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;

  const table = new THREE.Group();
  table.add(top, legs, shadow);
  table.position.y = -0.62;
  scene.add(table);

  // explode amount e (0..1) moves each layer to its own height
  const explode = (e) => {
    top.position.y = LEG;
    clear.position.y = T + 0.0004 + e * 0.62;
    epoxy.position.y = e * 0.34;
    slabA.position.y = 0.003 + e * 0.1;
    slabB.position.y = 0.003 + e * 0.1;
    slabA.position.z = e * 0.24;
    slabB.position.z = -e * 0.24;
    legs.position.y = -e * 0.34;
    shadow.material.opacity = 1 - e * 0.55;
    const g = Math.min(1, Math.max(0, (e - 0.15) / 0.4));
    clear.visible = g > 0;
    clear.material.opacity = g * 0.16;
    edge.opacity = g * 0.75;
  };
  // where each tag points: coat, resin, slab, legs (in table space)
  const anchors = [
    () => new THREE.Vector3(L * 0.36, LEG + clear.position.y + 0.006, -D * 0.38),
    () => new THREE.Vector3(0.62, LEG + epoxy.position.y + T, -centre(0.62)),
    () => new THREE.Vector3(-0.72, LEG + slabB.position.y + T, slabB.position.z - D * 0.36),
    () => new THREE.Vector3(L / 2 - 0.34, legs.position.y + LEG * 0.5, 0.02),
  ];
  return { scene, table, explode, anchors, textures: [map, shadow.material.map] };
}

function table(sec, { reduced, wood }) {
  const canvas = sec.querySelector('.nx-tbl-canvas');
  const pin = sec.querySelector('.nx-tbl-pin');
  const tags = [...sec.querySelectorAll('.nx-tbl-tag')];
  const items = [...sec.querySelectorAll('.nx-tbl-item')];
  const bar = sec.querySelector('.nx-tbl-progress span');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    sec.classList.add('no-gl');
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  // allocate the full-size drawing buffer now, not on the first visible frame
  renderer.setSize(pin.clientWidth || innerWidth, pin.clientHeight || innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0); // the warm glow behind the table is CSS

  const { scene, table: tbl, explode, anchors, textures } = build(renderer, wood);
  explode(0.6); // every layer visible, so the shader warm-up below covers all materials
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const look = new THREE.Vector3(0, 0, 0);
  const view = { e: 0, az: 0.85, el: 0.6, k: 0 };
  const list = sec.querySelector('.nx-tbl-list');
  let W = 1, Hh = 1, R = 6, wide = true, edge = 1, edgeL = 8;

  function size() {
    W = pin.clientWidth; Hh = pin.clientHeight;
    wide = W > 1100;
    renderer.setSize(W, Hh, false);
    // tags stop short of the layer list on desktop
    const lr = list.getBoundingClientRect();
    const rtl = document.documentElement.dir === 'rtl';
    edge = wide && !rtl ? lr.left - 16 : W - 8;
    edgeL = wide && rtl ? lr.right + 16 : 8;
    camera.aspect = W / Hh;
    // fit the table into the middle column on desktop, nearly the full width on phones
    const share = wide ? 0.36 : 0.86;
    R = Math.max(4.2, (L / 2 + 0.15) / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * share));
    camera.updateProjectionMatrix();
    draw();
  }

  const v = new THREE.Vector3();
  let idle = 0;
  function draw() {
    explode(view.e);
    const az = view.az + idle;
    camera.position.set(Math.sin(az) * Math.cos(view.el) * R, Math.sin(view.el) * R + (wide ? 0 : 0.25), Math.cos(az) * Math.cos(view.el) * R);
    look.set(0, wide ? 0.02 : -0.12, 0);
    camera.lookAt(look);
    renderer.render(scene, camera);
    // tags follow their layer on screen and fade in as the table opens
    const a = gsap.utils.clamp(0, 1, (view.e - 0.45) / 0.35);
    tags.forEach((t, k) => {
      v.copy(anchors[k]()).add(tbl.position).project(camera);
      const x = (v.x * 0.5 + 0.5) * W;
      const y = (-v.y * 0.5 + 0.5) * Hh;
      const tx = Math.min(Math.max(edgeL, x - 20), edge - t.offsetWidth);
      t.style.transform = `translate(${tx}px, ${y}px) translate(0, -50%)`;
      t.style.opacity = a;
      t.classList.toggle('is-on', k === view.k);
    });
  }

  function setStep(k) {
    if (k === view.k && items[k].classList.contains('is-on')) return;
    view.k = k;
    items.forEach((it, j) => it.classList.toggle('is-on', j === k));
  }

  const start = () => {
    const T2=performance.now();
    new ResizeObserver(size).observe(pin);
    size();
    console.log('T firstdraw',Math.round(performance.now()-T2));

    if (reduced) {
      view.e = 0.85;
      items.forEach((it) => it.classList.add('is-on'));
      draw();
      return;
    }

    // scroll story: assembled → apart (layers named one by one) → back together
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
    tl.to(view, { e: 1, az: -0.5, el: 0.5, duration: 0.32 }, 0.1)
      .to(view, { az: -0.95, el: 0.42, duration: 0.42, ease: 'none' }, 0.42)
      .to(view, { e: 0, az: -1.6, el: 0.3, duration: 0.18 }, 0.84);
    setStep(0);
    ScrollTrigger.create({
      trigger: sec,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (s) => {
        tl.progress(s.progress);
        bar.style.transform = `scaleX(${s.progress})`;
        setStep(gsap.utils.clamp(0, 3, Math.floor((s.progress - 0.24) / 0.15)));
      },
    });

    // render only while the section is on screen; a slow drift keeps the table alive between scrolls
    let on = false;
    const tick = (t, dt) => { idle += dt * 0.00004; draw(); };
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting === on) return;
      on = e.isIntersecting;
      on ? gsap.ticker.add(tick) : gsap.ticker.remove(tick);
    }, { rootMargin: '10% 0px' }).observe(sec);
  };
  // shaders compile off the main thread where the browser supports it, so the first frame does not stall
  // upload textures and compile shaders in idle moments, so no single frame stalls when the table first appears
  const whenIdle = () => new Promise((r) => (window.requestIdleCallback || setTimeout)(r, { timeout: 400 }));
  whenIdle()
    .then(() => { textures.forEach((t) => renderer.initTexture(t)); return whenIdle(); })
    .then(() => { const a=performance.now(); return (renderer.compileAsync ? renderer.compileAsync(scene, camera) : null).then(()=>console.log('T compiled',Math.round(performance.now()-a))); })
    .then(whenIdle)
    .then(start, start);
}

const sec = document.querySelector('.nx-tbl');
if (sec && gsap) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wood = new Promise((res) => {
    const w = new Worker('js/walnut-worker.js');
    w.onmessage = (e) => { res(e.data); w.terminate(); };
    w.postMessage(0);
  });
  const near = new Promise((res) => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); res(); } }, { rootMargin: '200% 0px' });
    io.observe(sec);
  });
  Promise.all([wood, near]).then(([w]) => table(sec, { reduced, wood: w }));
}
