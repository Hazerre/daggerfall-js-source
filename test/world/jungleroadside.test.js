// JUNGLE-ROADSIDE (2026-10-23, the owner, through Mac, with pine.obj, pine-1.obj and pine2.obj: "These trees are meant
// for the jungle biome and roadside. Making it more like a jungle with the vines stringing across the roads", "sunk into
// the ground so they dont float") - bible/03-World/Bantha-Jungle.md, The roadside pairs. The owner's three pairs read
// whole off the files the game reads, their measures held to them; the jungle's door carrying each as a near-only
// prototype; the near set turning each across its road; the law that stands them astride the roads - sunk to the lowest
// ground under their feet, their feet off every band - on ground made for it; the layout keeping its storeys off them;
// the build standing each pair whole; the wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
  JUNGLE_SPECIES, jungleFiles, readJungleTrees, jungleMesh, parseObj,
} from '../../src/world/jungle/jungleModels.js';
import {
  JUNGLE_PAIRS, JUNGLE_PAIR_MEASURES, JUNGLE_ROADSIDE, pairFiles, pairRecord, readPair, measurePair, turnXZ, standPairs, wholePairs,
} from '../../src/world/jungle/jungleRoadside.js';
import { JUNGLE, withJungle } from '../../src/world/terrain/jungleNature.js';
import { groundAt } from '../../src/world/terrain/terrainNature.js';
import { HEIGHTMAP_DIMENSION, MAX_TERRAIN_HEIGHT, SCALED_BEACH_ELEVATION, TERRAIN_SIZE as PIXEL_M } from '../../src/world/terrain/terrainSampler.js';
import { MAP_W, MAP_H } from '../../src/world/road/roadNetwork.js';
import { N, S, NE, SW, NW, SE } from '../../src/systems/travel/travelPaths.js';
import { roadRoom, PATH_HALF_M } from '../../src/world/road/roadVerge.js';
import { buildTreeSet, lptVariety } from '../../src/world/lowPolyTrees.js';
import { createJungleTrees, JUNGLE_URLS } from '../../src/systems/jungleTreesAssets.js';
import { standRoadside } from '../../src/scenes/roadsidePairs.js';
import { recordingGl } from '../wispShade.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { PNG } = createRequire(import.meta.url)('pngjs');
const SRC = 'src/assets/jungle/source';
const text = (p) => readFileSync(join(ROOT, p), 'utf8');
const picture = (name) => { const p = PNG.sync.read(readFileSync(join(ROOT, SRC, name))); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; };
const sources = () => JUNGLE_SPECIES.map((s) => { const f = jungleFiles(s); return { obj: text(`${SRC}/${f.obj}`), mtl: text(`${SRC}/${f.mtl}`) }; });
const TREES = readJungleTrees(sources());
const LOW = TREES.models.map((m) => m.min[1]);
const readOf = (p) => { const f = pairFiles(p); return readPair(text(`${SRC}/${f.obj}`), text(`${SRC}/${f.mtl}`), p, TREES.pictures, LOW); };
const READ = JUNGLE_PAIRS.map(readOf);
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const r2 = (v) => Math.round(v * 100) / 100 + 0;   // + 0: a -0 is a 0

