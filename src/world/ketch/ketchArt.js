// @ts-check
// KETCH (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): THE SKY-KETCH'S ART - the textures the Rourken ship
// wears (pseudo-archive KT_ARCHIVE, registered in world/eliteGates/pseudoArchives.js), painted here in code through the
// Shattered Hour's paint box (world/superDungeon/sdPixelKit.js): 1-px bevels lit from the top-left, dark joints, an
// ordered dither between a ramp's steps, and every texel forced into the ramps at the end - Daggerfall's own pixel art, the
// same pixels every boot. Each `{ albedo, emission }`, the renderer's color32 shape (RGBA rows), the emission its own light.
//
// The Dwemer built in metal and dressed stone, never wood, and kept their brass bright and their bronze dark: so the
// decks are bronze tread plate, the hull clinker bronze streaked with verdigris, the machinery dark iron, the pipes
// copper, and only three things glow - the aether (blue-white, a cell's or a true resonator's), the ember (a resonator
// the Warden has put out of tune) and the edge line (gold, along every edge a body could fall from). Two pictures carry
// their own alpha for the billboards (the clouds under the keel and the gun deck's steam).
//
//   deck   bronze tread plate, a metre each, the diamond tread raised and riveted at the corners
//   hull   clinker bronze, each strake over the one below, verdigris weeping down from every seam
//   brass  the rails, posts and trim - the Hour's own brass (world/superDungeon/sdRealmArt.js realmBrassArt)
//   iron   the machinery: dark iron in bolted panels
//   copper the pipes and coils, banded
//   grate  iron grating over a black gap
//   aether / ember   the two lights a cell and a resonator burn with
//   vane   a sail-vane: brass ribs fanning over copper mesh
//   gilt   gold leaf, engraved - the helm, the cabin, the Ketchmaster's hold
//   stone  Dwemer dressed stone, warm grey, a brass line in every course
//   edge   the always-lit gold line (the Hour's own)
//   gear   a gear's face: the engine's drum, the helm's wheel
//   ground the Iliac Bay's fields far below the keel (256 x 256): fields, hedges, a road, a river
//   cloud / steam   puffs, with alpha
//   arc0-3 an arc-coil's lightning, four frames
//   lamp   a lamp's glass
//   chain  the anchor chain and the rigging's links
//   net    the rigging nets strung over every bulwark and rail - brass cord, its holes cut out (alpha 0: the mesh shader's
//          cutout), so the sky shows through them
//   glass  a port's glass, lit from within (the hull's portholes, the superstructure's windows)
//
// Not a DFU member. Ledger A (KETCH).
import { SD_RAMP } from '../superDungeon/sdLook.js';
import { rng, noiseField, image, putTexel, ramp, step, bevel, rivet, paletteOf, quantize, scale, blendRgb } from '../superDungeon/sdPixelKit.js';
import { realmBrassArt, realmEdgeArt } from '../superDungeon/sdRealmArt.js';

/** The Ketch's pseudo-archive (world/eliteGates/pseudoArchives.js holds it taken). */
export const KT_ARCHIVE = 38311;
/** Each picture's record under it. */
export const KT_REC = Object.freeze({
  deck: 0, hull: 1, brass: 2, iron: 3, copper: 4, grate: 5, aether: 6, ember: 7, vane: 8, gilt: 9, stone: 10, edge: 11, gear: 12,
  ground: 13, cloud: 14, steam: 15, arc0: 16, arc1: 17, arc2: 18, arc3: 19, lamp: 20, chain: 21, net: 22, glass: 23,
});
/** The tiles' side (texels - 32 a metre, the Hour's density: a tile is two metres), the ground's and the puffs'. */
export const KT_ART_SIZE = 64;
export const KT_GROUND_SIZE = 256;
export const KT_PUFF_SIZE = 64;
/** The ramps the Ketch adds to the Hour's: copper, dark iron, the aether's blue-white, the ember, the land below, the sky's
 *  white (the Hour's own brass, bronze and verdigris besides). */
