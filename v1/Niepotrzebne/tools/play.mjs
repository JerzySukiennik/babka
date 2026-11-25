// Headless Chrome (Metal GPU) scenario runner for babka.mp4: node play.mjs <scenario.json> <outdir>
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/jurek/openclaw/node_modules/');
const {chromium} = require('playwright-core');
const [scen, outdir = '/tmp/babka-shots'] = process.argv.slice(2);
fs.mkdirSync(outdir, {recursive: true});
const steps = JSON.parse(fs.readFileSync(scen, 'utf8'));
const W = +(process.env.W || 900), H = +(process.env.H || 560);
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({viewport: {width: W, height: H}, deviceScaleFactor: 1});
const logs = [];
page.on('console', m => { if (m.type() !== 'debug') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));
await page.goto(process.env.URL || 'http://localhost:8996/', {waitUntil: 'load'});
try { await page.waitForFunction(() => window.__babka?.ready, null, {timeout: 60000}); } catch { logs.push('[harness] ready timeout'); }
const sleep = ms => page.waitForTimeout(ms);
for (const s of steps) {
  if (s.wait) await sleep(s.wait);
  if (s.click) { await page.mouse.move(s.click[0], s.click[1]); await page.mouse.down(); await sleep(s.hold || 60); await page.mouse.up(); }
  if (s.down) { await page.mouse.move(s.down[0], s.down[1]); await page.mouse.down(); }
  if (s.up) await page.mouse.up();
  if (s.path) {
    const pts = s.path, n = s.steps || 30;
    for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k <= n; k++) { const t = k / n; await page.mouse.move(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t); await sleep(s.dt || 16); }
  }
  if (s.circle) {
    const [cx, cy, r, turns] = s.circle; const n = Math.round(turns * 40);
    for (let i = 0; i <= n; i++) { const a = i / 40 * Math.PI * 2; await page.mouse.move(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8); await sleep(s.dt || 16); }
  }
  if (s.dragObj) {
    const pos = await page.evaluate(([a, b, ya, yb]) => {
      const W = window.__babka, T = W.THREE;
      const pr = (o, y) => { const v = (o.isVector3 ? o.clone() : W.o[o].position.clone()).add(new T.Vector3(0, y, 0)).project(W.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
      return [pr(a, ya || 0), pr(b, yb || 0)];
    }, [s.dragObj, s.to, s.ya, s.yb]);
    const [[x0, y0], [x1, y1]] = pos;
    await page.mouse.move(x0, y0); await page.mouse.down();
    for (let k = 0; k <= 30; k++) { await page.mouse.move(x0 + (x1 - x0) * k / 30, y0 + (y1 - y0) * k / 30); await sleep(20); }
    const t0 = Date.now(); let i = 0;
    while (Date.now() - t0 < (s.hold || 0)) { const a = i++ * 0.15; await page.mouse.move(x1 + Math.cos(a) * (s.wiggle || 0), y1 + Math.sin(a) * (s.wiggle || 0) * 0.6); await sleep(16); if (s.midshot && i === 60) await page.screenshot({path: `${outdir}/${s.midshot}.png`}); }
    if (!s.keep) await page.mouse.up();
  }
  if (s.key) { await page.keyboard.down(s.key); await sleep(s.hold || 500); await page.keyboard.up(s.key); }
  if (s.eval) { try { const r = await page.evaluate(s.eval); if (r !== undefined) logs.push('[eval] ' + JSON.stringify(r)); } catch (e) { logs.push('[eval error] ' + e.message); } }
  if (s.shot) await page.screenshot({path: `${outdir}/${s.shot}.png`});
}
console.log(logs.slice(-80).join('\n'));
await browser.close();
