// TIMERS2 (2026-10-22, the owner: "organize the timer system in the pause menu"): THE TIMERS WINDOW IN GROUPS. The law
// (systems/eventTimers.js TIMER_GROUPS, timerGroupOf, timerGroups: each row under what it is, each group in the list's
// own order), the window (ui/enhanced/enhancedTimers.js: a head a group, how many are under way, a row under way saying
// "Now", a bar showing every group or one alone, kept while the game runs, a group that empties handing the list back to
// All) and the sheet (the Elite Breach's colour, the gate's from its herald's family, the bar and the badge on Stone).
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventTimerRows, TIMER_GROUPS, timerGroupOf, timerGroups } from '../../../src/systems/eventTimers.js';
import { timersWindow, TIMER_KINDS, timerGroupTitle, timerGroupChip } from '../../../src/ui/enhanced/enhancedTimers.js';
import { ENHANCED_CSS } from '../../../src/ui/enhanced/enhancedStyle.js';
import { EG_ARCH_RING_CSS } from '../../../src/ui/eliteGates/egArchMapMark.js';
import { heraldCss } from '../../../src/net/herald/heraldCard.js';

// Friday 2026-10-02 12:20 UTC - a Muster, a gate day, the Reckoning that evening (TIMERS1's own instant)
const NOW = Date.UTC(2026, 9, 2, 12, 20, 0);
const RAIDS = [
  { name: 'Ashfield', region: 'Wayrest', type: 'bandits', startMs: NOW - 1, endMs: NOW + 5000 },
  { name: 'Gothway Garden', region: 'Daggerfall', type: 'orcs', startMs: NOW + 300_000, endMs: NOW + 900_000 },
];

// ── the window, over a document just real enough (timers1.test.js's, with the focus a press leaves) ──
function fakeDoc() {
  const doc = { activeElement: null };
  const node = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', attrs: {}, style: {}, listeners: {}, title: '', type: '',
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); }, focus() { doc.activeElement = n; } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  doc.createElement = node;
  return doc;
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };
const text = (n) => { let s = n.textContent; walk(n, (c) => { if (c !== n && c.textContent) s += ` ${c.textContent}`; }); return s.trim(); };
const press = (n) => n.listeners.click[0]();

test('TIMERS2 the law: every kind the window draws stands in exactly one group, in the window\'s order - the world\'s events, the Battlespire, the raids, the seats and their battles, the resets; a kind no group names stands with the resets (mutants: a kind in two groups; the groups reordered; an unknown kind lost)', () => {
  assert.deepEqual(TIMER_GROUPS.map((g) => g.id), ['world', 'spire', 'raids', 'seats', 'resets']);
  const kinds = TIMER_GROUPS.flatMap((g) => g.kinds);
  assert.deepEqual([...kinds].sort(), [...TIMER_KINDS].sort(), 'every kind the sheet colours has a group, and no group names a kind the sheet does not');
  assert.equal(new Set(kinds).size, kinds.length, 'one group a kind');
  assert.deepEqual(['gate', 'serpent', 'super', 'star', 'elite', 'raid', 'battle', 'seat', 'reset'].map(timerGroupOf), ['world', 'world', 'world', 'world', 'spire', 'raids', 'seats', 'seats', 'resets']);
  assert.equal(timerGroupOf('nonesuch'), 'resets');
  for (const id of TIMER_GROUPS.map((g) => g.id)) assert.ok(timerGroupTitle(id) && timerGroupChip(id), `${id}: a head and a button`);
  assert.deepEqual(TIMER_GROUPS.map((g) => timerGroupTitle(g.id)), ['World events', 'The Battlespire', 'Town raids', 'Seats and battles', 'Resets']);
  assert.equal(timerGroupChip('all'), 'All');
});

test('TIMERS2 the layout: the rows by group in TIMER_GROUPS\'s order, each group\'s rows in the list\'s own order (live first, soonest end first, then soonest start), and how many of each are under way; a group with no row left out (mutants: a group\'s rows resorted; the live count off; an empty group drawn)', () => {
  const rows = eventTimerRows({ now: NOW, raids: RAIDS, region: 'Daggerfall', seatsOpen: true, zero: 0 });
  const groups = timerGroups(rows);
  assert.deepEqual(groups.map((g) => g.id), ['world', 'raids', 'seats', 'resets'], 'no Elite row without a breach or the boards\' door: no Spire group');
  for (const g of groups) {
    assert.deepEqual(g.rows, rows.filter((r) => timerGroupOf(r.kind) === g.id), `${g.id}: the list's own order`);
    assert.equal(g.live, g.rows.filter((r) => r.live).length);
  }
  assert.deepEqual(groups.find((g) => g.id === 'raids').rows.map((r) => [r.title, r.live]), [['Raids elsewhere: Ashfield', true], ['Raid on Gothway Garden', false]]);
  assert.equal(groups.find((g) => g.id === 'raids').live, 1);
  assert.equal(groups.reduce((n, g) => n + g.rows.length, 0), rows.length, 'every row in one group');
  assert.deepEqual(timerGroups([]), []);
  assert.deepEqual(timerGroups(null), []);
});

