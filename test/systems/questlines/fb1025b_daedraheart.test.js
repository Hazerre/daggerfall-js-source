// FIELD BUGS 2026-10-25b (Discord #bug-reports, "Unable to turn in The Daedra's Heart", Mefwhesk: "Elyzabyth will not
// let me turn the quest in"; Shortstori: "I bet its just a random daedra heart. That also didnt work in vanilla btw. It
// has to be the 'special' one"). DFU's Q0C4XY04 (vendor/dfu-quests/Quests/Q0C4XY04.txt), run through the real bridge and
// machine with the questFoeHost wiring the four hosts stand quest foes through, and taken off its body through the real
// remote click and transfer (systems/item/itemTransfer.js). What these pins hold:
//   - THE CHAIN WORKS, as DFU's: the four Foes come in waves once `pc at _mondung_ set _exitstarter_`; the first one hurt
//     is given the heart (`injured` then `give item _heart_ to`), its body holds the quest's own heart, and `toting _heart_
//     and _questgiver_ clicked` takes it at the questor - with the questlines' switch on (the ask) and off (DFU's script).
//   - A PLAIN HEART IS NO QUEST'S, as in DFU (Item resources are per quest - ItemCollection.Contains(Item) by its quest's
//     uid and symbol): a Daedra Seducer's own loot leaves one beside the quest's half the time, and it never hands in.
//   - HEART-TAKEN: the journal strikes "take its heart" when the heart is the player's - never on DFU's `clicked item`,
//     which a look at the row in a body's list fires (a menu closed unused, a take refused).
//   - QUEST-MARK: the enhanced pack says which heart is the quest's, as DFU's green cell does.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createQuestBridge } from '../../../src/scenes/quest/questBridge.js';
import { mintQuestFoeWave, bindQuestFoeHost } from '../../../src/scenes/quest/questFoeHost.js';
import { setPref } from '../../../src/systems/uiPrefs.js';
import { QUESTLINES_PREF, questlinesOn } from '../../../src/systems/questlines/qlLaw.js';
import { questSource, loadTables, ROOT } from '../../qlSources.mjs';
import { addItem } from '../../../src/systems/inventory.js';
import { sendQuestItemClick, planTake, applyTransfer, keepsQuestItem } from '../../../src/systems/item/itemTransfer.js';
import { spawnEnemyLoot } from '../../../src/scenes/hostCombat.js';
import { ENEMY_BASICS } from '../../../src/characters/enemy/enemyBasics.js';
import { MOBILE_TYPES } from '../../../src/characters/mobile/mobileTypes.js';
import { mountEnhancedInventory, itemLine } from '../../../src/ui/enhanced/enhancedInventory.js';
import { withDom } from '../../invdrag.mjs';

loadTables();
const HEART = 53;   // ItemTemplates 53, CreatureIngredients1: Daedra's Heart (`Item _heart_ daedra_heart`)
const isHeart = (it) => it?.group === 'CreatureIngredients1' && it.templateIndex === HEART;

/** Quest `name` started at its questor, over a pack the player carries. `world` is the quest's foe seam as the hosts
 *  wire it (mintQuestFoeWave + bindQuestFoeHost over a pool record, the bodies' items the entity's - questFoeHost.js);
 *  `carriesQuestItem` the pack's read of ItemCollection.Contains(Item), the exported law (keepsQuestItem over the pack). */
