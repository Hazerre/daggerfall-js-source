// THE DWARVEN PISTOLET - the port's second gun, and the first one a pair of can be carried.
//
// The owner, 2026-10-21: "this spritesheet is to be for our new weapon type, which can also be duel wielded. Its a dwarven
// flintlock style pistol. We need to use the same prototype testing we did for the thunderlock" - the pistol lab
// (pistol-proto.html, bible/05-Combat/Pistol-Lab.md) - then "Next this is the paperdoll model/inventory. The gun should
// use the same ammo the thunderlock uses", and "Dwarven Pistolet" for its name. Design and record:
// bible/05-Combat/Dwarven-Pistolet.md.
//
// IT IS THE THUNDERLOCK'S SHAPE, ONE WEAPON ALONG (systems/thunderlock.js is the worked example and every law here names
// the one it follows): an ARCHERY weapon that keeps the melee one-shot machine and pays the ranged cooldown; a custom
// template past DFU's table; its own art archive; its pictures through the vendor-texture door. What is its own:
//   - ONE-HANDED (characters/equipTable.js answers Either), so a second one in the other hand is a pair
//     (combat/twoHands/handsLaw.js DUAL_TYPES) - and a pair of guns reloads hand by hand (combat/playerWeapon.js);
//   - it spends the THUNDERLOCK'S PELLET (characters/thunderlockIds.js ammoTemplateFor), so it has no ammunition of its own
//     and the shops' Pellets (systems/shopStock.js) feed both guns;
//   - the owner's lab numbers (combat/gun/gunFeel.js PISTOLET_FEEL), and art drawn at Daggerfall's own scale.
//
// THE INDEX is 562, the next past the Thunderlock's pair - past DFU's 288 and Climates & Calories' 530-541, so
// registerCustomTemplates takes it and the frozen DFU table stays what it is.

import { registerCustomTemplates, mintCondition, setItemFields, registerOwnItemImage } from './item/itemTemplates.js';
import { addVendorTextures, vendorTextureCount } from './textureReplacement.js';
import { registerUniqueFind } from './loot/lootRarity.js';
import { SKILLS } from './skills.js';
import { APP_ROOT } from './appRoot.js';
import { PISTOLET_FEEL } from '../combat/gun/gunFeel.js';
import { createPellets, FIND_MIN_TIER, FIND_PELLETS, FIND_WEIGHT, WEAPON_GROUP } from './thunderlock.js';   // the Pellet's home, and the find's rules - one gun's laws, the other's to read
import { EQUIP_SLOTS } from '../characters/paperdoll/paperdoll.js';   // the slot a hand's weapon is worn in
import { PISTOLET_TEMPLATE, PISTOLET_ARCHIVE, PISTOLET_SPAN } from '../characters/thunderlockIds.js';

export { PISTOLET_TEMPLATE, PISTOLET_ARCHIVE };

/**
 * The row, in DFU's ItemTemplates.txt columns (the Thunderlock's own reasoning, scaled to a weapon a third its size).
 * The owner's numbers: 2.5 kg (the Thunderlock 6), 260 gold (480). `hitPoints` 90 is the Thunderlock's - the same
 * firing chamber - and the weapons' one pool sets the condition anyway (characters/weapons.js WEAPON_CONDITION_POOL).
 * `isOneHanded` TRUE: the art holds it in one fist, and a pair is the point. `enchantmentPoints` 250, between a dagger's
 * and the Thunderlock's 400.
 */
export const PISTOLET_TEMPLATES = Object.freeze([{
  index: PISTOLET_TEMPLATE,
  name: 'Dwarven Pistolet',
  baseWeight: 2.5,
  hitPoints: 90,
  basePrice: 260,
  enchantmentPoints: 250,
  rarity: 20,
  drawOrderOrEffect: 100,     // BlitItems' layer - weapons draw last, over the hand
  isBluntWeapon: false,
  isOneHanded: true,
  worldTextureArchive: PISTOLET_ARCHIVE,
  worldTextureRecord: 0,
  playerTextureArchive: PISTOLET_ARCHIVE,
  playerTextureRecord: 0,
}]);
registerCustomTemplates(PISTOLET_TEMPLATES);

export const isPistolet = (item) => item?.templateIndex === PISTOLET_TEMPLATE;

/** The skill a hit with it is scored on - the Thunderlock's, for the Thunderlock's reason (characters/weapons.js). */
export const PISTOLET_SKILL = SKILLS.Archery;
/** Its damage span, from the leaf that holds it once (characters/thunderlockIds.js PISTOLET_SPAN): 4-15 - a Long Bow is
 *  4-18 and the Thunderlock 7-26. One-handed and quicker to the next shot, so a pair is two of these, each hand on its
 *  own reload, at the dual wielder's off-hand terms (handsLaw.js DUAL). */
