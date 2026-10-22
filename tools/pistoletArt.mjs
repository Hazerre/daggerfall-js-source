// THE DWARVEN PISTOLET'S DOLL LAYERS, from its inventory picture (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md).
//
// The owner drew the pistol at Daggerfall's own scale - 24x17, the size of a classic dagger's doll record - so this is
// NOT tools/gunPaperdoll.mjs: that one bakes a 1790px painting down. The picture is never resampled by a filter: the
// doll's layer is the owner's pixels, tilted by RotSprite (below), which keeps every pixel one of the sprite's own.
//
//   public/art/pistolet-icon.png    THE SOURCE - the owner's sprite, whole. It is the inventory picture as it is.
//   -> pistolet-paperdoll.png       the doll's layer, for EITHER hand: the fist's gap cut across the grip, then the
//                                   picture tilted DOLL_ANGLE degrees barrel-down - NOT mirrored. The owner, 2026-10-22,
//                                   on the first two cuts (level, then a quarter turn with a mirrored left hand): "Still
//                                   wrong. It should be at a downward angle in the right hand in the picture. Not
//                                   mirrored". Both hands wear the same layer, the barrel down and to the picture's left
//                                   as the sprite's own barrel points.
//   -> pistolet-icon-gilded.png, pistolet-paperdoll-gilded.png
//                                   the same two in gold leaf, tools/gunIcons.mjs gild() - the Sunken Sovereign's
//
// THE GAP is the Thunderlock's rule (tools/gunPaperdoll.mjs punchBand): a band square to the grip, so the frame of the gun
// stays above the fist and the butt below it. Its size is a classic weapon's own: the doll's fist leaves an 8-10px gap
// along a classic one-handed weapon's record (TEXTURE.234's dagger, mace, shortsword, war axe, measured), and a pistol's
// grip runs ACROSS its barrel, so the cut runs along the grip. `thick` is how much of the grip the fist covers.
//
//     node tools/pistoletArt.mjs [--band=cx,cy,deg,thick,length]
import { readFileSync, writeFileSync } from 'node:fs';
import { readPng, writePng } from './pngIO.mjs';
import { punchBand } from './gunPaperdoll.mjs';
import { gild } from './gunIcons.mjs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE = 'public/art/pistolet-icon.png';
export const OUT = Object.freeze({
  doll: 'public/art/pistolet-paperdoll.png',
  iconGilded: 'public/art/pistolet-icon-gilded.png',
  dollGilded: 'public/art/pistolet-paperdoll-gilded.png',
});

/** The band, in the SOURCE's pixels: its centre as fractions of the sprite (punchBand's own units), the way it runs (the
 *  grip slopes about 12 degrees off upright, down to the right, so the band runs 12 degrees above level), how thick it
 *  is across the grip's length and how long across its width. Centre on rows 8-9 - the grip's middle - so the frame
 *  of the gun (rows 0-6) stays above the fist and the butt (rows 11-16) below it. */
export const BAND = Object.freeze({ cx: 19.7 / 24, cy: 9 / 17, deg: -12, thick: 4, length: 9 });

/** How far the doll's layer is tilted, counter-clockwise on the screen: the barrel, level and pointing left in the
 *  sprite, points down and out at this angle - the owner's "a downward angle". */
export const DOLL_ANGLE = 45;

/** Scale2x (EPX), exact on colours: twice the size, a diagonal edge rounded rather than doubled into a staircase. */
export function scale2x({ width: w, height: h, data }) {
  const W = w * 2, out = new Uint8Array(W * h * 2 * 4);
  const at = (x, y) => (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) * 4;
  const eq = (a, b) => data[a] === data[b] && data[a + 1] === data[b + 1] && data[a + 2] === data[b + 2] && data[a + 3] === data[b + 3];
  const put = (x, y, s) => { const d = (y * W + x) * 4; for (let c = 0; c < 4; c++) out[d + c] = data[s + c]; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const E = at(x, y), B = at(x, y - 1), D = at(x - 1, y), F = at(x + 1, y), H = at(x, y + 1);
      const edge = !eq(B, H) && !eq(D, F);
      put(2 * x, 2 * y, edge && eq(D, B) ? D : E);
      put(2 * x + 1, 2 * y, edge && eq(B, F) ? F : E);
      put(2 * x, 2 * y + 1, edge && eq(D, H) ? D : E);
      put(2 * x + 1, 2 * y + 1, edge && eq(H, F) ? F : E);
    }
  }
  return { width: W, height: h * 2, data: out };
}

