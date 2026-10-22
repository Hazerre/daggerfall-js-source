// @ts-check
// BOARD-SIFT (2026-10-21, feature-feedback: "Definitely need sorting/filtering functions for work writs considering
// there are thousands of them and you have to scroll through them all to find what you want"; "The notice board in
// general needs some TLC. The writs especially."): THE WORK TAB'S WRITS SIFTED - every card of the region's work (the
// Court's writs and the chapters', guild and seat writs, guild contracts, commissions) under one bar: what kind, a
// search of its words (the material, the guild, the crafter or the piece), "Only what I can fill", and an order (ending
// soonest, most silver, A to Z). The work still open stands before the work done, and the grid draws a page of it at a
// time, "Show 40 more" under the last (bible/06-Systems/Professions-Arc.md 10.13).
//
// The window (ui/noticeWindow.js) hands each card in as an ENTRY - its kind, whether it is open and fillable now, its
// silver, its end, its name and its words, and the card itself to draw (`card`), made only for the cards shown. What
// "fillable" means is the card's own law, said where the card is made (noticeWindow writFillable, workTab
// guildWritMost). The filter and the order are the professions book's for the session (`state.workSift`), so the
// window a stray tap closed opens on them again.
import { t } from '../systems/textManager.js';

/** The kinds of work, in the bar's order. */
export const WORK_KINDS = Object.freeze(['court', 'chapter', 'guild', 'contract', 'commission']);
/** The orders the work is read in, the first the default. */
export const WORK_SORTS = Object.freeze(['ending', 'pay', 'name']);
/** The cards a grid draws at once, and how many more a press of "Show more" adds. */
export const WORK_SHOWN = 40;

/**
 * @typedef {{ kind: string, open: boolean, fill: boolean, pay: number, ends: number, name: string, words: string, card: () => HTMLElement }} WorkEntry
 * @typedef {{ kind: string, find: string, fill: boolean, sort: string, shown: number }} WorkSift
 */

/** The bar as a window opens for the first time: all the work, ending soonest. @returns {WorkSift} */
export const freshSift = () => ({ kind: 'all', find: '', fill: false, sort: WORK_SORTS[0], shown: WORK_SHOWN });

/** An entry's searchable words, lower-cased, from any number of names (a missing one is skipped). */
export const wordsOf = (/** @type {Array<string|null|undefined>} */ ...names) => names.filter(Boolean).join(' ').toLowerCase();

/**
 * THE SIFT - the entries of `sift.kind` (all: every kind), each word of `sift.find` among its words or its kind's name
 * ("court" finds the Court's writs), fillable now where
 * `sift.fill`; the open before the done, then in `sift.sort`'s order (the soonest to end, the most silver, A to Z), ties
 * kept in the order they came; `sift.shown` of them. Pure.
 * @param {ReadonlyArray<WorkEntry>} entries @param {WorkSift} sift
 * @returns {{ rows: WorkEntry[], matched: number }}
 */
