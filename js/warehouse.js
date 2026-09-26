/* =========================================================
   WAREXX — warehouse renderer
   Procedural rack textures (canvas, generated once) +
   a CSS-3D corridor the camera dollies through, plus
   2D-projected billboards (people, lamps, papers, tags).
   ========================================================= */
(function () {
  "use strict";

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- rack geometry (shared by texture + digital overlay) ---------- */
  function rackGeometry(w, h, o) {
    const u = h / 900;
    const bayW = (o.bayW || 250) * u;
    const levelsF = o.levels || [0.965, 0.73, 0.5, 0.27, 0.06];
    const levels = levelsF.map((f) => f * h);
    const up = 14 * u;
    const bays = [];
    const start = (o.offset || 0) * u;
    for (let x = start - bayW; x < w + bayW; x += bayW) bays.push({ x, w: bayW });
    return { u, bayW, levels, up, bays };
  }

  function drawBox(ctx, r, x, y, w, h, u) {
    const hue = 26 + r() * 10, sat = 26 + r() * 20, lit = 30 + r() * 16;
    ctx.fillStyle = `hsl(${hue},${sat}%,${lit}%)`;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = `hsla(${hue},${sat}%,${lit + 14}%,.9)`;
    ctx.fillRect(x, y, w, 2 * u);
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.fillRect(x + w - 4 * u, y, 4 * u, h);
    ctx.fillStyle = "rgba(210,180,130,.28)";
    ctx.fillRect(x + w / 2 - 3 * u, y, 6 * u, h * 0.45);
    if (r() < 0.45 && w > 30 * u) {
      const lw = Math.min(w * 0.42, 34 * u), lh = lw * 0.62;
      const lx = x + 6 * u + r() * (w - lw - 12 * u), ly = y + h * 0.45 + r() * (h * 0.3);
      ctx.fillStyle = "rgba(236,232,222,.85)";
      ctx.fillRect(lx, ly, lw, lh);
      ctx.fillStyle = "rgba(20,20,20,.7)";
      for (let i = 0; i < 7; i++) ctx.fillRect(lx + 3 * u + i * (lw - 6 * u) / 7, ly + lh * 0.45, (1 + (i % 2)) * u, lh * 0.4);
    }
  }

  function drawSlot(ctx, r, sx, top, sw, bottom, u) {
    const t = r();
    const ph = 12 * u;
    if (t < 0.08) return; // empty slot
    // pallet
    ctx.fillStyle = "#4b3a27";
    ctx.fillRect(sx + 8 * u, bottom - ph, sw - 16 * u, ph);
    ctx.fillStyle = "#15100a";
    for (let i = 0; i < 2; i++) ctx.fillRect(sx + 8 * u + (sw - 16 * u) * (0.2 + i * 0.45), bottom - ph * 0.65, (sw - 16 * u) * 0.18, ph * 0.65);
    const avail = bottom - ph - top - 10 * u;
    if (t < 0.18) {
      // plastic crates
      const rows = 2 + Math.floor(r() * 3), cols = 2;
      const ch = Math.min(avail * 0.9, rows * 44 * u) / rows, cw = (sw - 24 * u) / cols;
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
          const x = sx + 12 * u + j * cw, y = bottom - ph - (i + 1) * ch;
          ctx.fillStyle = "#26384a"; ctx.fillRect(x + u, y + u, cw - 2 * u, ch - 2 * u);
          ctx.fillStyle = "#0f1823"; ctx.fillRect(x + cw * 0.3, y + ch * 0.18, cw * 0.4, ch * 0.16);
          ctx.fillStyle = "rgba(160,200,240,.18)"; ctx.fillRect(x + u, y + u, cw - 2 * u, 2 * u);
        }
      return;
    }
    const stackH = avail * (0.55 + r() * 0.42);
    const rows = 2 + Math.floor(r() * 3);
    const cols = 2 + Math.floor(r() * 2);
    const bw = (sw - 20 * u) / cols, bh = stackH / rows;
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        if (i === rows - 1 && r() < 0.2) continue;
        drawBox(ctx, r, sx + 10 * u + j * bw + u, bottom - ph - (i + 1) * bh + u, bw - 2 * u, bh - 2 * u, u);
      }
    if (t > 0.7) {
      // shrink-wrap sheen
      const x = sx + 9 * u, y = bottom - ph - stackH, w = sw - 18 * u;
      const g = ctx.createLinearGradient(x, y, x + w, y + stackH);
      g.addColorStop(0, "rgba(230,236,245,.10)"); g.addColorStop(0.35, "rgba(230,236,245,.02)");
      g.addColorStop(0.5, "rgba(240,244,250,.16)"); g.addColorStop(0.62, "rgba(230,236,245,.03)"); g.addColorStop(1, "rgba(230,236,245,.08)");
      ctx.fillStyle = g; ctx.fillRect(x, y, w, stackH);
    }
  }

  /** Draw a rack face. Returns geometry used for overlays. */
  function drawRack(canvas, o) {
    const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
    const r = rng(o.seed || 1);
    const G = rackGeometry(w, h, o);
    const { u, levels, up, bays } = G;

    ctx.fillStyle = "#0b0a09"; ctx.fillRect(0, 0, w, h);
    // back wall / depth behind racks
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#050505"); bg.addColorStop(1, "#161310");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // contents
    for (const b of bays) {
      for (let l = 0; l < levels.length - 1; l++) {
        const bottom = levels[l], top = levels[l + 1] + 16 * u;
        drawSlot(ctx, r, b.x + up, top, b.w - up, bottom, u);
      }
    }
    // beams
    for (let l = 1; l < levels.length; l++) {
      const y = levels[l];
      ctx.fillStyle = "#8f4a1b"; ctx.fillRect(0, y, w, 16 * u);
      ctx.fillStyle = "rgba(255,190,120,.25)"; ctx.fillRect(0, y, w, 2 * u);
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, y + 13 * u, w, 3 * u);
      // location labels
      ctx.font = `${Math.round(8 * u)}px monospace`;
      for (const b of bays) {
        const lx = b.x + b.w / 2 - 17 * u;
        ctx.fillStyle = "rgba(235,232,224,.9)"; ctx.fillRect(lx, y + 2 * u, 34 * u, 11 * u);
        ctx.fillStyle = "#1a1a1a"; ctx.fillText(`${o.code || "A"}-${String((Math.abs(Math.round(b.x / b.w)) % 40) + 1).padStart(2, "0")}-${l}`, lx + 2 * u, y + 10 * u);
      }
    }
    // uprights
    for (const b of bays) {
      ctx.fillStyle = "#262b31"; ctx.fillRect(b.x, 0, up, h);
      ctx.fillStyle = "rgba(160,180,200,.12)"; ctx.fillRect(b.x, 0, 2 * u, h);
      ctx.fillStyle = "#0d0f11";
      for (let y = 20 * u; y < h; y += 18 * u) ctx.fillRect(b.x + 5 * u, y, 4 * u, 7 * u);
    }
    // floor strip
    ctx.fillStyle = "#0a0908"; ctx.fillRect(0, levels[0], w, h - levels[0]);

    // lighting (multiply a lightmap)
    const lm = document.createElement("canvas");
    lm.width = Math.max(1, Math.round(w / 4)); lm.height = Math.max(1, Math.round(h / 4));
    const lx = lm.getContext("2d");
    const amb = o.ambient == null ? 26 : o.ambient;
    lx.fillStyle = `rgb(${amb},${amb - 2},${amb - 4})`; lx.fillRect(0, 0, lm.width, lm.height);
    lx.globalCompositeOperation = "lighter";
    const warm = o.warm || [255, 222, 180];
    for (const L of o.lamps || []) {
      const g = lx.createRadialGradient(L.x / 4, L.y / 4, 0, L.x / 4, L.y / 4, L.r / 4);
      const i = L.i == null ? 1 : L.i;
      g.addColorStop(0, `rgba(${warm[0]},${warm[1]},${warm[2]},${0.95 * i})`);
      g.addColorStop(0.45, `rgba(${warm[0]},${warm[1]},${warm[2]},${0.38 * i})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      lx.fillStyle = g; lx.fillRect(0, 0, lm.width, lm.height);
    }
    ctx.globalCompositeOperation = "multiply";
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lm, 0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
    // top falloff into darkness
    const top = ctx.createLinearGradient(0, 0, 0, h * 0.35);
    top.addColorStop(0, "rgba(0,0,0,.85)"); top.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = top; ctx.fillRect(0, 0, w, h * 0.35);
    return G;
  }

  /** Digital overlay (transparent) aligned to a rack drawn with the same options. */
  function drawRackOverlay(canvas, o) {
    const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
    const r = rng((o.seed || 1) * 7 + 3);
    const { u, levels, bays, up } = rackGeometry(w, h, o);
    ctx.clearRect(0, 0, w, h);
    for (const b of bays) {
      for (let l = 0; l < levels.length - 1; l++) {
        const y0 = levels[l + 1] + 16 * u, y1 = levels[l];
        const x0 = b.x + up + 4 * u, x1 = b.x + b.w - 4 * u;
        const k = r();
        if (k < 0.22) { ctx.fillStyle = "rgba(61,245,138,.10)"; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
        ctx.strokeStyle = k < 0.22 ? "rgba(61,245,138,.75)" : "rgba(77,163,255,.28)";
        ctx.lineWidth = 1.5 * u; ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
        if (k < 0.5) {
          ctx.font = `${Math.round(11 * u)}px monospace`;
          ctx.fillStyle = k < 0.22 ? "rgba(61,245,138,.95)" : "rgba(160,205,255,.7)";
          ctx.fillText(`${Math.floor(40 + r() * 1800)} u`, x0 + 6 * u, y0 + 16 * u);
        }
      }
    }
    for (let l = 1; l < levels.length; l++) {
      ctx.fillStyle = "rgba(61,245,138,.85)"; ctx.fillRect(0, levels[l], w, 2 * u);
    }
    for (const b of bays) { ctx.fillStyle = "rgba(77,163,255,.5)"; ctx.fillRect(b.x, 0, 1.5 * u, h); }
  }

  function drawPallet(canvas, seed) {
    const w = canvas.width, h = canvas.height, ctx = canvas.getContext("2d");
    const r = rng(seed); const u = w / 260;
    ctx.clearRect(0, 0, w, h);
    const ph = 16 * u;
    ctx.fillStyle = "#3e3020"; ctx.fillRect(0, h - ph, w, ph);
    ctx.fillStyle = "#0d0a07"; ctx.fillRect(w * 0.18, h - ph * 0.65, w * 0.16, ph * 0.65); ctx.fillRect(w * 0.66, h - ph * 0.65, w * 0.16, ph * 0.65);
    const rows = 3 + Math.floor(r() * 2), cols = 3;
    const sh = (h - ph) * (0.7 + r() * 0.28), bw = w / cols, bh = sh / rows;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) drawBox(ctx, r, j * bw + u, h - ph - (i + 1) * bh + u, bw - 2 * u, bh - 2 * u, u);
    // light from above, dark below
    ctx.globalCompositeOperation = "multiply";
    const g = ctx.createLinearGradient(0, h - ph - sh, 0, h);
    g.addColorStop(0, "rgb(150,136,118)"); g.addColorStop(1, "rgb(26,23,20)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";
  }

  function toURL(canvas, type = "image/jpeg", q = 0.86) {
    return new Promise((res) => canvas.toBlob((b) => res(URL.createObjectURL(b)), type, q));
  }
  function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.round(w); c.height = Math.round(h); return c; }

  /* ---------- Texture set (built once, shared) ---------- */
  async function buildTextures(opts) {
    const res = opts.res;
    const SEG = 1000, H = 900;
    const W = Math.round(SEG * res), Hh = Math.round(H * res);
    const lamps = [250, 750].map((x) => ({ x: x * res, y: -40 * res, r: 820 * res, i: 1 }));
    const out = { wall: [], overlay: [], pallet: [], front: null, frontGeo: null };
    const seeds = opts.mobile ? [11, 23] : [11, 23, 37];
    for (let i = 0; i < seeds.length; i++) {
      const c = makeCanvas(W, Hh);
      drawRack(c, { seed: seeds[i], lamps, code: "ABC"[i] });
      out.wall.push(await toURL(c));
      const ov = makeCanvas(W, Hh);
      drawRackOverlay(ov, { seed: seeds[i] });
      out.overlay.push(await toURL(ov, "image/png"));
    }
    for (let i = 0; i < 3; i++) {
      const c = makeCanvas(260 * Math.max(res, 0.7), 230 * Math.max(res, 0.7));
      drawPallet(c, 91 + i * 13);
      out.pallet.push(await toURL(c, "image/png"));
    }
    // front-on rack for the inventory scene (1600 x 900 design space)
    const fr = opts.mobile ? 0.7 : 1;
    const f = makeCanvas(1600 * fr, 900 * fr);
    const frontOpts = { seed: 5, bayW: 300, offset: 80, levels: [0.97, 0.7, 0.44, 0.18, -0.2], code: "A", ambient: 18,
      lamps: [{ x: 620 * fr, y: 60 * fr, r: 900 * fr, i: 1 }, { x: 1300 * fr, y: 120 * fr, r: 700 * fr, i: 0.55 }] };
    drawRack(f, frontOpts);
    out.front = await toURL(f);
    out.frontGeo = rackGeometry(1600, 900, frontOpts);
    return out;
  }

  /* ---------- Corridor ---------- */
  class Corridor {
    constructor(vp, layer, tex, o) {
      this.vp = vp; this.layer = layer; this.o = o;
      this.SEG = 1000; this.H = 900; this.W = o.width || 1100; this.L = o.length || 7000;
      this.camX = 0; this.camY = -260; this.camZ = 0;
      this.world = document.createElement("div");
      this.world.className = "world";
      vp.appendChild(this.world);
      this.segs = [];
      this.overlays = [];
      this.bbs = [];
      this.build(tex);
      this.resize();
    }

    plane(cls, w, h, transform, bg) {
      const el = document.createElement("div");
      el.className = "plane " + cls;
      el.style.width = w + "px"; el.style.height = h + "px";
      el.style.left = -w / 2 + "px"; el.style.top = -h / 2 + "px";
      el.style.transform = transform;
      if (bg) el.style.backgroundImage = bg;
      this.world.appendChild(el);
      return el;
    }

    build(tex) {
      const { SEG, H, W, L } = this;
      const n = Math.ceil(L / SEG);
      for (let i = -1; i < n; i++) {
        const zc = -(i + 0.5) * SEG;
        const ti = i + 1;
        const t = tex.wall[ti % tex.wall.length], t2 = tex.wall[(ti + 1) % tex.wall.length];
        const left = this.plane("wall", SEG, H, `translate3d(${-W / 2}px,0,${zc}px) rotateY(90deg)`, `url(${t})`);
        const right = this.plane("wall", SEG, H, `translate3d(${W / 2}px,0,${zc}px) rotateY(-90deg)`, `url(${t2})`);
        // floor: concrete, safety lanes, light pools under the two lamps in this segment
        const pools = [250, 750].map((d) => `radial-gradient(ellipse 46% 170px at 50% ${SEG - d}px, rgba(255,214,160,${this.o.digital ? 0.09 : 0.13}), transparent 70%)`).join(",");
        const lanes = "linear-gradient(90deg, transparent 9%, rgba(201,138,46,.32) 9% 9.7%, transparent 9.7% 90.3%, rgba(201,138,46,.32) 90.3% 91%, transparent 91%)";
        const conc = "linear-gradient(90deg, #0b0b0b, #121110 50%, #0b0b0b)";
        const floor = this.plane("floor", W, SEG, `translate3d(0,${H / 2}px,${zc}px) rotateX(90deg)`, `${pools},${lanes},${conc}`);
        const seg = { zc, els: [left, right, floor], on: true };
        if (this.o.digital) {
          const ol = this.plane("overlay", SEG, H, `translate3d(${-W / 2 + 2}px,0,${zc}px) rotateY(90deg)`, `url(${tex.overlay[ti % tex.overlay.length]})`);
          const or = this.plane("overlay", SEG, H, `translate3d(${W / 2 - 2}px,0,${zc}px) rotateY(-90deg)`, `url(${tex.overlay[(ti + 1) % tex.overlay.length]})`);
          const of = this.plane("overlay floor-data", W, SEG, `translate3d(0,${H / 2 - 1}px,${zc}px) rotateX(90deg)`,
            "linear-gradient(90deg, transparent 22%, rgba(77,163,255,.5) 22% 22.25%, transparent 22.25% 50%, rgba(61,245,138,.65) 50% 50.3%, transparent 50.3% 77.75%, rgba(77,163,255,.5) 77.75% 78%, transparent 78%)");
          this.overlays.push(ol, or, of);
          seg.els.push(ol, or, of);
        }
        this.segs.push(seg);
      }
      this.back = this.plane("backwall", W, H, `translate3d(0,0,${-L}px)`);

      // lamps + light cones
      for (let z = -250; z > -L; z -= 500) {
        this.add("bb-lamp", { x: 0, y: -H / 2 + 40, z, anchor: "c" });
        this.add("bb-cone", { x: 0, y: -H / 2 + 40, z, anchor: "tc", fade: 0.9 });
      }
    }

    /** Add a billboard: world-space point, anchored element, scale factor k (css px → world units). */
    add(cls, o, html) {
      const el = document.createElement(o.tag || "div");
      el.className = "bb " + cls;
      if (html) el.innerHTML = html;
      if (o.src) { el.src = o.src; el.alt = ""; el.decoding = "async"; }
      this.layer.appendChild(el);
      const b = Object.assign({ el, k: 1, fade: 1, anchor: "c", rot: 0, alpha: 1 }, o);
      b.ax = b.anchor === "bc" || b.anchor === "tc" || b.anchor === "c" ? -50 : 0;
      b.ay = b.anchor === "bc" ? -100 : b.anchor === "tc" ? 0 : -50;
      this.bbs.push(b);
      return b;
    }

    resize() {
      const w = this.vp.clientWidth, h = this.vp.clientHeight;
      this.P = clamp(w * 0.62, 430, 900);
      this.vp.style.perspective = this.P + "px";
      this.cx = w / 2; this.cy = h * 0.46;
    }

    project(x, y, z) {
      const vz = z + this.camZ;
      const d = this.P - vz;
      const s = this.P / Math.max(d, 1);
      return { x: this.cx + (x + this.camX) * s, y: this.cy + (y + this.camY) * s, s, vz, d };
    }

    setCamera(z, x = 0, y = -260) {
      this.camZ = z; this.camX = x; this.camY = y;
      this.world.style.transform = `translate3d(${x}px,${y}px,${z}px)`;
      const FAR = 6200;
      for (const s of this.segs) {
        const near = s.zc + this.SEG / 2 + z, far = s.zc - this.SEG / 2 + z;
        const on = far < this.P - 20 && near > -FAR;
        if (on !== s.on) { s.on = on; for (const e of s.els) e.style.visibility = on ? "" : "hidden"; }
      }
      this.renderBillboards();
    }

    renderBillboards() {
      for (const b of this.bbs) {
        const p = this.project(b.x, b.y, b.z);
        let a = b.alpha * b.fade;
        if (p.d < 90 || p.vz < -7000 || a <= 0.001) { if (b.vis !== false) { b.el.style.visibility = "hidden"; b.vis = false; } continue; }
        // fog: darken with distance; fade out as it reaches the lens
        const fog = clamp((-p.vz - 600) / 4200);
        a *= 1 - fog * 0.9;
        if (p.d < 420) a *= clamp((p.d - 90) / 330);
        if (b.vis !== true) { b.el.style.visibility = ""; b.vis = true; }
        const s = p.s * b.k;
        b.el.style.opacity = a.toFixed(3);
        b.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) scale(${s.toFixed(4)}) translate(${b.ax}%,${b.ay}%)${b.rot ? ` rotate(${b.rot}deg)` : ""}`;
        const zi = 5000 + Math.round(p.vz / 4);
        if (zi !== b.zi) { b.zi = zi; b.el.style.zIndex = zi; }
      }
    }

    setOverlay(t) {
      const v = t.toFixed(3);
      for (const o of this.overlays) o.style.opacity = v;
    }
  }

  window.WX = { buildTextures, Corridor, rng, clamp };
})();
