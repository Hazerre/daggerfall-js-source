// @ts-check
// HORSE-VOICE (2026-10-24, the owner: "more varied horse sounds") - THE HORSE HEARD, the enhanced skin's own
// (bible/08-Audio/Audio.md HORSE-VOICE; bible/06-Systems/Horse-Care.md).
//
// DFU's TransportManager gives a horse one voice and one ground: the neigh (AnimalHorse, 99) on a clock that re-rolls to
// 2-39 s and to 1-4 s on a mount, and the clop on its loop - HorseClop (97) slow, HorseClop2 (298) fast, HorseAndCart
// (104) for the cart - whatever the hooves come down on (systems/riding.js RidingAnimator, every arm kept). Behind the
// port's own sounds (systems/enhancedSounds.js, ES1) and while a mount is under the rider this module is heard in that
// place; off, the rig plays DFU's two exactly as before (player/mountRig.js). Not a DFU member. Ledger A (HORSE-VOICE).
//
// THE VOICES (`createHorseVoice`). DFU's neigh clock stays the clock: each moment it rolls a voice is said, picked by
// the horse's MOOD at that moment (`horseMood`, `HORSE_MOODS`) - the first after a mount a whinny (the neigh lifted a
// little); with foes in sight the alarm (sharp snorts and high neighs); blown the tired (blows and snorts); at the
// gallop, at the walk (calm: soft snorts and blows), and riding on (neighs and snorts). A neigh is DFU's own clip at one
// of NEIGH_PITCHES, a snort and a blow the port's (tools/horseSfx.mjs), and no clip twice in a row while another is
// there. Beside the clock, three of the port's own: THE GALLOP'S BREATH - a horse galloping on breathes once a stride
// (its breath and its legs locked together), so past GALLOP_BREATH_AFTER_S of a gallop, or galloping blown, an exhale
// every GALLOP_BREATH_S, harder as the gallop runs on and the breath runs out; THE BLOWN HORSE - after a long gallop,
// or with horse care's breath short (systems/upkeep/upkeepRuntime.js `bar`: the breath's share, or winded), heavy
// breaths and blows at the walk and standing, every TIRED_BREATH_S; THE SPOOK - foes coming into sight (encounters.js
// areEnemiesNearby, sampled every FOE_SAMPLE_S) startle it: the alarm snort and, on its heels, a high neigh, never
// again within SPOOK_COOLDOWN_S. A pause holds them all.
//
// THE HOOVES (`hoofClipFor`). The ground under the horse is the stride's own answer (systems/footsteps.js
// pickFootstepKind, which the world host already keeps each frame for the peers' pose - PEER-FS1's `_lastFootstepKind`):
// a path, a road, a town's street, a bridge, anything built (Stone) is DFU's own clop; the open ground (Outside) a duller
// fall in the grass; Snow the crunch; Submerged and Shallow a splash. The gait is DFU's: the slow clip (a walk, below
// half speed) or the fast, at DFU's volume and its 1.2 pitch at the gallop - and each of the port's loops keeps DAGGER.SND's
// own cadence (tools/horseSfx.mjs HOOF_CADENCE), so a ride's beat is the game's on every ground. The cart keeps its own
// rattle. A clip not loaded yet plays DFU's, so the ride is never silent. Another player's horse takes its ground off
// their pose's `fk` the same way (net/remotePlayers.js).

import { SOUND } from '../soundClips.js';
import { FOOTSTEP_KIND } from '../footsteps.js';
import { RIDING_SOUND } from '../riding.js';
import { APP_ROOT } from '../appRoot.js';

/** The port's clips (tools/horseSfx.mjs -> public/sfx/horse-*.wav), by role, as the bus's string keys. */
export const HORSE_SFX = Object.freeze({
  snort: Object.freeze(['horse:snort-1', 'horse:snort-2', 'horse:snort-3']),
  blow: Object.freeze(['horse:blow-1', 'horse:blow-2']),
  breath: Object.freeze(['horse:breath-1', 'horse:breath-2', 'horse:breath-3']),
  spook: 'horse:spook',
  hooves: Object.freeze({
    soft: Object.freeze({ slow: 'horse:soft-slow', fast: 'horse:soft-fast' }),
    snow: Object.freeze({ slow: 'horse:snow-slow', fast: 'horse:snow-fast' }),
    water: Object.freeze({ slow: 'horse:water-slow', fast: 'horse:water-fast' }),
  }),
});
/** Each key's file under public/sfx. */
export const HORSE_SFX_FILES = Object.freeze(Object.fromEntries([
  ...HORSE_SFX.snort, ...HORSE_SFX.blow, ...HORSE_SFX.breath, HORSE_SFX.spook,
  ...Object.values(HORSE_SFX.hooves).flatMap((g) => [g.slow, g.fast]),
].map((key) => [key, `${key.replace(':', '-')}.wav`])));