test('JUNGLE-ROADSIDE the owner\'s pairs, read: three of the jungle\'s own trees in pairs - the mahogany and a leaning kapok, a fig, a sunk kapok - each read whole about the middle of its two roots, a run of faces a picture, every picture a tree\'s of the jungle; a root the middle of what its tree sinks below the owner\'s ground, so the lianas never pull it (mutants: the root by the lowest band; the anchor off the roots\' middle; the sink read upside down)', () => {
  assert.deepEqual(JUNGLE_PAIRS.map((p) => [p.key, p.file, [...p.trees]]), [['leaning', 'pine', [4, 1]], ['fig', 'pine-1', [4, 2]], ['sunk', 'pine2', [4, 1]]]);
  assert.deepEqual(READ.map((r) => r.mesh.subs.map((s) => s.picture)), [
    ['jungle_tree2_252w.png', 'jungle_tree3_252w.png', 'jungle_tree5_252w.png'],
    ['jungle_tree3_252w.png', 'jungle_tree5_252w.png'],
    ['jungle_tree2_252w.png', 'jungle_tree3_252w.png', 'jungle_tree5_252w.png'],
  ], 'a run a picture, in the order the file first names them - the lianas the fig\'s');
  // the mahogany stands in every pair as the owner's own mahogany moved 19 m along z (its every vertex so): its root is
  // its species' root moved with it, so the rule reads the tree the owner drew
  const mahogany = jungleMesh(parseObj(text(`${SRC}/jungle_tree5.obj`)));
  READ.forEach((r, k) => {
    const [rx, rz] = r.roots[0], ownX = r.anchor[0] - rx, ownZ = r.anchor[1] + rz;   // back into the owner's scene (the mirror undone)
    assert.ok(near(ownX, mahogany.root[0], 1e-5) && near(ownZ, mahogany.root[1] - 19, 1e-5), `${JUNGLE_PAIRS[k].key}: the mahogany's root, moved as the owner moved it`);   // the files' own six places
    assert.ok(near(r.roots[0][0] + r.roots[1][0], 0, 1e-9) && near(r.roots[0][1] + r.roots[1][1], 0, 1e-9), 'the anchor the middle of the two roots');
    let n = 0;
    for (const s of r.mesh.subs) { assert.equal(s.at, n); n += s.count; }
    assert.equal(n, r.mesh.indices.length, 'every face in one run');
    assert.ok(r.mesh.vertices.length / 8 < 65535);
  });
  assert.deepEqual(READ.map((r) => r.base.map(r2)), [[0, 0.21], [0, 0], [0, -2]], 'the sunk kapok 2 m under its own file; the leaning kapok\'s mound 0.21 m over it');
  // the fig's lianas hang to 0.66 m over the ground beside its trunk: a lowest-band root (jungleMesh's) is pulled toward
  // the road by them; the sunk-below-ground root is not
  const fig = READ[1], P = parseObj(text(`${SRC}/pine-1.obj`));
  const banded = jungleMesh({ ...P, faces: P.faces.filter((f) => f.material === 'Material.007') });
  const figOwn = [fig.anchor[0] - fig.roots[1][0], fig.anchor[1] + fig.roots[1][1]];
  assert.ok(Math.hypot(banded.root[0] - figOwn[0], banded.root[1] - figOwn[1]) > 2, 'the band\'s root is pulled off the trunk');
  assert.throws(() => readPair(text(`${SRC}/pine2.obj`), text(`${SRC}/pine2.mtl`), { trees: [4, 2] }, TREES.pictures, LOW), /no tree of jungle_tree3_252w\.png stands into its ground/, 'a picture only lianas wear is no tree');
});

test('JUNGLE-ROADSIDE each pair as it stands, measured off what it draws: its roots, each tree\'s base and foot, its height and the lowest it hangs over its road - the table the terrain worker reads, held to the files (mutants: a root drifted; a foot drifted; the over-road low read across the whole gap; a base dropped)', () => {
  READ.forEach((r, k) => {
    const m = measurePair(r, picture), t = JUNGLE_PAIR_MEASURES[k];
    assert.deepEqual(r.roots.map((q) => q.map((v) => Math.round(v * 1000) / 1000 + 0)), t.roots.map((q) => [...q]), `${JUNGLE_PAIRS[k].key}: its roots`);
    assert.deepEqual({ base: r.base.map(r2), feet: m.feet.map(r2), height: r2(m.height), over: r2(m.over) }, { base: [...t.base], feet: [...t.feet], height: t.height, over: t.over }, JUNGLE_PAIRS[k].key);
  });
  // every foot is its species' foot near enough (the owner's trees, moved and turned) - and the road's band fits between
  // the two feet at the smallest scale with room to spare
  for (const [k, t] of JUNGLE_PAIR_MEASURES.entries()) {
    const span = Math.hypot(t.roots[1][0] - t.roots[0][0], t.roots[1][1] - t.roots[0][1]);
    const gap = (span - t.feet[0] - t.feet[1]) * JUNGLE_ROADSIDE.scale[0];
    assert.ok(gap / 2 > PATH_HALF_M + 1.5, `${JUNGLE_PAIRS[k].key}: a road's band between its feet (${gap.toFixed(2)} m)`);
    assert.ok(t.over * JUNGLE_ROADSIDE.scale[0] - JUNGLE_ROADSIDE.headroom > 2, 'and room under its lianas over a level road');
  }
});

