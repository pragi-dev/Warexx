/* =========================================================
   WAREXX — hero components
   HeroSection
   ├── VideoBackground        looping film + requestAnimationFrame fade system
   ├── NavigationBar          Features menu + mobile menu
   ├── HeroContent
   │   └── CommandCentrePreview   rotating example questions
   ├── OperationalSignals     floating system cards (entrance + drift in CSS)
   └── HeroParallaxLayers     scroll depth: background / midground / foreground
   main.js drives HeroParallaxLayers from the shared scroll engine.
   ========================================================= */
(function () {
  "use strict";

  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CAPTURE = /[?&]capture(&|=|$)/.test(location.search);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------------------------------------------------------
     VideoBackground
     Opacity is animated only with requestAnimationFrame (never CSS transitions).
     - 250 ms fade-in on first load and at the start of every loop
     - fade-out begins 0.55 s before the end (guarded by fadingOutRef)
     - on ended: opacity 0 → wait 100 ms → rewind → play → fade back in
     Every fade cancels the running frame and starts from the current opacity.
     --------------------------------------------------------- */
  class VideoBackground {
    constructor(root) {
      this.root = root;
      this.video = root.querySelector("video");
      this.rafRef = null;
      this.fadingOutRef = { current: false };
      this.restartTimer = null;
      this.visible = true;
      this.opacity = 0;
      this.setOpacity(0);
      if (RM || CAPTURE) { this.showPosterOnly(); return; }
      this.pickSource();
      this.bind();
    }

    pickSource() {
      const v = this.video;
      const small = innerWidth < 821 || (navigator.connection && navigator.connection.saveData);
      v.src = small ? v.dataset.srcMobile : v.dataset.srcDesktop;
      v.preload = "auto";
    }

    bind() {
      const v = this.video;
      this.onReady = () => { this.play(); this.fadeTo(1, 250); };
      this.onTime = () => {
        if (this.fadingOutRef.current || !v.duration) return;
        if (v.duration - v.currentTime <= 0.55) {
          this.fadingOutRef.current = true;
          this.fadeTo(0, 500);
        }
      };
      this.onEnded = () => {
        this.cancel();
        this.setOpacity(0);
        clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          v.currentTime = 0;
          this.fadingOutRef.current = false;
          this.play();
          this.fadeTo(1, 250);
        }, 100);
      };
      v.addEventListener("loadeddata", this.onReady, { once: true });
      v.addEventListener("timeupdate", this.onTime);
      v.addEventListener("ended", this.onEnded);
      v.addEventListener("error", () => this.showPosterOnly(), { once: true });
      // no point decoding video nobody can see
      if ("IntersectionObserver" in window) {
        this.io = new IntersectionObserver(([e]) => {
          this.visible = e.isIntersecting;
          if (!this.visible) v.pause();
          else if (v.readyState >= 2 && !this.fadingOutRef.current) this.play();
        });
        this.io.observe(this.root);
      }
      document.addEventListener("visibilitychange", () => { if (document.hidden) v.pause(); else if (this.visible) this.play(); });
    }

    play() {
      const p = this.video.play();
      if (p && p.catch) p.catch(() => this.showPosterOnly());
    }

    showPosterOnly() {
      this.cancel();
      this.root.classList.add("is-poster");
    }

    setOpacity(o) {
      this.opacity = o;
      this.video.style.opacity = o.toFixed(3);
    }

    cancel() {
      if (this.rafRef != null) cancelAnimationFrame(this.rafRef);
      this.rafRef = null;
    }

    /** Animate from wherever the opacity is now; one fade at a time. */
    fadeTo(target, ms) {
      this.cancel();
      const from = this.opacity;
      if (Math.abs(target - from) < 0.001) { this.setOpacity(target); return; }
      const t0 = performance.now();
      const tick = (now) => {
        const t = clamp((now - t0) / ms);
        this.setOpacity(from + (target - from) * easeInOut(t));
        this.rafRef = t < 1 ? requestAnimationFrame(tick) : null;
      };
      this.rafRef = requestAnimationFrame(tick);
    }
  }

  /* ---------------------------------------------------------
     NavigationBar
     --------------------------------------------------------- */
  function NavigationBar(nav) {
    const toggle = nav.querySelector(".nav-toggle");
    const menu = document.getElementById(toggle.getAttribute("aria-controls"));
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("menu-open", open);
      menu.hidden = !open;
    };
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });

    // Features dropdown: hover on desktop, click / keyboard everywhere
    const dd = nav.querySelector(".nav-dd");
    const btn = dd.querySelector("button");
    const setDD = (open) => { btn.setAttribute("aria-expanded", String(open)); dd.classList.toggle("open", open); };
    btn.addEventListener("click", () => setDD(btn.getAttribute("aria-expanded") !== "true"));
    dd.addEventListener("mouseenter", () => matchMedia("(hover: hover)").matches && setDD(true));
    dd.addEventListener("mouseleave", () => setDD(false));
    dd.addEventListener("focusout", (e) => { if (!dd.contains(e.relatedTarget)) setDD(false); });
    dd.addEventListener("click", (e) => { if (e.target.closest("a")) setDD(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (dd.classList.contains("open")) { setDD(false); btn.focus(); }
      if (nav.classList.contains("menu-open")) { setOpen(false); toggle.focus(); }
    });
    addEventListener("resize", () => { if (innerWidth > 1080 && nav.classList.contains("menu-open")) setOpen(false); });
  }

  /* ---------------------------------------------------------
     CommandCentrePreview — types example questions into the placeholder
     --------------------------------------------------------- */
  function CommandCentrePreview(form) {
    const input = form.querySelector("input");
    const base = input.getAttribute("placeholder");
    const Q = ["What is today's total sales?", "Which warehouse has the highest stock?", "Show pending GRNs.", "Find invoice INV-20481."];
    let qi = 0, timer = null;
    const idle = () => !input.value && document.activeElement !== input;
    const schedule = (fn, ms) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
    const typeQ = () => {
      if (!idle() || document.hidden) return schedule(typeQ, 1500);
      const q = Q[qi++ % Q.length];
      if (RM) { input.setAttribute("placeholder", q); return schedule(typeQ, 3600); }
      let n = 0;
      const step = () => {
        if (!idle()) { input.setAttribute("placeholder", base); return schedule(typeQ, 2500); }
        input.setAttribute("placeholder", q.slice(0, ++n) + (n < q.length ? "▍" : ""));
        if (n < q.length) schedule(step, 34 + Math.random() * 40);
        else schedule(typeQ, 2600);
      };
      step();
    };
    input.addEventListener("focus", () => input.setAttribute("placeholder", base));
    input.addEventListener("blur", () => { if (!input.value) schedule(typeQ, 1800); });
    if (!CAPTURE) schedule(typeQ, 3200);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const go = window.__warexx && window.__warexx.goTo;
      if (go) go("#s-command"); else location.hash = "s-command";
    });
  }

  /* ---------------------------------------------------------
     OperationalSignals — staggered entrance once the page is revealed
     --------------------------------------------------------- */
  function OperationalSignals(root) {
    const cards = Array.from(root.querySelectorAll(".signal"));
    cards.forEach((c, i) => c.style.setProperty("--i", i));
    return { cards };
  }

  /* ---------------------------------------------------------
     HeroParallaxLayers — called by the scroll engine with hero progress p ∈ [0,1]
     --------------------------------------------------------- */
  function HeroParallaxLayers(stage) {
    const q = (s) => stage.querySelector(s);
    const L = {
      bg: q(".hero-video"),
      scrim: q(".hero-scrim"),
      signals: Array.from(stage.querySelectorAll(".signal-wrap")),
      content: q(".hero-content"),
      fore: Array.from(stage.querySelectorAll(".plx-fore > *")),
      foot: q(".hero-foot"),
    };
    let vh = innerHeight, k = 1;
    const set = (el, prop, v) => { if (el["_" + prop] !== v) { el["_" + prop] = v; el.style[prop] = v; } };
    return {
      resize() { vh = innerHeight; k = innerWidth < 821 ? 0.45 : innerWidth < 1200 ? 0.75 : 1; },
      update(p) {
        const m = RM ? 0 : k;
        const e = easeInOut(clamp(p));
        // background: a slow dolly deeper into the aisle
        set(L.bg, "transform", `translate3d(0,${(-e * vh * 0.06 * m).toFixed(1)}px,0) scale(${(1 + e * 0.16 * m).toFixed(4)})`);
        // midground: operational signals drift up and apart, then clear
        L.signals.forEach((s, i) => {
          const side = s.dataset.side === "r" ? 1 : -1;
          const y = -e * vh * (0.42 + (i % 2) * 0.12) * m, x = side * e * 90 * m;
          set(s, "transform", `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`);
          set(s, "opacity", (1 - seg(p, 0.18, 0.46)).toFixed(3));
        });
        // content: slower than the foreground so it stays readable while leaving
        set(L.content, "transform", `translate3d(0,${(-e * vh * 0.28 * m).toFixed(1)}px,0)`);
        set(L.content, "opacity", (1 - seg(p, 0.22, 0.5)).toFixed(3));
        set(L.foot, "opacity", (1 - seg(p, 0.05, 0.2)).toFixed(3));
        // foreground: fastest layer, sweeps past the lens
        L.fore.forEach((f, i) => {
          const r = +f.dataset.rate || 1;
          const y = -e * vh * 0.95 * r * m, s = 1 + e * 0.22 * r * m;
          set(f, "transform", `translate3d(0,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`);
        });
        set(L.scrim, "opacity", (1 - seg(p, 0.3, 0.6) * 0.6).toFixed(3));
      },
    };
  }

  /* ---------------------------------------------------------
     HeroSection — mounts everything once
     --------------------------------------------------------- */
  function HeroSection() {
    const stage = document.querySelector(".hero-stage");
    if (!stage) return null;
    const video = new VideoBackground(stage.querySelector(".hero-video"));
    NavigationBar(document.getElementById("nav"));
    CommandCentrePreview(stage.querySelector(".ask"));
    OperationalSignals(stage.querySelector(".signals"));
    const parallax = HeroParallaxLayers(stage);
    return { video, parallax };
  }

  window.WXHero = HeroSection();
})();