test('TIMERS2 the window: a head a group with how many are under way, a row under way saying "Now" beside its countdown and no other row; the countdowns still rewritten in place (mutants: the badge on a coming row; the head\'s count unsaid; the rows rebuilt every tick)', () => {
  let now = NOW;
  const view = timersWindow(fakeDoc(), { read: () => ({ now, raids: RAIDS, region: 'Daggerfall' }), onClose() {}, every: 1e9, group: 'all' });
  view.stop();
  const root = view.root;
  assert.deepEqual(all(root, 'tm-section').map((h) => h.className), ['tm-section tm-g-world', 'tm-section tm-g-raids', 'tm-section tm-g-resets']);
  assert.deepEqual(all(root, 'tm-section').map(text), ['World events', 'Town raids 1 under way', 'Resets']);
  const live = all(root, 'tm-row').filter((r) => r.className.split(' ').includes('live'));
  assert.equal(live.length, 1);
  assert.deepEqual(all(live[0], 'tm-badge').map((b) => b.textContent), ['Now']);
  assert.equal(all(root, 'tm-badge').length, 1, 'a coming row wears no "Now"');
  const count = all(live[0], 'tm-count')[0];
  assert.equal(count.textContent, '0:05');
  now += 2000; view.draw();
  assert.equal(all(root, 'tm-raid')[0], live[0], 'the same row, moved on');
  assert.equal(count.textContent, '0:03');
});

test('TIMERS2 the bar: All and a button for each group with a row, each its count and a mark where one is under way; a press shows that group alone, pressed, and the next window opens on it; a group that empties hands the list back to All; no clock, no bar (mutants: the press ignored; the choice forgotten; an emptied group left showing nothing; a bar with nothing to show)', () => {
  let now = NOW;
  const read = () => ({ now, raids: RAIDS, region: 'Daggerfall' });
  const doc = fakeDoc();
  const view = timersWindow(doc, { read, onClose() {}, every: 1e9, group: 'all' });
  view.stop();
  const root = view.root;
  const chips = () => all(root, 'tm-chip');
  assert.deepEqual(chips().map((c) => [all(c, 'tm-chip-name')[0].textContent, all(c, 'tm-chip-n')[0].textContent, c.attrs['aria-pressed'], c.className.split(' ').includes('live')]), [
    ['All', '7', 'true', true], ['World', '3', 'false', false], ['Raids', '2', 'false', true], ['Resets', '2', 'false', false],   // the gate's omen and the next, the serpent's rising
  ]);
  const raids = chips()[2];
  raids.focus(); press(raids);
  assert.deepEqual(all(root, 'tm-section-name').map((n) => n.textContent), ['Town raids'], 'that group alone');
  assert.deepEqual(chips().map((c) => c.attrs['aria-pressed']), ['false', 'false', 'true', 'false']);
  assert.equal(doc.activeElement, chips()[2], 'the focus stays on the pressed button through the bar\'s rebuild');
  assert.equal(all(root, 'tm-row').length, 2);
  const next = timersWindow(fakeDoc(), { read, onClose() {}, every: 1e9 });
  next.stop();
  assert.deepEqual(all(next.root, 'tm-section-name').map((n) => n.textContent), ['Town raids'], 'the next window opens on the group last shown');
  // the raids end: the group empties, and the list is All again
  now = NOW + 2 * 3600_000;
  view.draw();
  assert.ok(!all(root, 'tm-chip-raids').length, 'no button for a group with no row');
  assert.deepEqual(all(root, 'tm-section-name').map((n) => n.textContent), ['World events', 'Resets'], 'All again - never a window showing nothing');
  assert.equal(all(root, 'tm-chip').find((c) => c.attrs['aria-pressed'] === 'true')?.className.includes('tm-chip-all'), true);
  // no clock: no rows, no bar - the empty list says why
  const lone = timersWindow(fakeDoc(), { read: () => ({ now: NaN }), onClose() {}, every: 1e9, group: 'all' });
  lone.stop();
  assert.equal(all(lone.root, 'tm-chip').length, 0);
  assert.equal(all(lone.root, 'tm-empty').length, 1, 'no clock: said so, as TIMERS1 said it');
  view.show('all');   // the choice back to All for the next test in this process
});

test('TIMERS2 the sheet: the Elite Breach\'s rows in its arch\'s gold (they drew in no colour), the gate\'s red the colour its Discord card wears, the bar and the badge styled, and Stone\'s light ground lifting the badge past 4.5:1 (mutants: the elite\'s colour dropped; the gate\'s a literal again)', () => {
  assert.ok(ENHANCED_CSS.includes(`.px-timerswin .tm-elite { --tm-kind: ${EG_ARCH_RING_CSS}; }`));
  assert.ok(ENHANCED_CSS.includes(`.px-timerswin .tm-gate { --tm-kind: ${heraldCss('gate')}; }`));
  for (const rule of ['.px-timerswin .tm-groups {', '.px-timerswin .tm-chip {', '.px-timerswin .tm-chip.on {', '.px-timerswin .tm-badge {', '.px-timerswin .tm-section-live {']) assert.ok(ENHANCED_CSS.includes(rule), rule);
  assert.match(ENHANCED_CSS, /@media \(max-width: 560px\) \{[^}]*\}\n  \.px-timerswin \.tm-count \{ font-size: 16px; \}\n[^\n]*\n  \.px-timerswin \.tm-row \{ flex-wrap: wrap; \}\n  \.px-timerswin \.tm-text \{ flex: 1 1 0; \}\n  \.px-timerswin \.tm-door \{ flex: 1 0 100%;/, 'a row\'s door on a line of its own on a phone (seen at 390x844: beside the clock it left the words a word a line)');
  assert.match(ENHANCED_CSS, /:root\[data-plus-theme="stone"\] \.px-timerswin \.tm-badge, :root\[data-plus-theme="stone"\] \.px-timerswin \.tm-section-live \{ color: #c8ffd6; \}/, 'TIMERS1\'s live green on Stone (7.1:1 over its panel, as timers1.test.js measures it)');
});