test('JUNGLE-ROADSIDE the jungle\'s door carries the pairs: each a near-only prototype after the five trees, keyed by its record, a run a picture each the atlas of the species wearing it - the five trees\' own prototypes and meshes untouched; a near-only prototype is a handle for the near set alone (no far picture drawn or uploaded, none given back) and draws in the jungle\'s slot (mutants: the pair\'s run wearing the first species\' atlas; a near-only prototype\'s far picture drawn; its handle\'s absent texture given back)', async () => {
  const withPairs = (pictures, low) => JUNGLE_PAIRS.map((p) => ({ record: pairRecord(p), mesh: readPair(text(`${SRC}/${p.file}.obj`), text(`${SRC}/${p.file}.mtl`), p, pictures, low).mesh }));
  const both = readJungleTrees(sources(), withPairs);
  assert.deepEqual(both.json.meshes.slice(0, 5), TREES.json.meshes, 'the five trees\' meshes as they were');
  for (const [key, p] of TREES.protos) assert.deepEqual(both.protos.get(key), p, `${key} as it was`);
  assert.deepEqual(both.treesBin.subarray(0, TREES.json.vertexBytes), TREES.treesBin.subarray(0, TREES.json.vertexBytes), 'the five trees\' vertices first, as they were');
  JUNGLE_PAIRS.forEach((p, k) => {
    const proto = both.protos.get(`500_jungle-pair-${p.key}`);
    assert.ok(proto?.nearOnly, p.key);
    assert.equal(proto.mesh, 5 + k);
    assert.deepEqual(proto.subs.map((s) => s.atlas), READ[k].mesh.subs.map((s) => JUNGLE_SPECIES[TREES.pictures.indexOf(s.picture)].key));
    assert.deepEqual(both.json.meshes[5 + k].subs, READ[k].mesh.subs.map((s) => [s.at, s.count]));
  });
  assert.throws(() => readJungleTrees(sources(), () => [{ record: 'x', mesh: { ...READ[0].mesh, subs: [{ at: 0, count: 3, picture: 'nobody.png' }] } }]), /which no tree of the jungle wears/);

  // the door over the real files: the pairs' prototypes, their handles for the near set alone
  const uploads = [], released = [], frames = [], { gl } = recordingGl();
  let t = 0;
  const renderer = {
    gl, uploadTexture: (a, rec) => uploads.push([a, rec]), releaseTexture: (a, rec) => released.push([a, rec]), setLowPolyTrees: (f, slot) => frames.push([f, slot]),
    createAtlasTexture: (w, h, levels) => ({ w, h, levels }), uploadAtlasRows: () => {}, releaseAtlasTexture: () => {},
  };
  const byUrl = new Map(Object.entries(JUNGLE_URLS).map(([name, url]) => [url, name]));
  const door = createJungleTrees({
    renderer, breathe: async () => {}, warn: (m) => assert.fail(m), now: () => t,
    fetchBytes: async (url) => new Uint8Array(readFileSync(join(ROOT, SRC, byUrl.get(url)))),
    decode: async (bytes) => { const p = PNG.sync.read(Buffer.from(bytes)); return { width: p.width, height: p.height, data: new Uint8Array(p.data) }; },
  });
  await door.load();
  const proto = door.pairProto(2);
  assert.equal(proto.key, '500_jungle-pair-sunk');
  const h = await door.farPicture(proto);
  assert.deepEqual([h.proto, h.record, h.size], [proto, null, null], 'a handle, no far picture');
  assert.deepEqual(uploads, [], 'nothing uploaded');
  const set = { ox: 0, oy: 0, oz: 0, handles: [h], ...buildTreeSet(400, 100, [{ h: 0, centers: [[0, 0, 5]], wild: null, own: Float32Array.of(1), turn: Float32Array.of(0.5) }]) };
  door.frame([set], 0, 0, 0, { stamp: 1 });
  const [f, slot] = frames.at(-1);
  assert.equal(slot, 1, 'the jungle\'s slot');
  assert.ok(f.cut.has(h) && f.runs[0].drawCount === 1 && f.runs[0].subs.length === 3 && f.runs[0].subs.every((s) => s.tex), 'drawn near, a run a picture');
  door.frame([], 0, 0, 0, { stamp: 2 });
  t = 31_000; door.frame([], 0, 0, 0, { stamp: 3 });   // past LPT_IDLE_S unheld: given back
  assert.equal(door._handles.size, 0, 'given back');
  assert.deepEqual(released, [], 'no texture of its own to give back');
});

