// FIELD BUGS 2026-10-25b ROAD-SPARE (the Discord's #bug-reports, pepsiorcoke, "Player gets a bounty when defending
// themselves against quest NPC's who attack": "Assassin's are attacking me for escorting another NPC and I choose to defend
// myself and my escort target guards approach me with a hefty fee of 500+ gold").
//
// Neither the quest nor the kill charges anything, as in DFU: A0C00Y17 (The Escort) refused to the Dark Brotherhood costs
// the Brotherhood's regard alone (`_S.19_`; only the WATCH's warrant refused is `legal repute -20`, `_S.17_`), and a hostile
// quest foe killed is no crime (HandleAttackFromSource charges a civilian struck and the city watch killed, nothing else).
// The charge was the ROAD's: a swing that met no foe in reach and no townsperson was offered to the living world's
// travellers (LW7), whom PROTECT-FIGHT's law never reached - so in a fight, under Protect Bystanders, the swing at an
// attacker just past the reach struck down the merchant on the look ray, the road reported a Murder (LW11), the region's
// law took 20 at the town, and the watch's stop asked 600 gold of a name it now knew. The road's travellers take the
// street's law now (scenes/livingWorld/roadStrike.js). Through the real producers: the quest machine on DFU's own script,
// its Foe's wave minted as the host mints it and stood in the encounter pool, the street's pool and its law, the roads'
// layer and its party, the caravan's report and charge, the court's loss and the watch's fine.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadQuestTables } from '../../../src/systems/quest/tables.js';
import { QuestMachine } from '../../../src/systems/quest/machine.js';
import { mintQuestFoeWave } from '../../../src/scenes/quest/questFoeHost.js';
import { createExteriorFoes } from '../../../src/scenes/exteriorFoes.js';
import { createCityGuards } from '../../../src/scenes/cityGuards.js';
import { areEnemiesNearby } from '../../../src/systems/encounters.js';
import { PlayerWeapon } from '../../../src/combat/playerWeapon.js';
import { setValue } from '../../../src/systems/settings/settings.js';
import { createLivingRoads } from '../../../src/scenes/livingWorld/livingRoads.js';
import { createRoadStrike, ROAD_SPARED, ROAD_STRUCK } from '../../../src/scenes/livingWorld/roadStrike.js';
import { createCaravanHost } from '../../../src/scenes/caravanHost.js';
import { reportAt } from '../../../src/systems/livingWorld/caravanDoor.js';
import { createRelations } from '../../../src/systems/livingWorld/relations.js';
import { partyAt, CALENDAR_MPM } from '../../../src/systems/livingWorld/trips.js';
import { changeLegalRep, legalRepOf, lowerRepForCrime, CRIMES } from '../../../src/systems/court.js';
import { knownCriminal, challengeFine } from '../../../src/systems/standing.js';
import { livingMap, partiesOver } from '../../lwRoads.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
const REGION = 17;   // the synthetic map's region (test/lwRoads.mjs), the road's and the quest's alike
const FEET = [0, 0, 0], EYE = [0, 1.6, 0], FWD = [0, 0, 1];
const inView = () => true;
const player = () => ({ name: 'Pepsi', level: 1, reflexes: 2, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [],
  stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50, willpower: 50, intelligence: 50, personality: 50 }, health: 100, maxHealth: 100,
  crimeCommitted: 0, legalRep: {}, factionData: null, regionData: [] });
const classCfg = () => { const b = new Uint8Array(80); const v = new DataView(b.buffer); v.setUint16(52, 10, true); for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, 50, true); return b; };
const rig = (p) => ({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false,
    capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }),
    move: (feet, dx, dy, dz) => { feet[0] += dx; feet[2] += dz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
  fetchBytes: async (n) => { if (/^CLASS\d+\.CFG$/.test(n)) return classCfg(); throw new Error(`no ${n} in this pin`); },
  getTexture: async () => ({ getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 4 }),
  uploadRecordFrame: () => {}, currentMinute: () => 523530, currentPixelKey: () => '3,12',
  playerEntity: p, audio: null, onPlayerHurt: () => {}, rolls: () => 0.5, rand: () => 0.9, say: () => {},
});

