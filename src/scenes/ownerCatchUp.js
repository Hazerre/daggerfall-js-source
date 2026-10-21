// @ts-check
// OWNER-CLOCK (2026-10-21, the field's enemy desync - net/ownerClock.js has the wire's half): MY STREET FOES KEEP MY
// WORLD'S PACE WHILE ANYONE ELSE IS IN MY ROOM.
//
// A foe is its owner's to step, so a slow owner's foes are slow for everyone. Below 20 fps they are slower than the
// owner's own world: the host clamps its frame at 0.1 s (world.js "const dt = Math.min(0.1") and the player takes that
// whole frame, but FOE-CATCHUP (characters/enemy/enemyMotor.js FOE_MAX_FRAME_DT, 2026-09-26, Mac: "Yes, add the cap")
// hands a foe's body three FIXED_DT steps of it at most, 0.05 s - so below 10 fps an owner's foes walked at half its
// player's pace, and its every reader watched them do it. That cap is the cure for a snowball: a step is the port's
// dearest work, and a hitch that asked for more of them made the next frame dearer.
//
// THE PARITY. Online, while anyone else is in my room, the street's pool (the encounter pool every cell streams) is
// stepped again within the frame, in FOE-CATCHUP's own size of step (each call the shape of a 20 fps frame, a shape
// every pool already runs), until it has taken THE HOST'S OWN FRAME - the clamped `dt` the host hands it, the time its
// player took - and never more: the foes keep the owner's pace one to one at every rate the clamp allows, and never
// outrun it (below 10 fps that is 0.1 s a frame in two calls where FOE-CATCHUP gave 0.05 s). Only the extra calls
// OWNER_CATCHUP_SHARE of the frame's own time buys at the cost a call last measured are made - none on a clock too coarse
// to measure one (a reading of nothing is no price), none on a frame past FRAME_MS_MAX (the pool was away - a
// building, a dungeon, a hidden tab - not slow) - and the loop stops once the extras have spent that share: where the
// foes ARE what makes the frame slow, the cap's law stands as it was. Offline, alone in the room, at 20 fps and up, or
// with the foes held (a zero frame), the pool takes the host's one step exactly as before. The tactics brain's clock
// (ai/tacticsClock.js, the foes' own time) is carried with the extra steps, so a wind-up lands where its body is.
//
// "Anyone else in my room" is the host's `shared()`: world.js's `online.othersHere > 0`, the foes stream's own
// nobody-to-hear test. On the street that room is the CELL (WORLD_CELL, 16 map pixels a side), wider than the RANGE_PIXELS
// (3) the relay fans my foes frames across - so it is not "anyone who can see these foes"; with parity it need not be:
// what it turns on is my foes at my own world's pace.
//
// THE CLOCK. Each step of the page's foes is marked on the owner clock (net/ownerClock.js) - the street pool's at its
// call, a building's and a dungeon's (stepped inside the mode machine's frame) at the frame that ran them - so a foes
// frame sent before the next step says when its foes stood where it says.
//
// Wired by the world host (scenes/world.js, wireOwnerClock beside the mode machine). Not here: the dungeon's and a
// building's own foes are stepped inside their hosts' frames (dungeonContext.js, worldModes.js) beside the player's own
// work, so they take one step a frame as before - their frames carry the clock, and their readers lead by it.
import { FOE_MAX_FRAME_DT, foeFrameDt } from '../characters/enemy/enemyMotor.js';
import { tickTactics } from '../ai/tacticsClock.js';
import { ownerClock } from '../net/ownerClock.js';

/** The longest host frame the catch-up sub-steps whole (s) - world.js hands 0.1 s at most, so one extra call; a longer
 *  frame is stepped OWNER_CATCHUP_STEPS_MAX times and no more. */
export const OWNER_CATCHUP_MAX_S = 0.3;
/** The most of a frame's own time the extra steps may spend - a frame grows by a ninth at most, so no snowball. */
export const OWNER_CATCHUP_SHARE = 0.1;
/** The most calls a frame makes of the pool: OWNER_CATCHUP_MAX_S in FOE_MAX_FRAME_DT's steps. */
export const OWNER_CATCHUP_STEPS_MAX = Math.round(OWNER_CATCHUP_MAX_S / FOE_MAX_FRAME_DT);

/** The longest gap the budget reads as a frame's own time (ms): a 0.5 fps frame. Past it the pool was away (a building,
 *  a dungeon, a hidden tab), not slow, and the frame buys no extra call. */
export const FRAME_MS_MAX = 2000;

