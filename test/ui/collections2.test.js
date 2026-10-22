// COLLECTIONS-II (2026-10-22, the owner: "with the introduction of a lot of titles, auras, profile icons, etc I think its
// time we introduce these elements to the collections tab, along with telling how they are found, even if they arent
// currently able to be obtained"; bible/10-UI/Collections.md): THE WARDROBE IN THE COLLECTIONS PAGE. The catalogue whole
// (every title, aura, icon and glyph of the vocabulary, a source, an availability and the words of how) and held to the
// service's own law (the lists and what they grant, the rolls' odds, the Redoubts, the switches in its config); held,
// worn and counted off the wardrobe the service mints; the seasons off the festival's dates; the page driven - its tiles,
// the account's line, the filters, a row opened whole, Wear through the flow, a "comes with" press, the read begun after
// the draw and let go on leaving; the kit's roles; the account card's note naming a title.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { TITLES, AURAS, ICONS, GLYPHS, SEAT_TITLES, CHAPTER_TITLES } from '../../src/net/identityToken.js';
import * as W from '../../src/ui/collections/wardrobeCatalogue.js';
import { drawWardrobePart, wardrobeFilterPasses, resetWardrobePart, WARDROBE_PART_CSS, auraRingNode } from '../../src/ui/collections/wardrobePart.js';
import { drawCollectionsPage, resetCollectionsPage, setCollectionsPart, disarmCollectionsPage, partCount, collectionParts, WARDROBE_PARTS } from '../../src/ui/collectionsPage.js';
import { FRAME_ROLES } from '../../src/ui/enhanced/enhancedFrame.js';
import { INSIGNIA } from '../../src/net/insignia.js';
import { FESTIVALS, FESTIVAL_WARES, FESTIVAL_ICONS, HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN } from '../../src/net/festivalLaw.js';
import { QL_TITLES } from '../../src/net/questlineClaims.js';
import { TIER_LISTS, TIER_GLYPH, TIER_AURA, DEVELOPER_AURA, HOURS_FIRST_AURA, wardrobeOf } from '../../server-account/src/titles.js';
import { PATREON_TITLES } from '../../server-account/src/patreon.js';
import { SD_TITLE_CHANCE, SD_AURA_CHANCE } from '../../server-account/src/sds.js';
import { SERPENT_TITLE_CHANCE, SERPENT_AURA_CHANCE } from '../../server-account/src/serpents.js';
import { EG_HONOUR_TITLES, EG_HONOUR_AURA, EG_REDOUBT_HONOURS, EG_UNFALLEN_REDOUBT, EG_CHAMPION_TITLE, EG_FIRST_TITLE, EG_FIRST_AURA, EG_CHAMPIONS_TOP } from '../../server-account/src/egHonours.js';
import { giveBinder } from '../../src/systems/iliac/iliacItems.js';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const WRANGLER = read('server-account/wrangler.toml');
/** A `KEY = "value"` line of the service's config. */
const configOf = (key) => WRANGLER.match(new RegExp(`^${key} = "([^"]*)"`, 'm'))?.[1] ?? null;
const FESTIVAL = FESTIVALS[0];
const DURING = FESTIVAL.fromMs + 86_400_000;
const AFTER = FESTIVAL.toMs + 86_400_000;

function fakeEl(tag) {
  const classes = new Set();
  const n = {
    tag, children: [], attrs: {}, dataset: {}, style: {}, title: '', type: '', disabled: false,
    get className() { return [...classes].join(' '); }, set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    classList: { contains: (c) => classes.has(c) },
    _text: '', get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); }, set textContent(v) { n._text = String(v ?? ''); },
    append(...cs) { for (const c of cs) n.children.push(c); },
    setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute(k) { return n.attrs[k] ?? null; },
  };
  return n;
}
const el = (t, cls, text) => { const n = fakeEl(t); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
/** A document that makes SVG (the fake's elements), so the pictures are drawn. */
const doc = { createElementNS: (_ns, tag) => fakeEl(tag) };
const all = (root, f) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (f(c)) out.push(c); walk(c); } }; walk(root); return out; };
const cls = (root, c) => all(root, (x) => x.classList?.contains(c));
const focus = (root, key) => all(root, (x) => x.attrs?.['data-focus'] === key)[0];
const rowOf = (root, kind, key) => all(root, (x) => x.dataset?.wardrobe === `${kind}:${key}`)[0];