/** The report's road: The Escort taken and its hunters the Dark Brotherhood's (the start-up's `pick one of`, rolled to
 *  `_S.14_`), its two Assassins minted as the host mints a wave (questFoeHost.js) and stood in the street's encounter pool
 *  eight metres up the road, hunting the player; the street's pool with the host's own fight (world.js: AreEnemiesNearby
 *  over both pools); a merchant caravan of the living world walking the same road, its leader a pace and a half ahead on
 *  the look ray; the caravan's report and the host's charge; and the road's strike as the host builds it. */
async function escortRoad() {
  const p = player();
  const machine = new QuestMachine({ nowSeconds: () => 0, showPopup() {}, getQuestSourceLines: () => null });
  const quest = machine.scheduleQuest(rd('vendor/dfu-quests/Quests/A0C00Y17.txt').split(/\r?\n/), 0, { rolls: () => 0.6 });
  const asked = { prompts: [], factions: [] };
  quest.hooks.changeLegalRep = (n) => changeLegalRep(p, REGION, n);   // world.js's quest seam: the region the player stands in
  quest.hooks.changeReputation = (id, n) => asked.factions.push(n);
  quest.hooks.showPrompt = (_q, _m, answer) => { asked.prompts.push(answer); return true; };
  machine.tick();
  const hunters = [...quest.resources.values()].find((r) => r.isFoe && r.symbol?.name === 'F.03');
  const foes = createExteriorFoes(rig(p));
  const assassins = [];
  for (const [i, h] of mintQuestFoeWave(machine, hunters, hunters.spawnCount).entries()) assassins.push(await foes.spawnFoe(hunters.foeType, [i * 1.5 - 0.75, 0, 8], { feetGiven: true, questBehaviour: h.behaviour, yaw: Math.PI }));
  for (let k = 0; k < 10; k++) foes.update(0.05, FEET, EYE);   // they see the player
  const guards = createCityGuards({ ...rig(p), fightHere: () => areEnemiesNearby([...guards.guards, ...foes.foes]) });
  // the road and its party
  const map = livingMap();
  const trip = partiesOver(map, 400, 470, { mpm: CALENDAR_MPM, memo: new Map() }).find((tr) => tr.kind === 'merchant' && tr.party.length >= 2 && !tr.enc && !tr.dive);
  assert.ok(trip, 'a merchant caravan on the road');
  let now = Math.floor((trip.outT0 + trip.outT1) / 2);
  const at = partyAt(trip, now);
  const rel = createRelations();
  const charged = [];
  const slain = new Set();
  let caravan = null;
  const merchant = trip.leader;
  const seats = [{ person: { living: { id: merchant.id, res: merchant } }, pos: [0, 0, 1.5] }];
  const roads = createLivingRoads({ world: map.world, mpm: CALENDAR_MPM, clock: () => now, baseRate: () => 0.2, sceneOf: (x, z) => [x / 40, 0, z / 40], here: () => ({ x: at.x, z: at.z }),
    sprites: { sync() {}, batches: () => [], persons: () => seats, bodyOf: () => null, clear() {} }, memo: new Map(), relations: () => rel,
    slay: (res, t) => { slain.add(res.id); caravan.slain(res, t); } });   // world.js livingRoadSlay: the hand's turn (the lives' own) and the road's report
  roads.frame(0.1, [0, 0, 0]);
  caravan = createCaravanHost({
    relations: () => rel, clock: () => now, day: (t) => Math.floor(t / 1440), roads: () => roads,
    findTrip: (res) => (trip.party.some((m) => m.id === res.id) ? trip : null), tripById: (id) => (id === trip.id ? trip : null),
    resOf: (id) => trip.party.find((m) => m.id === id) ?? null, slainAt: (res) => slain.has(res.id), deadAt: (res) => slain.has(res.id),
    stock: () => [], openTrade: () => true, openLoot: () => true, choose: () => {}, say: () => {},
    regionAt: () => REGION, charge: (region, crime) => { charged.push(crime); lowerRepForCrime(p, region, crime); },   // world.js: LowerRepForCrime (and the Brotherhood's one)
    here: () => null, level: () => 5, pay: () => {}, goldItem: (n) => n, online: () => false,
  });
  const strike = createRoadStrike({ roads: () => roads, open: () => true, collider: rig(p).collider, cityGuards: guards, hitEffects: { showBloodSplash: () => {} }, playerEntity: p });
  /** One swing, the host's three passes in its order (world.js): the encounter pool, the street's walkers (none here), the road. */
  const swing = async () => {
    const w = new PlayerWeapon({});
    if (foes.resolvePlayerHit(w, EYE, FWD, FEET, inView, null, {})) return 'a foe';
    return (await guards.resolveCivilianHit(w, EYE, FWD, FEET, [], { inViewFn: inView })) || strike(EYE, FWD);
  };
  /** The party reaches its town: the report carried in, and charged. */
  const toTown = () => { now = reportAt(trip, now); caravan.step(); };
  return { p, machine, quest, asked, foes, assassins, guards, roads, caravan, strike, swing, toTown, charged, slain, merchant, rel, trip };
}