/** How a frame's foes are stepped: `n` calls of `dt` each. The host handed `foeDt` (its clamp's, or 0 held), and
 *  `extraMax` is the extra calls the frame can afford. At 20 fps and up, held, or with no extra call to spend, the
 *  host's one step exactly; under it the host's own frame in calls no longer than FOE_MAX_FRAME_DT (so the motor takes
 *  every second of it) - never more game time than the host's frame, and whatever is afforded, more than the host's
 *  one step gave a foe's body. */
export function catchUpPlan(foeDt, extraMax = OWNER_CATCHUP_STEPS_MAX) {
  if (!(foeDt > FOE_MAX_FRAME_DT)) return { n: 1, dt: foeDt };
  const n = Math.min(OWNER_CATCHUP_STEPS_MAX, Math.ceil(foeDt / FOE_MAX_FRAME_DT - 1e-9), 1 + Math.max(0, Math.floor(extraMax) || 0));
  return n < 2 ? { n: 1, dt: foeDt } : { n, dt: Math.min(FOE_MAX_FRAME_DT, foeDt / n) };
}

/** The extra calls a frame `rawMs` long affords at `perCall` ms a call: OWNER_CATCHUP_SHARE of it - none for a frame
 *  past FRAME_MS_MAX (the pool was away), none for the first (0 ms), and none at a price unread: nothing measured yet
 *  (Infinity buys nothing) or a clock too coarse to see a call (a reading of 0, or NaN, is no price - never a free one). */
export const extrasAfforded = (rawMs, perCall) => (rawMs <= FRAME_MS_MAX && perCall > 0 ? (rawMs * OWNER_CATCHUP_SHARE) / perCall : 0);

/**
 * The street's pool, stepped through the catch-up: `pool.update(dt, ...rest)` keeps its signature and its callers.
 * `shared()` - anyone else in my room (the host's own nobody-to-hear test); `clock()` ms (the page's performance.now());
 * `tick` the tactics brain's clock; `mark` the owner clock's. What a call costs is measured every frame, and the next
 * frame affords the extra calls OWNER_CATCHUP_SHARE of its own time buys at that cost; the extras stop once their
 * measured time has spent that share, whatever the forecast said.
 * @param {{ update: (dt: number, ...rest: any[]) => any }} pool
 * @param {{ shared?: () => boolean, clock?: () => number, tick?: (dt: number) => void, mark?: (ms: number) => void }} [o]
 */
export function catchUpOwnerFoes(pool, { shared = () => false, clock = () => performance.now(), tick = tickTactics, mark = (ms) => ownerClock.mark(ms) } = {}) {
  const step = pool.update;
  let lastAt = null, perCall = Infinity;   // ms: a call's cost as last measured (none yet: nothing extra is afforded)
  const timed = (dt, rest) => { const t0 = clock(); const out = step(dt, ...rest); perCall = Math.max(0, clock() - t0); return out; };
  pool.update = (dt, ...rest) => {
    const at = clock();
    const rawMs = lastAt == null ? 0 : at - lastAt;
    lastAt = at;
    mark(at);
    const plan = shared() ? catchUpPlan(dt, extrasAfforded(rawMs, perCall)) : { n: 1, dt };
    if (plan.n === 1) return timed(plan.dt, rest);
    // the host ticked the brain the frame's capped step before any pool moved; each later call carries it to its end
    const shareMs = rawMs * OWNER_CATCHUP_SHARE;
    let ticked = foeFrameDt(dt), cost = 0, extrasFrom = 0;
    for (let i = 1; i <= plan.n; i++) {
      if (i === 2) extrasFrom = clock();
      else if (i > 2 && clock() - extrasFrom >= shareMs) break;   // the extras have spent the frame's share: the forecast was wrong
      const want = i * plan.dt;
      if (want > ticked) { tick(want - ticked); ticked = want; }
      timed(plan.dt, rest);
      cost = Math.max(cost, perCall);
    }
    perCall = cost;   // the dearest of the frame's calls prices the next frame's
    return undefined;
  };
  return pool;
}

/** A building's and a dungeon's foes are stepped inside the mode machine's frame: one that ran marks the clock. */
export function markModalSteps(modes, { mark = (ms) => ownerClock.mark(ms) } = {}) {
  const frame = modes.frame;
  modes.frame = (dt, now) => {
    const ran = frame(dt, now);
    if (ran) mark(now);
    return ran;
  };
  return modes;
}

/** The world host's one wiring: its street pool caught up while `shared()`, its mode machine's steps marked. */
export function wireOwnerClock(pool, modes, shared) {
  catchUpOwnerFoes(pool, { shared });
  markModalSteps(modes);
}