/** A flow as accountFlow.js's is, as far as the page reads one: its stage, its wardrobe, its words and its presses. */
function fakeFlow(wardrobe, extra = {}) {
  const asked = [];
  const flow = { stage: 'in', busy: false, error: '', note: '', wardrobe, started: 0, asked, start() { flow.started++; }, ...extra };
  for (const p of ['equip', 'wearAura', 'wearIcon', 'toggleGlyph']) flow[p] = (k) => { asked.push([p, k]); return Promise.resolve(true); };
  return flow;
}
/** The Collections page, driven: drawn into a fresh root on every repaint, as the menu's render does. */
function page({ flow = null, player = { items: [] }, now = DURING } = {}) {
  const box = { root: null, draws: 0 };
  const draw = () => {
    box.draws++;
    box.root = el('div');
    drawCollectionsPage(box.root, draw, { el, divider: (t) => el('h4', 'px-divider', t), player, doc, now: () => now, ...(flow ? { account: () => flow } : {}) });
  };
  box.draw = draw;
  draw();
  return box;
}

/** The row a registered founder from before the date minted, who bought the Broker's two pieces and the festival's Twin
 *  Moons, broke a Remnant for both its grants, and hid the sprout - read through the service's own wardrobeOf. */
function mintedWardrobe() {
  const nowS = Math.floor(DURING / 1000);
  const player = {
    handle: 'aelwyn', registered_at: 1_790_000_000, created_at: nowS - 3600, insignia: 'title:gatebreaker aura:dagonfire',
    sd_honours: 3, fest_wares: 'icon:twinmoons', title: 'gatebreaker', aura: 'dagonfire', icon: 'twinmoons', glyphs_off: 'sprout',
  };
  return wardrobeOf(player, {}, nowS);
}

// ── THE CATALOGUE ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('COLLECTIONS-II THE CATALOGUE IS WHOLE: every title, aura, icon and glyph of the vocabulary has one entry and none else - a source of the page\'s list, an availability of the law\'s, words of how (every argument filled), an aura what it looks like, and High Master alone a `via` (Chapter Master\'s) (mutants: an entry dropped; a source not listed; how\'s argument left empty)', () => {
  const vocab = { title: TITLES, aura: AURAS, icon: ICONS, glyph: GLYPHS };
  const sources = W.WARDROBE_SOURCES.map(([id]) => id);
  for (const kind of W.WARDROBE_KINDS) {
    assert.deepEqual(Object.keys(W.WARDROBE[kind]).sort(), [...vocab[kind]].sort(), `${kind}: the vocabulary exactly`);
    assert.equal(W.wardrobeEntries(kind).length, vocab[kind].length, `${kind}: every one listed`);
    for (const e of W.wardrobeEntries(kind)) {
      assert.ok(sources.includes(e.src), `${kind}:${e.key} from a listed source`);
      assert.ok(W.WARDROBE_AVAIL.includes(e.avail) && e.avail !== 'offseason', `${kind}:${e.key} ${e.avail} - offseason is read, never written`);
      const how = e.how();
      assert.ok(typeof how === 'string' && how.length > 12, `${kind}:${e.key} says how`);
      assert.doesNotMatch(how, /\{|undefined|NaN|\b0 (Deadlands|Soul)/, `${kind}:${e.key}: its words filled - ${how}`);
      if (kind === 'aura') assert.ok(e.look?.().length > 12, `${e.key} says what it looks like`);
      assert.ok(W.AVAIL_TAG[e.avail] && W.availLine(e, DURING).length > 4);
    }
  }
  const vias = W.WARDROBE_KINDS.flatMap((k) => W.wardrobeEntries(k).filter((e) => e.via).map((e) => [k, e.key, e.via]));
  assert.deepEqual(vias, [['title', 'highmaster', 'chaptermaster']]);
  // the page lists the sources in their order, play's first, those no play earns last
  assert.deepEqual(sources.slice(-3), ['patrons', 'staff', 'bestowed']);
  assert.deepEqual(W.wardrobeEntries('title').map((e) => e.src).filter((s, i, a) => a.indexOf(s) === i), sources.filter((s) => W.wardrobeEntries('title').some((e) => e.src === s)), 'grouped, in the sources\' order');
});

