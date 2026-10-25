// NAME-KEPT (FIELD BUGS 2026-10-25b item 1, `bible/01-Overview/bugs/Field-Bugs-2026-10-25b.md`). SaberGGaming, in
// #bug-reports: "if you've renamed your item it will revert it back into its original name like 'Sabers mule's ring
// of ...'". The Reforge (lootRarity.js reforgeAffix, one roll at the Mages Guild and with Essence) named the piece
// again from its TEMPLATE: a name the Item Maker gave (RenameItem) was lost, a Masterwork's own name (its maker's
// mark names it) took the ladder's words its mint withholds, and a crafted jewel lost its metal and gem ("Silver
// Ring" to "Ring"). Now a reforge moves only the words its lines gave the name. Every piece from its real producer
// (TEST THE SHAPE THE PRODUCER MINTS): the jeweller's mint, the Item Maker's window, the loot ladder.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setPref, _resetForTests } from '../../../src/systems/uiPrefs.js';
import * as LR from '../../../src/systems/loot/lootRarity.js';
import * as RF from '../../../src/systems/reforge.js';
import { mintPiece, reforgeItem } from '../../../src/systems/smithItems.js';
import { MINT_VERSION } from '../../../src/net/productRecord.js';
import { ItemMakerWindow } from '../../../src/ui/item/itemMakerWindow.js';
import { enchantmentSettings, PARAM_NONE } from '../../../src/systems/enchantmentCatalogue.js';
import { itemLongName } from '../../../src/systems/item/itemInfo.js';
import { welkyndShards } from '../../../src/systems/gate/gateSpoils.js';
import { mintCondition } from '../../../src/systems/item/itemTemplates.js';
import { createWeapon } from '../../../src/combat/enemyEquipment.js';
import { seededRng } from '../../../src/systems/wind/wind.js';

const on = () => { _resetForTests(); setPref('lootRarity', true); };
const PROV = '0123456789abcdef';
/** The jeweller's mint (smithItems.js mintPiece): Saber's ring at `quality` (3 Superior - Magic, 4 Masterwork - Rare). */
const ring = (quality, seed) => mintPiece({ recipe: 'ring:silver', quality, seed, maker: 'Saber', version: MINT_VERSION }, PROV);
/** A Masterwork Rare whose first line is carrying capacity, as the report's ring. */
const mule = () => { for (let s = 1; s < 500; s++) { const it = ring(4, s); if (it.affixes[0].id === 'weight') return it; } return null; };
/** The words a piece's lines put around its name, off the kinds' own words (nameAround's law). */
const words = (it) => {
  const own = it.affixes.filter((a) => a.gem == null && !LR.AFFIX_KINDS[a.id].proc);
  const at = (slot) => own.find((a) => LR.AFFIX_KINDS[a.id].slot === slot);
  return { pre: at('prefix') ? LR.affixWord(at('prefix'), it.rarity) : null, suf: at('suffix') ? LR.affixWord(at('suffix'), it.rarity) : null };
};
/** Every reforgeable line pressed once, at the Mages Guild and with Essence by turns; each press's piece handed to `seen`. */
function reforgeEvery(it, seen) {
  const me = { items: [it, welkyndShards(999)], goldPieces: 100_000_000 };
  for (const [k, i] of LR.reforgeableLines(it).entries()) {
    const was = it.affixes[i];
    const line = k % 2 ? reforgeItem(it, i, 1000 + k) : RF.reforgePiece(it, i, me, seededRng(k + 1)).line;
    assert.ok(line && line.id !== was.id, `line ${i} replaced (${was.id} -> ${line?.id})`);
    seen(it);
  }
}

test('NAME-KEPT: the report - Saber\'s Masterwork ring, given its own name at the Item Maker, keeps that name through every reforge, at the Guild and with Essence (mutants: the old law; a prefix or a suffix not checked)', () => {
  on();
  const it = mule();
  assert.ok(it, 'a Masterwork Rare ring of the jeweller\'s mint, carrying capacity its first line');
  assert.deepEqual([it.rarity, it.name, itemLongName(it)], ['rare', 'Silver Ring', "Saber's Silver Ring"], 'the mark names a Masterwork');
  const player = { items: [it], goldPieces: 10_000_000 };
  const w = new ItemMakerWindow({ player, entity: player, packItems: () => player.items });
  w._selectItem(it);
  w.itemName = 'Ward of the Wanderer';
  w.powers = [enchantmentSettings('FeatherWeight', PARAM_NONE)];
  w._enchant();
  assert.deepEqual([it.name, itemLongName(it)], ['Ward of the Wanderer', "Saber's Ward of the Wanderer"], 'RenameItem (DaggerfallItemMakerWindow.cs:761): the name the player gave');
  reforgeEvery(it, (p) => assert.deepEqual([p.name, itemLongName(p)], ['Ward of the Wanderer', "Saber's Ward of the Wanderer"], 'the player\'s name stands'));
  assert.ok(it.reforges >= 3, `${it.reforges} reforges`);
  // a name that keeps the lines' suffix and drops their prefix ("Mule's") is the player's too
  const half = mule();
  const { pre, suf } = words(half);
  assert.ok(pre != null && suf != null, `${pre} / ${suf}`);
  half.name = `Lucky Band ${suf}`;
  reforgeEvery(half, (p) => assert.equal(p.name, `Lucky Band ${suf}`));
});

