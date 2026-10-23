// MIXED-PAIR (2026-10-23, the owner: "Being able to hold a melee and pistolet as a duel wield option"; "Make the best
// decisions"; bible/05-Combat/Two-Hands.md "A blade and a gun"). A one-handed blade in one hand and a Dwarven Pistolet in the
// other are a pair: the law (combat/twoHands/handsLaw.js gunHandOf, mixedStrike, MIXED), the turns on the two machines
// (combat/playerWeapon.js _mixedAttack), the one-handed reload, the off hand's terms on either kind, and the sprite lane
// through the real rig (combat/weapon/weaponRig.js: the gun on its own frame, the blade on the pair's, each lowered under
// the other's strike). The balance is MEASURED through the machine and the formula, as Two-Hands' is.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPistolet } from '../../src/systems/pistolet.js';
import { createThunderlock } from '../../src/systems/thunderlock.js';
import { PlayerWeapon, handDesc } from '../../src/combat/playerWeapon.js';
import { playerArrowHitFoe } from '../../src/combat/arrowFlight.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { MOBILE_TYPES } from '../../src/characters/mobile/mobileTypes.js';
import {
  HANDS_MODE, handsModeOf, gunHandOf, mixedStrike, MIXED, DUAL, OFF_HAND_BLOW, offHandDamage, FLURRY_WINDOW,
} from '../../src/combat/twoHands/handsLaw.js';
import { PISTOLET_FEEL } from '../../src/combat/gun/gunFeel.js';
import { pistolRig } from './weapon/pistolRigHarness.js';

const weapon = (templateIndex, name) => ({ name, group: 'Weapons', templateIndex, material: 0, currentCondition: 100000, maxCondition: 100000 });
const LONGSWORD = () => weapon(120, 'Longsword');
const DAGGER = () => weapon(113, 'Dagger');
const CLAYMORE = () => weapon(122, 'Claymore');
const BUCKLER = { name: 'Buckler', group: 'Armor', templateIndex: 109, material: 0 };
const desc = (item) => handDesc(item);

function pairOf(right, left, { lead = 'R' } = {}) {
  const pw = new PlayerWeapon();
  pw.updateHands(right, left);
  pw.usingRightHand = lead === 'R';
  pw.applyWeapon();
  return pw;
}
const DT = 1 / 60;
const step = (pw, n = 1) => { const evs = []; for (let i = 0; i < n; i++) evs.push(...pw.update(DT)); return evs; };
const untilIdle = (pw) => { for (let i = 0; i < 600 && (pw.machine.state !== 'Idle' || pw.strike); i++) pw.update(DT); };

test('MIXED-PAIR THE LAW: a one-handed blade and a Pistolet are a PAIR (handsModeOf), and gunHandOf names the gun\'s hand - never for two blades, two guns, one weapon, a shield or a two-hander; MIXED.RELOAD is the record\'s (mutants: the two-of-a-kind clause back; the gun\'s hand swapped; a blade read as a gun)', () => {
  const [sword, gun] = [LONGSWORD(), createPistolet()];
  assert.equal(handsModeOf({ right: desc(sword), left: desc(gun) }), HANDS_MODE.Dual, 'a blade and a gun are a pair');
  assert.equal(handsModeOf({ right: desc(gun), left: desc(sword) }), HANDS_MODE.Dual);
  assert.equal(gunHandOf(desc(sword), desc(gun)), 'L');
  assert.equal(gunHandOf(desc(gun), desc(sword)), 'R');
  assert.equal(gunHandOf(desc(sword), desc(DAGGER())), null, 'two blades: no gun hand');
  assert.equal(gunHandOf(desc(gun), desc(createPistolet())), null, 'two guns: a gun pair, not a mixed one');
  assert.equal(gunHandOf(desc(gun), null), null, 'one gun: no pair');
  assert.equal(gunHandOf(desc(sword), { item: BUCKLER, shield: true }), null, 'a shield is no hand of a pair');
  assert.equal(handsModeOf({ right: desc(CLAYMORE()), left: desc(gun) }), HANDS_MODE.Single, 'a two-hander never pairs');
  assert.equal(handsModeOf({ right: desc(createThunderlock()), left: desc(sword) }), HANDS_MODE.Single, 'nor the two-handed Thunderlock');
  assert.equal(handsModeOf({ right: desc(sword), left: desc(gun), leftBusy: true }), HANDS_MODE.Single, 'a light in the hand still breaks it');
  assert.deepEqual({ ...MIXED }, { RELOAD: 1.5 });
});

