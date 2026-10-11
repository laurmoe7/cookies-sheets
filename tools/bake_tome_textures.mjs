// Bakes the Dusty tome textures (SVG feTurbulence sources owned by tools/make_tome_css.py) into web/css/tome/*.png|jpg using headless Chrome.
// Drawn live, those filters were re-rendered on every repaint of a tile, which is what made the theme slow to hover and scroll.
// usage: node tools/bake_tome_textures.mjs   (CHROME=path overrides the Chrome location)
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const outDir = path.join(root, 'web', 'css', 'tome');
const py = process.platform === 'win32' ? ['py', ['-3']] : ['python3', []];
const textures = JSON.parse(execFileSync(py[0], [...py[1], path.join(root, 'tools', 'make_tome_css.py'), '--dump'], { cwd: root, maxBuffer: 1 << 26 }).toString().replace(/^wrote [^\n]*\n/, ''));

const chromePath = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
const port = 9300 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bake-'));
const chrome = spawn(chromePath, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break; } catch { /* not up yet */ } await sleep(200); }
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => (ws.onopen = r));
  let id = 0; const pending = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
  const evaluate = expression => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } })); });
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, t] of Object.entries(textures)) {
    const expr = `new Promise((res, rej) => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = ${t.w * t.scale}; c.height = ${t.h * t.scale};
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL(${{ jpg: "'image/jpeg', 0.9", webp: "'image/webp', 0.9" }[t.ext] || "'image/png'"}).split(',')[1]); }; img.onerror = () => rej('load failed');
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(t.svg)}); })`;
    const r = (await evaluate(expr)).result;
    if (r.exceptionDetails) throw new Error(name + ': ' + JSON.stringify(r.exceptionDetails).slice(0, 200));
    const file = path.join(outDir, `${name}.${t.ext}`);
    fs.writeFileSync(file, Buffer.from(r.result.value, 'base64'));
    console.log(name.padEnd(14), `${t.w * t.scale}x${t.h * t.scale}`, (fs.statSync(file).size / 1024).toFixed(0) + ' KB');
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
