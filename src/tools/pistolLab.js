// THE PISTOL LAB (the owner, 2026-10-21): a NEW WEAPON TYPE - a dwarven
// flintlock pistol that can be dual wielded - prototyped before a line
// of the game changes, the way the Dwarven Thunderlock was ("use the
// same prototype testing we did for the thunderlock").
//
// NOTHING HERE TOUCHES THE GAME. The page is its own (pistol-proto.html),
// over its own art (public/art/pistol-frames.png); no module the game
// runs imports this file, and test/combat/weapon/pistolLab.test.js fails
// if one ever does. Design and record: bible/05-Combat/Pistol-Lab.md.
//
// WHAT IT RUNS rather than restates - the gun lab's lesson (FIELD-GUN12:
// two copies of a frame do not converge by being corrected):
//
//   - the GAME's gun frame, combat/gun/gunViewmodel.js gunFrameRect:
//     FPSWeapon's 320x200 rect (FPSWeapon.cs:378-388) over the anchor
//     box, Weapon Widget's Offset/Bob/Inertia over that, the kick after
//     the mod's floor, the union expansion;
//   - the gun's feel, combat/gun/gunFeel.js: the recoil spring, the
//     trauma shake, the muzzle light's curve;
//   - the gun lab's own machine and sound player (src/tools/gunLab.js),
//     which the Thunderlock was judged on;
//   - and for the PAIR, the game's Two-Hands law
//     (combat/twoHands/handsLaw.js): which hand fires (strikeHandOf, the
//     flurry), the resting hand's guard (guardStep/guardOffset), the
//     mirror - the left hand a right hand in the glass.
//
// What is its OWN is below, and each piece says why a borrowed one would
// not do.

export {
  createGunMachine, muzzleLight, createRecoil, createScreenShake, createWidgetRig, widgetRigStep,
  labWidgetSettings, labMotion, gunFrameRect, ALIGN, SFX_CANDIDATES, createSfxPlayer, contentBox, unionBox,
} from './gunLab.js';
export {
  HANDS_MODE, FLURRY_WINDOW, GUARD, strikeHandOf, guardStep, guardOffset, otherHand,
} from '../combat/twoHands/handsLaw.js';
import { createGunMachine } from './gunLab.js';
import { HANDS_MODE, strikeHandOf, otherHand } from '../combat/twoHands/handsLaw.js';

/**
 * THE STRIP. The owner's art arrived as six 88x113 frames, each on its
 * own transparent canvas and REGISTERED to the others by that canvas:
 * the forearm leaves every frame through the same bottom-right corner,
 * and the pistol moves inside the canvas because the art moves it (the
 * kick back on the flash, the muzzle up on 4-5). So the frames are laid
 * side by side in the order given, pixels unchanged
 * (public/art/pistol-frames.png, 528x113), and cut at a fixed stride -
 * no key, no badge gutter, no flood fill: the Thunderlock's sheet was a
 * contact sheet on a white page, this is not.
 *
 *   1 rest - 2 the shot (flash, kicked back) - 3 settling -
 *   4, 5 muzzle up (the same picture twice: a hold) - 6 settling (= 3)
 */
export const PISTOL_STRIP = Object.freeze({ frames: 6, cellW: 88, cellH: 113, file: 'pistol-frames.png' });

/** Cell `i` of the strip, an integer source rect (a half pixel resamples). */
export function stripCellRect(i, strip = PISTOL_STRIP) {
  return { x: i * strip.cellW, y: 0, w: strip.cellW, h: strip.cellH };
}

/**
 * THE 1-BIT CUT. The frames carry soft alpha - an antialiased fringe
 * and the flash's glow - and the port's screen quad discards texels
 * under 0.5 (drawScreenQuad), so a soft edge looks right in an image
 * viewer and wrong the moment the game draws it. The lab cuts at the
 * game's own 0.5 by default (`cut` 128) and keeps the threshold a live
 * control, because what it costs the flash's halo is the thing worth a
 * slider. Alpha goes to 0 or 255, nothing between. Mutates `img.data`
 * and answers how many texels it cleared.
 */
export function hardenAlpha(img, cut = 128) {
  const { data } = img;
  let cleared = 0;
  for (let p = 3; p < data.length; p += 4) {
    if (data[p] >= cut) data[p] = 255;
    else { if (data[p]) cleared++; data[p] = 0; }
  }
  return cleared;
}

/**
 * NATIVE SIZE. The Thunderlock's art was a 1790px painting and had to
 * take its size from a slider (`widthPct`, the gun lab's declared
 * departure). These frames are drawn at Daggerfall's own scale - 88x113,
 * a WEAPON*.CIF record's size - so the classic law applies whole: one
 * art pixel is one pixel of the 320-wide design surface, and `scale` 1
 * is FPSWeapon's own rect. The slider stays, as a multiple of native.
 */
export const nativeWidthPct = (anchorW, scale = 1) => (anchorW / 320) * scale;

/**
 * THE OPENING NUMBERS - a first pass for the panel, not a decision. The
 * Thunderlock's opened on its own panel's first pass too, and the owner
 * moved them; these are named here so the probe, the pins and the page
 * open on one weapon.
 *
 *   - size 1x native, raise 0, offset 0: the forearm's cut sits on the
 *     view's bottom-right corner, where the art put it (the Thunderlock
 *     sank 8 units because its painting had no arm to hide);
 *   - 12 fps, hit on frame 2 (index 1, the flash), a 1400ms reload -
 *     a pistol's cycle is shorter than a rifle's, and a pair covers
 *     each other's reloads, which is the reason to carry two;
 *   - the kick smaller than the Thunderlock's 5: the art already
 *     kicks (frames 2 and 4-5), so the spring is the after-shock;
 *   - the shake at two thirds of the rifle's, because a volley lands
 *     two punches and the trauma stacks.
 */
