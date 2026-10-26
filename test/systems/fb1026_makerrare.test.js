// MAKER-RARE (FIELD BUGS 2026-10-26, the owner: "You cant enchant masterwork/rare armor";
// `bible/01-Overview/bugs/Field-Bugs-2026-10-26.md`). A Rare - a loot door's or a Masterwork's - carries one of DFU's
// catalogue enchantments as its flavour, and DFU's item maker refuses an enchanted item (AddFilteredItem :419-422), so
// every Rare was out of every tab. The maker takes an identified Rare with the ladder's rows kept and riding free.
// Every fixture from its real producer (TEST THE SHAPE THE PRODUCER MINTS): the smith's mint, the ladder's roll and curse.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref } from '../../src/systems/uiPrefs.js';
import { mintPiece } from '../../src/systems/smithItems.js';
import { MASTERWORK } from '../../src/net/recipeLaw.js';
import { applyRarity, cursePiece, legendariesFor } from '../../src/systems/loot/lootRarity.js';
import { liftCurse } from '../../src/systems/loot/lootCurse.js';
import { armorOfMaterial, ARMOR_ENUM, createWeapon } from '../../src/combat/enemyEquipment.js';
import { ARMOR_MATERIAL } from '../../src/systems/armorMaterials.js';
import { WEAPON_MATERIALS } from '../../src/characters/weapons.js';
import { createRandomClothing } from '../../src/systems/loot/loot.js';
import { setItemFields, mintCondition } from '../../src/systems/item/itemTemplates.js';
import { keptEnchantments, rareKeeps, enchantDecision, applyEnchantments, itemEnchantmentPower } from '../../src/systems/enchanting.js';
import { enchantmentSettings, primaryPick, isSideEffect } from '../../src/systems/enchantmentCatalogue.js';
import { ENCHANTMENT_TYPES as T } from '../../src/systems/enchantments.js';
import { ItemMakerWindow, itemMakerFilter, TAB_PAGES } from '../../src/ui/item/itemMakerWindow.js';
import { itemFindings } from '../../src/systems/item/itemLaw.js';