test('ROAD-SPARE the report: the Brotherhood\'s Assassins hunt the escort; refused to them and killed, nothing is charged; and under Protect Bystanders the swing past them that meets the caravan\'s merchant is passed by - no deed, no Murder carried to the town, no name the watch knows (mutants: the road\'s spare unasked; a spared swing read as nobody; every blow at a traveller spared)', async () => {
  setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', true);
  const r = await escortRoad();
  const { p, assassins, foes, merchant } = r;
  assert.deepEqual(assassins.map((f) => [f.mobileType, f.isQuestFoe, f.ai.isHostile]), [[139, true, true], [139, true, true]], 'two Assassins, the quest\'s, hostile');
  assert.equal(areEnemiesNearby(foes.foes), true, 'a fight');
  // the swing that meets none of them falls on the road: the merchant on the ray, in reach - spared
  assert.equal(await r.swing(), ROAD_SPARED, 'the swing stops on the merchant');
  assert.deepEqual([[...r.slain], r.rel.reports().length], [[], 0], 'no deed, nothing reported');
  // "I choose to defend myself and my escort target": the hunters struck, the prompt answered No, the hunters killed
  foes.damageFoe(assassins[0], 1, FEET, FWD, { kind: 'melee' });
  foes.update(0.05, FEET, EYE); r.machine.tick();
  assert.equal(r.asked.prompts.length, 1, 'the questgiver asks: "are you going to turn me over?"');
  r.asked.prompts[0](false);
  for (let k = 0; k < 3; k++) r.machine.tick();
  assert.deepEqual(r.asked.factions, [-20], 'the Brotherhood thinks less of the player (`_S.19_`)');
  for (const f of assassins) foes.damageFoe(f, 10000, FEET, FWD, { kind: 'melee' });
  assert.deepEqual(assassins.map((f) => f.dead), [true, true]);
  assert.deepEqual([p.crimeCommitted, legalRepOf(p, REGION)], [0, 0], 'refused to the Brotherhood and its Assassins killed: no crime, the law untouched');
  r.toTown();
  assert.deepEqual([r.charged, legalRepOf(p, REGION), knownCriminal(p, REGION)], [[], 0, false], 'nothing carried to the town: the watch has no fine to ask');
  // no fight - the hunters dead before the swing - and a blow at the merchant is meant: DFU's one-hit civilian, the road's
  // report, the town's charge
  const calm = await escortRoad();
  for (const f of calm.assassins) calm.foes.damageFoe(f, 10000, FEET, FWD, { kind: 'melee' });
  assert.equal(areEnemiesNearby(calm.foes.foes), false);
  assert.equal(await calm.swing(), ROAD_STRUCK);
  assert.deepEqual([...calm.slain], [calm.merchant.id]);
  calm.toTown();
  assert.deepEqual([calm.charged, legalRepOf(calm.p, REGION)], [[CRIMES.Murder], -20], 'a Murder, charged at the town');
  assert.deepEqual([...r.slain], [], 'and the escort\'s merchant still walks');
});

