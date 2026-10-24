// FERRY-CLEAR (2026-10-24, Discord - "Ferrys still unstable": "Had several issues with the ferry ramming a neighbour ship
// till it broke, or running ashore") - THE NAVAL HOST'S HALF: a booked ship's master never rams (her stem in a neighbour's
// side broke one or the other, the passenger charged with piracy for it), and the sea's ships afloat are what the
// journey's hand steers round (the host's `hullAlong`, over systems/naval/seaClearance.js). The hand's own half, lifted
// from world.js over Come Sail Away's real runtime, is test/systems/auditships_sail.test.js FERRY-CLEAR. The law is
// bible/03-World/Passage.md FERRY-CLEAR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HULL, hullBuild } from '../../../src/systems/naval/navalShips.js';
import { hullBoxOf, RAM_REACH, RAM_DAMAGE } from '../../../src/scenes/naval/navalHost.js';
import { HULL_CLEAR_M } from '../../../src/systems/naval/seaClearance.js';
import { segmentBoxEntry } from '../../../src/systems/naval/navalBallistics.js';
import { sea } from '../../navalSea.mjs';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b} (±${eps})`);
async function helm(o = {}) {
  const h = await sea({ hull: HULL.SmallShip, ...o, settings: { ShipsAtSea: 'off', Boarders: false, ...(o.settings ?? {}) } });
  const e = h.host._sea.get(h.host.spawnShip('merchantGalleon', { range: 900 }));
  return { ...h, e };
}
function frames(h, held, n = 1) {
  for (let i = 0; i < n; i++) {
    for (const [e, p] of held) { e.ship.pos = [...p.pos]; e.ship.yaw = p.yaw ?? 0; e.ship.speed = p.speed ?? 0; e.ship.yawRate = 0; }
    h.host.frame(0.1);
  }
}
/** Her broadside across my bow (my boat at the origin heading +z), her near side `gap` past my stem (H11's). */
function across(h, gap) {
  frames(h, [[h.e, { pos: [0, 0, 90], yaw: Math.PI / 2 }]]);
  const b = hullBoxOf(h.e.boat, h.pool.models);
  const ext = Math.abs(b.ax[2]) * b.h[0] + Math.abs(b.ay[2]) * b.h[1] + Math.abs(b.az[2]) * b.h[2];
  return { pos: [0, 0, 90 + hullBuild(HULL.SmallShip).bowZ + gap - (b.c[2] - ext)], yaw: Math.PI / 2 };
}

test('FERRY-CLEAR a booked ship\'s master never rams: her stem driven into a ship\'s side at a ram\'s way deals nothing, takes nothing back, says nothing and charges nobody - the same stem on a boat of mine rams as AUDIT NAV1 H11 has it (mutants: the charter unread)', async () => {
  const h = await helm();
  h.boat.charter = { v: 1, ship: 'Sea Hare', to: 'Daggerfall' };   // passage.js charterRecord's shape is the voyage's; the ram asks only that she is booked
  const way = (v) => { h.runtime.state.velocityCurrent = [0, 0, v]; };
  const touching = across(h, RAM_REACH / 2);
  const full = h.e.ship.damage.hull;
  const mine = h.host.hudModel().ship.hull;
  way(6);
  frames(h, [[h.e, across(h, 30)]]);
  way(0.1);
  frames(h, [[h.e, touching]], 3);
  assert.equal(h.e.ship.damage.hull, full, 'her hull whole');
  assert.equal(h.host.hudModel().ship.hull, mine, 'nothing back on the booked ship');
  assert.ok(!h.e.charged?.has('fire'), 'no charge of piracy');
  // the same stem on a boat of mine: the ram
  delete h.boat.charter;
  frames(h, [[h.e, { pos: [0, 0, 600], yaw: 0 }]], 40);
  way(6);
  frames(h, [[h.e, across(h, 30)]]);
  way(0.1);
  frames(h, [[h.e, touching]]);
  assert.equal(full - h.e.ship.damage.hull, Math.round(6 * RAM_DAMAGE), 'a boat of mine rams');
});

test('FERRY-CLEAR the host hands the journey\'s hand the sea\'s ships afloat: along her bow a ship ahead stops its look HULL_CLEAR_M off her near side, and a look past her goes on (mutants: the sea unhanded)', async () => {
  const h = await helm();
  frames(h, [[h.e, { pos: [0, 0, 120], yaw: Math.PI / 2 }]]);
  const b = hullBoxOf(h.e.boat, h.pool.models);
  const entry = segmentBoxEntry([0, b.c[1], 0], [0, b.c[1], 300], b, HULL_CLEAR_M);
  assert.ok(entry && entry.t > 0, 'her clearance across the bow\'s look');
  near(h.host.hullAlong([0, 0, 0], 0, 1, 300), entry.t * 300, 1e-6, 'HULL_CLEAR_M off her near side');
  assert.equal(h.host.hullAlong([0, 0, 0], 1, 0, 300), Infinity, 'a look past her');
});
