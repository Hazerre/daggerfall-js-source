// THE DWARVEN PISTOLET, pinned (PISTOLET, 2026-10-21; bible/05-Combat/Dwarven-Pistolet.md). The Thunderlock's suite is the
// model (test/systems/thunderlock.test.js); this one pins the second gun the way the game asks about it - the producer's
// own mint, the equip law, the machine, the rig's module, the art the loader actually cuts, the bakes re-run - and the
// owner's decisions as decisions: the name, the numbers, the rarity, the pair, the Sunken Sovereign.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PISTOLET_TEMPLATE, PISTOLET_ARCHIVE, PISTOLET_TEMPLATES, PISTOLET_DAMAGE, PISTOLET_SKILL, createPistolet, isPistolet,
  ICON_FILES, ART_RECORDS, PAPERDOLL_OFFSET, pistoletImageRecord, installPistoletIcons, FIND_WEIGHT,
  SFX, SFX_FILES, installPistoletSounds,
} from '../../src/systems/pistolet.js';
import { THUNDERLOCK_TEMPLATE, PELLET_TEMPLATE, createThunderlock, createPellets, FIND_MIN_TIER } from '../../src/systems/thunderlock.js';
import { isGunTemplate, ammoTemplateFor, orbArchiveFor, ORB_ARCHIVE, PISTOLET_SPAN } from '../../src/characters/thunderlockIds.js';
import { weaponMinDamage, weaponMaxDamage, weaponSkillUsed } from '../../src/characters/weapons.js';
import { SKILLS } from '../../src/systems/skills.js';
import { getItemHands, ITEM_HANDS, equipItem, EQUIP_SLOTS } from '../../src/systems/equip.js';
import { weaponTypeForItem, WEAPON_TYPES, isGunType, isPistoletType, plainWeaponType, getWeaponAnims, THUNDERLOCK_ANIMS } from '../../src/combat/fpsWeapon.js';
import { HANDS_MODE, DUAL_GUN_TYPES, handsModeOf, dualEligible, DUAL, GUARD } from '../../src/combat/twoHands/handsLaw.js';
import { PlayerWeapon, handDesc } from '../../src/combat/playerWeapon.js';
import { GUN_FEEL, PISTOLET_FEEL, PISTOLET_TICK_SECONDS, PISTOLET_COOLDOWN_SECONDS } from '../../src/combat/gun/gunFeel.js';
import { gunWidgetSettings, TUNED_FIELDS } from '../../src/combat/gun/gunViewmodel.js';
import { createGunPair } from '../../src/combat/gun/gunPair.js';
import { loadPistoletArt, cutStrip, pistoletGildKeep, flashPoint, PISTOL_STRIP } from '../../src/combat/gun/pistoletArt.js';
import { PISTOL_OPENING } from '../../src/tools/pistolLab.js';
import { uniqueFinds } from '../../src/systems/loot/lootRarity.js';
import { stockShopShelf, SHOP_ITEM_GROUPS } from '../../src/systems/shopStock.js';
import { SUNKEN_SOVEREIGN, mintGilded } from '../../src/systems/gilded.js';
import { techniqueFamily } from '../../src/combat/technique/techniqueRoster.js';
import { armsTop, siegeIsBow } from '../../src/net/siege/siegeRef.js';
import { templateGroups } from '../../src/systems/item/itemLaw.js';
import { thunderlockMuzzleLight } from '../../src/systems/thunderlock.js';
import { OWN_MW_MODELS, OWN_MW_GILDED, ownWeaponModelFor } from '../../src/characters/ownModels/ownWeaponModels.js';
import { MW_WEAPON_TYPE } from '../../src/formats/morrowind/mwFirstPerson.js';
import { setModSetting, _resetModSettings } from '../../src/systems/modSettings.js';
import { readPng } from '../../tools/pngIO.mjs';
import { pistoletArt, SOURCE as ART_SOURCE, OUT as ART_OUT, BAND, dollGrip, DOLL_ANGLE } from '../../tools/pistoletArt.mjs';
import { bakePistolet, OUT as MW_OUT, SOURCE as MW_SOURCE } from '../../tools/bakePistolet.mjs';

