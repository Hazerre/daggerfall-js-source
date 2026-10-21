// FIELD BUGS 2026-10-21 DEX-HIDES (bible/01-Overview/bugs/Field-Bugs-2026-10-21.md), the Discord's #feature-feedback,
// Shines: "the variant bats and wolves I encountered have had no option for skinning." A body is skinned when Hunting's
// table names its foe (net/professionLaw.js hideOfFoe) - at the kill (scenes/huntHost.js createBodyStamps), in the body
// list and on the account service (server-account/src/professions.js harvestNode) alike - and the table named DFU's
// MobileTypes alone. Daggerfall Enemy Expansion's foes are numbered past them (256-290, a spawned foe's mobileType its
// id), so its Bat (260) and its Wolf (262) were never stamped, never listed and would have been refused. Each of the mod's
// animals is skinned now: its kin's hide, or one of three of their own.
import '../chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from '../accountDb.mjs';
import { HIDES, hideOfFoe, xpForRank, TIER_RANKS, ICON_HAIR, ICON_SCALES } from '../../src/net/professionLaw.js';
import { bodyKey } from '../../src/net/nodeLaw.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';
import { DEX_TABLE_TEXT } from '../../src/systems/enemyExpansion/dexTableText.js';
import { installEnemyExpansion, _resetEnemyExpansion } from '../../src/systems/enemyExpansion/dexInstall.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { clearCustomEnemies } from '../../src/characters/enemy/customEnemies.js';
import { makeEnemyEntity, _resetMintRowEditors } from '../../src/characters/enemy/enemyEntity.js';
import { createBodyStamps, huntPlan } from '../../src/scenes/huntHost.js';
import { templateByIndex } from '../../src/systems/item/itemTemplates.js';
import { materialCountLabel } from '../../src/systems/professions/profItems.js';
import { chainPlan } from '../../src/net/chainLaw.js';
import { PELTS, recipeById } from '../../src/net/recipeLaw.js';
import { corpseFood } from '../../src/systems/survival/loot.js';
import '../../src/systems/professions/profTemplates.js';

/** The mod's MonsterBase rows, as it ships them: [id, name, affinity]. */
const monsterRows = () => {
  const [head, ...lines] = DEX_TABLE_TEXT['MonsterBase.mdb.csv'].trim().split(/\r?\n/);
  const col = head.split(','), id = col.indexOf('ID'), name = col.indexOf('Name'), aff = col.indexOf('Affinity');
  return lines.map((l) => l.split(',')).map((c) => [Number(c[id]), c[name], c[aff]]);
};
const silent = () => {};

test('DEX-HIDES THE LAW: every Animal of the Enemy Expansion\'s own table is skinned - the Bat Bat Leather, the Blood Spider Spider Silk, the Mountain Lion a Tiger Pelt, the Land Dreugh a Dreugh Shell, the Wolf, the Snow Wolf and the Dog a Wolf Pelt, the Boar a Boar Hide, the Mudcrab Mudcrab Chitin - and no other of its rows (its Hell Hound is the mod\'s Daedra); the three new hides stand at 4.8\'s free ids, registered as templates, and counted as the Stores count them (mutants: a Wolf unnamed; the Bat unnamed; the Hell Hound skinned)', () => {
  const rows = monsterRows();
  assert.equal(rows.length, 35, 'the mod\'s 35 monsters, 256-290');
  const animals = rows.filter(([, , a]) => a === 'Animal');
  assert.deepEqual(animals.map(([id, name]) => [id, name, hideOfFoe(id)?.name ?? null]), [
    [260, 'Bat', 'Bat Leather'], [262, 'Wolf', 'Wolf Pelt'], [263, 'Snow Wolf', 'Wolf Pelt'], [267, 'Dog', 'Wolf Pelt'],
    [271, 'Blood Spider', 'Spider Silk'], [278, 'Boar', 'Boar Hide'], [279, 'Land Dreugh', 'Dreugh Shell'], [280, 'Mountain Lion', 'Tiger Pelt'],
    [281, 'Mudcrab', 'Mudcrab Chitin'],
  ]);
  for (const [id, name, a] of rows) if (a !== 'Animal') assert.equal(hideOfFoe(id), null, `${id} ${name} (${a})`);
  assert.equal(rows.find(([id]) => id === 264)?.[2], 'Daedra', 'the Hell Hound: the mod\'s Daedra');
  // the three of their own, each by its tier among the ten (a chain's works cheapest first), at 4.8's free ids
  assert.deepEqual(HIDES.map((h) => h.tier), [...HIDES.map((h) => h.tier)].sort((a, b) => a - b));
  for (const [key, id, name, tier] of [['hide:wolf', 667, 'Wolf Pelt', 2], ['hide:boar', 672, 'Boar Hide', 2], ['hide:mudcrab', 676, 'Mudcrab Chitin', 1]]) {
    const h = HIDES.find((x) => x.key === key);
    assert.deepEqual([h.templateIndex, h.name, h.tier], [id, name, tier], key);
    assert.equal(templateByIndex(id)?.name, name, `${id} registered`);
  }
  // the Stores' counts: a pelt and a hide counted, the chitin a mass as the Scorpion's
  assert.deepEqual(['hide:wolf', 'hide:boar', 'hide:mudcrab', 'hide:scorpion'].map((k) => materialCountLabel(k, 3)), ['Wolf Pelts', 'Boar Hides', 'Mudcrab Chitin', 'Scorpion Chitin']);
});

