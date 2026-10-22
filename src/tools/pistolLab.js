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

// THE STRIP AND ITS CUT ARE THE GAME'S NOW (PISTOLET, 2026-10-21). They were written here while this page was the only
// thing that had them; combat/gun/pistolStrip.js is their home since the Dwarven Pistolet became a weapon, and the lab
// reads them from there - gunSheet.js's one-way arrow for the Thunderlock's sheet, one weapon along.
export { PISTOL_STRIP, stripCellRect, hardenAlpha } from '../combat/gun/pistolStrip.js';   // the leaf combat/gun/pistoletArt.js reads too
import { PISTOLET_FEEL } from '../combat/gun/gunFeel.js';

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
 * THE OWNER'S NUMBERS (PISTOL-LAB 2, 2026-10-21), off the lab's panel - "Must be these values/sounds exactly", over two
 * screenshots of it. They are the GAME'S row now (combat/gun/gunFeel.js PISTOLET_FEEL - the Thunderlock's FIELD-GUN6
 * rule: the lab settled them and the game reads them; tuning here is tuning there), and this is the lab's reading of it in
 * the panel's own names, so the page, the probe and the pins still open on one weapon.
 */
export const PISTOL_OPENING = Object.freeze({
  scale: PISTOLET_FEEL.scale, raise: PISTOLET_FEEL.raise, offset: PISTOLET_FEEL.offset,
  fps: PISTOLET_FEEL.fps, reloadMs: PISTOLET_FEEL.reloadMs, hitFrame: PISTOLET_FEEL.hitFrame,
  kick: PISTOLET_FEEL.kick, back: PISTOLET_FEEL.back, stiff: PISTOLET_FEEL.stiff, damp: PISTOLET_FEEL.damp,
  shake: PISTOLET_FEEL.shake, shakeRot: PISTOLET_FEEL.shakeRot, shakeFreq: PISTOLET_FEEL.shakeFreq, shakeDecay: PISTOLET_FEEL.shakeDecay,
  drop: PISTOLET_FEEL.hiddenTarget[1], alphaCut: PISTOLET_FEEL.alphaCut,
  sfxFire: PISTOLET_FEEL.sfx.fire, sfxOpen: PISTOLET_FEEL.sfx.open, sfxClose: PISTOLET_FEEL.sfx.close,
  sfxVol: PISTOLET_FEEL.sfxVolume, sfxVary: PISTOLET_FEEL.sfxVary,
  widget: PISTOLET_FEEL.widget,
  light: PISTOLET_FEEL.flashLight,   // AUDIT PISTOLET B5: the muzzle light's opening, the feel's own
});

// PISTOL-PORT: THE FRAME IS THE GAME'S NOW (combat/gun/pistolViewmodel.js) - each hand's spring, guard, picture, rig, rect
// and reload clacks, the draw order and the panel's settings - FIELD-GUN12's arrow: the page runs it, never restates it.
export {
  PISTOL_HANDS, PISTOL_PANEL, createPistolHands, pistolHandFired, pistolHandsStep, pistolReloadVoice, pistolHandRect,
  pistolDrawOrder, pistolWidgetSettings,
} from '../combat/gun/pistolViewmodel.js';
// PISTOL-PORT: THE PAIR IS THE GAME'S NOW (combat/gun/pistolPair.js) - the Dwarven Pistolet fires on it - and the page
// reads it back from there.
export { PAIR_TRIGGER, createPair } from '../combat/gun/pistolPair.js';
