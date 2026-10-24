// @ts-check
// THE AIM CAMERA (AUDIT NAV1's broadside camera; AIM-ENDS, 2026-10-24, Discord - "Aiming front ship cannons impossible":
// "The camera moves to the side of the ship when you're aiming the side cannons, so likewise the camera should move to
// the front/back accordingly when aiming"; bible/03-World/Naval-Combat.md AIM-ENDS) - where the helm's eye stands while
// a battery is laid. The port's own: Daggerfall has no sea. Wired by the naval host (navalHost.js createNavalHost
// `aimCam`, its `aimEye` the frame's: scenes/world.js reads it as before).
//
//   A BROADSIDE  the eye eases (over AIM_CAM_TAU s, smoothstepped) to AIM_CAM_OUT past the battery's ports, AIM_CAM_UP
//                over them and AIM_CAM_AFT toward her stern - her guns, the zone and the enemy on one screen - and
//                AIM_CAM_CLEAR short of a ship alongside on its way out.
//   THE ENDS     the bow chasers and the stern's barrels: AIM_CAM_AHEAD past the battery along her keel (ahead of the
//                bow, astern of the stern) and AIM_CAM_UP over it - and past her own canvas there (the galleon's jib
//                over her chasers, the carrack's spritsail ahead of hers), AIM_CAM_CLEAR clear of it, so no sail of
//                hers stands between the eye and the arcs. AUDIT NAV1 kept the eye home for the chasers, and from
//                the helm's eye behind her rig the jib hid every arc the chasers drew.
//   NEVER        with the Broadside camera off (`naval-aim-camera`), for a crippled ship (her guns are silent), or
//                with nothing laid - and home again on the release, the eye its own once there.
import { segmentBoxEntry, toBoxLocal, flatUnit } from '../../systems/naval/navalBallistics.js';
import { batteryOf, SIDE_DIR } from '../../systems/naval/navalShips.js';
import { toWorld } from '../../systems/naval/navalGunnery.js';
import { quatRotate } from '../../world/quat.js';

/** THE BROADSIDE CAMERA: while a broadside is laid, the eye eases (over AIM_CAM_TAU s) to AIM_CAM_OUT past the battery's
 *  ports, AIM_CAM_UP over them and AIM_CAM_AFT toward the stern (m) - her guns, the zone and the enemy on one screen. */
export const AIM_CAM_OUT = 4;
export const AIM_CAM_UP = 5.5;
export const AIM_CAM_AFT = 3;
export const AIM_CAM_TAU = 0.22;
/** ...and stops this far (m) short of another ship's side on its way out from the ports. AIM-ENDS: and stands this far
 *  clear of her own canvas over the bow or the stern. */
export const AIM_CAM_CLEAR = 1.2;
/** AIM-ENDS: over the bow chasers or the stern's barrels the eye stands this far (m) past them along her keel. */
export const AIM_CAM_AHEAD = 4;

const isEnd = (side) => side === 'bow' || side === 'stern';
const inside = (box, p, pad) => { const l = toBoxLocal(box, p); return Math.abs(l[0]) <= box.h[0] + pad && Math.abs(l[1]) <= box.h[1] + pad && Math.abs(l[2]) <= box.h[2] + pad; };

/**
 * AIM-ENDS: `at` carried on along `dir` (flat, unit) out of every one of `boxes` it stands in, `pad` clear of it - the
 * eye over her bow or her stern stepped out past her own canvas there. A box it steps into on the way is stepped out
 * of in turn; the walk ends after as many passes as there are boxes.
 */
export function clearOfRig(at, dir, boxes, pad = AIM_CAM_CLEAR) {
  let p = at;
  for (let pass = 0; pass <= boxes.length; pass++) {
    let moved = false;
    for (const box of boxes) {
      if (!box || !inside(box, p, pad)) continue;
      const reach = 2 * (Math.hypot(box.h[0], box.h[1], box.h[2]) + pad) + 1;
      const far = [p[0] + dir[0] * reach, p[1], p[2] + dir[2] * reach];
      const out = segmentBoxEntry(far, p, box, pad);   // from beyond it, back: where the walk leaves it
      if (!out) continue;
      p = [out.point[0] + dir[0] * 1e-3, out.point[1], out.point[2] + dir[2] * 1e-3];
      moved = true;
    }
    if (!moved) break;
  }
  return p;
}