test('DEX-HIDES THE PRODUCER: the mod\'s own Bat and Wolf, minted as the game mints a foe (installEnemyExpansion, makeEnemyEntity), are stamped at the kill with their hide and tier, and the body\'s plan offers "Skin the Bat", "Skin the Wolf"; its Hell Hound none', (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); });
  installEnemyExpansion({ on: true, log: silent });
  const stamps = createBodyStamps({ nowMs: () => 20833 * 86_400_000, rand: (b) => b.fill(0xcd) });
  const plans = [];
  for (const id of [260, 262, 263, 267, 278, 280, 281]) {
    const e = makeEnemyEntity(id, ENEMY_BASICS[id], null, 1, () => 0.5);
    assert.equal(e.mobileType, id, 'a mod\'s foe is its id');
    const s = stamps.stamp(e);
    assert.ok(s, `${id} stamped`);
    assert.deepEqual([s.foe, s.hide, s.tier], [id, hideOfFoe(id).key, hideOfFoe(id).tier]);
    plans.push(huntPlan({ body: s, taken: false, counting: false, rank: TIER_RANKS[s.tier - 1], storesFull: () => false, high: 0 }));
  }
  assert.deepEqual(plans.map((p) => [p.verb, p.ready]), [
    ['Skin the Bat', true], ['Skin the Wolf', true], ['Skin the Snow Wolf', true], ['Skin the Dog', true], ['Skin the Boar', true], ['Skin the Mountain Lion', true], ['Skin the Mudcrab', true],
  ]);
  assert.equal(stamps.stamp(makeEnemyEntity(264, ENEMY_BASICS[264], null, 1, () => 0.5)), null, 'the Hell Hound: no hide');
});

test('DEX-HIDES THE SERVICE: the account service skins the mod\'s Wolf to a Wolf Pelt and its Bat to Bat Leather in the Stores, and refuses its Hell Hound as any foe no knife takes a hide from (prof-foe)', async () => {
  const DAY = 86_400, realNow = Date.now;
  const hourAt = (s) => Math.floor((((Math.floor(sharedClassicMinutes(s * 1000)) % 1440) + 1440) % 1440) / 60);
  let now = utcDay(T0) * DAY + 3600;
  while (hourAt(now) !== 12) now += 30;
  Date.now = () => now * 1000;
  try {
    const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
    const raw = s.env.DB._raw;
    const mac = await s.seated('Mac');
    raw.prepare('INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, NULL, NULL, ?)').run(mac.id, mac.character, 'hunting', xpForRank(10), now);
    let n = 0;
    const skin = (foe) => ({ character: mac.character, node: bodyKey({ day: utcDay(now), id: (++n).toString(16).padStart(12, '0') }), kind: 'hide', foe, act: { clean: false, torn: false }, at: now - 2, rid: `dexhide-${String(n).padStart(6, '0')}` });
    const stores = (m) => raw.prepare('SELECT qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ?').all(mac.id, mac.character, m).reduce((a, r) => a + Number(r.qty), 0);
    const wolf = await s.call('/v1/prof/harvest', skin(262), mac.secret);
    assert.equal(wolf.status, 200, JSON.stringify(wolf.body));
    assert.equal(wolf.body.material, 'hide:wolf');
    const bat = await s.call('/v1/prof/harvest', skin(260), mac.secret);
    assert.equal(bat.body.material, 'hide:bat', JSON.stringify(bat.body));
    assert.deepEqual([stores('hide:wolf'), stores('hide:bat')], [1, 1]);
    assert.deepEqual((await s.call('/v1/prof/harvest', skin(264), mac.secret)).body, { error: 'prof-foe' });
  } finally { Date.now = realNow; }
});