test('MIXED-PAIR THE PULL FALLS TO THE BLADE (mixedStrike): the law\'s gun hand that cannot fire gives the pull to the blade - never a flurry\'s, the off hand\'s exactly when the blade is not the lead; a gun that can fire, a blade named, or no mixed pair, the law\'s answer unchanged (mutants: no fall; the fall a flurry; the fall\'s off read off the gun)', () => {
  const gunL = { hand: 'L', flurry: true, off: true };
  assert.deepEqual(mixedStrike(gunL, { gunHand: 'L', gunReady: false, lead: 'R' }), { hand: 'R', flurry: false, off: false }, 'the lead blade takes it, whole');
  assert.deepEqual(mixedStrike({ hand: 'R', flurry: false, off: false }, { gunHand: 'R', gunReady: false, lead: 'R' }), { hand: 'L', flurry: false, off: true }, 'a lead gun reloading: the off blade');
  assert.equal(mixedStrike(gunL, { gunHand: 'L', gunReady: true, lead: 'R' }), gunL, 'a loaded gun fires');
  const blade = { hand: 'R', flurry: true, off: false };
  assert.equal(mixedStrike(blade, { gunHand: 'L', gunReady: false, lead: 'R' }), blade, 'a blade named swings');
  assert.equal(mixedStrike(gunL, { gunHand: null, gunReady: false }), gunL, 'no mixed pair: nothing to fall to');
});

test('MIXED-PAIR THE TURNS through the machine: a held trigger opens with the lead blade, the gun answers inside FLURRY_WINDOW, and while the gun reloads every pull is the blade\'s; never two strikes at once - a shot\'s frames hold the blade, a swing holds the gun; the counts a minute at Speed 50 (mutants: the overlap; the reload not the gun\'s alone; the classic clock blind to the shot\'s end)', () => {
  const pw = pairOf(LONGSWORD(), createPistolet());
  assert.equal(pw.handsMode, HANDS_MODE.Dual);
  assert.equal(pw.gunHand, 'L');
  assert.equal(pw.mixedPair, true);
  const order = [];
  let overlap = 0, hits = { R: 0, L: 0 };
  for (let t = 0; t < 60; t += DT) {
    pw._attack('StrikeDown');
    const s = pw.strike;
    if (s && order.at(-1) !== s.hand) order.push(s.hand);
    // the gun firing and a blade's swing on the classic machine at once is the overlap the pair never allows
    if (pw.pistols.L.state === 'Firing' && s?.hand === 'R') overlap++;
    for (const e of pw.update(DT)) if (e === 'hit') hits[pw.strike?.hand ?? '?']++;
  }
  assert.deepEqual(order.slice(0, 3), ['R', 'L', 'R'], 'the lead blade opens, the gun answers, the blade again');
  assert.equal(overlap, 0, 'one strike at a time');
  assert.deepEqual(hits, { R: 54, L: 18 }, 'measured: the blade fills the gun\'s one-handed reload');
  // a lone Pistolet's and a lone longsword's, the same minute
  const alone = (pwx) => { let n = 0; for (let t = 0; t < 60; t += DT) { pwx._attack('StrikeDown'); n += pwx.update(DT).filter((e) => e === 'hit').length; } return n; };
  assert.equal(alone(pairOf(createPistolet(), null)), 32);
  assert.equal(alone(pairOf(LONGSWORD(), null)), 60);
});