test('JUNGLE-ROADSIDE the near set turns a pair across its road: a group\'s own `turn` in place of lptVariety\'s; turnXZ is the turn the trees\' program gives a vertex (mutants: the turn ignored; turnXZ turned the other way)', () => {
  const c = [[10, 0, 20], [30, 0, 40]];
  const own = buildTreeSet(400, 100, [{ h: 0, centers: c, wild: null, own: Float32Array.of(1, 1), turn: Float32Array.of(0.25, -2) }]);
  assert.deepEqual([own.trees[5], own.trees[11]], [Math.fround(0.25), Math.fround(-2)]);
  const theirs = buildTreeSet(400, 100, [{ h: 0, centers: c, wild: null, own: Float32Array.of(1, 1) }]);
  assert.equal(theirs.trees[5], Math.fround(lptVariety(400, 100, 10, 20, true).yaw));
  assert.match(text('src/render/renderer.js'), /float tc = cos\(aInst\.w\), tsn = sin\(aInst\.w\);[\s\S]{0,120}world = vec3\(tc \* p\.x \+ tsn \* p\.z, p\.y, -tsn \* p\.x \+ tc \* p\.z\) \+ aInst\.xyz;/, 'the program\'s turn');
  const [x, z] = turnXZ(3, 4, 0.7);
  assert.ok(near(x, Math.cos(0.7) * 3 + Math.sin(0.7) * 4) && near(z, -Math.sin(0.7) * 3 + Math.cos(0.7) * 4));
});

// ---- the law on ground made for it ----------------------------------------------------------------------------------

const PX = 400, PY = 100, H = HEIGHTMAP_DIMENSION, yScale = 1923.75;
/** A pixel's heightmap: level ground over the beach, tilted `grade` (m a metre) east, and a gentle swell. */
const ground = (grade = 0, swell = 0) => {
  const hm = new Float32Array(H * H), cell = PIXEL_M / (H - 1);
  for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) hm[a * H + b] = SCALED_BEACH_ELEVATION / MAX_TERRAIN_HEIGHT * 1.6 + (grade * a * cell + swell * Math.sin(a / 7) * Math.cos(b / 5)) / yScale;
  return hm;
};
/** A road north-south through the pixel and tracks north-east and north-west out of it (a junction at its middle, where
 *  a pair by one arm reaches over another's band). */
const network = () => {
  const net = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
  const at = (x, y) => y * MAP_W + x;
  net.roads[at(PX, PY)] = N | S; net.tracks[at(PX, PY)] = NE | NW;
  net.roads[at(PX, PY - 1)] = S; net.roads[at(PX, PY + 1)] = N; net.tracks[at(PX + 1, PY - 1)] = SW; net.tracks[at(PX - 1, PY - 1)] = SE;
  return net;
};
const job = (hm, extra = {}) => ({ px: PX, py: PY, net: network(), heightmapData: hm, tileOk: () => true, trailOk: () => true, ...extra });

