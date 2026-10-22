// BOARD-SIFT (2026-10-21, feature-feedback: "Definitely need sorting/filtering functions for work writs considering there
// are thousands of them and you have to scroll through them all to find what you want. The notice board market also
// doesnt show everything if there are too many weapons/armor/etc listed it stops after a certain number"; "The notice
// board in general needs some TLC. The writs especially."): THE WORK TAB'S BAR (ui/workSift.js, wired by
// ui/noticeWindow.js workBody and ui/workTab.js entries) and THE MARKET'S PAGES, SEARCH AND ORDERS (ui/marketTab.js).
// The record: bible/06-Systems/Professions-Arc.md 10.13.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from '../chargenDom.mjs';
import { mountNoticeBoard } from '../../src/ui/noticeWindow.js';
import { createMarketTab } from '../../src/ui/marketTab.js';
import { siftWork, kindCounts, freshSift, wordsOf, WORK_SHOWN, WORK_KINDS, WORK_SORTS } from '../../src/ui/workSift.js';
import { materialCountLabel } from '../../src/systems/professions/profItems.js';

const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 4) => { for (let i = 0; i < n; i++) await tick(); };
const rest = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 1_800_000_000, DAY = 86_400, DF = 17;
const OAK = 'log:oak', IRON = 'metal:iron';

const entry = (o) => ({ kind: 'court', open: true, fill: false, pay: 0, ends: T + DAY, name: 'x', words: 'x', card: () => null, ...o });

test('BOARD-SIFT the sift: a kind, every word of a search, what can be filled; the open before the done, then ending soonest, most silver or A to Z, ties as they came; a page of WORK_SHOWN and the count of every match (mutants: one word enough; the done mixed in; the ties reordered; the page uncut)', () => {
  assert.deepEqual([WORK_KINDS, WORK_SORTS, WORK_SHOWN], [['court', 'chapter', 'guild', 'contract', 'commission'], ['ending', 'pay', 'name'], 40]);
  assert.deepEqual(freshSift(), { kind: 'all', find: '', fill: false, sort: 'ending', shown: 40 });
  assert.equal(wordsOf('Oak Logs', null, 'The Silver Hand', undefined), 'oak logs the silver hand');
  const es = [
    entry({ name: 'Iron Ore', words: 'iron ore', pay: 30, ends: T + 3 * DAY }),
    entry({ name: 'Oak Logs', words: 'oak logs the hound', kind: 'guild', pay: 840, ends: T + 5 * DAY, fill: true }),
    entry({ name: 'Oak Logs', words: 'oak logs', open: false, pay: 999, ends: T + 1 }),
    entry({ name: 'Mithril Longsword', words: 'mithril longsword silas', kind: 'commission', pay: 900, ends: T + 2 * DAY, fill: true }),
    entry({ name: 'Ash Logs', words: 'ash logs', pay: 30, ends: T + 3 * DAY }),
  ];
  const names = (sift) => siftWork(es, { ...freshSift(), ...sift }).rows.map((e) => `${e.name}${e.open ? '' : ' (done)'}`);
  assert.deepEqual(names({}), ['Mithril Longsword', 'Iron Ore', 'Ash Logs', 'Oak Logs', 'Oak Logs (done)'], 'ending soonest, the done last, a tie as it came');
  assert.deepEqual(names({ sort: 'pay' }), ['Mithril Longsword', 'Oak Logs', 'Iron Ore', 'Ash Logs', 'Oak Logs (done)'], 'the done last, whatever it pays');
  assert.deepEqual(names({ sort: 'name' }), ['Ash Logs', 'Iron Ore', 'Mithril Longsword', 'Oak Logs', 'Oak Logs (done)']);
  assert.deepEqual(names({ kind: 'guild' }), ['Oak Logs']);
  assert.deepEqual(names({ kind: 'nonsense' }).length, 5, 'a kind it does not know: all');
  assert.deepEqual(names({ fill: true }), ['Mithril Longsword', 'Oak Logs']);
  assert.deepEqual(names({ find: '  OAK  hound ' }), ['Oak Logs'], 'every word');
  assert.deepEqual(names({ find: 'logs' }), ['Ash Logs', 'Oak Logs', 'Oak Logs (done)']);
  const many = Array.from({ length: 95 }, (_, i) => entry({ name: `w${i}` }));
  assert.deepEqual([siftWork(many, freshSift()).rows.length, siftWork(many, freshSift()).matched, siftWork(many, { ...freshSift(), shown: 80 }).rows.length], [40, 95, 80]);
  assert.deepEqual([...kindCounts(es)], [['court', 3], ['chapter', 0], ['guild', 1], ['contract', 0], ['commission', 1]]);
});