export const KT_RAMP = Object.freeze({
  copper: Object.freeze([[46, 20, 12], [86, 38, 20], [138, 64, 34], [184, 98, 54], [222, 140, 86]]),
  iron: Object.freeze([[12, 12, 14], [24, 24, 28], [40, 40, 46], [60, 60, 66], [86, 86, 92]]),
  aether: Object.freeze([[18, 40, 70], [40, 96, 150], [90, 170, 220], [170, 226, 250], [236, 252, 255]]),
  ember: Object.freeze([[52, 10, 6], [110, 26, 12], [176, 58, 20], [232, 112, 40], [255, 188, 96]]),
  stone: Object.freeze([[46, 42, 38], [66, 60, 54], [88, 80, 72], [112, 102, 92], [138, 126, 112]]),
  field: Object.freeze([[30, 44, 22], [48, 66, 30], [70, 88, 40], [96, 106, 52], [126, 120, 66]]),
  soil: Object.freeze([[50, 38, 24], [72, 54, 34], [96, 74, 46], [122, 98, 62], [150, 126, 84]]),
  water: Object.freeze([[22, 36, 52], [32, 52, 72], [48, 72, 96]]),
  cloud: Object.freeze([[150, 158, 172], [186, 192, 204], [214, 218, 226], [236, 238, 242], [252, 252, 252]]),
});
/** How strongly the lit things burn (a share of their own colour): the aether and the ember whole, a lamp's glass, the
 *  arc. The brass's rubbed edges keep the Hour's 0.04 (realmBrassArt). */
export const KT_GLOW = Object.freeze({ aether: 0.95, ember: 0.9, lamp: 0.85, arc: 1 });

const { brass: Br, bronze: Bz, verdigris: Vg } = SD_RAMP;
const R = KT_RAMP;
const S = KT_ART_SIZE;
const black = (W = S, H = W) => image(W, H);

/** The decks: bronze tread plate a metre square (32 texels), each plate bevelled, a raised diamond tread across it (lit on
 *  its top-left faces), a rivet at each corner. Quiet at a distance: the read is the plates. */
export function ketchDeckArt(seed = 0x6b01) {
  const albedo = image(), emission = black(), tone = noiseField(seed, 4), r = rng(seed + 1);
  const shade = Array.from({ length: 4 }, () => 0.36 + 0.22 * r());
  const P = 32;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = Math.floor(y / P) * 2 + Math.floor(x / P), u = x % P, v = y % P;
    let t = shade[k] + 0.12 * (tone(x, y) - 0.5);
    // the tread: diamonds on a 6-texel lattice, their upper-left edges a step lighter, their lower-right a step darker
    const du = (u + v) % 6, dv = (u - v + 60) % 6;
    if (du === 0 || dv === 0) t += 0.16; else if (du === 1 || dv === 1) t -= 0.1;
    putTexel(albedo, x, y, ramp(Bz, t, x, y));
  }
  for (let py = 0; py < S; py += P) for (let px = 0; px < S; px += P) {
    bevel(albedo, px, py, P, P, step(Bz, 4), step(Bz, 0));
    for (const [cx, cy] of [[3, 3], [P - 4, 3], [3, P - 4], [P - 4, P - 4]]) rivet(albedo, px + cx, py + cy, step(Br, 2), step(Bz, 0), step(Br, 4));
  }
  quantize(albedo, paletteOf(Bz, Br));
  return { albedo, emission };
}

/** The hull: clinker bronze - strakes 16 texels deep (half a metre), each lapping the one under it (its lower edge lit, a
 *  shadow under the lap), rivets along every lap, and verdigris weeping down from the laps in runs. */
export function ketchHullArt(seed = 0x6b02) {
  const albedo = image(), emission = black(), tone = noiseField(seed, 8), run = noiseField(seed + 1, 32, S, S, 2);
  const H = 16;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = y % H, weep = run(x, y) > 0.68 && v > 2 && v < 13 ? 1 : 0;
    let t = 0.42 + 0.2 * (tone(x, y) - 0.5) - (v > 12 ? 0.18 : 0) + (v < 2 ? 0.12 : 0);
    putTexel(albedo, x, y, weep ? ramp(Vg, 0.35 + 0.3 * (tone(x, y) - 0.5) + 0.2 * (1 - v / H), x, y) : ramp(Bz, t, x, y));
  }
  for (let y = 0; y < S; y += H) {
    for (let x = 0; x < S; x++) { putTexel(albedo, x, y, step(Bz, 4)); putTexel(albedo, x, y + H - 1, step(Bz, 0)); }
    for (let x = 4; x < S; x += 8) rivet(albedo, x, y + 2, step(Br, 2), step(Bz, 0), step(Br, 4));
  }
  quantize(albedo, paletteOf(Bz, Vg, Br));
  return { albedo, emission };
}