test('MIXED-PAIR THE ONE-HANDED RELOAD: the gun beside a blade reloads MIXED.RELOAD times a free hand\'s - its own machine\'s, so a gun moved to the other hand takes it, a gun pair and a lone gun keep the free hand\'s, and the blade put away mid-reload loads at the free pace from there (mutants: the reload on both machines; never reset)', () => {
  const free = PISTOLET_FEEL.reloadMs, oneHanded = free * MIXED.RELOAD;
  const gun = createPistolet(), sword = LONGSWORD();
  const pw = pairOf(sword, gun);
  pw._attack('StrikeDown'); step(pw);   // the pistols made
  assert.deepEqual([pw.pistols.R.cooldownMs, pw.pistols.L.cooldownMs], [free, oneHanded], 'the left gun loads one-handed');
  pw.updateHands(gun, sword); pw.applyWeapon(); step(pw);
  assert.deepEqual([pw.pistols.R.cooldownMs, pw.pistols.L.cooldownMs], [oneHanded, free], 'moved to the right: the right\'s reload');
  pw.updateHands(gun, createPistolet()); pw.applyWeapon(); step(pw);
  assert.deepEqual([pw.pistols.R.cooldownMs, pw.pistols.L.cooldownMs], [free, free], 'a gun pair: a free hand\'s each');
  // the reload as the pull reads it: a shot, then the blade beside it, then the gun again at one-handed pace
  const p2 = pairOf(sword, gun, { lead: 'L' });
  assert.ok(p2._attack('StrikeDown') && p2.strike.hand === 'L', 'the lead gun fires');
  untilIdle(p2);
  const loaded = p2.handReloadUntil('L');
  const fired = p2.machine.now;
  while (p2.machine.now < loaded + 0.5) { p2._attack('StrikeDown'); p2.update(DT); if (p2.strike?.hand === 'L') break; }
  assert.ok(p2.machine.now - fired >= oneHanded / 1000 - 0.1, `the gun waits out its one-handed reload (${(p2.machine.now - fired).toFixed(2)} s)`);
  // the blade put away mid-reload: the gun alone loads at a free hand's pace from there
  const p3 = pairOf(sword, gun, { lead: 'L' });
  p3._attack('StrikeDown'); untilIdle(p3);
  p3.updateHands(null, gun); p3.applyWeapon(); step(p3);
  assert.equal(p3.pistols.L.cooldownMs, free);
});

test('MIXED-PAIR THE FALL IN THE MACHINE: a pull the law gives the gun while it reloads - or with no Pellet for it (`gunReady`) - is the blade\'s, from its first frame (no flurry\'s frame); a technique is the lead\'s alone and waits for a lead gun (mutants: no fall in the machine; a fall thrown as a flurry; a technique falling)', () => {
  const pw = pairOf(LONGSWORD(), createPistolet());
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'R');
  untilIdle(pw);
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'L', 'the gun answers inside the window');
  untilIdle(pw);
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'R');
  untilIdle(pw);
  assert.equal(pw.pistols.L.state, 'Cooling', 'the gun still reloading');
  assert.ok(pw._attack('StrikeDown'), 'the pull the law gives the gun...');
  assert.equal(pw.strike.hand, 'R', '...is the blade\'s');
  assert.equal(pw.strike.flurry, false, 'never a flurry\'s');
  assert.equal(pw.machine.frame, 0, 'from its first frame');
  // no Pellet: the loaded gun refuses its own pull, the blade takes it
  const dry = pairOf(LONGSWORD(), createPistolet());
  dry.gunReady = () => false;
  for (let i = 0; i < 4; i++) { assert.ok(dry._attack('StrikeDown')); assert.equal(dry.strike.hand, 'R'); untilIdle(dry); }
  // a technique is the lead's: a lead gun reloading refuses it - the blade does not throw the gun's technique
  const led = pairOf(LONGSWORD(), createPistolet(), { lead: 'L' });
  assert.ok(led.techniqueStrike('StrikeDown')); untilIdle(led);
  assert.equal(led.techniqueStrike('StrikeDown'), false, 'the lead gun reloading: no technique');
});