/**
 * The aim camera: `eye(ownEye, dt)` is the frame's eye - `ownEye` eased toward the laid battery's own while one is
 * laid, and home.
 * @param {object} deps
 * @param {(key: string, dflt: any) => any} deps.setting   the player's own parts (AimCamera)
 * @param {() => boolean} deps.aiming   the attack held at an armed helm
 * @param {() => ({ side: string } | null)} deps.aim   the solution laid this frame
 * @param {() => any} deps.boat   my boat at the helm, or null
 * @param {(boat: any) => boolean} deps.wrecked   crippled: her guns silent
 * @param {(boat: any) => { position: number[], rotation: number[] }} deps.pose
 * @param {() => Iterable<any>} deps.alongside   the hull boxes of the ships afloat about her
 * @param {(boat: any) => any[]} deps.rig   her own canvas as boxes (navalHost.js rigBoxesOf)
 */
export function createAimCamera(deps) {
  let camK = 0, camSide = null;
  function eye(ownEye, dt) {
    const boat = deps.boat();
    const aim = deps.aim();
    const want = deps.setting('AimCamera', true) !== false && deps.aiming() && boat && aim && aim.side
      && !deps.wrecked(boat) ? aim.side : null;
    if (want) camSide = want;
    camK += ((want ? 1 : 0) - camK) * (1 - Math.exp(-Math.max(0, dt) / AIM_CAM_TAU));
    if (!want && camK < 1e-3) { camK = 0; camSide = null; }
    if (!boat || !camSide || camK <= 0) return ownEye;
    const pose = deps.pose(boat);
    const bat = batteryOf(boat.hull, camSide);
    if (!bat) return ownEye;
    const ports = bat.muzzles.map((m) => toWorld(pose, m));
    const c = ports.reduce((acc, m) => [acc[0] + m[0] / ports.length, acc[1] + m[1] / ports.length, acc[2] + m[2] / ports.length], [0, 0, 0]);
    const fire = flatUnit(quatRotate(pose.rotation, SIDE_DIR[camSide])) ?? [1, 0, 0];
    const fwd = flatUnit(quatRotate(pose.rotation, [0, 0, 1])) ?? [0, 0, 1];
    let at = isEnd(camSide)
      ? clearOfRig([c[0] + fire[0] * AIM_CAM_AHEAD, c[1] + AIM_CAM_UP, c[2] + fire[2] * AIM_CAM_AHEAD], fire, deps.rig(boat))   // AIM-ENDS: past her canvas there
      : [c[0] + fire[0] * AIM_CAM_OUT - fwd[0] * AIM_CAM_AFT, c[1] + AIM_CAM_UP, c[2] + fire[2] * AIM_CAM_OUT - fwd[2] * AIM_CAM_AFT];
    // never inside a ship alongside - a broadside at her rail's width is the one Black Flag remembers
    let clear = 1;
    for (const box of deps.alongside()) {
      const hit = box ? segmentBoxEntry(c, at, box, AIM_CAM_CLEAR) : null;
      if (hit && hit.t < clear) clear = hit.t;
    }
    if (clear < 1) at = [c[0] + (at[0] - c[0]) * clear, c[1] + (at[1] - c[1]) * clear, c[2] + (at[2] - c[2]) * clear];
    const k = camK * camK * (3 - 2 * camK);   // eased in and out
    return [ownEye[0] + (at[0] - ownEye[0]) * k, ownEye[1] + (at[1] - ownEye[1]) * k, ownEye[2] + (at[2] - ownEye[2]) * k];
  }
  return { eye };
}