const png = (f) => readPng(readFileSync(f));
const pixelsEqual = (a, b) => a.width === b.width && a.height === b.height && Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

test('the item: the owner’s name and numbers, one-handed, Archery, the Pellet, the Thunderlock’s laws one weapon along', () => {
  assert.equal(PISTOLET_TEMPLATE, 562);
  assert.equal(PISTOLET_ARCHIVE, 562);
  const [row] = PISTOLET_TEMPLATES;
  assert.deepEqual([row.name, row.baseWeight, row.basePrice, row.isOneHanded], ['Dwarven Pistolet', 2.5, 260, true]);
  const it = createPistolet();
  assert.deepEqual([it.templateIndex, it.group, it.material], [562, 'Weapons', 4], 'Dwarven by default, the producer’s own mint');
  assert.ok(isPistolet(it) && isGunTemplate(562) && isGunTemplate(THUNDERLOCK_TEMPLATE) && !isGunTemplate(120));
  // 4-15, once, on the leaf, and the damage law answers it
  assert.deepEqual({ ...PISTOLET_SPAN }, { min: 4, max: 15 });
  assert.equal(PISTOLET_DAMAGE, PISTOLET_SPAN);
  assert.deepEqual([weaponMinDamage(562), weaponMaxDamage(562)], [4, 15]);
  assert.equal(weaponSkillUsed(562), SKILLS.Archery);
  assert.equal(PISTOLET_SKILL, SKILLS.Archery);
  // the Thunderlock's Pellet, and its orb
  assert.equal(ammoTemplateFor(it), PELLET_TEMPLATE);
  assert.equal(ammoTemplateFor(createThunderlock()), PELLET_TEMPLATE, 'and the Thunderlock still eats it');
  assert.equal(orbArchiveFor(it), ORB_ARCHIVE);
  assert.equal(ammoTemplateFor({ templateIndex: 120 }), null);
  // Either hand - the pair's precondition
  assert.equal(getItemHands(it), ITEM_HANDS.Either);
  assert.equal(getItemHands(createThunderlock()), ITEM_HANDS.Both, 'the Thunderlock stays two-handed');
});

test('the rarity: both guns a unique find at half the Thunderlock’s old weight, tier 4 up, arriving loaded - never on a shelf', () => {
  assert.equal(FIND_WEIGHT, 0.5, 'the owner: "make the thunderlock in general more rare along with the new hand cannon"');
  const finds = uniqueFinds();
  const tl = finds.find((f) => f.id === 'dwarven-thunderlock'), pl = finds.find((f) => f.id === 'dwarven-pistolet');
  assert.ok(tl && pl);
  assert.equal(tl.weight, 0.5);
  assert.equal(pl.weight, 0.5);
  assert.equal(pl.minTier, FIND_MIN_TIER);
  const minted = pl.mint(() => 0.5);
  assert.ok(isPistolet(minted[0]) && minted[1].templateIndex === PELLET_TEMPLATE && minted[1].stackCount > 0, 'it arrives loaded');
  const shelf = readFileSync('src/systems/shopStock.js', 'utf8');
  assert.ok(!/createPistolet|PISTOLET_TEMPLATE|isPistolet/.test(shelf), 'the shop stock never names it');
  for (const buildingType of Object.keys(SHOP_ITEM_GROUPS).map(Number)) {
    const all = stockShopShelf({ buildingType, quality: 20 }, { level: 30 }, { rolls: () => 0 });
    assert.ok(!all.some(isPistolet), `building ${buildingType}: no Pistolet on the shelf`);
  }
});

test('the readers that are not about ONE gun answer for both: the technique family, the siege’s reach, the item law’s group', () => {
  assert.equal(techniqueFamily(createPistolet()), 'thunderlock', 'the guns’ family - Piercing Shot, never a volley');
  assert.equal(armsTop(562, 4), 15 + 2, 'its top plus its metal');
  assert.ok(siegeIsBow(562), 'its blow is a shot');
  assert.deepEqual(templateGroups(562), ['Weapons']);
});

