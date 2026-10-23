// MIXED-PAIR (2026-10-23; bible/05-Combat/Two-Hands.md "A blade and a gun"): THE MORROWIND ARM'S BLADE AND PISTOLET. The
// law (which hand strikes, the turns, the one-handed reload): combat/twoHands/handsLaw.js. Wired by combat/fpArm.js
// (HOST-SPLIT: the arm wires it and grows only by the wiring).
//
// The arm plays ONE weapon group - the right hand's record's (Rule 9's long group), whose clips every blow of a pair plays,
// the left hand's in the mirror (Two-Hands, "the compositions"). A blade's clip and a gun's are two weapons' worth of
// difference - Morrowind has no pistol, and the Pistolet borrows the thrown weapons' groups (PISTOL-STANCE: `animateAs`
// MarksmanThrown, its "shoot" and its "shoot release") - so in a blade-and-gun pair:
//   - A BLOW PLAYS ITS OWN HAND'S GROUP: the left hand's blow, when it holds the other kind, plays in the left weapon's
//     group (`blowTypeOf`) for the blow's length - a pistol's shot crosses its own "shoot release" (MW-D42: the shot leaves
//     there), a blade's swing its own hit - and the arm's group is the right hand's again when the blow ends;
//   - THE OFF ARM HOLDS ITS OWN WEAPON'S IDLE: at rest and under the other hand's blow, the left arm is the mirror of the
//     LEFT weapon's stance idle (its record's own group), not the right weapon's;
//   - THE GUN IS HELD AS A GUN, ON ITS OWN HAND ALONE: the pistol stance (combat/gun/pistolStance.js) solves the gun hand
//     only (`only`), its aim raised by that hand's own shot; the blade's arm is the composition's.

import { holdsGun } from '../gun/gunHold.js';

/**
 * Which arm of a pair holds a gun beside a blade: 'R', 'L', or null (two blades, two guns, one weapon). `weapon` is the
 * arm's own record (the right hand's - fpArm's `built.weapon`), `offWeapon` the left hand's (`built.offWeapon`); `dual`
 * that a pair is held (fpArm's hands mode).
 * @param {{ dual?: boolean, weapon?: { holdAs?: string | null } | null, offWeapon?: { holdAs?: string | null } | null }} [a]
 * @returns {'R' | 'L' | null}
 */
export function gunArmOf({ dual = false, weapon = null, offWeapon = null } = {}) {
  if (!dual || !weapon || !offWeapon) return null;
  const r = holdsGun(weapon), l = holdsGun(offWeapon);
  return r === l ? null : r ? 'R' : 'L';
}

/** The Morrowind weapon type a blow of `hand` plays its group in - the left weapon's own (`offType`) for a mixed pair's
 *  left hand, else null (the arm's own group). */
export const blowTypeOf = ({ gunArm = null, hand = 'R', offType = null } = {}) => (gunArm && hand === 'L' && Number.isFinite(offType) ? offType : null);

/**
 * The gun stance's hand on rig `r` (combat/gun/gunHold.js applyGunStance's row and options), or null when no gun is held:
 *   a gun pair  - both hands on their pistols (`pair`), the right's row;
 *   a mixed pair - the gun's hand alone (`only`), its own row; the blade's arm is the composition's;
 *   one gun     - its hand (`only` 'R') and the free hand placed by the stance - unless the free hand holds a spell
 *                 (SPELL-HAND: `spellHand`), when it is left to the spell.
 * @param {{ weapon?: any, offWeapon?: any, dual?: boolean, offShown?: boolean, spellHand?: boolean }} a
 * @returns {{ row: any, pair: boolean, only: 'R' | 'L' | null } | null}
 */
export function gunHoldOf({ weapon = null, offWeapon = null, dual = false, offShown = false, spellHand = false } = {}) {
  const gunArm = gunArmOf({ dual: dual && offShown, weapon, offWeapon });
  if (gunArm === 'L') return { row: offWeapon, pair: false, only: 'L' };
  if (!holdsGun(weapon)) return null;
  if (gunArm === 'R') return { row: weapon, pair: false, only: 'R' };
  const pair = dual && offShown && holdsGun(offWeapon);
  return { row: weapon, pair, only: !pair && spellHand ? 'R' : null };
}
