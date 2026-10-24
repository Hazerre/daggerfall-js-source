// THE DWARVEN THUNDERLOCK'S FIRST-PERSON ART.
//
// Every classic weapon's FP art is a WEAPON*.CIF out of the player's
// ARENA2, read by formats/cifRciFile.js and baked by
// fpsWeapon.loadFpsWeaponArt. This weapon is the port's own, so its
// art is OURS - under public/art, shipped with the build - and it
// arrives as a strip rather than as records. THUNDERLOCK-ART2 (2026-10-24):
// the owner's seven native frames (thunderlockFrames, below); the six-frame
// contact sheet the paragraphs after this one speak of is the gun lab's
// (src/tools/gunLab.js), kept for it.
//
// So this is loadFpsWeaponArt's other half: fetch, decode, slice
// (combat/gun/gunSheet.js, the laws the gun lab settled), and hand back
// the SAME SHAPE the CIF path hands back -
//   { weaponType, anims, records: [{ width, height, frames: [tex] }] }
// - so drawFpsWeapon, the weapon rig and Weapon Widget's clone read it
// without any of them learning that a second kind of weapon art
// exists.
//
// TWO RECORDS, as the anim table names them: 0 is the idle pose (the
// sheet's first cell, which is the gun with no flash on it), 1 is the
// six fire frames. Every frame is cropped to ONE box - the union of
// all six - because the flash and the smoke grow up and to the left
// across the cycle, and six frames trimmed to their own content slide
// the weapon around under the player's hands. That reasoning, and the
// background key that has to kill a white page without eating a
// muzzle flash, are gunSheet.js's.

import { contentBox } from './gun/gunSheet.js';
import { stripCellRect, hardenAlpha, cropImage } from './gun/pistolStrip.js';   // THUNDERLOCK-ART2: the strip's cut - the Pistolet's laws, a leaf's
import { decodePng } from '../systems/textureReplacement.js';
import { toScreenOrder } from '../formats/color32Order.js';   // FIELD-GUN3: HT3's law - a SCREEN QUAD's PNG keeps its rows
import { WEAPON_TYPES, getWeaponAnims } from './fpsWeapon.js';
import { GUN_FEEL } from './gun/gunFeel.js';   // FIELD-GUN7: the lab's settled pose, one home
import { APP_ROOT } from '../systems/appRoot.js';   // AUDIT-THUNDERLOCK F7: the SITE root, not the document's

/** The sheet, off the SITE ROOT rather than the document.
 *
 *  AUDIT-THUNDERLOCK F7: this resolved against `document.baseURI`,
 *  which is right on the lab's own page and WRONG in the game - the
 *  game's document is `/play/index.html`, so the browser would have
 *  asked for `/play/art/gun-fire-sheet.webp`, been handed the page
 *  itself, failed to decode it, and drawn no weapon at all. That is
 *  not a guess: it is exactly what happened to the held map four
 *  weeks earlier (MAP-FIELD, "The sprite I gave to be used is nowhere
 *  to be seen at all"), and systems/appRoot.js is that fix's law,
 *  moved to a leaf so combat/ can afford to import it. */