function rig({ on = true, name = 'Q0C4XY04', factionId = 0 } = {}) {
  setPref(QUESTLINES_PREF, on);
  const pack = [];
  const rec = { asked: [], popups: [], rewards: [] };
  let now = 100000;
  const pool = [];
  let bridge = null;
  const world = {
    currentRegionIndex: () => 0,
    isPlayerInLocationRect: () => false,
    createFoeGameObjects: (foe, count) => mintQuestFoeWave(bridge.machine, foe, count),
    tryPlaceFoe: (handle) => {
      const f = { entity: { health: 60, maxHealth: 60, level: 12, items: [] }, ai: {}, dead: false, sym: handle.foe.symbol.name };
      pool.push(f);
      bindQuestFoeHost(f, handle.behaviour, { removeFoe: (x) => { x.dead = true; }, zeroFoeHealth: (x) => { x.entity.health = 0; x.dead = true; }, foeSinks: () => ({}) });
      return true;
    },
    raiseOnEncounterEvent: () => {},
  };
  bridge = createQuestBridge({
    data: {
      readListTable: (name) => { try { return readFileSync(join(ROOT, 'vendor/dfu-quests/Tables', `QuestList-${name}.txt`), 'utf8'); } catch { return null; } },
      getQuestSourceLines: (n) => questSource(n, questlinesOn()),
    },
    classicSeconds: () => now, nowSeconds: () => now, worldSeconds: () => now,
    playerEntity: { name: 'Hero', level: 12, gender: 'female', career: { weaponArmorShieldsBitfield: 0, forbiddenMaterialsFlags: 0 }, skills: new Array(35).fill(30), stats: { strength: 60, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 }, items: pack },
    giveItemToPlayer: (it) => addItem(pack, it),
    removeItemFromPlayer: (it) => { const i = pack.indexOf(it); if (i >= 0) pack.splice(i, 1); },
    playerHasItem: (it) => pack.includes(it),
    carriesQuestItem: (res) => keepsQuestItem({ items: pack }, res),
    releaseQuestItem: (uid, res) => { for (let i = pack.length - 1; i >= 0; i--) if (pack[i].questUID === uid && keepsQuestItem({ items: [pack[i]] }, res)) pack.splice(i, 1); },
    showChoice: (_q, message, choices, respond) => rec.asked.push({ message, choices, respond }),
    showPopup: (_q, tokens) => rec.popups.push(tokens.map((t) => t.text).join(' ').replace(/\s+/g, ' ')),
    showPrompt: (_q, _m, respond) => respond(true),
    offerReward: (_q, item) => rec.rewards.push(item),   // RW1's door: GivePc's reward, the pile the inventory opens over
  });
  // the quest's dice at 5 in 100: every wave's `with X% success` passes (the waves' own law, not their luck - 0.9^7 of runs
  // would meet no seducer at all)
  const quest = bridge.machine.startQuestByName(name, factionId, { rolls: () => 0.05 });
  // the parse stands no world (its remote sites are a map's, no part of this pin); the foe seam is the quest's from here,
  // and the player stands at a Place when the pin says so (`at`) - `pc at _x_ set _task_` reads it every tick
  quest.hooks.world = world;
  const at = new Set();
  for (const res of quest.resources.values()) if (res.isPlace) res.isPlayerHere = () => at.has(res.symbol.name);
  // `place foe` is the world's part (the site's marker): its foe is stood by `stand` below
  for (const task of quest.tasks.values()) for (const a of task.actions) if (a.typeName === 'PlaceFoe') a.isComplete = true;
  const tick = (n = 1, dt = 60) => {
    for (let i = 0; i < n; i++) { now += dt; bridge.machine.tick(); for (const f of pool) f.questBehaviour?.update(); bridge.questlines.look(); }
  };
  const getQuest = (uid) => bridge.machine.getQuest(uid);
  /** The remote list's click on a body's row (DaggerfallInventoryWindow.cs:2027-2037), then the window's take. */
  const take = (f, it) => {
    sendQuestItemClick(it, getQuest);
    const plan = planTake(it, { bag: pack, entity: bridge.machine.deps.playerEntity, getQuest });
    if (!plan.ok) return plan.refusal;
    applyTransfer(it, plan, f.entity.items, pack, { entity: bridge.machine.deps.playerEntity, toPlayer: true });
    return null;
  };
  const objectives = () => Object.fromEntries((bridge.questlines.rowOf(quest)?.objectives ?? []).map((o) => [o.id, o.state]));
  /** A placed foe as the dungeon stands one at its marker (sceneMount.js addQuestFoe: a behaviour assigned, bound to the
   *  pool record at the stand - its queue drained onto the body - and its injury rearmed). Answers the pool record. */
  const stand = (foeName) => {
    const foe = quest.getFoe({ name: foeName });
    const [handle] = mintQuestFoeWave(bridge.machine, foe, 1);
    world.tryPlaceFoe(handle);
    foe.questResourceBehaviour = handle.behaviour;
    foe.rearmInjured();
    tick(1, 1);
    return pool.at(-1);
  };
  return { bridge, quest, pack, pool, rec, tick, take, getQuest, objectives, stand, at, enter: () => { at.add('mondung'); }, leave: () => { at.clear(); } };
}