test('NAME-KEPT: a Masterwork\'s own name - its mark\'s, which takes none of the ladder\'s words - is never given them by a reforge; nor a crafted jewel its metal taken ("Silver Ring" is not "Ring")', () => {
  on();
  for (let s = 1; s <= 20; s++) {
    const it = ring(4, s);
    assert.equal(it.name, 'Silver Ring');
    reforgeEvery(it, (p) => assert.equal(itemLongName(p), "Saber's Silver Ring", `seed ${s}`));
  }
});

test('NAME-KEPT: a name the ladder gave still follows its lines - a Superior ring\'s words move and its "Silver Ring" stays; a found piece is named as rarityName names it (mutants: the old law; the rest of the name not cut out)', () => {
  on();
  let moved = 0;
  for (let s = 1; s <= 40; s++) {
    const it = ring(3, s);
    assert.equal(it.rarity, 'magic');
    reforgeEvery(it, (p) => {
      const { pre, suf } = words(p);
      assert.equal(p.name, [pre, 'Silver Ring', suf].filter((x) => x != null).join(' '), `seed ${s}: ${p.name}`);
      moved++;
    });
  }
  assert.ok(moved >= 40, `${moved} reforges`);
  for (let s = 1; s <= 40; s++) {
    const found = Object.assign(LR.applyRarity(mintCondition({ group: 'Jewellery', templateIndex: 135, name: 'Ring', flags: 0 }), s % 2 ? 'rare' : 'magic', seededRng(s)), { isIdentified: true });
    reforgeEvery(found, (p) => assert.equal(p.name, LR.rarityName(p, p.rarity, p.affixes), `a found ${p.rarity}: ${p.name}`));
  }
});

test('NAME-KEPT: a name an older reforge built with a set gem\'s word (AUDIT GEM: "Soldier\'s" off a Diamond) is still the ladder\'s - the next reforge names it by the piece\'s own lines alone (mutants: either read out; the gem\'s word back in)', () => {
  on();
  LR._setSocketForTests(1000);
  try {
    let checked = 0;
    for (let s = 1; s <= 400 && checked < 10; s++) {
      const it = Object.assign(LR.applyRarity(createWeapon(120, 1), 'rare', seededRng(s)), { isIdentified: true });
      if (words(it).pre != null || words(it).suf == null) continue;   // a sword whose own lines give a suffix and no prefix
      LR.socketPass([it], () => 0);
      if (!LR.setGem(it, 'diamond')) continue;
      const gem = it.affixes.find((a) => a.gem != null);
      assert.equal(LR.AFFIX_KINDS[gem.id].slot, 'prefix', 'a Diamond in a blade: its damage, a prefix');
      const gemWord = LR.affixWord(gem, it.rarity);
      it.name = LR.rarityName(it, it.rarity, it.affixes);   // the old reforge's name (`rarityName(item, tier, item.affixes)`, gems and all)
      assert.ok(it.name.startsWith(`${gemWord} `), it.name);
      const i = LR.reforgeableLines(it).find((j) => LR.AFFIX_KINDS[it.affixes[j].id].slot === 'suffix');
      assert.ok(RF.reforgePiece(it, i, { items: [it, welkyndShards(99)], goldPieces: 99_999 }, seededRng(s)).ok);
      assert.equal(it.name, LR.rarityName(it, it.rarity, it.affixes.filter((a) => a.gem == null)), `seed ${s}: named by its own lines`);
      assert.ok(!it.name.startsWith(`${gemWord} `) || words(it).pre === gemWord, `seed ${s}: never the gem's word (${it.name})`);
      // and a name of the law now (its own lines alone) beside the gem's line, reforged again: still its own lines'
      const j = LR.reforgeableLines(it).at(-1);
      assert.ok(RF.reforgePiece(it, j, { items: [it, welkyndShards(99)], goldPieces: 99_999 }, seededRng(s + 1000)).ok);
      assert.equal(it.name, LR.rarityName(it, it.rarity, it.affixes.filter((a) => a.gem == null)), `seed ${s}: again, by its own lines`);
      checked++;
    }
    assert.ok(checked >= 3, `${checked} swords`);
  } finally { LR._setSocketForTests(null); }
});