/**
 * ROTSPRITE: a pixel picture turned `deg` counter-clockwise on the screen with no new colour in it - Scale2x three times
 * (8x), the turn sampled nearest at 8x, read back at 1x. A nearest turn at 1x is the staircase-and-holes the Gun-Lab
 * record warns of; this is the pixel-art answer to it. `point` (source pixels) is carried through the same turn.
 * Answers `{ img, at }`, the picture just big enough to hold the turned one.
 */
export function rotSprite(img, deg, point = null) {
  const K = 8, big = scale2x(scale2x(scale2x(img)));
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const cx = img.width / 2, cy = img.height / 2;
  const turn = (x, y) => [(x - cx) * c + (y - cy) * s, -(x - cx) * s + (y - cy) * c];   // y down: (1, 0) goes up-right
  const corners = [[0, 0], [img.width, 0], [0, img.height], [img.width, img.height]].map(([x, y]) => turn(x, y));
  const x0 = Math.floor(Math.min(...corners.map((p) => p[0]))), y0 = Math.floor(Math.min(...corners.map((p) => p[1])));
  const W = Math.ceil(Math.max(...corners.map((p) => p[0]))) - x0, H = Math.ceil(Math.max(...corners.map((p) => p[1]))) - y0;
  const out = new Uint8Array(W * H * 4);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const u = X + 0.5 + x0, v = Y + 0.5 + y0;
      const bx = Math.floor((u * c - v * s + cx) * K), by = Math.floor((u * s + v * c + cy) * K);
      if (bx < 0 || by < 0 || bx >= big.width || by >= big.height) continue;
      const si = (by * big.width + bx) * 4, d = (Y * W + X) * 4;
      for (let k = 0; k < 4; k++) out[d + k] = big.data[si + k];
    }
  }
  const p = point && turn(point[0], point[1]);
  return { img: { width: W, height: H, data: out }, at: p && { x: p[0] - x0, y: p[1] - y0 } };
}

/** Where the band's centre - the fist - lands in the doll's tilted layer, in its pixels. src/systems/pistolet.js
 *  PAPERDOLL_OFFSET seats this point on each fist. */
export const dollGrip = (w = 24, h = 17, band = BAND, deg = DOLL_ANGLE) =>
  rotSprite({ width: w, height: h, data: new Uint8Array(w * h * 4) }, deg, [band.cx * w, band.cy * h]).at;

/** The doll layers and the gilded set, from the source picture. Pure: a test re-runs it against the shipped files. */
export function pistoletArt(src, band = BAND) {
  const level = { width: src.width, height: src.height, data: new Uint8Array(src.data) };
  const cut = punchBand(level, band);   // cut in the source's own frame (the band is measured there), then turned
  const doll = rotSprite(level, DOLL_ANGLE).img;
  return { doll, iconGilded: gild(src), dollGilded: gild(doll), cut };
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find((a) => a.startsWith('--band='));
  const band = arg ? (([cx, cy, deg, thick, length]) => ({ cx, cy, deg, thick, length }))(arg.slice(7).split(',').map(Number)) : BAND;
  const src = readPng(readFileSync(SOURCE));
  const art = pistoletArt(src, band);
  for (const [k, file] of Object.entries(OUT)) writeFileSync(file, writePng(art[k]));
  console.log(`${SOURCE} ${src.width}x${src.height}: the gap cut ${art.cut} pixels; wrote ${Object.values(OUT).join(', ')}`);
}