/** In the dungeon until a wave of each of the four has come, the first fire daedra hurt (`_S.06_`), and the heart given. */
function heartGiven(r) {
  r.enter();
  r.tick(60 * 6);
  const syms = new Set(r.pool.map((f) => f.sym));
  const fire = r.pool.find((f) => f.sym === 'firedaedra');
  assert.ok(fire, 'a fire daedra came');
  fire.entity.health = 40;   // hurt
  r.tick(4, 1);
  return { fire, syms };
}

test('FIELD BUGS 2026-10-25b: Q0C4XY04 runs to its end - the four come in waves at the dungeon, the first hurt is given the quest\'s heart, its body holds it, and the questor takes it (the ask, the reward)', () => {
  const r = rig({ on: true });
  r.tick(3);
  assert.equal(r.pool.length, 0, 'no wave before the player stands at _mondung_ (`pc at` sets _exitstarter_)');
  const { fire, syms } = heartGiven(r);
  assert.deepEqual([...syms].sort(), ['F.03', 'daedroth', 'firedaedra', 'seducer'], 'each of the four Foes came (`create foe ... every N minutes K times with X% success`)');
  assert.equal(r.quest.getTask({ name: 'S.06' }).getTriggerValue(), true, '`injured _firedaedra_`');
  const held = fire.entity.items.filter(isHeart);
  assert.equal(held.length, 1, 'the body holds the heart (`give item _heart_ to _firedaedra_`, AddItemQueue)');
  assert.deepEqual([held[0].questItem, held[0].questUID, held[0].questSymbol?.name], [true, r.quest.uid, 'heart'], 'the quest\'s own');
  const spawned = r.pool.length;
  r.tick(60 * 2);
  assert.equal(r.pool.length, spawned, '`_S.11_` cleared the waves (`clear _S.10_`)');
  fire.entity.health = 0;
  r.tick(2, 1);
  assert.equal(r.take(fire, held[0]), null, 'taken');
  r.tick(2, 1);
  assert.ok(r.rec.popups.some((p) => /pluck a perfect heart/.test(p)), '`clicked item _heart_ say 1040`');
  r.leave();
  r.tick(2);
  r.quest.getPerson({ name: 'questgiver' }).setPlayerClicked();   // Elyzabyth clicked (machine.setLastNPCClicked's sweep)
  r.tick(1, 1);
  assert.equal(r.rec.asked.length, 1, '`toting _heart_ and _questgiver_ clicked` - the hand-in\'s question');
  assert.equal(r.rec.asked[0].message.id, 1900);
  assert.equal(r.pack.some((it) => it.questItem), false, 'the heart went to the witches (ReleaseQuestItemForReoffer)');
  r.rec.asked[0].respond(0);
  r.tick(6, 1);
  assert.ok(r.quest.questComplete && r.quest.questSuccess, 'ended a success');
  assert.ok(r.rec.rewards.some((it) => /Malachite/.test(it.name ?? '')), '`give pc _reward_`');
});

test('FIELD BUGS 2026-10-25b: the same with the questlines off - DFU\'s script whole: `toting` hands the heart in and pays', () => {
  const r = rig({ on: false });
  assert.equal(r.quest.ql, null, 'DFU\'s quest');
  const { fire } = heartGiven(r);
  fire.entity.health = 0;
  r.tick(2, 1);
  assert.equal(r.take(fire, fire.entity.items.find(isHeart)), null);
  r.leave();
  r.tick(2);
  r.quest.getPerson({ name: 'questgiver' }).setPlayerClicked();
  r.tick(4, 1);
  assert.ok(r.quest.questComplete && r.quest.questSuccess, '`_pcgetsgold_`: toting, give pc, end quest');
});

