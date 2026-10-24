// SOUNDSCAPE (2026-10-24; bible/08-Audio/Audio.md SOUNDSCAPE): THE BEDS THE PORT MAKES (systems/soundscape/soundBeds.js) -
// the sea's swell, the wash past a hull, the wind in the rigging, the surf, the lap and the marsh, each seeded noise cut
// by a chain of the wind bed's own sections. Each bed its length at its rate, levelled to its RMS, the same every boot
// and another for another seed; SEAMLESS - its last sample runs into its first as any sample into the next (the chain
// run twice, the second pass kept), where one pass leaves a step at the seam; each bed's character (the swell darkest,
// the surf's spray brightest); made in the page's idle time, one at a time, never inside a frame - a test's page with
// no idle callbacks makes it at once - and a maker with nothing to make it of yet asked again.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_BEDS, BED_RATE, BED_RATE_LOW, bedSamples, bedOf, ensureMade, ensureBed, _resetMade } from '../../../src/systems/soundscape/soundBeds.js';

const rms = (x) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const zcHz = (x, rate) => { let z = 0; for (let i = 1; i < x.length; i++) if ((x[i] > 0) !== (x[i - 1] > 0)) z++; return z / 2 / (x.length / rate); };

test('SOUNDSCAPE THE BEDS: six, each its length at its own rate (a bed with nothing over 2.5 kHz at DAGGER.SND\'s 11025), levelled to its RMS, the same every boot, another for another seed (mutants: a bed\'s rate; the levelling; the seed unused)', () => {
  assert.deepEqual(Object.keys(SOUND_BEDS), ['sea:swell', 'sea:wash', 'sea:rigging', 'shore:surf', 'shore:lap', 'wild:marsh']);
  assert.deepEqual(Object.fromEntries(Object.entries(SOUND_BEDS).map(([k, b]) => [k, [b.seconds, b.rate, b.rms]])), {
    'sea:swell': [12, BED_RATE_LOW, 0.05], 'sea:wash': [9, BED_RATE, 0.04], 'sea:rigging': [10, BED_RATE_LOW, 0.03],
    'shore:surf': [12, BED_RATE, 0.05], 'shore:lap': [8, BED_RATE_LOW, 0.03], 'wild:marsh': [10, BED_RATE, 0.025],
  });
  assert.deepEqual([BED_RATE, BED_RATE_LOW], [22050, 11025]);
  for (const [key, spec] of Object.entries(SOUND_BEDS)) {
    const s = bedSamples(spec);
    assert.equal(s.length, spec.seconds * spec.rate, key);
    assert.ok(Math.abs(rms(s) - spec.rms) < 1e-6, `${key} ${rms(s)}`);
    assert.deepEqual(bedSamples(spec).subarray(0, 64), s.subarray(0, 64), `${key}: the same every boot`);
    const other = bedSamples({ ...spec, seed: spec.seed + 1 });
    assert.ok(other.some((v, i) => v !== s[i]), `${key}: another seed, another bed`);
  }
});

test('SOUNDSCAPE THE SEAM: every bed loops with no step at its seam - the last sample into the first no larger than four of its typical steps (a step that size inside a bed is rarer than one in five hundred) - where one pass of its chain from rest leaves one (mutants: one pass; the state not carried from the first pass into the second)', () => {
  for (const [key, spec] of Object.entries(SOUND_BEDS)) {
    const x = bedSamples(spec);
    let mean = 0;
    for (let i = 1; i < x.length; i++) mean += Math.abs(x[i] - x[i - 1]);
    mean /= x.length - 1;
    const seam = Math.abs(x[0] - x[x.length - 1]);
    assert.ok(seam <= 4 * mean, `${key}: seam ${seam} against a typical step ${mean}`);
  }
});

test('SOUNDSCAPE THE BEDS\' CHARACTER: the swell the darkest (its body under 500 Hz), the rigging two narrow resonances a fifth apart, the surf\'s spray over its body the brightest (mutants: the swell\'s low-pass; the rigging\'s fifth; the surf\'s spray)', () => {
  const z = Object.fromEntries(Object.entries(SOUND_BEDS).map(([k, spec]) => [k, zcHz(bedSamples(spec), spec.rate)]));
  assert.ok(z['sea:swell'] < 500, `the swell: ${z['sea:swell']}`);
  assert.ok(z['sea:swell'] < z['shore:lap'] && z['shore:lap'] < z['sea:wash'] && z['sea:wash'] < z['shore:surf'], JSON.stringify(z));
  const rig = SOUND_BEDS['sea:rigging'].layers;
  assert.ok(Math.abs(rig[1].chain[0][1] / rig[0].chain[0][1] - 1.5) < 0.01, 'a fifth apart');
  assert.ok(rig[0].chain[0][2] >= 12 && rig[1].chain[0][2] >= 12, 'narrow');
});

test('SOUNDSCAPE MADE IN IDLE TIME: a sound the port makes is made in the page\'s idle time, one at a time, and answered false until it stands; then registered under its key; a page with no idle callbacks makes it at once; a maker with nothing to make it of yet (no archive) answered false and asked again; bedOf made once (mutants: made inside the frame; two at once; a null cached)', () => {
  _resetMade();
  const registered = [];
  const engine = { registerSamples: (key, samples, rate) => { registered.push([key, samples.length, rate]); return true; } };
  const queue = [];
  const idle = (fn, o) => { queue.push([fn, o]); };
  assert.equal(ensureBed(engine, 'sea:swell', { idle }), false, 'not made yet');
  assert.equal(ensureBed(engine, 'sea:wash', { idle }), false, 'and one at a time');
  assert.equal(queue.length, 1);
  assert.deepEqual(queue[0][1], { timeout: 1000 });
  assert.deepEqual(registered, [], 'nothing inside the frame');
  queue.shift()[0]();
  assert.equal(ensureBed(engine, 'sea:swell', { idle }), true);
  assert.deepEqual(registered, [['sea:swell', 12 * 11025, 11025]]);
  assert.equal(ensureBed(engine, 'sea:wash', { idle }), false, 'the next one queued now');
  assert.equal(queue.length, 1);
  assert.equal(ensureBed(engine, 'nope', { idle }), false, 'no such bed');
  _resetMade();
  assert.equal(ensureBed(engine, 'shore:lap', { idle: null }), true, 'no idle callbacks: made at once');
  let made = 0;
  assert.equal(ensureMade(engine, 'x:y', () => { made++; return null; }, 22050, { idle: null }), false, 'nothing to make it of');
  assert.equal(ensureMade(engine, 'x:y', () => { made++; return new Float32Array(4); }, 22050, { idle: null }), true, 'asked again, made');
  assert.equal(made, 2);
  assert.equal(bedOf('sea:rigging'), bedOf('sea:rigging'), 'made once');
  assert.equal(bedOf('nope'), null);
  assert.equal(ensureBed({}, 'sea:swell', { idle: null }), false, 'no engine to register on');
  _resetMade();
});