test('JUNGLE-ROADSIDE the law: a pair astride each road - its axis across it, the gap between its feet centred on the road\'s line, both feet off every band (the junction\'s other road\'s too), its trees where its near tree draws them, its scale the layout\'s; its stations a hash of the world - every call the same pairs; no road, no pairs (mutants: the gap off the line; the axis along the road; the feet\'s band unasked; the stations\' chance whole; the pairs\' own spacing unasked)', () => {
  const hm = ground(0, 0.6), pairs = standPairs(job(hm));
  assert.ok(pairs.length >= 12, `${pairs.length} pairs along a road and two tracks`);
  assert.ok(pairs.length < 32, 'not one at every station (43 would stand)');
  assert.deepEqual(standPairs(job(hm)), pairs, 'the same pairs every time');
  const HALF = PIXEL_M / 2, net = network();
  for (const p of pairs) {
    const m = JUNGLE_PAIR_MEASURES[p.kind];
    assert.ok(p.js >= JUNGLE_ROADSIDE.scale[0] && p.js <= JUNGLE_ROADSIDE.scale[1]);
    p.trees.forEach((t, k) => {
      const [dx, dz] = turnXZ(m.roots[k][0] * p.js, m.roots[k][1] * p.js, p.turn);
      assert.ok(near(t.x, p.ax + dx, 1e-9) && near(t.z, p.az + dz, 1e-9), 'where its near tree draws it');
      assert.equal(t.species, JUNGLE_PAIRS[p.kind].trees[k]);
      assert.ok(roadRoom(net, PX, PY, t.x, t.z, m.feet[k] * p.js) >= m.feet[k] * p.js - 1e-9, 'its foot off every band');
    });
    // its road: the arm whose line the middle of its two feet stands on
    const [a, b] = p.trees, ux = (b.x - a.x), uz = (b.z - a.z), span = Math.hypot(ux, uz);
    const gx = a.x + (ux / span) * (m.feet[0] * p.js + (span - (m.feet[0] + m.feet[1]) * p.js) / 2), gz = a.z + (uz / span) * (m.feet[0] * p.js + (span - (m.feet[0] + m.feet[1]) * p.js) / 2);
    const onNS = near(gx, HALF, 1e-6) && gz > HALF, onSN = near(gx, HALF, 1e-6) && gz < HALF;
    const onNE = near(gx - HALF, gz - HALF, 1e-6) && gx > HALF, onNW = near(HALF - gx, gz - HALF, 1e-6) && gx < HALF;
    assert.ok(onNS || onSN || onNE || onNW, `the gap's middle on a road's line (${gx.toFixed(3)}, ${gz.toFixed(3)})`);
    const along = onNE ? [Math.SQRT1_2, Math.SQRT1_2] : onNW ? [-Math.SQRT1_2, Math.SQRT1_2] : [0, 1];
    assert.ok(near((ux * along[0] + uz * along[1]) / span, 0, 1e-9), 'its axis across its road');
  }
  for (let i = 0; i < pairs.length; i++) for (let j = 0; j < i; j++) for (const s of pairs[i].trees) for (const t of pairs[j].trees) {
    assert.ok(Math.hypot(s.x - t.x, s.z - t.z) >= JUNGLE_ROADSIDE.clear * pairs[i].js - 1e-9, 'no pair\'s trunk within another\'s clearance');
  }
  // a star of eight roads: by its middle a pair along one reaches over the next one's band, and stands only where it
  // does not
  const star = { roads: new Uint8Array(MAP_W * MAP_H), tracks: new Uint8Array(MAP_W * MAP_H) };
  star.roads[PY * MAP_W + 300] = 0xff;
  const starred = standPairs({ ...job(ground(0, 0)), px: 300, net: star });
  assert.ok(starred.length > 30);
  for (const p of starred) p.trees.forEach((t, k) => { const f = JUNGLE_PAIR_MEASURES[p.kind].feet[k] * p.js; assert.ok(roadRoom(star, 300, PY, t.x, t.z, f) >= f - 1e-9, 'a star\'s pair\'s foot off every band'); });
  assert.deepEqual(standPairs(job(hm, { net: null })), [], 'no network, no pairs');
  assert.deepEqual(standPairs(job(hm, { py: PY + 3 })), [], 'a pixel no road crosses');
  assert.deepEqual(standPairs(job(hm, { tileOk: () => false })), [], 'never where the jungle\'s trees would not stand');
  assert.deepEqual(standPairs(job(hm, { trailOk: () => false })), [], 'never over a trail');
});