/** The neigh's pitches (DFU's own clip, AnimalHorse); the whinny a mount gets; the spook's neigh. */
export const NEIGH_PITCHES = Object.freeze([0.94, 1, 1.05, 1.1]);
export const MOUNT_WHINNY_PITCH = 1.08;
export const SPOOK_NEIGH_PITCH = 1.14;
/** The spook's neigh comes this long after its snort; a second spook waits this long after the first. */
export const SPOOK_NEIGH_LAG_S = 0.38;
export const SPOOK_COOLDOWN_S = 30;
/** How often foes in sight are asked (the ask walks the street's foes). */
export const FOE_SAMPLE_S = 0.25;
/** A gallop this long breathes in its stride - one exhale every GALLOP_BREATH_S (the fast clop's two falls, a stride
 *  of the sprite's four frames: systems/riding.js ANIM_FRAME_TIME x 4 = 0.5 s), a little uneven. */
export const GALLOP_BREATH_AFTER_S = 8;
export const GALLOP_BREATH_S = 0.52;
export const GALLOP_BREATH_JITTER = 0.06;
/** The gallop's breath rises from the first level to the second over GALLOP_EFFORT_S more of it (or as the breath runs out). */
export const GALLOP_EFFORT_S = 20;
export const GALLOP_BREATH_GAIN = Object.freeze([0.45, 0.8]);
/** Blown: horse care's breath under this share (or winded); or a gallop past GALLOP_BREATH_AFTER_S just ended, for
 *  RECOVER_SHARE of its length, at most RECOVER_MAX_S. */
export const BREATH_TIRED = 0.4;
export const RECOVER_SHARE = 0.4;
export const RECOVER_MAX_S = 14;
/** A blown horse at the walk or standing: a heavy breath (or, one in BLOW_EVERY, a blow) every TIRED_BREATH_S. */
export const TIRED_BREATH_S = Object.freeze([2.2, 3.4]);
export const TIRED_BREATH_GAIN = 0.62;
export const BLOW_EVERY = 3;
/** Each voice's level against the neigh's (the rig plays them all at DFU's RidingVolumeScale on top). */
export const VOICE_GAIN = Object.freeze({ neigh: 1, snort: 0.85, blow: 0.8, spook: 1 });
/** A mood's voices and their weights (each sums to 1). */
export const HORSE_MOODS = Object.freeze({
  alarm: Object.freeze({ neigh: 0.5, snort: 0.5 }),
  tired: Object.freeze({ blow: 0.5, snort: 0.3, neigh: 0.2 }),
  gallop: Object.freeze({ neigh: 0.35, snort: 0.45, blow: 0.2 }),
  calm: Object.freeze({ snort: 0.45, blow: 0.35, neigh: 0.2 }),
  ride: Object.freeze({ neigh: 0.4, snort: 0.4, blow: 0.2 }),
});
/** In the alarm the snorts are a little higher and the neigh at the top of its range. */
export const ALARM_SNORT_PITCH = 1.08;

/** The ground a hoof comes down on, off the stride's kind (systems/footsteps.js FOOTSTEP_KIND): 'hard' (DFU's own clop),
 *  'soft', 'snow' or 'water'. Anything else - a kind not known, none at all - is DFU's. Pure. */
export function hoofSurface(kind) {
  if (kind === FOOTSTEP_KIND.Outside) return 'soft';
  if (kind === FOOTSTEP_KIND.Snow) return 'snow';
  if (kind === FOOTSTEP_KIND.Submerged || kind === FOOTSTEP_KIND.Shallow) return 'water';
  return 'hard';
}

/** The keys the bus holds (installHorseSounds), and whether one is there. */
const _ready = new Set();
export const horseSoundReady = (key) => _ready.has(key);

/**
 * The riding loop's clip: DFU's (`clip` a RIDING_SOUND name - the slow clop, the fast or the cart's) as a SOUND index,
 * or the port's loop for that gait on that ground (a string key) once it is loaded. The cart keeps its own; a hard
 * ground, a kind not known and a loop not loaded play DFU's. Pure but for the loaded set (`ready`).
 */
export function hoofClipFor(clip, kind, ready = horseSoundReady) {
  const surface = hoofSurface(kind);
  const gait = clip === RIDING_SOUND.horseSlow ? 'slow' : clip === RIDING_SOUND.horseFast ? 'fast' : null;
  const key = surface === 'hard' || !gait ? null : HORSE_SFX.hooves[surface][gait];
  return key && ready(key) ? key : SOUND[/** @type {keyof typeof SOUND} */ (clip)];
}

