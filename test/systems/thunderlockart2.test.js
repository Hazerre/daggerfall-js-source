// THUNDERLOCK-ART2 (2026-10-24, the owner: "Heres the new thunderlock sprite replacement"; bible/05-Combat/
// Dwarven-Thunderlock.md "THUNDERLOCK-ART2"): THE OWNER'S SEVEN FRAMES, AS THE GAME DRAWS THEM - read off the committed
// strip itself (public/art/thunderlock-frames.png), never a stand-in. The laws pinned:
//   - THE STRIP: seven 160x98 frames at a fixed stride, the canvas the anchor (no crop to content), the 1-bit cut, both
//     forearms carried straight down below the foot; the records the canvas's size, drawn at 160 of the surface's 320.
//   - THE CYCLE IS SEVEN: the art, the anim table and the machine's frame count agree; the Pistolet keeps its six.
//   - THE MUZZLE is the flash's largest white-hot body - the ball at the barrel's end, not the bolt's sparks.
//   - THE GOLD AND THE SHIMMER are the gun's: the brass gilded on every frame, the gloves and the grey sleeve never, the
//     flash never gilded; the enchanted shimmer on the brass and the bright, the hands left be.
// tools/mutants/thunderlockart.json.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPng } from '../../tools/pngIO.mjs';
import {
  thunderlockFrames, thunderlockGildKeep, thunderlockMuzzle, loadThunderlockArt, THUNDERLOCK_STRIP, THUNDERLOCK_ART, TL_FLASH_LUMA,
} from '../../src/combat/thunderlockArt.js';
import { THUNDERLOCK_ANIMS, PISTOLET_ANIMS, getWeaponAnims, WEAPON_TYPES } from '../../src/combat/fpsWeapon.js';
import { THUNDERLOCK_NUM_FRAMES } from '../../src/characters/weaponStates.js';
import { PISTOL_STRIP } from '../../src/combat/gun/pistolStrip.js';

const strip = readPng(readFileSync(new URL('../../public/art/thunderlock-frames.png', import.meta.url)));
const px = (img, x, y) => [...img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)];
const luma = ([r, g, b]) => r * 0.299 + g * 0.587 + b * 0.114;

test('THUNDERLOCK-ART2 THE STRIP: seven 160x98 frames at a fixed stride, the owner\'s canvas the anchor, cut to 1 bit, both forearms carried straight down below the foot; the records the canvas\'s size, half the surface wide (mutants: the canvas cropped; the bleed dropped; the cut soft)', async () => {
  assert.deepEqual([strip.width, strip.height], [THUNDERLOCK_STRIP.frames * THUNDERLOCK_STRIP.cellW, THUNDERLOCK_STRIP.cellH]);
  assert.deepEqual([THUNDERLOCK_STRIP.frames, THUNDERLOCK_STRIP.cellW, THUNDERLOCK_STRIP.cellH], [7, 160, 98]);
  const set = thunderlockFrames(strip);
  assert.equal(set.frames.length, 7);
  assert.deepEqual(set.anchor, { x: 0, y: 0, w: 160, h: 98 }, 'the canvas, as the owner placed the gun in it');
  assert.deepEqual(set.union, { x: 0, y: 0, w: 160, h: 98 + THUNDERLOCK_ART.bleed.bottom });
  for (const f of set.frames) {
    assert.deepEqual([f.width, f.height], [set.union.w, set.union.h]);
    for (let p = 3; p < f.data.length; p += 4) assert.ok(f.data[p] === 0 || f.data[p] === 255, 'every texel drawn or not');
  }
  // the foot's texels carried down: every column's last row is its foot row's
  const rest = set.frames[0];
  for (let x = 0; x < 160; x++) {
    const foot = px(rest, x, 97), last = px(rest, x, rest.height - 1);
    assert.deepEqual(foot[3] ? last : last[3], foot[3] ? foot : 0, `column ${x}`);   // a texel the cut cleared carries nothing down
  }
  assert.ok(px(rest, 43, 93)[3] === 255 && px(rest, 43, rest.height - 1)[3] === 255, 'the sleeve goes on below the foot');
  // the art as the rig takes it
  const ups = [];
  const art = await loadThunderlockArt({ uploadTexture: (k, key, img) => { ups.push(key); return key; } }, { fetch: async () => new Uint8Array([1]), decode: async () => strip });
  assert.equal(ups.length, 7);
  assert.equal(art.records[1].frames.length, 7);
  assert.deepEqual([art.records[0].width, art.records[0].height], [160 * THUNDERLOCK_ART.scale, 98 * THUNDERLOCK_ART.scale]);
  assert.deepEqual(art.native, { w: 160, h: 98 + THUNDERLOCK_ART.bleed.bottom });
  assert.deepEqual(art.pose, { widthPct: 0.5, raise: THUNDERLOCK_ART.raise }, '160 of the surface\'s 320 - the old sheet\'s gun took 0.49');
  assert.equal(thunderlockFrames({ width: 160, height: 98, data: new Uint8ClampedArray(160 * 98 * 4) }), null, 'not seven frames wide: nothing');
});

