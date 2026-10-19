// TV-PACE (2026-10-19): the Overworld's ceiling reads the mount. On foot ×10. A horse, a cart or a caravan at Fed ×20.
// Hungry or Starving, the same mounts, ×10. The hungriest horse of a team is the one whose food runs out first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountHunger, STARVING_AFTER } from '../../../src/systems/steedCare.js';
import { createUpkeep } from '../../../src/systems/upkeep/upkeepRuntime.js';
import { TV_PACE_FOOT, TV_PACE_MOUNT } from '../../../src/systems/travel/travelPace.js';

const T0 = 1_000_000;
const horse = (fed, seed = 1) => ({ group: 'Transportation', templateIndex: 94, horseSeed: seed, horseFed: fed });
const wagon = (kind) => ({ group: 'Transportation', templateIndex: 93, wagonKind: kind });

test('TV-PACE the team: the ridden horse, or the hungriest of the horses that pull, and the upkeep says the ceiling', () => {
  assert.equal(mountHunger([horse(T0 + 60)], T0, { mode: 'Horse' }), 'fed');
  assert.equal(mountHunger([horse(T0)], T0, { mode: 'Horse' }), 'hungry');
  assert.equal(mountHunger([horse(T0 - STARVING_AFTER)], T0, { mode: 'Cart', horsesNeeded: 1 }), 'starving');
  assert.equal(mountHunger([], T0, { mode: 'Cart', horsesNeeded: 1 }), 'fed', 'a cart with no horse is not hungry');
  assert.equal(mountHunger([horse(T0)], T0, { mode: 'Foot' }), 'fed');
  const items = [horse(T0 + 600, 1), horse(T0 - STARVING_AFTER, 2), wagon('caravan')];
  assert.equal(mountHunger(items, T0, { mode: 'Horse' }), 'fed', 'the saddle reads the horse ridden, the first');
  assert.equal(mountHunger(items, T0, { mode: 'Cart', horsesNeeded: 2 }), 'starving', 'a caravan\'s two, the hungriest');
  assert.equal(mountHunger(items, T0, { mode: 'Cart', horsesNeeded: 1 }), 'fed', 'a small cart\'s one horse');
  const u = createUpkeep({ items: () => items, now: () => T0, horseCare: () => null });
  assert.equal(u.travelViewCap('Foot'), TV_PACE_FOOT);
  assert.equal(u.travelViewCap('Horse'), TV_PACE_MOUNT);
  assert.equal(u.travelViewCap('Cart'), TV_PACE_FOOT, 'the caravan they drive takes two, and one is starving');
  const cart = [horse(T0 + 60, 3), wagon('cart')];
  const fed = createUpkeep({ items: () => cart, now: () => T0, horseCare: () => null });
  assert.equal(fed.travelViewCap('Cart'), TV_PACE_MOUNT);
});
