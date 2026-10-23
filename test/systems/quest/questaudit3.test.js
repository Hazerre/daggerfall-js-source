// QUEST-AUDIT III (2026-10-23, the owner: "Can you do a detailed quest audit, fix any and all outstanding issues. Do not
// worry about DFU parity."; bible/01-Overview/audits/Quest-Audit-III.md). The fixes the audit made, each pinned here:
//
// - STORY-AGAIN (#982, "Add way to reset a failed mandatory main quest"): a step of the main story that ended without
//   succeeding - S0000012's two days run out, a `_no_` - and whose story went no further is started again from the
//   journal (quest/machine.js storyAgainRefusal / startStoryAgain, questBridge.js journalClean.storyAgain).
// - QUEST-RESET's 'questor' rung reads a questor bound by the click alone: a quest whose script names its questor
//   (`add _Mynisera_ as questor`, every main-story step) restarts as any other.
// - LODGED-STAND: a dungeon quest Person stood at a marker inside a model is stood beside it (sceneMount.js
//   freeQuestStand) - the real data's N0000005 marker 29157 in statue 62330 is fb1004d_cratefree.test.js's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine, isMainStoryQuest, storySuccessors } from '../../../src/systems/quest/machine.js';
import { freeQuestStand } from '../../../src/systems/quest/sceneMount.js';
import { Collider } from '../../../src/player/collider.js';
import { identity } from '../../../src/world/mat4.js';
import { lodgedIn } from '../../../src/characters/foeSpacing.js';

const VENDOR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'vendor', 'dfu-quests');
const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(VENDOR, 'Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = read(join(VENDOR, 'Tables', f));
  loadQuestTables(sources);
}
const src = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');

/** A main-story step that fails at once (its start-up ends it, as a `_no_` or a missed window does), and the step its
 *  success would have started. */
const step = (name, body) => [`Quest: ${name}`, 'QRC:', 'Message:  1011', ' x', '', 'QBN:', 'Item _gold_ gold', '', ...body];
const SOURCES = {
  S0000041: step('S0000041', ['\tend quest', '', '_win_ task:', '\tstart quest 42 42', '\tend quest']),
  S0000042: step('S0000042', ['\tlog 1011 step 0']),
  S0000043: step('S0000043', ['\tend quest']),                                               // starts nothing, pays nothing
  S0000044: step('S0000044', ['\tend quest', '', '_win_ task:', '\tgive pc _gold_', '\tend quest']),   // pays, starts nothing
  S0000045: step('S0000045', ['\tgive pc _gold_', '\tend quest']),                           // succeeds
  A0C00Y41: step('A0C00Y41', ['\tend quest']),                                               // not the main story's
};
function rig() {
  const m = new QuestMachine({ nowSeconds: () => 0, playerLevel: () => 1, getQuestSourceLines: (name) => SOURCES[name] ?? null });
  return m;
}
/** Start a step and tick it past `end quest`'s two-tick countdown (quest.js ticksToEnd) to its tombstone. */
const ticks = (m, n = 5) => { for (let i = 0; i < n; i++) m.tick(); };
const run = (m, name) => { const q = m.startQuestByName(name); ticks(m); return q; };

test('STORY-AGAIN: the main story is the S group by number, the world\'s backbone apart; a script\'s successors are its `start quest` lines (mutants: the backbone, the padding)', () => {
  assert.deepEqual(['S0000012', 's0000020', 'S0000500', 'S0000999', 'S0000977', '_BRISIEN', 'A0C00Y41', 'S000012'].map(isMainStoryQuest),
    [true, true, true, false, false, false, false, false]);
  assert.deepEqual(storySuccessors(['\tstart quest 20 20 ', '-- start quest 7 7', '\tstart quest _child_', 'x start quest 3 3']), ['S0000020', '_CHILD_']);
  assert.deepEqual(storySuccessors(read(join(VENDOR, 'Quests', 'S0000012.txt')).split('\n')), ['S0000020'], 'The Emperor\'s Courier carries the story to the Orcish Treaty');
});