/** A board whose Work tab holds `writs` (the Court's), `guildWrits` and `commissions`, read as a reader holding 50 Oak. */
function workBoard({ writs = [], guildWrits = [], commissions = [], chapters = [], state = { open: true, writs: { today: 0, max: 3 } } } = {}) {
  const data = { writs, today: { filled: state.writs.today, max: 3 }, chapters, merit: [], guildWrits, commissions, contracts: [], yours: { commissions: [], guildWrits: [] },
    guild: null, balance: 0, writsOpen: true, me: 'Merra' };
  const profBook = { state, held: (k) => (k === OAK ? 50 : 0), writs: async () => ({ data, error: null, stale: false }), forgetWrits() {} };
  const writBook = { busy: false, state: { workDrafts: null }, settle: async () => ({ ok: true, settled: 0 }) };
  const host = document.createElement('div');
  document.body.append(host);
  const v = mountNoticeBoard(host, {
    town: { name: 'Daggerfall', mapId: 5 },
    book: { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen() {}, cached: () => null,
      draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }) },
    work: { book: profBook, region: DF, regionName: 'Daggerfall', countName: (k, n) => materialCountLabel(k, n), writs: writBook, regionNameOf: () => 'Daggerfall', pieces: () => [], settle: () => writBook.settle() },
    nowS: () => T,
  });
  return { host, v, profBook };
}
const openWork = async (host) => { await ticks(); byClass(host, 'notice-tab')[1].click(); await ticks(); };
const sel = (host, key) => host.querySelectorAll('select, input').find((n) => n.getAttribute('data-focus') === key);
const choose = (n, value) => { n.value = value; n.onchange(); };
const kinds = (host) => byClass(byClass(host, 'notice-grid')[0], 'writ-kind').map((n) => n.textContent);
const court = (id, material, qty, pay, ends = T + DAY, state = 'open') => ({ id, kind: 'court', material, qty, pay, renown: 5, expiresAt: ends, state });
const gwrit = (id, ends, left = 100, material = OAK) => ({ id, kind: 'guild', guild: { id: 'g2', name: 'The Hound', tag: 'HND' }, region: DF, material, units: 200, left, pay: 3, escrow: 600,
  at: 0, expiresAt: ends, state: 'open', mine: false, may: false, room: 500 });