/** The machinery: dark iron in bolted panels 32 texels square, each bevelled, a bolt head at its corners and its middles. */
export function ketchIronArt(seed = 0x6b03) {
  const albedo = image(), emission = black(), tone = noiseField(seed, 4), fine = noiseField(seed + 1, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) putTexel(albedo, x, y, ramp(R.iron, 0.4 + 0.18 * (tone(x, y) - 0.5) + 0.1 * (fine(x, y) - 0.5), x, y));
  const P = 32;
  for (let py = 0; py < S; py += P) for (let px = 0; px < S; px += P) {
    bevel(albedo, px, py, P, P, step(R.iron, 3), step(R.iron, 0));
    for (const [cx, cy] of [[4, 4], [P - 5, 4], [4, P - 5], [P - 5, P - 5], [P / 2, 4], [P / 2, P - 5]]) rivet(albedo, px + cx, py + cy, step(R.iron, 3), step(R.iron, 0), step(R.iron, 4));
  }
  quantize(albedo, paletteOf(R.iron));
  return { albedo, emission };
}

/** The pipes and coils: copper, its grain along the pipe (u), a brass band each 16 texels with its rivets, and a little
 *  verdigris at every band. */
export function ketchCopperArt(seed = 0x6b04) {
  const albedo = image(), emission = black(), grain = noiseField(seed, 4, S, S, 16);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = y / S, round = 0.5 + 0.5 * Math.sin(v * Math.PI * 2);   // the pipe's roundness across v: its lit crown
    putTexel(albedo, x, y, ramp(R.copper, 0.25 + 0.45 * round + 0.15 * (grain(x, y) - 0.5), x, y));
  }
  for (let x = 0; x < S; x += 16) for (let y = 0; y < S; y++) {
    putTexel(albedo, x, y, step(Br, 3)); putTexel(albedo, x + 1, y, step(Br, 2)); putTexel(albedo, x + 2, y, y % 6 < 2 ? step(Vg, 1) : step(Br, 0));
  }
  quantize(albedo, paletteOf(R.copper, Br, Vg));
  return { albedo, emission };
}

/** Iron grating: bars 3 texels wide on an 8-texel lattice over a black gap, each bar lit on its top-left. */
export function ketchGrateArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x % 8, v = y % 8, bar = u < 3 || v < 3;
    putTexel(albedo, x, y, bar ? step(R.iron, u === 0 || v === 0 ? 3 : u === 2 || v === 2 ? 1 : 2) : step(R.iron, 0));
  }
  return { albedo, emission };
}

/** A glass of light (`L` its ramp): its heart bright, swirling bands round it, its rim dark - lit with its own colour, a
 *  share `glow` of it. The aether a cell and a true resonator burn with; the ember of one put out of tune. */
function lightGlassArt(L, glow, seed) {
  const albedo = image(), emission = black(), swirl = noiseField(seed, 6);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x - S / 2) / (S / 2), dy = (y - S / 2) / (S / 2), d = Math.min(1, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    const band = 0.5 + 0.5 * Math.sin(a * 3 + d * 9 + 6 * swirl(x, y));
    const t = Math.max(0, Math.min(1, 1 - d * 0.85 + 0.25 * (band - 0.5)));
    const c = ramp(L, t, x, y);
    putTexel(albedo, x, y, c); putTexel(emission, x, y, scale(c, glow * (0.35 + 0.65 * t)));
  }
  quantize(albedo, paletteOf(L));
  return { albedo, emission };
}
export const ketchAetherArt = () => lightGlassArt(R.aether, KT_GLOW.aether, 0x6b06);
export const ketchEmberArt = () => lightGlassArt(R.ember, KT_GLOW.ember, 0x6b07);

