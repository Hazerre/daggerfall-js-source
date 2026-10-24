// @ts-check
// SOUNDSCAPE (2026-10-24): THE SEA'S AND THE WILD'S CLIPS, at run time - the ones tools/soundscapeSfx.mjs synthesises
// and the CC0 recordings tools/soundscapeSfxInstall.mjs bakes (public/sfx/{sea,shore,wild,town}-*.wav, provenance in
// public/sfx/SOURCES.md), registered on the audio bus under string keys - the door a mod's WAV already uses
// (audio.registerSound, MW-D40; the naval host's own loader in systems/naval/navalSounds.js). Each group is a set of
// takes the player draws from, so no call is the same twice running. Daggerfall's own (the bell, the lap of water, the
// people) play by their DAGGER.SND indices and are not here.
import { APP_ROOT } from '../appRoot.js';

/** @param {string} stem @param {number} n */
const takes = (stem, n) => Object.freeze(Array.from({ length: n }, (_, i) => `${stem}-${i + 1}`));

/** The keys, by group: each a take's key, which is its file's stem (`sea-slap-1` is public/sfx/sea-slap-1.wav). */
export const SCAPE_SFX = Object.freeze({
  seaSlap: takes('sea-slap', 3),
  seaCreak: takes('sea-creak', 2),
  seaRope: takes('sea-rope', 2),
  seaLuff: takes('sea-luff', 2),
  seaSpray: takes('sea-spray', 2),
  gull: takes('sea-gull', 6),
  shoreCrash: takes('shore-crash', 2),
  owl: takes('wild-owl', 2),
  howl: takes('wild-howl', 2),
  crow: takes('wild-crow', 1),
  frog: takes('wild-frog', 4),
  anvil: takes('town-anvil', 2),
});

/** Every key's file under public/sfx. */
export const SCAPE_SFX_FILES = Object.freeze(Object.fromEntries(Object.values(SCAPE_SFX).flat().map((key) => [key, `${key}.wav`])));

export const scapeSfxUrl = (/** @type {string} */ file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

/** @type {Promise<number> | null} */
let _sounds = null;
/** Register every clip, once (the first frame the soundscape is heard). Answers how many took; a clip that will not
 *  load is silence, never a stopped voyage. @param {any} audio @param {{ fetchBytes?: ((file: string) => Promise<Uint8Array>) | null }} [opts] */
export function installSoundscapeSounds(audio, { fetchBytes = null } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  return (_sounds ??= (async () => {
    const load = fetchBytes ?? (async (/** @type {string} */ file) => {
      const r = await fetch(scapeSfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    let n = 0;
    for (const [key, file] of Object.entries(SCAPE_SFX_FILES)) {
      try { if (await audio.registerSound(key, await load(file))) n++; } catch { /* the sea goes on, without it */ }
    }
    return n;
  })());
}
/** Test seam. */
export function _resetSoundscapeSounds() { _sounds = null; }