/** A Daedra Seducer's own body, through the loot chain the dungeon rolls a foe's at its stand (hostCombat.js
 *  spawnEnemyLoot): the first of `n` that holds a heart of its own, and how many did. */
function seducerBodies(n = 200) {
  let first = null, hearts = 0, seed = 7;
  const rolls = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let i = 0; i < n; i++) {
    const entity = { level: 12, items: [], maxHealth: 60, health: 60 };
    const items = spawnEnemyLoot(entity, MOBILE_TYPES.DaedraSeducer, ENEMY_BASICS[MOBILE_TYPES.DaedraSeducer], { level: 12, gender: 'female', stats: { luck: 50 } }, { rolls, quarters: 4, luck: 50 });
    const h = items.find(isHeart);
    if (h) { hearts++; first ??= h; }
  }
  return { first, hearts, n };
}

test('FIELD BUGS 2026-10-25b: a plain Daedra\'s Heart - a seducer\'s own loot leaves one beside the quest\'s about half the time - never hands in and never strikes the line, as in DFU (Item resources are per quest)', () => {
  const bodies = seducerBodies();
  assert.ok(bodies.hearts > bodies.n / 4, `a seducer's own body holds a heart often (${bodies.hearts}/${bodies.n}) - lootThemes.js: its C1 roll is the heart`);
  const plain = bodies.first;
  assert.equal(!!plain.questItem, false, 'no quest\'s');
  const r = rig({ on: true });
  heartGiven(r);
  addItem(r.pack, plain);
  r.tick(3, 1);
  assert.equal(r.objectives().heart, 'open', 'a plain heart takes nothing of the quest\'s');
  r.leave();
  r.tick(2);
  r.quest.getPerson({ name: 'questgiver' }).setPlayerClicked();
  r.tick(4, 1);
  assert.equal(r.rec.asked.length, 0, 'the questor asks nothing over a plain heart');
  assert.equal(r.quest.questComplete, false, 'the quest runs on');
  assert.ok(r.pack.includes(plain), 'and the heart is the player\'s still');
});

test('FIELD BUGS 2026-10-25b HEART-TAKEN: a press on the quest\'s heart that takes nothing (DFU\'s `clicked item` - a take refused, a menu closed unused) strikes nothing - the line is struck once the heart is the player\'s, and stays struck at the hand-in', () => {
  for (const look of ['refused', 'menu']) {
    const r = rig({ on: true });
    const { fire } = heartGiven(r);
    fire.entity.health = 0;
    r.tick(2, 1);
    const heart = fire.entity.items.find(isHeart);
    const me = r.bridge.machine.deps.playerEntity, strength = me.stats.strength;
    if (look === 'refused') {
      me.stats.strength = 0;   // a pack that cannot carry it: the window's own refusal, after the quest's click (:2027-2037)
      assert.equal(r.take(fire, heart)?.reason, 'cannotCarry');
      me.stats.strength = strength;
    } else sendQuestItemClick(heart, r.getQuest);   // the right click's menu: the quest's click first (WHERE-ROBES), and nothing taken
    r.tick(2, 1);
    assert.equal(r.quest.getTask({ name: 'S.01' }).getTriggerValue(), true, `${look}: DFU's click fired (its popup 1040 said)`);
    assert.ok(r.rec.popups.some((p) => /pluck a perfect heart/.test(p)));
    assert.ok(fire.entity.items.includes(heart), `${look}: the heart is on the body still`);
    assert.deepEqual(r.objectives(), { heart: 'open' }, `${look}: not "taken", and nothing to bring`);
    if (look === 'menu') continue;
    assert.equal(r.take(fire, heart), null);
    r.tick(1, 1);
    assert.deepEqual(r.objectives(), { heart: 'done', bring: 'open' }, 'the player\'s: taken, and to bring');
    r.leave();
    r.tick(2);
    r.quest.getPerson({ name: 'questgiver' }).setPlayerClicked();
    r.tick(1, 1);
    r.rec.asked[0].respond(0);
    r.tick(6, 1);
    assert.deepEqual(r.objectives(), { heart: 'done', bring: 'done' }, 'handed in');
  }
});

