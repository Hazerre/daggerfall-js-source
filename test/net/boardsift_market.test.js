// BOARD-SIFT (2026-10-21, feature-feedback: "The notice board market also doesnt show everything if there are too many
// weapons/armor/etc listed it stops after a certain number"): THE MARKET'S VIEWS OF PIECES AND ORDERS TURN PAGES - a
// view showed its first MARKET_SHOWN rows and nothing past them - every filter in the query so a page is a page; Crafted,
// Goods and Auctions read in the order asked; Crafted and Auctions searched by the pieces' names, Crafted by its least
// quality (net/marketLaw.js, server-account/src/market.js marketRead, net/marketBook.js keyOf). The record:
// bible/06-Systems/Professions-Arc.md 10.13.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from '../accountDb.mjs';
import { recipeById } from '../../src/net/recipeLaw.js';
import {
  MARKET_SHOWN, MARKET_PAGED_VIEWS, MARKET_PAGES_MAX, MARKET_SORTS, MARKET_QUERY_MAX, marketPageOf, marketSortOf, marketQueryOf, marketQualityOf, recipesNamed,
} from '../../src/net/marketLaw.js';
import { createMarketBook } from '../../src/net/marketBook.js';

test('BOARD-SIFT the law: the paged views, a page in range or the first, a view\'s orders its own first, a search trimmed and lower-cased, a least quality 1 to Masterwork, and a search\'s recipes - each of its words in the name, of the families asked (mutants: a page past the last kept; an unknown order kept; one word enough; the families ignored)', () => {
  assert.deepEqual(MARKET_PAGED_VIEWS, ['crafted', 'goods', 'auctions', 'orders']);
  assert.equal(MARKET_PAGES_MAX, 50);
  assert.deepEqual([0, 1, 49, 50, -1, 1.5, '2', null, undefined, NaN].map(marketPageOf), [0, 1, 49, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(MARKET_SORTS, { crafted: ['cheap', 'dear', 'new', 'quality'], goods: ['cheap', 'dear', 'new'], auctions: ['ending', 'cheap', 'dear', 'new'] });
  assert.deepEqual([marketSortOf('crafted', 'quality'), marketSortOf('crafted', 'ending'), marketSortOf('goods', 'quality'), marketSortOf('auctions', 'cheap'),
    marketSortOf('auctions', null), marketSortOf('materials', 'cheap'), marketSortOf('__proto__', 'cheap'), marketSortOf('crafted', ['cheap'])],
  ['quality', 'cheap', 'cheap', 'cheap', 'ending', null, null, 'cheap']);
  assert.deepEqual([marketQueryOf('  Mithril SWORD '), marketQueryOf(42), marketQueryOf(null), marketQueryOf('x'.repeat(60)).length], ['mithril sword', '', '', MARKET_QUERY_MAX]);
  assert.deepEqual([0, 1, 4, 5, -1, 2.5, '3'].map(marketQualityOf), [0, 1, 4, 0, 0, 0, 0]);
  assert.deepEqual(recipesNamed('mithril dagger'), ['dagger:mithril']);
  assert.deepEqual(recipesNamed('Mithril  SWORD ', ['weapons']), ['shortsword:mithril', 'broadsword:mithril', 'longsword:mithril']);
  assert.deepEqual(recipesNamed('dagger', ['armour']), [], 'of the families asked');
  assert.equal(recipesNamed('', ['kits']).length, 10, 'no words: the families whole');
});

/** A service over many listings of pieces, goods, auctions and orders, read as `who`. */
async function marketOf() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const buyer = await s.registered('Buyer'), db = s.env.DB._raw;
  for (let i = 0; i < 40; i++) db.prepare('INSERT INTO players(id,handle,handle_lc,guest_name,created_at,last_seen) VALUES(?,?,?,?,?,?)').run(`s${i}`, `Seller${i}`, `seller${i}`, 'Fixture', T0, T0);
  const pv = (i) => i.toString(16).padStart(16, '0');
  const product = db.prepare('INSERT INTO products(provenance,owner,char_id,maker,recipe,template,material,quality,seed,record,made_at,listed) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)');
  const listing = db.prepare("INSERT INTO market_listings(id,seller,char_id,region,kind,provenance,units,own,price,wear,fee,at,expires_at,rid,n) VALUES(?,?,?,17,'piece',?,1,1,?,1000,1,?,?,?,'')");
  const auction = db.prepare("INSERT INTO market_auctions(id,seller,char_id,region,provenance,wear,opening,fee,at,ends_at,rid,n) VALUES(?,?,?,17,?,1000,?,1,?,?,?,'')");
  const good = db.prepare("INSERT INTO market_listings(id,seller,char_id,region,kind,item,units,own,price,fee,at,expires_at,rid,n,currency) VALUES(?,?,?,17,'item',?,1,1,?,1,?,?,?,'','gold')");
  const order = db.prepare("INSERT INTO market_orders(id,poster,char_id,region,material,units,left_units,price,escrow,at,expires_at,rid,n) VALUES(?,?,?,17,'ore:iron',5,5,?,5,?,?,?,'')");
  const piece = (i, recipe, quality) => {
    const seller = `s${i % 40}`, r = recipeById(recipe);
    product.run(pv(i), seller, `c${seller}`, 'Fixture', recipe, r.templateIndex, r.material ?? 0, quality, 4242, 'p1.x', T0);
    return seller;
  };
  // 230 Crafted listings: 200 Mithril Longswords priced 1..200 (quality i % 5, listed at T0 - i), 30 Iron Cuirasses at 500+
  for (let i = 0; i < 230; i++) {
    const seller = piece(i, i < 200 ? 'longsword:mithril' : 'cuirass:iron', i % 5);
    listing.run(`p${String(i).padStart(3, '0')}`, seller, `c${seller}`, pv(i), i < 200 ? i + 1 : 500 + i, T0 - i, T0 + 86400, `r${i}`);
  }
  // 130 auctions of Masterworks: opening 1..130, ending in order; 120 Goods (115 swords, 5 rings) and one broken record
  for (let i = 0; i < 130; i++) {
    const seller = piece(1000 + i, i < 120 ? 'longsword:mithril' : 'dagger:mithril', 4);
    auction.run(`a${String(i).padStart(3, '0')}`, seller, `c${seller}`, pv(1000 + i), 131 - i, T0 - i, T0 + 3600 + i, `ra${i}`);
  }
  for (let i = 0; i < 120; i++) {
    const seller = `s${i % 40}`;
    good.run(`g${String(i).padStart(3, '0')}`, seller, `c${seller}`, JSON.stringify({ group: i < 115 ? 'Weapons' : 'Jewellery', templateIndex: 1, stackCount: 1 }), 10 + i, T0 - i, T0 + 86400, `rg${i}`);
  }
  good.run('gbad', 's0', 'cs0', '{broken', 1, T0, T0 + 86400, 'rgbad');
  for (let i = 0; i < 105; i++) order.run(`o${String(i).padStart(3, '0')}`, `s${i % 40}`, `cs${i % 40}`, 300 - i, T0 - i, T0 + 86400, `ro${i}`);
  const read = async (view, extra = {}) => {
    const r = await s.call('/v1/market/read', { character: buyer.character, region: 17, view, hubs: { 17: [207, 212] }, ...extra }, buyer.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  return { s, db, read };
}

test('BOARD-SIFT Crafted: a page of MARKET_SHOWN at a time and the whole count, the pages apart and together every listing; the order asked (dearest, newest, best quality), a search\'s recipes and the least quality read in the query - its count theirs; a page past the last its first (mutants: no offset; the count of every listing; an order ignored; the search after the cutoff; the quality ignored)', async () => {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  try {
    const { read } = await marketOf();
    const ids = (b) => b.rows.map((r) => r.id);
    const p0 = await read('crafted');
    assert.deepEqual([p0.page, p0.total, p0.rows.length], [0, 230, MARKET_SHOWN]);
    assert.deepEqual(ids(p0), Array.from({ length: 100 }, (_, i) => `p${String(i).padStart(3, '0')}`), 'the cheapest first');
    const p1 = await read('crafted', { page: 1 }), p2 = await read('crafted', { page: 2 });
    assert.deepEqual([p1.page, p1.rows.length, ids(p1)[0], p2.page, p2.rows.length], [1, 100, 'p100', 2, 30]);
    const all = [...ids(p0), ...ids(p1), ...ids(p2)];
    assert.equal(new Set(all).size, 230, 'every listing on one page, none on two');
    assert.ok(p2.rows.every((r) => r.road), 'each row its courier');
    assert.deepEqual(ids(await read('crafted', { page: MARKET_PAGES_MAX })), ids(p0), 'a page past the last: the first');
    assert.equal((await read('crafted', { sort: 'dear' })).rows[0].id, 'p229');
    assert.equal((await read('crafted', { sort: 'new' })).rows[0].id, 'p000', 'listed last of all at T0');
    const best = await read('crafted', { sort: 'quality' });
    assert.deepEqual(best.rows.map((r) => r.piece.quality).slice(0, 47), [...Array(46).fill(4), 3], 'the 46 Masterworks before the rest');
    assert.equal(best.rows[0].id, 'p004', 'and the cheapest of them first');
    assert.deepEqual(ids(await read('crafted', { sort: 'nonsense' })), ids(p0), 'an order it does not offer: its own');
    const cuirass = await read('crafted', { query: 'Iron CUIRASS' });
    assert.deepEqual([cuirass.total, cuirass.rows.length, cuirass.rows.every((r) => r.piece.recipe === 'cuirass:iron')], [30, 30, true], 'thirty, past two hundred cheaper swords');
    assert.deepEqual([(await read('crafted', { query: 'mithril', family: 'armour' })).total, (await read('crafted', { query: 'zzz' })).total], [0, 0]);
    const fine = await read('crafted', { quality: 3 });
    assert.equal(fine.total, 92, 'Superior or better: 2 in 5 of them');
    assert.ok(fine.rows.every((r) => r.piece.quality >= 3));
    assert.equal((await read('crafted', { quality: 9 })).total, 230, 'a quality it does not know: any');
  } finally { Date.now = realNow; }
});

test('BOARD-SIFT Goods, Auctions and Orders: each a page at a time with its count - a broken record counted nowhere; Goods dearest first, Auctions cheapest standing first and searched by name; the views that are not paged answer no page (mutants: goods\' broken record counted; an auction\'s order ignored; the orders unpaged)', async () => {
  const realNow = Date.now;
  Date.now = () => T0 * 1000;
  try {
    const { read } = await marketOf();
    const goods = await read('goods'), goods1 = await read('goods', { page: 1 });
    assert.deepEqual([goods.total, goods.rows.length, goods1.rows.length, goods.rows[0].id], [120, 100, 20, 'g000'], 'the broken record nowhere');
    assert.equal((await read('goods', { sort: 'dear' })).rows[0].id, 'g119');
    assert.deepEqual([(await read('goods', { family: 'jewellery' })).total, (await read('goods', { family: 'weapons', page: 1 })).rows.length], [5, 15]);
    const auctions = await read('auctions');
    assert.deepEqual([auctions.total, auctions.rows.length, auctions.rows[0].id, (await read('auctions', { page: 1 })).rows.length], [130, 100, 'a000', 30], 'ending soonest first');
    assert.equal((await read('auctions', { sort: 'cheap' })).rows[0].id, 'a129', 'the lowest opening');
    assert.equal((await read('auctions', { sort: 'new' })).rows[0].id, 'a000');
    const daggers = await read('auctions', { query: 'dagger' });
    assert.deepEqual([daggers.total, daggers.rows.map((r) => r.id)], [10, Array.from({ length: 10 }, (_, i) => `a${120 + i}`)]);
    const orders = await read('orders'), orders1 = await read('orders', { page: 1 });
    assert.deepEqual([orders.total, orders.orders.length, orders1.orders.length, orders.orders[0].id, orders1.orders[0].id], [105, 100, 5, 'o000', 'o100'], 'dearest first, a page at a time');
    const mats = await read('materials', { page: 3 });
    assert.deepEqual(['page' in mats, 'total' in mats], [false, false], 'Materials is not paged');
  } finally { Date.now = realNow; }
});

test('BOARD-SIFT the book: a page, an order, a search and a least quality each its own minute\'s read - page 1 never answered from page 0\'s (mutant: the key without them)', async () => {
  const asked = [];
  const door = { read: async (req) => { asked.push(req); return { ok: true, status: 200, data: { ok: true, rows: [], page: req.page ?? 0 } }; } };
  const book = createMarketBook({ door, character: () => 'c1', now: () => 1000 });
  const base = { region: 17, hubs: {} };
  for (const q of [{}, { page: 1 }, { sort: 'dear' }, { query: 'iron' }, { quality: 2 }]) await book.read('crafted', { ...base, ...q });
  assert.equal(asked.length, 5, 'five reads, five asks');
  await book.read('crafted', { ...base, page: 1 });
  assert.equal(asked.length, 5, 'the same page again: the minute\'s');
  assert.equal(book.cached('crafted', { ...base, page: 1 })?.page, 1);
});