test('MIXED-PAIR THE OFF HAND\'S TERMS ON EITHER KIND: the off gun\'s shot lands DUAL\'s share at impact, read off the gun it left; the off blade\'s swing is an offStrike with its held ticks; H swaps the lead and the terms with it (mutants: the off gun landing whole; the shot\'s weapon the blade)', () => {
  const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
  const foe = () => ({ entity: { minMetalToHit: -1, armorValues: [0, 0, 0, 0, 0, 0, 0], items: [], basics: { bloodIndex: 2 }, isClass: false, careerIndex: 0, skills: 0, maxHealth: 300, health: 300, stats: { strength: 50, agility: 50, luck: 50 } }, ai: { feet: [0, 0, 0], yaw: 0 } });
  const shooter = () => ({ isPlayer: true, level: 1, skills: 30, skillUses: [], stats: { strength: 50, agility: 50, luck: 50 } });
  const landed = (w, pwx) => playerArrowHitFoe({ weapon: w, fromPlayer: true, summoned: false, pos: [0, 1, 0], dir: [0, 0, 1] }, foe(),
    { playerEntity: shooter(), playerWeapon: pwx, playerFeet: [0, 0, 5], dealDamage: () => {}, say: () => {}, rolls: seq(0, 0.99, 0.05, 0.999, 0.99) });
  const gun = createPistolet(), sword = LONGSWORD();
  const pw = pairOf(sword, gun);
  assert.equal(pw.isOffHandItem(gun), true, 'the gun beside a lead blade is the off hand\'s');
  assert.equal(pw.isOffHandItem(sword), false);
  const lone = landed(gun, pairOf(gun, null));
  assert.ok(lone > 0);
  assert.equal(landed(gun, pw), offHandDamage(lone), 'its shot lands DUAL\'s share');
  // the gun strikes: its hit is the gun's - the weapon the hosts fire is the gun, the strike the off hand's
  pw._attack('StrikeDown'); untilIdle(pw);
  pw._attack('StrikeDown');
  assert.equal(pw.strike.hand, 'L');
  const evs = []; for (let i = 0; i < 10 && !evs.includes('hit'); i++) evs.push(...pw.update(DT));
  assert.ok(evs.includes('hit'), 'the shot\'s hit');
  assert.equal(pw.weapon, gun, 'the weapon the hosts fire is the gun');
  assert.equal(pw.offStrike, true, 'and the strike the off hand\'s');
  assert.equal(pw.blowWeight, OFF_HAND_BLOW.blowWeight);
  // H: the gun leads - its shot whole, the blade the off hand's swing, with its held ticks (landed on an idle machine:
  // a shot's impact takes the machine's swing modifiers as it stands, as the lone gun's did)
  untilIdle(pw);
  pw.toggleHand({ bowSwitching: false });
  assert.equal(pw.leadHand, 'L');
  assert.equal(pw.isOffHandItem(gun), false);
  assert.equal(landed(gun, pw), lone, 'the lead gun\'s shot lands whole');
  const off = pairOf(sword, gun, { lead: 'L' });
  off.animCtx = () => ({ entity: { stats: { strength: 50 } }, weaponType: 3, usingRightHand: true });
  off.gunReady = () => false;   // the gun dry: the pull is the blade's, as the off hand
  assert.ok(off._attack('StrikeDown'));
  assert.equal(off.strike.hand, 'R');
  assert.equal(off.offStrike, true, 'the blade beside a lead gun is the off hand\'s');
  assert.equal(DUAL.OFF_DAMAGE, OFF_HAND_BLOW.blowWeight);
});

test('MIXED-PAIR A FLURRY\'S BLADE: the blade that answers the gun\'s shot inside FLURRY_WINDOW is thrown from the raised hand - DUAL.FLURRY_FROM_FRAME frames in - as any pair\'s answer, on the blade\'s own tick (mutants: the shot\'s end never told the classic clock; the blade begun on the pistol\'s clock)', () => {
  const pw = pairOf(LONGSWORD(), createPistolet(), { lead: 'L' });
  assert.ok(pw._attack('StrikeDown')); assert.equal(pw.strike.hand, 'L', 'the lead gun opens');
  untilIdle(pw);
  assert.ok(pw._attack('StrikeDown'));
  assert.deepEqual({ ...pw.strike }, { hand: 'R', flurry: true, off: true }, 'the blade answers the shot');
  assert.equal(pw.machine.frame, DUAL.FLURRY_FROM_FRAME);
  assert.deepEqual([pw.machine.tick, pw.machine.hitFrame, pw.machine.ranged], [null, null, false], 'on the blade\'s own law - the shot left the machine on the pistol\'s clock');
  untilIdle(pw);
  for (let t = 0; t < FLURRY_WINDOW + 0.1; t += DT) pw.update(DT);
  pw.gunReady = () => false;
  assert.ok(pw._attack('StrikeDown'));
  assert.deepEqual({ ...pw.strike }, { hand: 'R', flurry: false, off: true }, 'past the window the exchange opens again - the lead gun dry, its pull the blade\'s, from rest');
});