test('DEX-HIDES THE PAGE: Hunting\'s unlocks name every hide on its tier\'s line, the three new ones with them', async () => {
  const { unlocksOf } = await import('../../src/ui/professions/profPages.js');
  const lines = unlocksOf('hunting');
  for (const h of HIDES) assert.ok(lines.find(([, tier]) => tier === h.tier)?.[0].includes(h.name), `${h.name} on line ${h.tier}`);
});

// ── AUDIT FB1021 (bible/01-Overview/audits/Audit-Field-Bugs-2026-10-21.md) ──────────────────────────────────────────────

test('AUDIT FB1021 L2-1 A CHAIN SPENDS THE SPARE PELTS FIRST: asked for Cured Leather with Bear Hides, Wolf Pelts and Boar Hides held, it cures the Wolf\'s and the Boar\'s before the Bear\'s, the Ram Kit\'s (mutants: tier 2 in the old order)', () => {
  const held = new Map([['hide:bear', 8], ['hide:wolf', 8], ['hide:boar', 8]]);
  const p = chainPlan([{ key: 'leather:cured', n: 4 }], (k) => held.get(k) ?? 0, {});
  assert.deepEqual([p.ok, p.works, p.spent], [true, [{ id: 'cure:wolf', count: 4 }], [{ key: 'hide:wolf', n: 8 }]]);
  const more = chainPlan([{ key: 'leather:cured', n: 10 }], (k) => held.get(k) ?? 0, {});
  assert.deepEqual(more.spent, [{ key: 'hide:wolf', n: 8 }, { key: 'hide:boar', n: 8 }, { key: 'hide:bear', n: 4 }], 'the Bear\'s last');
});

test('AUDIT FB1021 L2-2 THE BUTCHERY IS C&C\'S OWN: each of the Enemy Expansion\'s animals is butchered to the food Climates & Calories\' own corpse gives its body (survival/loot.js corpseFood) - Raw Meat, the Mudcrab\'s too - but the Land Dreugh, which shares the Dreugh\'s row and its none (mutants: the Mudcrab\'s Raw Fish)', (t) => {
  t.after(() => { _resetEnemyExpansion(); clearCustomEnemies(); _resetMintRowEditors(); });
  installEnemyExpansion({ on: true, log: silent });
  for (const id of [260, 262, 263, 267, 271, 278, 280, 281]) {
    const e = makeEnemyEntity(id, ENEMY_BASICS[id], null, 1, () => 0.5);
    let i = 0;
    const names = new Set(corpseFood(e, { luck: 50, rolls: () => ((i++ * 0.37) % 1) }).map((f) => f.name ?? f.shortName));
    assert.deepEqual([...names], ['Raw Meat'], `${id}: C&C's body`);
    assert.equal(hideOfFoe(id).meat, 'food:meat', `${id}: the butcher's the same`);
  }
  assert.equal(hideOfFoe(279).meat, null, 'the Land Dreugh: the Dreugh\'s row');
});

test('AUDIT FB1021 L2-3, L2-6 THE PELTS AND THE PICTURES: Wolf Pelt and Boar Hide are fur hides, cut to Large and Small Skins as the four are (recipeLaw.js PELTS); the chitin is not; the new hides wear the ten\'s pictures - a pelt Nymph Hair\'s lock, the chitin Fairy Dragon\'s Scales (mutants: a pelt left uncut; a picture swapped)', () => {
  assert.ok(PELTS.includes('hide:wolf') && PELTS.includes('hide:boar') && !PELTS.includes('hide:mudcrab'));
  assert.deepEqual(['skins-244:wolf', 'skins-245:wolf', 'skins-244:boar', 'skins-245:boar'].map((id) => recipeById(id)?.inputs.map((x) => `${x.n} ${x.key}`).join()), ['2 hide:wolf', '1 hide:wolf', '2 hide:boar', '1 hide:boar']);
  for (const [id, icon] of [[667, ICON_HAIR], [672, ICON_HAIR], [676, ICON_SCALES]]) {
    const tp = templateByIndex(id);
    assert.deepEqual([tp.worldTextureArchive, tp.worldTextureRecord], [...icon], `${id}'s picture`);
  }
});