test('COLLECTIONS-II THE CATALOGUE IS THE SERVICE\'S LAW SAID: the lists\' titles (the Patreon tiers a pledge, mapped or not yet; the Dungeon Master staff; the rest bestowed), what each grants beside it (TIER_GLYPH, TIER_AURA, the developers\' wings, the firsts\' auras, the Spire\'s two) and both ways, the rolls\' odds, the Redoubts, the Spire\'s champions, the questlines\' and the seats\', the Broker\'s and the Wyrd Sister\'s prices, the Hearth\'s counts - and the chapters\' titles dormant while the service\'s switch is off (mutants: a tier mapped and still dormant; an aura not granted with its title; the Remnant\'s odds; a Redoubt; the chapters said open)', () => {
  const entry = (kind, key) => W.wardrobeEntry(kind, key);
  const withs = (kind, key) => entry(kind, key)?.with ?? [];
  // the lists
  const mapped = (configOf('PATREON_TIERS') ?? '').split(',').map((p) => p.split(':')[1]).filter(Boolean);
  assert.ok(mapped.length >= 3, 'the config read');
  for (const t of Object.keys(TIER_LISTS)) {
    const e = entry('title', t);
    if (PATREON_TITLES.includes(t)) assert.deepEqual([e.src, e.avail], ['patrons', mapped.includes(t) ? 'patron' : 'dormant'], `${t}: a pledge's, ${mapped.includes(t) ? 'mapped' : 'no tier yet'}`);
    else if (t === 'dungeonmaster') assert.deepEqual([e.src, e.avail], ['staff', 'staff']);
    else assert.deepEqual([e.src, e.avail], ['bestowed', 'bestowed'], `${t}: one player's`);
    assert.ok(withs('title', t).includes(`glyph:${TIER_GLYPH[t]}`) && withs('glyph', TIER_GLYPH[t]).includes(`title:${t}`), `${t} and its glyph`);
    assert.equal(entry('glyph', TIER_GLYPH[t]).avail, entry('title', t).avail, `${t}'s glyph is had as it is`);
  }
  const pairs = [...Object.entries(TIER_AURA), ['developer', DEVELOPER_AURA], ['hoursfirst', HOURS_FIRST_AURA], [EG_FIRST_TITLE, EG_FIRST_AURA], ...Object.entries(EG_HONOUR_AURA)];
  for (const [t, a] of pairs) assert.ok(withs('title', t).includes(`aura:${a}`) && withs('aura', a).includes(`title:${t}`), `${t} grants ${a}, both ways`);
  for (const kind of W.WARDROBE_KINDS) for (const e of W.wardrobeEntries(kind)) for (const w of e.with ?? []) {
    const [k, key] = w.split(':');
    assert.ok(withs(k, key).includes(`${kind}:${e.key}`), `${kind}:${e.key} with ${w}, and back`);
  }
  assert.ok(withs('title', 'developer').includes('glyph:dev') && withs('title', 'arenachampion').includes('glyph:laurel'));
  // the rolls, the Redoubts, the champions
  assert.deepEqual([W.REMNANT_ODDS.hourbreaker, W.REMNANT_ODDS.turninghour], [1 / SD_TITLE_CHANCE, 1 / SD_AURA_CHANCE]);
  assert.deepEqual([W.SERPENT_ODDS.coilbreaker, W.SERPENT_ODDS.maelstrom], [1 / SERPENT_TITLE_CHANCE, 1 / SERPENT_AURA_CHANCE]);
  for (const [r, t] of EG_REDOUBT_HONOURS) assert.equal(W.REDOUBT_OF[t], r, `${t}: Redoubt ${r}`);
  assert.equal(W.REDOUBT_OF.unfallen, EG_UNFALLEN_REDOUBT);
  for (const [t, a] of Object.entries(EG_HONOUR_AURA)) assert.equal(W.REDOUBT_OF[a], W.REDOUBT_OF[t], `${a} comes with ${t}`);
  assert.equal(W.SPIRE_CHAMPIONS_TOP, EG_CHAMPIONS_TOP);
  for (const t of [...EG_HONOUR_TITLES, EG_CHAMPION_TITLE, EG_FIRST_TITLE]) assert.equal(entry('title', t).src, 'spire');
  assert.deepEqual([entry('title', EG_CHAMPION_TITLE).avail, entry('title', EG_FIRST_TITLE).avail, entry('title', 'hoursfirst').avail, entry('title', 'founder').avail], ['ranked', 'retired', 'retired', 'retired']);
  assert.match(entry('title', 'kynbane').how(), / 10 /);
  assert.match(entry('aura', 'turninghour').how(), /one in 8 /);
  // the questlines' and the seats'
  for (const t of QL_TITLES) { assert.equal(entry('title', t).src, 'questlines'); assert.ok(W.questlineOf(t), `${t}: its line`); }
  assert.equal(entry('title', 'starwarden').avail, 'seasonal', 'the Thirteenth of Frostfall is the festival\'s');
  for (const t of SEAT_TITLES) assert.equal(entry('title', t).src, 'seats');
  // the chapters': the service's switch
  const chaptersOn = configOf('CHAPTER_TITLES') === 'on';
  for (const t of CHAPTER_TITLES) assert.deepEqual([entry('title', t).src, entry('title', t).avail], ['chapters', chaptersOn ? 'open' : 'dormant'], `${t}: CHAPTER_TITLES is ${configOf('CHAPTER_TITLES')}`);
  // the prices and the counts, as said
  for (const o of INSIGNIA) { const e = entry(o.kind, o.key); assert.equal(e.src, 'broker'); assert.match(e.how(), new RegExp(`\\b${o.price} Deadlands Embers`)); }
  for (const w of FESTIVAL_WARES.filter((x) => ['title', 'aura', 'icon'].includes(x.kind))) { const e = entry(w.kind, w.key); assert.deepEqual([e.src, e.avail], ['festival', 'seasonal']); assert.match(e.how(), new RegExp(`\\b${w.price} Soul Cakes`)); }
  assert.deepEqual(FESTIVAL_ICONS.map((i) => entry('icon', i).src), FESTIVAL_ICONS.map(() => 'festival'));
  assert.match(entry('title', 'hearthkeeper').how(), new RegExp(`\\b${HEARTHKEEPER_GIVEN} Soul Cakes`));
  assert.match(entry('icon', 'soulcake').how(), new RegExp(`\\b${SOULCAKE_TAKEN} Soul Cakes`));
});