export const SHEET_FILE = 'art/gun-fire-sheet.webp';
export const sheetUrl = (file = SHEET_FILE) =>
  new URL(file, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

/** The key's defaults, the numbers the lab's slider settled on. */
export const KEY_THRESHOLD = 244, KEY_CHROMA = 10;

/**
 * THE ENCHANTED VARIANT.
 *
 * Every classic weapon has a second archive for this - WEAPON04.CIF
 * becomes WEAPO104.CIF, the same frames repainted with a glow - and
 * ItemHelper.ConvertItemToAPIWeaponType promotes an enchanted item to
 * the *_Magic type that reads it. This weapon has no second sheet, so
 * the promotion lands here instead: the SAME frames through a
 * shimmer.
 *
 * Not a hue rotation, which turns brass into a bruise. Luminance is
 * kept and the colour is pulled toward a cold Dwemer blue-violet, with
 * the BRIGHT parts pulled hardest - so the highlights read as charged
 * and the shadowed housing stays metal. The muzzle flash, already at
 * the top of the range, goes white-blue, which is what tells the
 * player at a glance that this one is enchanted.
 */
export const MAGIC_TINT = Object.freeze({ r: 0.42, g: 0.70, b: 1.85, lift: 64, pull: 0.88 });

export function shimmer(rgba) {
  const d = rgba.data;
  const { r: tr, g: tg, b: tb, lift, pull } = MAGIC_TINT;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
    const k = pull * (0.35 + 0.65 * lum);   // the bright parts take it hardest
    const glow = lift * lum * lum;
    d[i] = d[i] * (1 - k) + (d[i] * tr + glow) * k;
    d[i + 1] = d[i + 1] * (1 - k) + (d[i + 1] * tg + glow) * k;
    d[i + 2] = d[i + 2] * (1 - k) + Math.min(255, d[i + 2] * tb + glow) * k;
  }
  return rgba;
}

/**
 * GILDED1 (2026-10-07): THE HOURLOCK IN THE HAND - the same frames in gold leaf, the hand that holds them left as it
 * is. A whole-sprite recolour (the enchanted shimmer's way) would gild the glove too, and a gold-plated fist is not a
 * gilded gun. The glove's browns lean PINK and the brass's YELLOW - no hue threshold parts them (measured on the idle
 * frame: the glove's hues 18-35 degrees, the gun's 30-38), but their chromaticity does, read over a neighbourhood: each
 * pixel's yellow lean `(g - b) - 0.9 (r - g)` of its share, box-blurred (GILD.blur, twice) and weighed by what is drawn,
 * is under GILD.metalAt over the glove and over it across the brass. What reads as glove AND touches the frame's
 * foot in its left part (where the fist enters the picture) is the hand; a dark crevice of the gun that reads glove-ish
 * is left out, because it touches nothing. The hand is found ONCE on the idle frame and spared in every frame - the
 * sheet's cells share one box (the union crop), so the fist stands in the same pixels throughout - and only the gun's
 * own silhouette (the idle frame's drawn pixels) is gilded: the flash and the smoke stay the flash and the smoke.
 */
export const GILD = Object.freeze({ blur: 10, passes: 2, metalAt: 0.030, metalSoft: 0.016, footShare: 0.45 });
/** GOLD LEAF, darkest to brightest - the Gilded rung's ramp (tools/gunIcons.mjs carries the list pictures' own). */
export const GILD_RAMP = Object.freeze([[52, 30, 4], [110, 72, 10], [172, 122, 24], [226, 176, 46], [252, 214, 90], [255, 240, 160], [255, 255, 236]]);
const goldAt = (t, out) => {
  const u = Math.max(0, Math.min(1, t)) * (GILD_RAMP.length - 1);
  const i = Math.min(GILD_RAMP.length - 2, Math.floor(u)), f = u - i;
  for (let k = 0; k < 3; k++) out[k] = GILD_RAMP[i][k] * (1 - f) + GILD_RAMP[i + 1][k] * f;
  return out;
};
/** A box blur of `v` (w x h) by `rad`, in place of nothing - a fresh array, rows then columns, edges clamped by count. */
function boxBlur(v, w, h, rad) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -rad; x < w; x++) {
      if (x + rad < w) acc += v[row + x + rad];
      if (x - rad - 1 >= 0) acc -= v[row + x - rad - 1];
      if (x >= 0) tmp[row + x] = acc;
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -rad; y < h; y++) {
      if (y + rad < h) acc += tmp[(y + rad) * w + x];
      if (y - rad - 1 >= 0) acc -= tmp[(y - rad - 1) * w + x];
      if (y >= 0) out[y * w + x] = acc;
    }
  }
  return out;
}
/** THE HAND, on one frame: a mask (1 = the glove) of the pixels that read glove over their neighbourhood and are joined
 *  to the frame's foot in its left GILD.footShare. Pure. */
