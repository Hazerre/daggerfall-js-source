// FIRST-BUDGET (2026-10-25, SaberGGaming's report: "Provisioning is slow"; the owner: "No band aids") - A TRACK'S
// DISCOVERIES SHARE ONE FIXED BUDGET (net/recipeLaw.js DISCOVERY_BUDGET, firstMakesOf, firstMakeXp, firstCraftXp,
// workFirstXp, brewFirstXp). Every first-make paid a flat 500, every track alike, and the tracks' pools differ tenfold;
// now each crafting track's first-makes together pay Smithing's whole pool, 110,500 - Smithing unchanged, the slower
// tracks risen. Pinned here: the budget, each track's count and sum, every share, the keys the service keys a first by,
// the words that say it and the pace it makes (tools/craftPace.mjs) - through the real Worker. bible/06-Systems/
// Professions-Arc.md 50.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService } from '../accountDb.mjs';
import {
  DISCOVERY_BUDGET, firstMakesOf, firstMakeXp, firstCraftXp, workFirstXp, brewFirstXp, firstCraftKey, firstCraftKin, firstCraftPays,
  RECIPES, recipeById, COOKING_RECIPES, craftXp, cookXp,
} from '../../src/net/recipeLaw.js';
import { MASON_RECIPES, WORK_RECIPES, PROFESSIONS, trackOf, xpForRank } from '../../src/net/professionLaw.js';
import { POTIONS, potionById, brewFirstPays } from '../../src/net/alchemyLaw.js';
import { craftXpLine, dishFirstLine, masonWorksFirstLine } from '../../src/ui/craftXpWords.js';
import { craftPace } from '../../tools/craftPace.mjs';

const sum = (track) => firstMakesOf(track).reduce((n, k) => n + firstMakeXp(track, k), 0);
const shares = (track) => {
  const out = {};
  for (const k of firstMakesOf(track)) out[firstMakeXp(track, k)] = (out[firstMakeXp(track, k)] ?? 0) + 1;
  return out;
};

test('FIRST-BUDGET the law: the budget is Smithing\'s whole pool at the 500 it paid (221 x 500 = 110,500); each crafting track\'s first-makes sum to it exactly - Smithing 221 at 500 (unchanged), Outfitting 180 (160 at 614, 20 at 613), Building 43 (33 at 2,570, 10 at 2,569), Provisioning 22 (16 at 5,023, 6 at 5,022); Enchanting and the gathering tracks none (mutants: the budget moved; the remainder dropped; the remainder to the last; a work counted that pays none; a smelt counted; the counter\'s goods counted; a brew of the Apothecaries\' goods alone counted)', () => {
  assert.equal(DISCOVERY_BUDGET, 110_500);
  assert.equal(DISCOVERY_BUDGET, firstMakesOf('smithing').length * 500, 'Smithing\'s pool at the 500 it always paid - no track loses');
  assert.deepEqual(['smithing', 'outfitting', 'building', 'provisioning'].map((t) => firstMakesOf(t).length), [221, 180, 43, 22]);
  for (const t of ['smithing', 'outfitting', 'building', 'provisioning']) assert.equal(sum(t), DISCOVERY_BUDGET, `${t}: its first-makes sum to the budget`);
  assert.deepEqual(shares('smithing'), { 500: 221 }, 'Smithing\'s per-make unchanged');
  assert.deepEqual(shares('outfitting'), { 613: 20, 614: 160 });
  assert.deepEqual(shares('building'), { 2569: 10, 2570: 33 });
  assert.deepEqual(shares('provisioning'), { 5022: 6, 5023: 16 }, 'Provisioning\'s 110,500 over its 22');
  // the remainder one XP each to the first in the tables' order
  const prov = firstMakesOf('provisioning');
  assert.deepEqual(prov.map((k) => firstMakeXp('provisioning', k)), [...Array(16).fill(5023), ...Array(6).fill(5022)]);
  assert.deepEqual(prov, ['stew@1', 'supper@1', 'tart@2', 'feast@6', ...POTIONS.filter(brewFirstPays).map((p) => p.id)], 'the dishes\' patterns, then DFU\'s twenty less the two of the Apothecaries\' goods alone');
  // a discipline answers its craft's track
  assert.deepEqual([firstMakesOf('cooking'), firstMakesOf('alchemy'), firstMakesOf('jewelcrafting').length, firstMakesOf('masonry').length, firstMakesOf('carpentry').length], [prov, prov, 221, 43, 43]);
  for (const t of PROFESSIONS.filter((p) => trackOf(p.id) === p.id && !['smithing', 'outfitting', 'building', 'provisioning'].includes(p.id))) {
    assert.deepEqual(firstMakesOf(t.id), [], `${t.id}: no first-make, no budget`);
  }
  assert.deepEqual([firstMakeXp('provisioning', 'nothing@1'), firstMakeXp('smithing', 'stew@1'), firstMakeXp('enchanting', 'stew@1')], [0, 0, 0], 'a key none of the track\'s pays none');
});