export const PISTOLET_DAMAGE = PISTOLET_SPAN;

/** Mint one - the Thunderlock's createThunderlock, one template along: Dwarven by default, the metal ladder's dye and
 *  damage modifier reading `material`. */
export function createPistolet({ material = 4, condition = null } = {}) {
  const item = mintCondition(setItemFields({
    group: WEAPON_GROUP, templateIndex: PISTOLET_TEMPLATE,
    material, flags: 0, variant: 0, message: 0, stackCount: 1,
  }));
  if (condition != null) item.currentCondition = Math.max(0, Math.min(item.maxCondition ?? condition, condition));
  return item;
}

// ── THE PICTURES ─────────────────────────────────────────────────────
//
// ONE PICTURE PER JOB, as the Thunderlock's since THUNDERLOCK-ART: the doll layer carries the fist's gap, the list
// shows the whole gun. The owner's 24x17 sprite IS the list's picture; tools/pistoletArt.mjs cuts the doll layer from
// it, tilts it barrel-down (never mirrored - the owner's), and gilds both for the Sunken Sovereign (systems/gilded.js).
//
// TWO HANDS ON THE DOLL. A classic Either-hand weapon carries two doll records - TEXTURE.234's base for the left hand and
// +1 for the right (ui/paperDoll.js: "an Either-hand weapon worn RIGHT uses the +1 record") - because a pair puts one in
// each hand and they cannot share a place. The Pistolet's two are ONE layer at two places - each hand's own offset.

/**
 * WHERE EACH HANGS (FIELD-GUN4's question, the Thunderlock's PAPERDOLL_OFFSET, for two hands). The doll's fists were
 * MEASURED, not guessed: the gap a classic one-handed weapon's doll record leaves for the fist (TEXTURE.234, the
 * player's own ARENA2 - dagger, mace, shortsword, war axe, each hand's record) closes at panel (27, 96) for the right
 * hand and (69, 95) for the left. ONE layer serves both hands, tilted barrel-down and NOT mirrored (the owner,
 * 2026-10-22, after a level cut and then a quarter-turned, mirrored pair: "Still wrong. It should be at a downward angle in
 * the right hand in the picture. Not mirrored"), so the fist's point is the same in both (tools/pistoletArt.mjs dollGrip,
 * layer pixel (20.8, 9.9), DOLL_ANGLE 45). The right hand's goes on its measured fist: panel (27 - 20.8, 96 - 9.9).
 * THE LEFT HAND IS NOT THE RIGHT'S PLACE IN THE GLASS (the owner, 2026-10-22: "its not fittest correctly in the left
 * hand"): the same unmirrored gun crosses the left fist the other way, so seated on (69, 95) its frame lay over the
 * knuckles and its butt stuck out past the hand. Each hand holds it the same way instead - the BUTT in the fist's hole,
 * the dark loop the curled fingers close (the bare ARENA2 doll: (29.5, 100.5) right, (64.5, 97) left), the frame out of
 * the fist's top. On the right that is the measured place. The left's was found by eye against the right's, layer
 * placements tried on the bare doll until its butt sat in the hole as the right's does: band centre (61.8, 94.9), the
 * layer at (61.8 - 20.8, 94.9 - 9.9). Screen coordinates, the panel's origin (200, 8) written beside them as the
 * Thunderlock's are. The owner's eye is the gate on both.
 */
export const PAPERDOLL_OFFSET = Object.freeze({ right: Object.freeze({ x: 200 + 6, y: 8 + 86 }), left: Object.freeze({ x: 200 + 41, y: 8 + 85 }) });

/** The records of archive 562, by job. */
export const ART_RECORDS = Object.freeze({ doll: 0, icon: 1, gildedDoll: 2, gildedIcon: 3, dollLeft: 4, gildedDollLeft: 5 });
export const ICON_FILES = Object.freeze([
  { archive: PISTOLET_ARCHIVE, record: ART_RECORDS.doll, frame: 0, file: 'pistolet-paperdoll.png', offset: PAPERDOLL_OFFSET.right },
  { archive: PISTOLET_ARCHIVE, record: ART_RECORDS.icon, frame: 0, file: 'pistolet-icon.png' },
  { archive: PISTOLET_ARCHIVE, record: ART_RECORDS.gildedDoll, frame: 0, file: 'pistolet-paperdoll-gilded.png', offset: PAPERDOLL_OFFSET.right },
  { archive: PISTOLET_ARCHIVE, record: ART_RECORDS.gildedIcon, frame: 0, file: 'pistolet-icon-gilded.png' },
  { archive: PISTOLET_ARCHIVE, record: ART_RECORDS.dollLeft, frame: 0, file: 'pistolet-paperdoll.png', offset: PAPERDOLL_OFFSET.left },
  { archive: PISTOLET_ARCHIVE, record: ART_RECORDS.gildedDollLeft, frame: 0, file: 'pistolet-paperdoll-gilded.png', offset: PAPERDOLL_OFFSET.left },
]);
/** Which of them an item wears for a job: on the doll its HAND's layer (the left hand's only when it is worn there - an
 *  unworn one and a right-hand one wear the right's), in a list the whole gun; gold for a Gilded piece. */