test('COLLECTIONS-II HELD, WORN AND COUNTED off the wardrobe the service mints (titles.js wardrobeOf): the founder, the bought, the rolled and the festival\'s held; the one title, aura and icon worn; a glyph taken off held and not shown; High Master held with Chapter Master and never worn or counted; no wardrobe holds nothing; a service too old to name a kind holds none of it (mutants: worn read off held; a hidden glyph shown; the via counted)', () => {
  const w = mintedWardrobe();
  assert.deepEqual(w.titles, ['founder', 'gatebreaker', 'hourbreaker'], 'the producer\'s own shape');
  for (const [k, key] of [['title', 'founder'], ['title', 'gatebreaker'], ['title', 'hourbreaker'], ['aura', 'dagonfire'], ['aura', 'turninghour'], ['icon', 'twinmoons'], ['glyph', 'sprout']]) assert.equal(W.wardrobeHeld(k, key, w), true, `${k}:${key} held`);
  assert.equal(W.wardrobeHeld('title', 'developer', w), false);
  assert.deepEqual(['title', 'aura', 'icon'].map((k) => W.WARDROBE_KINDS.includes(k) && W.wardrobeEntries(k).filter((e) => W.wardrobeWorn(k, e.key, w)).map((e) => e.key)), [['gatebreaker'], ['dagonfire'], ['twinmoons']], 'one worn a kind');
  assert.equal(W.wardrobeWorn('glyph', 'sprout', w), false, 'the sprout taken off');
  assert.equal(W.wardrobeWorn('glyph', 'sprout', { glyphs: ['sprout'] }), true, 'a glyph held and not taken off is shown');
  assert.deepEqual(W.wardrobeCount('title', w), { held: 3, total: TITLES.length - 1 });
  assert.deepEqual(W.wardrobeCount('aura', w), { held: 2, total: AURAS.length });
  const chap = { titles: ['chaptermaster'], title: 'chaptermaster' };
  assert.deepEqual([W.wardrobeHeld('title', 'highmaster', chap), W.wardrobeWorn('title', 'highmaster', chap), W.wardrobeCount('title', chap).held], [true, false, 1]);
  assert.deepEqual(W.wardrobeCount('glyph', null), { held: 0, total: GLYPHS.length });
  assert.equal(W.wardrobeHeld('icon', 'twinmoons', { titles: ['founder'] }), false, 'a wardrobe from before icons holds none');
});