export function handMask({ width: w, height: h, data }) {
  let lean = new Float32Array(w * h), drawn = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (data[o + 3] < 100) continue;
    const sum = data[o] + data[o + 1] + data[o + 2] + 1e-6;
    const r = data[o] / sum, g = data[o + 1] / sum, b = data[o + 2] / sum;
    lean[i] = (g - b) - 0.9 * (r - g);
    drawn[i] = 1;
  }
  for (let p = 0; p < GILD.passes; p++) { lean = boxBlur(lean, w, h, GILD.blur); drawn = boxBlur(drawn, w, h, GILD.blur); }
  const glove = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (data[i * 4 + 3] > 0 && drawn[i] > 0 && lean[i] / drawn[i] < GILD.metalAt) glove[i] = 1;
  // what of it touches the foot on the left - the fist's way into the picture
  const mask = new Uint8Array(w * h);
  const stack = [];
  const footRight = Math.floor(w * GILD.footShare);
  for (let x = 0; x < footRight; x++) { const i = (h - 1) * w + x; if (glove[i]) { mask[i] = 1; stack.push(i); } }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0 && glove[i - 1] && !mask[i - 1]) { mask[i - 1] = 1; stack.push(i - 1); }
    if (x < w - 1 && glove[i + 1] && !mask[i + 1]) { mask[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && glove[i - w] && !mask[i - w]) { mask[i - w] = 1; stack.push(i - w); }
    if (y < h - 1 && glove[i + w] && !mask[i + w]) { mask[i + w] = 1; stack.push(i + w); }
  }
  return mask;
}
/** GILD one frame IN PLACE: every pixel `keep` names (the gun's own) pulled toward the gold ramp by its lightness, the
 *  bright parts pulled hardest; alpha is never written. Answers the frame. */