test('JUNGLE-ROADSIDE SUNK, NEVER FLOATING: a pair stands at the lowest ground under either foot less its sink - nowhere under its feet is the ground lower than it, and nowhere much higher than it needs; a trunk buried past `bury` or a road over its lianas\' headroom stands none, so a steep cross-slope stands no pair (mutants: the highest ground taken; the sink raised out of the ground; the rim unread; the burial unasked; the headroom unasked)', () => {
  const S = JUNGLE_ROADSIDE.sink;
  for (const [grade, swell] of [[0, 0], [0, 0.8], [0.03, 0.5], [0.05, 0]]) {
    const hm = ground(grade, swell), pairs = standPairs(job(hm));
    assert.ok(pairs.length > 0, `grade ${grade}: some pairs`);
    for (const p of pairs) {
      const m = JUNGLE_PAIR_MEASURES[p.kind];
      let lo = Infinity;
      p.trees.forEach((t, k) => {
        const r = m.feet[k] * p.js;
        for (let dx = -r; dx <= r; dx += 0.25) for (let dz = -r; dz <= r; dz += 0.25) {
          if (Math.hypot(dx, dz) > r) continue;
          const g = groundAt(hm, t.x + dx, t.z + dz);
          // the lowest is found on its foot's rim to a millimetre or two (RIM samples), well inside the sink
          assert.ok(g >= p.y + S - 0.01, `grade ${grade}: the ground under its foot ${(g - p.y).toFixed(4)} m over it - its sink not whole`);
          lo = Math.min(lo, g);
        }
        assert.ok(groundAt(hm, t.x, t.z) - p.y <= JUNGLE_ROADSIDE.bury + 1e-9, 'a trunk buried no deeper than `bury`');
        assert.ok(near(t.y, p.y + m.base[k] * p.js, 1e-9), 'each tree at the pair\'s height, its own base on it');
      });
      assert.ok(lo - (p.y + S) < 0.02, `grade ${grade}: no lower than it needs (${(lo - p.y - S).toFixed(3)} m)`);
    }
  }
  assert.deepEqual(standPairs(job(ground(0.15, 0))), [], 'a 15% cross-slope stands none');
  // a hollow under a foot - one sample a metre down inside it, off its rim - sinks the pair the whole metre
  const level = ground(0, 0), was = standPairs(job(level))[0], t0 = was.trees[0], cell0 = PIXEL_M / (H - 1);
  const hi = Math.round((t0.x + 2) / cell0), hj = Math.round(t0.z / cell0);
  assert.ok(Math.hypot(hi * cell0 - t0.x, hj * cell0 - t0.z) < JUNGLE_PAIR_MEASURES[was.kind].feet[0] * was.js - 1, 'inside the foot');
  const hollow = Float32Array.from(level);
  hollow[hi * H + hj] -= 1 / yScale;
  const sunk = standPairs(job(hollow)).find((p) => near(p.ax, was.ax, 1e-9) && near(p.az, was.az, 1e-9));
  assert.ok(sunk && near(sunk.y, was.y - 1, 1e-4), `the hollow sinks it (${sunk && (sunk.y - was.y).toFixed(4)})`);
  // the road's own: a road raised over the pair's ground stands only the pairs whose lianas keep their headroom over it -
  // 4 m up, the fig's (its lowest over the road 7.5 m) and neither kapok's (4.2 m); 7 m up, none
  const raised = (h) => {
    const hm = ground(0, 0), cell = PIXEL_M / (H - 1);
    for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) if (Math.abs(a * cell - PIXEL_M / 2) < 8) hm[a * H + b] += h / yScale;
    return hm;
  };
  const astride = (p) => Math.abs(p.ax - PIXEL_M / 2) < 20;   // the north-south road's (the track's leave the middle at 45 degrees)
  const four = standPairs(job(raised(4))).filter(astride);
  assert.ok(four.length > 0 && four.every((p) => p.kind === 1), `4 m up, the figs alone (${four.map((p) => p.kind)})`);
  assert.deepEqual(standPairs(job(raised(7))).filter(astride), [], '7 m up, none');
  assert.ok(standPairs(job(raised(7))).length > 0, 'the track\'s still stand');
  // a trunk's own ground 4 m over the lowest under the other's foot - a cliff east of the road, the road level - is buried
  // past `bury`: none astride it
  const cliff = ground(0, 0), cell = PIXEL_M / (H - 1);
  for (let a = 0; a < H; a++) for (let b = 0; b < H; b++) if (a * cell > PIXEL_M / 2 + 11) cliff[a * H + b] += 4 / yScale;
  assert.deepEqual(standPairs(job(cliff)).filter(astride), [], 'none over the cliff');
  assert.ok(standPairs(job(ground(0, 0))).filter(astride).length > 0, 'where it stood level');
});