/** A sail-vane: brass ribs fanning from the vane's foot (v 1) over dark copper mesh, the mesh's cross-hatch lit faintly. */
export function ketchVaneArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const a = Math.atan2(x - S / 2, S - y), rib = Math.abs(((a * 8) / Math.PI) % 1) < 0.12 || Math.abs(((a * 8) / Math.PI) % 1) > 0.94;
    const mesh = (x + y) % 4 === 0 || (x - y + 64) % 4 === 0;
    putTexel(albedo, x, y, rib ? step(Br, y < 8 ? 4 : 3) : mesh ? step(R.copper, 2) : step(R.copper, 0));
  }
  for (let x = 0; x < S; x++) { putTexel(albedo, x, 0, step(Br, 5)); putTexel(albedo, x, 1, step(Br, 3)); }
  quantize(albedo, paletteOf(Br, R.copper));
  return { albedo, emission };
}

/** Gold leaf, engraved: bright brass worked in a scroll of lines every 16 texels, its edges rubbed bright and faintly alight. */
export function ketchGiltArt(seed = 0x6b09) {
  const albedo = image(), emission = black(), tone = noiseField(seed, 8);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const scroll = Math.abs(Math.sin((x / 16) * Math.PI) * 6 - (y % 16) + 8) < 1;
    putTexel(albedo, x, y, scroll ? step(Br, 2) : ramp(Br, 0.62 + 0.3 * (tone(x, y) - 0.5), x, y));
  }
  for (let x = 0; x < S; x++) { putTexel(albedo, x, 0, step(Br, 5)); putTexel(emission, x, 0, scale(step(Br, 5), 0.06)); putTexel(albedo, x, S - 1, step(Br, 1)); }
  quantize(albedo, paletteOf(Br));
  return { albedo, emission };
}

/** Dwemer dressed stone: warm grey ashlar a metre by half a metre in courses (each block bevelled from the top-left), a
 *  brass line along the top of every second course. */
export function ketchStoneArt(seed = 0x6b0a) {
  const albedo = image(), emission = black(), r = rng(seed), tone = noiseField(seed + 1, 4), fine = noiseField(seed + 2, 16);
  const W = 32, H = 16, J = 2, shade = Array.from({ length: 16 }, () => 0.3 + 0.32 * r());
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const row = Math.floor(y / H), xs = x + (row % 2) * (W / 2), bx = ((xs % W) + W) % W, by = y % H, k = row * 2 + Math.floor((((xs % S) + S) % S) / W);
    if (by < J && row % 2 === 0) { putTexel(albedo, x, y, step(Br, by === 0 ? 3 : 1)); continue; }
    if (bx < J || by < J) { putTexel(albedo, x, y, step(R.stone, 0)); continue; }
    putTexel(albedo, x, y, ramp(R.stone, shade[k % 16] + 0.14 * (tone(x, y) - 0.5) + 0.06 * (fine(x, y) - 0.5), x, y));
  }
  for (let row = 0; row < S / H; row++) for (let c = 0; c < 3; c++) bevel(albedo, c * W - (row % 2) * (W / 2) + J, row * H + J, W - J, H - J, step(R.stone, 3), step(R.stone, 1));
  quantize(albedo, paletteOf(R.stone, Br));
  return { albedo, emission };
}

/** A gear's face: its hub and spokes in iron, its rim's teeth in brass, rings of rivets - the engine's drum, the helm's
 *  wheel. One picture over the whole disc (u, v 0..1 across it). */
export function ketchGearArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (x + 0.5 - S / 2) / (S / 2), dy = (y + 0.5 - S / 2) / (S / 2), d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const spoke = Math.abs(Math.sin(a * 3)) < 0.18, tooth = d > 0.86 && Math.sin(a * 24) > 0;
    const c = d > 1 ? step(R.iron, 0) : tooth ? step(Br, 3) : d > 0.78 ? step(Br, 2) : d < 0.2 ? step(Br, 4) : spoke ? step(R.iron, 3) : step(R.iron, 1);
    putTexel(albedo, x, y, c);
  }
  quantize(albedo, paletteOf(R.iron, Br));
  return { albedo, emission };
}

