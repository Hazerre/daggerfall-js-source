// @ts-check
// COLLECTIONS-II (2026-10-22; bible/10-UI/Collections.md): THE WARDROBE'S PARTS of the Collections page - Titles, Auras,
// Icons and Glyphs, one kind a part, every thing of its kind listed whether the account holds it or not (the catalogue:
// ui/collections/wardrobeCatalogue.js), grouped by where it comes from, each row pressed open to say how it is had, whether
// it can be had now, what comes with it - and, held, worn from here as the account card wears it.
//
// THE ACCOUNT IS READ, NEVER KEPT. What is held is the service's word (ui/accountFlow.js: the wardrobe of /v1/account),
// asked once a visit through the flow the host hands over (`kit.account(onChange)` - the same constructor the account
// card is built by), and a Wear here is that flow's own press (equip, wearAura, wearIcon, toggleGlyph): the service
// answers, the answer replaces the wardrobe, and the name over the head, the feet and the portrait well learn it as they
// do from the card. A host with no flow to give (a lab, a pin) lists the catalogue and holds nothing.
//
// Dressed by the kit's roles (ui/enhanced/enhancedFrame.js FRAME_ROLES): the filters are tiles, a row a list line, a row
// opened a panel, a tag a chip, Wear the kit's button - this sheet writes geometry and the words' colours alone.
import { t } from '../../systems/textManager.js';
import { titleBadge, paintTitle, glyphBadges, glyphSvgNode, TITLE_RGBA, TITLE_GRADIENT, AURA_PAINT, cssRgba } from '../playerBadge.js';
import { profileIconNode } from '../profileIcons.js';
import {
  WARDROBE_SOURCES, AVAIL_NOW, AVAIL_TAG, sourceName, wordPair, wardrobeEntries, wardrobeEntry, wardrobeName, wardrobeHeld, wardrobeWorn,
  wardrobeCounted, wardrobeAvail, availLine, festivalUntilText,
} from './wardrobeCatalogue.js';

/** The filters, in their row's order. */
export const WARDROBE_FILTERS = Object.freeze([
  wordPair('all', () => t('coll.filter.all', 'All')),
  wordPair('held', () => t('coll.filter.held', 'Held')),
  wordPair('missing', () => t('coll.filter.missing', 'Not held')),
  wordPair('now', () => t('coll.filter.now', 'Obtainable')),
]);
/** Whether an entry passes a filter, against a wardrobe, now. Pure. */
export function wardrobeFilterPasses(/** @type {string} */ filter, /** @type {any} */ e, /** @type {any} */ wardrobe, nowMs = Date.now()) {
  if (filter === 'held') return wardrobeHeld(e.kind, e.key, wardrobe);
  if (filter === 'missing') return !wardrobeHeld(e.kind, e.key, wardrobe);
  if (filter === 'now') return AVAIL_NOW.includes(wardrobeAvail(e, nowMs));
  return true;
}

let _filter = 'all';
let _open = /** @type {string|null} */ (null);   // the row opened whole, `kind:key`
/** @type {any} */
let _flow = null;
/** The parts forgotten (a new visit): every row closed, the filter back to All, the account asked again next draw. */
export function resetWardrobePart() { _filter = 'all'; _open = null; _flow = null; }
/** Leaving the page lets the visit's read go: its later answers repaint nothing, and the next visit asks again. */
export function forgetWardrobeAccount() { _flow = null; }
/** A row to open (a "comes with" pressed, a landing). */
export function openWardrobeRow(/** @type {string} */ kind, /** @type {string} */ key) { _open = `${kind}:${key}`; if (_filter !== 'all') _filter = 'all'; }

/**
 * THE ACCOUNT THIS VISIT READS: the flow the host's `kit.account` builds, its first read begun after the draw that asked
 * (never inside it - a read's first word repaints, and a repaint inside a draw rebuilds the page under it), its every
 * change a repaint while it is still this visit's. Null where the host gives none.
 * @param {{ account?: (onChange: () => void) => any }} kit @param {() => void} rerender
 */
export function wardrobeAccount(kit, rerender) {
  if (_flow || typeof kit?.account !== 'function') return _flow;
  const flow = kit.account(() => { if (_flow === flow) rerender(); });
  _flow = flow;
  Promise.resolve().then(() => flow?.start?.()).catch(() => {});
  return flow;
}
/** The wardrobe the account answered, or null (nobody signed in, the read not back, offline). */
export const wardrobeOfFlow = (/** @type {any} */ flow) => (flow?.stage === 'in' ? flow.wardrobe ?? null : null);