test('the pictures: the owner’s sprite whole in a list, a fist-gapped layer on each hand of the doll, gold for the Sunken Sovereign - and the bake reproduces every file', () => {
  const src = png(ART_SOURCE);
  assert.deepEqual([src.width, src.height], [24, 17], 'Daggerfall’s own scale - a classic dagger’s doll record');
  for (let p = 3; p < src.data.length; p += 4) assert.ok(src.data[p] === 0 || src.data[p] === 255, '1-bit, the screen quad’s law');
  // the tool, re-run against what shipped - pixel for pixel
  const art = pistoletArt(src);
  for (const [k, file] of Object.entries(ART_OUT)) assert.ok(pixelsEqual(art[k], png(file)), `${file} is the tool’s own output`);
  assert.ok(art.cut >= 8 && art.cut <= 40, `the gap is a fist's, not a bite (${art.cut} px)`);
  // the gap severs the grip: the frame above it and the butt below it stay drawn
  const doll = png(ART_OUT.doll);
  const at = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];
  // A DOWNWARD ANGLE, NOT MIRRORED (the owner, 2026-10-22: "Still wrong. It should be at a downward angle in the right
  // hand in the picture. Not mirrored"): each hand's layer is the gapped sprite tilted DOLL_ANGLE counter-clockwise by
  // RotSprite - no colour in it that the sprite does not have - the muzzle down and to the LEFT, as the sprite's points
  assert.equal(DOLL_ANGLE, 45);
  const left = png(ART_OUT.dollLeft);
  const colours = (img) => { const c = new Set(); for (let p = 0; p < img.data.length; p += 4) if (img.data[p + 3]) c.add(img.data.slice(p, p + 4).join()); return c; };
  const own = colours(src);
  for (const img of [doll, left]) for (const c of colours(img)) assert.ok(own.has(c), `no new colour (${c})`);
  const solid = (img, pred) => { for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (at(img, x, y) && pred(x, y)) return true; return false; };
  const bulk = (img, g) => { let sx = 0, sy = 0, n = 0; for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (at(img, x, y)) { sx += x + 0.5; sy += y + 0.5; n++; } return [sx / n - g.x, sy / n - g.y]; };
  const gripR = dollGrip({ rolled: true }), gripL = dollGrip();
  for (const [img, g, hand] of [[doll, gripR, 'right'], [left, gripL, 'left']]) {
    assert.equal(at(img, Math.floor(g.x), Math.floor(g.y)), 0, `${hand}: the fist’s gap at the tilted band’s centre`);
    assert.ok(solid(img, (x, y) => x < g.x - 10 && y > g.y + 6), `${hand}: the barrel reaches down and to the left of the fist`);
    assert.ok(!solid(img, (x, y) => x < g.x - 10 && y < g.y - 4), `${hand}: and not level out from it`);
  }
  // THE RIGHT HAND'S IS ROLLED OVER (the owner: "The left gun should be upside down and held in the hand" - the
  // picture's left): the same tilt of the sprite turned top to bottom, so the gun's bulk hangs BELOW the fist, where a
  // classic blade leaves the right fist - the upright gun's sits beside it, which is right only for the left fist
  const [, belowR] = bulk(doll, gripR), [besideL, belowL] = bulk(left, gripL);
  assert.ok(belowR > 5, `the right hand’s gun hangs below its fist (${belowR.toFixed(1)})`);
  assert.ok(besideL < -6 && belowL < 4, `the left hand’s reaches out beside its fist (${besideL.toFixed(1)}, ${belowL.toFixed(1)})`);
  let mirrored = true;
  for (let y = 0; y < doll.height && mirrored; y++) for (let x = 0; x < doll.width; x++) if (at(doll, x, y) !== at(left, doll.width - 1 - x, y)) { mirrored = false; break; }
  assert.equal(mirrored, false, 'never the left hand’s in the glass');
  // by job and by hand
  const it = createPistolet();
  assert.equal(pistoletImageRecord(it, false), ART_RECORDS.icon);
  assert.equal(pistoletImageRecord({ ...it, equipSlot: EQUIP_SLOTS.RightHand }, true), ART_RECORDS.doll);
  assert.equal(pistoletImageRecord({ ...it, equipSlot: EQUIP_SLOTS.LeftHand }, true), ART_RECORDS.dollLeft);
  const gold = { ...it, rarity: 'gilded' };
  assert.equal(pistoletImageRecord(gold, false), ART_RECORDS.gildedIcon);
  assert.equal(pistoletImageRecord({ ...gold, equipSlot: EQUIP_SLOTS.LeftHand }, true), ART_RECORDS.gildedDollLeft);
  // each hand its own layer: the left hand's records are the left layer's files
  const fileOf = (rec) => ICON_FILES.find((r) => r.record === rec).file;
  assert.equal(`public/art/${fileOf(ART_RECORDS.dollLeft)}`, ART_OUT.dollLeft);
  assert.equal(`public/art/${fileOf(ART_RECORDS.gildedDollLeft)}`, ART_OUT.dollLeftGilded);
  assert.equal(`public/art/${fileOf(ART_RECORDS.doll)}`, ART_OUT.doll);
  // every record a file that ships and is allow-listed; the doll's records carry their hand's offset
  const doctrine = readFileSync('test/tooling/doctrine.test.js', 'utf8');
  for (const r of ICON_FILES) {
    assert.ok(readFileSync(`public/art/${r.file}`).length > 0);
    assert.ok(doctrine.includes(`'public/art/${r.file}'`), `${r.file} is on the doctrine’s allow-list`);
  }
  // THE HANDS WERE MEASURED (TEXTURE.234's one-handed doll records leave the fist's gap at panel (27, 96) right, (69, 95)
  // left) and ONE RULE seats both: each layer's band centre on its hand's gap, as a classic hilt's
  const centreR = [PAPERDOLL_OFFSET.right.x - 200 + gripR.x, PAPERDOLL_OFFSET.right.y - 8 + gripR.y];
  const centreL = [PAPERDOLL_OFFSET.left.x - 200 + gripL.x, PAPERDOLL_OFFSET.left.y - 8 + gripL.y];
  assert.ok(Math.hypot(centreR[0] - 27, centreR[1] - 96) < 1.5, `the right hand’s gap on its fist (${centreR})`);
  assert.ok(Math.hypot(centreL[0] - 69, centreL[1] - 95) < 1.5, `the left hand’s gap on its fist (${centreL})`);
});

