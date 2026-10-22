// FIELD BUGS 2026-10-21d RAVEN-CLOSE (DiabeticCat, the Discord's #bug-reports, "Bugged Knight of The Raven Quest":
// "Quest wont complete even after a real life day" - The Lost Artifact's card, both objectives DONE, "Finish it to choose
// one of 3 pieces of gear"). B0B81Y02's knight pays with `give pc nothing` (`_success_`: the quest a success, not over),
// and with the lich's map never read the one `end quest` left is `_questdone_: when _2dung_ and not _readmap_` - a when
// on a bare `variable _2dung_`, the start-up block's travel clock (21 to 38 days on the real map). BODYGUARD-CLOSE read a
// start-up closing by the clock's OWN task, which does nothing here, so `_2dung_` stayed a deadline through the success:
// online its days are played (QCLOCK-WORLD), two to three days of a player's life with the reward unrolled and the
// Order's door shut (offerFlow: the busy questor). The record: bible/01-Overview/bugs/Field-Bugs-2026-10-21d.md.
//
// The AUDIT REST-PARTY harness (the real QuestMachine over the vendored script), with the travel clock ARMED - the D1
// pin left `_2dung_` held (travelTimePending, headless), which is how the stall escaped it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { Symbol as QS } from '../../../src/systems/quest/symbol.js';
import { ONLINE_DELAY_SECONDS, PLAYED_STEP_MAX_SECONDS } from '../../../src/systems/quest/clock.js';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
const DAY_S = 86400;
const quiet = (fn) => { const w = console.warn, l = console.log; console.warn = () => {}; console.log = () => {}; try { return fn(); } finally { console.warn = w; console.log = l; } };
const machineFor = (online, now) => new QuestMachine({
  nowSeconds: () => now.s, raisedSeconds: () => now.raised, skySeconds: () => 100 * DAY_S + 12 * 3600, sharedClock: () => online,
  questClockStepMax: () => (online ? PLAYED_STEP_MAX_SECONDS : Infinity), showPopup() {}, isPlayerInTown: () => true, giveItemToPlayer() {},
  getQuestSourceLines: (n) => rd(`vendor/dfu-quests/Quests/${n}.txt`).split(/\r?\n/).filter((l) => !/^\s*(place npc|create npc at|place foe|place item|reveal)/.test(l)),
});
/** The travel clock armed as a world arms it at the parse, and started where the start-up block held it. */
const arm = (c, seconds) => { c.travelTimePending = false; c.startingTimeInSeconds = c.remainingTimeInSeconds = seconds; c.startTimer(); };
const SHORT_WAIT_MIN = Math.ceil(ONLINE_DELAY_SECONDS / 60) + 4;

/** The Lost Artifact taken, its lich slain and (or not) the map read, and the knight told. */
function lostArtifact(online, { readMap = false } = {}) {
  return quiet(() => {
    const now = { s: 1e6, raised: 0 };
    const m = machineFor(online, now);
    const q = m.startQuestByName('B0B81Y02');
    arm(q.resources.get('2dung'), 24 * DAY_S);
    const step = (secs, n) => { for (let i = 0; i < n; i++) { now.s += secs; m.tick(); } };
    step(60, 2);
    q.startTask(new QS('_S.01_')); step(60, 2);   // the lich dead
    if (readMap) { q.startTask(new QS('_readmap_')); step(60, 2); }
    q.startTask(new QS('_S.02_')); step(60, 2);   // the knight told: give pc nothing, the success
    return { m, q, step, now };
  });
}

test('RAVEN-CLOSE: B0B81Y02 online, the lich reported and the map never read - the knight\'s `give pc nothing` closes it on the short wait (`_questdone_: when _2dung_ and not _readmap_`), not after `_2dung_`\'s 24 days played (mutants: the live reading dropped, the run-time half dropped)', () => {
  const { q, step } = lostArtifact(true);
  assert.equal(q.questSuccess, true);
  assert.equal(q.questComplete, false, 'not in the same breath');
  assert.equal(q.resources.get('2dung').isDeadline, false, 'the success makes `_2dung_` the script closing the quest');
  quiet(() => step(60, SHORT_WAIT_MIN));
  assert.equal(q.questComplete, true, 'closed within the short wait - its gear rolled, the Order\'s door open (offerFlow reads an open quest\'s questor)');
});

test('RAVEN-CLOSE: a save made stuck - the success standing, `_2dung_` with 37 days to run - loads and closes on the short wait (nothing of the reading is saved)', () => {
  const data = quiet(() => {
    const { m } = lostArtifact(true);
    const c = [...m.quests.values()][0].resources.get('2dung');
    c.remainingTimeInSeconds = 37 * DAY_S;
    return JSON.parse(JSON.stringify(m.getSaveData()));
  });
  const r = quiet(() => {
    const now = { s: 2e6, raised: 0 };
    const m = machineFor(true, now);
    m.restoreSaveData(data);
    const q = [...m.quests.values()][0];
    const before = { success: q.questSuccess, complete: q.questComplete };
    for (let i = 0; i < SHORT_WAIT_MIN; i++) { now.s += 60; m.tick(); }
    return { before, complete: q.questComplete };
  });
  assert.deepEqual(r.before, { success: true, complete: false }, 'restored as it was saved');
  assert.equal(r.complete, true, 'closed');
});

test('RAVEN-CLOSE: what it is NOT - the map read, the artifact hunt keeps `_S.30_`\'s 180 days (AUDIT REST-PARTY D1); offline DFU\'s `_2dung_` stands', () => {
  const hunt = lostArtifact(true, { readMap: true });
  quiet(() => hunt.step(60, 60));
  assert.equal(hunt.q.questComplete, false, 'the hunt runs on');
  assert.ok(hunt.q.resources.get('S.30').remainingTimeInSeconds > 179 * DAY_S);
  const off = lostArtifact(false);
  quiet(() => off.step(1800, 48));
  assert.equal(off.q.questComplete, false, 'offline: a day on, DFU\'s 24 days still running');
});

test('RAVEN-CLOSE: M0B00Y16 - the giant paid for while the villager\'s escort is under way keeps `_qtime_` (its end, read as the quest stands, says the late line `_S.14_`): open past the short wait, no late line', () => {
  const r = quiet(() => {
    const now = { s: 1e6, raised: 0 };
    const m = machineFor(true, now);
    const q = m.startQuestByName('M0B00Y16', 0, { rolls: () => 0 });   // pick one of: _victim_, _map_, _magicItem_
    arm(q.resources.get('qtime'), 10 * DAY_S);
    const step = (secs, n) => { for (let i = 0; i < n; i++) { now.s += secs; m.tick(); } };
    step(60, 2);
    q.startTask(new QS('_S.10_')); q.startTask(new QS('_yes_')); step(60, 2);   // the villager met, the escort taken
    q.startTask(new QS('_S.03_')); q.startTask(new QS('_clickqgiver_')); step(60, 3);   // the giant dead and reported: paid
    const at = { success: q.questSuccess, victim: q.getTask(new QS('_victim_')).getTriggerValue(), open: !q.questComplete };
    step(60, 60);
    return { at, after: !q.questComplete, late: q.getTask(new QS('_S.14_')).getTriggerValue() };
  });
  assert.deepEqual(r.at, { success: true, victim: true, open: true });
  assert.equal(r.after, true, 'an hour on, the escort still runs');
  assert.equal(r.late, false, 'no "too late" line');
});