test('COLLECTIONS-II THE SEASONS AND THE FILTERS: a festival\'s piece seasonal while one is open - its last day in words - and out of season after; Obtainable is what a player can act on now (never the retired, the bestowed, the staff\'s, the dormant or the out-of-season); Held and Not held split the list (mutants: seasonal never resolved; retired obtainable)', () => {
  const witch = { ...W.wardrobeEntry('aura', 'witchfire'), kind: 'aura', key: 'witchfire' };
  assert.equal(W.wardrobeAvail(witch, DURING), 'seasonal');
  assert.equal(W.wardrobeAvail(witch, AFTER), 'offseason');
  assert.equal(W.wardrobeAvail(witch, FESTIVAL.fromMs - 1), 'offseason');
  assert.match(W.festivalUntilText(DURING), /7/);
  assert.equal(W.festivalUntilText(AFTER), '');
  assert.match(W.availLine(witch, DURING), new RegExp(W.festivalUntilText(DURING)));
  const w = mintedWardrobe();
  const titles = W.wardrobeEntries('title');
  const now = titles.filter((e) => wardrobeFilterPasses('now', e, w, DURING)).map((e) => e.key);
  for (const k of ['founder', 'shadowfang', 'developer', 'chaptermaster', 'hoursfirst', 'apostle']) assert.ok(!now.includes(k), `${k} is not to be had now`);
  for (const k of ['gatebreaker', 'kynbane', 'hourbreaker', 'arenachampion', 'witchwarden', 'disciple', 'ilovelamp']) assert.ok(now.includes(k), `${k} is`);
  assert.ok(!titles.filter((e) => wardrobeFilterPasses('now', e, w, AFTER)).some((e) => e.key === 'witchwarden'), 'out of season, not now');
  const held = titles.filter((e) => wardrobeFilterPasses('held', e, w)).map((e) => e.key);
  const missing = titles.filter((e) => wardrobeFilterPasses('missing', e, w)).map((e) => e.key);
  assert.deepEqual([...held].sort(), ['founder', 'gatebreaker', 'hourbreaker']);
  assert.equal(held.length + missing.length, titles.length);
  assert.equal(titles.filter((e) => wardrobeFilterPasses('all', e, w)).length, titles.length);
});

// ── THE PAGE ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('COLLECTIONS-II THE PAGE: six tiles, each its part\'s name over its count (a dash where the account is not read); the account\'s line for every state of the read; the read begun after the draw, never inside it, and let go on leaving - its later word repaints nothing (mutants: the read started inside the draw; a forgotten read still repainting; the count without the account)', async () => {
  globalThis.document = undefined;
  _resetForTests(); setPref('lootRarity', true);
  resetCollectionsPage();
  const me = { items: [] };
  giveBinder(me);
  const w = mintedWardrobe();
  const flow = fakeFlow(w);
  const p = page({ flow, player: me });
  assert.equal(flow.started, 0, 'never asked inside the draw');
  await Promise.resolve(); await Promise.resolve();
  assert.equal(flow.started, 1, 'asked once the draw is done');
  p.root = null; resetCollectionsPage(); disarmCollectionsPage();
  const q = page({ flow, player: me });
  await Promise.resolve(); await Promise.resolve();
  const tiles = cls(q.root, 'coll-part');
  assert.deepEqual(tiles.map((b) => b.attrs['data-focus']), ['titles', 'auras', 'icons', 'glyphs', 'codex', 'cards'].map((id) => `coll-part-${id}`));
  assert.equal(tiles[0].children[1].textContent, `3 / ${TITLES.length - 1}`);
  assert.deepEqual(partCount('titles', null), { held: null, total: TITLES.length - 1 });
  assert.equal(partCount('cards', null, me).held > 0, true, 'the starter deck\'s cards');
  // the account's line, every state
  const line = (f) => { resetCollectionsPage(); return cls(page({ flow: f }).root, 'coll-acct')[0]?.textContent ?? null; };
  assert.equal(line(null), null, 'a host with no flow: no line');
  assert.match(line(fakeFlow(null, { stage: 'loading' })), /Reading your account/);
  assert.match(line(fakeFlow(null, { stage: 'out' })), /Sign in/);
  assert.equal(line(fakeFlow(null, { error: 'The account service could not be reached.' })), 'The account service could not be reached.');
  assert.match(line(fakeFlow(w, { note: 'Wearing Gatebreaker.' })), /on every character\. Wearing Gatebreaker\./);
  resetCollectionsPage();
  assert.ok(cls(page({ flow: fakeFlow(null, { stage: 'out' }) }).root, 'coll-part')[0].textContent.includes('– /'), 'unread: a dash');
  // let go on leaving: its word after repaints nothing
  resetCollectionsPage();
  let changed = null;
  const leaving = fakeFlow(w);
  const r = page({ flow: { ...leaving, start() {} }, player: me });
  const kit = { el, divider: (t) => el('h4', null, t), player: me, doc, account: (onChange) => { changed = onChange; return leaving; } };
  resetCollectionsPage();
  drawCollectionsPage(el('div'), () => r.draws++, kit);
  const before = r.draws;
  changed();
  assert.equal(r.draws, before + 1, 'this visit\'s read repaints');
  disarmCollectionsPage();
  changed();
  assert.equal(r.draws, before + 1, 'a read let go repaints nothing');
  resetCollectionsPage();
});

