// COLLECTIONS-II (bible/10-UI/Collections.md) - THE COLLECTIONS PAGE, SEEN in a real browser.
//
// The page through its real painter on the enhanced pause (Holdings > Collections): the six parts' tiles and their counts,
// a wardrobe part's rows grouped by source, a row opened whole and its Wear, a filter - on a desktop and a 390 phone,
// with an account signed in (its /v1/account answered here, the service never reached) and without one. The frames go
// to the scratch directory named by COLL_OUT (never the repo: a frame of the menu carries no game data, but a probe's
// output is not the tree's).
//
//     npx vite --port 5199 &
//     COLL_OUT=/tmp/coll node tools/collectionsProbe.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5199';
const OUT = process.env.COLL_OUT ?? '/tmp/collections-probe';
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); };

/** The wardrobe the mocked service answers - a founder who bought the Broker's fire, wears the Gatebreaker, broke the
 *  Remnant once and took the Spire's second Redoubt. */
const WARDROBE = {
  titles: ['founder', 'gatebreaker', 'hourbreaker', 'spirewalker'], title: 'gatebreaker',
  glyphs: ['sprout'], auras: ['dagonfire'], aura: 'dagonfire', insignia: ['title:gatebreaker', 'aura:dagonfire'],
  icons: ['twinmoons'], icon: null,
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

async function serve(page) {
  await page.route(/\/v1\/account(\/.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'GET') return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ account: { id: 'a1', name: 'Aelwyn', kind: 'linked' }, wardrobe: WARDROBE }) });
    const body = JSON.parse(req.postData() || '{}');
    if ('title' in body) WARDROBE.title = body.title;
    if ('aura' in body) WARDROBE.aura = body.aura;
    if ('icon' in body) WARDROBE.icon = body.icon;
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(WARDROBE) });
  });
}

async function toPause(page, signedIn) {
  await page.addInitScript((on) => {
    try {
      localStorage.setItem('dagger.quicksave', JSON.stringify({ v: 1, name: 'Aelwyn', chargenDone: true, career: { name: 'Spellsword' }, level: 4, items: [] }));
      if (on) localStorage.setItem('dagger.account.session', JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'probe-secret' }));
    } catch { /* storage off */ }
  }, signedIn);
  // the front door drawn (no game started - the world's boot is not this page's business), then the pause door over it
  await page.goto(`${BASE}/play/?nointro`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.px-menu', { timeout: 120000 });
  if (await page.locator('.px-acctstage').count()) await page.keyboard.press('Escape');
  await page.evaluate(async () => {
    const { openPauseFlow } = await import('/src/ui/pauseDoor.js');
    openPauseFlow(() => {}, { at: 'collections', exitToMenu: () => {}, textLines: () => null });
  });
  await page.waitForSelector('.coll-parts', { timeout: 15000 });
}

const browser = await chromium.launch();
for (const [label, opts] of [['desktop', { viewport: { width: 1280, height: 860 } }], ['phone', devices['iPhone 13']]]) {
  for (const signedIn of [true, false]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (signedIn) await serve(page);
    await toPause(page, signedIn);
    const tag = `${label}-${signedIn ? 'in' : 'out'}`;
    if (signedIn) await page.waitForFunction(() => /\d+ \/ \d+/.test(document.querySelector('.coll-part')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
    const tiles = await page.$$eval('.coll-part', (ns) => ns.map((n) => n.textContent));
    check(`${tag}: the parts' tiles`, tiles.length >= 4, tiles.join(' | '));
    await page.screenshot({ path: `${OUT}/${tag}-titles.png` });
    // a row opened whole
    await page.locator('[data-wardrobe="title:gatebreaker"]').click();
    await page.locator('.coll-whole').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-opened.png` });
    check(`${tag}: a row opens whole`, (await page.locator('.coll-whole').count()) === 1);
    if (signedIn) check(`${tag}: a held row offers its press`, (await page.locator('.coll-wear').count()) === 1);
    // the auras, the icons, the glyphs
    for (const part of ['auras', 'icons', 'glyphs']) {
      await page.locator(`[data-focus="coll-part-${part}"]`).click();
      await page.locator('.coll-parts').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${tag}-${part}.png` });
    }
    await page.locator('[data-focus="coll-part-auras"]').click();
    await page.locator('[data-wardrobe="aura:witchfire"]').click();
    await page.locator('.coll-whole').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/${tag}-aura-opened.png` });
    // the page as wide as its pane - nothing wider
    const wide = await page.evaluate(() => { const d = document.querySelector('.px-qdetail'); return d ? [d.scrollWidth, d.clientWidth] : [0, 0]; });
    check(`${tag}: nothing wider than the pane`, wide[0] <= wide[1] + 1, `${wide[0]} in ${wide[1]}`);
    check(`${tag}: no page error`, errors.length === 0, errors.join(' / '));
    await ctx.close();
  }
}
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed} of ${results.length} - frames in ${OUT}`);
process.exit(failed ? 1 : 0);