test('THUNDERLOCK-ART2 THE CYCLE IS SEVEN: the strip, the anim table and the machine\'s frame count agree - the rest frame first, the flash on the second; the Pistolet keeps its six (mutants: the table left at six; the Pistolet on the Thunderlock\'s)', () => {
  assert.ok(THUNDERLOCK_ANIMS.slice(1).every((a) => a.NumFrames === THUNDERLOCK_STRIP.frames && a.Record === 1));
  assert.equal(THUNDERLOCK_ANIMS[0].NumFrames, 1);
  assert.ok(Object.entries(THUNDERLOCK_NUM_FRAMES).every(([k, n]) => (k === 'Idle' ? n === 1 : n === THUNDERLOCK_STRIP.frames)));
  assert.ok(PISTOLET_ANIMS.slice(1).every((a) => a.NumFrames === PISTOL_STRIP.frames));
  for (const t of [WEAPON_TYPES.Pistolet, WEAPON_TYPES.Pistolet_Magic]) assert.equal(getWeaponAnims(t), PISTOLET_ANIMS, 'the Pistolet asks its own six');
  for (const t of [WEAPON_TYPES.Thunderlock, WEAPON_TYPES.Thunderlock_Magic]) assert.equal(getWeaponAnims(t), THUNDERLOCK_ANIMS);
  const set = thunderlockFrames(strip);
  const hot = (f) => { let n = 0; for (let i = 0; i < f.width * f.height; i++) if (f.data[i * 4 + 3] && luma(px(f, i % f.width, (i / f.width) | 0)) >= TL_FLASH_LUMA) n++; return n; };
  assert.deepEqual(set.frames.map(hot).map((n) => n > 0), [false, true, false, false, false, false, false], 'the flash on the second frame alone');
});

test('THUNDERLOCK-ART2 THE MUZZLE IS THE FLASH\'S BALL: the largest white-hot body of the shot frame, at the barrel\'s end - never pulled down the barrel by the bolt\'s sparks; null with no flash (mutants: every hot texel averaged)', () => {
  const set = thunderlockFrames(strip);
  const m = set.muzzle, x = m.x * set.union.w, y = m.y * set.union.h;
  assert.ok(x > 44 && x < 48.5 && y > 11 && y < 15.5, `the ball at (${x.toFixed(1)}, ${y.toFixed(1)}) - every hot texel's centre is (49.2, 16.7), down the bolt`);
  assert.equal(thunderlockMuzzle(set.frames[0]), null, 'the rest frame has no flash');
});

test('THUNDERLOCK-ART2 THE GOLD AND THE SHIMMER ARE THE GUN\'S: gilded, the brass leans gold on every frame and the gloves, the grey sleeve and the flash stay as drawn; enchanted, the brass and the flash shimmer and the hands do not (mutants: the gloves gilded; the flash gilded; the whole frame shimmered)', () => {
  const plain = thunderlockFrames(strip), gold = thunderlockFrames(strip, { gilded: true }), magic = thunderlockFrames(strip, { magic: true });
  const brass = [77, 64], glove = [59, 55], sleeve = [43, 93];   // (141,96,31) the brass's shade, (123,79,44) the glove's, (110,110,110) the sleeve's
  const keep = thunderlockGildKeep(plain.frames[0]);
  assert.equal(keep[brass[1] * 160 + brass[0]], 1, 'the brass kept');
  assert.equal(keep[glove[1] * 160 + glove[0]], 0, 'the glove not');
  assert.equal(keep[sleeve[1] * 160 + sleeve[0]], 0, 'the sleeve not');
  const g = px(gold.frames[0], ...brass), p = px(plain.frames[0], ...brass);
  assert.notDeepEqual(g, p);
  assert.ok(g[0] >= g[1] && g[1] > g[2] * 1.4 && luma(g) > luma(p), `gold leaf, brighter: ${g} from ${p}`);
  for (const at of [glove, sleeve]) assert.deepEqual(px(gold.frames[0], ...at), px(plain.frames[0], ...at), `${at} as drawn`);
  // the flash's texels on the shot frame untouched by the gold
  const shot = plain.frames[1];
  let flash = 0;
  for (let i = 0; i < shot.width * shot.height; i++) {
    const x = i % shot.width, y = (i / shot.width) | 0, c = px(shot, x, y);
    if (!c[3] || luma(c) < TL_FLASH_LUMA) continue;
    assert.deepEqual(px(gold.frames[1], x, y), c, `the flash at (${x}, ${y})`);
    flash++;
  }
  assert.ok(flash > 100);
  assert.notDeepEqual(px(magic.frames[0], ...brass), p, 'the brass shimmers');
  for (const at of [glove, sleeve]) assert.deepEqual(px(magic.frames[0], ...at), px(plain.frames[0], ...at), `${at} left be`);
  const [fx, fy] = [Math.round(plain.muzzle.x * plain.union.w), Math.round(plain.muzzle.y * plain.union.h)];
  assert.notDeepEqual(px(magic.frames[1], fx, fy), px(plain.frames[1], fx, fy), 'the flash goes white-blue');
});