test('the pictures register through the stand-in door, all six', async () => {
  const added = [];
  const textures = await import('../../src/systems/textureReplacement.js');
  const before = textures.vendorTextureCount();
  await installPistoletIcons({ fetchBytes: async (f) => { added.push(f); return readFileSync(`public/art/${f}`); } });
  assert.ok(textures.vendorTextureCount() >= before, 'registered');
  assert.equal(ICON_FILES.length, 6);
  assert.deepEqual(new Set(ICON_FILES.map((r) => r.archive)), new Set([PISTOLET_ARCHIVE]));
});

test('its sounds are the owner’s three picks, read off the one row the lab opens on, in the classic format', async () => {
  assert.deepEqual(Object.values(SFX_FILES), ['fire-shotgun.wav', 'open-shell.wav', 'close-ready.wav'],
    'the owner: "Must be these values/sounds exactly" - shotgun (clean crack), shell, ready (snaps shut)');
  assert.deepEqual([PISTOL_OPENING.sfxFire, PISTOL_OPENING.sfxOpen, PISTOL_OPENING.sfxClose], ['fire-shotgun', 'open-shell', 'close-ready'], 'and the lab’s dropdowns read the same row');
  for (const f of Object.values(SFX_FILES)) {
    const b = readFileSync(`public/sfx/${f}`);
    assert.equal(new DataView(b.buffer, b.byteOffset).getUint32(24, true), 11025);
  }
  const keys = [];
  const n = await installPistoletSounds({ registerSound: (k) => { keys.push(k); return true; } }, { fetchBytes: async () => new Uint8Array([1]) });
  assert.equal(n, 3);
  assert.deepEqual(keys.sort(), [SFX.close, SFX.fire, SFX.open].sort());
});

