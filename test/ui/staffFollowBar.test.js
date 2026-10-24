// STAFF-FOLLOW-UNLOCK (mob 2026-10-24: "follow needs a unlock button in game"): the follow's bar on the game's screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStaffFollowBar } from '../../src/ui/staffFollowBar.js';
import { staffFollowOnPage } from '../../src/scenes/staffFollowHost.js';

function fakeDoc() {
  const doc = { made: 0 };
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, on: {}, style: {}, textContent: '', removed: false, writes: 0 };
    n.append = (...cs) => n.children.push(...cs);
    n.setAttribute = (k, v) => { n.attrs[k] = v; };
    n.addEventListener = (k, f) => (n.on[k] ??= []).push(f);
    n.remove = () => { n.removed = true; };
    n.fire = (k) => { const e = { stopped: false, stopPropagation() { e.stopped = true; }, preventDefault() {} }; for (const f of n.on[k] ?? []) f(e); return e; };
    return n;
  };
  doc.createElement = (tag) => { doc.made++; return node(tag); };
  doc.body = node('body');
  return doc;
}
const unlockOf = (doc) => doc.body.children[0].children.find((c) => c.attrs['data-staff-unlock'] != null);

test('STAFF-FOLLOW-UNLOCK the bar: made once on the first show, its Unlock a press the world never hears, hidden and shown without being made again', () => {
  const doc = fakeDoc();
  let unlocked = 0;
  const bar = createStaffFollowBar({ doc, onUnlock: () => { unlocked++; } });
  assert.equal(doc.made, 0, 'nothing made before a follow');
  bar.show();
  const root = doc.body.children[0];
  assert.equal(root.attrs['data-staff-follow-bar'], '');
  assert.equal(root.style.display, 'flex');
  assert.equal(root.children[0].textContent, 'Following');
  const made = doc.made;
  const e = unlockOf(doc).fire('click');
  assert.equal(unlocked, 1);
  assert.equal(e.stopped, true, 'the press is the bar\'s');
  assert.equal(unlockOf(doc).fire('mousedown').stopped, true);
  bar.hide();
  assert.equal(root.style.display, 'none');
  bar.show('Bran');
  assert.equal(root.children[0].textContent, 'Following Bran');
  assert.equal(doc.made, made, 'shown again, never made again');
  assert.doesNotThrow(() => createStaffFollowBar({ doc: null, onUnlock() {} }).show(), 'no document: nothing');
});

test('STAFF-FOLLOW-UNLOCK the page: the bar stands while the follow is locked, its Unlock lets go, and it goes with the follow', () => {
  const doc = fakeDoc();
  const listeners = [];
  const win = { document: doc, location: { origin: 'https://game.test' }, addEventListener: (_k, f) => listeners.push(f), postMessage: () => {} };
  const page = staffFollowOnPage({ main: () => null, prepare: async () => {}, mode: () => 'exterior', pixel: () => ({ x: 1, y: 1 }), toScene: () => null, win, Session: class { tick() {} leave() {} } });
  page.frame();
  assert.equal(doc.made, 0, 'no follow: no bar');
  let locked = true, unlocks = 0;
  page.hook.locked = () => locked;
  page.hook.unlock = () => { unlocks++; locked = false; };
  page.hook.place = () => null; page.hook.view = () => null;
  page.frame();
  const root = doc.body.children[0];
  assert.equal(root.style.display, 'flex');
  unlockOf(doc).fire('click');
  assert.equal(unlocks, 1, 'Unlock lets go');
  page.frame();
  assert.equal(root.style.display, 'none', 'let go: the bar goes');
});
