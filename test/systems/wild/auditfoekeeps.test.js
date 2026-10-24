// AUDIT FOE-KEEPS (2026-10-24, bible/01-Overview/audits/Audit-Foe-Keeps.md - the owner, of FOE-KEEPS: "Audit this").
// Five cold lanes on frozen snapshots of 099949918; each finding fixed here is pinned under its id.
//   H1 (L1, P1, E5): a kill whose referee word came late - a hidden tab hears its socket and runs no frame, or a foe's
//     blow killed me on my own machine while a player's, in flight, reached the referee first - was read as a foe's
//     death: the remains took the kill's tenth and the rise the usual tenth again, under "You keep what you carry".
//     The kill is now the referee's word itself, whenever it comes (wildZone.js wildDeathAtHand), and the rise reads it.
//   H2: the same word makes a zone's death of one whose first dead frame found no room (the socket reconnecting).
//   H4: a Resurrect after a kill said the gold it claimed stayed in the purse - it lay in the remains.
//   O1, H5: the foe's-death line said "You keep what you carry" over the tenth the same death claims, and over a
//     revenant's theft at the rise - now "Nothing dropped".
//   O4: the tutorial's open-zone page named the mountains alone and said the bag and cart lost whole at a kill.
//   O5, N6: Hungarian's article before a vowel; Polish "we" before "Wr".
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setWildDeath, wildDeath, wildDeathLines, wildDeathAtHand, wildDeathKill, wildFallHeard, WILD_TEXT } from '../../../src/systems/wild/wildZone.js';
import * as tm from '../../../src/systems/textManager.js';
import { TUTORIALS } from '../../../src/systems/tutorialCatalogue.js';

const rd = (p) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8');
const FELL = { r: '0123456789ab', by: 'peer-0002', room: 'world:400,120', at: 1 };

test('AUDIT FOE-KEEPS H1 THE KILL IS THE REFEREE\'S WORD, WHENEVER IT COMES: heard before the first dead frame, it stands through it; heard after, it makes the death a kill and names its killer on the screen; a take against my receipt makes one; only the death\'s end clears it - and a foe\'s death is none (mutants: the word unkept; the screen unnamed; the take no kill; the clear left out)', () => {
  setWildDeath(null);
  // a foe's death: no word
  setWildDeath({ killer: null, dropped: 0 });
  assert.equal(wildDeathKill(), false);
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathKept(), WILD_TEXT.deathHold]);
  setWildDeath(null);
  // the word before the first dead frame (the frame found no fresh name - the old 15 s window)
  wildDeathAtHand(FELL, 'Borin');
  assert.equal(wildDeathKill(), true);
  assert.deepEqual(wildFallHeard(), FELL, 'the fall kept for the worn offer');
  setWildDeath({ killer: null, dropped: 0 });
  assert.equal(wildDeathKill(), true, 'the first dead frame keeps the word');
  assert.equal(wildDeath().kill, true);
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathPvp(null), WILD_TEXT.deathHold], 'a kill on the screen - never "Nothing dropped"');
  setWildDeath(null);
  assert.deepEqual([wildDeathKill(), wildFallHeard(), wildDeath()], [false, null, null], 'the death\'s end clears it');
  // the word after the first dead frame (a foe's blow first on my machine, a player's first at the referee)
  setWildDeath({ killer: null, dropped: 0 });
  wildDeathAtHand(FELL, 'Borin');
  assert.deepEqual([wildDeathKill(), wildDeath().killer, wildDeath().kill], [true, 'Borin', true], 'named from then on');
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathPvp('Borin'), WILD_TEXT.deathHold]);
  wildDeathAtHand(null, 'Cyrus');
  assert.equal(wildDeath().killer, 'Borin', 'a second word renames nobody');
  assert.deepEqual(wildFallHeard(), FELL, 'and keeps the fall');
  setWildDeath(null);
  // a take against my receipt, the word itself missed (a socket that reconnected between the two)
  setWildDeath({ killer: null, dropped: 0 });
  setWildDeath({ killer: null, kill: true, dropped: 3 });
  assert.equal(wildDeathKill(), true);
  assert.deepEqual(wildDeathLines(), [WILD_TEXT.deathPvp(null), WILD_TEXT.deathDrop(3), WILD_TEXT.deathHold]);
  setWildDeath(null);
});