export const WARDROBE_PART_CSS = `
.px-sys .coll-acct { font-size: 12px; color: #b8b0a0; margin: 0 0 8px; }
.px-sys .coll-acct .said { color: #e9e4d9; }
.px-sys .coll-acct .fail { color: #ff8a78; }
.px-sys .coll-season { font-size: 12px; color: #a7e08a; margin: 0 0 8px; }
.px-sys .coll-filters { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
.px-sys .coll-filter { padding: 3px 10px; border-width: 2px; border-style: solid; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #b8b0a0; cursor: pointer; }
.px-sys .coll-filter.on { color: #f3cf86; }
.px-sys .coll-list { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 10px; }
.px-sys .coll-row { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 5px 8px 6px; border-width: 0 0 1px; border-style: solid; text-align: left; cursor: pointer; }
.px-sys .coll-row.nopic { grid-template-columns: minmax(0, 1fr) auto; min-height: 36px; }
.px-sys .coll-prev { display: flex; align-items: center; justify-content: center; width: 34px; height: 26px; }
.px-sys .coll-prev svg { display: block; }
.px-sys .coll-nm { min-width: 0; font-size: 14px; color: #e9e4d9; overflow-wrap: anywhere; }
.px-sys .coll-row:not(.held) .coll-prev, .px-sys .coll-row:not(.held) .coll-nm { opacity: 0.55; }
.px-sys .coll-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
.px-sys .coll-tag { flex: none; padding: 0 5px; border-width: 1px; border-style: solid; font-size: 10px; line-height: 1.6; letter-spacing: 0.08em; text-transform: uppercase; color: #8b8578; white-space: nowrap; }
.px-sys .coll-tag.is-worn { color: #f3cf86; }
.px-sys .coll-tag.is-held { color: #8fc7a0; }
.px-sys .coll-tag.av-open, .px-sys .coll-tag.av-chance, .px-sys .coll-tag.av-ranked, .px-sys .coll-tag.av-patron { color: #b8b0a0; }
.px-sys .coll-tag.av-seasonal { color: #a7e08a; }
.px-sys .coll-tag.av-retired, .px-sys .coll-tag.av-bestowed, .px-sys .coll-tag.av-staff { color: #c49a8a; }
.px-sys .coll-whole { margin: 2px 0 8px; padding: 10px 12px 12px; border-width: 2px; border-style: solid; display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; }
.px-sys .coll-text { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.px-sys .coll-show { display: flex; align-items: flex-start; justify-content: center; padding-top: 2px; }
.px-sys .coll-whole.nopic { grid-template-columns: minmax(0, 1fr); }
.px-sys .coll-text .coll-bigword { font-size: 17px; margin-bottom: 2px; overflow-wrap: anywhere; }
.px-sys .coll-whole h5 { margin: 4px 0 0; font-size: 11px; font-weight: normal; letter-spacing: 0.1em; text-transform: uppercase; color: #c08a3e; }
.px-sys .coll-whole p { margin: 0; font-size: 12px; color: #e9e4d9; }
.px-sys .coll-whole .coll-look { font-style: italic; color: #cfc6b2; }
.px-sys .coll-whole .coll-own { color: #8fc7a0; }
.px-sys .coll-whole .coll-own.no { color: #8b8578; }
.px-sys .coll-withs { display: flex; flex-wrap: wrap; gap: 6px; }
.px-sys .coll-with { padding: 2px 8px; border-width: 2px; border-style: solid; font-size: 12px; color: #e9e4d9; cursor: pointer; }
.px-sys .coll-acts { margin-top: 6px; }
@media (max-width: 520px) {
  .px-sys .coll-row { grid-template-columns: 30px minmax(0, 1fr); }
  .px-sys .coll-row.nopic { grid-template-columns: minmax(0, 1fr); }
  .px-sys .coll-tags { grid-column: 2; justify-content: flex-start; }
  .px-sys .coll-row.nopic .coll-tags { grid-column: 1; }
  .px-sys .coll-whole { grid-template-columns: minmax(0, 1fr); }
}
`;

/** A title's word in its own paint (the name over a head's: ui/playerBadge.js titlePaint) - an aura's in its title's. */
function paintedWord(el, /** @type {string} */ kind, /** @type {string} */ key, /** @type {string} */ cls) {
  const word = el('span', cls, wardrobeName(kind, key));
  const paintKey = kind === 'title' ? key : kind === 'aura' ? AURA_PAINT[/** @type {keyof typeof AURA_PAINT} */ (key)] : null;
  if (paintKey && word.style) paintTitle(word, titleBadge({ title: paintKey }));
  return word;
}
/** AN AURA'S PICTURE: the ring it lights about the feet, in its title's colours (the account card's paint, AURA_PAINT) -
 *  a sign of the aura, never the aura (that is render/auraRing.js's, drawn in the world). Null with no SVG door. */