test('the feel is the owner’s panel, one home: the game’s row, and the lab reads it back', () => {
  for (const [lab, game] of [['scale', 'scale'], ['raise', 'raise'], ['fps', 'fps'], ['reloadMs', 'reloadMs'], ['hitFrame', 'hitFrame'],
    ['kick', 'kick'], ['back', 'back'], ['stiff', 'stiff'], ['damp', 'damp'], ['shake', 'shake'], ['alphaCut', 'alphaCut']]) {
    assert.equal(PISTOL_OPENING[lab], PISTOLET_FEEL[game], `${lab}`);
  }
  assert.equal(PISTOL_OPENING.drop, PISTOLET_FEEL.hiddenTarget[1]);
  assert.equal(PISTOL_OPENING.widget, PISTOLET_FEEL.widget, 'the very object');
  assert.equal(PISTOLET_TICK_SECONDS, 1 / 12);
  assert.equal(PISTOLET_COOLDOWN_SECONDS, 1.4);
});

test('the owner’s Bob and Inertia reach the game OVER Diverse Weapons’ preset, and only the magnitudes - the player’s switches stay theirs', () => {
  _resetModSettings();
  setModSetting('diverse-weapons', 'Enabled', true);
  setModSetting('diverse-weapons', 'WeaponWidgetPreset', true);
  try {
    const own = gunWidgetSettings();
    const tuned = gunWidgetSettings(null, PISTOLET_FEEL.widget);
    assert.equal(own.bobLength, 1.42, 'the preset is on: its Bob.Length 142');
    assert.equal(tuned.bobLength, 1.46, 'and the Pistolet’s 146 over it');
    assert.equal(tuned.bobSizeYMod, 1.4);
    assert.deepEqual([tuned.inertiaScale, tuned.inertiaSpeed, tuned.inertiaForwardScale], [1000, 1000, 0]);
    for (const k of ['bob', 'offset', 'inertia', 'swing', 'recoil', 'stepTransforms']) assert.equal(tuned[k], own[k], `${k} - a switch, the player’s`);
    assert.ok(!TUNED_FIELDS.some((k) => typeof own[k] === 'boolean' && ['bob', 'offset', 'inertia'].includes(k)));
  } finally { _resetModSettings(); }
});

test('the weapon type: Pistolet 19 and its enchanted 20, the guns’ table and predicates', () => {
  const it = createPistolet();
  assert.equal(weaponTypeForItem(it), WEAPON_TYPES.Pistolet);
  assert.deepEqual([WEAPON_TYPES.Pistolet, WEAPON_TYPES.Pistolet_Magic], [19, 20]);
  assert.equal(plainWeaponType(WEAPON_TYPES.Pistolet_Magic), WEAPON_TYPES.Pistolet);
  assert.equal(getWeaponAnims(WEAPON_TYPES.Pistolet), THUNDERLOCK_ANIMS);
  assert.ok(isGunType(19) && isGunType(20) && isGunType(17) && isGunType(18) && !isGunType(14));
  assert.ok(isPistoletType(19) && isPistoletType(20) && !isPistoletType(17));
});

test('the pair’s law: two Pistolets are a pair, a Pistolet and a sword are not (two of a kind), the Thunderlock never', () => {
  assert.deepEqual([...DUAL_GUN_TYPES], [WEAPON_TYPES.Pistolet, WEAPON_TYPES.Pistolet_Magic], 'pinned to the enum');
  const p = handDesc(createPistolet()), sword = { item: true, type: WEAPON_TYPES.LongBlade, hands: ITEM_HANDS.Either };
  assert.ok(dualEligible(p));
  assert.equal(handsModeOf({ right: p, left: handDesc(createPistolet()) }), HANDS_MODE.Dual);
  assert.equal(handsModeOf({ right: p, left: sword }), HANDS_MODE.Single, 'never one of each');
  assert.equal(handsModeOf({ right: sword, left: p }), HANDS_MODE.Single);
  assert.equal(dualEligible(handDesc(createThunderlock())), false, 'two-handed');
});

/** A rig-less player weapon holding `right` and `left`, its machine stepped at 60fps. */
function pairWeapon(right, left) {
  const pw = new PlayerWeapon();
  pw.currentRightHandWeapon = right; pw.currentLeftHandWeapon = left; pw.usingRightHand = true;
  pw.applyWeapon();
  return pw;
}
const runFor = (pw, s, each = null) => { for (let t = 0; t < s; t += 1 / 60) { each?.(); pw.update(1 / 60); } };