/** The mood at a voice's moment. Pure. */
export function horseMood({ alarm = false, tired = false, galloping = false, slow = false, moving = true } = {}) {
  if (alarm) return 'alarm';
  if (tired) return 'tired';
  if (galloping) return 'gallop';
  if (slow || !moving) return 'calm';
  return 'ride';
}

/** One of `list` by `roll` (0..1), never `last` while another is there. Pure. */
export function pickOther(list, last, roll) {
  const pool = list.length > 1 ? list.filter((x) => x !== last) : list;
  return pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))];
}

/** A mood's voice kind by `roll` (0..1) over its weights, among the kinds `has(kind)` answers for. Pure.
 *  @param {string} mood @param {number} roll @param {(kind: string) => boolean} [has] */
export function pickKind(mood, roll, has = () => true) {
  const weights = Object.entries(HORSE_MOODS[mood] ?? HORSE_MOODS.ride).filter(([k]) => k === 'neigh' || has(k));
  const sum = weights.reduce((a, [, w]) => a + w, 0);
  let at = roll * sum;
  for (const [k, w] of weights) { if (at < w) return k; at -= w; }
  return weights[weights.length - 1][0];
}

/**
 * THE VOICES, a frame at a time. `mount(riding)` on every change of mode (systems/riding.js mount's moment: a mount's
 * whinny is the next voice); `update(dt, ctx)` once a frame while riding answers the shots due now - `[{ clip, volume,
 * pitch }]`, `volume` against the neigh's (the rig puts DFU's RidingVolumeScale on top). `ctx`: `neigh` (DFU's clock
 * rolled this frame), `clip` (the riding loop's RIDING_SOUND name), `moving`, `running`, `paused`, `breath` (horse
 * care's share, null without it), `winded`, `foesNear()` (asked every FOE_SAMPLE_S), `ready(key)` (a clip loaded).
 */