test('BOARD-SIFT the Work tab: the bar over the grid - the kinds with their counts, the search, "Only what I can fill", the order and how many show; each sifts the grid; the chapters after the work under their own head (mutants: the bar unwired; the fill law not the Take\'s; the chapters back over the writs)', async () => {
  const r = workBoard({
    writs: [court('C1', IRON, 10, 40), court('C2', OAK, 20, 30), court('C3', OAK, 80, 90), court('C4', OAK, 5, 10, T + DAY, 'taken')],
    guildWrits: [gwrit('W1', T + 2 * DAY), gwrit('W2', T + 3 * DAY, 10, IRON)],
    chapters: [{ faction: 41, strength: 75, band: 'thriving' }],
  });
  await openWork(r.host);
  const cork = byClass(r.host, 'notice-cork')[0];
  const bar = byClass(r.host, 'work-sift')[0];
  assert.ok(bar, 'the bar');
  assert.ok(cork.children.indexOf(bar) < cork.children.indexOf(byClass(r.host, 'notice-grid')[0]), 'over the grid');
  assert.deepEqual(sel(r.host, 'worksift|kind').children.map((o) => o.textContent), ['All work (6)', 'Court writs (4)', 'Guild writs (2)'], 'a kind with none is not offered');
  assert.equal(byClass(r.host, 'work-sift-count')[0].textContent, 'Showing 6 of 6');
  assert.deepEqual(kinds(r.host), ['Court writ', 'Court writ', 'Court writ', 'Guild writ', 'Guild writ', 'Court writ'], 'the open ending soonest, the taken last');
  choose(sel(r.host, 'worksift|kind'), 'guild');
  assert.deepEqual(kinds(r.host), ['Guild writ', 'Guild writ']);
  choose(sel(r.host, 'worksift|kind'), 'all');
  // Only what I can fill: C2 (20 Oak of the 50 held) and W1 - never C1 nor W2 (no iron held), C3 (80 of 50) nor the taken C4
  const fill = sel(r.host, 'worksift|fill');
  fill.checked = true; fill.onchange();
  assert.deepEqual(byClass(byClass(r.host, 'notice-grid')[0], 'writ-need').map((n) => n.textContent), ['The Court of Daggerfall needs 20 Oak Logs', 'The Hound [HND] needs 100 more Oak Logs']);
  assert.equal(byClass(r.host, 'work-sift-count')[0].textContent, 'Showing 2 of 2');
  const f2 = sel(r.host, 'worksift|fill');
  f2.checked = false; f2.onchange();
  choose(sel(r.host, 'worksift|sort'), 'pay');
  assert.deepEqual(byClass(byClass(r.host, 'notice-grid')[0], 'writ-pay').map((n) => n.textContent.split(',')[0]).slice(0, 5),
    ['Pays 3 silver each - 100 / 200 delivered', 'Pays 90 silver', 'Pays 40 silver', 'Pays 30 silver', 'Pays 3 silver each - 190 / 200 delivered'],
    'the guild writ\'s 300 silver first; its other 30 after the Court\'s 30, a tie as it came');
  const find = sel(r.host, 'worksift|find');
  find.value = 'iron court'; find.oninput();
  await rest(200);
  assert.deepEqual(byClass(byClass(r.host, 'notice-grid')[0], 'writ-need').map((n) => n.textContent), ['The Court of Daggerfall needs 10 Iron'],
    'every word: the Court\'s iron, never the Hound\'s');
  // nothing matches: said, and all the work shown again on a press (the order kept)
  const f3 = sel(r.host, 'worksift|find');
  f3.value = 'mithril'; f3.oninput();
  await rest(200);
  const none = byClass(r.host, 'work-sift-none')[0];
  assert.match(none.textContent, /^No work matches\.Show all work$/);
  byClass(none, 'notice-retry')[0].click();
  assert.deepEqual([kinds(r.host).length, r.profBook.state.workSift.sort, r.profBook.state.workSift.find], [6, 'pay', '']);
  // the chapters after the work, under their head
  const head = byClass(r.host, 'notice-section').find((h) => h.textContent === 'Chapters in Daggerfall');
  const c2 = byClass(r.host, 'notice-cork')[0];
  assert.ok(head && c2.children.indexOf(head) > c2.children.indexOf(byClass(r.host, 'notice-grid')[0]), 'after the grid');
  assert.ok(c2.children.indexOf(byClass(r.host, 'notice-chapter-card')[0]) > c2.children.indexOf(head));
  r.v.unmount();
});