test('the pair fires hand by hand: the lead opens, the other answers as the off hand, each hand reloads on its own - and a pull falls to the loaded pistol', () => {
  const pw = pairWeapon(createPistolet(), createPistolet());
  assert.equal(pw.handsMode, HANDS_MODE.Dual);
  assert.ok(pw.gunPair);
  const shots = [];
  runFor(pw, 4.2, () => { if (pw.machine.state === 'Idle' && pw._attack('StrikeDown')) shots.push([+pw.machine.now.toFixed(2), pw.strike.hand, pw.strike.off, pw.strike.flurry, pw.machine.frame]); });
  assert.deepEqual(shots.slice(0, 3).map((s) => s[1]), ['R', 'L', 'R'], 'right, left, right');
  assert.equal(shots[0][2], false, 'the lead’s is never the off hand’s');
  assert.equal(shots[1][2], true, 'the left’s is, and carries DUAL’s terms');
  assert.equal(shots[1][3], true, 'the left’s answer is the law’s flurry');
  assert.equal(shots[1][4], 0, 'and a gun’s flurry still plays its six frames from the first - never DUAL.FLURRY_FROM_FRAME');
  // the left fires the moment the right's frames end - it is LOADED; the right waits out its own reload
  const frames = 6 * PISTOLET_TICK_SECONDS;
  assert.ok(Math.abs(shots[1][0] - frames) < 0.05, `the left answers at ${shots[1][0]}s, the right’s frames’ end`);
  assert.ok(shots[2][0] >= frames + PISTOLET_COOLDOWN_SECONDS - 0.05, `the right is back after its own reload (${shots[2][0]}s)`);
});

test('the pistol lab\'s one departure from the flurry, in the game: past the window the law names the lead - and the lead still reloading, the pull falls to the loaded left', () => {
  const pw = pairWeapon(createPistolet(), createPistolet());
  assert.ok(pw._attack('StrikeDown'));   // the right fires
  assert.equal(pw.strike.hand, 'R');
  runFor(pw, 6 * PISTOLET_TICK_SECONDS + 0.9);   // its frames end, then past FLURRY_WINDOW - the right still reloading (1.4 s)
  assert.ok(!pw.handLoaded('R') && pw.handLoaded('L'));
  assert.ok(pw._attack('StrikeDown'), 'the pull is not a click on nothing');
  assert.equal(pw.strike.hand, 'L', 'the loaded left fires');
  assert.equal(pw.strike.off, true);
  // and every gun shot plays its six frames from the first - never the flurry's frame skip
  assert.equal(pw.machine.frame, 0);
});

test('the pair’s cadence against one Pistolet and the Thunderlock: more shots, twice the Pellets - measured through the machine', () => {
  const count = (pw, seconds) => { let n = 0; runFor(pw, seconds, () => { if (pw.machine.state === 'Idle' && pw._attack('StrikeDown')) n++; }); return n; };
  const one = count(pairWeapon(createPistolet(), null), 60);
  const pair = count(pairWeapon(createPistolet(), createPistolet()), 60);
  const rifle = count(pairWeapon(createThunderlock(), null), 60);
  // one Pistolet: 6/12 s of frames + 1.4 s = 1.9 s a shot; a pair: two shots every ~2 s
  assert.ok(Math.abs(one - 60 / 1.9) <= 1.5, `one Pistolet: ${one} shots a minute`);
  assert.ok(pair >= one * 1.8 && pair <= one * 2.05, `a pair about doubles the shots (${pair} against ${one})`);
  // damage a second, at the off hand's 0.8 for half the pair's shots: the pair a shade over the Thunderlock, for twice
  // its Pellets a minute (bible/05-Combat/Dwarven-Pistolet.md, "The balance")
  const mean = (s) => (s.min + s.max) / 2;
  const pairDps = (pair / 2) * mean(PISTOLET_SPAN) * (1 + DUAL.OFF_DAMAGE) / 60, rifleDps = rifle * 16.5 / 60;
  assert.ok(pairDps > rifleDps && pairDps < rifleDps * 1.25, `the pair ${pairDps.toFixed(2)}/s against the Thunderlock’s ${rifleDps.toFixed(2)}/s`);
  assert.ok(pair > rifle * 1.9, `and spends ${pair} Pellets a minute to its ${rifle}`);
});