test('COLLECTIONS-II A KIND\'S PART: every one of the kind a row under its source\'s divider (its own n/m); a row\'s state said only where the account holds it, its availability always; a row opened whole says how, whether now, what comes with it and whose it is, and offers Wear, Take off, Show or Hide through the flow where held (never a via\'s, never signed out, never while busy); a "comes with" press opens that thing in its own part; the festival\'s line while it is on (mutants: Wear on a thing not held; the wrong press for a kind; a comes-with that stays put; a state chip on a row not held)', async () => {
  globalThis.document = undefined;
  _resetForTests();
  resetCollectionsPage();
  const w = mintedWardrobe();
  const flow = fakeFlow(w);
  let p = page({ flow });
  // every title a row, grouped
  const rows = cls(p.root, 'coll-row');
  assert.equal(rows.length, TITLES.length);
  const heads = all(p.root, (x) => x.tag === 'h4').map((h) => h.textContent);
  assert.ok(heads.includes('The Sigil Broker - 1/1') && heads.includes(`The Elite Breach - 0/13`) && heads.includes('Your Account - 1/1'), heads.join(' | '));
  const gate = rowOf(p.root, 'title', 'gatebreaker');
  assert.deepEqual(cls(gate, 'coll-tag').map((t) => t.textContent), ['Worn', 'Obtainable']);
  assert.deepEqual(cls(rowOf(p.root, 'title', 'founder'), 'coll-tag').map((t) => t.textContent), ['Held', 'No longer obtainable']);
  assert.deepEqual(cls(rowOf(p.root, 'title', 'shadowfang'), 'coll-tag').map((t) => t.textContent), ['Bestowed'], 'not held: no state chip');
  assert.ok(gate.classList.contains('held') && !rowOf(p.root, 'title', 'shadowfang').classList.contains('held'));
  assert.equal(cls(p.root, 'coll-season').length, 1, 'the festival is on');
  // opened whole, and worn off
  gate.onclick();
  const whole = cls(p.root, 'coll-whole')[0];
  assert.match(whole.textContent, /How to get it.*30 Deadlands Embers.*Availability.*You can earn it now\..*Your account holds this\./);
  const off = cls(p.root, 'coll-wear')[0];
  assert.equal(off.textContent, 'Take off');
  off.onclick();
  assert.deepEqual(flow.asked.at(-1), ['equip', 'gatebreaker']);
  flow.busy = true; p.draw();
  assert.equal(cls(p.root, 'coll-wear')[0].disabled, true, 'busy: not pressed twice');
  flow.busy = false;
  // a thing not held: no press; a via: no press; signed out: no press
  rowOf(p.root, 'title', 'shadowfang').onclick();
  assert.equal(cls(p.root, 'coll-wear').length, 0);
  assert.match(cls(p.root, 'coll-whole')[0].textContent, /does not hold this yet/);
  // the other kinds' presses
  for (const [part, kind, key, press, word] of [['auras', 'aura', 'turninghour', 'wearAura', 'Wear'], ['icons', 'icon', 'twinmoons', 'wearIcon', 'Take off'], ['glyphs', 'glyph', 'sprout', 'toggleGlyph', 'Show']]) {
    setCollectionsPart(part); p.draw();
    rowOf(p.root, kind, key).onclick();
    const b = cls(p.root, 'coll-wear')[0];
    assert.equal(b.textContent, word, `${kind}:${key}`);
    b.onclick();
    assert.deepEqual(flow.asked.at(-1), [press, key]);
  }
  assert.deepEqual(cls(rowOf(p.root, 'glyph', 'sprout'), 'coll-tag').map((t) => t.textContent), ['Hidden', 'Obtainable']);
  assert.equal(cls(p.root, 'coll-season').length, 0, 'no glyph is the festival\'s');
  // comes with: from the Kynbane title to its aura, in its own part
  setCollectionsPart('titles'); p.draw();
  rowOf(p.root, 'title', 'kynbane').onclick();
  focus(p.root, 'coll-with-aura-beaconlight').onclick();
  assert.ok(focus(p.root, 'coll-part-auras').classList.contains('on'), 'the Auras part');
  assert.ok(rowOf(p.root, 'aura', 'beaconlight').classList.contains('on') && cls(p.root, 'coll-whole').length === 1, 'Beaconlight opened');
  // the via: High Master with Chapter Master, no press
  resetCollectionsPage();
  const chapFlow = fakeFlow({ titles: ['chaptermaster'], title: 'chaptermaster', glyphs: [] });
  p = page({ flow: chapFlow });
  rowOf(p.root, 'title', 'highmaster').onclick();
  assert.deepEqual(cls(rowOf(p.root, 'title', 'highmaster'), 'coll-tag').map((t) => t.textContent), ['With Chapter Master', 'Not yet available']);
  assert.equal(cls(p.root, 'coll-wear').length, 0);
  // signed out: the catalogue, nothing held, nothing worn from here; after the festival, out of season
  resetCollectionsPage();
  p = page({ flow: fakeFlow(null, { stage: 'out' }), now: AFTER });
  assert.equal(cls(p.root, 'coll-row').filter((r) => r.classList.contains('held')).length, 0);
  rowOf(p.root, 'title', 'witchwarden').onclick();
  assert.equal(cls(p.root, 'coll-wear').length, 0);
  assert.deepEqual(cls(rowOf(p.root, 'title', 'witchwarden'), 'coll-tag').map((t) => t.textContent), ['Out of season']);
  assert.equal(cls(p.root, 'coll-season').length, 0);
  resetCollectionsPage();
});