test('FIELD BUGS 2026-10-25b HEART-TAKEN: a copy whose player never held the heart reads it taken at the hand-in (`_qlask_`, a party\'s resync carries it)', () => {
  const r = rig({ on: true });
  heartGiven(r);
  r.quest.getTask({ name: 'qlask' }).start();   // the hand-in, as a partner's copy carried it here
  r.tick(1, 1);
  assert.equal(r.objectives().heart, 'done');
});

test('FIELD BUGS 2026-10-25b QUEST-MARK: the enhanced pack says which heart is the quest\'s - on its row and on its card, as DFU\'s green cell does (questItemBackgroundColor); a plain heart says nothing of a quest', () => {
  const r = rig({ on: true });
  const { fire } = heartGiven(r);
  const quest = fire.entity.items.find(isHeart);
  const plain = seducerBodies().first;
  assert.equal(itemLine(plain).quest, null, 'a plain heart is no quest\'s');
  withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { items: [plain, quest], stats: {}, level: 12 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, getQuest: r.getQuest, onExit: () => {} });
    let rows = dom.doc.querySelectorAll('.itemrow');
    for (const b of dom.doc.querySelectorAll('button')) { if (rows.length) break; if (/\bstatflip-btn\b/.test(b.className ?? '')) continue; b.onclick?.({}); rows = dom.doc.querySelectorAll('.itemrow'); }
    assert.equal(rows.length, 2, 'two rows - a quest\'s item never stacks (IsStackable)');
    const subs = rows.map((row) => row.querySelectorAll('small').map((n) => n.textContent).join(' '));
    assert.deepEqual(subs.map((s) => /quest item/.test(s)), [false, true], 'the quest\'s row says it is');
    rows[1].onclick?.({});
    const lines = dom.doc.querySelectorAll('.card')[0].querySelectorAll('p').map((n) => n.textContent);
    assert.ok(lines.includes("Quest item: The Daedra's Heart"), `its card names its quest (${lines.join(' | ')})`);
    rows[0].onclick?.({});
    const plainLines = dom.doc.querySelectorAll('.card')[0].querySelectorAll('p').map((n) => n.textContent);
    assert.equal(plainLines.some((l) => /Quest item/.test(l)), false, 'a plain heart\'s card names none');
    view.unmount();
  });
});

// ---- HEART-TAKEN's siblings: the same lie in three more sheets - a line struck on DFU's `clicked item` of an item a
// foe's body holds. Each is struck now by the quest's item held, or by the task its script sets once the item is handed
// in or used (a party copy's resync carries that task, as `_qlask_` is Q0C4XY04's).
const SIBLINGS = [
  {
    name: 'N0B00Y06', item: 'wrappings', look: 'S.03', line: 'wrappings', next: 'bring', handIn: 'reward',
    // `injured _mummy_` then `give item _wrappings_ to _mummy_` (`_S.04_`); handed in by `toting _wrappings_ and _qgiver_ clicked`
    reach: (r) => { r.at.add('mondung'); const f = r.stand('mummy'); f.entity.health = 30; r.tick(4, 1); return f; },
    handInNow: (r) => { r.at.clear(); r.tick(2); r.quest.getPerson({ name: 'qgiver' }).setPlayerClicked(); r.tick(4, 1); },
  },
  {
    name: 'R0C20Y07', item: 'item', look: 'pchasitem', line: 'find', next: 'deliver', handIn: 'pcgetsgold',
    // the start-up's `give item _item_ to _giant_`; handed in by `toting _item_ and _qgfriend_ clicked`
    reach: (r) => { r.at.add('itemdung'); return r.stand('giant'); },
    handInNow: (r) => { r.at.clear(); r.tick(2); r.quest.getPerson({ name: 'qgfriend' }).setPlayerClicked(); r.tick(4, 1); },
  },
  {
    name: 'S0000503', item: 'item', look: 'S.05', line: 'hoard', next: null, handIn: 'S.28', also: ['S.29'],
    // the menu's look alone: headless its `magic_item` is the parse's MAGIC.DEF stand-in (quest/item.js), which weighs
    // nothing - and a weightless piece always fits (CanCarryAmount), so no pack refuses it here
    looks: ['menu'],
    // the start-up's `give item _item_ to _guardian_`; the key held (`_S.16_`'s `have _key_ set _S.25_`, or `_S.24_` puts the
    // player out of the vault); its hand-in is the way out: `_S.30_` (`when _S.05_ and not _S.16_`) asks, Yes is `_S.28_`
    // (`take _item_ from pc`), No `_S.29_` (`make _item_ permanent`)
    reach: (r) => { r.pack.push({ ...r.quest.getItem({ name: 'key' }).daggerfallUnityItem }); r.at.add('itemdung'); r.tick(2, 1); return r.stand('guardian'); },
    handInNow: (r) => { r.at.clear(); r.tick(4, 1); },
  },
];