/** THE LAND BELOW - the fields outside Daggerfall as a hawk sees them from the Ketch's height: patched fields in greens
 *  and ploughed browns, hedgerows between them, a road and a river across, the patches' pattern tiling at its edges.
 *  Matte: the frame's light and the fog over it. */
export function ketchGroundArt(seed = 0x6b0d) {
  const G = KT_GROUND_SIZE, albedo = image(G), emission = black(G), r = rng(seed);
  const tone = noiseField(seed + 1, 16, G, G), cell = 32;
  const plots = Array.from({ length: (G / cell) * (G / cell) }, () => ({ kind: r() < 0.62 ? 'field' : 'soil', t: 0.3 + 0.45 * r(), furrow: r() < 0.5 }));
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
    const p = plots[Math.floor(y / cell) * (G / cell) + Math.floor(x / cell)], u = x % cell, v = y % cell;
    const hedge = u < 1 || v < 1;
    const furrow = p.kind === 'soil' && (p.furrow ? x : y) % 4 === 0;
    const L = hedge ? R.field : p.kind === 'field' ? R.field : R.soil;
    putTexel(albedo, x, y, hedge ? step(R.field, 0) : ramp(L, p.t + 0.12 * (tone(x, y) - 0.5) - (furrow ? 0.12 : 0), x, y));
  }
  // a road and a river across the tile, each wrapping at its edges so the tiles meet
  for (let x = 0; x < G; x++) {
    const ry = Math.round(G * 0.3 + 10 * Math.sin((x / G) * Math.PI * 2)), wy = Math.round(G * 0.72 + 18 * Math.sin((x / G) * Math.PI * 4 + 1));
    for (let k = -1; k <= 1; k++) putTexel(albedo, x, ry + k, step(R.soil, 3));
    for (let k = -3; k <= 3; k++) putTexel(albedo, x, wy + k, step(R.water, Math.abs(k) > 2 ? 0 : Math.abs(k) > 0 ? 1 : 2));
  }
  quantize(albedo, paletteOf(R.field, R.soil, R.water));
  return { albedo, emission };
}

/** A puff (a cloud's or the steam's): white in its own ramp, round and lumpy, its alpha falling off to its rim - a
 *  billboard's picture. `warm` the steam's faint brass in its shadow. */
function puffArt(seed, warm = false) {
  const P = KT_PUFF_SIZE, albedo = image(P), emission = black(P), lump = noiseField(seed, 6, P, P), fine = noiseField(seed + 1, 16, P, P);
  for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
    const dx = (x + 0.5 - P / 2) / (P / 2), dy = (y + 0.5 - P / 2) / (P / 2), d = Math.hypot(dx, dy * 1.15);
    const edge = 0.62 + 0.32 * lump(x, y);
    if (d > edge) { putTexel(albedo, x, y, step(R.cloud, 0), 0); continue; }
    const t = 0.35 + 0.55 * (1 - dy) / 2 + 0.15 * (fine(x, y) - 0.5);   // lit from above
    const c = ramp(R.cloud, t, x, y);
    putTexel(albedo, x, y, warm && t < 0.45 ? blendRgb(c, step(Br, 3), 0.2) : c, d > edge - 0.12 ? 128 : 255);
  }
  return { albedo, emission };
}
export const ketchCloudArt = () => puffArt(0x6b0e);
export const ketchSteamArt = () => puffArt(0x6b0f, true);

/** AN ARC-COIL'S LIGHTNING, frame `k` of four: a jagged bolt along u across the picture, its core white and its glow the
 *  aether's, each frame its own path - on black, so its quad adds nothing but the light it gives. */
export function ketchArcArt(k) {
  const albedo = image(), emission = black(), r = rng(0x6b10 + k);
  let yy = S / 2;
  for (let x = 0; x < S; x++) {
    yy = Math.max(10, Math.min(S - 10, yy + (r() - 0.5) * 7));
    for (let dy = -4; dy <= 4; dy++) {
      const a = Math.abs(dy), c = a === 0 ? step(R.aether, 4) : a < 2 ? step(R.aether, 3) : step(R.aether, 1);
      if (a > 3 && r() < 0.5) continue;
      putTexel(albedo, x, yy + dy, c); putTexel(emission, x, yy + dy, scale(c, KT_GLOW.arc * (a === 0 ? 1 : a < 2 ? 0.8 : 0.4)));
    }
  }
  return { albedo, emission };
}

