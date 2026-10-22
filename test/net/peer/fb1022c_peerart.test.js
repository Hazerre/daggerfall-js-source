// FIELD BUGS 2026-10-22c PEER-ART (bible/01-Overview/bugs/Field-Bugs-2026-10-22c.md, report 2): Foretold on the Discord's
// #bug-reports, "Memory Leak": "viewing task manager shows an instance out of 7 that is leaking 5gb of ram"; Xuurath:
// "Yep massive memory leak on desktop app". The peers' art store (net/peer/peerRiders.js createEotbArt) kept every
// sprite's decoded pictures for the session, and let a texture go only for a rider's horse look (COATS1) - a worn-armour
// walker (LAYERED-PEERS, 2026-10-19) is ~55 frames of its own outfit, so every outfit met online stood for good: ~4 MB of
// pixels and its textures each. Driven over the store itself, with the producer's own keys (layeredArmor.js
// layeredSprite) and a renderer that counts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEotbArt, spriteLookOf, RIDER_LOOKS_KEPT, RIDER_LOOK_IDLE_MS, RIDER_PIXELS_KEPT } from '../../../src/net/peer/peerRiders.js';
import { layeredSprite } from '../../../src/player/eyeOfTheBeholder/layeredArmor.js';
import { createEotbBody } from '../../../src/player/eyeOfTheBeholder/eotbBody.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
/** The outfits the art draws (layeredArmor.js outfitPieces: leather, chain or a plate of seven dyes a piece). */
const PIECES = ['l', 'c', 'p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const OUTFITS = [];
for (const h of PIECES) for (const t of PIECES) for (const l of PIECES) if (layeredSprite('Move', 0, 0, 4, { gender: 'female', outfit: `${h}${t}${l}` }, false)) OUTFITS.push(`${h}${t}${l}`);
function rig() {
  let now = 0, decodes = 0;
  const uploads = [], evicted = [];
  const art = createEotbArt({
    renderer: { uploadTexture: (a, rec) => uploads.push(`${a}_${rec}`), evictTexture: (k) => evicted.push(k) },
    urlFor: (k) => `u:${k}`, decode: async () => { decodes++; return { width: 4, height: 4, colors: new Uint32Array(16) }; },
    clock: () => now,
  });
  return { art, uploads, evicted, decodes: () => decodes, tick: (ms) => { now += ms; } };
}
/** One outfit's walk: its five facings, four frames each - every sprite a walker in it is drawn with. */
const sprites = (outfit, gender = 'female', mirror = false) => {
  const out = [];
  for (let o = 0; o < 5; o++) for (let f = 0; f < 4; f++) { const s = layeredSprite('Move', o, f, 4, { gender, outfit }, mirror); if (s) out.push(s); }
  return out;
};

test('PEER-ART a sprite\'s look: a horse\'s its coat; a worn-armour walker\'s its body, combo and pieces - every frame and record of one outfit one look, two outfits two; a class sprite none (mutants: the record kept in the look)', () => {
  assert.equal(spriteLookOf({ horse: 'h:2:1:0:3', key: 'x' }), 'h:2:1:0:3');
  assert.ok(OUTFITS.length > RIDER_LOOKS_KEPT * 2, `${OUTFITS.length} outfits drawn`);
  const a = sprites('lll'), b = sprites('ccc');
  assert.ok(a.length > 1 && b.length > 1, 'the producer makes the frames');
  assert.equal(new Set(a.map(spriteLookOf)).size, 1, 'one outfit, one look');
  assert.notEqual(spriteLookOf(a[0]), spriteLookOf(b[0]));
  assert.match(spriteLookOf(a[0]), /^LA:/);
  assert.equal(spriteLookOf({ key: 'FMRM_0-0', archive: 1, rec: 0 }), null, 'a class sprite every player shares stands');
});

test('PEER-ART the store lets an outfit go: past RIDER_LOOKS_KEPT outfits, one undrawn RIDER_LOOK_IDLE_MS is evicted - every texture of it - and one drawn now is never (mutants: walkers\' looks unkept)', async () => {
  const r = rig();
  const first = sprites(OUTFITS[0]);
  for (const s of first) r.art.ensure(s);
  await flush();
  const firstKeys = first.map((s) => `${s.archive}_${s.rec}`);
  assert.deepEqual(r.uploads.slice(0, firstKeys.length), firstKeys);
  for (let i = 1; i <= RIDER_LOOKS_KEPT; i++) { r.tick(RIDER_LOOK_IDLE_MS + 1); for (const s of sprites(OUTFITS[i])) r.art.ensure(s); await flush(); }
  for (const k of firstKeys) assert.ok(r.evicted.includes(k), `${k}: let go`);
  // one drawn every frame is never let go, however many come
  const kept = sprites(OUTFITS[20]);
  const before = r.evicted.length;
  for (let i = 0; i < 30; i++) {
    r.tick(RIDER_LOOK_IDLE_MS + 1);
    for (const s of kept) r.art.ensure(s);
    for (const s of sprites(OUTFITS[i === 20 ? 40 : i], 'female')) r.art.ensure(s);
    await flush();
  }
  const keptKeys = kept.map((s) => `${s.archive}_${s.rec}`);
  assert.ok(r.evicted.length > before, 'others went');
  for (const k of keptKeys) assert.ok(!r.evicted.includes(k), `${k}: drawn, kept`);
});

test('PEER-ART the store keeps RIDER_PIXELS_KEPT sprites\' pictures, the most recently asked: a mirror asked soon after its sprite shares one decode, asked after a crowd of others decodes again (mutants: every picture kept; the oldest asked kept over the newest)', async () => {
  assert.equal(RIDER_PIXELS_KEPT, 64);
  const r = rig();
  const [s] = sprites(OUTFITS[0]);
  r.art.ensure(s); await flush();
  assert.equal(r.decodes(), 1);
  r.art.ensure({ ...s, rec: `${s.rec}m`, mirror: true }); await flush();
  assert.equal(r.decodes(), 1, 'its mirror, at once: the same pictures');
  // a crowd: more sprites than the store keeps
  let n = 0, last = null;
  for (let i = 1; i < OUTFITS.length && n <= RIDER_PIXELS_KEPT; i++) for (const t of sprites(OUTFITS[i])) { r.art.ensure(t); n++; last = t; }
  await flush();
  assert.ok(n > RIDER_PIXELS_KEPT, `${n} sprites asked`);
  const d = r.decodes();
  r.art.ensure({ ...s, rec: `${s.rec}x` }); await flush();
  assert.equal(r.decodes(), d + 1, 'the first sprite\'s pictures went - decoded again');
  // the newest stays: one asked just now shares its decode
  r.art.ensure({ ...last, rec: `${last.rec}x` }); await flush();
  assert.equal(r.decodes(), d + 1, 'the newest kept');
  // asked again is the most recent: the store full, the first sprite asked once more, then one new - the first stays
  const r2 = rig();
  const crowd = OUTFITS.slice(1).flatMap((o) => sprites(o)).slice(0, RIDER_PIXELS_KEPT - 1);
  r2.art.ensure(s);
  for (const t of crowd) r2.art.ensure(t);
  await flush();
  r2.art.ensure({ ...s, rec: `${s.rec}m` });   // asked again: a mirror, the same pictures
  r2.art.ensure(sprites(OUTFITS.at(-1)).at(-1));   // one new: the store past full
  await flush();
  const d2 = r2.decodes();
  r2.art.ensure({ ...s, rec: `${s.rec}y` }); await flush();
  assert.equal(r2.decodes(), d2, 'the sprite asked again stayed');
  r2.art.ensure({ ...crowd[0], rec: `${crowd[0].rec}y` }); await flush();
  assert.equal(r2.decodes(), d2 + 1, 'the longest unasked went');
});

test('PEER-ART one cache, two stores: a texture the other store let go under the same key (my own body in the same outfit) is uploaded again, never drawn from nothing - here and in my own body\'s store (mutants: the drawn sprite trusted; my body\'s trusted)', async () => {
  let decodes = 0;
  const textures = new Map(), uploads = [];
  const renderer = { textures, uploadTexture: (a, rec) => { uploads.push(`${a}_${rec}`); textures.set(`${a}_${rec}`, {}); }, evictTexture: (k) => textures.delete(k) };
  const art = createEotbArt({ renderer, urlFor: (k) => `u:${k}`, decode: async () => { decodes++; return { width: 4, height: 4, colors: new Uint32Array(16) }; } });
  const [s] = sprites('lll');
  const key = `${s.archive}_${s.rec}`;
  assert.equal(art.ensure(s), null); await flush();
  assert.deepEqual(art.ensure(s), { w: 4, h: 4 }, 'up');
  textures.delete(key);   // my own body's store let its look go: the renderer's one cache no longer holds it
  assert.equal(art.ensure(s), null, 'not drawn from nothing');
  await flush();
  assert.deepEqual(art.ensure(s), { w: 4, h: 4 });
  assert.deepEqual(uploads, [key, key], 'uploaded again');
  assert.equal(decodes, 1, 'from the pictures it kept');
  // my own body's store asks the same (player/eyeOfTheBeholder/eotbBody.js ensure), driven as the world host drives it
  const mine = new Map(), up = [];
  const r = { textures: mine, batches: [], uploadTexture(a, rec) { up.push(`${a}_${rec}`); mine.set(`${a}_${rec}`, {}); }, createBillboardBatch(archive, rec, size) { const b = { archive, rec, size, origin: [0, 0, 0] }; this.batches.push(b); return b; }, destroyBillboardBatch() {}, drawBillboards() {} };
  const b = createEotbBody({ count: () => 3035, urlFor: (k2) => `/art/${k2}.png`, decode: async () => ({ width: 4, height: 6, colors: new Uint32Array(24) }) });
  b.attach(r, () => ({}));
  await new Promise((res) => setTimeout(res, 5));
  b.toggle(true, false);
  const still = { motion: { forward: 0, standing: true, speed: 0, grounded: true, height: 1.8 }, feet: [0, 2, 0], yaw: 0, cameraPos: [0, 3.5, -2] };
  const frame = async () => { for (let i = 0; i < 3; i++) b.tick(1 / 60, still); await new Promise((res) => setTimeout(res, 2)); return b.draw(null, { eye: [0, 3.5, -2], feet: [0, 2, 0], yaw: 0 }); };
  let drawnNow = false;
  for (let i = 0; i < 10 && !drawnNow; i++) drawnNow = await frame();
  assert.equal(drawnNow, true, 'my body drawn');
  const drawn = r.batches.at(-1), myKey = `${drawn.archive}_${drawn.rec}`;
  const n = up.filter((k) => k === myKey).length;
  assert.ok(n >= 1, 'its frame uploaded');
  mine.delete(myKey);   // the peers' store let a look go under my frame's key
  await frame(); await frame();
  assert.ok(up.filter((k) => k === myKey).length > n, 'my frame uploaded again');
  assert.ok(mine.has(myKey));
});
