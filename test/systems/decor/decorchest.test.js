// A shared chest opens on the peeked rows, then the service's list replaces them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindDecorHouse, noteDecorBin, openSharedChest } from '../../../src/systems/decor/decorGrants.js';
import { applyTransfer } from '../../../src/systems/item/itemTransfer.js';

test('DECOR-ACCESS the first take uses the row the window drew', async () => {
  const shown = { uid: 'aaaaaaaaaaaaaaaa', stackCount: 2, templateIndex: 12 };
  const fresh = { uid: shown.uid, stackCount: 5, templateIndex: 12 };
  const potion = { stackCount: 3, templateIndex: 41 };
  const potionFresh = { stackCount: 3, templateIndex: 41 };
  let release;
  const listed = new Promise((r) => { release = r; });
  let opened = null;
  bindDecorHouse({
    use: (body) => (body.op === 'list' ? listed : Promise.resolve({ ok: true })),
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => [], take() {}, give() {}, say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
  });
  noteDecorBin('chest-first', [shown, potion]);
  assert.equal(await openSharedChest('chest-first'), true);
  const go = (item) => {
    const from = opened.loot.items();
    if (!from.includes(item)) return null;
    from.splice(from.indexOf(item), 1);
    return item;
  };
  const take = opened.loot.commit('take', shown, 1, () => go(shown));
  const takePotion = opened.loot.commit('take', potion, 1, () => go(potion));
  release({ ok: true, data: { items: [fresh, potionFresh] } });
  assert.equal(await take, true);
  assert.equal(shown.stackCount, 5, 'the row keeps its place and takes the service\'s count');
  assert.equal(await takePotion, true);
  assert.deepEqual(opened.loot.items(), []);
});

test('DECOR-ACCESS gold in a chest is written with the other goods and taken back as purse', async () => {
  const pack = [];
  const given = [];
  const lying = { uid: 'dddddddddddddddd', group: 'Currency', templateIndex: 276, stackCount: 4, value: 1 };
  const sent = [];
  let opened = null;
  bindDecorHouse({
    use: (req) => { if (req.op === 'settle') sent.push(req); return req.op === 'list' ? Promise.resolve({ ok: true, data: { items: req.id === 'chest-lying' ? [lying] : [] } }) : Promise.resolve({ ok: true }); },
    mapId: 1, buildingKey: 2, character: () => 'c',
    items: () => pack,
    take(uid) { const i = pack.findIndex((it) => it?.uid === uid); if (i >= 0) pack.splice(i, 1); },
    give(it) { given.push(it); },
    say() {}, refusal: (e) => e,
    open: (spec) => { opened = spec; },
    realm: () => async ({ apply, call }) => { call({ id: 'r', seq: 2 }); apply(); return { ok: true }; },
  });
  noteDecorBin('chest-gold', []);
  assert.equal(await openSharedChest('chest-gold'), true);
  const dropped = opened;
  const pile = { group: 'Currency', templateIndex: 276, stackCount: 4, value: 1 };
  const goods = dropped.loot.items();
  assert.equal(await dropped.loot.commit('put', pile, 4, () => { goods.push(pile); return pile; }), true);
  assert.equal(pack.includes(pile), true, 'the save carries the pile until the chest keeps it');
  assert.equal(await dropped.loot.commit('take', pile, 4, () => { goods.splice(goods.indexOf(pile), 1); return null; }), true);
  assert.equal(pack.includes(pile), false, 'taking the same pile back leaves the pack');
  dropped.loot.closed();
  noteDecorBin('chest-lying', [lying]);
  assert.equal(await openSharedChest('chest-lying'), true);
  const from = opened.loot.items();
  assert.equal(await opened.loot.commit('take', from[0], 4, () => { from.splice(0, 1); return null; }), true);
  opened.loot.closed();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].take, [lying.uid]);
  assert.equal(given.length, 0, 'the purse already has the coins');
});

test('DECOR-ACCESS a shared chest keeps each stack whole until the settle joins them', () => {
  const chest = [{ uid: 'aaaaaaaaaaaaaaaa', group: 'Gems', templateIndex: 0, stackCount: 98 }];
  const pile = { uid: 'bbbbbbbbbbbbbbbb', group: 'Gems', templateIndex: 0, stackCount: 54 };
  applyTransfer(pile, { amount: 54 }, [pile], chest, { stack: false });
  assert.equal(chest.length, 2);
  assert.equal(chest[0].stackCount, 98);
  assert.equal(chest[1].stackCount, 54);
});