/** A lamp's glass: warm brass light, brightest at its heart. */
export function ketchLampArt() {
  const L = SD_RAMP.brass, albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.min(1, Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2)), c = ramp(L, 1 - 0.6 * d, x, y);
    putTexel(albedo, x, y, c); putTexel(emission, x, y, scale(c, KT_GLOW.lamp * (1 - 0.5 * d)));
  }
  return { albedo, emission };
}

/** The anchor chain's and the rigging's links: iron ovals along v, every other one turned edge-on (a bar). */
export function ketchChainArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = y % 16, link = Math.floor(y / 16) % 2, u = Math.abs(x - S / 2);
    const on = link === 0 ? Math.abs(Math.hypot(u / 1.6, v - 8) - 6) < 2 : u < 4;
    putTexel(albedo, x, y, on ? step(R.iron, v < 6 ? 3 : 2) : step(R.iron, 0));
  }
  return { albedo, emission };
}

/** The rigging nets: brass cord on a 32-texel lattice - a mesh a metre across (a cord two texels thick, lit on its upper-left), knotted at every
 *  crossing; every hole transparent (alpha 0 - a cutout), so the deck's view of the sky is the net's own. */
export function ketchNetArt() {
  const albedo = image(), emission = black();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = (x + y) % 32, v = (x - y + 320) % 32, cord = u < 2 || v < 2, knot = u < 3 && v < 3;
    if (!cord) { putTexel(albedo, x, y, step(Br, 0), 0); continue; }
    putTexel(albedo, x, y, knot ? step(Br, 2) : u === 0 || v === 0 ? step(Br, 4) : step(Br, 3));
  }
  return { albedo, emission };
}
/** A port's glass: warm light behind leaded panes, its frame brass - lit with its own light. */
export function ketchGlassArt() {
  const albedo = image(), emission = black(), L = SD_RAMP.brass;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const lead = x % 16 < 2 || y % 16 < 2, rim = x < 3 || y < 3 || x > S - 4 || y > S - 4;
    const c = rim ? step(Br, 2) : lead ? step(R.iron, 1) : ramp(L, 0.7 + 0.25 * Math.sin((x + y) * 0.2), x, y);
    putTexel(albedo, x, y, c); if (!rim && !lead) putTexel(emission, x, y, scale(c, KT_GLOW.lamp * 0.7));
  }
  return { albedo, emission };
}

/** EVERY TEXTURE THE KETCH WEARS, by record: `[record, { albedo, emission }]`. */
/** @returns {Array<[number, { albedo: import('../superDungeon/sdPixelKit.js').Img, emission: import('../superDungeon/sdPixelKit.js').Img }]>} */
export const ketchArt = () => [
  [KT_REC.deck, ketchDeckArt()], [KT_REC.hull, ketchHullArt()], [KT_REC.brass, realmBrassArt(0x6b05)], [KT_REC.iron, ketchIronArt()],
  [KT_REC.copper, ketchCopperArt()], [KT_REC.grate, ketchGrateArt()], [KT_REC.aether, ketchAetherArt()], [KT_REC.ember, ketchEmberArt()],
  [KT_REC.vane, ketchVaneArt()], [KT_REC.gilt, ketchGiltArt()], [KT_REC.stone, ketchStoneArt()], [KT_REC.edge, realmEdgeArt()],
  [KT_REC.gear, ketchGearArt()], [KT_REC.ground, ketchGroundArt()], [KT_REC.cloud, ketchCloudArt()], [KT_REC.steam, ketchSteamArt()],
  [KT_REC.arc0, ketchArcArt(0)], [KT_REC.arc1, ketchArcArt(1)], [KT_REC.arc2, ketchArcArt(2)], [KT_REC.arc3, ketchArcArt(3)],
  [KT_REC.lamp, ketchLampArt()], [KT_REC.chain, ketchChainArt()], [KT_REC.net, ketchNetArt()], [KT_REC.glass, ketchGlassArt()],
];
/** The records drawn as billboards (their alpha their own). */
export const KT_PUFF_RECORDS = Object.freeze([KT_REC.cloud, KT_REC.steam]);
