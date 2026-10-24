// ENDLESS-ARROWS (2026-10-23, the owner: "give general stores always arrows for each player to buy they cant exhaust"):
// A GENERAL STORE'S QUIVER NEVER EMPTIES (systems/shopStock.js) - a whole quiver on its counter at any quality, filled
// back after every purchase that takes arrows, offline and online; every other storefront's sells out as SHOP-ARROWS says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stockShopShelf, restockEndless, shopArrowStack, endlessArrowsAt, GENERAL_STORE_ARROWS, SHOP_ARROWS_MAX } from '../../src/systems/shopStock.js';
import { BUILDING_TYPES as B } from '../../src/world/buildingNames.js';
import { ARROW_TEMPLATE } from '../../src/systems/inventory.js';

const arrows = (items) => items.filter((it) => it.group === 'Weapons' && it.templateIndex === ARROW_TEMPLATE);
const count = (items) => arrows(items).reduce((n, it) => n + (it.stackCount ?? 1), 0);
const stock = (b, q, shelfIndex = 0) => stockShopShelf({ buildingType: b, quality: q }, { level: 5 }, { rolls: () => 0.999, shelfIndex, torchesFromItems: false });

test('ENDLESS-ARROWS: a General Store\'s counter holds a whole quiver at any quality; the shelves behind it none of their own, and the other storefronts their SHOP-ARROWS stack (mutants: the quality\'s stack; every shop endless)', () => {
  assert.equal(GENERAL_STORE_ARROWS, SHOP_ARROWS_MAX);
  assert.equal(endlessArrowsAt(B.GeneralStore), true);
  for (const b of [B.WeaponSmith, B.Armorer, B.PawnShop, B.Alchemist]) assert.equal(endlessArrowsAt(b), false, `building ${b}`);
  for (const q of [1, 9, 20]) assert.equal(count(stock(B.GeneralStore, q)), GENERAL_STORE_ARROWS, `quality ${q}`);
  assert.equal(count(stock(B.GeneralStore, 9, 1)), 0, 'a shelf behind the counter');
  assert.equal(count(stock(B.Armorer, 9)), shopArrowStack(B.Armorer, 9));
});

test('ENDLESS-ARROWS: a purchase that takes arrows fills a General Store\'s quiver back - part of it or all of it, offline - and nothing else\'s; a lot with no arrows leaves it (mutants: offline left out; another shop filled; the fill past a lot with no arrows)', () => {
  const shelf = stock(B.GeneralStore, 5);
  const [quiver] = arrows(shelf);
  quiver.stackCount -= 30;
  const bought = { ...quiver, stackCount: 30 };
  assert.equal(restockEndless(shelf, [bought], B.GeneralStore), 1);
  assert.equal(count(shelf), GENERAL_STORE_ARROWS, 'part of it: filled back');
  shelf.splice(shelf.indexOf(quiver), 1);
  assert.equal(restockEndless(shelf, [quiver], B.GeneralStore), 1);
  assert.equal(count(shelf), GENERAL_STORE_ARROWS, 'all of it: a fresh quiver stood');
  const [fresh] = arrows(shelf);
  assert.deepEqual([fresh.material, fresh.value > 0, fresh.name], [quiver.material, true, quiver.name], 'minted as the shelf mints its own');
  fresh.stackCount = 10;
  assert.equal(restockEndless(shelf, [{ group: 'Weapons', templateIndex: 113 }], B.GeneralStore), 0, 'a dagger bought: the quiver untouched');
  assert.equal(count(shelf), 10);
  const armorer = stock(B.Armorer, 5);
  const [aq] = arrows(armorer);
  armorer.splice(armorer.indexOf(aq), 1);
  assert.equal(restockEndless(armorer, [aq], B.Armorer), 0);
  assert.equal(count(armorer), 0, 'an Armorer\'s sells out');
  assert.equal(restockEndless(shelf, [quiver]), 0, 'no shop named: nothing filled');
});

test('ENDLESS-ARROWS wired (by source): the counter\'s commit and the keyed list both name their shop to restockEndless (mutants: the commit unnamed)', () => {
  const w = readFileSync(new URL('../../src/scenes/worldModes.js', import.meta.url), 'utf8');
  assert.match(w, /guildFactionId, buildingType: b\.buildingType \}\),/);
  assert.match(w, /restockEndless\(shelf\.items, staged, asked\.buildingType\);/);
  assert.match(w, /restockEndless\(shelf\.items, \[it\], interiorBuilding\?\.buildingType\);/);
});