describe('FIELD BUGS 2026-10-25b HEART-TAKEN, its siblings: a press that takes nothing strikes nothing, a take strikes, a hand-in keeps it struck', () => {
  for (const s of SIBLINGS) {
    const own = (r) => r.quest.getItem({ name: s.item });
    const onBody = (f, r) => f.entity.items.find((it) => it.questItem && it.questUID === r.quest.uid && it.questSymbol?.name === s.item);
    test(`${s.name} ${s.line}: ${s.looks ? 'a menu closed unused fires' : 'a take refused and a menu closed unused fire'} \`clicked item\` and strike nothing; the take strikes it, and the hand-in leaves it struck`, () => {
      for (const look of s.looks ?? ['refused', 'menu']) {
        const r = rig({ on: true, name: s.name });
        const f = s.reach(r);
        f.entity.health = 0;
        r.tick(2, 1);
        const it = onBody(f, r);
        assert.ok(it, `${s.name}: the body holds the quest's ${s.item}`);
        const me = r.bridge.machine.deps.playerEntity, strength = me.stats.strength;
        if (look === 'refused') {
          me.stats.strength = 0;   // a pack that cannot carry it: the window's own refusal, after the quest's click
          assert.equal(r.take(f, it)?.reason, 'cannotCarry');
          me.stats.strength = strength;
        } else sendQuestItemClick(it, r.getQuest);   // the right click's menu, closed unused
        r.tick(2, 1);
        assert.equal(r.quest.getTask({ name: s.look }).getTriggerValue(), true, `${s.name} ${look}: DFU's click fired`);
        assert.ok(f.entity.items.includes(it), `${s.name} ${look}: on the body still`);
        assert.notEqual(r.objectives()[s.line], 'done', `${s.name} ${look}: not taken`);
        if (s.next) assert.equal(r.objectives()[s.next], undefined, `${s.name} ${look}: nothing to bring`);
        if (look === 'menu' && !s.looks) continue;
        assert.equal(r.take(f, it), null);
        r.tick(1, 1);
        assert.equal(r.objectives()[s.line], 'done', `${s.name}: taken`);
        if (s.next) assert.equal(r.objectives()[s.next], 'open', `${s.name}: and to bring`);
        s.handInNow(r);
        assert.equal(r.quest.getTask({ name: s.handIn }).getTriggerValue(), true, `${s.name}: handed in (\`_${s.handIn}_\`)`);
        assert.equal(keepsQuestItem({ items: r.pack }, own(r)), false, `${s.name}: the item is the player's no more`);
        assert.equal(r.objectives()[s.line], 'done', `${s.name}: still struck`);
      }
    });
    test(`${s.name} ${s.line}: a copy whose player never held the item reads it taken at its hand-in (a party's resync carries the task)`, () => {
      for (const task of [s.handIn, ...(s.also ?? [])]) {
        const r = rig({ on: true, name: s.name });
        r.tick(2, 1);
        assert.notEqual(r.objectives()[s.line], 'done');
        r.quest.getTask({ name: task }).start();
        r.tick(1, 1);
        assert.equal(r.objectives()[s.line], 'done', `${s.name}: \`_${task}_\``);
      }
    });
  }
});