test('FIRST-BUDGET the keys the service keys a first by: a recipe its pattern at its tier (its kin one first, one share), a mason\'s work its id, a brew its potion - each only where its first pays (AUDIT 32 S1: the Weavers\' cloth alone, the Apothecaries\' goods alone none); a smelt pays no first (mutants: the kin split; the counter\'s guard dropped; a smelt\'s first; the brew keyed by its name)', () => {
  for (const r of RECIPES) {
    const want = firstCraftPays(r) ? firstMakeXp(r.profession, firstCraftKey(r)) : 0;
    assert.equal(firstCraftXp(r), want, r.id);
    if (firstCraftPays(r)) assert.ok(want > 0, `${r.id}: its pattern in its track's pool`);
    for (const id of firstCraftKin(r)) assert.equal(firstCraftXp(recipeById(id)), want, `${r.id}: its kin ${id} one share`);
  }
  assert.deepEqual(['garment-141:linen', 'rug-237:wool', 'fishingnet:linen'].map((id) => firstCraftXp(recipeById(id))), [0, 0, 0], 'the Weavers\' cloth alone');
  assert.deepEqual([firstCraftXp(null), workFirstXp(null), brewFirstXp(null)], [0, 0, 0]);
  assert.deepEqual(MASON_RECIPES.map((w) => [w.id, workFirstXp(w)]), [['cut:stone', 2569], ['mix:mortar', 2569]], 'the bench\'s two works, the last of Building\'s pool - each the same share, as the bench\'s line says');
  assert.deepEqual(WORK_RECIPES.filter((w) => !w.act).map((w) => workFirstXp(w)).filter((x) => x !== 0), [], 'a smelt, a burn, a saw, a cure, a weave, a transmutation: no first');
  assert.deepEqual(POTIONS.map((p) => brewFirstXp(p) > 0), POTIONS.map((p) => brewFirstPays(p)), 'a brew\'s first where it pays');
  assert.deepEqual([brewFirstXp(potionById('healing')), brewFirstXp(potionById('purification')), brewFirstXp(potionById('waterBreathing')), brewFirstXp(potionById('levitation'))], [5022, 5023, 0, 0]);
  assert.deepEqual(COOKING_RECIPES.map((r) => firstCraftXp(r)), Array(COOKING_RECIPES.length).fill(5023), 'every dish its pattern\'s, either herb\'s way');
  assert.deepEqual([firstCraftXp(recipeById('longsword:daedric')), firstCraftXp(recipeById('ring:gold:ruby')), firstCraftXp(recipeById('staff:pine')), firstCraftXp(recipeById('garment-149:linen'))], [500, 500, 2570, 614]);
});

test('FIRST-BUDGET the words say it: the anvil\'s, the workbench\'s and the loom\'s line, the fire\'s and the mason\'s bench\'s say the first\'s share, its thousands grouped (mutants: the 500 back in a line; the share unformatted)', () => {
  assert.equal(craftXpLine(recipeById('dagger:iron'), 0, 'Smithing'), '20 Smithing experience, and 500 more the first time you make this piece at this grade.');
  assert.equal(craftXpLine(recipeById('staff:pine'), 0, 'Building'), '20 Building experience, and 2,570 more the first time you make this piece at this grade.');
  assert.equal(craftXpLine(recipeById('leather-boots:cured'), 10, 'Outfitting'), '40 Outfitting experience, and 614 more the first time you make this piece at this grade.');
  assert.equal(dishFirstLine(recipeById('stew:north'), 'Provisioning'), 'The first time you cook this dish: 5,023 more Provisioning experience.');
  assert.equal(masonWorksFirstLine(0, 'Building'), 'Your first cut and your first mix each earn 2,569 more Building experience.');
});