export function siftWork(entries, sift) {
  const words = String(sift?.find ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const kind = WORK_KINDS.includes(sift?.kind) ? sift.kind : 'all';
  const named = new Map(WORK_KINDS.map((k) => [k, kindWord(k).toLowerCase()]));
  const kept = entries.filter((e) => (kind === 'all' || e.kind === kind) && (!sift?.fill || e.fill)
    && words.every((w) => e.words.includes(w) || !!named.get(e.kind)?.includes(w)));
  const ends = (/** @type {WorkEntry} */ e) => (Number.isFinite(e.ends) && e.ends > 0 ? e.ends : Infinity);
  /** @type {(a: WorkEntry, b: WorkEntry) => number} */
  const by = sift?.sort === 'pay' ? (a, b) => (Number(b.pay) || 0) - (Number(a.pay) || 0)
    : sift?.sort === 'name' ? (a, b) => a.name.localeCompare(b.name)
      : (a, b) => (ends(a) === ends(b) ? 0 : ends(a) < ends(b) ? -1 : 1);
  const rows = kept.map((e, i) => /** @type {const} */ ([e, i])).sort(([a, i], [b, j]) => (Number(b.open) - Number(a.open)) || by(a, b) || i - j).map(([e]) => e);
  const shown = Number.isSafeInteger(sift?.shown) && sift.shown > 0 ? sift.shown : WORK_SHOWN;
  return { rows: rows.slice(0, shown), matched: rows.length };
}

/** The entries of each kind - the bar names the count beside each. @param {ReadonlyArray<WorkEntry>} entries */
export function kindCounts(entries) {
  const n = new Map(WORK_KINDS.map((k) => [k, 0]));
  for (const e of entries) if (n.has(e.kind)) n.set(e.kind, /** @type {number} */ (n.get(e.kind)) + 1);
  return n;
}

/** A kind's name on the bar. */
export const kindWord = (/** @type {string} */ k) => (k === 'court' ? t('notice.sift.court', 'Court writs') : k === 'chapter' ? t('notice.sift.chapter', 'Chapter writs')
  : k === 'guild' ? t('notice.sift.guild', 'Guild writs') : k === 'contract' ? t('notice.sift.contract', 'Guild contracts')
    : k === 'commission' ? t('notice.sift.commission', 'Commissions') : t('notice.sift.all', 'All work'));
/** An order's name on the bar. */
export const sortWord = (/** @type {string} */ k) => (k === 'pay' ? t('notice.sift.pay', 'Most silver') : k === 'name' ? t('notice.sift.name', 'A to Z')
  : t('notice.sift.ending', 'Ending soonest'));

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const select = (/** @type {Array<[string, string]>} */ options, /** @type {string} */ value, /** @type {(v: string) => void} */ onChange, /** @type {string} */ label, /** @type {string} */ focus) => {
  const s = /** @type {HTMLSelectElement} */ (el('select', 'notice-select work-select'));
  s.setAttribute('aria-label', label);
  s.setAttribute('data-focus', focus);
  for (const [v, text] of options) { const o = /** @type {HTMLOptionElement} */ (el('option', null, text)); o.value = v; if (v === value) o.selected = true; s.append(o); }
  s.onchange = () => onChange(s.value);
  return s;
};

/**
 * THE BAR over the grid: the kind (each with its count; a kind with none is not offered unless it is the one chosen),
 * the search, "Only what I can fill", the order, and how many of the matches are shown. A change keeps the sift and
 * asks the window to draw again (`redraw`), the first page of it.
 * @param {WorkSift} sift @param {ReadonlyArray<WorkEntry>} entries @param {number} matched @param {number} shown
 * @param {() => void} redraw
 */
export function workSiftBar(sift, entries, matched, shown, redraw) {
  const bar = el('div', 'work-sift');
  const changed = () => { sift.shown = WORK_SHOWN; redraw(); };
  const counts = kindCounts(entries);
  /** @type {Array<[string, string]>} */
  const kinds = [['all', `${kindWord('all')} (${entries.length.toLocaleString()})`],
    ...WORK_KINDS.filter((k) => /** @type {number} */ (counts.get(k)) > 0 || sift.kind === k)
      .map((k) => /** @type {[string, string]} */ ([k, `${kindWord(k)} (${/** @type {number} */ (counts.get(k)).toLocaleString()})`]))];
  bar.append(select(kinds, sift.kind, (v) => { sift.kind = v; changed(); }, t('notice.sift.kindLabel', 'Kind of work'), 'worksift|kind'));
  const find = /** @type {HTMLInputElement} */ (el('input', 'notice-input work-find'));
  find.type = 'search';
  find.value = sift.find;
  find.placeholder = t('notice.sift.find', 'Search');
  find.setAttribute('aria-label', t('notice.sift.findLabel', 'Search by material, guild or name'));
  find.setAttribute('data-focus', 'worksift|find');
  /** @type {any} */
  let typing = null;
  find.oninput = () => { sift.find = find.value; clearTimeout(typing); typing = setTimeout(changed, 150); };
  bar.append(find);
  const fill = /** @type {HTMLInputElement} */ (el('input'));
  fill.type = 'checkbox';
  fill.checked = !!sift.fill;
  fill.setAttribute('data-focus', 'worksift|fill');
  fill.onchange = () => { sift.fill = fill.checked; changed(); };
  const fillLabel = el('label', 'work-sift-fill');
  fillLabel.append(fill, el('span', null, t('notice.sift.fill', 'Only what I can fill')));
  bar.append(fillLabel);
  bar.append(select(WORK_SORTS.map((k) => /** @type {[string, string]} */ ([k, sortWord(k)])), sift.sort, (v) => { sift.sort = v; changed(); }, t('notice.sift.sortLabel', 'Order the work'), 'worksift|sort'));
  const count = el('span', 'work-sift-count', t('notice.sift.count', 'Showing {shown, number} of {total, number}', { shown, total: matched }));
  count.setAttribute('aria-live', 'polite');
  bar.append(count);
  return bar;
}

/** Under the grid: "Show 40 more" while matches stand past the last drawn - or, where nothing matched what was asked,
 *  the word and "Show all work". Null for neither. @param {WorkSift} sift @param {number} matched @param {number} shown
 *  @param {number} total every entry, unsifted @param {() => void} redraw */
export function workSiftFoot(sift, matched, shown, total, redraw) {
  if (matched > shown) {
    const n = Math.min(WORK_SHOWN, matched - shown);
    const b = /** @type {HTMLButtonElement} */ (el('button', 'act work-sift-more', t('notice.sift.more', 'Show {n, number} more', { n })));
    b.setAttribute('type', 'button');
    b.onclick = (e) => { e?.stopPropagation?.(); sift.shown = shown + WORK_SHOWN; redraw(); };
    return b;
  }
  if (!matched && total) {
    const p = el('p', 'notice-empty work-sift-none', t('notice.sift.none', 'No work matches.'));
    const b = /** @type {HTMLButtonElement} */ (el('button', 'act notice-retry', t('notice.sift.clear', 'Show all work')));
    b.setAttribute('type', 'button');
    b.onclick = (e) => { e?.stopPropagation?.(); Object.assign(sift, freshSift(), { sort: sift.sort }); redraw(); };
    p.append(b);
    return p;
  }
  return null;
}