export function gildFrame(rgba, keep) {
  const d = rgba.data, c = [0, 0, 0];
  for (let i = 0, n = rgba.width * rgba.height; i < n; i++) {
    const o = i * 4;
    if (!keep[i] || d[o + 3] === 0) continue;
    const lum = (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255;
    const k = 0.55 + 0.45 * lum;
    goldAt(0.02 + 1.08 * lum ** 0.9, c);
    d[o] = d[o] * (1 - k) + c[0] * k;
    d[o + 1] = d[o + 1] * (1 - k) + c[1] * k;
    d[o + 2] = d[o + 2] * (1 - k) + c[2] * k;
  }
  return rgba;
}
/** The pixels a gilded sheet gilds: the idle frame's drawn ones, its hand taken out. */
export function gildKeep(idle) {
  const hand = handMask(idle);
  const keep = new Uint8Array(idle.width * idle.height);
  for (let i = 0; i < keep.length; i++) keep[i] = idle.data[i * 4 + 3] > 0 && !hand[i] ? 1 : 0;
  return keep;
}

/**
 * THE SPRITE'S SIZE ON THE 320x200 SURFACE.
 *
 * A CIF record carries its own native size and FPSWeapon draws it at
 * that size times the screen's scale; a 586x333 sheet cell has no such
 * number, and drawn at face value it would be twice the design
 * surface. `NATIVE_WIDTH` is the answer the lab arrived at - 54% of
 * the surface's width, Mac's own slider - expressed once, here, as
 * the width the gun's own box takes in native pixels.
 */
// FIELD-GUN7: 0.49, not 0.54. The lab's panel ended at SIZE 49 -
// Mac's last word on it was "Size: 49" - and this was written from
// the screenshot before that, so the gun has been drawn a tenth too
// big in the game since the day it was integrated. It reads the one
// home now, so the lab's slider and the game's sprite cannot part.
export const NATIVE_WIDTH = GUN_FEEL.widthPct * 320;

/**
 * THUNDERLOCK-ART2 (2026-10-24, the owner: "Heres the new thunderlock sprite replacement"; bible/05-Combat/
 * Dwarven-Thunderlock.md "THUNDERLOCK-ART2"): THE OWNER'S SEVEN FRAMES, the Pistolet's way (combat/gun/pistoletArt.js).
 *
 *   - A STRIP, NOT A SHEET. Seven 160x98 frames side by side (public/art/thunderlock-frames.png): the rest frame, the
 *     shot (its flash and the Dweamer's bolt), two of smoke and three settling, the fifth held a beat. Each is registered
 *     to the others by its canvas, so they are cut at a fixed stride: no key, no badge gutter, no crop to content.
 *   - NATIVE SIZE, THE CANVAS THE ANCHOR. A frame is a WEAPON*.CIF record's size and the owner placed the gun in it, both
 *     forearms leaving through its foot, so the canvas is what is seated on the screen's corner (AlignRight), at
 *     THUNDERLOCK_ART.scale design pixels a texel - 160 of the surface's 320, where the old sheet's gun took 0.49.
 *   - THE 1-BIT CUT at THUNDERLOCK_ART.alphaCut (the screen quad discards under 0.5), made once, here.
 *   - SEATED, NEVER STRETCHED (the owner, of a first cut that carried the forearms on below the foot: "Why is it
 *     stretched at the bottom. You need to place it correctly"): the frames are drawn exactly as drawn, and the canvas is
 *     seated the kick's height (GUN_FEEL.kick) below the screen's foot - Weapon Widget's transform never lifts the foot
 *     off the screen (its floor), and the shot's kick, applied after it, lifts it at most that far - so the cut never
 *     shows and nothing is invented under it.
 *   - GILDED: the GUN's brass, found on EVERY frame (thunderlockGildKeep) - the shot kicks the gun inside the canvas;
 *     ENCHANTED: the shimmer on the gun and what is drawn bright, the hands left be (thunderlockShimmer).
 */
export const THUNDERLOCK_STRIP = Object.freeze({ frames: 7, cellW: 160, cellH: 98, file: 'thunderlock-frames.png' });
export const THUNDERLOCK_ART = Object.freeze({ scale: 1, raise: -GUN_FEEL.kick, alphaCut: 128 });
/** White-hot: the flash's core, the one thing in the strip drawn this bright (the Pistolet's FLASH_LUMA). */
export const TL_FLASH_LUMA = 215;
const hsl = (d, o) => {
  const r = d[o] / 255, g = d[o + 1] / 255, b = d[o + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
  if (!dl) return [0, 0, l];
  const s = l > 0.5 ? dl / (2 - mx - mn) : dl / (mx + mn);
  const h = (mx === r ? (g - b) / dl + (g < b ? 6 : 0) : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4) * 60;
  return [h, s, l];
};
const luma = (d, o) => d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114;

/** THE GOLD'S KEEP on one frame: the gun's brass alone - hue 32-60, saturated, lit (the gloves are as warm but duller
 *  and darker, the sleeve grey) - never a white-hot texel of the flash or the bolt, nor the smoke. Pure. */
export function thunderlockGildKeep({ width: w, height: h, data }) {
  const keep = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    if (data[o + 3] < 128 || luma(data, o) >= TL_FLASH_LUMA) continue;
    const [hue, s, l] = hsl(data, o);
    keep[i] = hue >= 32 && hue <= 60 && s >= 0.5 && l >= 0.32 ? 1 : 0;
  }
  return keep;
}

/** THE ENCHANTED LOOK on one frame, IN PLACE: the shimmer (above) on the gun's brass and on everything drawn bright - the
 *  flash, the bolt, the smoke - never the gloves or the grey sleeve, which a whole-frame shimmer turned blue. Answers it. */
export const TL_SHIMMER_LUMA = 160;
export function thunderlockShimmer(img) {
  const keep = thunderlockGildKeep(img), d = img.data;
  const sh = shimmer({ width: img.width, height: img.height, data: new Uint8ClampedArray(d) }).data;
  for (let i = 0, n = img.width * img.height; i < n; i++) {
    const o = i * 4;
    if (d[o + 3] && (keep[i] || luma(d, o) >= TL_SHIMMER_LUMA)) { d[o] = sh[o]; d[o + 1] = sh[o + 1]; d[o + 2] = sh[o + 2]; }
  }
  return img;
}

/** WHERE THE SHOT LEAVES, off the flash alone (the Pistolet's flashPoint, and FIELD-GUN17's question): the largest body
 *  of white-hot texels on the shot frame - the bolt's own sparks along the barrel are smaller - and its centre, as
 *  fractions of `w` x `h` (the union the frame is drawn in). Null with no flash. Pure. */
export function thunderlockMuzzle(lit, w = lit?.width, h = lit?.height) {
  if (!lit?.data) return null;
  const { width: W, height: H, data } = lit;
  const hot = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (data[i * 4 + 3] >= 128 && luma(data, i * 4) >= TL_FLASH_LUMA) hot[i] = 1;
  let best = null;
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (!hot[i] || seen[i]) continue;
    const body = [i], st = [i];
    seen[i] = 1;
    while (st.length) {
      const q = st.pop(), x = q % W, y = (q / W) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy, n = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[n] || !hot[n]) continue;
        seen[n] = 1; st.push(n); body.push(n);
      }
    }
    if (!best || body.length > best.length) best = body;
  }
  if (!best) return null;
  const sx = best.reduce((a, q) => a + (q % W) + 0.5, 0), sy = best.reduce((a, q) => a + ((q / W) | 0) + 0.5, 0);
  return { x: sx / best.length / w, y: sy / best.length / h };
}