const PROV = '0123456789abcdef';
const lcg = (s) => () => ((s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 4294967296);
const listedOn = (item) => TAB_PAGES.filter((tab) => itemMakerFilter(item, tab));
const ARMOR = enchantmentSettings('StrengthensArmor', -1);   // 700 of the maker's points
/** The Mages Guild's Identify, as the trade window writes it (tradeModes.js itemIsIdentified reads the flag). */
const identified = (item) => Object.assign(item, { isIdentified: true });

test('MAKER-RARE, the report: a Masterwork Daedric Cuirass is on the item maker\'s list, its Rare roll kept at the list\'s head and costing none of its 1,200 points; enchanted, the new row lands after it, the gold paid, and the item law finds nothing; back again, the maker\'s own row costs and the roll still rides free', () => {
  const mw = mintPiece({ recipe: 'cuirass:daedric', quality: MASTERWORK, seed: 1, maker: 'X' }, PROV);
  assert.deepEqual([mw.rarity, mw.isIdentified, mw.enchantments], ['rare', true, [{ type: T.CastWhenHeld, param: 41 }]], 'a Masterwork\'s Rare roll: Water Walking when held');
  assert.equal(itemEnchantmentPower(mw), 1200);
  assert.deepEqual(listedOn(mw), ['WeaponsAndArmor']);
  assert.deepEqual(keptEnchantments(mw).map((e) => [e.type, e.param, e.enchantCost, e.kept]), [['CastWhenHeld', 41, 0, true]]);
  const player = { goldPieces: 100_000, items: [mw] };
  const w = new ItemMakerWindow({ player, packItems: () => player.items });
  w.tab = 'WeaponsAndArmor';
  assert.deepEqual(w.items(), [mw]);
  w._selectItem(mw);
  assert.deepEqual([w.labels().enchantmentCost, w.labels().goldCost], ['0/1200', '0']);
  assert.deepEqual(w._lists().powers.map((e) => [e.type, e.kept]), [['CastWhenHeld', true]], 'the roll at the head of the powers');
  w.powers = [ARMOR];
  assert.deepEqual([w.labels().enchantmentCost, w.labels().goldCost], ['700/1200', '7000']);
  w._enchant();
  assert.deepEqual(mw.enchantments.map((e) => [e.type, e.param]), [[T.CastWhenHeld, 41], [T.StrengthensArmor, -1]], 'the roll kept, the new row after it');
  assert.equal(player.goldPieces, 93_000);
  assert.deepEqual(itemFindings(mw), [], 'the item law: lawful');
  assert.deepEqual(listedOn(mw), ['WeaponsAndArmor'], 'listed again');
  w._selectItem(mw);
  assert.equal(w.labels().enchantmentCost, '700/1200', 'the maker\'s row costs; the roll rides free');
});

test('MAKER-RARE: a found Rare is out while unidentified - the maker would show its rows and identify it for nothing - and on its tab once identified, of every group a Rare rolls on; a Legendary, DFU\'s own magic, an artifact and a Rare carrying a row its ladder never rolled stay refused as DFU refuses them', () => {
  setPref('lootRarity', true);
  const helm = applyRarity(armorOfMaterial(ARMOR_ENUM.Helm, ARMOR_MATERIAL.Ebony), 'rare', lcg(5));
  assert.deepEqual([helm.rarity, helm.enchantments, helm.isIdentified], ['rare', [{ type: T.CastWhenHeld, param: 42 }], undefined], 'a drop: Water Breathing, unidentified');
  assert.deepEqual([listedOn(helm), keptEnchantments(helm), rareKeeps(helm)], [[], null, false]);
  identified(helm);
  assert.deepEqual([listedOn(helm), keptEnchantments(helm).map((e) => e.enchantCost)], [['WeaponsAndArmor'], [0]]);
  const rep = enchantmentSettings('BadRepWith', 0);   // a side effect the player takes: it buys 1,000 points
  const d = enchantDecision(helm, [ARMOR], [rep], { gold: 10 ** 9 });
  assert.deepEqual([d.kind, d.cost, d.power], ['enchant', -300, 1800]);
  applyEnchantments(helm, [ARMOR, rep]);
  assert.deepEqual(itemFindings(helm), []);
  // the maker's rows are its own: back again, the side effect still buys its points and the piece is on the list
  assert.deepEqual([listedOn(helm), keptEnchantments(helm).map((e) => e.enchantCost)], [['WeaponsAndArmor'], [0, 700, -1000]]);
  // every group a Rare rolls on, on its own tab
  const sword = identified(applyRarity(createWeapon(120, WEAPON_MATERIALS.Ebony), 'rare', lcg(4)));
  const ring = identified(applyRarity(mintCondition(setItemFields({ group: 'Jewellery', templateIndex: 135 })), 'rare', lcg(4)));
  const robe = identified(applyRarity(mintCondition(setItemFields(createRandomClothing('female', lcg(8)))), 'rare', lcg(4)));
  assert.deepEqual([sword, ring, robe].map((it) => [it.group, it.enchantments.length, listedOn(it)]),
    [['Weapons', 1, ['WeaponsAndArmor']], ['Jewellery', 1, ['ClothingAndMisc']], ['WomensClothing', 1, ['ClothingAndMisc']]]);
  // the refusals
  const base = armorOfMaterial(ARMOR_ENUM.Helm, ARMOR_MATERIAL.Ebony);
  const leg = identified(applyRarity(base, 'legendary', lcg(2), legendariesFor(base)));
  assert.deepEqual([leg.rarity, leg.name, leg.enchantments.length], ['legendary', 'Titanheart', 1]);
  const extra = { ...helm, enchantments: [{ type: T.CastWhenHeld, param: 42 }, { type: T.CastWhenHeld, param: 41 }] };
  for (const it of [leg, { ...helm, magic: true }, { ...helm, artifact: true }, extra]) {
    assert.deepEqual([listedOn(it), keptEnchantments(it)], [[], null], it.name);
  }
  // a crafted jewel keeps J2's law: its roll drawn among those its points hold (J4), and costed
  const jewel = mintPiece({ recipe: 'mark:platinum:diamond', quality: MASTERWORK, seed: 1, maker: 'X' }, PROV);
  assert.deepEqual([keptEnchantments(jewel)[0].enchantCost, keptEnchantments({ ...jewel, provenance: undefined })[0].enchantCost], [150, 0]);
});

test('MAKER-RARE: a cursed Rare is taken with its curse - the drawback kept among the side effects and riding free, never buying points; its setting is never offered again, so the temple\'s lift after the maker takes the curse\'s own row, and the piece stays lawful and on the list', () => {
  setPref('lootRarity', true);
  const cu = applyRarity(armorOfMaterial(ARMOR_ENUM.Cuirass, ARMOR_MATERIAL.Daedric), 'rare', lcg(9));
  assert.equal(cursePiece(cu, lcg(3)), true);
  identified(cu);
  assert.deepEqual([cu.enchantments, cu.cursed], [[{ type: T.RegensHealth, param: 2 }, { type: T.ItemDeteriorates, param: 2 }], { type: T.ItemDeteriorates, param: 2 }], 'Regens Health in darkness, and Item Deteriorates in holy places');
  assert.equal(itemEnchantmentPower(cu), 1200, 'a flavour of 3,000 on 1,200 points: counted, this piece could never take a row');
  const kept = keptEnchantments(cu);
  assert.deepEqual(kept.map((e) => [e.type, e.param, e.enchantCost, isSideEffect(e.type)]), [['RegensHealth', 2, 0, false], ['ItemDeteriorates', 2, 0, true]]);
  assert.ok(enchantmentSettings('ItemDeteriorates', 2).enchantCost < 0, 'the drawback chosen at the maker buys points - kept, it buys none');
  assert.equal(enchantDecision(cu, [ARMOR], [], { gold: 10 ** 9 }).cost, 700);
  const player = { goldPieces: 100_000, items: [cu] };
  const w = new ItemMakerWindow({ player, packItems: () => player.items });
  w.tab = 'WeaponsAndArmor';
  w._selectItem(cu);
  const all = w._lists();
  assert.deepEqual(all.sideEffects.map((e) => [e.type, e.param, e.kept]), [['ItemDeteriorates', 2, true]]);
  assert.ok(!primaryPick('ItemDeteriorates', { ...all, selectingPowers: false }).options.some((o) => o.param === 2), 'the curse\'s setting is not offered again');
  w.powers = [ARMOR];
  w._enchant();
  assert.deepEqual(cu.enchantments.map((e) => [e.type, e.param]), [[T.RegensHealth, 2], [T.ItemDeteriorates, 2], [T.StrengthensArmor, -1]]);
  assert.deepEqual(itemFindings(cu), []);
  assert.deepEqual(liftCurse(cu, player).ok, true);
  assert.deepEqual(cu.enchantments.map((e) => [e.type, e.param]), [[T.RegensHealth, 2], [T.StrengthensArmor, -1]], 'the curse\'s own row lifted, the maker\'s kept');
  assert.deepEqual([itemFindings(cu), listedOn(cu)], [[], ['WeaponsAndArmor']]);
});