test('COLLECTIONS-II THE FILTERS ON THE PAGE, AND THE PICTURES: a filter pressed narrows every source\'s rows and marks itself; a filter with nothing says so; the reset forgets the filter and the row; an aura\'s ring, an icon\'s drawing and a glyph\'s mark drawn where the document makes SVG, a title\'s picture its painted word (mutants: the filter never applied; the reset keeping the filter)', () => {
  globalThis.document = undefined;
  resetCollectionsPage();
  const flow = fakeFlow(mintedWardrobe());
  const p = page({ flow });
  focus(p.root, 'coll-filter-held').onclick();
  assert.deepEqual(cls(p.root, 'coll-row').map((r) => r.dataset.wardrobe).sort(), ['title:founder', 'title:gatebreaker', 'title:hourbreaker']);
  assert.ok(focus(p.root, 'coll-filter-held').classList.contains('on') && focus(p.root, 'coll-filter-held').attrs['aria-pressed'] === 'true');
  setCollectionsPart('icons'); p.draw();
  assert.equal(cls(p.root, 'coll-row').length, 1, 'the one icon held');
  focus(p.root, 'coll-filter-missing').onclick();
  assert.equal(cls(p.root, 'coll-row').length, ICONS.length - 1);
  resetCollectionsPage();
  const q = page({ flow: fakeFlow({ titles: [], glyphs: [], auras: [], icons: [] }) });
  focus(q.root, 'coll-filter-held').onclick();
  assert.equal(cls(q.root, 'coll-row').length, 0);
  assert.ok(all(q.root, (x) => x.textContent === 'Nothing here.').length === 1, 'said');
  resetCollectionsPage(); q.draw();
  assert.ok(focus(q.root, 'coll-filter-all').classList.contains('on'), 'the filter forgotten');
  // the pictures
  for (const [part, kind, key, tag] of [['auras', 'aura', 'dagonfire', 'svg'], ['icons', 'icon', 'soulcake', 'svg'], ['glyphs', 'glyph', 'laurel', 'svg']]) {
    setCollectionsPart(part); q.draw();
    assert.equal(cls(rowOf(q.root, kind, key), 'coll-prev')[0].children[0]?.tag, tag, `${kind}:${key} drawn`);
  }
  const ring = auraRingNode(doc, 'witchfire');
  assert.ok(all(ring, (x) => x.tag === 'stop').length >= 2 && all(ring, (x) => x.tag === 'ellipse').length === 2, 'the ring in its title\'s colours');
  assert.equal(auraRingNode(null, 'witchfire'), null, 'no SVG door: no picture');
  setCollectionsPart('titles'); q.draw();
  const founder = rowOf(q.root, 'title', 'founder');
  assert.equal(cls(founder, 'coll-prev').length, 0, 'a title has no picture but its word');
  assert.ok(founder.classList.contains('nopic') && cls(founder, 'coll-nm')[0].style.color, 'its word in its paint');
  resetCollectionsPage();
});