test('FIRST-BUDGET the pace it makes (tools/craftPace.mjs): crafts to Journeyman and to Master, every act at its best, clean where it can be - Smithing 45 and 172 as it was; Outfitting 116 and 246 then, 74 and 181 now; Building 116 and 525 then, 10 and 39; Provisioning 178 and 599 then, 5 and 20 (mutants: the budget moved; Provisioning\'s shares Smithing\'s)', () => {
  const pace = (p) => Object.fromEntries(Object.entries(p).map(([t, v]) => [t, [v.journeyman, v.master]]));
  assert.deepEqual(pace(craftPace(500)), { smithing: [45, 172], building: [116, 525], outfitting: [116, 246], provisioning: [178, 599] }, 'the flat 500, as the report measured it');
  assert.deepEqual(pace(craftPace()), { smithing: [45, 172], building: [10, 39], outfitting: [74, 181], provisioning: [5, 20] }, 'the budget: Smithing unchanged, every slower track faster');
});

test('FIRST-BUDGET DONE WHEN, through the real Worker: Provisioning\'s first brew pays 20 and its 5,022 and its first dish 20 and its 5,023, a second of either its own XP alone; Smithing\'s first piece its 500 as ever; Building\'s first cut its 2,569; Outfitting\'s first Linen Boots its 614 (mutants: the service\'s binds the old 500; a brew\'s first unpaid)', async () => {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.seated('Mac');
  const give = (m, n) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).run(mac.id, mac.character, m, n);
  const setXp = (prof, xp) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp`).run(mac.id, mac.character, prof, xp);
  let n = 0;
  const rid = () => `firstbudget-${++n}`;
  const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];
  const brew = async () => {
    for (const k of HEALING) give(k, 1);
    return s.call('/v1/prof/brew', { character: mac.character, potion: 'healing', keys: HEALING, rid: rid() }, mac.secret);
  };
  const craft = async (id) => {
    for (const i of recipeById(id).inputs) give(i.key, i.n);
    return s.call('/v1/prof/craft', { character: mac.character, recipe: id, clean: false, name: 'Mac', rid: rid() }, mac.secret);
  };
  const b1 = await brew();
  assert.equal(b1.status, 200, JSON.stringify(b1.body));
  assert.deepEqual([b1.body.first, b1.body.xp], [true, 20 + 5022], 'the first Healing: its share of Provisioning\'s budget');
  setXp('provisioning', 0);
  const b2 = await brew();
  assert.deepEqual([b2.body.first, b2.body.xp], [false, 20], 'the second: its own XP alone');
  const d1 = await craft('stew:north');
  assert.deepEqual([d1.status, d1.body.first, d1.body.xp], [200, true, cookXp(0) + 5023], JSON.stringify(d1.body));
  setXp('provisioning', 0);
  const d2 = await craft('stew:south');
  assert.deepEqual([d2.body.first, d2.body.xp], [false, cookXp(0)], 'the southern Stew is the same dish: no second first');
  const sword = await craft('dagger:iron');
  assert.deepEqual([sword.status, sword.body.first, sword.body.xp], [200, true, craftXp(1, 0) + 500], 'Smithing\'s 500, as it was');
  const boot = await craft('garment-149:linen');
  assert.deepEqual([boot.status, boot.body.first, boot.body.xp], [200, true, craftXp(1, 0) + 614], JSON.stringify(boot.body));
  give('stone:rough', 2);
  const cut = await s.call('/v1/prof/smelt', { character: mac.character, recipe: 'cut:stone', count: 1, rid: rid() }, mac.secret);
  assert.deepEqual([cut.status, cut.body.first, cut.body.xp, cut.body.track.xp], [200, true, 20 + 2569, 20 + 2569], JSON.stringify(cut.body));
  assert.equal(xpForRank(50), 25_000, 'Journeyman, the record\'s measure');
});