export function auraRingNode(/** @type {any} */ doc, /** @type {string} */ key, size = 32) {
  if (typeof doc?.createElementNS !== 'function') return null;
  const NS = 'http://www.w3.org/2000/svg';
  const node = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs) => { const n = doc.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v)); return n; };
  const paint = AURA_PAINT[/** @type {keyof typeof AURA_PAINT} */ (key)];
  const stops = TITLE_GRADIENT[/** @type {keyof typeof TITLE_GRADIENT} */ (paint)] ?? [TITLE_RGBA[/** @type {keyof typeof TITLE_RGBA} */ (paint)], TITLE_RGBA[/** @type {keyof typeof TITLE_RGBA} */ (paint)]];
  const id = `coll-aura-${key}-${++_ringSerial}`;
  const svg = node('svg', { viewBox: '0 0 40 26', width: size, height: Math.round(size * 0.65), class: 'coll-ring', 'aria-hidden': 'true' });
  const defs = node('defs', {});
  const grad = node('linearGradient', { id, x1: '0', y1: '0', x2: '1', y2: '0' });
  stops.forEach((rgba, i) => grad.append(node('stop', { offset: String(stops.length > 1 ? i / (stops.length - 1) : 0), 'stop-color': cssRgba(rgba) ?? '#c08a3e' })));
  defs.append(grad);
  svg.append(defs,
    node('ellipse', { cx: 20, cy: 17, rx: 17, ry: 6.5, fill: `url(#${id})`, opacity: 0.22 }),
    node('ellipse', { cx: 20, cy: 17, rx: 15.5, ry: 5.5, fill: 'none', stroke: `url(#${id})`, 'stroke-width': 2.4 }),
    node('circle', { cx: 13, cy: 9, r: 1.4, fill: `url(#${id})`, opacity: 0.8 }),
    node('circle', { cx: 21, cy: 5, r: 1.1, fill: `url(#${id})`, opacity: 0.65 }),
    node('circle', { cx: 28, cy: 10, r: 1.6, fill: `url(#${id})`, opacity: 0.9 }));
  return svg;
}
let _ringSerial = 0;

/** A thing's picture at `size`: an aura's ring, an icon's drawing, a glyph's mark in its colour; a title has none but
 *  its painted word. */
function pictureOf(/** @type {any} */ doc, /** @type {string} */ kind, /** @type {string} */ key, size = 24) {
  if (kind === 'aura') return auraRingNode(doc, key, size + 8);
  if (kind === 'icon') return profileIconNode(doc, key, 'coll-icon', size);
  if (kind === 'glyph') {
    const g = glyphBadges({ glyphs: [key] })[0];
    const svg = g ? glyphSvgNode(doc, g, 'coll-glyph', 1.8) : null;
    if (svg) { svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size)); }
    return svg;
  }
  return null;
}

/** The words of whose it is, for a thing the account holds: worn (shown, for a glyph), or held (hidden). */
function stateWord(/** @type {string} */ kind, /** @type {any} */ e, /** @type {any} */ wardrobe) {
  if (e.via) return t('coll.state.via', 'With {title}', { title: wardrobeName(kind, e.via) });
  if (wardrobeWorn(kind, e.key, wardrobe)) return kind === 'glyph' ? t('coll.state.shown', 'Shown') : t('coll.state.worn', 'Worn');
  return kind === 'glyph' ? t('coll.state.hidden', 'Hidden') : t('coll.state.held', 'Held');
}

/** The account's line over a part: what the visit's read says, or why there is nothing to say. */
function accountLine(el, /** @type {any} */ flow) {
  if (!flow) return null;
  const p = el('p', 'coll-acct');
  if (flow.stage === 'loading') p.append(el('span', null, t('coll.acct.loading', 'Reading your account…')));
  else if (flow.stage !== 'in') p.append(el('span', null, t('coll.acct.out', 'Sign in from your profile to see which of these your account holds.')));
  else if (!flow.wardrobe) p.append(el('span', 'fail', flow.error || t('coll.acct.none', 'Your account could not be read just now.')));
  else {
    p.append(el('span', null, t('coll.acct.scope', 'Held by your account, on every character.')));
    if (flow.error) p.append(el('span', null, ' '), el('span', 'fail', flow.error));
    else if (flow.note) p.append(el('span', null, ' '), el('span', 'said', flow.note));
  }
  return p;
}