test('BOARD-SIFT the Work tab draws a page of the work at a time - "Show 40 more" under the last - and the sift is the book\'s for the session: a board opened again opens on it (mutants: every card drawn; the sift the window\'s own)', async () => {
  const writs = Array.from({ length: 95 }, (_, i) => court(`C${i}`, OAK, 5, 10 + i, T + DAY + i));
  const state = { open: true, writs: { today: 0, max: 3 } };
  const r = workBoard({ writs, state });
  await openWork(r.host);
  assert.equal(byClass(byClass(r.host, 'notice-grid')[0], 'notice-writ').length, 40);
  const more = () => byClass(r.host, 'work-sift-more')[0];
  assert.equal(more().textContent, 'Show 40 more');
  more().click();
  assert.equal(byClass(byClass(r.host, 'notice-grid')[0], 'notice-writ').length, 80);
  assert.equal(more().textContent, 'Show 15 more');
  more().click();
  assert.equal(byClass(byClass(r.host, 'notice-grid')[0], 'notice-writ').length, 95);
  assert.equal(more(), undefined);
  choose(sel(r.host, 'worksift|sort'), 'pay');
  assert.equal(byClass(byClass(r.host, 'notice-grid')[0], 'notice-writ').length, 40, 'a change: the first page of it');
  r.v.unmount();
  const again = workBoard({ writs, state });
  await openWork(again.host);
  assert.equal(sel(again.host, 'worksift|sort').children.find((o) => o.selected)?.value, 'pay', 'the order kept');
  assert.equal(byClass(byClass(again.host, 'notice-grid')[0], 'writ-pay')[0].textContent.split(',')[0], 'Pays 104 silver');
  again.v.unmount();
});

/** The Market tab over a book that answers `answer(view, q)`, every read's q kept. */
function marketRig(answer) {
  const asked = [];
  const book = { state: { open: true, balance: 50, road: [], counts: {} }, pending: 0, cached: () => null, fresh: () => false,
    read: async (view, q) => { asked.push({ view, ...q }); return { ok: true, data: answer(view, q) }; }, settle: async () => ({ ok: true, settled: 0 }) };
  const m = { book, stores: () => new Map(), region: DF, regionName: 'Daggerfall', regionNameOf: () => 'Wayrest', hubs: {},
    name: (k) => k, countName: (k) => k, pieces: () => [], take: () => true, putBack: () => {}, mint: () => {}, pieceName: (p) => p.name,
    weavers: [], stock: async () => ({ ok: true }) };
  let root = null;
  const draw = () => { root?.remove?.(); root = tab.body(); document.body.append(root); };
  const tab = createMarketTab(m, { busy: () => false, run: async (start) => start(), rerender: () => draw(), nowS: () => 0, alive: () => true });
  return { tab, asked, root: () => root };
}
const pieceRows = (page, n, price = (i) => i + 1) => Array.from({ length: n }, (_, i) => ({ id: `p${page}-${i}`, kind: 'piece', region: i % 2 ? DF : 23, price: price(i), units: 1,
  road: { courier: 0, seconds: 60, road: 400 }, piece: { name: `piece ${i}`, quality: 2, wear: 1000 }, currency: 'marks' }));

test('BOARD-SIFT the Market: a paged view\'s pages under its rows - "Page 1 of 3 · 250 in all", Previous and Next - a turn reads that page; one page, no pager; a read asks only what is not a default (mutants: the page never sent; Next past the last; the pager on one page; a default sent)', async () => {
  const r = marketRig((view, q) => (view === 'crafted' ? { rows: pieceRows(q.page ?? 0, q.page === 2 ? 50 : 100), page: q.page ?? 0, total: 250 } : { rows: [], medians: {} }));
  await r.tab.open();
  byClass(r.root(), 'market-view').find((b) => b.textContent === 'Crafted').click();
  await ticks();
  assert.deepEqual(r.asked.at(-1), { view: 'crafted', region: DF, hubs: {}, family: null }, 'the first page, its own order: nothing more asked');
  const pager = () => byClass(r.root(), 'market-pager')[0];
  assert.equal(byClass(pager(), 'market-pageof')[0].textContent, 'Page 1 of 3 · 250 in all');
  assert.deepEqual(byClass(pager(), 'market-page').map((b) => [b.textContent, b.disabled]), [['Previous', true], ['Next', false]]);
  byClass(pager(), 'market-next')[0].click();
  await ticks();
  assert.equal(r.asked.at(-1).page, 1);
  assert.equal(byClass(pager(), 'market-pageof')[0].textContent, 'Page 2 of 3 · 250 in all');
  byClass(pager(), 'market-next')[0].click();
  await ticks();
  assert.deepEqual(byClass(pager(), 'market-page').map((b) => b.disabled), [false, true], 'the last page: no Next');
  byClass(pager(), 'market-prev')[0].click();
  await ticks();
  assert.equal(r.asked.at(-1).page, 1);
  const one = marketRig((view) => (view === 'goods' ? { rows: pieceRows(0, 3), page: 0, total: 3 } : { rows: [], medians: {} }));
  await one.tab.open();
  byClass(one.root(), 'market-view').find((b) => b.textContent === 'Goods').click();
  await ticks();
  assert.equal(byClass(one.root(), 'market-pager').length, 0, 'one page: no pager');
});

