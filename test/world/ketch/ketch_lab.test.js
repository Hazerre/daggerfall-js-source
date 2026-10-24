// KETCH-LOOK KL0 (2026-10-24; bible/11-Multiplayer/Sky-Ketch-Look.md section 17): THE LAB'S EYES - the Ketch lab
// (src/tools/ketchLab.js) is where every piece of the polish is judged, so its cameras and knobs are pinned: every eye
// stands in open air clear of the ship's colliders and over a floor where it stands on a deck; `top-out` stands on the main
// top's ring outside the shaft, looking out along the yard; and the page reads every knob it names (?grey, ?lite, ?bill,
// the sky). tools/mutants/ketch_look_lab.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KT_LAB_VIEWS, KT_LAB_DECK_VIEWS, ketchLabKnobs } from '../../../src/tools/ketchLabViews.js';
import { buildKetchShip, buildKetchParts } from '../../../src/world/ketch/ketchModel.js';
import { deckToDungeon, KT_LIFT, KT_MAIN_TOP, KT_YARD } from '../../../src/net/ketch/ketchDeck.js';

const ship = buildKetchShip();
// the ship's one bucket and the bridge's outer ring (its eight sections stand in parts of their own - the ring is their floor)
const floors = Float32Array.from([...ship.hit, ...buildKetchParts().sections.flatMap((s) => [...s.hit])]);
/** The nearest distance from point `p` (the dungeon's frame) to the triangle soup `hit`. */
function nearest(hit, p) {
  let best = Infinity;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  for (let i = 0; i < hit.length; i += 9) {
    const a = [hit[i], hit[i + 1], hit[i + 2]], b = [hit[i + 3], hit[i + 4], hit[i + 5]], c = [hit[i + 6], hit[i + 7], hit[i + 8]];
    // the closest point on the triangle (Ericson's region test)
    const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
    let q;
    if (d1 <= 0 && d2 <= 0) q = a;
    else {
      const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
      if (d3 >= 0 && d4 <= d3) q = b;
      else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp), vc = d1 * d4 - d3 * d2, vb = d5 * d2 - d1 * d6, va = d3 * d6 - d5 * d4;
        if (d6 >= 0 && d5 <= d6) q = c;
        else if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); q = [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
        else if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); q = [a[0] + ac[0] * w, a[1] + ac[1] * w, a[2] + ac[2] * w]; }
        else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); q = [b[0] + (c[0] - b[0]) * w, b[1] + (c[1] - b[1]) * w, b[2] + (c[2] - b[2]) * w]; }
        else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; q = [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]; }
      }
    }
    best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
  }
  return best;
}
/** The height a ray down from deck point `o` first meets the ship's colliders (deck y), or null. */
function floorUnder(o) {
  const O = deckToDungeon(...o), hit = floors;
  let bestT = Infinity;
  for (let i = 0; i < hit.length; i += 9) {
    const ax = hit[i], ay = hit[i + 1], az = hit[i + 2];
    const e1 = [hit[i + 3] - ax, hit[i + 4] - ay, hit[i + 5] - az], e2 = [hit[i + 6] - ax, hit[i + 7] - ay, hit[i + 8] - az];
    const p = [-e2[2] * 0 + 0 * e2[1], 0, 0];   // the ray is straight down: d = (0, -1, 0)
    p[0] = -1 * e2[2] - 0; p[1] = 0; p[2] = 0 - -1 * e2[0];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-9) continue;
    const s = [O[0] - ax, O[1] - ay, O[2] - az], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = (-q[1]) / det;
    if (v < 0 || u + v > 1) continue;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
    if (t > 1e-6 && t < bestT) bestT = t;
  }
  return Number.isFinite(bestT) ? o[1] - bestT : null;
}

test('KETCH-LOOK KL0 THE LAB\'S EYES STAND IN OPEN AIR: every camera clear of the ship\'s colliders by a hand, and every deck camera over a floor within a body\'s height below it (mutants: an eye in the main top\'s rail)', () => {
  for (const [name, v] of Object.entries(KT_LAB_VIEWS)) {
    const d = nearest(ship.hit, deckToDungeon(...v.at));
    assert.ok(d >= 0.25, `${name}: ${d.toFixed(2)} m from a collider`);
  }
  for (const name of KT_LAB_DECK_VIEWS) {
    const v = KT_LAB_VIEWS[name], f = floorUnder(v.at);
    assert.ok(f != null && v.at[1] - f > 0.5 && v.at[1] - f <= 3.5, `${name}: the floor ${f} under an eye at ${v.at[1]}`);
  }
});

test('KETCH-LOOK KL0 THE TOP SEEN OUT OF IT: `top-out` stands on the main top\'s ring outside the mast-lift\'s shaft, looking out along the yard toward the Sailwalk - the `top` view stands at the shaft\'s gate and its bars fill the frame (mutants: top-out inside the shaft)', () => {
  const v = KT_LAB_VIEWS['top-out'], [x, , z] = v.at;
  const r = Math.hypot(x - KT_MAIN_TOP.x, z - KT_MAIN_TOP.z);
  assert.ok(r < KT_MAIN_TOP.r - 0.4, 'on the top');
  assert.ok(Math.abs(x - KT_LIFT.x) > KT_LIFT.half + 0.3 || Math.abs(z - KT_LIFT.z) > KT_LIFT.half + 0.3, 'outside the shaft');
  const yaw = (v.yaw * Math.PI) / 180, look = [Math.sin(yaw), Math.cos(yaw)];
  const to = [KT_YARD.x1 - x, KT_YARD.z - z], n = Math.hypot(...to);
  assert.ok((look[0] * to[0] + look[1] * to[1]) / n > 0.6, 'looking out along the yard');
});

test('KETCH-LOOK KL0 THE LAB\'S KNOBS: ?grey, ?lite (or the touch door), ?bill and the sky - on unless sky=0 - read off the query, and the page reads each: the frame in grey, the Steps\' lite set, the bill on the page and on __lab, the world\'s sky drawn after the opaque level (mutants: ?grey ignored; the sky off by default)', () => {
  assert.deepEqual({ ...ketchLabKnobs('') }, { grey: false, lite: false, bill: false, sky: true, weather: 'sunny', hour: 13, eye: 1, arena2: false });
  const k = ketchLabKnobs('?grey&lite&bill&sky=0&weather=rain&hour=18.5&eye=20&arena2');
  assert.deepEqual({ ...k }, { grey: true, lite: true, bill: true, sky: false, weather: 'rain', hour: 18.5, eye: 20, arena2: true });
  assert.equal(ketchLabKnobs('?eye=0.2').eye, 1, 'the eye never slower than the game\'s');
  assert.equal(ketchLabKnobs('?touch=on').lite, true, 'the touch door is the phone\'s tier');
  const src = readFileSync(new URL('../../../src/tools/ketchLab.js', import.meta.url), 'utf8');
  assert.match(src, /if \(knobs\.grey\) canvas\.style\.filter = 'grayscale\(1\)';/);
  assert.match(src, /createSdSteps\(\{ renderer, course: KT_COURSE, lite: knobs\.lite \}\)/);
  assert.match(src, /const sky = knobs\.sky \? new EnhancedSkyRenderer\(gl\) : null;/);
  assert.match(src, /window\.__lab\.bill = \(\) =>/);
  assert.ok(src.indexOf('renderer.drawMesh(d.gpu') < src.indexOf('sky.draw(') && src.indexOf('sky.draw(') < src.indexOf('renderer.drawBillboards('), 'the sky after the opaque level, before the billboards - the dungeon arm\'s order');
});