export const PISTOL_OPENING = Object.freeze({
  scale: 1, raise: 0, offset: 0,
  fps: 12, reloadMs: 1400, hitFrame: 1,
  kick: 3, back: 0, stiff: 400, damp: 36,
  shake: 20, shakeRot: 2.5, shakeFreq: 60, shakeDecay: 5,
  drop: 0.7, alphaCut: 128,
});

/** How the trigger is pulled with a pistol in each hand. */
export const PAIR_TRIGGER = Object.freeze({
  /** One pistol, DFU's one used hand - the gun lab's own case. */
  Single: 'single',
  /** The game's flurry (strikeHandOf): the lead opens, a pull inside
   *  FLURRY_WINDOW of the last shot is the other hand's. */
  Alternate: 'alternate',
  /** Both barrels on one pull. */
  Volley: 'volley',
  /** Each hand its own button: the left mouse button the right hand,
   *  the right button the left. */
  PerHand: 'perHand',
});

/**
 * THE PAIR. Two of the gun lab's machines - one shot, six frames, a
 * reload each - and the rule for which one a pull fires.
 *
 * Alternate RUNS the game's flurry law (handsLaw.strikeHandOf, the one
 * the dual wielder's swords obey): the lead opens, and a pull while the
 * last shot is still in flight or inside FLURRY_WINDOW of it ending is
 * the other hand's. ONE DEPARTURE, the gun's: a sword can always swing,
 * a pistol mid-reload cannot fire, so when the hand the law names is
 * not loaded the pull falls to the other hand if it is - the trigger
 * finds the loaded pistol rather than clicking on an empty one. Pinned,
 * so it is a decision and not an accident.
 *
 * `t` is the pair's own clock (seconds), advanced by `step`; `sinceLast`
 * is 0 while a shot's frames still play (the hand is mid-blow, which is
 * the flurry's case) and the seconds since they ended after.
 */
export function createPair({ trigger = PAIR_TRIGGER.Alternate, lead = 'R', fps, cooldownMs, hitFrame } = {}) {
  const opts = { fps, cooldownMs, hitFrame };
  const pair = {
    trigger, lead,
    R: createGunMachine(opts), L: createGunMachine(opts),
    t: 0, last: null, lastEnd: -Infinity,
    /** The hands in the order they fired, most recent last - the
     *  draw order (Two-Hands: the striking hand is drawn over the other). */
    order: ['L', 'R'],
    lastShot: null,
  };
  const loaded = (h) => pair[h].state === 'Idle';
  const sinceLast = () => (pair.last && pair[pair.last].state === 'Firing' ? 0 : pair.t - pair.lastEnd);
  const shoot = (h, info) => {
    if (!pair[h].fire()) return false;
    pair.last = h;
    pair.order = [otherHand(h), h];
    pair.lastShot = { hand: h, ...info };
    return true;
  };
  /** The hands that would fire on a pull of `button` (0 left mouse,
   *  2 right), as the law answers - before the loaded check. */
  pair.pick = (button = 0) => {
    if (pair.trigger === PAIR_TRIGGER.Single) return [pair.lead];
    if (pair.trigger === PAIR_TRIGGER.Volley) return [pair.lead, otherHand(pair.lead)];
    if (pair.trigger === PAIR_TRIGGER.PerHand) return [button === 2 ? 'L' : 'R'];
    return [strikeHandOf({ mode: HANDS_MODE.Dual, lead: pair.lead, last: pair.last, sinceLast: sinceLast() }).hand];
  };
  /** A pull of the trigger. Answers the hands that fired. */
  pair.pull = (button = 0) => {
    const fired = [];
    if (pair.trigger === PAIR_TRIGGER.Alternate) {
      const s = strikeHandOf({ mode: HANDS_MODE.Dual, lead: pair.lead, last: pair.last, sinceLast: sinceLast() });
      // the gun's departure: the named hand is empty, the other is loaded
      const h = loaded(s.hand) ? s.hand : (loaded(otherHand(s.hand)) ? otherHand(s.hand) : null);
      if (h && shoot(h, { off: h !== pair.lead, flurry: s.flurry })) fired.push(h);
      return fired;
    }
    for (const h of pair.pick(button)) if (shoot(h, { off: h !== pair.lead, flurry: false })) fired.push(h);
    return fired;
  };
  /** Both machines, one clock. Answers each hand's event ('hit',
   *  'ready' or null) and records when a shot's frames end. */
  pair.step = (dt) => {
    pair.t += dt;
    const out = {};
    for (const h of ['R', 'L']) {
      const wasFiring = pair[h].state === 'Firing';
      out[h] = pair[h].step(dt);
      if (wasFiring && pair[h].state !== 'Firing' && pair.last === h) pair.lastEnd = pair.t;
    }
    return out;
  };
  /** The hands drawn: one in Single, both otherwise. */
  pair.hands = () => (pair.trigger === PAIR_TRIGGER.Single ? [pair.lead] : ['R', 'L']);
  return pair;
}