test('BOARD-SIFT the Market\'s Crafted controls: a search by name read once the typing rests, a least quality, an order - each from the first page; the cheapest order sorts by the landed price, any other keeps the service\'s (mutants: the search unsent; the page kept through a filter; the landed sort over every order)', async () => {
  const r = marketRig((view, q) => (view === 'crafted' ? { rows: pieceRows(q.page ?? 0, 4, (i) => [5, 1, 9, 3][i]), page: q.page ?? 0, total: 400 } : { rows: [], medians: {} }));
  await r.tab.open();
  byClass(r.root(), 'market-view').find((b) => b.textContent === 'Crafted').click();
  await ticks();
  byClass(r.root(), 'market-next')[0].click();
  await ticks();
  assert.equal(r.asked.at(-1).page, 1);
  const prices = () => byClass(r.root(), 'market-row').map((b) => byClass(b, 'market-price')[0].textContent);
  // the cheapest order: landed - the rows here (odd) cost nothing to carry, the rest a courier on top
  assert.deepEqual(prices(), ['1 silver', '3 silver', '5 silver', '9 silver']);
  const find = r.root().querySelectorAll('input').find((n) => n.getAttribute('data-focus') === 'find|crafted');
  assert.equal(find.getAttribute('aria-label'), 'Search the pieces by name');
  find.value = 'Mithril'; find.oninput();
  await rest(350);
  assert.deepEqual([r.asked.at(-1).query, r.asked.at(-1).page], ['mithril', undefined], 'the search, from the first page');
  const selects = () => r.root().querySelectorAll('select');
  const quality = selects().find((s) => s.getAttribute('aria-label') === 'Least quality');
  assert.deepEqual(quality.children.map((o) => o.textContent), ['Any quality', 'Standard or better', 'Fine or better', 'Superior or better', 'Masterwork']);
  choose(quality, '3');
  await ticks();
  assert.deepEqual([r.asked.at(-1).quality, r.asked.at(-1).query], [3, 'mithril']);
  const order = selects().find((s) => s.getAttribute('aria-label') === 'Order');
  assert.deepEqual(order.children.map((o) => o.textContent), ['Cheapest first', 'Dearest first', 'Newest first', 'Best quality first']);
  choose(order, 'dear');
  await ticks();
  assert.equal(r.asked.at(-1).sort, 'dear');
  assert.deepEqual(prices(), ['5 silver', '1 silver', '9 silver', '3 silver'], 'the service\'s own order');
  // a view of its own: its filters let go
  byClass(r.root(), 'market-view').find((b) => b.textContent === 'Auctions').click();
  await ticks();
  assert.deepEqual(Object.keys(r.asked.at(-1)).filter((k) => ['page', 'sort', 'query', 'quality'].includes(k)), []);
  assert.deepEqual(r.root().querySelectorAll('select').find((s) => s.getAttribute('aria-label') === 'Order').children.map((o) => o.textContent),
    ['Ending soonest', 'Cheapest first', 'Dearest first', 'Newest first']);
});