test('AUDIT FOE-KEEPS H1 H2 H4 THE HOST: the referee\'s fall goes to the zone\'s word, never a window the first dead frame must meet; the rise skips the usual tenth at a kill and rises out of the zone at one whose death found no room; a take is a kill; a Resurrect after a kill spares nothing it did not (mutants: the window back; the rise reading the screen\'s name; the take no kill; the Resurrect reading the stated loss)', () => {
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('      wildDeathAtHand({ r: g.r, by: g.by, room, at: Date.now() }, peerName(g.by));'), 'my fall, the referee\'s word, kept beside the kill');
  assert.ok(!/_wildFell\b/.test(w), 'no second copy of the fall in the host');
  assert.ok(w.includes('    const fell = wildFallHeard();'), 'the first dead frame reads any fall since the last rise');
  assert.ok(!w.includes('15_000 ? _wildFell'), 'no 15-second window');
  assert.ok(w.includes('    const wildRise = !!wildDeath() || wildDeathKill(), wildKilled = wildDeathKill();'), 'the rise reads the kill');
  assert.ok(w.includes('    if (dd) setWildDeath({ killer: dd.killer, kill: true, dropped:'), 'my take is a kill');
  const rez = /function resurrectInPlace\(rez\) \{[\s\S]*?\n {2}\}/.exec(w)?.[0] ?? '';
  assert.match(rez, /if \(_respawning\) return;\n\s+const spared = wildDeathKill\(\) \? 0 : statedDeathLoss\(\) \?\? 0;[^\n]*\n\s+wildGhostEnd\(\);/, 'read before the death ends');
  assert.ok(rez.includes('if (spared > 0) townTalk.say(RESURRECT_TEXT.spared(spared));'));
});

test('AUDIT FOE-KEEPS O1 H5 O4 O5 N6 THE WORDS: a foe\'s death says nothing dropped - true beside the tenth it claims and a revenant\'s theft; the tutorial names both zones, the cart only while it is with you, the tenth of a kill and of any other death, in the player\'s language and within a popup\'s sixty words (TUT1); Hungarian\'s "Az" and Polish "we" (mutants: the page\'s words read once)', () => {
  assert.equal(WILD_TEXT.deathKept(), 'Nothing dropped. Only another player\'s kill drops what you carry.');
  assert.doesNotMatch(WILD_TEXT.deathKept(), /keep/i, 'never "you keep" - the same death claims a tenth of the purse');
  const page = () => TUTORIALS.find((p) => p.id === 'wild-zone');
  assert.deepEqual(page().body, [
    'Players may fight one another in the Wrothgarian Mountains and on the open Eltheric Ocean, where monsters are tougher and spoils richer.',
    'If another player kills you there, your bag drops (your cart too, if with you) with a tenth of your gold, and they may take one worn item. Any other death costs the usual tenth.',
  ]);
  tm.patchLocaleTable('de', 'Port_Strings', tm.loadStringTableCsv(rd('locales/de/Port_Strings.csv')));
  try {
    tm.setLocale('de');
    assert.match(page().body[0], /^In den Wrothgarian Mountains und auf dem offenen Eltheric-Ozean dürfen Spieler/);
    assert.equal(WILD_TEXT.deathKept(), 'Nichts fällt zu Boden. Was du trägst, fällt nur, wenn dich ein Spieler tötet.');
  } finally { tm.setLocale(tm.BASE_LOCALE); }
  assert.match(rd('locales/hu/Port_Strings.csv'), /^sea\.wild\.chipTip,"Az \{word\}-óceán /m);
  assert.match(rd('locales/pl/Port_Strings.csv'), /^wild\.zone\.enter,"Wkraczasz we \{zone\}, /m);
  // a short line: the classic face draws it unwrapped (AUDIT FOE-KEEPS O2 - the Indonesian ran past a phone's width)
  for (const lang of ['id', 'de', 'fi', 'fr', 'tr']) {
    const row = tm.loadStringTableCsv(rd(`locales/${lang}/Port_Strings.csv`)).find(([k]) => k === 'wild.death.kept');
    assert.ok(row && row[1].length <= 80, `${lang}: ${row?.[1].length}`);
  }
});