test('COLLECTIONS-II DRESSED BY THE KIT: the filters and a "comes with" press are tiles, a row a list line, a row opened a panel, a tag a chip, Wear the kit\'s button - and the sheet gives them their edges and no ground or edge colour of its own (mutants: a role dropped; the sheet\'s own ground on a row)', () => {
  const want = { tile: ['.px-sys .coll-part', '.px-sys .coll-filter', '.px-sys .coll-with'], listRow: ['.px-sys .coll-row'], panel: ['.px-sys .coll-whole'], chip: ['.px-sys .coll-tag'], button: ['.px-sys .act'] };
  for (const [role, sels] of Object.entries(want)) for (const s of sels) assert.ok(FRAME_ROLES[role].includes(s), `${role}: ${s}`);
  const rule = (sel) => WARDROBE_PART_CSS.split('\n').filter((l) => l.startsWith(`${sel} {`)).join(' ');
  for (const sel of ['.px-sys .coll-filter', '.px-sys .coll-with', '.px-sys .coll-whole']) assert.match(rule(sel), /border-width: 2px; border-style: solid;/, `${sel}: the kit's edge`);
  assert.match(rule('.px-sys .coll-row'), /border-width: 0 0 1px; border-style: solid;/, 'a line');
  assert.match(rule('.px-sys .coll-tag'), /border-width: 1px; border-style: solid;/, 'a chip\'s edge');
  assert.doesNotMatch(WARDROBE_PART_CSS, /background|border-color|border: \d/, 'no paint over the kit\'s');
  assert.deepEqual(Object.values(WARDROBE_PARTS), W.WARDROBE_KINDS, 'a part a kind, in the kinds\' order');
  assert.deepEqual(collectionParts({ items: [] }).slice(0, 4).map(([id]) => id), Object.keys(WARDROBE_PARTS));
});

test('COLLECTIONS-II the account card\'s note names the title worn, never its key (the page says that note)', async () => {
  const { AccountFlow } = await import('../../src/ui/accountFlow.js');
  const { SESSION_KEY } = await import('../../src/net/accountClient.js');
  const m = new Map([[SESSION_KEY, JSON.stringify({ id: 'a1', name: 'Aelwyn', kind: 'linked', sessionId: 's1', secret: 'sec' })]]);
  const storage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const wardrobe = { titles: ['gatebreaker'], title: null, glyphs: [], auras: [], aura: null, insignia: ['title:gatebreaker'] };
  const answers = { '/v1/account': { account: { id: 'a1', name: 'Aelwyn', kind: 'linked', handle: 'aelwyn' }, wardrobe, devices: [] }, '/v1/account/title': { ok: true, ...wardrobe, title: 'gatebreaker' } };
  const fetch = async (url) => ({ ok: true, status: 200, json: async () => answers[url.replace(/^https?:\/\/[^/]+/, '')] });
  const flow = AccountFlow({ io: { fetch }, storage });
  await flow.start();
  assert.equal(await flow.equip('gatebreaker'), true);
  assert.equal(flow.note, 'Wearing Gatebreaker.');
});

test('COLLECTIONS-II the part draws alone too - a host with no flow lists the catalogue and holds nothing', () => {
  globalThis.document = undefined;
  resetWardrobePart();
  const root = el('div');
  drawWardrobePart(root, () => {}, { el, divider: (t) => el('h4', null, t), doc, now: () => AFTER }, 'icon', null);
  assert.equal(cls(root, 'coll-acct').length, 0);
  assert.equal(cls(root, 'coll-row').length, ICONS.length);
  assert.ok(cls(root, 'coll-row').every((r) => !r.classList.contains('held')));
});