test('a single Pistolet runs its OWN cadence, not the Thunderlock’s', () => {
  const pw = pairWeapon(createPistolet(), null);
  pw._attack('StrikeDown'); pw.update(1 / 60);
  assert.equal(pw.machine.tick, PISTOLET_TICK_SECONDS);
  assert.equal(pw.machine.cooldown, PISTOLET_COOLDOWN_SECONDS);
  assert.equal(pw.machine.hitFrame, PISTOLET_FEEL.hitFrame);
  const tl = pairWeapon(createThunderlock(), null);
  tl._attack('StrikeDown'); tl.update(1 / 60);
  assert.equal(tl.machine.cooldown, GUN_FEEL.reloadMs / 1000, 'and the Thunderlock keeps its own');
});

test('the rig’s pair module: each hand its spring, the resting hand guards, the left one flipped, the striking one drawn over', () => {
  const pair = createGunPair();
  const pw = pairWeapon(createPistolet(), createPistolet());
  pw._attack('StrikeDown');
  pair.punch(pw.strike.hand, PISTOLET_FEEL);
  for (let i = 0; i < 6; i++) pair.step(1 / 60, pw, { feel: PISTOLET_FEEL, settings: gunWidgetSettings(null, PISTOLET_FEEL.widget) });
  assert.ok(pair.hands.R.recoil.y !== 0 && pair.hands.L.recoil.y === 0, 'the right’s spring kicked, the left’s did not');
  assert.ok(pair.hands.L.guard > 0.5 && pair.hands.R.guard === 0, 'the resting left lowers into its guard');
  const k = pair.kickOf('L', 100);
  assert.ok(k.y > 0.5 * GUARD.LOWER * 100, `straight down, a share of its height (${k.y.toFixed(1)})`);
  assert.equal(k.x, 0);
  assert.deepEqual(pair.order(pw), ['L', 'R'], 'the striking right drawn last');
  assert.equal(pair.flipOf('L'), true); assert.equal(pair.flipOf('R'), false);
  assert.equal(pair.flipOf('R', true), true, 'a left-handed player’s pair is the mirror');
  // the frame each shows: the striking hand the machine’s, the other its rest
  assert.deepEqual(pair.frameOf('L', pw), { record: 0, frame: 0 });
  assert.equal(pair.frameOf('R', pw).record, 1);
});

test('the first-person art the loader cuts: native size, 1-bit, the muzzle on the flash, and gold on the pistol only', async () => {
  const strip = png(`public/art/${PISTOL_STRIP.file}`);
  const { frames, boxes } = cutStrip(strip);
  assert.equal(frames.length, 6);
  for (const f of frames) for (let p = 3; p < f.data.length; p += 4) assert.ok(f.data[p] === 0 || f.data[p] === 255);
  assert.deepEqual(boxes[0], { x: 6, y: 12, w: 82, h: 101 }, 'the rest frame’s box - the anchor');
  const art = await loadPistoletArt({ uploadTexture: (_k, name, t) => ({ name, t }) }, {
    fetch: async (f) => readFileSync(`public/${f}`), decode: async (b) => readPng(b),
  });
  assert.equal(art.weaponType, WEAPON_TYPES.Pistolet);
  assert.ok(Math.abs(art.pose.widthPct - 82 * 1.05 / 320) < 1e-12, 'one art pixel a design pixel, times the owner’s 1.05');
  assert.equal(art.pose.raise, -1);
  assert.equal(art.records[1].frames.length, 6);
  // the muzzle: up and left of the union box, where the flame leaves the barrel - not the moved arm's centroid
  assert.ok(art.muzzle.x < 0.25 && art.muzzle.y < 0.25, `on the flame (${art.muzzle.x.toFixed(2)}, ${art.muzzle.y.toFixed(2)})`);
  assert.equal(flashPoint(frames[0]), null, 'the rest frame has no flash');
  // the gold keeps the hand: the bracer's leather and the sleeve's grey are never gilded, the brass and the grip are
  const rest = frames[0], keep = pistoletGildKeep(rest);
  const kept = (x, y) => keep[y * rest.width + x];
  assert.equal(kept(60, 70), 0, 'the bracer');
  assert.equal(kept(85, 110), 0, 'the sleeve at the corner');
  assert.equal(kept(40, 80), 1, 'the teal grip');
  const brass = boxes[0];
  let gilt = 0;
  for (let y = brass.y; y < brass.y + 30; y++) for (let x = brass.x; x < brass.x + 40; x++) gilt += kept(x, y);
  assert.ok(gilt > 400, `the pistol’s barrel and brass are gilded (${gilt} px)`);
});

