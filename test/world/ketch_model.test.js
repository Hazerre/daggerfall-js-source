// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): THE SHIP AS BUILT AGAINST ITS DECK PLAN - a foot finds
// every floor where the plan says it stands (the Anchor Deck, the waist, the gun deck and its landing, the hold, the main
// top and its yard, the gangway, the bridge's core), the hatches open in the floor, the quarter wall closing the waist,
// nothing under the Sailwalk but sky, the bridge's outer ring its sections' own (they fall), every part solid where it
// must be; the course a body can run - its gaps within the Hour's envelope, its drops under the fall that hurts.
// tools/mutants/ketch_model.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKetchShip, buildKetchParts, KT_FLOOR_T } from '../../src/world/ketch/ketchModel.js';
import {
  deckToDungeon, KT_WAIST, KT_HATCH, KT_HOLD_HATCH, KT_QUARTER_WALL, KT_MAIN_TOP, KT_YARD, KT_GANGWAY, KT_BRIDGE, KT_COURSE, KT_COURSE_SPEC,
  KT_SECTIONS, KT_RESONATORS, sectionAt, KT_LIFT,
} from '../../src/net/ketch/ketchDeck.js';
import { EG_GAP_MIN_CM, EG_GAP_MAX_CM } from '../../src/net/eliteGates/egSpanLaw.js';
import { FALL_DAMAGE_THRESHOLD } from '../../src/player/motor.js';
import { ketchShipLocation } from '../../src/world/ketch/ketchShip.js';
import { madeDungeon, dungeonTierLabel } from '../../src/world/dungeon/dungeonLabel.js';

const ship = buildKetchShip();
/** The nearest hit of a ray from deck point `o` along `d` on a triangle soup (the dungeon's frame), as the deck's distance. */
function cast(hit, o, d, max = 200) {
  const O = deckToDungeon(...o), best = { t: Infinity };
  for (let i = 0; i < hit.length; i += 9) {
    const ax = hit[i], ay = hit[i + 1], az = hit[i + 2];
    const e1 = [hit[i + 3] - ax, hit[i + 4] - ay, hit[i + 5] - az], e2 = [hit[i + 6] - ax, hit[i + 7] - ay, hit[i + 8] - az];
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-9) continue;
    const s = [O[0] - ax, O[1] - ay, O[2] - az], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (t > 1e-6 && t < best.t) best.t = t;
  }
  return best.t <= max ? best.t : null;
}
/** The floor's height under deck point (x, z), looking down from `from`. */
const floorAt = (hit, x, z, from) => { const t = cast(hit, [x, from, z], [0, -1, 0]); return t == null ? null : Math.round((from - t) * 100) / 100 + 0; };

test('KETCH A FOOT FINDS EVERY FLOOR WHERE THE PLAN SAYS: the Anchor Deck and the waist at 0, the gun deck and its landing at -6, the hold at -12, the main top and its yard at the lift\'s head, the gangway and the bridge\'s core at 0 (mutants: the hold a deck high; the yard missing)', () => {
  const H = ship.hit;
  assert.equal(floorAt(H, 0, 6, 3), 0, 'the Anchor Deck');
  assert.equal(floorAt(H, 0, 20, 3), 0, 'the waist');
  assert.equal(floorAt(H, 0, 80, -3), -6, 'the gun deck');
  assert.equal(floorAt(H, 6, 120, -3), -6, 'the landing');
  assert.equal(floorAt(H, 0, 100, -9), -12, 'the hold');
  assert.equal(floorAt(H, KT_MAIN_TOP.x + 4.5, KT_MAIN_TOP.z, KT_MAIN_TOP.y + 3), KT_MAIN_TOP.y, 'the main top');
  assert.equal(floorAt(H, (KT_YARD.x0 + KT_YARD.x1) / 2, KT_YARD.z, KT_YARD.y + 3), KT_YARD.y, 'the yard');
  assert.equal(floorAt(H, (KT_GANGWAY.ax + KT_GANGWAY.bx) / 2, (KT_GANGWAY.az + KT_GANGWAY.bz) / 2, 3), 0, 'the gangway');
  assert.equal(floorAt(H, KT_BRIDGE.x, KT_BRIDGE.z, 3), 0, 'the bridge\'s core');
  assert.ok(KT_FLOOR_T > 0);
});

test('KETCH THE WAYS DOWN AND THE WALLS: each hatch open in its floor (a stair under it, the grate its own part); the quarter wall closing the waist aft; the mast-lift\'s shaft open its height (mutants: the hatch floored over; the quarter wall missing)', () => {
  const H = ship.hit;
  const w = floorAt(H, 0, (KT_HATCH.z0 + KT_HATCH.z1) / 2, 3);
  assert.ok(w < -0.5 && w > -6.5, `under the Watch hatch a stair, not the deck (${w})`);
  const h = floorAt(H, 0, (KT_HOLD_HATCH.z0 + KT_HOLD_HATCH.z1) / 2, -3);
  assert.ok(h < -6.5 && h > -12.5, `under the hold hatch a stair (${h})`);
  const wall = cast(H, [0, 1, KT_WAIST.z1 - 4], [0, 0, 1]);
  assert.ok(wall != null && Math.abs(wall - (KT_QUARTER_WALL.z - (KT_WAIST.z1 - 4))) < 0.6, `the quarter wall at z ${KT_QUARTER_WALL.z}`);
  const shaft = floorAt(H, KT_LIFT.x, KT_LIFT.z, KT_LIFT.y1 - 1);
  assert.ok(shaft == null || shaft <= KT_LIFT.y0 + 0.01, 'the shaft open to the hold\'s floor (the cage its own part)');
  const P = buildKetchParts();
  assert.ok(P.grateWatch.hit.length > 0 && P.grateHold.hit.length > 0, 'the grates solid, apart');
  assert.ok(P.cage.hit.length > 0 && P.doors.hit.length > 0 && P.gateHold.hit.length > 0 && P.gateTop.hit.length > 0);
});

