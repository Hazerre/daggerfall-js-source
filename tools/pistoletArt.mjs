// THE DWARVEN PISTOLET'S DOLL LAYERS, from its inventory picture (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md).
//
// The owner drew the pistol at Daggerfall's own scale - 24x17, the size of a classic dagger's doll record - so this is
// NOT tools/gunPaperdoll.mjs: that one bakes a 1790px painting down, and turning or resampling a finished pixel sprite is
// the staircase-and-holes the Gun-Lab record warns of. Every picture here is the source's own pixels, moved, never
// resampled.
//
//   public/art/pistolet-icon.png    THE SOURCE - the owner's sprite, whole. It is the inventory picture as it is.
//   -> pistolet-paperdoll.png       the right hand's doll layer: the fist's gap cut across the grip
//   -> pistolet-paperdoll-left.png  the left hand's: that layer in the mirror (a left hand is a right hand in the glass -
//                                   combat/twoHands/handsLaw.js's rule, which the doll keeps too)
//   -> pistolet-icon-gilded.png, pistolet-paperdoll-gilded.png, pistolet-paperdoll-left-gilded.png
//                                   the same three in gold leaf, tools/gunIcons.mjs gild() - the Sunken Sovereign's
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
  dollLeft: 'public/art/pistolet-paperdoll-left.png',
  iconGilded: 'public/art/pistolet-icon-gilded.png',
  dollGilded: 'public/art/pistolet-paperdoll-gilded.png',
  dollLeftGilded: 'public/art/pistolet-paperdoll-left-gilded.png',
});

/** The band, in the SOURCE's pixels: its centre as fractions of the sprite (punchBand's own units), the way it runs (the
 *  grip slopes about 12 degrees off upright, down to the right, so the band runs 12 degrees above level), how thick it
 *  is across the grip's length and how long across its width. Centre on rows 8-9 - the grip's middle - so the frame
 *  of the gun (rows 0-6) stays above the fist and the butt (rows 11-16) below it. */
export const BAND = Object.freeze({ cx: 19.7 / 24, cy: 9 / 17, deg: -12, thick: 4, length: 9 });

/** The picture in the mirror, pixel for pixel. */
export function mirror({ width: w, height: h, data }) {
  const out = new Uint8Array(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = (y * w + (w - 1 - x)) * 4;
      out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = data[s + 3];
    }
  }
  return { width: w, height: h, data: out };
}

/** The doll layers and the gilded set, from the source picture. Pure: a test re-runs it against the shipped files. */
export function pistoletArt(src, band = BAND) {
  const doll = { width: src.width, height: src.height, data: new Uint8Array(src.data) };
  const cut = punchBand(doll, band);
  const dollLeft = mirror(doll);
  return { doll, dollLeft, iconGilded: gild(src), dollGilded: gild(doll), dollLeftGilded: gild(dollLeft), cut };
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find((a) => a.startsWith('--band='));
  const band = arg ? (([cx, cy, deg, thick, length]) => ({ cx, cy, deg, thick, length }))(arg.slice(7).split(',').map(Number)) : BAND;
  const src = readPng(readFileSync(SOURCE));
  const art = pistoletArt(src, band);
  for (const [k, file] of Object.entries(OUT)) writeFileSync(file, writePng(art[k]));
  console.log(`${SOURCE} ${src.width}x${src.height}: the gap cut ${art.cut} pixels; wrote ${Object.values(OUT).join(', ')}`);
}
