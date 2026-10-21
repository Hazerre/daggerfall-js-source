// THE DWARVEN PISTOLET ON THE REAL PAPER DOLL (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md) - the doll the
// game composes (ui/paperDoll.js refreshPaperDoll, the one door every doll draws through) over the player's own ARENA2
// body and backdrop, wearing a PAIR of Pistolets through the equip law - beside a classic dagger pair (the measurement's
// own reference: TEXTURE.234's two hands) and the Sunken Sovereign's gold pair.
//
// What no pin can say: the fist reads THROUGH each pistol's gap - the doll's right hand on the right pistol's grip, its
// left hand on the left's. The composites are written enlarged, side by side, for the eye (to the directory named, never
// public/ - AUDIT 21: the body is ARENA2's).
//
//     ARENA2_PATH=<the freeware data, tools/fetch-data.sh> node tools/pistoletDollProbe.mjs [shots-dir]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.argv[2] || 'scratch/pistolet-doll';
mkdirSync(OUT, { recursive: true });
const PAGE = 'pistoletdoll.tmp.html';
writeFileSync(PAGE, `<!doctype html><html><head><meta charset="utf-8"><title>pistolet doll probe</title>
<style>body{margin:0;background:#222}canvas{image-rendering:pixelated}</style></head><body><canvas id="gl" width="8" height="8" style="display:none"></canvas><canvas id="out"></canvas>
<script type="module">
import { Renderer } from '/src/render/renderer.js';
import { DFPalette } from '/src/formats/dfPalette.js';
import { fetchBytes } from '/src/scenes/shared.js';
import { createDataPipeline } from '/src/scenes/dataPipeline.js';
import { preloadPaperDollArt, refreshPaperDoll, paperDollPixels } from '/src/ui/paperDoll.js';
import { createPistolet, installPistoletIcons } from '/src/systems/pistolet.js';
import { installThunderlockIcons } from '/src/systems/thunderlock.js';
import { equipItem } from '/src/systems/equip.js';
import { createWeapon } from '/src/combat/enemyEquipment.js';
import { mintGilded, SUNKEN_SOVEREIGN } from '/src/systems/gilded.js';
const renderer = new Renderer(document.getElementById('gl'));
const palette = new DFPalette();
palette.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
const { getTexture } = createDataPipeline({ renderer, arch: null, palette });
installThunderlockIcons(); installPistoletIcons();
await preloadPaperDollArt({ renderer, fetchBytes, palette, getTexture }, { race: 'Breton', gender: 'male', faceIndex: 0 });
const body = () => ({ isPlayer: true, race: 'Breton', gender: 'male', faceIndex: 0, items: [], stats: { strength: 50, agility: 50 }, skills: new Array(35).fill(50) });
const dolls = [];
for (const pair of [[createPistolet(), createPistolet()], [createWeapon(113, 1), createWeapon(113, 1)], [mintGilded(SUNKEN_SOVEREIGN), mintGilded(SUNKEN_SOVEREIGN)]]) {
  const e = body();
  for (const it of pair) { e.items.push(it); equipItem(e, it); }
  await refreshPaperDoll(e);
  await new Promise((r) => setTimeout(r, 400));
  await refreshPaperDoll(e);
  const p = paperDollPixels();
  dolls.push(p ? { w: p.width, h: p.height, rgba: Array.from(p.rgba), slots: pair.map((it) => it.equipSlot) } : null);
}
globalThis.__dolls = dolls;
globalThis.__ready = true;
</script></body></html>`);

const server = await createServer({ server: { port: 5193, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.goto(`http://localhost:5193/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 600000 });
  await page.waitForFunction(() => globalThis.__ready, null, { timeout: 600000 });
  const dolls = await page.evaluate(() => globalThis.__dolls);
  console.log('dolls', dolls.map((d) => d && `${d.w}x${d.h} slots ${d.slots}`).join(' | '));
  const { writePng } = await import('./pngIO.mjs');
  const Z = 3, ok = dolls.filter(Boolean), W = ok.reduce((n, d) => n + d.w * Z + 10, 0), H = Math.max(...ok.map((d) => d.h * Z));
  const out = new Uint8Array(W * H * 4).fill(30);
  let ox = 0;
  for (const d of ok) {
    for (let y = 0; y < d.h * Z; y++) for (let x = 0; x < d.w * Z; x++) {
      const s = (((y / Z) | 0) * d.w + ((x / Z) | 0)) * 4, o = (y * W + ox + x) * 4;
      const a = d.rgba[s + 3] / 255;
      for (let c = 0; c < 3; c++) out[o + c] = d.rgba[s + c] * a + 30 * (1 - a);
      out[o + 3] = 255;
    }
    ox += d.w * Z + 10;
  }
  writeFileSync(`${OUT}/dolls.png`, writePng({ width: W, height: H, data: out }));
  console.log(errors.length ? `errors: ${errors.slice(0, 3).join(' | ')}` : 'no page errors', `- ${OUT}/dolls.png`);
} finally {
  await browser.close(); await server.close();
  try { unlinkSync(PAGE); } catch { /* gone */ }
}
