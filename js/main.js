/* =========================================================
   WAREXX — scroll engine + scenes
   Each [data-scene] section is tall; its .stage is sticky.
   Scroll position → progress p ∈ [0,1] per scene (smoothed),
   and every scene maps p onto its own timeline.
   ========================================================= */
(function () {
  "use strict";
  const { Corridor, buildTextures, rng, clamp } = window.WX;

  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // ?capture: the page stops driving itself so a recorder can step time + scroll frame by frame
  const CAPTURE = /[?&]capture(&|=|$)/.test(location.search);
  const isMobile = () => innerWidth < 821;
  const MOBILE = isMobile();
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const smooth = (t) => t * t * (3 - 2 * t);
  const SVGNS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs = {}, parent) => {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  };
  const fmtINR = (n) => {
    const s = Math.round(n).toString();
    if (s.length <= 3) return s;
    const last3 = s.slice(-3), rest = s.slice(0, -3);
    return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  };
  const setStyle = (el, prop, val) => { if (el["_" + prop] !== val) { el["_" + prop] = val; el.style[prop] = val; } };

  /** Reveal stacked headline lines (mask-up), fade out with drift. */
  function title(el, tin, tout = 0, dy = 36) {
    if (!el) return;
    if (!el._lines) el._lines = $$(".line > span", el);
    const key = tin.toFixed(3) + "|" + tout.toFixed(3);
    if (el._key === key) return;
    el._key = key;
    const vis = tin > 0 && tout < 1;
    setStyle(el, "opacity", vis ? (1 - tout).toFixed(3) : "0");
    if (!vis) return;
    const n = el._lines.length;
    el._lines.forEach((s, i) => {
      const t = easeOut(clamp(tin * (1 + 0.35 * (n - 1)) - i * 0.35));
      s.style.transform = `translate3d(0,${((1 - t) * 112).toFixed(2)}%,0)`;
    });
    setStyle(el, "translate", `0 ${(-tout * dy).toFixed(1)}px`);
  }

  /* =======================================================
     Scenes
     ======================================================= */
  const scenes = {};
  let TEX = null;

  /* ---------- 01 · Enter the warehouse ---------- */
  scenes.enter = {
    fade: [0, 0.05],
    init(s) {
      this.open = $('[data-el="open"]', s.el);
      this.works = $('[data-el="works"]', s.el);
      this.time = $('[data-el="time"]', s.el);
      this.clock = $('[data-el="clock"]', s.el);
      this.openSub = $$(".kicker, .sub, .scroll-cue", this.open);
      this.dark = document.createElement("div");
      this.dark.style.cssText = "position:absolute;inset:0;background:#000;pointer-events:none;z-index:2";
      s.stage.insertBefore(this.dark, $(".depth-fog", s.stage));
      s.always = true;
    },
    ready(s) {
      const L = MOBILE ? 6000 : 7000;
      const c = (this.c = new Corridor($(".vp3d", s.el), $("[data-billboards]", s.el), TEX, { length: L }));
      this.travel = L - 1700;
      const H2 = 450;
      const pal = MOBILE ? [-900, -2400, -3900] : [-900, -1700, -2900, -3600, -4700, -5600];
      pal.forEach((z, i) => c.add("bb-pallet", { tag: "img", src: TEX.pallet[i % 3], x: i % 2 ? 420 : -420, y: H2, z, anchor: "bc", k: 0.9 }));
      const workers = MOBILE ? [[-300, -1500], [240, -2600], [-200, -4300]] : [[-320, -1500], [250, -2450], [-150, -3300], [360, -4300], [-280, -5200]];
      workers.forEach(([x, z], i) => {
        const b = c.add("bb-worker", { tag: "div", x, y: H2, z, anchor: "bc", k: 0.365 }, `<svg viewBox="0 0 200 520" width="200" height="520"${i % 2 ? ' style="transform:scaleX(-1)"' : ""}><use href="#sym-worker"/></svg>`);
        b.sway = i * 1.7;
      });
      c.add("bb-forklift", { x: 170, y: H2, z: -3900, anchor: "bc", k: 0.75 }, '<svg viewBox="0 0 420 300" width="420" height="300"><use href="#sym-forklift"/></svg>');
      if (!MOBILE) c.add("bb-forklift", { x: -190, y: H2, z: -5900, anchor: "bc", k: 0.75 }, '<svg viewBox="0 0 420 300" width="420" height="300" style="transform:scaleX(-1)"><use href="#sym-forklift"/></svg>');
      const r = rng(7);
      const docs = ["INVOICE #4471", "PO-2231", "LR 88412", "STOCK REG. P.112", "GRN — PENDING", "DELIVERY CHALLAN", "INVOICE #4468", "STOCK SHEET", "PO-2236", "LR 88420", "RETURN SLIP", "COUNT SHEET"];
      this.papers = [];
      const nPapers = MOBILE ? 7 : 12;
      for (let i = 0; i < nPapers; i++) {
        const side = i % 2 ? 1 : -1;
        const b = c.add("bb-paper", { x: side * (70 + r() * 330), y: -240 + r() * 330, z: -500 - i * (4700 / nPapers) - r() * 200, anchor: "c", k: 0.42, rot: -25 + r() * 50 }, `<b>${docs[i]}</b>`);
        b.baseRot = b.rot; b.spin = -40 + r() * 80; b.bob = r() * 6;
        this.papers.push(b);
      }
      const tags = [["Invoice", -470, -120, -1200], ["Purchase order", 440, -260, -2000], ["LR", -460, 40, -2800], ["Stock register", 440, -80, -3500], ["Manual entry", -450, -240, -4300]];
      tags.forEach(([t, x, y, z]) => c.add("bb-tag-wrap", { x, y, z, anchor: "c", k: 1.1 }, `<span class="bb-tag">${t}</span>`));
      this.lamps = c.bbs.filter((b) => b.el.classList.contains("bb-lamp") || b.el.classList.contains("bb-cone"));
      // lamps come on near → far, a pair (fixture + cone) at a time
      this.lamps.forEach((b, i) => { b.on = 0.25 + Math.floor(i / 2) * 0.11; b.alpha = 0; });
    },
    /** Called once textures are decoded, fonts are in and the layers have painted. */
    start() { this.t0 = performance.now(); },
    update(p, s, now) {
      const intro = RM ? 9 : this.t0 != null ? Math.max(0, (now - this.t0) / 1000) : 0;
      // opening titles appear on load, then scroll carries them away
      const tin = seg(intro, 1.1, 2.7);
      title(this.open, tin, seg(p, 0.06, 0.15), 60);
      const subA = easeOut(seg(intro, 2.0, 3.0)).toFixed(3);
      this.openSub.forEach((e) => setStyle(e, "opacity", subA));
      title(this.works, seg(p, 0.4, 0.48), seg(p, 0.6, 0.66));
      title(this.time, seg(p, 0.68, 0.76), seg(p, 0.9, 0.96));
      const secs = Math.floor(seg(p, 0.68, 0.96) * 277);
      const cl = `00:${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
      if (this.clock.textContent !== cl) this.clock.textContent = cl;

      const power = easeInOut(seg(intro, 0.1, 2.4));
      setStyle(this.dark, "opacity", Math.max(1 - power, seg(p, 0.93, 1)).toFixed(3));
      if (!this.c) return;
      // lamps warm up one after another, with one soft dip (no hard strobing)
      for (const b of this.lamps) {
        const t = intro - b.on;
        b.alpha = smooth(seg(t, 0, 0.55)) * (1 - 0.4 * Math.exp(-(((t - 0.2) / 0.06) ** 2)));
      }
      // a slow push-in on load, so the first frame is already moving
      const glide = RM ? 0 : (1 - easeOut(seg(intro, 0, 3.6))) * -420;
      const q = smooth(seg(p, 0.0, 1));
      const z = q * this.travel + glide;
      for (const b of this.papers) { b.rot = b.baseRot + b.spin * p; }
      const bob = RM ? 0 : Math.sin(z / 95) * 3;
      this.c.setCamera(z, RM ? 0 : Math.sin(p * 7) * 16, -260 + bob);
    },
    resize() { this.c && this.c.resize(); },
  };

  /* ---------- 02 · Documents ---------- */
  scenes.docs = {
    fade: [0.05, 0.05],
    init(s) {
      const q = (k) => $(`[data-el="${k}"]`, s.el);
      Object.assign(this, { paper: q("paper"), wrap: q("paperWrap"), scan: q("scan"), record: q("record"), chipsEl: q("chips"), from: q("fromDocs"), to: q("toData") });
      this.srcs = $$(".sp[data-f]", this.paper);
      this.fields = this.srcs.map((src, i) => {
        const tgt = $(`[data-t="${src.dataset.f}"]`, this.record);
        const chip = document.createElement("span");
        chip.className = "chip"; chip.textContent = src.textContent.trim();
        this.chipsEl.appendChild(chip);
        tgt.classList.add("pending");
        return { src, tgt, chip, start: 0.6 + i * (0.22 / this.srcs.length) };
      });
      this.stage = s.stage;
    },
    resize() {
      const w = this.wrap, prev = w.style.transform;
      w.style.transform = "none";
      const r = w.getBoundingClientRect(), st = this.stage.getBoundingClientRect();
      w.style.transform = prev;
      this.dx = st.left + st.width / 2 - (r.left + r.width / 2);
      this.dy = st.top + st.height * 0.6 - (r.top + r.height / 2);
      this.paperH = this.paper.offsetHeight;
      this.fields.forEach((f) => {
        let y = 0, e = f.src;
        while (e && e !== this.paper) { y += e.offsetTop; e = e.offsetParent; }
        f.rel = (y + f.src.offsetHeight / 2) / this.paperH;
      });
    },
    update(p) {
      title(this.from, seg(p, 0.05, 0.16), seg(p, 0.95, 0.99));
      title(this.to, seg(p, 0.6, 0.7), seg(p, 0.95, 0.99));
      // 1. the invoice lifts off the desk toward the camera
      const a = easeInOut(seg(p, 0.0, 0.28));
      const b = easeInOut(seg(p, 0.46, 0.6));
      const tx = this.dx * (1 - b), ty = this.dy * (1 - b) + (1 - a) * innerHeight * 0.2;
      this.wrap.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
      this.paper.style.transform = `rotateX(${((1 - a) * 64).toFixed(2)}deg) rotateY(${(b * 12).toFixed(2)}deg) scale(${(0.66 + 0.34 * a - 0.06 * b).toFixed(4)})`;
      setStyle(this.paper, "filter", `brightness(${(0.3 + 0.7 * a - 0.28 * b).toFixed(3)}) sepia(${(b * 0.25).toFixed(3)})`);
      // 2. scan
      const sc = seg(p, 0.3, 0.48);
      setStyle(this.scan, "opacity", sc > 0 && sc < 1 ? "1" : "0");
      this.scan.style.top = (sc * 100).toFixed(2) + "%";
      for (const f of this.fields) f.src.classList.toggle("hit", sc >= f.rel && p < 0.9);
      // 3. the digital record assembles
      const rv = easeOut(seg(p, 0.5, 0.6));
      setStyle(this.record, "opacity", rv.toFixed(3));
      this.record.style.transform = `translate3d(${((1 - rv) * 40).toFixed(1)}px,0,0)`;
      const flying = p > 0.58 && p < 0.95;
      const st = flying ? this.stage.getBoundingClientRect() : null;
      for (const f of this.fields) {
        const t = seg(p, f.start, f.start + 0.1);
        f.tgt.classList.toggle("pending", t < 1);
        f.tgt.classList.toggle("landed", t >= 1 && p < f.start + 0.2);
        if (!flying || t <= 0 || t >= 1) { setStyle(f.chip, "opacity", "0"); continue; }
        const r1 = f.src.getBoundingClientRect(), r2 = f.tgt.getBoundingClientRect();
        const e = easeInOut(t);
        const x = lerp(r1.left, r2.left, e) - st.left, y = lerp(r1.top, r2.top, e) - st.top - Math.sin(Math.PI * e) * 50;
        setStyle(f.chip, "opacity", (Math.min(1, t * 6, (1 - t) * 6)).toFixed(3));
        f.chip.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      }
    },
  };

  /* ---------- 03 · Inventory ---------- */
  scenes.inventory = {
    fade: [0.05, 0.05],
    init(s) {
      const q = (k) => $(`[data-el="${k}"]`, s.el);
      Object.assign(this, { frame: q("invFrame"), img: q("rackImg"), grid: q("invGrid"), worker: q("worker"), counter: q("counter"), cState: q("cState"), cVal: q("cVal"), cSub: q("cSub"), cBar: q("cBar"), k1: q("know1"), k2: q("know2"), panel: q("invPanel") });
    },
    ready() {
      this.img.src = TEX.front;
      const G = TEX.frontGeo;
      this.slots = [];
      const vis = G.bays.filter((b) => b.x + b.w > 0 && b.x < 1600);
      vis.forEach((b, bi) => {
        for (let l = 0; l < 3; l++) {
          const y0 = G.levels[l + 1] + 16, y1 = G.levels[l];
          const x0 = b.x + G.up + 4, x1 = b.x + b.w - 4;
          const code = `A-${String(bi + 1).padStart(2, "0")}-${String(l + 1).padStart(2, "0")}`;
          const rect = svg("rect", { class: "slot", x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, this.grid);
          const txt = svg("text", { class: "slot-code", x: x0 + 10, y: y0 + 22 }, this.grid);
          txt.textContent = code;
          this.slots.push({ rect, txt, code, x0, y0, w: x1 - x0, h: y1 - y0, d: (bi * 3 + l) / (vis.length * 3) });
        }
      });
      const tg = this.slots.find((s) => s.code === "A-04-02") || this.slots[Math.floor(this.slots.length / 2)];
      this.tgtRect = svg("rect", { class: "target", x: tg.x0, y: tg.y0, width: tg.w, height: tg.h }, this.grid);
      this.tLabel = svg("text", { class: "slot-code", x: tg.x0 + 10, y: tg.y1 || tg.y0 + tg.h - 14, style: "font-size:16px;fill:#3df58a" }, this.grid);
      this.tLabel.textContent = "MCB 32A DP · 1,240";
      this.flash = svg("rect", { class: "flash", x: 0, y: 0, width: 0, height: 0 }, this.grid);
      this.searchOrder = [7, 13, 2, 16, 5, 11, 19, 1].map((i) => this.slots[i % this.slots.length]);
    },
    update(p) {
      const dolly = easeInOut(p);
      this.frame.style.transform = `translate(-50%,-50%) scale(${(1.02 + dolly * 0.16).toFixed(4)}) translateX(${(-dolly * 2).toFixed(2)}%)`;
      const dig = seg(p, 0.44, 0.58);
      this.worker.style.transform = `translate3d(${(-p * 9).toFixed(2)}vw,0,0)`;
      setStyle(this.worker, "opacity", (1 - dig * 0.65).toFixed(3));

      // the slow, manual count
      let state, val, sub, bar, done = false;
      if (p < 0.16) { const t = seg(p, 0.02, 0.16); state = "Counting…"; val = Math.floor(t * 37); sub = "boxes · aisle 4 · bay ?"; bar = t * 0.35; }
      else if (p < 0.29) { const t = seg(p, 0.16, 0.29); state = "Searching…"; val = 37; sub = ["aisle 4?", "aisle 7?", "store room?", "aisle 2?"][Math.floor(t * 3.99)]; bar = 0.35 + t * t * 0.22; }
      else if (p < 0.43) { const t = seg(p, 0.29, 0.43); state = "Updating…"; val = 37; sub = "register · page 112 · by hand"; bar = 0.57 + Math.sqrt(t) * 0.2; }
      else { state = "Synced · WAREXX"; val = "1,240"; sub = "units · A-04-02 · live"; bar = 1; done = true; }
      if (this.cState.textContent !== state) this.cState.textContent = state;
      if (this.cVal.textContent !== String(val)) this.cVal.textContent = val;
      if (this.cSub.textContent !== sub) this.cSub.textContent = sub;
      this.cBar.style.transform = `scaleX(${bar.toFixed(3)})`;
      this.counter.classList.toggle("done", done);
      setStyle(this.counter, "opacity", (seg(p, 0.02, 0.06) * (1 - seg(p, 0.52, 0.58))).toFixed(3));

      if (!this.slots) return;
      // searching: an amber outline hops between the wrong bays
      const sr = seg(p, 0.16, 0.29);
      if (sr > 0 && sr < 1) {
        const s = this.searchOrder[Math.floor(sr * this.searchOrder.length) % this.searchOrder.length];
        this.flash.setAttribute("x", s.x0); this.flash.setAttribute("y", s.y0); this.flash.setAttribute("width", s.w); this.flash.setAttribute("height", s.h);
        setStyle(this.flash, "opacity", "1");
      } else setStyle(this.flash, "opacity", "0");

      const find = seg(p, 0.7, 0.78);
      for (const s of this.slots) {
        const o = seg(dig, s.d * 0.7, s.d * 0.7 + 0.3);
        const v = (o * (1 - find * 0.6)).toFixed(3);
        setStyle(s.rect, "opacity", v);
        setStyle(s.txt, "opacity", (o * 0.85 * (1 - find * 0.7)).toFixed(3));
      }
      setStyle(this.tgtRect, "opacity", find.toFixed(3));
      setStyle(this.tLabel, "opacity", find.toFixed(3));
      title(this.k1, seg(p, 0.46, 0.54), seg(p, 0.64, 0.7));
      title(this.k2, seg(p, 0.7, 0.78), seg(p, 0.93, 0.97));
      const pv = easeOut(seg(p, 0.5, 0.6));
      setStyle(this.panel, "opacity", pv.toFixed(3));
      this.panel.style.transform = `translate3d(0,${((1 - pv) * 30).toFixed(1)}px,0)`;
    },
  };

  /* ---------- 04 · Stock movement ---------- */
  scenes.move = {
    fade: [0.05, 0.05],
    init(s) {
      const q = (k) => $(`[data-el="${k}"]`, s.el);
      Object.assign(this, { plan: q("plan"), svgEl: q("planSvg"), cm: q("chainManual"), cw: q("chainWarexx"), head: q("moveHead"), log: q("log") });
      this.cmLi = $$("li", this.cm); this.cwLi = $$("li", this.cw);
      const S = this.svgEl;
      const defs = svg("defs", {}, S);
      const lg = svg("linearGradient", { id: "trailGrad", gradientUnits: "userSpaceOnUse", x1: 200, y1: 0, x2: 2850, y2: 0 }, defs);
      svg("stop", { offset: 0, "stop-color": "#4da3ff" }, lg); svg("stop", { offset: 1, "stop-color": "#3df58a" }, lg);
      const f = svg("filter", { id: "glow", x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
      svg("feGaussianBlur", { stdDeviation: 6, result: "b" }, f);
      const m = svg("feMerge", {}, f); svg("feMergeNode", { in: "b" }, m); svg("feMergeNode", { in: "SourceGraphic" }, m);
      // floor grid
      for (let x = 0; x <= 3000; x += 100) svg("line", { x1: x, y1: 0, x2: x, y2: 1400, stroke: "rgba(255,255,255,.035)" }, S);
      for (let y = 0; y <= 1400; y += 100) svg("line", { x1: 0, y1: y, x2: 3000, y2: y, stroke: "rgba(255,255,255,.035)" }, S);
      const zones = [["RECEIVING", 80, 560, 500, 400], ["ZONE A", 620, 200, 760, 540], ["ZONE B", 1440, 200, 760, 540], ["DISPATCH", 2260, 200, 440, 400], ["RETURNS", 2260, 900, 440, 300], ["AUDIT", 2740, 560, 220, 280]];
      zones.forEach(([n, x, y, w, h]) => { svg("rect", { class: "zone", x, y, width: w, height: h, rx: 6 }, S); svg("text", { class: "zone-l", x: x + 18, y: y + 36 }, S).textContent = n; });
      [[640, 1360], [1460, 2180]].forEach(([a, b]) => [290, 560].forEach((y) => {
        for (let x = a; x < b; x += 120) { svg("rect", { class: "rack", x, y, width: 110, height: 100 }, S); svg("rect", { class: "rack-top", x: x + 6, y: y + 6, width: 98, height: 40 }, S); }
      }));
      const d = "M220,760 C500,760 600,470 820,470 C1000,470 1000,760 1150,760 C1400,760 1550,470 1800,470 C2100,470 2200,1050 2450,1050 C2650,1050 2650,700 2830,700";
      this.path = svg("path", { d, fill: "none", stroke: "rgba(255,255,255,.06)", "stroke-width": 2, "stroke-dasharray": "4 10" }, S);
      this.trailM = svg("path", { class: "trail-manual", d: "M0,0" }, S);
      this.trailD = svg("path", { class: "trail-digital", d: "M0,0" }, S);
      const len = this.path.getTotalLength();
      this.samples = [];
      for (let i = 0; i <= 240; i++) { const pt = this.path.getPointAtLength((len * i) / 240); this.samples.push([pt.x, pt.y]); }
      const evPts = [[820, 470, "STOCK IN", "A-04-02 · ×120"], [1150, 760, "STOCK OUT", "×40 · dispatch"], [1800, 470, "TRANSFER", "A-04 → B-11"], [2450, 1050, "RETURN", "×2 · damaged"], [2830, 700, "AUDIT", "1,160 ✓"]];
      this.events = evPts.map(([x, y, n, sub]) => {
        let best = 0, bd = 1e9;
        this.samples.forEach(([sx, sy], i) => { const dd = (sx - x) ** 2 + (sy - y) ** 2; if (dd < bd) { bd = dd; best = i; } });
        const g = svg("g", { class: "ev", transform: `translate(${x},${y})` }, S);
        svg("circle", { r: 14 }, g);
        svg("text", { x: 26, y: -12 }, g).textContent = n;
        svg("text", { class: "ev-sub", x: 26, y: 14 }, g).textContent = sub;
        return { i: best / 240, g, x, y };
      });
      this.box = svg("g", { class: "box" }, S);
      svg("rect", { x: -24, y: -24, width: 48, height: 48, rx: 3, fill: "#b58650" }, this.box);
      svg("rect", { x: -4, y: -24, width: 8, height: 48, fill: "#d8b27a", opacity: 0.6 }, this.box);
      this.boxRing = svg("circle", { r: 40, fill: "none", stroke: "#ffb547", "stroke-width": 2, opacity: 0.6 }, this.box);
      // movement schedule: [from, to, p0, p1]
      const e = this.events.map((v) => v.i);
      this.sched = [[0, e[0], 0.06, 0.32], [e[0], e[1], 0.42, 0.52], [e[1], e[2], 0.54, 0.65], [e[2], e[3], 0.67, 0.77], [e[3], e[4], 0.79, 0.89]];
      const rows = [["09:41:02", "STOCK IN", "MCB 32A DP ×120 → A-04-02"], ["11:18:47", "STOCK OUT", "×40 → Dispatch bay 2"], ["12:05:13", "TRANSFER", "×40 A-04 → B-11"], ["15:32:50", "RETURN", "×2 damaged → Returns"], ["17:00:00", "AUDIT", "Cycle count · 1,160 units"]];
      this.logRows = rows.map(([t, k, v]) => {
        const r = document.createElement("div"); r.className = "log-row";
        r.innerHTML = `<span>${t}</span><b>${k}</b><span>${v}</span><i>✓</i>`;
        this.log.appendChild(r); return r;
      });
    },
    resize() {
      this.vw = innerWidth; this.k = isMobile() ? 0.52 : 0.9;
    },
    pathPts(a, b) {
      const n = this.samples.length - 1;
      const i0 = Math.max(0, Math.floor(a * n)), i1 = Math.min(n, Math.ceil(b * n));
      if (i1 <= i0) return "M0,0";
      let d = "M" + this.samples[i0].join(",");
      for (let i = i0 + 1; i <= i1; i++) d += "L" + this.samples[i].join(",");
      return d;
    },
    update(p) {
      // where is the box along the path?
      let t = 0;
      for (const [a, b, p0, p1] of this.sched) { if (p >= p0) t = lerp(a, b, easeInOut(seg(p, p0, p1))); }
      const n = this.samples.length - 1;
      const f = t * n, i = Math.min(n - 1, Math.floor(f)), fr = f - i;
      const bx = lerp(this.samples[i][0], this.samples[i + 1][0], fr), by = lerp(this.samples[i][1], this.samples[i + 1][1], fr);
      this.box.setAttribute("transform", `translate(${bx.toFixed(1)},${by.toFixed(1)})`);
      const sw = seg(p, 0.34, 0.42); // manual → WAREXX
      this.boxRing.setAttribute("stroke", sw > 0.5 ? "#3df58a" : "#ffb547");
      // manual trail: short, dashed, forgotten behind the box
      this.trailM.setAttribute("d", this.pathPts(Math.max(0, t - 0.08), t));
      setStyle(this.trailM, "opacity", ((1 - sw) * 0.85).toFixed(3));
      // digital trail: the whole history, kept
      this.trailD.setAttribute("d", this.pathPts(0, t));
      setStyle(this.trailD, "opacity", sw.toFixed(3));

      const cam = this.vw * (isMobile() ? 0.5 : 0.55) - bx * this.k;
      this.plan.style.transform = `translate3d(${cam.toFixed(1)}px,0,0) rotateX(${isMobile() ? 50 : 56}deg) scale(${this.k})`;

      this.cmLi.forEach((li, j) => li.classList.toggle("on", p > 0.08 + j * 0.06));
      setStyle(this.cm, "opacity", (1 - sw).toFixed(3));
      setStyle(this.cw, "opacity", sw.toFixed(3));
      let cur = -1;
      this.events.forEach((ev, j) => {
        const reached = sw > 0.6 && t >= ev.i - 0.002;
        if (reached) cur = j;
        setStyle(ev.g, "opacity", reached ? "1" : "0");
        this.cwLi[j].classList.toggle("on", reached || sw > 0.6);
        this.logRows[j].classList.toggle("on", reached);
      });
      this.cwLi.forEach((li, j) => li.classList.toggle("act", j === cur));
      title(this.head, seg(p, 0.46, 0.54), seg(p, 0.92, 0.96));
    },
  };

  /* ---------- 05 · Breaking point ---------- */
  scenes["break"] = {
    fade: [0.04, 0.02],
    init(s) {
      this.pile = $('[data-el="pile"]', s.el); this.vig = $('[data-el="vig"]', s.el); this.q = $('[data-el="question"]', s.el);
      this.build();
    },
    build() {
      this.pile.innerHTML = "";
      const r = rng(42), vw = innerWidth, vh = innerHeight, mob = isMobile();
      const kinds = [["invoice", "INVOICE #44"], ["ledger", "STOCK REGISTER"], ["sheet", "SALES_FINAL_v3.xlsx"], ["report", "MONTHLY REPORT"], ["file", "PURCHASE FILE"], ["invoice", "PO-22"], ["ledger", "STOCK RECORD WH-2"], ["invoice", "LR 884"], ["sheet", "stock_count_OLD.xlsx"], ["report", "GRN SUMMARY"]];
      const N = mob ? 18 : 40;
      this.docs = [];
      for (let i = 0; i < N; i++) {
        const [k, t] = kinds[i % kinds.length];
        const el = document.createElement("div");
        el.className = "doc " + k;
        const w = (mob ? 110 : 150) + r() * (mob ? 70 : 120), h = w * (k === "sheet" ? 0.75 : 1.3);
        el.style.width = w + "px"; el.style.height = h + "px";
        el.innerHTML = `<h6>${t}${/\d$/.test(t) ? Math.floor(10 + r() * 89) : ""}</h6>${k === "invoice" || k === "file" ? '<div class="lines"></div>' : ""}`;
        this.pile.appendChild(el);
        const cx = r() * vw, cy = r() * vh;
        this.docs.push({ el, x: cx - w / 2, y: cy - h / 2, rot: -30 + r() * 60, sc: 0.75 + r() * 0.5, t0: 0.04 + Math.pow(i / N, 0.85) * 0.44, dx: -80 + r() * 160, dy: -60 + r() * 120, dr: -20 + r() * 40, out: r(), ox: (cx - vw / 2) * 0.9, oy: (cy - vh / 2) * 0.9 });
      }
      const notes = ["Where is LR 88412?", "Stock mismatch — WH-2", "Which sheet is final?", "Call accounts", "Pending approval", "Short by 2 boxes?", "Re-enter in register", "Invoice not found"];
      (mob ? notes.slice(0, 5) : notes).forEach((n, i) => {
        const el = document.createElement("div"); el.className = "note"; el.textContent = n;
        this.pile.appendChild(el);
        this.docs.push({ el, note: true, x: 30 + r() * (vw - 260), y: 60 + r() * (vh - 140), rot: 0, sc: 1, t0: 0.12 + i * 0.045, dx: -30 + r() * 60, dy: -20 + r() * 40, dr: 0, out: r(), ox: 0, oy: 0 });
      });
    },
    resize() { if (this.lastW !== innerWidth) { this.lastW = innerWidth; this.build(); } },
    update(p) {
      const tt = Math.min(p, 0.5); // the freeze: nothing moves after 0.5
      const dark = seg(p, 0, 0.5);
      setStyle(this.vig, "opacity", (0.4 + dark * 0.55).toFixed(3));
      for (const d of this.docs) {
        const a = seg(tt, d.t0, d.t0 + 0.035);
        const out = seg(p, 0.64 + d.out * 0.1, 0.72 + d.out * 0.1);
        const o = a * (1 - out);
        setStyle(d.el, "opacity", o.toFixed(3));
        if (o <= 0) continue;
        const life = Math.max(0, tt - d.t0);
        const x = d.x + d.dx * life + d.ox * out * 1.2, y = d.y + d.dy * life + d.oy * out * 1.2 + out * 40;
        const sc = d.sc * (0.9 + 0.1 * a) * (1 - out * 0.3);
        d.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${(d.rot + d.dr * life).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
      }
      title(this.q, seg(p, 0.54, 0.62), seg(p, 0.86, 0.93), 0);
    },
  };

  /* ---------- 06 · Command Center ---------- */
  scenes.command = {
    fade: [0.04, 0.04],
    Q: ["What are today's total invoices?", "Which warehouse has the highest stock?", "Show today's sales."],
    W: [[0.2, 0.44], [0.46, 0.68], [0.7, 0.93]],
    init(s) {
      const q = (k) => $(`[data-el="${k}"]`, s.el);
      Object.assign(this, { head: q("justAsk"), cmd: q("cmd"), px: q("pixels"), qText: q("qText"), qPh: q("qPh"), think: q("think"), thinkText: q("thinkText"), recent: q("recent"), tip: q("tip"), aura: $(".cmd-aura", s.el) });
      this.thinkBar = $("i", this.think);
      this.ans = $$(".ans", s.el);
      this.nums = this.ans.map((a) => $(".hero-num[data-count]", a));
      this.buildCharts(s.el);
      this.thinkTexts = ["Reading 142 invoices · 38 suppliers", "Checking stock across 6 warehouses", "Aggregating 318 orders · 3 channels"];
    },
    buildCharts(root) {
      const tip = $('[data-el="tip"]', root), cmd = $('[data-el="cmd"]', root);
      const showTip = (e, html) => {
        const r = cmd.getBoundingClientRect();
        tip.innerHTML = html; tip.style.opacity = 1;
        tip.style.transform = `translate(${e.clientX - r.left + 14}px,${e.clientY - r.top - 34}px)`;
      };
      const hideTip = () => (tip.style.opacity = 0);
      const barPath = (x, y, w, h, rad = 4) => { const r = Math.min(rad, h, w / 2); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

      // A1 · hourly bars
      const b = $('[data-chart="bars"]', root);
      const hrs = ["8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p", "5p", "6p", "7p"];
      const vals = [1.2, 2.8, 4.1, 5.6, 3.9, 6.2, 7.4, 5.1, 4.4, 3.2, 2.6, 2.2];
      const x0 = 26, w = 410, base = 176, top = 20, max = 8;
      [0, 4, 8].forEach((v) => { const y = base - ((base - top) * v) / max; svg("line", { class: "grid", x1: x0, x2: x0 + w, y1: y, y2: y }, b); svg("text", { class: "axis", x: 0, y: y + 3 }, b).textContent = v; });
      const bw = w / vals.length;
      this.bars = vals.map((v, i) => {
        const h = ((base - top) * v) / max, x = x0 + i * bw + 3;
        const hi = v === Math.max(...vals);
        const hit = svg("rect", { class: "hit", x: x - 3, y: top, width: bw, height: base - top }, b);
        const el = svg("path", { class: "bar" + (hi ? " hi" : ""), d: barPath(x, base - h, bw - 6, h) }, b);
        el.style.transformOrigin = `0 ${base}px`;
        if (i % 2 === 0) svg("text", { class: "axis", x: x + (bw - 6) / 2, y: base + 16, "text-anchor": "middle" }, b).textContent = hrs[i];
        if (hi) { const t = svg("text", { class: "val", x: x + (bw - 6) / 2, y: base - h - 8, "text-anchor": "middle" }, b); t.textContent = "₹7.4L"; this.barLabel = t; }
        const lbl = `${hrs[i].replace("a", " AM").replace("p", " PM")} · <b>₹ ${v.toFixed(1)} L</b>`;
        hit.addEventListener("mousemove", (e) => { showTip(e, lbl); el.style.opacity = 1; });
        hit.addEventListener("mouseleave", () => { hideTip(); el.style.opacity = ""; });
        return el;
      });

      // A2 · stock by warehouse
      const hb = $('[data-chart="hbars"]', root);
      const whs = [["WH-02 Bhiwandi", 241], ["WH-01 Pune", 188], ["WH-04 Nagpur", 142], ["WH-03 Nashik", 117], ["DC Surat", 96]];
      const lx = 118, lw = 280, rowH = 36;
      this.hbars = whs.map(([n, v], i) => {
        const y = 12 + i * rowH, bwid = (lw * v) / 250;
        svg("text", { class: "lbl", x: 0, y: y + 15 }, hb).textContent = n;
        const hit = svg("rect", { class: "hit", x: 0, y: y - 4, width: 440, height: rowH - 4 }, hb);
        const el = svg("path", { class: "bar" + (i === 0 ? " hi" : ""), d: `M${lx},${y}H${lx + bwid - 4}Q${lx + bwid},${y} ${lx + bwid},${y + 4}V${y + 16}Q${lx + bwid},${y + 20} ${lx + bwid - 4},${y + 20}H${lx}Z` }, hb);
        el.style.transformOrigin = `${lx}px 0`;
        svg("text", { class: "val", x: lx + bwid + 8, y: y + 15 }, hb).textContent = v + "k";
        hit.addEventListener("mousemove", (e) => showTip(e, `${n} · <b>${v},000 units</b>`));
        hit.addEventListener("mouseleave", hideTip);
        return el;
      });

      // A3 · cumulative sales, today vs yesterday
      const ln = $('[data-chart="line"]', root);
      const defs = svg("defs", {}, ln);
      const g = svg("linearGradient", { id: "areaG", x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
      svg("stop", { offset: 0, "stop-color": "#3df58a", "stop-opacity": 0.22 }, g); svg("stop", { offset: 1, "stop-color": "#3df58a", "stop-opacity": 0 }, g);
      const today = [0, 1.1, 2.9, 4.8, 6.4, 8.9, 11.6, 14.2, 16.4, 18.9, 21.36];
      const yday = [0, 1.0, 2.5, 4.3, 5.9, 8.1, 10.6, 13.0, 15.1, 17.3, 19.76, 21.4, 22.1];
      const hours = ["8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM"];
      const X = (i) => 26 + (i * 404) / 12, Y = (v) => 176 - (v / 24) * 156;
      [0, 8, 16, 24].forEach((v) => { svg("line", { class: "grid", x1: 26, x2: 430, y1: Y(v), y2: Y(v) }, ln); svg("text", { class: "axis", x: 0, y: Y(v) + 3 }, ln).textContent = v; });
      [0, 4, 8, 12].forEach((i) => (svg("text", { class: "axis", x: X(i), y: 194, "text-anchor": "middle" }, ln).textContent = hours[i].replace(" ", "")));
      const pts = (arr) => arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" L");
      this.area = svg("path", { class: "area", d: `M${X(0)},176 L${pts(today)} L${X(today.length - 1)},176Z` }, ln);
      this.lineY = svg("path", { class: "l-yday", d: "M" + pts(yday) }, ln);
      this.lineT = svg("path", { class: "l-today", d: "M" + pts(today) }, ln);
      const endT = svg("text", { class: "val", x: X(10) + 8, y: Y(21.36) + 4 }, ln); endT.textContent = "₹21.4L";
      const endY = svg("text", { class: "axis", x: X(12) - 2, y: Y(22.1) - 8, "text-anchor": "end" }, ln); endY.textContent = "yesterday";
      this.lineLabels = [endT, endY];
      const xh = svg("line", { class: "xhair", x1: 0, x2: 0, y1: 20, y2: 176, opacity: 0 }, ln);
      const dot = svg("circle", { class: "dot", r: 5, opacity: 0 }, ln);
      const hit = svg("rect", { class: "hit", x: 20, y: 10, width: 420, height: 170 }, ln);
      hit.addEventListener("mousemove", (e) => {
        const r = ln.getBoundingClientRect();
        const lxp = ((e.clientX - r.left) / r.width) * 440;
        const i = Math.max(0, Math.min(12, Math.round(((lxp - 26) / 404) * 12)));
        xh.setAttribute("x1", X(i)); xh.setAttribute("x2", X(i)); xh.setAttribute("opacity", 1);
        const v = today[i];
        if (v != null) { dot.setAttribute("cx", X(i)); dot.setAttribute("cy", Y(v)); dot.setAttribute("opacity", 1); } else dot.setAttribute("opacity", 0);
        showTip(e, `${hours[i]} · Today <b>${v != null ? "₹ " + v.toFixed(1) + " L" : "—"}</b> · Yesterday ₹ ${yday[i].toFixed(1)} L`);
      });
      hit.addEventListener("mouseleave", () => { hideTip(); xh.setAttribute("opacity", 0); dot.setAttribute("opacity", 0); });
      this.lenT = this.lineT.getTotalLength(); this.lenY = this.lineY.getTotalLength();
      this.lineT.style.strokeDasharray = this.lenT; this.lineY.style.strokeDasharray = `4 5`;
    },
    resize() {
      const r = this.cmd.getBoundingClientRect();
      this.px.width = Math.ceil(r.width / 1); this.px.height = Math.ceil(r.height / 1);
      const cell = isMobile() ? 18 : 26;
      this.cols = Math.ceil(r.width / cell); this.rows = Math.ceil(r.height / cell); this.cell = cell;
      const rr = rng(3); const N = this.cols * this.rows;
      this.order = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const cx = (i % this.cols) / this.cols, cy = Math.floor(i / this.cols) / this.rows;
        this.order[i] = clamp(rr() * 0.55 + (Math.abs(cx - 0.5) + Math.abs(cy - 0.3)) * 0.5);
      }
      this.lastPx = -1;
    },
    drawPixels(t) {
      const key = Math.round(t * 400);
      if (key === this.lastPx) return; this.lastPx = key;
      const c = this.px.getContext("2d");
      c.clearRect(0, 0, this.px.width, this.px.height);
      if (t >= 1) { this.px.style.display = "none"; return; }
      this.px.style.display = "";
      const { cols, cell } = this;
      for (let i = 0; i < this.order.length; i++) {
        const o = this.order[i];
        if (o < t) continue;
        const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
        if (o < t + 0.07) { c.fillStyle = o < t + 0.025 ? "rgba(214,204,255,.9)" : "rgba(155,123,255,.55)"; c.fillRect(x, y, cell - 1, cell - 1); }
        else { c.fillStyle = "#050505"; c.fillRect(x, y, cell, cell); }
      }
    },
    update(p) {
      // "OR… JUST ASK." then it lifts away to make room for the console
      const hIn = seg(p, 0.02, 0.09), lift = easeInOut(seg(p, 0.1, 0.17));
      title(this.head, hIn, 0);
      const hs = 1 - lift * (isMobile() ? 0.45 : 0.55), hy = -lift * innerHeight * (isMobile() ? 0.34 : 0.37);
      setStyle(this.head, "transform", `translate(-50%,calc(-50% + ${hy.toFixed(1)}px)) scale(${hs.toFixed(4)})`);
      setStyle(this.aura, "opacity", seg(p, 0.1, 0.2).toFixed(3));
      const show = p > 0.1;
      setStyle(this.cmd, "opacity", show ? "1" : "0");
      this.drawPixels(RM ? 1 : seg(p, 0.1, 0.19));

      // which query is active?
      let wi = -1;
      this.W.forEach(([a], i) => { if (p >= a) wi = i; });
      let typed = "", thinking = 0, thinkPos = 0;
      if (wi >= 0) {
        const [a, b] = this.W[wi];
        const t = seg(p, a, b);
        typed = this.Q[wi].slice(0, Math.round(seg(t, 0, 0.3) * this.Q[wi].length));
        thinking = t > 0.3 && t < 0.44 ? 1 : 0;
        thinkPos = seg(t, 0.3, 0.44);
        if (this.thinkText.textContent !== this.thinkTexts[wi]) this.thinkText.textContent = this.thinkTexts[wi];
      }
      if (this.qText.textContent !== typed) this.qText.textContent = typed;
      setStyle(this.qPh, "opacity", typed ? "0" : "1");
      setStyle(this.thinkBar, "opacity", String(thinking));
      this.thinkBar.style.left = `${(thinkPos * 100 - 30).toFixed(1)}%`;
      setStyle(this.thinkText, "opacity", String(thinking));
      const rec = this.Q.slice(0, Math.max(0, wi)).map((q) => `<span>↳ ${q}</span>`).join("");
      if (this.recent._h !== rec) { this.recent._h = rec; this.recent.innerHTML = rec; }

      this.ans.forEach((el, i) => {
        const [a, b] = this.W[i];
        const t = seg(p, a, b);
        const inn = easeOut(seg(t, 0.44, 0.62));
        const next = this.W[i + 1];
        const out = next ? seg(p, next[0], next[0] + 0.03) : 0;
        const o = inn * (1 - out);
        setStyle(el, "opacity", o.toFixed(3));
        el.classList.toggle("show", o > 0.01);
        if (o <= 0.01) return;
        el.style.transform = `translate3d(0,${((1 - inn) * 18).toFixed(1)}px,0)`;
        const grow = easeInOut(seg(t, 0.46, 0.8));
        const num = this.nums[i];
        if (num) { const v = +num.dataset.count * easeOut(seg(t, 0.44, 0.75)); const txt = num.dataset.prefix + fmtINR(v); if (num.textContent !== txt) num.textContent = txt; }
        if (i === 0) { this.bars.forEach((bEl, j) => (bEl.style.transform = `scaleY(${clamp(grow * 1.6 - j * 0.05).toFixed(3)})`)); setStyle(this.barLabel, "opacity", seg(grow, 0.8, 1).toFixed(2)); }
        if (i === 1) this.hbars.forEach((bEl, j) => (bEl.style.transform = `scaleX(${clamp(grow * 1.4 - j * 0.08).toFixed(3)})`));
        if (i === 2) {
          this.lineT.style.strokeDashoffset = (this.lenT * (1 - grow)).toFixed(1);
          setStyle(this.area, "opacity", seg(grow, 0.5, 1).toFixed(3));
          setStyle(this.lineY, "opacity", (0.8 * seg(grow, 0, 0.4)).toFixed(3));
          this.lineLabels.forEach((l) => setStyle(l, "opacity", seg(grow, 0.85, 1).toFixed(2)));
        }
      });
    },
  };

  /* ---------- 07 · The warehouse transforms ---------- */
  scenes.transform = {
    fade: [0.06, 0.05],
    nodes: [
      ["Inventory", "1.2 L units · live", -470, -150, -1500, "green"],
      ["Procurement", "14 POs open", 430, -300, -1900, "blue"],
      ["Documents", "142 captured today", -420, -380, -2500, "blue"],
      ["Operations", "all systems normal", 0, -250, -2250, "violet"],
      ["Stock", "A-04-02 · 1,240", 460, 0, -2700, "green"],
      ["Sales", "₹ 21.4 L today", -330, 60, -3200, "green"],
      ["Reports", "updated live", 260, -420, -3500, "violet"],
      ["Warehouses", "6 connected", 0, -120, -4200, "blue"],
    ],
    links: [[0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [7, 3], [0, 2], [1, 4], [5, 7], [6, 7], [4, 7]],
    init(s) {
      this.did1 = $('[data-el="didnt"]', s.el); this.did2 = $('[data-el="did"]', s.el);
      this.net = $('[data-el="net"]', s.el); this.labels = $('[data-el="netLabels"]', s.el);
      this.dark = document.createElement("div");
      this.dark.style.cssText = "position:absolute;inset:0;background:#000;pointer-events:none;z-index:2;opacity:.25";
      s.stage.insertBefore(this.dark, this.net);
      const col = { green: "#3df58a", blue: "#4da3ff", violet: "#9b7bff" };
      this.N = this.nodes.map(([t, sub, x, y, z, c], i) => {
        const el = document.createElement("div");
        el.className = "nl c-" + c; el.innerHTML = `${t}<small>${sub}</small>`;
        this.labels.appendChild(el);
        return { el, x, y, z, c: col[c], i };
      });
      this.L = this.links.map(([a, b]) => ({ a, b, el: svg("line", { stroke: this.N[a].c, "stroke-opacity": 0 }, this.net) }));
    },
    ready(s) {
      this.c = new Corridor($(".vp3d", s.el), $("[data-billboards]", s.el), TEX, { length: 6000, digital: true });
      const H2 = 450;
      [-1100, -2300, -3400].forEach((z, i) => this.c.add("bb-pallet", { tag: "img", src: TEX.pallet[i % 3], x: i % 2 ? -420 : 420, y: H2, z, anchor: "bc", k: 0.9 }));
      [[-300, -1700], [280, -3000]].forEach(([x, z]) => this.c.add("bb-worker", { x, y: H2, z, anchor: "bc", k: 0.365 }, '<svg viewBox="0 0 200 520" width="200" height="520"><use href="#sym-worker"/></svg>'));
      this.c.add("bb-forklift", { x: -150, y: H2, z: -3900, anchor: "bc", k: 0.75 }, '<svg viewBox="0 0 420 300" width="420" height="300"><use href="#sym-forklift"/></svg>');
    },
    resize(s) {
      this.c && this.c.resize();
      this.net.setAttribute("viewBox", `0 0 ${s.stage.clientWidth} ${s.stage.clientHeight}`);
    },
    update(p) {
      title(this.did1, seg(p, 0.06, 0.16), seg(p, 0.34, 0.4));
      title(this.did2, seg(p, 0.58, 0.68), seg(p, 0.9, 0.95));
      if (!this.c) return;
      // after the pause, the intelligence layer switches on — flickering in like a system booting
      const on = seg(p, 0.42, 0.54);
      const flick = on > 0 && on < 1 && !RM ? (Math.sin(p * 900) > 0 ? 1 : 0.55) : 1;
      this.c.setOverlay(on * flick);
      setStyle(this.dark, "opacity", (0.25 + seg(p, 0.55, 0.62) * 0.15).toFixed(3));
      this.c.setCamera(easeInOut(p) * 1700, RM ? 0 : Math.sin(p * 5) * 20, -260);
      const P = this.N.map((n) => {
        const a = seg(p, 0.46 + n.i * 0.02, 0.52 + n.i * 0.02);
        const pr = this.c.project(n.x, n.y, n.z);
        const vis = pr.d > 200 && a > 0;
        const sc = clamp(pr.s * 1.7, 0.55, 1.15);
        setStyle(n.el, "opacity", vis ? a.toFixed(3) : "0");
        if (vis) n.el.style.transform = `translate3d(${pr.x.toFixed(1)}px,${pr.y.toFixed(1)}px,0) translate(-50%,-50%) scale(${sc.toFixed(3)})`;
        return { x: pr.x, y: pr.y, a: vis ? a : 0 };
      });
      for (const l of this.L) {
        const A = P[l.a], B = P[l.b], o = Math.min(A.a, B.a) * 0.55;
        l.el.setAttribute("stroke-opacity", o.toFixed(3));
        if (o > 0) { l.el.setAttribute("x1", A.x.toFixed(1)); l.el.setAttribute("y1", A.y.toFixed(1)); l.el.setAttribute("x2", B.x.toFixed(1)); l.el.setAttribute("y2", B.y.toFixed(1)); }
      }
    },
  };

  /* ---------- 08 · Complete operation ---------- */
  scenes.flow = {
    fade: [0.05, 0.05],
    stages: [
      ["Purchase", "Requirement raised · 400 units", "#4da3ff"],
      ["PO", "PO-2231 · approved", "#4da3ff"],
      ["LR", "LR 88412 · in transit", "#4da3ff"],
      ["Invoice", "SBT/1187 · captured", "#4da3ff"],
      ["GRN", "GRN-0921 · 42 boxes received", "#3df58a"],
      ["Inventory", "+1,240 units · live", "#3df58a"],
      ["Warehouse", "WH-02 · A-04-02", "#3df58a"],
      ["Store", "Store 14 · Mumbai", "#3df58a"],
      ["Sale", "SO-5512 · ₹ 18,400", "#3df58a"],
      ["Reports", "updated · no re-entry", "#9b7bff"],
    ],
    init(s) {
      const q = (k) => $(`[data-el="${k}"]`, s.el);
      Object.assign(this, { track: q("track"), svgEl: q("flowSvg"), nodesEl: q("flowNodes"), bg: q("flowBg"), stage: s.stage });
    },
    ready() { this.bg.style.backgroundImage = `url(${TEX.wall[0]})`; },
    resize() {
      const vw = this.stage.clientWidth, vh = this.stage.clientHeight, mob = isMobile();
      const sp = mob ? 260 : 420, A = mob ? 70 : 95, yc = vh * 0.6;
      this.x0 = vw * (mob ? 0.5 : 0.62);
      const pts = this.stages.map((_, i) => [this.x0 + i * sp, yc + (i % 2 ? A : -A)]);
      this.lastX = pts[pts.length - 1][0];
      this.vw = vw;
      const W = this.lastX + vw;
      this.track.style.width = W + "px";
      const S = this.svgEl; S.innerHTML = ""; S.setAttribute("width", W); S.setAttribute("height", vh); S.setAttribute("viewBox", `0 0 ${W} ${vh}`);
      const defs = svg("defs", {}, S);
      const g = svg("linearGradient", { id: "flowGrad", gradientUnits: "userSpaceOnUse", x1: this.x0, x2: this.lastX, y1: 0, y2: 0 }, defs);
      [[0, "#4da3ff"], [0.33, "#4da3ff"], [0.45, "#3df58a"], [0.86, "#3df58a"], [1, "#9b7bff"]].forEach(([o, c]) => svg("stop", { offset: o, "stop-color": c }, g));
      const f = svg("filter", { id: "fglow", x: "-10%", y: "-50%", width: "120%", height: "200%" }, defs);
      svg("feGaussianBlur", { stdDeviation: 4, result: "b" }, f);
      const m = svg("feMerge", {}, f); svg("feMergeNode", { in: "b" }, m); svg("feMergeNode", { in: "SourceGraphic" }, m);
      let d = `M${this.x0 - vw * 0.7},${pts[0][1]} L${pts[0][0]},${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) { const [ax, ay] = pts[i - 1], [bx, by] = pts[i]; d += ` C${ax + sp / 2},${ay} ${bx - sp / 2},${by} ${bx},${by}`; }
      d += ` L${this.lastX + vw},${pts[pts.length - 1][1]}`;
      svg("path", { class: "base", d }, S);
      this.lit = svg("path", { class: "lit", d }, S);
      this.headDot = svg("circle", { class: "head", r: 5 }, S);
      this.plen = this.lit.getTotalLength();
      this.lit.style.strokeDasharray = this.plen;
      this.samples = [];
      for (let i = 0; i <= 600; i++) { const l = (this.plen * i) / 600, pt = this.lit.getPointAtLength(l); this.samples.push([l, pt.x, pt.y]); }
      this.nodesEl.innerHTML = "";
      this.N = this.stages.map(([t, m, c], i) => {
        const el = document.createElement("div");
        el.className = "fn " + (i % 2 ? "down" : "up");
        el.style.left = pts[i][0] + "px"; el.style.top = pts[i][1] + "px";
        el.style.setProperty("--c", c);
        el.innerHTML = `<span class="fn-dot"></span><div class="fn-card"><div class="fn-n">${String(i + 1).padStart(2, "0")}</div><div class="fn-t">${t}</div><div class="fn-m">${m}</div></div>`;
        this.nodesEl.appendChild(el);
        return { el, x: pts[i][0] };
      });
    },
    update(p) {
      if (!this.samples) return;
      const q = easeInOut(seg(p, 0.08, 0.92));
      const tx = -(this.lastX - this.x0) * q;
      this.track.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
      this.bg.style.transform = `translate3d(${(tx * 0.25).toFixed(1)}px,0,0)`;
      // the head of the flow sits just ahead of screen centre
      const hx = Math.min(this.lastX + 2, Math.max(this.x0 - this.vw * 0.3, this.vw * (isMobile() ? 0.62 : 0.58) - tx));
      let lo = 0, hi = this.samples.length - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (this.samples[mid][1] < hx) lo = mid + 1; else hi = mid; }
      const [l, x, y] = this.samples[lo];
      this.lit.style.strokeDashoffset = (this.plen - l).toFixed(1);
      this.headDot.setAttribute("cx", x.toFixed(1)); this.headDot.setAttribute("cy", y.toFixed(1));
      for (const n of this.N) n.el.classList.toggle("on", hx >= n.x - 2);
    },
  };

  /* ---------- 09 · Multiple locations ---------- */
  scenes.network = {
    fade: [0.05, 0.04],
    init(s) { this.map = $('[data-el="map"]', s.el); this.fin = $('[data-el="netFinal"]', s.el); this.stage = s.stage; },
    resize() {
      const w = this.stage.clientWidth, h = this.stage.clientHeight, port = h > w;
      const S = this.map; S.innerHTML = "";
      S.setAttribute("viewBox", `0 0 ${w} ${h}`);
      this.cx = w / 2; this.cy = h / 2;
      const defs = svg("defs", {}, S);
      const pat = svg("pattern", { id: "dots", width: 28, height: 28, patternUnits: "userSpaceOnUse" }, defs);
      svg("circle", { class: "dotgrid", cx: 2, cy: 2, r: 1.2 }, pat);
      const gl = svg("radialGradient", { id: "homeGlow" }, defs);
      svg("stop", { offset: 0, "stop-color": "#3df58a", "stop-opacity": 0.25 }, gl); svg("stop", { offset: 1, "stop-color": "#3df58a", "stop-opacity": 0 }, gl);
      this.world = svg("g", {}, S);
      svg("rect", { x: -4000, y: -4000, width: 8000, height: 8000, fill: "url(#dots)" }, this.world);
      svg("circle", { r: 260, fill: "url(#homeGlow)" }, this.world);
      // home warehouse: a miniature of the floor plan
      const home = svg("g", {}, this.world);
      svg("rect", { x: -130, y: -80, width: 260, height: 160, rx: 6, fill: "#0b0c0b", stroke: "#3df58a", "stroke-width": 1.5 }, home);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) svg("rect", { x: -112 + c * 38, y: -62 + r * 32, width: 30, height: 18, fill: "#1a1a18", stroke: "rgba(61,245,138,.35)", "stroke-width": 0.8 }, home);
      svg("text", { class: "loc-l", x: -130, y: -96 }, home).textContent = "WAREHOUSE";
      svg("text", { class: "loc-s", x: -130, y: 104 }, home).textContent = "WH-02 · Bhiwandi · 18,420 SKUs";
      const sx = port ? 0.34 : 1, sy = port ? 1.35 : 1;
      const locs = [["WAREHOUSE", "WH-01 · Pune", -620, -260, "#4da3ff"], ["STORE", "Store 14 · Mumbai", 540, -290, "#3df58a"], ["DISTRIBUTION CENTRE", "DC · Surat", 660, 230, "#4da3ff"], ["WAREHOUSE", "WH-04 · Nagpur", -560, 300, "#4da3ff"], ["WAREHOUSE", "WH-03 · Nashik", 60, 420, "#4da3ff"]];
      const arc = (x, y, bend) => { const mx = x / 2 - y * bend, my = y / 2 + x * bend; return `M0,0 Q${mx},${my} ${x},${y}`; };
      this.locs = locs.map(([n, sub, x, y, c], i) => {
        x *= sx; y *= sy;
        const d = arc(x, y, i % 2 ? 0.18 : -0.18);
        const a = svg("path", { class: "arc", d, stroke: c, "stroke-opacity": 0.45 }, this.world);
        const pl = svg("path", { class: "pulse", d, stroke: c, style: `animation-delay:${-i * 0.6}s` }, this.world);
        const g = svg("g", { transform: `translate(${x},${y})` }, this.world);
        svg("circle", { r: 16, fill: "none", stroke: c, "stroke-opacity": 0.35 }, g);
        svg("circle", { r: 6, fill: c }, g);
        const anchor = x < 0 ? "end" : "start", off = x < 0 ? -26 : 26;
        svg("text", { class: "loc-l", x: off, y: -2, "text-anchor": anchor }, g).textContent = n;
        svg("text", { class: "loc-s", x: off, y: 16, "text-anchor": anchor }, g).textContent = sub;
        const len = a.getTotalLength();
        a.style.strokeDasharray = len;
        return { a, pl, g, len };
      });
      // the wider network
      const r = rng(9);
      this.far = [];
      for (let i = 0; i < 26; i++) {
        const ang = r() * Math.PI * 2, rad = 1000 + r() * 1300;
        const x = Math.cos(ang) * rad * sx * (port ? 1.8 : 1), y = Math.sin(ang) * rad * 0.62 * sy;
        const near = locs[Math.floor(r() * locs.length)];
        const l = svg("path", { class: "arc", d: `M${near[2] * sx},${near[3] * sy} Q${(x + near[2] * sx) / 2},${(y + near[3] * sy) / 2 - 120} ${x},${y}`, stroke: i % 3 ? "#4da3ff" : "#3df58a", "stroke-opacity": 0 }, this.world);
        const dot = svg("circle", { cx: x, cy: y, r: 9, fill: i % 3 ? "#4da3ff" : "#3df58a", opacity: 0 }, this.world);
        this.far.push({ l, dot, t: r() });
      }
    },
    update(p) {
      if (!this.world) return;
      const pull = easeInOut(seg(p, 0.0, 0.3)), zoom = easeInOut(seg(p, 0.58, 0.82));
      const mob = isMobile();
      const s = lerp(3.4, mob ? 0.9 : 1, pull) * lerp(1, mob ? 0.26 : 0.36, zoom);
      this.world.setAttribute("transform", `translate(${this.cx},${this.cy}) scale(${s.toFixed(4)})`);
      this.locs.forEach((L, i) => {
        const a = seg(p, 0.3 + i * 0.045, 0.4 + i * 0.045);
        L.a.style.strokeDashoffset = (L.len * (1 - a)).toFixed(1);
        setStyle(L.g, "opacity", a.toFixed(3));
        setStyle(L.pl, "opacity", seg(a, 0.8, 1).toFixed(3));
      });
      for (const f of this.far) {
        const a = seg(p, 0.62 + f.t * 0.16, 0.68 + f.t * 0.16);
        f.l.setAttribute("stroke-opacity", (a * 0.3).toFixed(3));
        f.dot.setAttribute("opacity", a.toFixed(3));
      }
      const fin = seg(p, 0.8, 0.9);
      setStyle(this.map, "opacity", (1 - fin * 0.72).toFixed(3));
      setStyle(this.fin, "opacity", fin > 0 ? "1" : "0");
      title(this.fin, fin, 0);
      setStyle($(".wordmark-sm", this.fin), "opacity", fin.toFixed(3));
    },
  };

  /* ---------- 10 · Every industry ---------- */
  scenes.industries = {
    fade: [0.05, 0.05],
    init(s) {
      const q = (k) => $(`[data-el="${k}"]`, s.el);
      Object.assign(this, { head: q("indHead"), track: q("indTrack"), count: q("indCount"), stage: s.stage });
      this.headExtras = $$(".kicker, .sub", this.head);
      this.cards = $$(".ind", s.el).map((el) => ({ el, img: $("img", el) }));
      // photos start loading well before the scene arrives, then fade in once decoded
      const load = (this.load = () => this.cards.forEach(({ img }) => {
        if (img.src) return;
        img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
        img.srcset = img.dataset.srcset; img.src = img.dataset.src;
      }));
      if ("IntersectionObserver" in window) {
        const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { load(); io.disconnect(); } }, { rootMargin: "250% 0px" });
        io.observe(s.el);
      } else load();
    },
    resize() {
      this.vw = this.stage.clientWidth;
      this.cw = this.cards[0].el.offsetWidth;
      this.gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
      const W = this.cards.length * this.cw + (this.cards.length - 1) * this.gap;
      const gut = parseFloat(getComputedStyle(this.head).left) || 16;
      this.x0 = isMobile() ? this.vw * 0.9 : this.vw * 0.5;
      this.x1 = this.vw - gut - W;
    },
    update(p) {
      this.load();
      title(this.head, seg(p, 0.02, 0.1), seg(p, 0.2, 0.3), 30);
      this.headExtras.forEach((e) => setStyle(e, "opacity", easeOut(seg(p, 0.06, 0.14)).toFixed(3)));
      const q = easeInOut(seg(p, 0.08, 0.93));
      const tx = lerp(this.x0, this.x1, q);
      this.track.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
      const mid = this.vw * 0.5, n1 = this.cards.length - 1;
      // the spotlight walks card by card with scroll, so every industry gets its moment
      const focus = seg(p, 0.1, 0.93) * n1;
      const best = Math.round(focus);
      this.cards.forEach((c, i) => {
        const cx = tx + i * (this.cw + this.gap) + this.cw / 2;
        const d = (cx - mid) / this.cw;
        const f = Math.abs(i - focus);
        const a = clamp(1 - f * 0.85);
        // photo drifts inside its frame, slower than the frame itself
        c.img.style.transform = `translate3d(${clamp(-d * 7, -10, 10).toFixed(2)}%,0,0) scale(${(1.04 + a * 0.04).toFixed(3)})`;
        c.el.style.setProperty("--dim", (0.6 - a * 0.58).toFixed(3));
        c.el.style.setProperty("--lit", smooth(clamp(1 - f * 1.6)).toFixed(3));
      });
      const n = String(best + 1).padStart(2, "0");
      if (this.count._n !== n) { this.count._n = n; this.count.innerHTML = `<b>${n}</b> / ${String(this.cards.length).padStart(2, "0")}`; }
      setStyle(this.count, "opacity", seg(p, 0.1, 0.16).toFixed(3));
    },
  };

  /* ---------- 11 · Final ---------- */
  scenes.final = {
    entering: true,
    init(s) {
      this.items = [$(".final-mark", s.el), $("h2", s.el), $(".sub", s.el), $(".ctas", s.el)];
      this.items.forEach((e) => { e.style.opacity = 0; });
    },
    update(p) {
      this.items.forEach((e, i) => {
        const t = easeOut(seg(p, 0.35 + i * 0.1, 0.75 + i * 0.1));
        setStyle(e, "opacity", t.toFixed(3));
        e.style.transform = `translate3d(0,${((1 - t) * 30).toFixed(1)}px,0)`;
      });
      document.body.classList.toggle("at-final", p > 0.3);
    },
  };

  /* =======================================================
     Engine
     ======================================================= */
  const nav = $("#nav"), hudNum = $("#hudNum"), hudName = $("#hudName"), hudBar = $("#hudBar"), hud = $(".hud");
  const accents = { amber: "var(--amber)", blue: "var(--blue)", violet: "var(--violet)", green: "var(--green)" };
  const S = $$("[data-scene]").map((el) => {
    const def = scenes[el.dataset.scene];
    const s = Object.assign(Object.create(def), { el, stage: $(".stage", el), p: 0, target: 0, last: -1, ch: (el.dataset.chapter || "").split("|") });
    if (s.stage) {
      s.fadeEl = document.createElement("div");
      s.fadeEl.style.cssText = "position:absolute;inset:0;background:#050505;pointer-events:none;z-index:30;opacity:0";
      s.stage.appendChild(s.fadeEl);
    }
    s.init && s.init(s);
    return s;
  });

  let vh = innerHeight, vwLast = innerWidth;
  function measure() {
    vh = innerHeight;
    for (const s of S) {
      s.top = s.el.offsetTop; s.h = s.el.offsetHeight;
      s.len = s.entering ? vh : Math.max(1, s.h - vh);
      s.resize && s.resize(s);
      s.last = -1;
    }
    buildBeats();
  }

  /* ---------- Beat scrolling: one scroll gesture = one story beat ----------
     Each scene lists the progress points where a composition is complete.
     A wheel flick / swipe / key press glides to the next beat and the scene
     plays its animation on the way there. */
  const BEATS = {
    enter: [0, 0.27, 0.53, 0.8],
    docs: [0.2, 0.5, 0.93],
    inventory: [0.13, 0.38, 0.62, 0.86],
    move: [0.3, 0.58, 0.9],
    break: [0.62, 0.8],
    command: [0.09, 0.4, 0.65, 0.9],
    transform: [0.2, 0.5, 0.76],
    flow: [0.1, 0.37, 0.64, 0.92],
    network: [0.25, 0.52, 0.9],
    industries: [0.1, 0.38, 0.65, 0.93],
  };
  let beats = [];
  function buildBeats() {
    const out = [];
    const maxY = document.documentElement.scrollHeight - vh;
    for (const s of S) {
      if (s.entering) { out.push(s.top, maxY); continue; }
      (BEATS[s.el.dataset.scene] || [0]).forEach((q) => out.push(Math.round(s.top + q * s.len)));
    }
    beats = [...new Set(out.map((y) => Math.min(maxY, Math.max(0, y))))].sort((x, z) => x - z);
  }
  let tween = null, lockUntil = 0, queued = 0;
  function glideTo(y1) {
    const y0 = scrollY, d = Math.abs(y1 - y0);
    if (RM || d < 2) { scrollTo(0, y1); lockUntil = performance.now() + 300; return; }
    tween = { y0, y1, t0: performance.now(), dur: clamp(0.85 + (d / vh) * 0.1, 0.9, 1.7) * 1000 };
  }
  function step(dir) {
    const y = tween ? tween.y1 : scrollY;
    const target = dir > 0 ? beats.find((b) => b > y + 4) : [...beats].reverse().find((b) => b < y - 4);
    if (target == null) return;
    glideTo(target);
  }
  const busy = () => tween || performance.now() < lockUntil;

  if (!CAPTURE) {
    // wheel / trackpad: one step per gesture; inertia tails are swallowed
    let lastWheel = 0, lastMag = 0, consumed = false, acc = 0;
    addEventListener("wheel", (e) => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const now = performance.now(), mag = Math.abs(e.deltaY);
      if (now - lastWheel > 160 || mag > lastMag * 2.2 + 4) { consumed = false; acc = 0; } // a new gesture
      lastWheel = now; lastMag = mag;
      if (consumed) return;
      acc += e.deltaY * (e.deltaMode === 1 ? 40 : 1);
      if (Math.abs(acc) >= 24) {
        consumed = true;
        if (busy()) queued = Math.sign(acc); // a quick second flick is remembered, not lost
        else step(Math.sign(acc));
        acc = 0;
      }
    }, { passive: false });

    // touch: one swipe = one step
    let ty = null;
    addEventListener("touchstart", (e) => { ty = e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
    addEventListener("touchmove", (e) => { if (e.touches.length === 1) e.preventDefault(); }, { passive: false });
    addEventListener("touchend", (e) => {
      if (ty == null) return;
      const dy = ty - e.changedTouches[0].clientY; ty = null;
      if (Math.abs(dy) > 28) { if (busy()) queued = Math.sign(dy); else step(Math.sign(dy)); }
    }, { passive: true });

    // keyboard
    addEventListener("keydown", (e) => {
      const t = e.target, interactive = t.closest && t.closest("a, button, input, textarea, select");
      let dir = 0;
      if (e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey && !interactive)) dir = 1;
      if (e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey && !interactive)) dir = -1;
      if (e.key === "Home") { e.preventDefault(); scrollTo(0, 0); return; }
      if (e.key === "End") { e.preventDefault(); scrollTo(0, beats[beats.length - 1]); return; }
      if (!dir) return;
      e.preventDefault();
      if (busy()) queued = dir; else step(dir);
    });

    // in-page links jump straight to the first beat of that section
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      const el = document.querySelector(a.getAttribute("href"));
      if (!el) return;
      e.preventDefault();
      tween = null; queued = 0;
      const top = el.offsetTop;
      scrollTo(0, beats.find((b) => b >= top - 2) ?? top);
    });
  }

  let lastT = performance.now(), chapter = "";
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (tween) {
      const t = clamp((now - tween.t0) / tween.dur);
      scrollTo(0, Math.round(lerp(tween.y0, tween.y1, easeInOut(t))));
      if (t >= 1) {
        tween = null;
        if (queued) { const d = queued; queued = 0; step(d); } else lockUntil = now + 280;
      }
    } else if (queued && now >= lockUntil) { const d = queued; queued = 0; step(d); }
    const y = scrollY;
    const k = RM ? 1 : 1 - Math.exp(-dt * 7);
    for (const s of S) {
      s.target = s.entering ? clamp((y + vh - s.top) / s.len) : clamp((y - s.top) / s.len);
      s.p = Math.abs(s.target - s.p) < 1e-4 ? s.target : s.p + (s.target - s.p) * k;
      const inView = y + vh > s.top - 50 && y < s.top + s.h + 50;
      // scenes far from the viewport are not painted at all (frees GPU memory held by 3D layers)
      if (s.stage) {
        const near = y + vh * 2 > s.top && y < s.top + s.h + vh;
        if (near !== s.shown) { s.shown = near; s.stage.style.visibility = near ? "" : "hidden"; }
      }
      if (!inView) continue;
      if (Math.abs(s.p - s.last) > 1e-5 || s.always) {
        s.last = s.p;
        s.update(s.p, s, now);
        if (s.fadeEl) {
          const [a, b] = s.fade || [0.05, 0.05];
          const f = Math.max(a ? 1 - seg(s.p, 0, a) : 0, b ? seg(s.p, 1 - b, 1) : 0);
          setStyle(s.fadeEl, "opacity", f.toFixed(3));
        }
      }
    }
    // chapter HUD
    const mid = y + vh * 0.5;
    const cur = S.find((s) => mid >= s.top && mid < s.top + s.h) || S[0];
    const key = cur.ch.join("|");
    if (key !== chapter) {
      chapter = key;
      hudNum.textContent = cur.ch[0]; hudName.textContent = cur.ch[1];
      hud.style.setProperty("--acc", accents[cur.ch[2]] || "var(--text)");
    }
    hudBar.style.transform = `scaleX(${cur.target.toFixed(3)})`;
    nav.classList.toggle("is-scrolled", y > 40);
    if (!CAPTURE) requestAnimationFrame(frame);
  }

  // grain texture (generated once)
  (function grain() {
    const c = document.createElement("canvas"); c.width = c.height = 160;
    const x = c.getContext("2d"), d = x.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
    $(".grain").style.backgroundImage = `url(${c.toDataURL()})`;
  })();

  addEventListener("resize", () => {
    if (innerWidth === vwLast && Math.abs(innerHeight - vh) < 120) return; // ignore mobile URL-bar jitter
    vwLast = innerWidth; measure();
  });
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  measure();
  if (!CAPTURE) requestAnimationFrame(frame);
  // debug hook: render a settled frame at the current scroll position
  window.__warexx = { render(t = performance.now()) { for (const s of S) s.p = s.target = s.entering ? clamp((scrollY + vh - s.top) / s.len) : clamp((scrollY - s.top) / s.len); frame(t); }, scenes: S };
  let vStart = null;
  if (CAPTURE) window.__warexx.capture = {
    ready: () => started && !!TEX,
    /** Render virtual time `ms` at scroll `y`, with CSS animations/transitions pinned to the same clock. */
    step(ms, y) {
      scrollTo(0, y);
      for (const s of S) s.p = s.target = s.entering ? clamp((scrollY + vh - s.top) / s.len) : clamp((scrollY - s.top) / s.len);
      frame(ms);
      if (!vStart) vStart = new WeakMap();
      for (const a of document.getAnimations()) {
        if (!vStart.has(a)) vStart.set(a, ms);
        a.pause(); a.currentTime = ms - vStart.get(a);
      }
      return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
    layout: () => ({ vh, H: document.documentElement.scrollHeight, scenes: S.map((s) => ({ name: s.el.dataset.scene, top: s.top, len: s.len, h: s.h })) }),
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  // build textures after first paint, then bring the lights up
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrames = (n) => Promise.race([new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), wait(120)]);
  let started = false;
  let waiting = false;
  const startIntro = (force) => {
    if (started) return;
    // prefer not to play the opening to a background tab, but never wait forever:
    // some browsers/embeds report "hidden" while on screen, so any of these starts it
    if (document.hidden && force !== true) {
      if (waiting) return; waiting = true;
      const go = () => startIntro(true);
      document.addEventListener("visibilitychange", go, { once: true });
      addEventListener("scroll", go, { once: true, passive: true });
      addEventListener("pointerdown", go, { once: true });
      setTimeout(go, 1500);
      return;
    }
    started = true;
    const enter = S.find((s) => s.el.dataset.scene === "enter");
    enter && enter.start && enter.start();
    if (CAPTURE && enter) { enter.t0 = 0; $(".curtain").style.display = "none"; }
    document.body.classList.remove("is-loading");
  };
  const failSafe = setTimeout(startIntro, 4000);
  setTimeout(async () => {
    try {
      TEX = await buildTextures({ res: MOBILE ? 0.6 : 1, mobile: MOBILE });
      // decode every texture up front so nothing pops in or hitches on first paint
      const urls = [...TEX.wall, ...TEX.overlay, ...TEX.pallet, TEX.front];
      await Promise.race([Promise.all(urls.map((u) => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); })), wait(1200)]);
      for (const s of S) { s.ready && s.ready(s); s.resize && s.resize(s); s.last = -1; }
    } catch (e) { console.error(e); }
    // wait for the display font (so headlines never swap mid-reveal) and for the new layers to paint
    await Promise.race([document.fonts ? document.fonts.ready : wait(0), wait(1500)]);
    await nextFrames(2);
    clearTimeout(failSafe);
    startIntro();
  }, 30);
})();