/**
 * THE SEVEN FRAMES AS THEY ARE DRAWN: cut at the stride and hardened, in their look (the gold on each frame's own
 * brass; the shimmer on the gun and the bright). `anchor` and `union` are both the owner's canvas, `muzzle` read off the
 * plain shot frame. Pure; null for a strip that is not seven frames wide or whose rest frame is empty.
 * @param {{ width: number, height: number, data: ArrayLike<number> }} strip
 */
export function thunderlockFrames(strip, { gilded = false, magic = false } = {}) {
  const S = THUNDERLOCK_STRIP, A = THUNDERLOCK_ART;
  if (!strip?.data || strip.width < S.frames * S.cellW || strip.height < S.cellH) return null;
  const cells = Array.from({ length: S.frames }, (_, i) => { const c = cropImage(strip, stripCellRect(i, S)); hardenAlpha(c, A.alphaCut); return c; });
  if (!contentBox(cells[0])) return null;
  const frames = cells.map((c) => {
    const own = gilded || magic ? { width: c.width, height: c.height, data: new Uint8ClampedArray(c.data) } : c;
    return gilded ? gildFrame(own, thunderlockGildKeep(own)) : magic ? thunderlockShimmer(own) : own;
  });
  const canvas = { x: 0, y: 0, w: S.cellW, h: S.cellH };
  return { frames, anchor: canvas, union: { ...canvas }, muzzle: thunderlockMuzzle(cells[1]) };
}

/**
 * Load it. `fetch` is the door a test comes through; by default the strip is fetched from the build beside the page.
 * The answer is loadFpsWeaponArt's shape and the Pistolet's (combat/gun/pistoletArt.js): `records` (0 the idle, 1 the
 * seven-frame cycle) at the CANVAS's size in design pixels, `anchor` and `unionBox` for gunFrameRect, `native` the
 * textures' own size, `muzzle`, and `pose` - the width and raise the rig places it by.
 * @returns the art, or null.
 */
