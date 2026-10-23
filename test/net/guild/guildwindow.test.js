// GUILD-WINDOW (2026-10-23, the owner: "overhaul the guild tab to be more of a full fledged detailed window with easy
// navigation and readabity instead of being stuffed as a small window in the social tab") - THE GUILD TAB IS A WINDOW
// OF ITS OWN (bible/11-Multiplayer/Guild-Overhaul.md GUILD-WINDOW): the panel in its guild mode while the Guild tab is
// up, its Social button back to the tab last up, the pages a column with their counts and what each holds (the arrow
// keys walk it), each page's sections in cards with the last act's words above them, the column's scroll kept across a
// repaint of the same page, and the window's own rules in the sheet. GUILD2's pins (guild2_client.test.js) hold
// everything inside the pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GUILD_RANK_NAMES } from '../../../src/net/guild/guildLaw.js';
import { GuildBook } from '../../../src/net/guild/guildBook.js';
import { createSocialPanel, SOCIAL_CSS, guildPageWords, guildOnlineText } from '../../../src/ui/socialPanel.js';
import { SocialState } from '../../../src/net/social.js';

const WOLF = { field: 'azure', border: 'gold', device: 'wolf' };
const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 30_000, hallGold: 30_000, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } }],
  invites: [], ledger: [], hall: null, heraldry: WOLF, renamedAt: null, renameAt: null,
  vault: { used: 1, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } }, ...over,
});

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(),
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    getAttribute(k) { return n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() { ev.prevented = true; }, stopPropagation() { ev.stopped = true; }, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { doc.activeElement = n; },
    remove() {},
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const one = (n, cls) => find(n, cls)[0];
const settle = () => new Promise((r) => setImmediate(r));

async function rig(guild = view(), { vaultItems = [], noBook = false } = {}) {
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    vault: async () => ({ ok: true, data: { vault: { max: 50, items: vaultItems, log: [], me: guild.vault.me } } }),
    vaultTake: async () => ({ ok: false, error: 'guild-vault-empty' }),
  };
  const pack = { items: () => [], add() {}, changed() {}, reach: () => true };
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), pack, realm: { act: async ({ call }) => call(7) } });
  const doc = fakeDocument();
  const panel = createSocialPanel({ social: new SocialState({ acct: 'a' }), guild: noBook ? null : book, doc, win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  const go = async (p) => { panel.openGuild(p); for (let i = 0; i < 4; i++) { await settle(); panel.render(); } };
  return { panel, doc, book, go, root: panel.root };
}

test('GUILD-WINDOW the Guild tab is the window: the panel in its guild mode, named Guild, the social tabs put away behind its Social button - which goes back to the tab last up; a panel with no guild book has no such button and never leaves its social mode (mutants: the mode unwritten; the name unmoved; the way back to Friends always)', async () => {
  const t = await rig();
  assert.equal(t.root.dataset.mode, 'social', 'made social');
  t.panel.open();
  find(t.root, 'dfsocial-tab').find((b) => b.dataset.tab === 'party').fire('click');
  assert.deepEqual([t.root.dataset.mode, one(t.root, 'dfsocial-title').textContent, t.root.attrs['aria-label']], ['social', 'Social', 'Friends and party']);
  await t.go();
  assert.deepEqual([t.panel.tab(), t.root.dataset.mode, one(t.root, 'dfsocial-title').textContent, t.root.attrs['aria-label']], ['guild', 'guild', 'Guild', 'Guild']);
  const back = one(t.root, 'dfsocial-back');
  assert.equal(back.parent, one(t.root, 'dfsocial-head'), 'in the window\'s own head');
  back.fire('click');
  assert.deepEqual([t.panel.tab(), t.root.dataset.mode, one(t.root, 'dfsocial-title').textContent], ['party', 'social', 'Social'], 'back to the Party tab it came from');
  const bare = await rig(view(), { noBook: true });
  bare.panel.open();
  assert.equal(find(bare.root, 'dfsocial-back').length, 0);
  assert.equal(bare.panel.openGuild(), false);
  assert.equal(bare.root.dataset.mode, 'social');
});

test('GUILD-WINDOW the column of pages: each page its name, its count where it has one - the members and the vault - and what it holds in words; the arrow keys walk it both ways round, the focus with them, and nothing else is taken (mutants: a count lost; the words unread; the walk one way; a key not ours stopped)', async () => {
  const t = await rig();
  await t.go();
  const nav = one(t.root, 'dfguild-nav');
  assert.ok(String(nav.className).split(/\s+/).includes('dfsocial-subtabs'), 'GUILD2\'s strip, a column now');
  assert.equal(nav.attrs['aria-orientation'], 'vertical');
  const tabs = find(nav, 'dfsocial-subtab');
  const GUILD_PAGE_WORDS = guildPageWords();
  assert.deepEqual(tabs.map((b) => [b.dataset.page, one(b, 'dfguild-navlabel').textContent, one(b, 'dfguild-navcount')?.textContent ?? null, one(b, 'dfguild-navsub').textContent]), [
    ['overview', 'Overview', null, GUILD_PAGE_WORDS.overview], ['members', 'Members', '1/75', GUILD_PAGE_WORDS.members],
    ['treasury', 'Treasury', null, GUILD_PAGE_WORDS.treasury], ['vault', 'Vault', '1/50', GUILD_PAGE_WORDS.vault],
    ['arms', 'Arms', null, GUILD_PAGE_WORDS.arms], ['settings', 'Settings', null, GUILD_PAGE_WORDS.settings],
  ]);
  const page = () => one(t.root, 'dfguild-main').dataset.page;
  const key = (code) => find(t.root, 'dfsocial-subtab').find((b) => b.dataset.page === page()).fire('keydown', { code });
  assert.equal(key('ArrowDown').prevented, true);
  assert.equal(page(), 'members');
  assert.equal(t.doc.activeElement, find(t.root, 'dfsocial-subtab')[1], 'the focus on the page turned to');
  key('ArrowUp'); key('ArrowUp');
  assert.equal(page(), 'settings', 'up from the first is the last');
  key('ArrowDown');
  assert.equal(page(), 'overview', 'and down from the last the first');
  const other = key('KeyW');
  assert.deepEqual([page(), !!other.prevented, !!other.stopped], ['overview', false, false], 'a key not ours goes on to the world');
});

test('GUILD-WINDOW a page in cards: every section heading opens a card of its own, what stands before the first is a card too, and the last act\'s words stand above them all - never inside one (mutants: the cards unmade; the heading not opening one; the words carded)', async () => {
  const t = await rig(view(), { vaultItems: [{ slot: 3, rec: null, name: 'Arrow', count: 25, by: 'Aldric', at: 99 }] });
  await t.go('members');
  const main = one(t.root, 'dfguild-main');
  assert.equal(main.parent, one(t.root, 'dfguild-layout'));
  assert.equal(one(t.root, 'dfguild-layout').children[0], one(t.root, 'dfguild-nav'), 'the column of pages beside the page');
  for (const sec of find(main, 'dfsocial-sec')) {
    assert.equal(sec.parent.className, 'dfguild-card', sec.textContent);
    assert.equal(sec.parent.children[0], sec, `${sec.textContent} heads its card`);
  }
  assert.deepEqual(main.children.map((c) => c.className), ['dfguild-card', 'dfguild-card'], 'Members, then Invite');
  await t.go('vault');
  const take = find(t.root, 'dfsocial-btn').find((b) => b.textContent === 'Take');
  take.fire('click');
  for (let i = 0; i < 4; i++) { await settle(); t.panel.render(); }
  const said = one(t.root, 'dfguild-said');
  assert.ok(said, 'the answer said');
  assert.equal(said.parent, one(t.root, 'dfguild-main'), 'above the cards, in the page\'s column');
  assert.equal(said.parent.children[0], said);
  assert.ok(String(said.className).split(/\s+/).includes('dfsocial-err'), 'a refusal still dressed as one');
  const none = await rig(view());
  none.book.refresh = async () => {};
  none.panel.openGuild();
  const alone = one(none.root, 'dfguild-main');
  assert.ok(String(alone.className).split(/\s+/).includes('dfguild-alone'), 'looking: one column, no pages');
  assert.equal(alone.children[0].className, 'dfguild-card');
});

test('GUILD-WINDOW the page\'s column keeps its place: drawn again on the same page it is where it was scrolled to; another page starts at its top (mutants: the place lost; the place carried to another page)', async () => {
  const t = await rig();
  await t.go('members');
  one(t.root, 'dfguild-main').scrollTop = 300;
  t.panel.openGuild();   // a fresh look: the page drawn again
  const again = one(t.root, 'dfguild-main');
  assert.equal(again.dataset.page, 'members');
  assert.equal(again.scrollTop, 300);
  t.panel.openGuild('treasury');
  assert.ok(!(one(t.root, 'dfguild-main').scrollTop > 0), 'the Treasury from its top');
});

test('GUILD-WINDOW the header\'s Members tile says how many are online, by the roster rows\' own reading - the reader always, a member inside the grace, never one past it or with no stamp (mutants: the unstamped counted)', () => {
  const now = 1_800_000_000_000, nowS = now / 1000;
  assert.equal(guildOnlineText([{ seenAt: nowS - 5 }, { seenAt: nowS - 86_400 }, { you: true, seenAt: 1 }, {}], now), '2 online');
  assert.equal(guildOnlineText([], now), '0 online');
  assert.equal(guildOnlineText(null, now), '0 online');
});

test('GUILD-WINDOW the sheet: the window centred and sized past every place the social mode takes (the chat\'s fits included), the social tabs put away, the Social button shown in the window alone, and the screen taken whole on a small one (mutants: a rule lost)', () => {
  const css = SOCIAL_CSS.replace(/\s+/g, ' ');
  assert.ok(css.includes(':root .dfsocial[data-mode="guild"][data-open], :root .dfsocial.touch[data-mode="guild"][data-open] { --dfguild-w: min(1060px, calc(100vw - 28px)); --dfguild-h: min(740px, calc(100vh - 56px));'));
  assert.ok(css.indexOf(':root .dfsocial[data-mode="guild"][data-open]') > css.indexOf(':root[data-dfchat-fit="below"] .dfsocial, :root[data-dfchat-fit="below"] .dfsocial.touch'), 'after the chat\'s fits, which it equals in weight');
  assert.ok(css.includes('.dfsocial[data-mode="guild"] .dfsocial-tabs { display: none; }'));
  assert.ok(css.includes('.dfsocial-back { display: none;'));
  assert.ok(css.includes('.dfsocial[data-mode="guild"] .dfsocial-back { display: block; }'));
  assert.ok(css.includes('.dfsocial[data-mode="guild"] .dfsocial-body { overflow: hidden; padding: 0; }'), 'the page\'s column scrolls, not the window');
  assert.ok(css.includes('.dfguild-main { flex: 1; min-width: 0; overflow-y: auto;'));
  assert.ok(css.includes('@media (max-width: 760px), (max-height: 520px) {'));
  assert.ok(css.includes('.dfguild-layout { flex-direction: column; }'));
});
