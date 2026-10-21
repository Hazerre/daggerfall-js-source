// @ts-check
// OWNER-CLOCK (2026-10-21, the field's enemy desync - net/ownerClock.js has the wire's half): MY FOES KEEP THE ROOM'S TIME
// WHILE ANYONE ELSE IS HERE TO SEE THEM.
//
// A foe is its owner's to step, so a slow owner's foes are slow for everyone. Below 20 fps they are slower still:
// FOE-CATCHUP (characters/enemy/enemyMotor.js FOE_MAX_FRAME_DT, 2026-09-26, Mac: "Yes, add the cap") hands a foe's body
// at most three FIXED_DT steps a frame, so an owner at 4 fps walked its foes at a fifth of their pace - and its every
// reader watched them crawl, and was struck by them on the crawl's own clock. That cap is the cure for a snowball: a
// step is the port's dearest work, and a hitch that asked for more of them made the next frame dearer.
//
// So online, while the room holds anyone else, the street's pool (the encounter pool every cell streams) is stepped
// AGAIN within the frame, in FOE-CATCHUP's own size of step (each call the shape of a 20 fps frame, a shape every pool
// already runs), until the frame's own time is caught up - never past OWNER_CATCHUP_MAX_S of game time a frame, and never
// once the extra calls have spent OWNER_CATCHUP_SHARE of the frame's own time: where the foes ARE what makes the frame
// slow, the cap's law stands as it was. Offline, alone in the room, at 20 fps and up, or with the foes held (a zero
// frame), the pool takes the host's one step exactly as before. The tactics brain's clock (ai/tacticsClock.js, the foes'
// own time) is carried with the extra steps, so a wind-up lands where its body is.
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

/** The most game time a frame's foes catch up to (s): 3.3 fps and up keep the room's time. */
export const OWNER_CATCHUP_MAX_S = 0.3;
/** The most of a frame's own time the extra steps may spend - a frame grows by a ninth at most, so no snowball. */
export const OWNER_CATCHUP_SHARE = 0.1;
/** The most calls a frame makes of the pool: OWNER_CATCHUP_MAX_S in FOE_MAX_FRAME_DT's steps. */
export const OWNER_CATCHUP_STEPS_MAX = Math.round(OWNER_CATCHUP_MAX_S / FOE_MAX_FRAME_DT);

/** The longest gap the budget reads as a frame's own time (ms) - past it the pool was away (a building, a dungeon), not slow. */
const FRAME_MS_MAX = 1000;

/** How a frame's foes are stepped: `n` calls of `dt` each. The host handed `foeDt` (its clamp's, or 0 held); `rawS` is
 *  the time since the pool was last stepped, and `extraMax` the extra calls the frame can afford. At 20 fps and up,
 *  held, or with no extra call to spend, the host's one step exactly; under it, the time caught up in calls no longer
 *  than FOE_MAX_FRAME_DT (so the motor takes every second of it), OWNER_CATCHUP_MAX_S at most - and whatever is
 *  afforded, more game time than the host's one step gave. */
export function catchUpPlan(foeDt, rawS, extraMax = OWNER_CATCHUP_STEPS_MAX) {
  if (!(foeDt > FOE_MAX_FRAME_DT)) return { n: 1, dt: foeDt };
  const total = Math.min(OWNER_CATCHUP_MAX_S, Math.max(foeDt, Number.isFinite(rawS) ? rawS : 0));
  const n = Math.min(OWNER_CATCHUP_STEPS_MAX, Math.ceil(total / FOE_MAX_FRAME_DT - 1e-9), 1 + Math.max(0, Math.floor(extraMax) || 0));
  return n < 2 ? { n: 1, dt: foeDt } : { n, dt: Math.min(FOE_MAX_FRAME_DT, total / n) };
}

/**
 * The street's pool, stepped through the catch-up: `pool.update(dt, ...rest)` keeps its signature and its callers.
 * `shared()` - anyone else in the room to see these foes; `clock()` ms (the page's performance.now()); `tick` the
 * tactics brain's clock; `mark` the owner clock's. What a call costs is measured every frame, and the next frame
 * affords the extra calls OWNER_CATCHUP_SHARE of its own time buys at that cost.
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
    const plan = shared() ? catchUpPlan(dt, rawMs / 1000, (Math.min(rawMs, FRAME_MS_MAX) * OWNER_CATCHUP_SHARE) / perCall) : { n: 1, dt };
    if (plan.n === 1) return timed(plan.dt, rest);
    // the host ticked the brain the frame's capped step before any pool moved; each later call carries it to its end
    let ticked = foeFrameDt(dt), cost = 0;
    for (let i = 1; i <= plan.n; i++) {
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