// ---- the layout ----------------------------------------------------------------------------------------------------

const WHOLE = [3, 3, 3, 3, 3, 3, 3, 3, 3];
const layout = (net) => withJungle([], ground(0, 0.5), new Uint8Array(16384).fill(2), { mapPixelX: PX, mapPixelY: PY, rawWorldHeight: 80, climateType: 400, locationRect: null, jungle: { nine: WHOLE, pois: [], paths: new Uint8Array(16384), net } });

test('JUNGLE-ROADSIDE in the layout: a pair\'s two trees are jungle trees of their species carrying their pair; no canopy or young tree stands within `clear` of a pair\'s trunk, no plant of the floor within the canopy\'s own clearance - and away from the pairs the jungle stands as it did (mutants: the canopy over a pair\'s trunk; the young trees over it; the floor over it; the network not handed on)', () => {
  const on = layout(network()), off = layout(null);
  const pt = on.filter((f) => f.pair != null);
  assert.ok(pt.length >= 16 && pt.length % 2 === 0);
  const pairs = standPairs({ px: PX, py: PY, net: network(), heightmapData: ground(0, 0.5), tileOk: () => true, trailOk: () => true });
  for (const f of pt) {
    const p = pairs[f.pi], t = p.trees[f.side];
    assert.deepEqual([f.record, f.archive, f.jungle, f.js, f.pair, f.turn, f.ax, f.ay, f.az, f.wood], [JUNGLE_SPECIES[t.species].record, 500, t.species, p.js, p.kind, p.turn, p.ax, p.y, p.az, 1]);
    assert.deepEqual([f.x, f.y, f.z], [t.x, t.y, t.z]);
  }
  const trunks = pt.map((f) => [f.x, f.z, f.js]);
  const within = (f, r) => trunks.some(([x, z, js]) => Math.hypot(f.x - x, f.z - z) < r * js);
  assert.deepEqual(on.filter((f) => f.pair == null && f.jungle != null && within(f, JUNGLE_ROADSIDE.clear)), [], 'no jungle tree crowds a pair\'s trunk');
  assert.deepEqual(on.filter((f) => f.jungle == null && within(f, JUNGLE.coverClear)), [], 'no plant grows out of one');
  // past a pair's clearance and the crown of the tallest tree that gave way to it (the light gap it opened, where the young
  // trees roll their gap's chance) the jungle stands as it did
  const far = (f) => !within(f, JUNGLE_ROADSIDE.clear + JUNGLE.crown * JUNGLE.emergentScale[1] + JUNGLE.underClear);
  const kept = off.filter(far);
  assert.ok(kept.length > off.length / 2);
  assert.deepEqual(on.filter((f) => f.pair == null && far(f)), kept, 'the jungle away from them as it stood');
  assert.match(text('src/world/terrain/terrainGen.js'), /pois: placesFor\(jungle\.hidden\), paths, net: roads \}/, 'the kernel hands the jungle its network');
});

// ---- the build -----------------------------------------------------------------------------------------------------