/**
 * A KIND'S PART into `detail`: the account's line, the festival's while one is on, the filters, then each source's rows
 * under its divider (its own "n of m"), a row opened whole beneath itself. `kit.goTo(kind)` takes the page to another
 * kind's part (a "comes with" pressed); `kit.now()` the clock the seasons are read by.
 * @param {any} detail @param {() => void} rerender @param {any} kit @param {string} kind @param {any} flow
 */
export function drawWardrobePart(detail, rerender, kit, kind, flow) {
  const { el, divider } = kit;
  const wardrobe = wardrobeOfFlow(flow);
  const now = typeof kit.now === 'function' ? kit.now() : Date.now();
  const ctx = { el, doc: kit.doc ?? (typeof document === 'undefined' ? null : document), wardrobe, flow, now, rerender, goTo: typeof kit.goTo === 'function' ? kit.goTo : () => {} };
  const line = accountLine(el, flow);
  if (line) detail.append(line);
  const entries = wardrobeEntries(kind);
  const until = festivalUntilText(now);
  if (until && entries.some((e) => e.avail === 'seasonal')) detail.append(el('p', 'coll-season', t('coll.season.on', 'The Witches’ Festival is on until {date}: its pieces can be had now.', { date: until })));
  detail.append(filterRow(el, rerender));
  const shown = entries.filter((e) => wardrobeFilterPasses(_filter, e, wardrobe, now));
  if (!shown.length) { detail.append(el('p', 'px-note', t('coll.none', 'Nothing here.'))); return; }
  for (const [src] of WARDROBE_SOURCES) {
    const rows = shown.filter((e) => e.src === src);
    if (!rows.length) continue;
    const counted = entries.filter((e) => e.src === src && wardrobeCounted(e));
    const held = counted.filter((e) => wardrobeHeld(kind, e.key, wardrobe)).length;
    detail.append(divider(t('coll.group', '{source} - {held}/{total}', { source: sourceName(src), held, total: counted.length })));
    const list = el('div', 'coll-list');
    for (const e of rows) list.append(...rowOf(ctx, e));
    detail.append(list);
  }
}

function filterRow(el, /** @type {() => void} */ rerender) {
  const row = el('div', 'coll-filters');
  for (const [id, label] of WARDROBE_FILTERS) {
    const b = el('button', `coll-filter${id === _filter ? ' on' : ''}`, label());
    b.type = 'button';
    b.setAttribute('data-focus', `coll-filter-${id}`);
    b.setAttribute('aria-pressed', id === _filter ? 'true' : 'false');
    b.onclick = () => { _filter = id; rerender(); };
    row.append(b);
  }
  return row;
}

/** @typedef {{ el: Function, doc: any, wardrobe: any, flow: any, now: number, rerender: () => void, goTo: (kind: string) => void }} PartCtx */

/** One row - its picture, its name in its paint, whose it is and whether it can be had - and, opened, the whole of it.
 *  @param {PartCtx} ctx @param {any} e */
function rowOf(ctx, e) {
  const { el, wardrobe } = ctx;
  const id = `${e.kind}:${e.key}`;
  const held = wardrobeHeld(e.kind, e.key, wardrobe), worn = wardrobeWorn(e.kind, e.key, wardrobe);
  const row = el('button', `coll-row${e.kind === 'title' ? ' nopic' : ''}${held ? ' held' : ''}${worn ? ' worn' : ''}${_open === id ? ' on' : ''}`);
  row.type = 'button';
  row.dataset.wardrobe = id;
  row.setAttribute('data-focus', `coll-row-${e.kind}-${e.key}`);
  row.setAttribute('aria-expanded', _open === id ? 'true' : 'false');
  const pic = e.kind === 'title' ? null : pictureOf(ctx.doc, e.kind, e.key, 24);
  if (e.kind !== 'title') { const prev = el('span', 'coll-prev'); if (pic) prev.append(pic); row.append(prev); }
  // whose it is said only where it is the account's - a thing not held is the row's dimmed word, never a chip a row
  const tags = el('span', 'coll-tags');
  if (held) tags.append(el('span', `coll-tag ${worn ? 'is-worn' : 'is-held'}`, stateWord(e.kind, e, wardrobe)));
  const avail = wardrobeAvail(e, ctx.now);
  tags.append(el('span', ['coll-tag', `av-${avail}`].join(' '), AVAIL_TAG[/** @type {keyof typeof AVAIL_TAG} */ (avail)]()));
  row.append(paintedWord(el, e.kind, e.key, 'coll-nm'), tags);
  row.onclick = () => { _open = _open === id ? null : id; ctx.rerender(); };
  return _open === id ? [row, wholeOf(ctx, e)] : [row];
}