test('STORY-AGAIN: a failed step whose story went no further may be started again, and starts from its first step; once running, or once its successor began, it may not (mutants: each rung)', () => {
  const m = rig();
  const failed = run(m, 'S0000041');
  assert.ok(failed.questTombstoned && !failed.questSuccess, 'it ended, unpaid');
  assert.deepEqual(m.storyAgainQuests(), ['S0000041']);
  assert.equal(m.storyAgainRefusal('s0000041'), null, 'by name, in any case');
  const r = m.startStoryAgain('S0000041');
  assert.equal(r.ok, true);
  assert.notEqual(r.quest.uid, failed.uid);
  assert.equal(m.getQuest(r.quest.uid), r.quest, 'the new copy is on the table, running');
  assert.equal(m.storyAgainRefusal('S0000041'), 'running');
  assert.deepEqual(m.storyAgainQuests(), [], 'no door while it runs');
  ticks(m);
  assert.deepEqual(m.storyAgainQuests(), ['S0000041'], 'failed again: the door again');
  run(m, 'S0000042');
  assert.equal(m.storyAgainRefusal('S0000041'), 'carried', 'the step it starts has begun: the story went on');
  assert.deepEqual(m.storyAgainQuests(), []);
});

test('STORY-AGAIN refusals: not the main story\'s, the backbone, a step never failed, one that succeeded, one that starts and pays nothing, no source (mutants: each)', () => {
  const m = rig();
  run(m, 'A0C00Y41');
  assert.equal(m.storyAgainRefusal('A0C00Y41'), 'protected');
  assert.equal(m.storyAgainRefusal('S0000999'), 'protected');
  assert.equal(m.storyAgainRefusal('S0000042'), 'gone', 'never begun');
  const paid = run(m, 'S0000045');
  assert.ok(paid.questSuccess);
  assert.equal(m.storyAgainRefusal('S0000045'), 'gone', 'it succeeded');
  run(m, 'S0000043');
  assert.equal(m.storyAgainRefusal('S0000043'), 'unjudged', 'its end is its finish: nothing tells a failure');
  run(m, 'S0000044');
  assert.equal(m.storyAgainRefusal('S0000044'), null, 'a step that pays and was not paid failed');
  m.storyFailed.add('S0000046');
  assert.equal(m.storyAgainRefusal('S0000046'), 'unparsed');
  assert.deepEqual(m.startStoryAgain('S0000043'), { ok: false, reason: 'unjudged' });
  assert.deepEqual(m.storyAgainQuests(), ['S0000044']);
});

test('STORY-AGAIN rides the save: the record round-trips, the tombstone\'s week is not its memory, and an envelope from before the record learns it from the journal\'s archive - the last entry of a name its verdict (mutants: the fields, the seed, the order)', () => {
  const m = rig();
  run(m, 'S0000041');
  const data = JSON.parse(JSON.stringify(m.getSaveData()));
  assert.deepEqual([data.storyStarted, data.storyFailed], [['S0000041'], ['S0000041']]);
  const back = rig();
  back.restoreSaveData({ ...data, quests: [] });   // the tombstone gone, a week on
  back.seedStory([{ quest: 'S0000041', success: true }]);   // a record-bearing save never reads the archive
  assert.deepEqual(back.storyAgainQuests(), ['S0000041']);
  const legacy = rig();
  legacy.restoreSaveData({ siteLinks: [], quests: [] });
  assert.deepEqual(legacy.storyAgainQuests(), []);
  legacy.storyFailed.add('S0000044');   // the week's tombstone of its failed copy said so (restoreSaveData's legacy read)
  legacy.seedStory([{ quest: 'S0000044', success: false }, { quest: 'S0000041', success: false }, { quest: 'S0000044', success: true }, { quest: 'A0C00Y41', success: false }, { kind: 'note' }]);
  assert.deepEqual(legacy.storyAgainQuests(), ['S0000041'], 'S0000044 finished after it failed; A0C00Y41 is not the story\'s');
  legacy.seedStory([{ quest: 'S0000044', success: false }]);
  assert.deepEqual(legacy.storyAgainQuests(), ['S0000041'], 'read once');
  const carried = rig();
  carried.restoreSaveData({ siteLinks: [], quests: [] });
  carried.seedStory([{ quest: 'S0000041', success: false }, { quest: 'S0000042', success: false }]);
  assert.equal(carried.storyAgainRefusal('S0000041'), 'carried', 'the archive names its successor begun');
  m.clearState();
  assert.deepEqual([m.storyStarted.size, m.storyFailed.size], [0, 0], 'a load starts the loaded game\'s story');
});