test('ROAD-SPARE the bounty, measured: with the protection off a swing in the fight is DFU\'s - the merchant struck down, the road\'s Murder charged at the town (-20), the name the watch knows, and its stop\'s fine 600 gold - the report\'s "hefty fee of 500+" (mutants: the road\'s reach; the wall)', async () => {
  setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', false);
  try {
    const r = await escortRoad();
    assert.equal(areEnemiesNearby(r.foes.foes), true, 'in the fight');
    assert.equal(await r.swing(), ROAD_STRUCK, 'the swing past the Assassins struck the merchant down');
    assert.deepEqual([...r.slain], [r.merchant.id]);
    assert.equal(r.rel.reports()[0].crime, CRIMES.Murder, 'the road reports a Murder');
    assert.deepEqual([r.charged, legalRepOf(r.p, REGION)], [[], 0], 'not before the town');
    r.toTown();
    assert.deepEqual([r.charged, legalRepOf(r.p, REGION), knownCriminal(r.p, REGION)], [[CRIMES.Murder], -20, true]);
    assert.equal(challengeFine(r.p, REGION), 600, 'the watch\'s stop: "Pay a fine of 600 gold, or come with me."');
    // the road's own reach and wall still stand: a merchant past the reach, or behind a wall, is nobody's
    const far = await escortRoad();
    far.roads.talkSeats()[0].pos = [0, 0, 3];
    assert.equal(far.strike(EYE, FWD), false, 'past the reach');
    const walled = await escortRoad();
    const behind = createRoadStrike({ roads: () => walled.roads, open: () => true, collider: { raycast: () => 0.5 }, cityGuards: walled.guards, hitEffects: { showBloodSplash: () => {} }, playerEntity: walled.p });
    assert.equal(behind(EYE, FWD), false, 'a wall before them');
    assert.deepEqual([[...far.slain], [...walled.slain]], [[], []]);
  } finally { setValue('MeleeAttacks', 'MeleeAttackFriendlyProtection', true); }
});

test('ROAD-SPARE the host: world.js builds the road\'s strike over its own street pool (whose law it asks) and the open world alone, and offers it a swing that met nobody in the street - struck, it surfaces; spared, it whooshes and no door behind the traveller is bashed (AUDIT 29g\'s law); nobody, the door\'s (mutants: the struck answer unsurfaced; the open world unasked)', () => {
  const src = rd('src/scenes/world.js');
  assert.match(src, /const livingStrikeRoad = createRoadStrike\(\{ roads: \(\) => livingRoads, open: \(\) => livingWorldOn\(\) && _mode\(\) === 'exterior', collider, cityGuards, hitEffects, playerEntity \}\);/);
  const at = src.indexOf('{ onMurder: () => _crimeResponse(), onHitSound: guardHitSound, swing }).then((r) => {');
  assert.ok(at > 0, 'the civilian arm\'s tail');
  const body = src.slice(src.indexOf('{\n', at) + 1, src.indexOf("}).catch((e) => console.error('[civil]', e));", at));
  const tail = (r, road) => {
    const d = { bashed: 0, whoosh: 0, surfaced: 0, road: 0 };
    new Function('r', 'modes', 'audio', 'surfacePlayer', 'tallySwingSkills', 'swingSoundFor', 'weaponRig', 'playerEntity', 'cam', 'lookFwd', 'livingStrikeRoad', body)(
      r, { attemptExteriorDoorBash: () => { d.bashed++; return true; } }, { playOneShot: () => { d.whoosh++; } }, () => { d.surfaced++; }, () => {},
      () => 'swing', { playerWeapon: {} }, {}, { pos: [0, 1.6, 0] }, [0, 0, 1], () => { d.road++; return road; });
    return d;
  };
  assert.deepEqual(tail(false, ROAD_STRUCK), { bashed: 0, whoosh: 0, surfaced: 1, road: 1 }, 'a traveller struck down');
  assert.deepEqual(tail(false, ROAD_SPARED), { bashed: 0, whoosh: 1, surfaced: 0, road: 1 }, 'stopped on a spared traveller');
  assert.deepEqual(tail(false, false), { bashed: 1, whoosh: 0, surfaced: 0, road: 1 }, 'nobody on the road: the door\'s');
  assert.deepEqual(tail({ spared: true }, ROAD_STRUCK), { bashed: 0, whoosh: 1, surfaced: 0, road: 0 }, 'stopped on a spared walker: the road never asked');
  assert.deepEqual(tail({ crime: 'murder' }, ROAD_STRUCK), { bashed: 0, whoosh: 0, surfaced: 1, road: 0 }, 'a townsperson struck: the road never asked');
});