/** A row opened whole: its picture large, what it looks like (an aura), how it is had, whether it can be now, what comes
 *  with it (each a press to that thing), whose it is - and Wear, Take off, Show or Hide where the account holds it.
 *  @param {PartCtx} ctx @param {any} e */
function wholeOf(ctx, e) {
  const { el, wardrobe } = ctx;
  const pic = e.kind === 'title' ? null : pictureOf(ctx.doc, e.kind, e.key, 56);
  const box = el('div', `coll-whole${pic ? '' : ' nopic'}`);
  if (pic) { const show = el('div', 'coll-show'); show.append(pic); box.append(show); }
  const text = el('div', 'coll-text');
  if (!pic) text.append(paintedWord(el, e.kind, e.key, 'coll-bigword'));   // a title's picture is its word, painted
  if (e.look) text.append(el('p', 'coll-look', e.look()));
  text.append(el('h5', null, t('coll.whole.how', 'How to get it')), el('p', 'coll-how', e.how()));
  text.append(el('h5', null, t('coll.whole.avail', 'Availability')), el('p', 'coll-availline', availLine(e, ctx.now)));
  if (e.with?.length) text.append(el('h5', null, t('coll.whole.with', 'Comes with')), withRow(ctx, e));
  const held = wardrobeHeld(e.kind, e.key, wardrobe);
  if (wardrobe) text.append(el('p', `coll-own${held ? '' : ' no'}`, held ? t('coll.whole.held', 'Your account holds this.') : t('coll.whole.missing', 'Your account does not hold this yet.')));
  const act = held && !e.via ? wearPress(el, e, wardrobe, ctx.flow) : null;
  if (act) { const acts = el('div', 'coll-acts'); acts.append(act); text.append(acts); }
  box.append(text);
  return box;
}

/** The things that come with an entry, each a press that opens it in its own part. @param {PartCtx} ctx @param {any} e */
function withRow(ctx, e) {
  const row = ctx.el('div', 'coll-withs');
  for (const w of e.with) {
    const [kind, key] = w.split(':');
    if (!wardrobeEntry(kind, key)) continue;
    const b = ctx.el('button', 'coll-with', `${KIND_WORD[/** @type {keyof typeof KIND_WORD} */ (kind)]()}: ${wardrobeName(kind, key)}`);
    b.type = 'button';
    b.setAttribute('data-focus', `coll-with-${kind}-${key}`);
    b.onclick = () => { openWardrobeRow(kind, key); ctx.goTo(kind); ctx.rerender(); };
    row.append(b);
  }
  return row;
}
/** Each kind's word, singular (a "comes with" press). */
export const KIND_WORD = Object.freeze({
  title: () => t('coll.kind.title', 'Title'),
  aura: () => t('coll.kind.aura', 'Aura'),
  icon: () => t('coll.kind.icon', 'Icon'),
  glyph: () => t('coll.kind.glyph', 'Glyph'),
});

/** The press that wears it, takes it off, shows or hides it - the flow's own, its answer the service's. Null without a
 *  signed-in flow. */
function wearPress(el, /** @type {any} */ e, /** @type {any} */ wardrobe, /** @type {any} */ flow) {
  const press = { title: 'equip', aura: 'wearAura', icon: 'wearIcon', glyph: 'toggleGlyph' }[/** @type {'title'|'aura'|'icon'|'glyph'} */ (e.kind)];
  if (flow?.stage !== 'in' || typeof flow[press] !== 'function') return null;
  const worn = wardrobeWorn(e.kind, e.key, wardrobe);
  const word = e.kind === 'glyph'
    ? (worn ? t('coll.wear.hide', 'Hide') : t('coll.wear.show', 'Show'))
    : (worn ? t('coll.wear.off', 'Take off') : t('coll.wear.on', 'Wear'));
  const b = el('button', 'act coll-wear', word);
  b.type = 'button';
  b.disabled = !!flow.busy;
  b.setAttribute('data-focus', `coll-wear-${e.kind}-${e.key}`);
  b.onclick = () => { Promise.resolve(flow[press](e.key)).catch(() => {}); };
  return b;
}