test('QUEST-RESET\'s questor rung: a questor the click bound refuses the restart; one the script names and makes its questor does not (mutants: the bound test)', () => {
  const m = rig();
  const q = m.startQuestByName('S0000042');
  m.tick();
  const person = { isPerson: true, isQuestor: true, symbol: { name: 'qg' }, questorData: { hash: 0, nameSeed: 0, mapID: 0, buildingKey: 0 } };
  q.resources.set('qg', person);
  assert.equal(m.restartRefusal(q.uid), null, '`add _Mynisera_ as questor`: the same person again');
  person.questorData = { hash: 0x1234, nameSeed: 9, mapID: 12, buildingKey: 0 };
  assert.equal(m.restartRefusal(q.uid), 'questor', 'the clicked NPC: whoever was clicked last would be bound');
  for (const k of ['hash', 'nameSeed', 'mapID', 'buildingKey']) {
    person.questorData = { hash: 0, nameSeed: 0, mapID: 0, buildingKey: 0, [k]: 3 };
    assert.equal(m.restartRefusal(q.uid), 'questor', k);
  }
});

test('STORY-AGAIN\'s doors: the bridge hands both through journalClean (every host\'s pause window and chronicle), seeds a legacy save after the notebook restores, and the two journals draw the press twice (source pins)', () => {
  const bridge = src('src/scenes/quest/questBridge.js');
  assert.match(bridge, /storyAgain: \(\) => machine\.storyAgainQuests\(\)\.map/);
  assert.match(bridge, /const r = machine\.startStoryAgain\(questName\);/);
  assert.match(bridge, /if \(data\.notebook\) notebook\.restoreSaveData\(data\.notebook\);\n(?:\s*\/\/.*\n)*\s*machine\.seedStory\(notebook\.getFinishedQuests\(\)\.map\(\(e\) => e\[0\]\?\.render\)\.filter\(\(r\) => r\?\.kind === 'quest'\)\);/);
  const menu = src('src/ui/enhanced/enhancedMenu.js');
  assert.match(menu, /const story = \(clean\?\.storyAgain\?\.\(\) \?\? \[\]\)\.map/);
  assert.match(menu, /section\(t\('pause\.journal\.main', 'Main Quests'\), \[\.\.\.mains, \.\.\.story\]/);
  assert.match(menu, /if \(journalCleanArmed !== sel\.key\) \{ journalCleanArmed = sel\.key; render\(\); return; \}\n\s*journalCleanArmed = null;\n\s*const out = clean\.startStoryAgain\(sel\.story\.questName\);/);
  const chron = src('src/ui/enhanced/enhancedChronicle.js');
  assert.match(chron, /shelfWord = storyDoor\.startStoryAgain\(s\.questName\)\?\.text \?\? '';/);
});

test('LODGED-STAND: a quest Person whose feet stand inside a model stands beside it; feet in the open stand as given; the dungeon host stands its Persons through it (mutants: the free, the host\'s call)', () => {
  // a floor facing up, and a closed 2 m box on it round the marker, its faces looking out
  const c = new Collider(() => -Infinity);
  c.addMesh('dungeon', [-10, 0, -10, 10, 0, -10, 10, 0, 10, -10, 0, 10], [0, 2, 1, 0, 3, 2], identity());
  const box = { positions: [], indices: [] };
  const v = (x, y, z) => { box.positions.push(x, y, z); return box.positions.length / 3 - 1; };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => [v(x, 0, z), v(x, 2, z)]);
  for (let i = 0; i < 4; i++) {
    const [a0, a1] = corners[i], [b0, b1] = corners[(i + 1) % 4];
    box.indices.push(a0, b1, b0, a0, a1, b1);
  }
  const [t0, t1, t2, t3] = corners.map(([, top]) => top);
  box.indices.push(t0, t2, t1, t0, t3, t2);
  c.addMesh('dungeon', box.positions, box.indices, identity());
  const inside = [0.2, 0, 0.1];
  assert.ok(lodgedIn(c, inside), 'the fixture: the marker stands in the box');
  const stood = freeQuestStand(c, inside, 1.8);
  assert.notEqual(stood, inside);
  assert.ok(!lodgedIn(c, stood) && Math.max(Math.abs(stood[0]), Math.abs(stood[2])) > 1, `beside the box - ${stood}`);
  const open = [5, 0, 5];
  assert.equal(freeQuestStand(c, open, 1.8), open, 'in the open: as given');
  assert.equal(freeQuestStand(null, inside, 1.8), inside, 'no collider: as given');
  const modes = src('src/scenes/worldModes.js');
  assert.match(modes, /if \(Number\.isFinite\(drop\)\) by = \(origin - drop\) \+ size\.h \* 0\.02;\n\s*if \(inDungeon\) \{ \[x, by, z\] = freeQuestStand\(ctx\.collider, \[x, by, z\], size\.h\); stand\.x = x; stand\.z = z; \}/);
});