test('KETCH THE OPEN SKY AND THE FALLING RING: nothing under the Sailwalk but sky; the bridge\'s outer ring no floor of the ship\'s - each of its eight sections solid in its own part, a resonator on four of them (mutants: a section not solid)', () => {
  const H = ship.hit;
  for (const z of [70, 100, 140, 170]) assert.equal(floorAt(H, KT_COURSE_SPEC.x, z, KT_LIFT.y1 + 4), null, `open sky at z ${z}`);
  const ring = [KT_BRIDGE.x, KT_BRIDGE.z - (KT_BRIDGE.core + KT_BRIDGE.r) / 2];
  const f = floorAt(H, ring[0], ring[1], 3);
  assert.ok(f == null || f < -0.5, 'the ring\'s floor is its sections\'');
  const P = buildKetchParts();
  assert.equal(P.sections.length, KT_SECTIONS);
  for (let k = 0; k < KT_SECTIONS; k++) {
    const a = ((k + 0.5) * Math.PI) / 4, x = KT_BRIDGE.x + Math.sin(a) * 22, z = KT_BRIDGE.z + Math.cos(a) * 22;   // past the resonators' pylons (19 out)
    assert.equal(sectionAt(x, z), k);
    assert.equal(floorAt(P.sections[k].hit, x, z, 3), 0, `section ${k} solid`);
  }
  for (const [x, z] of KT_RESONATORS) assert.equal(sectionAt(x, z) % 2, 0, 'a resonator on 0, 2, 4, 6');
});

test('KETCH THE SAILWALK A BODY CAN RUN: every gap within the Hour\'s envelope; every step down under the fall that hurts; its last step at the bridge\'s deck (mutants: a gap past the envelope; the rigging dropping a body onto its health)', () => {
  let prev = null;
  for (const s of KT_COURSE.steps) {
    if (prev && prev.span === s.span) {   // across a section the top lies between (its own gaps the spec's `check` and the next piece's)
      const gap = (s.z - s.d / 2) - (prev.z + prev.d / 2);
      if (s.kind === 'riser') assert.ok(Math.abs(gap) < 1e-6, 'a riser climbed straight off the plate before it (the Hour\'s)');
      else assert.ok(gap * 100 >= EG_GAP_MIN_CM - 1 && gap * 100 <= EG_GAP_MAX_CM + 1, `gap before step ${s.i}: ${gap}`);
      assert.ok(prev.y - s.y < FALL_DAMAGE_THRESHOLD, `step ${s.i} drops ${prev.y - s.y}`);
      assert.ok(s.y - prev.y <= 2.31, `step ${s.i} rises at most the riser`);
    }
    prev = s;
  }
  for (const sec of KT_COURSE_SPEC.sections) if (sec.check != null) assert.ok(sec.check * 100 >= EG_GAP_MIN_CM && sec.check * 100 <= EG_GAP_MAX_CM, 'onto each top a jump');
  assert.ok(Math.abs(KT_COURSE.steps.at(-1).y) < 1e-9, 'down to the bridge\'s deck');
  assert.ok(KT_COURSE.checkpoints.every((c) => c.y >= 0));
});

test('KETCH A PLACE THE PORT MADE: her made location is no dungeon to tier - no "Regular Dungeon, Small" over her deck (the live run\'s banner) (mutants: the Ketch tiered)', () => {
  const loc = ketchShipLocation({ n: 1, owner: '0123456789abcdef' });
  assert.equal(madeDungeon(loc), true);
  assert.equal(dungeonTierLabel(loc), null);
});

test('KETCH THE SHAFT\'S GATES: the hold\'s open with the cage at its foot and the top\'s at the top while the lift runs - neither while it is dead, so no carrier steps off the hold\'s floor onto a dead cage; a cell carried off its deck is said lost, never let go (AUDIT KETCH L3-14; mutants: the hold\'s gate open on a dead lift; a lost cell said let go)', async () => {
  const { ketchShaftGates } = await import('../../src/scenes/ketch/ketchDeckHost.js');
  const { KT_LIFT } = await import('../../src/net/ketch/ketchDeck.js');
  const { KT_LINK_TEXT } = await import('../../src/net/ketch/ketchLink.js');
  assert.deepEqual(ketchShaftGates(KT_LIFT.y0, false), { hold: false, top: false }, 'dead at its foot: shut');
  assert.deepEqual(ketchShaftGates(KT_LIFT.y0, true), { hold: true, top: false });
  assert.deepEqual(ketchShaftGates(KT_LIFT.y1, true), { hold: false, top: true });
  assert.deepEqual(ketchShaftGates((KT_LIFT.y0 + KT_LIFT.y1) / 2, true), { hold: false, top: false }, 'between: both shut');
  assert.notEqual(KT_LINK_TEXT.dropped('Ann', 'left'), KT_LINK_TEXT.dropped('Ann', 'let'));
  assert.match(KT_LINK_TEXT.dropped('Ann', 'left'), /lost/);
});
