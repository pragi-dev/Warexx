// Renders tools/hero-film.html into the hero background video (+ a small mobile cut and a poster).
// usage (with `py tools/serve.py 8777` running):  node tools/record-hero.mjs [--port 8777]
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const FFMPEG = require("ffmpeg-static");

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const FPS = 30, W = 1920, H = 1080;
const URL = `http://localhost:${arg("port", "8777")}/tools/hero-film.html?capture`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync("media", { recursive: true });

const port = 9334;
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
for (let i = 0; i < 150; i++) { if (await evaluate("!!(window.film && film.ready)").catch(() => false)) break; await sleep(200); }
await sleep(600);
const LOOP = await evaluate("film.LOOP");
const frames = Math.round(LOOP * FPS);

// one encoder for the desktop cut, a second for the lighter mobile cut
const enc = (out, extra) => spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
  ...extra, "-c:v", "libx264", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
const ffD = enc("media/hero-warehouse.mp4", ["-crf", "25", "-tune", "film"]);
const ffM = enc("media/hero-warehouse-mobile.mp4", ["-vf", "scale=960:540", "-crf", "27"]);
const write = async (ff, buf) => { if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r)); };

console.log(`rendering ${LOOP}s · ${frames} frames`);
for (let f = 0; f < frames; f++) {
  await evaluate(`film.step(${((f / FPS) * 1000).toFixed(1)})`);
  const { data } = await send("Page.captureScreenshot", { format: "jpeg", quality: 93 });
  const buf = Buffer.from(data, "base64");
  if (f === 0) writeFileSync("media/hero-poster.jpg", buf);
  await write(ffD, buf); await write(ffM, buf);
  if (f % 60 === 0) console.log(`${f}/${frames}`);
}
ffD.stdin.end(); ffM.stdin.end();
await Promise.all([ffD, ffM].map((ff) => new Promise((r) => ff.on("close", r))));
ws.close(); chrome.kill();
console.log("done → media/hero-warehouse.mp4, media/hero-warehouse-mobile.mp4, media/hero-poster.jpg");
process.exit(0);