export async function loadThunderlockArt(renderer, { fetch: fetchStrip = null, decode = decodePng, magic = false, gilded = false } = {}) {
  const file = `art/${THUNDERLOCK_STRIP.file}`;
  const bytes = fetchStrip
    ? await fetchStrip(file)
    : await (async () => {
      const r = await fetch(sheetUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    })();
  const set = thunderlockFrames(await decode(bytes), { gilded, magic });
  if (!set) return null;
  const { frames, anchor, union, muzzle } = set, k = THUNDERLOCK_ART.scale;
  const type = magic ? WEAPON_TYPES.Thunderlock_Magic : WEAPON_TYPES.Thunderlock;
  const look = gilded ? ':gilded' : magic ? ':magic' : '';
  // FIELD-GUN3 (Mac, from play: "The sprite is upside down"): HT3's law - drawFpsWeapon ends in drawScreenQuad, whose
  // rect's top takes v0 with no flip at upload, so a decoded PNG keeps its rows (toScreenOrder, never toColor32's flip)
  const textures = frames.map((rgba, i) => renderer.uploadTexture('img', `thunderlock${look}:${i}`, toScreenOrder(rgba)));
  const anchorW = anchor.w * k, anchorH = anchor.h * k;
  return {
    weaponType: type,
    anims: getWeaponAnims(type),
    // FIELD-GUN11: THE RECORD IS THE GUN, NOT THE GUN PLUS WHAT HANGS OFF IT - the anchor's size; both draw sites expand
    // it back to the union at the moment of drawing (gunFrameRect)
    records: [
      { width: anchorW, height: anchorH, frames: [textures[0]] },   // 0: idle
      { width: anchorW, height: anchorH, frames: textures },        // 1: the fire cycle
    ],
    anchor: { x: anchor.x * k, y: anchor.y * k, w: anchorW, h: anchorH },
    unionBox: { x: 0, y: 0, w: union.w * k, h: union.h * k },
    native: { w: union.w, h: union.h },   // the glow's field is laid in the textures' own texels (AUDIT PISTOLET B4's law)
    // FIELD-GUN17: where the barrel ends, as fractions of the UNION box
    muzzle,
    pose: { widthPct: anchorW / 320, raise: THUNDERLOCK_ART.raise },
  };
}

/**
 * WHERE THE BARREL ENDS - and the art answers it, so nobody types a
 * number.
 *
 * FIELD-GUN17 (2026-09-20, Mac: "the orb doesnt allign with the barrel
 * when firing. Its above the barrel").
 *
 * It was above the barrel because the shot left the BOW'S HAND. The
 * Thunderlock rides the ranged lane, and that lane's origin is
 * `playerArrowOrigin` - DFU's GetAimPosition, 0.11 below the eye and
 * 0.15 to the side, which is where a drawn bow's nock is. This gun is
 * drawn low and to the right with its barrel lower still, so a shot
 * from the bow's nock came out well above it. FIELD-GUN14's own
 * sentence, one field further along: the lane was written for the one
 * ranged weapon Daggerfall has.
 *
 * THE FLASH IS THE MEASUREMENT. Frame 1 is the gun with the muzzle
 * flash on it and frame 0 is the gun without; the pixels frame 1
 * GAINED are the flash, and their brightness-weighted centroid is
 * where it comes out of the barrel. Weighted by the gain rather than
 * counted, so the bright core near the muzzle outvotes the plume that
 * spreads away from it.
 *
 * Answers fractions of the union box (x from its left, y from its
 * TOP), which is the frame `unionDrawRect` hands back - or null if the
 * two frames differ nowhere bright enough to be a flash, in which case
 * the caller keeps whatever origin it had.
 */
export const MUZZLE_GAIN = 60;   // how much brighter a texel must get to count as flash, 0..255
export function muzzlePoint(dark, lit) {
  if (!dark?.data || !lit?.data || dark.width !== lit.width || dark.height !== lit.height) return null;
  const { width: w, height: h } = dark;
  let sx = 0, sy = 0, total = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!lit.data[i + 3]) continue;
      const l1 = (lit.data[i] + lit.data[i + 1] + lit.data[i + 2]) / 3;
      const l0 = dark.data[i + 3] ? (dark.data[i] + dark.data[i + 1] + dark.data[i + 2]) / 3 : 0;
      const gain = l1 - l0;
      if (gain <= MUZZLE_GAIN) continue;
      sx += x * gain; sy += y * gain; total += gain;
    }
  }
  if (!total) return null;
  // `crop` answers a PNG-ordered buffer (row 0 is the picture's top),
  // which is the order the union rect is drawn in - so no flip here.
  // The one that needs it is `toScreenOrder` above, on the way to GL.
  return { x: (sx / total) / w, y: (sy / total) / h };
}