test('JUNGLE-ROADSIDE the build stands each pair whole: its span in the near set at its anchor, turned and scaled, its handle held; its two trees in groups of their own carrying the span, never the near set, never Logging\'s; a pair one of whose trees the build refuses stands neither; a pair whose span cannot stand stands its trees as the canopy\'s (mutants: a lone tree kept; the span\'s turn dropped; the span unheld; the fallback lost)', async () => {
  const flats = layout(network()).filter((f) => f.pair != null);
  assert.equal(wholePairs(flats, () => true).length, flats.length / 2);
  const refused = flats[0];
  const kept = wholePairs(flats, (f) => f !== refused);
  assert.equal(kept.length, flats.length / 2 - 1, 'its partner stands with it or not at all');
  assert.ok(kept.every((p) => p.trees.every((t) => t.pi !== refused.pi)));

  const acquired = [], swayed = [], protos = new Map();
  const door = {
    pairProto: (k) => { if (!protos.has(k)) protos.set(k, { key: `pair${k}`, size: { h: 23 } }); return protos.get(k); },
    farPicture: async (proto) => ({ proto, record: null }),
    acquire: (h) => acquired.push(h),
  };
  const groups = new Map([['J4', { species: 4, young: false, centers: [[1, 2, 3]], own: [1] }]]), handles = ['species'], set = [{ h: 0 }];
  const n = await standRoadside({ door, flats, keep: (f) => f !== refused, groups, handles, set, sway: (proto, record) => swayed.push([proto.key, record]) });
  assert.equal(n, kept.length);
  const kinds = [...new Set(kept.map((p) => p.kind))];
  assert.deepEqual(acquired.map((h) => h.proto.key).sort(), kinds.map((k) => `pair${k}`).sort(), 'a span\'s handle held once a kind');
  assert.deepEqual(swayed.map((s) => s[1]), kinds.map(() => JUNGLE_SPECIES[4].record), 'its wind its first tree\'s');
  for (const k of kinds) {
    const e = set.find((s) => handles[s.h]?.proto?.key === `pair${k}`), mine = kept.filter((p) => p.kind === k);
    assert.deepEqual(e.centers, mine.map((p) => [p.ax, p.ay, p.az]));
    assert.deepEqual([...e.own], mine.map((p) => Math.fround(p.js)));
    assert.deepEqual([...e.turn], mine.map((p) => Math.fround(p.turn)));
    for (const side of [0, 1]) {
      const g = groups.get(`P${k}.${side}`);
      assert.equal(g.span, handles[e.h]);
      assert.deepEqual(g.centers, mine.map((p) => [p.trees[side].x, p.trees[side].y, p.trees[side].z]));
    }
  }
  assert.deepEqual(groups.get('J4').centers, [[1, 2, 3]], 'the canopy\'s groups untouched');
  // no span: the trees stand as the canopy's own
  const plain = new Map();
  await standRoadside({ door: { pairProto: () => null }, flats, keep: () => true, groups: plain, handles: [], set: [], sway: () => assert.fail('no span') });
  assert.deepEqual([...plain.keys()].sort(), [...new Set(flats.map((f) => `J${f.jungle}`))].sort());
  assert.ok([...plain.values()].every((g) => g.span === null));

  const pb = text('src/scenes/pixelBuild.js');
  assert.match(pb, /for \(const f of nature\) \{\n\s+if \(jungleOk && f\.pair != null\) \{ pairFlats\.push\(f\); continue; \}/, 'a pair\'s tree set aside before anything stands it');
  assert.match(pb, /await standRoadside\(\{[\s\S]{0,200}keep: \(f\) => !pointNearGate\(gateClear, px, py, f\.x, f\.z, WOD_FLAT_GATE_CLEAR_M\) && !insideRocks\(pixelRocks, f\.x, f\.z\),/, 'kept by the gate\'s clearing and the rocks, as every flat');
  assert.match(pb, /if \(!g\.span\) jungleSet\.push\(\{ h: pic\.h, centers: g\.centers, wild: null, own, fit: null \}\);/, 'never the near set - its span draws it');
  assert.match(pb, /batch\.lptProto = g\.span \?\? far;/, 'its far picture gives way where its span draws');
  assert.match(pb, /if \(!g\.span\) forestGroups\.set\(gk, \{ batch, centers: g\.centers, size: far\.size, scales \}\);/, 'never Logging\'s');
  assert.ok(pb.indexOf('await standRoadside(') < pb.indexOf('for (const [gk, g] of jungleGroups) {'), 'its trees join the groups before they stand');
});
