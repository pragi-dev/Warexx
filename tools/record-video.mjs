// Records the WAREXX landing page as an MP4 by stepping the page's own clock frame by frame.
// usage (with `py tools/serve.py 8766` running):  node tools/record-video.mjs [--from s] [--dur s] [--out file.mp4]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const FFMPEG = require("ffmpeg-static");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 30, W = 1920, H = 1080;
const FROM = +arg("from", 0), DUR = arg("dur") ? +arg("dur") : null;
const OUT = arg("out", "warexx.mp4"), STILLS = arg("stills"), EVERY = +arg("every", 0);
const URL = "http://localhost:8766/index.html?capture";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- launch headless Chrome and speak CDP over a WebSocket ----
const port = 9333;
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${process.cwd()}/profile`,
  `--window-size=${W},${H}`, "--hide-scrollbars", "--mute-audio", "--force-device-scale-factor=1", "--no-first-run", "about:blank"], { stdio: "ignore" });
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break; } catch {} await sleep(200); }
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, (m) => (m.error ? rej(new Error(method + ": " + m.error.message)) : res(m.result))); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed"); return r.result.value; };

await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send("Page.enable");
await send("Page.navigate", { url: URL });
for (let i = 0; i < 150; i++) { if (await evaluate("!!(window.__warexx && __warexx.capture && __warexx.capture.ready())").catch(() => false)) break; await sleep(200); }
// load every industry photo up front and wait for them
await evaluate(`(async () => { const s = __warexx.scenes.find(s => s.el.dataset.scene === 'industries'); s.load();
  await Promise.all([...document.querySelectorAll('.ind img')].map(i => i.decode().catch(() => {}))); return true })()`);
await sleep(500);
const L = await evaluate("__warexx.capture.layout()");

// ---- the camera path: seconds spent inside each scene ----
const D = { enter: 21, docs: 11, inventory: 11, move: 12, break: 10, command: 17, transform: 13, flow: 13, network: 11, industries: 16 };
const K = [[0, 0], [4.5, 0]];
let t = 4.5;
for (const s of L.scenes) {
  if (s.name === "final") continue;
  if (K[K.length - 1][1] !== s.top) { t += 1.3; K.push([t, s.top]); }
  t += D[s.name]; K.push([t, s.top + s.len]);
}
const yMax = L.H - L.vh;
t += 3.5; K.push([t, yMax]); t += 5; K.push([t, yMax]);
const TOTAL = t;
const raw = (tt) => { if (tt <= 0) return 0; for (let i = 1; i < K.length; i++) if (tt <= K[i][0]) { const [t0, y0] = K[i - 1], [t1, y1] = K[i]; return y0 + (y1 - y0) * ((tt - t0) / (t1 - t0)); } return yMax; };
// ease the joins between scenes: average the path over a 1.2 s window
const yAt = (tt) => { let s = 0, n = 24; for (let i = 0; i < n; i++) s += raw(tt - 0.6 + (1.2 * i) / (n - 1)); return Math.round(s / n); };

const end = DUR ? Math.min(TOTAL, FROM + DUR) : TOTAL;
const frames = Math.round((end - FROM) * FPS);
console.log(`timeline ${TOTAL.toFixed(1)}s · rendering ${FROM}s → ${end.toFixed(1)}s (${frames} frames)`);

const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT], { stdio: ["pipe", "inherit", "inherit"] });
if (STILLS) mkdirSync(STILLS, { recursive: true });

// warm up: step through the start so lazy layers exist, then begin at FROM
for (let f = 0, tt = 0; tt < FROM; f++, tt = f / FPS) if (f % 15 === 0) await evaluate(`__warexx.capture.step(${tt * 1000}, ${yAt(tt)})`);

const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const tt = FROM + f / FPS;
  await evaluate(`__warexx.capture.step(${(tt * 1000).toFixed(1)}, ${yAt(tt)})`);
  const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 92, captureBeyondViewport: false });
  const buf = Buffer.from(data, "base64");
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (STILLS && EVERY && f % EVERY === 0) writeFileSync(`${STILLS}/f${String(Math.round(tt * 10)).padStart(5, "0")}.jpg`, buf);
  if (f % 150 === 0) { const el = (Date.now() - t0) / 1000; console.log(`${f}/${frames} · ${tt.toFixed(1)}s · ${(f / Math.max(el, 0.01)).toFixed(1)} fps`); }
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
ws.close(); chrome.kill();
console.log("done →", OUT);
process.exit(0);
