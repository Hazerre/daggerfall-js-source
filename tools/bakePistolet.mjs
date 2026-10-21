// THE DWARVEN PISTOLET'S MORROWIND ASSETS, from its own sprite (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md).
//
//     node tools/bakePistolet.mjs [--sheet=<png>]
//
// The owner, asked what the Morrowind arm should hold: "Build one from the sprite". There is no Blender file for this gun
// (the Thunderlock's came as one - tools/bakeThunderlock.mjs), so the model IS the inventory sprite, extruded: every drawn
// pixel of public/art/pistolet-icon.png a block GAUGE pixels thick, its faces drawn only where a neighbour is empty, each
// face coloured by its own pixel through a texture that is the sprite itself (nearest-sampled at the texel's centre, so
// a face is one flat colour - the pixel look, kept in three dimensions). The same NIF and DDS writers the Thunderlock's
// bake uses (tools/nifWrite.mjs, tools/meshTexture.mjs), and the same frame: +Y the barrel (the muzzle), +Z up, +X the
// gun's right, the grip's middle - where the fist closes, tools/pistoletArt.mjs BAND - at the origin.
//
// Deterministic: same sprite in, same bytes out; test/formats/morrowind/pistoletmw.test.js re-runs it and compares.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readPng, writePng } from './pngIO.mjs';
import { meshToNif } from './nifWrite.mjs';
import { mipChain, writeDds } from './meshTexture.mjs';
import { gild } from './gunIcons.mjs';
import { BAND } from './pistoletArt.mjs';
import { MW_UNITS_PER_METRE } from './bakeThunderlock.mjs';
import { isMain } from './lib/isMain.mjs';

export const SOURCE = 'public/art/pistolet-icon.png';
export const OUT = Object.freeze({
  mesh: 'src/assets/mw/meshes/pistolet.nif',
  texture: 'src/assets/mw/textures/pistolet.dds',
  gildedMesh: 'src/assets/mw/meshes/pistolet_gilded.nif',
  gildedTexture: 'src/assets/mw/textures/pistolet_gilded.dds',
});

/** How long the pistol is: 0.36 m, a horse pistol's length - its sprite is 24 pixels long, so a pixel is 1.05 Morrowind
 *  units (MW_UNITS_PER_METRE, the Thunderlock baker's pinned number). */
export const PISTOLET_METRES = 0.36;
/** How thick it is, in sprite pixels: 2 - about three centimetres, a barrel's and a grip's. */
export const GAUGE = 2;
/** The texture's size: the sprite padded to a power of two (a DDS wants one), the pixels at its top left. */
export const ATLAS = 32;

/** The faces of a block, each with its outward normal and its four corners as offsets in (x, y, z) of the unit cube. */
const FACES = Object.freeze([
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], dx: 1, dy: 0, dz: 0 },
  { n: [-1, 0, 0], c: [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]], dx: -1, dy: 0, dz: 0 },
  { n: [0, 1, 0], c: [[1, 1, 0], [0, 1, 0], [0, 1, 1], [1, 1, 1]], dx: 0, dy: 1, dz: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], dx: 0, dy: -1, dz: 0 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], dx: 0, dy: 0, dz: 1 },
  { n: [0, 0, -1], c: [[0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, 0]], dx: 0, dy: 0, dz: -1 },
]);

/**
 * The extruded mesh: `{ name, positions, normals, uvs, indices, bounds }` in the port's mesh shape (tools/fbxMesh.mjs's).
 * A voxel at sprite pixel (px, py), layer k of GAUGE, spans x in [k - GAUGE/2, k + 1 - GAUGE/2] (its thickness, centred),
 * y = (gx - px - 1 .. gx - px) (the barrel at the sprite's LEFT runs to +Y) and z = (gy - py - 1 .. gy - py) (the sprite's
 * down is -Z), all times `unit`; (gx, gy) the grip's middle. Every face's corners take its pixel's texel centre.
 */
