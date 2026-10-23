// EVENTS1 (2026-10-23), MEASURED: the event board and its cards (ui/eventBoard.js) drawn in Chromium over the real HUD -
// the enhanced HUD through its own entry (drawEnhancedHud: the vitals, the hotbar, the quick slots and the buffs), a live
// chat panel with its peek full (createChatPanel over a ChatLog), the quest card and the party list in their sheets'
// classes, and the notices' stack - on Enhanced Plus and the classic skin, at a desk's sizes, a narrow window's and a
// phone's both ways. Nothing of the board or its cards may cover the chat's peek, the quick slots, the buffs, the vitals,
// the hotbar, the compass, the quest card or the party list, and all of it stands inside the screen. The suite holds the
// board's law and its DOM on a fake document (test/systems/events1_board.test.js, test/ui/events1_board_ui.test.js); this
// photographs what a fake cannot. Photographs to SHOT_DIR (default tools/shots/).
//
//     node tools/eventBoardProbe.mjs
import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/opt/pw-browsers';
const OUT = process.env.SHOT_DIR ?? 'tools/shots';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`); if (!ok) fails++; };
const PORT = Number(process.env.PROBE_PORT ?? 5269);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'silent' });
await server.listen();
const exe = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
const errors = [];
const SIZES = [[1920, 1080, 'desk-hd', false], [1280, 720, 'desk', false], [1024, 700, 'narrow', false], [844, 390, 'phone-land', true], [390, 844, 'phone', true]];
const over = (a, b) => !!(a && b && a.w > 0 && b.w > 0 && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5);

for (const skin of ['plus', 'classic']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push(`${skin}: ${e.message}`));
  for (let tries = 0; tries < 4; tries++) {
    try {
      await page.goto(`http://localhost:${PORT}/play/?skin=${skin === 'plus' ? 'enhanced' : 'classic'}&touch=off&nofonts`);
      await page.waitForTimeout(tries ? 4000 : 1500);
      break;
    } catch (e) { console.log('retry', skin, String(e.message).slice(0, 80)); }
  }
  for (const [W, H, size, touch] of SIZES) {
    const tag = `${size}-${skin}`;
    await page.setViewportSize({ width: W, height: H });
    const r = await page.evaluate(async ([skin, touch]) => {
      history.replaceState(null, '', `${location.pathname}${location.search.replace(/touch=(on|off)/, `touch=${touch ? 'on' : 'off'}`)}`);
      const { drawEnhancedHud } = await import('/src/ui/enhanced/enhancedHud.js');
      const { ChatLog } = await import('/src/net/chat.js');
      const { createChatPanel } = await import('/src/ui/chatPanel.js');
      const { drawEventBoard, destroyEventBoard } = await import('/src/ui/eventBoard.js');
      const { seatEventBoard, eventNotice, _resetEventNotices } = await import('/src/systems/eventNotices.js');
      const { gateAt } = await import('/src/net/gate/gateLaw.js');
      const { injectPartyStyle } = await import('/src/ui/partyPanel.js');
      if (skin === 'plus') (await import('/src/ui/enhanced/enhancedStyle.js')).injectEnhancedStyle(document);
      destroyEventBoard(); _resetEventNotices();
      // the HUD's root is the enhanced HUD's own, built once and kept (its module holds it); every other node goes
      for (const n of [...document.body.children]) if (n.tagName !== 'SCRIPT' && !n.classList.contains('hud') && !n.classList.contains('hb-dock')) n.remove();
      document.body.style.cssText = 'margin:0;background:repeating-linear-gradient(45deg,#3a4a3a 0 14px,#324032 14px 28px);height:100vh';
      const el = (cls, text = '', tag = 'div') => { const n = document.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
      const wait = (ms) => new Promise((res) => setTimeout(res, ms));
      // the HUD, through its own entry
      const e = { name: 'Aelwyn', isPlayer: true, chargenDone: true, career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48, willpower: 50, intelligence: 50 },
        health: 30, maxHealth: 40, fatigue: 150, maxFatigue: 200, magicka: 14, maxMagicka: 20, items: [], wagonItems: [], bagItems: [], spells: [] };
      if (skin === 'plus') for (let i = 0; i < 3; i++) { drawEnhancedHud(e, 0.25, 0.016, {}); await wait(30); }
      const hudUp = !!document.querySelector('.hud .hud-bars');
      // the chat, its peek full
      const log = new ChatLog();
      const chat = createChatPanel({ log, onSend: () => true, overlay: () => false, touch });
      for (let i = 0; i < 12; i++) log.push('world', { id: `pabcdefgh00${i % 3}`, name: ['Bran', 'Ysolde', 'Corwin'][i % 3], text: `line ${i} - a sentence long enough to come near the edge of the box`, at: Date.now() });
      chat.render({});
      // the quest card and the party list, in their sheets' classes
      if (skin === 'plus') {
        const q = el(touch ? 'qtrack touch' : 'qtrack');
        const head = el('qtrack-head'); head.append(el('qtrack-mark', '◆', 'span'), el('qtrack-title', 'The Thirteenth of Frostfall', 'span'));
        q.append(head, el('qtrack-line', 'Morwen of Glenmoril waits at the coven’s fire'), el('qtrack-where', 'Glenmoril Coven'), el('qtrack-time', '3 days left'));
        document.body.append(q);
      }
      injectPartyStyle(document);
      const party = el(touch ? 'dfparty touch' : 'dfparty');
      party.append(el('dfparty-title', 'Party'), el('', 'Ysolde'), el('', 'Corwin'), el('', 'Bran'));
      document.body.append(party);
      // the board: the gate open, a star standing, a raid under way in the region, one coming - and two cards
      const now = gateAt(Date.now()).openAt + 60_000;
      const src = {
        now, pixel: { x: 200, y: 200 }, region: 'Daggerfall',
        gate: { place: 'Copperham, Daggerfall', site: { px: 207, py: 191, day: 0 } },
        stars: [{ id: 'star:1.0', kind: 'star', title: 'Fallen Star', where: 'Near Gothway Garden', detail: 'The coven takes it when this runs out', live: true, at: now + 640_000, until: now + 640_000, px: 188, py: 214 }],
        raids: [
          { name: 'Ilessan Hills', region: 'Daggerfall', type: 'orcs', startMs: now - 120_000, endMs: now + 480_000, px: 196, py: 204, n: 7, tg: 18 },
          { name: 'Wayrest', region: 'Wayrest', type: 'bandits', startMs: now + 300_000, endMs: now + 900_000, px: 260, py: 150 },
        ],
      };
      seatEventBoard(() => src);
      drawEventBoard({ dt: 0.016, nowMs: Date.now() });
      eventNotice('star', 'A star has fallen near Gothway Garden.');
      eventNotice('raid', 'Ilessan Hills in Daggerfall is under attack by orcs!');
      for (let i = 0; i < 4; i++) { drawEventBoard({ dt: 0.016, nowMs: Date.now() + 600 * (i + 1) }); await wait(80); }
      await wait(400);
      const box = (n) => { if (!n) return null; const b = n.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const q1 = (s) => box(document.querySelector(s));
      return {
        board: q1('.evboard'), news: [...document.querySelectorAll('.evnews')].map(box), hud: q1('.evhud'),
        newsText: document.querySelector('.evnews')?.textContent ?? '',
        peek: q1('.dfchat-peek'), chat: q1('.dfchat'), quick: q1('.hud .hud-quick'), stat: q1('.hud .hud-stat'), bars: q1('.hud .hud-bars'), hotbar: q1('.hud .hb'),
        compass: q1('.hud .hud-compass'), quest: q1('.qtrack'), party: q1('.dfparty:not(.probe-skip)'), temp: q1('.hud .hud-temp'),
        rows: document.querySelectorAll('.evrow').length, vw: innerWidth, vh: innerHeight, hudUp,
      };
    }, [skin, touch]);
    await page.screenshot({ path: `${OUT}/events1-${tag}.png` });
    if (process.env.PROBE_BOXES) console.log(tag, JSON.stringify({ peek: r.peek, quick: r.quick, stat: r.stat, temp: r.temp, bars: r.bars, hotbar: r.hotbar, board: r.board, quest: r.quest, party: r.party }, (k, v) => (typeof v === 'number' ? Math.round(v) : v)));
    if (skin === 'plus') check(`${tag}: the enhanced HUD stands to be measured against`, r.hudUp && !!r.quick && !!r.bars);
    const short = r.vh <= 500;
    // a short screen keeps the news alone (its rows are the Timers window's); every other screen the rows and the news
    // a desk's three rows (a tall screen's four), one of them the news's place while it stands
    const want = short ? 0 : (r.vh >= 900 ? 4 : 3) - 1;
    check(`${tag}: the board stands ${short ? 'with its news alone' : `with ${want} rows under its news`}`, !!r.board && r.board.h > 0 && r.rows === want, `${r.rows} rows`);
    check(`${tag}: one news at its head, its row's place and way on it`, r.news.length === 1 && /\d+ km SW \u00b7 Near Gothway Garden/.test(r.newsText), r.newsText.slice(0, 120));
    const b = r.board;
    check(`${tag}: the board inside the screen`, !!b && b.l >= 0 && b.t >= 0 && b.r <= r.vw + 0.5 && b.b <= r.vh + 0.5, b ? `${Math.round(b.l)},${Math.round(b.t)} - ${Math.round(b.r)},${Math.round(b.b)}` : 'none');
    // a phone on its side: the chat's peek and the quick slots already meet - the news stands over the peek's foot for its
    // seconds (the peek's lines fade - net/chat.js CHAT_FADE_MS) and clear of everything that stays
    for (const [other, ob] of [...(short ? [] : [['chat peek', r.peek]]), ['quick slots', r.quick], ['buffs', r.stat], ['vitals', r.bars], ['hotbar', r.hotbar], ['compass', r.compass], ['quest card', r.quest], ['party', r.party], ['temperature', r.temp]]) {
      if (ob) check(`${tag}: the board clear of the ${other}`, !over(b, ob), over(b, ob) ? `${JSON.stringify(b)} x ${JSON.stringify(ob)}` : '');
    }
  }
  await page.close();
}
check('no page errors', !errors.length, errors.join(' | '));
await browser.close();
await server.close();
console.log(fails ? `${fails} FAILED` : 'all clear');
process.exit(fails ? 1 : 0);
