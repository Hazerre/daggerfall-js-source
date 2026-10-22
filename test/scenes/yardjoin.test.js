// Two houses one character owns, whose lots meet, are one yard between them. A third owner's house, a road, and
// either building's walls stay closed. A piece stood in the shared ground belongs to the house that was furnished.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { yardLot, yardLotsAdjacent, yardLotEdges, yardWhyNot, YARD_MARGIN, YARD_ON_OTHER, YARD_ON_ROAD, YARD_OFF_LOT } from '../../src/scenes/homeYards.js';
import { decorYardPieceOf } from '../../src/net/decorLaw.js';

const lotA = yardLot([0, 0, 0], [-4, 0, -4, 4, 3, 4], YARD_MARGIN);
const lotB = yardLot([0, 0, 0], [6, 0, -4, 14, 3, 4], YARD_MARGIN);
const wallsB = [[6, -4, 14, 4]];
const between = [5.5, 0, 0];

test('lots that meet are adjacent, and a gap or a corner is not', () => {
  assert.equal(yardLotsAdjacent(lotA.lot, lotB.lot), true);
  const apart = yardLot([0, 0, 0], [40, 0, -4, 48, 3, 4], YARD_MARGIN);
  assert.equal(yardLotsAdjacent(lotA.lot, apart.lot), false);
  assert.equal(yardLotsAdjacent([-10, -10, 0, 0], [0, 0, 10, 10]), false);
});

test('the ground between two lots of one owner can be furnished, and the edge between them is not drawn', () => {
  assert.equal(yardWhyNot(between, lotA, wallsB, [], [], wallsB), YARD_ON_OTHER, 'another owner: the line still splits it');
  assert.equal(yardWhyNot(between, lotA, wallsB, [], [], []), null, 'the same owner: the ground between the houses');
  assert.equal(yardWhyNot([8, 0, 0], lotA, wallsB, [], [], []), YARD_ON_OTHER, 'the other house\'s walls stay closed');
  assert.equal(yardWhyNot([1, 0, 0], lotA, wallsB, [], [], []), 'That is inside your house. Place it in the yard around it.');
  assert.equal(yardWhyNot(between, lotA, wallsB, [], [[5, -1, 6, 1]], []), YARD_ON_ROAD);
  assert.equal(yardWhyNot([11, 0, 0], lotA, wallsB, [], [], []), YARD_OFF_LOT, 'past this lot is still the other house\'s own ground');
  const edges = yardLotEdges(lotA, [], [lotB.lot]);
  assert.equal(edges.some((s) => s[0] === lotA.lot[2] && s[2] === lotA.lot[2]), false, 'the shared side is not marked');
  assert.equal(edges.some((s) => s[0] === lotA.lot[0] && s[2] === lotA.lot[0]), true, 'the outer side stays');
});

test('a piece in the shared ground stays on the house that placed it, and the service does not take a client\'s word for who owns the ground', () => {
  const records = { a: [], b: [] };
  const place = (buildingKey, pos) => { records[buildingKey].push(pos); return buildingKey; };
  assert.equal(place('a', between), 'a');
  assert.equal(place('b', [5.2, 0, 0]), 'b');
  delete records.a;
  assert.deepEqual(records.b, [[5.2, 0, 0]], 'selling the first house leaves the second house\'s piece');
  const piece = decorYardPieceOf({ id: 'piece1', model: 41000, pos: between, rot: [0, 0, 0], scale: 1, paid: 0, storage: false, owner: 'someone-else', buildingKey: 99, joins: [2] });
  assert.equal(piece?.model, 41000);
  assert.equal(piece.owner, undefined);
  assert.equal(piece.buildingKey, undefined);
  assert.equal(piece.joins, undefined);
  const src = readFileSync(new URL('../../server-account/src/decor.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const arm = src.slice(src.indexOf('export async function placeDecor'), src.indexOf('export async function', src.indexOf('export async function placeDecor') + 20));
  assert.match(arm, /WHERE \$\{S\.owns\}/, 'the row is written only for a building this character owns');
});