test('MIXED-PAIR THE BALANCE, MEASURED through the machine and the formula (bible/05-Combat/Two-Hands.md "A blade and a gun"): a longsword and a Pistolet land under a pair of Pistolets a second and about a tenth over a pair of longswords; a dagger beside the gun lands under the gun alone - the pair is as good as its weaker hand (mutants: MIXED.RELOAD 1 - the gun pair\'s whole damage on two fifths of its Pellets)', () => {
  const player = () => ({ isPlayer: true, level: 1, skills: new Array(35).fill(30), skillUses: new Array(35).fill(0), armor: 0, stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 } });
  const foe = () => ({ isPlayer: false, careerIndex: 0, mobileType: MOBILE_TYPES.Rat ?? 0, health: 3000, maxHealth: 3000, armor: 0, skills: 30, minMetalToHit: -1, stats: { strength: 50, agility: 50, luck: 50 } });
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x80000000; };
  const means = new Map();
  const mean = (w, off) => {
    const k = `${w.templateIndex}:${off}`;
    if (!means.has(k)) { let s = 0; const N = 20000; for (let i = 0; i < N; i++) s += Math.max(0, calculateAttackDamage(player(), foe(), { weapon: w, toHitMod: 1000, rolls: rnd, ...(off ? OFF_HAND_BLOW : {}) })); means.set(k, s / N); }
    return means.get(k);
  };
  const dps = (R, L) => {
    const pw = pairOf(R, L);
    pw.animCtx = () => ({ entity: player(), weaponType: 0, usingRightHand: true });
    let d = 0;
    for (let t = 0; t < 120; t += DT) { pw._attack('StrikeDown'); for (const e of pw.update(DT)) if (e === 'hit') d += mean(pw.weapon, pw.offStrike || (pw.machine.ranged && pw.isOffHandItem(pw.weapon))); }
    return d / 120;
  };
  const mixed = dps(LONGSWORD(), createPistolet()), swordPair = dps(LONGSWORD(), LONGSWORD()), gunPair = dps(createPistolet(), createPistolet());
  const daggerGun = dps(DAGGER(), createPistolet()), oneGun = dps(createPistolet(), null);
  assert.ok(mixed < gunPair, `a longsword and a Pistolet ${mixed.toFixed(2)}/s under a pistol pair's ${gunPair.toFixed(2)}/s`);
  assert.ok(mixed / swordPair > 1.08 && mixed / swordPair < 1.14, `about a tenth over a longsword pair (x${(mixed / swordPair).toFixed(3)})`);
  assert.ok(daggerGun < oneGun, `a dagger and a Pistolet ${daggerGun.toFixed(2)}/s under the Pistolet alone ${oneGun.toFixed(2)}/s`);
});

// ---- THE SPRITE LANE, THROUGH THE REAL RIG --------------------------------------------------------------------------

/** A WEAPON CIF (the two-hands suite's): the "wielding" image, then seven records of 120 x 100, five frames each. */
function cif() {
  const parts = Array.from({ length: 7 }, () => {
    const w = 120, h = 100, head = 12 + 31 * 2 + 2, runs = Math.ceil((w * h) / 127) + 1;
    const b = new Uint8Array(head + runs * 2); const v = new DataView(b.buffer);
    v.setUint16(0, w, true); v.setUint16(2, h, true);
    for (let f = 0; f < 5; f++) v.setUint16(12 + f * 2, head, true);
    for (let k = 0; k < runs; k++) b[head + k * 2] = 255;
    v.setUint16(12 + 62, b.length, true);
    return b;
  });
  const wield = new Uint8Array(12 + 40 * 30); const wv = new DataView(wield.buffer);
  wv.setUint16(4, 40, true); wv.setUint16(6, 30, true); wv.setUint16(10, 40 * 30, true); wield.fill(1, 12);
  const all = [wield, ...parts];
  const out = new Uint8Array(all.reduce((a, p) => a + p.length, 0)); let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}
const MELEE = cif();
const isGun = (q) => String(q.tex).startsWith('pistolet');

