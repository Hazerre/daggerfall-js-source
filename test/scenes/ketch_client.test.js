// AUDIT KETCH L1-6 (2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 1): THE SHIP I RIDE UP TO - the one the room's
// `st` named me of this voyage, whoever leads the party since; else my party leader's, else my own. A `st` keeps it only
// from the ship under me, naming me. tools/mutants/ketch_client.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ketchShipChoice, ketchShipKept, KT_SHIP_KEY } from '../../src/scenes/ketch/ketchClient.js';

const AT = { n: 3, owner: 'aaaaaaaaaaaaaaaa', key: 'kt:00000003.aaaaaaaaaaaaaaaa' };

test('KETCH MY SHIP THIS VOYAGE: the room\'s `st` naming me keeps the ship under me; one not naming me, another voyage\'s, or no ship keeps nothing (mutants: kept without my name)', () => {
  assert.equal(KT_SHIP_KEY, 'ketch.myShip');
  const st = { k: 'st', n: 3, cr: [['acct-a', 'A'], ['acct-b', 'B']] };
  assert.deepEqual(ketchShipKept(st, 'acct-b', AT), { n: 3, a: 'acct-b', o: AT.owner });
  assert.equal(ketchShipKept(st, 'acct-c', AT), null, 'not of its crew');
  assert.equal(ketchShipKept({ ...st, n: 2 }, 'acct-b', AT), null, 'another voyage\'s');
  assert.equal(ketchShipKept({ ...st, k: 'cl' }, 'acct-b', AT), null);
  assert.equal(ketchShipKept(st, 'acct-b', null), null);
  assert.equal(ketchShipKept(st, null, AT), null);
});

test('KETCH THE SHIP I RIDE UP TO: the one I was taken into, though the lead has passed on; else the leader\'s, else my own - never another voyage\'s ship, never another account\'s (AUDIT KETCH L1-6; mutants: the leader over the ship kept; another voyage\'s ship ridden to)', () => {
  const kept = { n: 3, a: 'acct-b', o: AT.owner };
  assert.deepEqual(ketchShipChoice(3, 'acct-b', 'acct-c', kept), { owner: AT.owner }, 'the lead passed to c: still a\'s ship');
  assert.deepEqual(ketchShipChoice(4, 'acct-b', 'acct-c', kept), { captain: 'acct-c' }, 'next voyage: the leader\'s');
  assert.deepEqual(ketchShipChoice(3, 'acct-d', 'acct-c', kept), { captain: 'acct-c' }, 'another account signed in');
  assert.deepEqual(ketchShipChoice(3, 'acct-b', null, null), { captain: 'acct-b' }, 'alone: my own');
  assert.deepEqual(ketchShipChoice(3, 'acct-b', 'acct-a', { ...kept, o: '' }), { captain: 'acct-a' });
});