export function pistoletImageRecord(item, forPaperDoll) {
  const gilded = item?.rarity === 'gilded';
  if (!forPaperDoll) return gilded ? ART_RECORDS.gildedIcon : ART_RECORDS.icon;
  const left = item?.equipSlot === EQUIP_SLOTS.LeftHand;
  if (gilded) return left ? ART_RECORDS.gildedDollLeft : ART_RECORDS.gildedDoll;
  return left ? ART_RECORDS.dollLeft : ART_RECORDS.doll;
}
registerOwnItemImage(PISTOLET_TEMPLATE, (item, { forPaperDoll = false } = {}) => ({ archive: PISTOLET_ARCHIVE, record: pistoletImageRecord(item, forPaperDoll) }));

/** AUDIT-THUNDERLOCK F7: the site's root, never the document's. */
export const iconUrl = (file) => new URL(`art/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _installed = false;
/** Register the pictures once (installThunderlockIcons' door - `standIn: true` IS the registration: archive 562 exists
 *  only as this art, FIELD-GUN1). `fetchBytes` is the test's door. */
export function installPistoletIcons({ fetchBytes = null } = {}) {
  if (_installed && vendorTextureCount() > 0) return 0;
  _installed = true;
  const load = fetchBytes ?? (async (name) => {
    const r = await fetch(iconUrl(name));
    if (!r.ok) throw new Error(`${name}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  });
  return addVendorTextures(ICON_FILES.map(({ archive, record, frame, file, offset }) => ({
    archive, record, frame, fileName: file, standIn: true, offset, load: () => load(file),
  })));
}

// ── HOW YOU GET ONE ──────────────────────────────────────────────────
//
// The Thunderlock's way exactly (its file says why): never on a shelf - a custom template is in no shop's group table,
// and shopStock.js shelves the Pellet alone - and a UNIQUE FIND of its own, from source tier 4 up, arriving loaded.
// The owner, the same day: "make the thunderlock in general more rare along with the new hand cannon" - both finds weigh
// the Thunderlock's FIND_WEIGHT, half its old 1, so the two guns together turn up about as often as the Thunderlock alone
// did.
export { FIND_WEIGHT };
registerUniqueFind({
  id: 'dwarven-pistolet',
  minTier: FIND_MIN_TIER,
  weight: FIND_WEIGHT,
  mint: (rolls = Math.random) => {
    const n = FIND_PELLETS.min + Math.floor(rolls() * (FIND_PELLETS.max - FIND_PELLETS.min + 1));
    return [createPistolet(), createPellets(n)];
  },
});

// ── THE SOUND ────────────────────────────────────────────────────────
//
// The Thunderlock's door (AUDIT-THUNDERLOCK F8): three clips registered under string keys through the mod-sound door, so
// the rig plays `pistolet:fire` and no host learns the weapon has sounds. The files are the owner's three picks off the
// lab's panel, read from the one row that holds them (combat/gun/gunFeel.js PISTOLET_FEEL.sfx) - the pistol lab's
// dropdowns open on the same row, so the audition and the game cannot disagree.
export const SFX = Object.freeze({ fire: 'pistolet:fire', open: 'pistolet:open', close: 'pistolet:close' });
export const SFX_FILES = Object.freeze({
  [SFX.fire]: `${PISTOLET_FEEL.sfx.fire}.wav`,
  [SFX.open]: `${PISTOLET_FEEL.sfx.open}.wav`,
  [SFX.close]: `${PISTOLET_FEEL.sfx.close}.wav`,
});
export const sfxUrl = (file) => new URL(`sfx/${file}`, APP_ROOT ?? globalThis.document?.baseURI ?? 'http://localhost/').href;

let _sounds = null;
/** Register the three clips, once. Answers how many took. */
export function installPistoletSounds(audio, { fetchBytes = null } = {}) {
  if (!audio?.registerSound) return Promise.resolve(0);
  return (_sounds ??= (async () => {
    const load = fetchBytes ?? (async (file) => {
      const r = await fetch(sfxUrl(file));
      if (!r.ok) throw new Error(`${file}: ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    let n = 0;
    for (const [key, file] of Object.entries(SFX_FILES)) {
      try { if (await audio.registerSound(key, await load(file))) n++; } catch { /* the weapon still fires, silently */ }
    }
    return n;
  })());
}