test('the flash’s light: the gun’s own reach, from the hand that fired', () => {
  const feet = [0, 0, 0];
  const right = thunderlockMuzzleLight({ _thunderlockFlash: 1, _thunderlockFlashSide: 1, _thunderlockFlashRange: PISTOLET_FEEL.flashRange }, feet, 0);
  const left = thunderlockMuzzleLight({ _thunderlockFlash: 1, _thunderlockFlashSide: -1, _thunderlockFlashRange: PISTOLET_FEEL.flashRange }, feet, 0);
  assert.equal(right.range, PISTOLET_FEEL.flashRange);
  assert.ok(right.x > 0 && left.x < 0 && Math.abs(right.x + left.x) < 1e-12, 'the left pistol’s flash on the left');
  assert.equal(thunderlockMuzzleLight({ _thunderlockFlash: 1 }, feet, 0).range, GUN_FEEL.flashRange, 'the Thunderlock’s own, unparked');
});

test('the Sunken Sovereign is a gilded Pistolet: the owner’s "replace the serpent boss gilded weapon with this new weapon"', () => {
  assert.equal(SUNKEN_SOVEREIGN.templateIndex, PISTOLET_TEMPLATE);
  const it = mintGilded(SUNKEN_SOVEREIGN);
  assert.ok(isPistolet(it));
  assert.equal(it.rarity, 'gilded');
  assert.equal(it.gilded, 'the-sunken-sovereign', 'the same record id - every hoard and save that holds one reads it');
  assert.ok(it.affixes.some((a) => a.id === 'skill' && a.param === SKILLS.Archery));
  assert.equal(pistoletImageRecord(it, false), ART_RECORDS.gildedIcon);
  assert.equal(ownWeaponModelFor(it)?.model, 'pistolet_gilded.nif');
});

test('the Morrowind model is the sprite extruded - the bake reproduces the shipped bytes, and the row borrows the one-handed ranged act', () => {
  const r = bakePistolet(readFileSync(MW_SOURCE));
  assert.equal(Buffer.compare(r.nif, readFileSync(MW_OUT.mesh)), 0, 'pistolet.nif is the bake’s');
  assert.equal(Buffer.compare(r.dds, readFileSync(MW_OUT.texture)), 0);
  assert.equal(Buffer.compare(r.gildedNif, readFileSync(MW_OUT.gildedMesh)), 0);
  assert.equal(Buffer.compare(r.gildedDds, readFileSync(MW_OUT.gildedTexture)), 0);
  const b = r.mesh.bounds;
  assert.ok(Math.abs((b.max[1] - b.min[1]) / 69.99125109 - 0.36) < 0.02, '36 cm long');
  assert.ok(b.max[1] > 15 && b.min[1] < 0, 'the barrel forward of the grip, the butt behind it');
  const row = OWN_MW_MODELS[PISTOLET_TEMPLATE];
  assert.equal(row.animateAs, MW_WEAPON_TYPE.MarksmanThrown, 'the one-handed ranged act Morrowind has');
  assert.equal(row.borrowsAmmo, false);
  assert.equal(row.holdAs, undefined, 'no long-gun stance');
  assert.equal(OWN_MW_GILDED[PISTOLET_TEMPLATE].model, 'pistolet_gilded.nif');
});

test('the pair is equipped through the equip law - one in each hand - and the player weapon reads it as a gun pair', () => {
  const e = { isPlayer: true, items: [], stats: { strength: 50, agility: 50 } };
  const a = createPistolet(), b = createPistolet();
  e.items.push(a, b, createPellets(10));
  equipItem(e, a); equipItem(e, b);
  const worn = Object.values(e.equip?.slots ?? {}).filter((v) => v && isPistolet(v));
  assert.equal(worn.length, 2, 'both worn');
  assert.ok(new Set(worn.map((v) => v.equipSlot)).size === 2, 'in two different hands');
});