export function extrude(sprite, { unit = PISTOLET_METRES * MW_UNITS_PER_METRE / sprite.width, gauge = GAUGE, grip = [BAND.cx * sprite.width, BAND.cy * sprite.height] } = {}) {
  const { width: w, height: h, data } = sprite;
  const solid = (px, py) => px >= 0 && py >= 0 && px < w && py < h && data[(py * w + px) * 4 + 3] >= 128;
  const positions = [], normals = [], uvs = [], indices = [];
  const [gx, gy] = grip;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (!solid(px, py)) continue;
      // V UP, the port's mesh convention (tools/fbxMesh.mjs's, which nifWrite.mjs turns down for the NIF): the texture's top row
      // is v = 1
      const u = (px + 0.5) / ATLAS, v = 1 - (py + 0.5) / ATLAS;
      for (let k = 0; k < gauge; k++) {
        for (const f of FACES) {
          // a face between two solid cells is inside the gun: the neighbour across it, in the sprite (y, z) or the
          // gauge (x)
          const nx = k + f.dx;
          const across = f.dx ? nx >= 0 && nx < gauge : solid(px - f.dy, py - f.dz);
          if (across) continue;
          const base = positions.length / 3;
          for (const [cx, cy, cz] of f.c) {
            positions.push((k + cx - gauge / 2) * unit, (gx - px - 1 + cy) * unit, (gy - py - 1 + cz) * unit);
            normals.push(...f.n);
            uvs.push(u, v);
          }
          indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], positions[i + a]); max[a] = Math.max(max[a], positions[i + a]); }
  return { name: 'Dwarven_Pistolet', positions, normals, uvs, indices, bounds: { min, max }, unit };
}

/** The sprite on its power-of-two texture, the rest transparent. */
export function atlasOf(sprite) {
  const data = new Uint8Array(ATLAS * ATLAS * 4);
  for (let y = 0; y < sprite.height; y++) for (let x = 0; x < sprite.width; x++) {
    const s = (y * sprite.width + x) * 4, d = (y * ATLAS + x) * 4;
    for (let c = 0; c < 4; c++) data[d + c] = sprite.data[s + c];
  }
  return { width: ATLAS, height: ATLAS, data };
}

/** The bake: the mesh and its two textures - its own colours and the Sunken Sovereign's gold. Pure. */
export function bakePistolet(spriteBytes) {
  const sprite = readPng(spriteBytes);
  const mesh = extrude(sprite);
  const plain = atlasOf(sprite);
  const gold = atlasOf(gild(sprite));
  return {
    mesh,
    nif: meshToNif(mesh, { texture: 'pistolet.dds', node: 'Pistolet' }),
    dds: writeDds(mipChain(plain)),
    gildedNif: meshToNif(mesh, { texture: 'pistolet_gilded.dds', node: 'SunkenSovereign' }),
    gildedDds: writeDds(mipChain(gold)),
    atlas: plain,
  };
}

if (isMain(import.meta.url)) {
  const save = (path, bytes) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); };
  const r = bakePistolet(readFileSync(SOURCE));
  save(OUT.mesh, r.nif);
  save(OUT.texture, r.dds);
  save(OUT.gildedMesh, r.gildedNif);
  save(OUT.gildedTexture, r.gildedDds);
  const b = r.mesh.bounds, size = [0, 1, 2].map((k) => +(b.max[k] - b.min[k]).toFixed(2));
  console.log(`${SOURCE}: ${r.mesh.positions.length / 3} vertices, ${r.mesh.indices.length / 3} triangles`);
  console.log(`  size ${size.join(' x ')} units = ${(size[1] / MW_UNITS_PER_METRE * 100).toFixed(0)} cm long; muzzle at +${b.max[1].toFixed(1)}, butt at ${b.min[1].toFixed(1)}`);
  for (const [k, p] of Object.entries(OUT)) console.log(`  ${p}  ${({ mesh: r.nif, texture: r.dds, gildedMesh: r.gildedNif, gildedTexture: r.gildedDds })[k].length} bytes`);
  const sheet = process.argv.find((a) => a.startsWith('--sheet='))?.slice(8);
  if (sheet) save(sheet, writePng(r.atlas));
}