export function createHorseVoice({ rolls = Math.random } = {}) {
  let now = 0, whinnyDue = false, gallopFor = 0, recover = 0, breathAt = 0, tiredAt = 0, tiredCount = 0;
  let foes = false, foeAskAt = 0, spookAt = -Infinity;
  /** @type {Record<string, any>} */
  const last = {};
  /** @type {{ at: number, clip: any, volume: number, pitch: number }[]} */
  let queue = [];
  const say = (out, clip, volume, pitch = 1) => out.push({ clip, volume, pitch });
  const one = (role, ready) => {
    const list = /** @type {readonly string[]} */ (/** @type {any} */ (HORSE_SFX)[role]).filter((k) => ready(k));
    if (!list.length) return null;
    const k = pickOther(list, last[role], rolls());
    last[role] = k;
    return k;
  };
  return {
    get now() { return now; },
    get gallopFor() { return gallopFor; },
    get recover() { return recover; },
    get pending() { return queue.length; },
    mount(riding = true) {
      whinnyDue = !!riding;
      gallopFor = 0; recover = 0; tiredCount = 0;
      foes = false; foeAskAt = 0;
      queue = [];
    },
    update(dt, { neigh = false, clip = null, moving = false, running = false, paused = false, breath = null, winded = false, foesNear = null, ready = horseSoundReady } = {}) {
      /** @type {{ clip: any, volume: number, pitch: number }[]} */
      const out = [];
      if (paused) return out;   // a window up: the horse holds its breath with the world
      now += Math.max(0, Number(dt) || 0);
      for (const e of queue) if (e.at <= now) say(out, e.clip, e.volume, e.pitch);
      queue = queue.filter((e) => e.at > now);
      // the gallop, and the blowing a long one leaves
      const galloping = !!moving && !!running && clip === RIDING_SOUND.horseFast;
      if (galloping) { if (gallopFor === 0) breathAt = now + GALLOP_BREATH_S; gallopFor += dt; recover = 0; }
      else {
        if (gallopFor >= GALLOP_BREATH_AFTER_S) { recover = Math.min(RECOVER_MAX_S, gallopFor * RECOVER_SHARE); tiredAt = now + TIRED_BREATH_S[0]; }
        gallopFor = 0;
        recover = Math.max(0, recover - dt);
      }
      const short = breath != null && (!!winded || breath < BREATH_TIRED);
      const tired = short || recover > 0;
      // the foes in sight, asked at their own rate
      if (typeof foesNear === 'function' && now >= foeAskAt) {
        foeAskAt = now + FOE_SAMPLE_S;
        const seen = !!foesNear();
        if (seen && !foes && now - spookAt >= SPOOK_COOLDOWN_S && ready(HORSE_SFX.spook)) {
          spookAt = now;
          say(out, HORSE_SFX.spook, VOICE_GAIN.spook);
          queue.push({ at: now + SPOOK_NEIGH_LAG_S, clip: SOUND.AnimalHorse, volume: VOICE_GAIN.neigh * 0.9, pitch: SPOOK_NEIGH_PITCH });
        }
        foes = seen;
      }
      // the gallop's breath, once a stride
      if (galloping && (gallopFor >= GALLOP_BREATH_AFTER_S || short) && now >= breathAt) {
        breathAt = now + GALLOP_BREATH_S * (1 + GALLOP_BREATH_JITTER * (2 * rolls() - 1));
        const effort = Math.min(1, Math.max(Math.max(0, gallopFor - GALLOP_BREATH_AFTER_S) / GALLOP_EFFORT_S, breath != null ? 1 - breath : 0));
        const k = one('breath', ready);
        if (k) say(out, k, GALLOP_BREATH_GAIN[0] + (GALLOP_BREATH_GAIN[1] - GALLOP_BREATH_GAIN[0]) * effort);
      }
      // blown at the walk or standing: the heavy breaths, a blow among them
      if (!galloping && tired && now >= tiredAt) {
        tiredAt = now + TIRED_BREATH_S[0] + (TIRED_BREATH_S[1] - TIRED_BREATH_S[0]) * rolls();
        tiredCount++;
        const k = tiredCount % BLOW_EVERY === 0 ? one('blow', ready) : one('breath', ready);
        if (k) say(out, k, TIRED_BREATH_GAIN, 0.92);
      }
      // DFU's clock: its neigh's moment, said in the mood of the moment
      if (neigh) {
        if (whinnyDue) { whinnyDue = false; say(out, SOUND.AnimalHorse, VOICE_GAIN.neigh, MOUNT_WHINNY_PITCH); }
        else {
          const mood = horseMood({ alarm: foes, tired, galloping, slow: clip === RIDING_SOUND.horseSlow, moving });
          const kind = pickKind(mood, rolls(), (k) => /** @type {readonly string[]} */ (/** @type {any} */ (HORSE_SFX)[k] ?? []).some((key) => ready(key)));
          if (kind === 'neigh') {
            const p = mood === 'alarm' ? NEIGH_PITCHES[NEIGH_PITCHES.length - 1] : pickOther(NEIGH_PITCHES, last.neigh, rolls());
            last.neigh = p;
            say(out, SOUND.AnimalHorse, VOICE_GAIN.neigh, p);
          } else {
            const k = one(kind, ready);
            if (k) say(out, k, /** @type {any} */ (VOICE_GAIN)[kind], mood === 'alarm' && kind === 'snort' ? ALARM_SNORT_PITCH : 1);
          }
        }
      }
      return out;
    },
  };
}

// ---- the clips' loading: once, the first frame a horse is heard with the sounds on -----------------------------------

export const horseSfxUrl = (file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

/** A clip the bus would not take (no context yet - before the first gesture - or a fetch that failed) is asked again,
 *  no sooner than this after the last try. */
export const INSTALL_RETRY_MS = 2000;
let _install = null, _retryAt = 0;
/** @type {Map<string, Uint8Array>} */
const _bytes = new Map();
/** Register the fifteen clips. Answers how many stand; the ones that did not take are asked again on a later call
 *  (INSTALL_RETRY_MS on), their bytes kept - a clip not there plays DFU's in its place. */
export function installHorseSounds(audio, { fetchBytes = null, now = Date.now } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  if (_install) return _install;
  if (_ready.size === Object.keys(HORSE_SFX_FILES).length || now() < _retryAt) return Promise.resolve(_ready.size);
  return (_install = (async () => {
    const load = fetchBytes ?? (async (file) => {
      const r = await fetch(horseSfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    for (const [key, file] of Object.entries(HORSE_SFX_FILES)) {
      if (_ready.has(key)) continue;
      try {
        if (!_bytes.has(key)) _bytes.set(key, await load(file));
        if (await audio.registerSound(key, _bytes.get(key))) { _ready.add(key); _bytes.delete(key); }
      } catch { /* DFU's clip plays */ }
    }
    _install = null;
    if (_ready.size < Object.keys(HORSE_SFX_FILES).length) _retryAt = now() + INSTALL_RETRY_MS;
    return _ready.size;
  })());
}
/** Test seam: forget the install and the loaded set. */
export function _resetHorseSounds() { _install = null; _retryAt = 0; _ready.clear(); _bytes.clear(); }
