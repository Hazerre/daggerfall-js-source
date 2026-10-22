// The free camera's menu: Move, Duplicate and Remove for a placed piece, and nothing for the building's own
// furniture, its cupboards or its structure. A cancelled action writes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorAimKind, decorLookOffers } from '../../../src/systems/decor/decorLook.js';
import { toolRig, placeFrom, all, rows, settle } from '../../decorFakes.mjs';

const piece = { id: 'p', model: 41000, item: null, storage: false, station: null, door: false };

test('the look tells a placed piece from the building\'s own furniture, a cupboard and the structure', () => {
  assert.equal(decorAimKind('decor:p', piece), 'decor');
  assert.equal(decorAimKind('decor:p', { ...piece, storage: true }), 'container');
  assert.equal(decorAimKind('decor:p', { ...piece, station: 'alchemy' }), 'station');
  assert.equal(decorAimKind('decor:p', { ...piece, door: true }), 'door');
  assert.equal(decorAimKind('base:chair'), 'base');
  assert.equal(decorAimKind('container:3'), 'container');
  assert.equal(decorAimKind('exit:0'), 'structural');
  assert.equal(decorAimKind('act:door'), 'structural');
  assert.equal(decorAimKind('intdoor:2'), 'roomdoor');
  assert.deepEqual(decorLookOffers({ key: 'intdoor:2', kind: 'roomdoor', mayEdit: true }), { move: false, duplicate: false, remove: true });
  assert.equal(decorLookOffers({ key: 'intdoor:2', kind: 'roomdoor', mayEdit: false }).remove, false);
  assert.deepEqual(decorLookOffers({ piece, kind: 'decor', holds: false, mayEdit: true }), { move: true, duplicate: true, remove: true });
  assert.equal(decorLookOffers({ piece, kind: 'container', holds: true, mayEdit: true }).remove, false);
  assert.equal(decorLookOffers({ piece: { ...piece, item: { id: 1 } }, kind: 'decor', mayEdit: true }).duplicate, false);
  assert.deepEqual(decorLookOffers({ piece, kind: 'base', mayEdit: true }), { move: false, duplicate: false, remove: false });
  assert.deepEqual(decorLookOffers({ key: 'exit:0', mayEdit: true }), { move: false, duplicate: false, remove: false });
  assert.equal(decorLookOffers({ piece, kind: 'decor', mayEdit: false }).move, false);
  assert.equal(decorLookOffers({ piece, kind: 'station', holds: false, mayEdit: true }).move, true);
});

test('looking at a placed piece during the flight offers move, duplicate and remove, and leaving writes nothing', async () => {
  const rig = toolRig({ gold: 5000 });
  await placeFrom(rig, 'm41000');
  assert.equal(await rig.tool.commit(), true);
  rig.tool.back();
  const first = rig.standing[0];
  const gold = rig.w.gold;
  const root = rig.doc.body.children.find((c) => c.className === 'dfdecor');
  for (let i = 0; i < 6; i++) { rig.frame({ overlayUp: true }); await settle(); }
  rows(root).find((r) => r.dataset.key === 'm41001').fire('click');
  all(root, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  rig.frame();
  await settle();
  rig.frame();
  rig.aim.push({ key: `decor:${first.id}`, aabb: { min: [9.5, 1, 11], max: [10.5, 2.5, 12.2] }, distance: 8, reach: 8 });
  rig.frame();
  const menu = rig.doc.body.children.find((c) => String(c.className).split(/\s+/).includes('dfdecor-look'));
  assert.equal(menu.dataset.up, '1');
  const shown = (label) => all(menu, 'dfdecor-btn').find((b) => b.textContent === label).style.display !== 'none';
  assert.deepEqual([shown('Move'), shown('Duplicate'), shown('Remove')], [true, true, true]);
  all(menu, 'dfdecor-btn').find((b) => b.textContent === 'Duplicate').fire('click');
  rig.frame();
  await settle();
  rig.frame();
  const g = rig.tool.ghost();
  assert.ok(g && g.id !== first.id && g.model === first.model);
  assert.equal(rig.standing.length, 1);
  assert.equal(rig.w.gold, gold);
  rig.tool.back();
  assert.equal(rig.standing.length, 1);
  assert.equal(rig.w.gold, gold);
  rig.frame();
  assert.equal(menu.dataset.up, '0', 'the menu is down once the flight is');
});