test('MIXED-PAIR THE RIG, CLASSIC SPRITE: the blade on its own side as DFU draws it, the Pistolet on the other in the mirror (a hand of a pair, its own side - never the Handedness side a lone pistol takes); the striking hand drawn over the other; each lowered under the other\'s strike; a left-handed player\'s pair crossed (mutants: the gun on the lone pistol\'s side; the pair\'s branch the melee pair\'s; the gun\'s guard never; drawn in a fixed order)', async () => {
  for (const leftHanded of [false, true]) {
    const { r, frame } = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, leftHanded });
    const rest = await frame();
    const gunQ = rest.find(isGun), blade = rest.find((q) => !isGun(q));
    assert.ok(gunQ && blade, 'both hands drawn');
    const onLeft = (q) => q.rect.x + q.rect.w / 2 < 160;
    assert.equal(onLeft(gunQ), !leftHanded, `${leftHanded ? 'left-handed: ' : ''}the gun (left hand) on the ${leftHanded ? 'right' : 'left'}`);
    assert.equal(onLeft(blade), leftHanded, 'the blade on the other side');
    assert.equal(!!gunQ.uv, !leftHanded, 'the gun on the left drawn in the mirror');
    let bladeUnderShot = null, gunUnderBlow = null, gunReloading = null, overBlade = 0, overGun = 0, shots = 0;
    for (let i = 0; i < 360; i++) {
      const q = await frame(1 / 60, i < 340);
      const s = r.playerWeapon.strikeInFlight;
      if (s?.hand === 'L' && r.playerWeapon.pistols.L.state === 'Firing') shots = Math.max(shots, r.playerWeapon.pistols.L.shots);
      if (!s || q.length < 2) continue;
      const last = q.at(-1);
      // the gun's guard under the FIRST blow, the gun loaded and resting - before any shot dips it to reload
      if (s.hand === 'R') { if (isGun(last)) overGun++; else overBlade++; if (!shots) gunUnderBlow = Math.max(gunUnderBlow ?? -Infinity, q.find(isGun).rect.y); else gunReloading = Math.max(gunReloading ?? -Infinity, q.find(isGun)?.rect.y ?? -Infinity); }
      if (s.hand === 'L') { assert.ok(isGun(last), 'the gun\'s shot over the blade'); bladeUnderShot = Math.max(bladeUnderShot ?? -Infinity, q.find((x) => !isGun(x)).rect.y); }
    }
    assert.ok(overBlade > 0 && overGun === 0, 'the blade\'s blow drawn over the gun');
    assert.ok(gunUnderBlow > gunQ.rect.y + 2 && gunUnderBlow < gunQ.rect.y + 40, `the loaded gun lowers by its guard under the blade's blow (${gunQ.rect.y.toFixed(1)} -> ${gunUnderBlow.toFixed(1)})`);
    assert.ok(gunReloading > gunUnderBlow + 20, `and dips out of the way to reload, on its own frame, while the blade swings (${gunReloading.toFixed(1)})`);
    assert.ok(bladeUnderShot > blade.rect.y + 1, `the blade lowers under the shot (${blade.rect.y.toFixed(1)} -> ${bladeUnderShot.toFixed(1)})`);
  }
});

test('MIXED-PAIR THE RIG, THE GUN\'S PELLETS: with none in the pack the pair is not put away (a lone gun\'s guard is the gun\'s) and every pull is the blade\'s; with Pellets the gun fires (mutants: the pair sheathed for the gun\'s Pellets; the gun firing dry)', async () => {
  const dry = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, pellets: 0 });
  dry.r.playerWeapon.usingRightHand = false;   // the gun leads: the weapon in use at rest is the gun, which a lone gun's guard would sheathe
  for (let i = 0; i < 30; i++) await dry.frame(1 / 60, false);
  assert.equal(dry.r.playerWeapon.weapon?.templateIndex, createPistolet().templateIndex, 'at rest the weapon in use is the lead gun');
  assert.equal(dry.r.playerWeapon.sheathed, false, 'at rest, dry, not put away');
  for (let i = 0; i < 300; i++) await dry.frame(1 / 60, true);
  assert.equal(dry.r.playerWeapon.sheathed, false, 'still drawn');
  assert.equal(dry.r.playerWeapon.pistols.L.shots, 0, 'the gun never fired');
  assert.ok(dry.r.swing.n > 3, `the blade swung (${dry.r.swing.n})`);
  const wet = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE });
  for (let i = 0; i < 300; i++) await wet.frame(1 / 60, true);
  assert.ok(wet.r.playerWeapon.pistols.L.shots > 0, 'with Pellets the gun fires');
});

test('MIXED-PAIR THE RIG, THE GUN HAND\'S CLONE RESTS: under the Weapon Widget the gun is drawn on its own frame, and its hand\'s clone stands on a still machine - never winding up a swing for a shot, never drawn - while the blade\'s clone plays its blows (mutant: the gun hand\'s clone fed the pair\'s view)', async () => {
  const { r, frame } = await pistolRig({ right: LONGSWORD(), left: createPistolet(), cif: MELEE, widget: { Enabled: true } });
  let gunCloneSwung = false, bladeCloneSwung = false;
  for (let i = 0; i < 360; i++) {
    const q = await frame(1 / 60, i < 340);
    if (r.twoHands.offWidget.animating) gunCloneSwung = true;
    if (r.widget.animating) bladeCloneSwung = true;
    assert.ok(q.filter(isGun).length <= 1, 'one gun on the screen');
  }
  assert.equal(gunCloneSwung, false, 'the gun hand\'s clone never swings');
  assert.equal(bladeCloneSwung, true, 'the blade\'s clone plays its blows');
});
