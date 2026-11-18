// Procedural sandwich: two bread slices, a peanut-butter spread and a jelly layer.
// Everything is generated in code (geometry + canvas textures), so there are no model files to load.
// The look is aimed at a real PB&J: square sandwich-loaf slices with pale crumb and a thin golden crust,
// creamy peanut butter squeezing out at the edges, and lumpy, glossy fruit jelly.
import * as THREE from 'three';

/* ---------- Random + noise ---------- */

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Smooth 2D value noise in roughly [-1, 1].
function makeNoise(seed) {
  const r = rng(seed);
  const vals = new Float32Array(256).map(() => r() * 2 - 1);
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const at = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
  const f = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = f(x - xi), v = f(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(noise, x, y, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) { sum += noise(x * freq, y * freq) * amp; amp *= 0.5; freq *= 2.03; }
  return sum;
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- Shapes ---------- */

// The outline of a slice of sandwich-loaf bread: nearly square, with softly rounded shoulders at the top.
function breadOutline(path) {
  path.moveTo(-0.95, -1.0);
  path.lineTo(0.95, -1.0);
  path.quadraticCurveTo(1.04, -1.0, 1.04, -0.91);
  path.lineTo(1.04, 0.6);
  path.bezierCurveTo(1.04, 0.92, 1.1, 1.08, 0.84, 1.13);
  path.bezierCurveTo(0.45, 1.2, -0.45, 1.2, -0.84, 1.13);
  path.bezierCurveTo(-1.1, 1.08, -1.04, 0.92, -1.04, 0.6);
  path.lineTo(-1.04, -0.91);
  path.quadraticCurveTo(-1.04, -1.0, -0.95, -1.0);
  return path;
}

const BREAD_SHAPE = breadOutline(new THREE.Shape());
const BREAD_PTS = BREAD_SHAPE.getSpacedPoints(240).slice(0, -1);
const CENTER = new THREE.Vector2(0, 0.06);
const UV_BOX = { x0: -1.45, y0: -1.15, w: 2.9, h: 2.5 };

// The same outline, pushed in and out a little with low-frequency noise so no two slices are perfect.
function irregular(points, seed, amount, fine = 0) {
  const n = makeNoise(seed);
  return points.map((p, i) => {
    const a = (i / points.length) * Math.PI * 2;
    const k = 1 + n(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5) * amount
      + (fine ? n(Math.cos(a) * 9 + 20, Math.sin(a) * 9 + 20) * fine : 0);
    return new THREE.Vector2(CENTER.x + (p.x - CENTER.x) * k, CENTER.y + (p.y - CENTER.y) * k);
  });
}

function shapeFrom(points) {
  const s = new THREE.Shape();
  points.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  s.closePath();
  return s;
}

// A real slice: two cut faces of crumb with a little relief, joined by a thin crust wall with
// tight rounded edges. Built by hand (not extruded) so the faces can carry real height and the
// crust can be toasted darker on the loaf's top shoulders, as it is on a real loaf.
const BREAD_T = 0.3;

function breadGeometry(seed, lite) {
  const outline = irregular(BREAD_PTS, seed, 0.01, 0.004);
  const S = outline.length;
  const R = lite ? 18 : 28; // face rings
  const rad = 0.03; // edge radius
  const half = BREAD_T / 2;
  const n = makeNoise(seed + 7);
  const toastN = makeNoise(seed + 13);

  // Outward 2D normal of the outline at each point.
  const normals = outline.map((p, j) => {
    const a = outline[(j - 1 + S) % S], b = outline[(j + 1) % S];
    const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
    return new THREE.Vector2(ty / l, -tx / l);
  });
  const inner = outline.map((p, j) => p.clone().addScaledVector(normals[j], -rad));

  const pos = [], uv = [], col = [], idx = [];
  const add = (x, y, h, u, v, c = [1, 1, 1]) => { pos.push(x, h, -y); uv.push(u, v); col.push(...c); return pos.length / 3 - 1; };

  // Crumb relief: gentle undulation plus shallow dents, fading to flat at the rim so it meets the crust.
  const relief = (x, y, t) => (fbm(n, x * 2.5, y * 2.5, 4) * 0.006 + fbm(n, x * 14 + 40, y * 14, 2) * 0.0025) * (1 - t ** 6);

  function face(sign) {
    const centre = add(CENTER.x, CENTER.y, sign * (half + relief(CENTER.x, CENTER.y, 0)), CENTER.x, CENTER.y);
    const rings = [];
    for (let k = 1; k <= R; k++) {
      const t = 1 - (1 - k / R) ** 1.4;
      const ring = [];
      for (let j = 0; j < S; j++) {
        const q = inner[j];
        const x = CENTER.x + (q.x - CENTER.x) * t, y = CENTER.y + (q.y - CENTER.y) * t;
        ring.push(add(x, y, sign * (half + relief(x, y, t)), x, y));
      }
      rings.push(ring);
    }
    const tri = (a, b, c) => (sign > 0 ? idx.push(a, b, c) : idx.push(a, c, b));
    for (let j = 0; j < S; j++) {
      const j1 = (j + 1) % S;
      tri(centre, rings[0][j], rings[0][j1]);
      for (let k = 0; k < R - 1; k++) {
        const a = rings[k][j], b = rings[k + 1][j], c = rings[k + 1][j1], d = rings[k][j1];
        tri(a, b, c); tri(a, c, d);
      }
    }
  }

  face(1);
  face(-1);
  const faceCount = idx.length;

  // Crust wall: rounded top edge -> slightly barrelled side -> rounded bottom edge.
  const prof = [];
  const E = 5;
  for (let i = 0; i <= E; i++) { const f = (i / E) * Math.PI / 2; prof.push([Math.sin(f) * rad, half - rad + Math.cos(f) * rad]); }
  for (let i = 1; i < 6; i++) { const h = half - rad - (i / 6) * (BREAD_T - 2 * rad); prof.push([rad + Math.sin((i / 6) * Math.PI) * 0.006, h]); }
  for (let i = 0; i <= E; i++) { const f = (i / E) * Math.PI / 2; prof.push([Math.cos(f) * rad, -half + rad - Math.sin(f) * rad]); }

  let arc = 0;
  const arcs = outline.map((p, j) => { if (j) arc += p.distanceTo(outline[j - 1]); return arc; });
  const rows = prof.map(([out, h]) => outline.map((_, j) => {
    const q = inner[j], nm = normals[j];
    const rough = n(arcs[j] * 18, h * 30) * 0.004 + n(arcs[j] * 50, h * 60) * 0.0015;
    const o = out + rough * Math.min(1, out / rad);
    const x = q.x + nm.x * o, y = q.y + nm.y * o;
    // Toast: the top of the loaf (shoulders) bakes darker; the base of the tin stays paler.
    const top = smoothstep(0.35, 1.15, q.y);
    const base = smoothstep(-0.7, -1.0, q.y);
    const v = 0.93 - top * 0.3 + base * 0.07 + toastN(arcs[j] * 3, h * 4) * 0.06;
    return add(x, y, h, arcs[j] * 1.4, h * 1.4, [v, v * 0.97, v * 0.94]);
  }));
  for (let r = 0; r < rows.length - 1; r++) {
    for (let j = 0; j < S; j++) {
      const j1 = (j + 1) % S;
      const a = rows[r][j], b = rows[r + 1][j], c = rows[r + 1][j1], d = rows[r][j1];
      idx.push(a, b, c, a, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.addGroup(0, faceCount, 0);
  geo.addGroup(faceCount, idx.length - faceCount, 1);
  geo.computeVertexNormals();
  return geo;
}

// A soft, squeezed layer (spread or jelly) as one closed mesh: a lumpy top, a flatter bottom and a rounded rim.
// Built on a polar grid from the slice centre out to `outline`, so the top can carry real bumps.
function blobGeometry(outline, { top, bottom, rings = 42, sharp = 6, height = () => 0, sag = () => [0, 0] }) {
  const S = outline.length;
  const R = rings;
  const positions = [];
  const uvs = [];
  const push = (x, y, h) => { positions.push(x, h, -y); uvs.push(x, y); };

  const ringPoint = (k, j) => {
    const u = k / R;
    const t = 1 - (1 - u) ** 1.8; // denser rings towards the rim
    const p = outline[j];
    const [drop, out] = sag(p, j);
    const w = smoothstep(0.7, 1, t);
    const x = CENTER.x + (p.x - CENTER.x) * t * (1 + out * w);
    const y = CENTER.y + (p.y - CENTER.y) * t * (1 + out * w);
    const e = Math.sqrt(Math.max(0, 1 - t ** sharp));
    return { x, y, e, drop: drop * w };
  };

  // Top: centre + rings 1..R (ring R is the shared rim).
  push(CENTER.x, CENTER.y, top + height(CENTER.x, CENTER.y));
  for (let k = 1; k <= R; k++) {
    for (let j = 0; j < S; j++) {
      const q = ringPoint(k, j);
      push(q.x, q.y, q.e * top + height(q.x, q.y) * Math.pow(q.e, 0.35) - q.drop);
    }
  }
  // Bottom: rings R-1..1, then centre.
  const bottomStart = positions.length / 3;
  for (let k = R - 1; k >= 1; k--) {
    for (let j = 0; j < S; j++) {
      const q = ringPoint(k, j);
      push(q.x, q.y, -q.e * bottom - q.drop);
    }
  }
  const bottomCentre = positions.length / 3;
  push(CENTER.x, CENTER.y, -bottom);

  const topRing = (k, j) => 1 + (k - 1) * S + (j % S);
  const botRing = (k, j) => (k === R ? topRing(R, j) : bottomStart + (R - 1 - k) * S + (j % S));

  const idx = [];
  for (let j = 0; j < S; j++) {
    idx.push(0, topRing(1, j), topRing(1, j + 1));
    idx.push(bottomCentre, botRing(1, j + 1), botRing(1, j));
    for (let k = 1; k < R; k++) {
      const a = topRing(k, j), b = topRing(k + 1, j), c = topRing(k + 1, j + 1), d = topRing(k, j + 1);
      idx.push(a, b, c, a, c, d);
      const e = botRing(k, j), f = botRing(k + 1, j), g = botRing(k + 1, j + 1), h = botRing(k, j + 1);
      idx.push(e, g, f, e, h, g);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.translate(0, -(top - bottom) / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

/* ---------- Canvas textures ---------- */

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

// Map slice units to canvas pixels so the texture lines up with the cap UVs.
function toCanvas(size) {
  return (x, y) => [((x - UV_BOX.x0) / UV_BOX.w) * size, size - ((y - UV_BOX.y0) / UV_BOX.h) * size];
}

function traceBread(ctx, map) {
  ctx.beginPath();
  BREAD_PTS.forEach((p, i) => {
    const [x, y] = map(p.x, p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function fitUV(tex) {
  tex.repeat.set(1 / UV_BOX.w, 1 / UV_BOX.h);
  tex.offset.set(-UV_BOX.x0 / UV_BOX.w, -UV_BOX.y0 / UV_BOX.h);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Crumb face: an open, foamy cell structure (cell walls catch the light, holes sit in shadow),
// built per pixel from cellular noise and stretched slightly along the rise of the loaf.
function crumbTextures(size = 1024) {
  const map = toCanvas(size);
  const r = rng(7);
  const n = makeNoise(19);
  const px = size / 1024;

  // Two jittered grids of cell centres (fine and coarse). Sample coordinates are warped with noise so cells
  // come out irregular and torn like real crumb, never a tidy honeycomb.
  const makeGrid = (g) => {
    const gw = Math.ceil(size / g) + 3;
    const pts = new Float32Array(gw * gw * 2);
    for (let i = 0; i < gw * gw; i++) { pts[i * 2] = r(); pts[i * 2 + 1] = r(); }
    return { g, gw, pts };
  };
  const cell = ({ gw, pts }, sx, sy) => {
    const cx = Math.floor(sx), cy = Math.floor(sy);
    let f1 = 9, f2 = 9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox, gy = cy + oy;
      const k = ((((gy % gw) + gw) % gw) * gw + (((gx % gw) + gw) % gw)) * 2;
      const dx = gx + pts[k] - sx, dy = gy + pts[k + 1] - sy;
      const d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return Math.sqrt(f2) - Math.sqrt(f1); // 0 on a cell wall
  };
  const fineG = makeGrid(Math.max(4, 7 * px));
  const coarseG = makeGrid(Math.max(8, 17 * px));
  const wn = makeNoise(29);

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = wn(x / (18 * px), y / (18 * px)) * 0.7 + wn(x / (6 * px) + 50, y / (6 * px)) * 0.25;
      const wy = wn(x / (18 * px) + 30, y / (18 * px)) * 0.7 + wn(x / (6 * px), y / (6 * px) + 50) * 0.25;
      const open = 0.5 + 0.5 * n(x / (70 * px), y / (70 * px)); // how open the crumb is here
      const f = cell(fineG, x / fineG.g + wx, y / (fineG.g * 1.3) + wy);
      const cw = cell(coarseG, x / coarseG.g + wx * 0.5, y / (coarseG.g * 1.4) + wy * 0.5);
      const holeF = smoothstep(0.03, 0.32, f) * (0.35 + 0.35 * wn(x / (3 * px), y / (3 * px) + 9) + 0.3);
      const holeC = smoothstep(0.1, 0.5, cw) * (0.25 + 0.45 * open);
      height[y * size + x] = 1 - Math.max(holeF * 0.9, holeC);
    }
  }

  const [c, ctx] = canvas(size);
  const [b, bctx] = canvas(size);
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const h = height[i];
    const x = i % size, y = (i / size) | 0;
    const m = n(x / (140 * px) + 9, y / (140 * px)) * 0.04; // soft mottling
    // holes: warm shadowed cream; walls: bright cream
    const cr = 194 + (242 - 194) * h, cg = 156 + (226 - 156) * h, cb = 104 + (192 - 104) * h;
    img.data[i * 4] = cr * (1 + m); img.data[i * 4 + 1] = cg * (1 + m); img.data[i * 4 + 2] = cb * (1 + m * 1.2); img.data[i * 4 + 3] = 255;
    const bv = 40 + h * 200;
    bimg.data[i * 4] = bimg.data[i * 4 + 1] = bimg.data[i * 4 + 2] = bv; bimg.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);

  // A few larger holes: shadowed inside with a soft edge, like the tunnels in a real slice.
  for (let i = 0; i < 14; i++) {
    const x = size * (0.22 + r() * 0.56), y = size * (0.22 + r() * 0.56);
    const rx = (3 + r() * 5) * px, ry = rx * (1.3 + r() * 0.8);
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
    const gr = ctx.createRadialGradient(0, -rx * 0.2, 0, 0, 0, rx);
    gr.addColorStop(0, 'rgba(160,122,74,0.75)'); gr.addColorStop(0.7, 'rgba(190,152,100,0.45)'); gr.addColorStop(1, 'rgba(190,152,100,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    bctx.save(); bctx.translate(x, y); bctx.scale(1, ry / rx);
    const bg = bctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    bg.addColorStop(0, 'rgba(0,0,0,0.8)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = bg; bctx.beginPath(); bctx.arc(0, 0, rx, 0, Math.PI * 2); bctx.fill(); bctx.restore();
  }

  // Outside the slice (and on the edge) is crust colour; the crumb next to the crust is a touch denser and warmer.
  const outside = (cx) => { cx.save(); traceBread(cx, map); cx.rect(0, 0, size, size); cx.clip('evenodd'); };
  outside(ctx); ctx.fillStyle = '#b5743a'; ctx.fillRect(0, 0, size, size); ctx.restore();
  outside(bctx); bctx.fillStyle = '#909090'; bctx.fillRect(0, 0, size, size); bctx.restore();
  const ring = [[34, 'rgba(222,186,132,0.28)'], [18, 'rgba(206,160,98,0.5)'], [9, '#bf8346'], [4, '#9c5f2a']];
  ring.forEach(([w, col]) => {
    traceBread(ctx, map);
    ctx.lineWidth = w * px; ctx.strokeStyle = col; ctx.lineJoin = 'round'; ctx.stroke();
  });
  traceBread(bctx, map);
  bctx.lineWidth = 10 * px; bctx.strokeStyle = 'rgba(150,150,150,0.8)'; bctx.stroke();

  const colorMap = fitUV(new THREE.CanvasTexture(c));
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = 8;
  const bumpMap = fitUV(new THREE.CanvasTexture(b));
  return { colorMap, bumpMap };
}

// Crust: the smooth, baked skin of the loaf. Golden-brown with faint streaks and tiny pores, tiled seamlessly.
function crustTextures(size = 512) {
  const [c, ctx] = canvas(size);
  const [b, bctx] = canvas(size);
  const r = rng(11);
  const n = makeNoise(23);
  const img = ctx.createImageData(size, size);
  const bimg = bctx.createImageData(size, size);
  const per = (x, y, f) => { // tileable noise by blending four offset samples
    const u = x / size, v = y / size;
    const s = (a, b2) => n(a * f, b2 * f);
    return s(u, v) * (1 - u) * (1 - v) + s(u - 1, v) * u * (1 - v) + s(u, v - 1) * (1 - u) * v + s(u - 1, v - 1) * u * v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const streak = per(x, y * 0.15, 24) * 0.5 + per(x, y, 6) * 0.5;
    const fine = per(x, y, 60);
    const t = 0.5 + streak * 0.35 + fine * 0.12;
    img.data[i * 4] = 176 + t * 48; img.data[i * 4 + 1] = 112 + t * 44; img.data[i * 4 + 2] = 56 + t * 30; img.data[i * 4 + 3] = 255;
    const bv = 128 + fine * 50 + streak * 30;
    bimg.data[i * 4] = bimg.data[i * 4 + 1] = bimg.data[i * 4 + 2] = bv; bimg.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  bctx.putImageData(bimg, 0, 0);
  // Tiny pores in the crust, wrapped across the tile edges.
  for (let i = 0; i < 1400; i++) {
    const x = r() * size, y = r() * size, rr = r() * 1.3 + 0.4;
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
      ctx.fillStyle = 'rgba(110,60,22,0.35)'; ctx.beginPath(); ctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2); ctx.fill();
      bctx.fillStyle = 'rgba(0,0,0,0.5)'; bctx.beginPath(); bctx.arc(x + dx, y + dy, rr, 0, Math.PI * 2); bctx.fill();
    }
  }
  const colorMap = new THREE.CanvasTexture(c);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.wrapS = colorMap.wrapT = THREE.RepeatWrapping;
  const bumpMap = new THREE.CanvasTexture(b);
  bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
  return { colorMap, bumpMap };
}

// Knife marks for the spread: soft, irregular smears in the bump map.
function swirlBump(size, seed, strokes, width) {
  const [c, ctx] = canvas(size);
  const r = rng(seed);
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, size, size);
  ctx.filter = `blur(${Math.round(width * 0.45)}px)`;
  ctx.lineCap = 'round';
  for (let i = 0; i < strokes; i++) {
    let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
    const steps = 6 + (r() * 8 | 0);
    const light = r() > 0.45;
    ctx.strokeStyle = light ? `rgba(220,220,220,${0.2 + r() * 0.25})` : `rgba(50,50,50,${0.15 + r() * 0.2})`;
    ctx.lineWidth = width * (0.5 + r() * 1.4);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < steps; k++) {
      a += (r() - 0.5) * 0.9;
      const len = size * (0.02 + r() * 0.04);
      const nx = x + Math.cos(a) * len, ny = y + Math.sin(a) * len;
      ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * len * 0.6, y + Math.sin(a + 0.6) * len * 0.6, nx, ny);
      x = nx; y = ny;
    }
    ctx.stroke();
  }
  ctx.filter = 'none';
  const t = fitUV(new THREE.CanvasTexture(c));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Peanut-butter colour: warm tan with lighter and darker smears where the knife dragged it.
function butterColor(size = 512) {
  const [c, ctx] = canvas(size);
  const r = rng(41);
  ctx.fillStyle = '#a96b30'; ctx.fillRect(0, 0, size, size);
  ctx.filter = 'blur(6px)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
    const light = r() > 0.5;
    ctx.strokeStyle = light ? `rgba(214,160,96,${0.25 + r() * 0.3})` : `rgba(130,76,30,${0.2 + r() * 0.25})`;
    ctx.lineWidth = 6 + r() * 22;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      a += (r() - 0.5) * 0.8;
      const len = size * (0.03 + r() * 0.04);
      x += Math.cos(a) * len; y += Math.sin(a) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.filter = 'none';
  const t = fitUV(new THREE.CanvasTexture(c));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Fillings ---------- */

// Peanut butter: smooth and creamy, bulging just past the crust with a soft wavy edge.
function butterGeometry(lite) {
  const n = makeNoise(31);
  const outline = irregular(BREAD_PTS, 32, 0.035, 0.03).map((p) => new THREE.Vector2(p.x * 1.06, p.y * 1.06 + 0.004));
  return blobGeometry(outline, {
    top: 0.065,
    bottom: 0.055,
    rings: lite ? 28 : 40,
    sharp: 5,
    height: (x, y) => fbm(n, x * 3.2, y * 3.2, 4) * 0.032,
    sag: (p) => {
      // A couple of spots where it has squeezed out and slumped over the crust.
      const front = smoothstep(-0.6, -1.0, p.y);
      const lobe = Math.max(0, Math.sin(p.x * 3.1 + 0.8));
      return [0.05 * front * lobe, 0.05 * front * lobe];
    },
  });
}

// Jelly: chunky, glossy fruit preserve — lumps of fruit across the top and an edge that oozes over the crust.
function jellyGeometry(lite) {
  const n = makeNoise(57);
  const r = rng(58);
  const chunks = Array.from({ length: 70 }, () => ({
    x: CENTER.x + (r() - 0.5) * 2.2,
    y: CENTER.y + (r() - 0.5) * 2.2,
    rad: 0.06 + r() * 0.14,
    h: 0.03 + r() * 0.06,
  }));
  const outline = irregular(BREAD_PTS, 59, 0.05, 0.035).map((p) => new THREE.Vector2(p.x * 1.075, p.y * 1.075));
  return blobGeometry(outline, {
    top: 0.085,
    bottom: 0.06,
    rings: lite ? 34 : 54,
    sharp: 4,
    height: (x, y) => {
      let h = fbm(n, x * 3.4, y * 3.4, 4) * 0.022;
      for (const c of chunks) {
        const d2 = (x - c.x) ** 2 + (y - c.y) ** 2;
        if (d2 < c.rad * c.rad * 9) h += c.h * Math.exp(-d2 / (c.rad * c.rad));
      }
      return h;
    },
    sag: (p) => {
      const front = smoothstep(-0.55, -1.0, p.y);
      const side = smoothstep(0.75, 1.04, Math.abs(p.x)) * smoothstep(0.4, -0.6, p.y);
      const k = front * Math.max(0, Math.sin(p.x * 4.3 + 1.7)) ** 2
        + side * 0.5 * (0.5 + 0.5 * Math.sin(p.y * 2.2 + 0.4));
      return [0.1 * k, 0.05 * k];
    },
  });
}

/* ---------- Public builders ---------- */

export const DIM = {
  bread: BREAD_T,
  butter: 0.13,
  jelly: 0.17,
};

export function buildSandwich({ lite = false } = {}) {
  const crumb = crumbTextures(lite ? 768 : 1024);
  const crust = crustTextures(512);

  const crumbMat = new THREE.MeshStandardMaterial({ map: crumb.colorMap, bumpMap: crumb.bumpMap, bumpScale: 3, roughness: 0.97, metalness: 0, vertexColors: true });
  const crustMat = new THREE.MeshStandardMaterial({ map: crust.colorMap, bumpMap: crust.bumpMap, bumpScale: 0.6, roughness: 0.62, metalness: 0, vertexColors: true });

  const bottomGeo = breadGeometry(3, lite);
  const topGeo = breadGeometry(17, lite);

  const butterGeo = butterGeometry(lite);
  const butterMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    map: butterColor(512),
    roughness: 0.38,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
    bumpMap: swirlBump(512, 3, 90, 12),
    bumpScale: 3.5,
  });

  const jellyGeo = jellyGeometry(lite);
  const jellyMat = new THREE.MeshPhysicalMaterial({
    color: '#7a0814',
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transmission: lite ? 0 : 0.15,
    thickness: 0.3,
    ior: 1.42,
    attenuationColor: new THREE.Color('#4a040b'),
    attenuationDistance: 0.4,
    bumpMap: swirlBump(512, 9, 40, 10),
    bumpScale: 0.6,
  });

  return {
    bread: { bottom: bottomGeo, top: topGeo, materials: [crumbMat, crustMat] },
    butter: { geo: butterGeo, material: butterMat },
    jelly: { geo: jellyGeo, material: jellyMat },
    dispose() {
      [bottomGeo, topGeo, butterGeo, jellyGeo].forEach((g) => g.dispose());
      [crumbMat, crustMat, butterMat, jellyMat].forEach((m) => {
        ['map', 'bumpMap'].forEach((k) => m[k]?.dispose());
        m.dispose();
      });
    },
  };
}

// A soft round shadow texture for the blob shadow under the sandwich.
export function blobShadowTexture() {
  const [c, ctx] = canvas(256);
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
  g.addColorStop(0, 'rgba(11,37,69,0.55)');
  g.addColorStop(0.6, 'rgba(11,37,69,0.18)');
  g.addColorStop(1, 'rgba(11,37,69,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
