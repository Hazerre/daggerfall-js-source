// INTRO3 (2026-10-14, Mac: "With the main menu music, is there anyway to recreate it using the sound system daggerfall's
// music uses", then "you do it and it's for both"): THE MAIN THEME, WRITTEN AS NOTES (systems/introScore.js) and played
// by the game's own song player for the film and the menu (systems/introTheme.js). What the ear needs - the render's
// loudness, its peaks, the landmarks heard where the cue sheet puts them - is tools/introScoreProbe.mjs's, in a real
// browser; this file holds what node can: the song's shape as the producer mints it, the film's two landmarks on its
// bar lines, and the transcription as it was read off the recording. Mutants: tools/mutants/intro3.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  introThemeSong, introTick, introSeconds, INTRO_SONG, INTRO_SCORE_TPQ, INTRO_SECONDS_PER_TICK, INTRO_LEAD_TICKS,
  INTRO_PROGRAMS, INTRO_CHANNELS, INTRO_LEVEL, INTRO_PRESS, INTRO_SCORE_TABLES, FIRST_BAR, LAST_BAR, CLOUD_BAR, IMPACT_BAR,
  INTRO_VOICES, INTRO_KIT,
} from '../../src/systems/introScore.js';
import { midiNote } from '../../src/systems/gate/gateScore.js';
import { songLevel, songPress, songVoices, songKit } from '../../src/systems/song/songPlayer.js';
import { CLOUD_REVEAL_TIME, TITLE_IMPACT_TIME } from '../../src/ui/intro/introCue.js';

const song = introThemeSong();
const notes = song.events.filter((e) => e.type === 'noteOn');
const at = (tick, channel) => notes.filter((e) => e.tick === tick && e.channel === channel);
const CRASH = 49;

test('INTRO3: the film’s two landmarks are the score’s bar lines, to the millisecond, and the song strikes them', () => {
  assert.equal(IMPACT_BAR - CLOUD_BAR, 4, 'the cloud break and the logo’s landing are four bars apart, as in the recording');
  assert.ok(Math.abs(introSeconds(CLOUD_BAR) - CLOUD_REVEAL_TIME) < 0.001, `cloud break at ${introSeconds(CLOUD_BAR)}`);
  assert.ok(Math.abs(introSeconds(IMPACT_BAR) - TITLE_IMPACT_TIME) < 0.001, `impact at ${introSeconds(IMPACT_BAR)}`);
  assert.equal(INTRO_LEAD_TICKS, 68);
  assert.ok(Math.abs(song.beatsPerMinute - 128.755) < 0.001, `${song.beatsPerMinute} BPM`);
  for (const [bar, root] of [[CLOUD_BAR, 'C3'], [IMPACT_BAR, 'G2']]) {
    const tick = introTick(bar);
    assert.ok(at(tick, INTRO_CHANNELS.kit).some((e) => e.note === CRASH), `a crash on bar ${bar}`);
    assert.ok(at(tick, INTRO_CHANNELS.hit).length >= 3, `the orchestra hit's chord on bar ${bar}`);
    assert.ok(at(tick, INTRO_CHANNELS.timpani).some((e) => e.note === midiNote(root) && e.velocity >= 115), `the timpani's ${root} on bar ${bar}`);
    // the riser climbs to its loudest on the bar line itself
    const swell = song.events.filter((e) => e.type === 'controller' && e.channel === INTRO_CHANNELS.swell && e.tick > tick - 4 * INTRO_SCORE_TPQ && e.tick <= tick);
    assert.ok(swell.length >= 8, `a swell into bar ${bar}`);
    assert.equal(swell.at(-1).tick, tick); assert.equal(swell.at(-1).value, 127);
    for (let i = 1; i < swell.length; i++) assert.ok(swell[i].value >= swell[i - 1].value, 'the swell only rises');
  }
  // nothing else in the film's first 22 s is struck as hard as the two landmarks
  const crashes = notes.filter((e) => e.channel === INTRO_CHANNELS.kit && e.note === CRASH && e.tick < introTick(IMPACT_BAR + 2)).map((e) => e.tick);
  assert.deepEqual(crashes, [introTick(CLOUD_BAR), introTick(IMPACT_BAR)]);
});

test('INTRO3: the song is the shape the game’s player plays - sorted, in range, every voice given its program at tick 0', () => {
  assert.equal(song.name, INTRO_SONG);
  assert.equal(song.secondsPerTick, INTRO_SECONDS_PER_TICK);
  assert.equal(song.durationTicks, introTick(LAST_BAR + 1));
  assert.equal(song.seamless, true, 'it loops on its bar line, as the recording looped');
  assert.equal(songLevel(song), INTRO_LEVEL);
  assert.deepEqual(songPress(song), { threshold: -14, knee: 12, ratio: 3, attack: 0.012, release: 0.25, out: 2.6, ceiling: -1 });
  assert.equal(INTRO_PRESS.ceiling, -1);
  const rank = { programChange: 0, controller: 0, noteOn: 1 };
  for (let i = 1; i < song.events.length; i++) {
    const a = song.events[i - 1], b = song.events[i];
    assert.ok(a.tick < b.tick || (a.tick === b.tick && rank[a.type] <= rank[b.type]), `event ${i} out of order`);
  }
  for (const e of song.events) assert.ok(e.tick >= 0 && e.tick < song.durationTicks && e.channel >= 0 && e.channel < 16);
  for (const e of notes) {
    assert.ok(e.velocity >= 1 && e.velocity <= 127 && Number.isInteger(e.velocity));
    assert.ok(e.duration >= 1 && Number.isInteger(e.duration) && e.note >= 0 && e.note <= 127);
  }
  const programs = new Map(song.events.filter((e) => e.type === 'programChange').map((e) => [e.channel, [e.tick, e.program]]));
  for (const [voice, channel] of Object.entries(INTRO_CHANNELS)) {
    if (voice === 'kit') continue;
    assert.deepEqual(programs.get(channel), [0, INTRO_PROGRAMS[voice]], `${voice}'s program at tick 0`);
  }
  for (const channel of new Set(notes.map((e) => e.channel))) assert.ok(channel === 9 || programs.has(channel), `channel ${channel} sounds without a program`);
  // one note a key a moment (the gate score's law)
  const keys = new Set();
  for (const e of notes) { const k = `${e.tick}/${e.channel}/${e.note}`; assert.ok(!keys.has(k), `a doubled strike ${k}`); keys.add(k); }
  assert.equal(introThemeSong(), song, 'made once');
});

test('INTRO3: the transcription - every bar’s harmony, the theme as it was read, every melody bar four beats, in G minor', () => {
  const { HARMONY, MELODY, CHORDS } = INTRO_SCORE_TABLES;
  for (let m = FIRST_BAR; m <= LAST_BAR; m++) {
    assert.equal(HARMONY[m]?.length, 2, `bar ${m} has its two half bars`);
    for (const c of HARMONY[m]) assert.ok(CHORDS[c], `bar ${m}: ${c} is a chord the score voices`);
  }
  for (const [m, bar] of Object.entries(MELODY)) {
    assert.ok(Math.abs(bar.reduce((sum, [, beats]) => sum + beats, 0) - 4) < 1e-9, `melody bar ${m} is four beats`);
  }
  // the recording's landmarks in its harmony: the held C major of the cloud break, G minor on the impact
  assert.deepEqual([2, 3, 4, 5].map((m) => HARMONY[m]), [['C', 'C'], ['C', 'C'], ['C', 'C'], ['C', 'C']]);
  assert.deepEqual(HARMONY[IMPACT_BAR], ['Gm', 'Gm']);
  // the theme's first statement, as it was read off the recording (bars 8-13: i - VII i - iv VII - i v - VI - VII i)
  assert.deepEqual([8, 9, 10, 11, 12, 13].map((m) => HARMONY[m]), [['Gm', 'Gm'], ['F', 'Gm'], ['Cm', 'F'], ['Gm', 'Dm'], ['Eb', 'Eb'], ['F', 'Gm']]);
  assert.deepEqual([8, 9, 10, 11, 12].map((m) => MELODY[m]), [
    [['r', 1.25], ['G4', 0.25], ['A4', 0.5], ['Bb4', 0.5], ['A4', 0.5], ['Bb4', 1]],
    [['C5', 0.75], ['C5', 0.25], ['F5', 1], ['D5', 1], ['D5', 0.5], ['Bb4', 0.25], ['D5', 0.25]],
    [['Eb5', 2], ['C5', 1], ['A4', 1]],
    [['Bb4', 0.75], ['Bb4', 0.5], ['C5', 0.25], ['Bb4', 0.5], ['A4', 1], ['F4', 1]],
    [['G4', 3], ['r', 1]],
  ]);
  // every note of the melody is G minor's, but the F-sharp - and that only over the dominant, D
  const minor = new Set([7, 9, 10, 0, 2, 3, 5].map((pc) => pc % 12));
  for (const [m, bar] of Object.entries(MELODY)) {
    let beat = 0;
    for (const [n, beats] of bar) {
      if (n !== 'r') {
        const pc = midiNote(n) % 12, chord = HARMONY[m][beat < 2 ? 0 : 1];
        assert.ok(minor.has(pc) || (pc === 6 && (chord === 'D' || HARMONY[m].includes('D'))), `bar ${m} beat ${beat}: ${n} over ${chord}`);
      }
      beat += beats;
    }
  }
});

test('INTRO3: the horn plays the melody where the bar puts it, the band follows the harmony, and the opening swells from quiet', () => {
  const { HARMONY, MELODY, CHORDS } = INTRO_SCORE_TABLES;
  for (const m of [6, 8, 9, 47, 71]) {
    const want = [];
    let beat = 0;
    for (const [n, beats] of MELODY[m]) { if (n !== 'r') want.push([introTick(m, beat), midiNote(n)]); beat += beats; }
    const got = notes.filter((e) => e.channel === INTRO_CHANNELS.horn && e.tick >= introTick(m) && e.tick < introTick(m + 1)).map((e) => [e.tick, e.note]);
    assert.deepEqual(got, want, `the horn in bar ${m}`);
  }
  // the contrabass sits on each half bar's root, as the recording's bass stem does (bar 59-60, the breakdown, has none)
  for (let m = 8; m <= 58; m++) {
    for (const [half, name] of [[0, HARMONY[m][0]], [2, HARMONY[m][1]]]) {
      if (half === 2 && HARMONY[m][0] === name) continue;
      assert.ok(at(introTick(m, half), INTRO_CHANNELS.contrabass).some((e) => e.note === midiNote(CHORDS[name].root)), `bar ${m}.${half}: the root of ${name}`);
    }
  }
  assert.equal(notes.filter((e) => e.channel === INTRO_CHANNELS.contrabass && e.tick >= introTick(59) && e.tick < introTick(61)).length, 0, 'the breakdown drops the bass');
  // the opening: the pads begin low and are at their full level by the rise
  const strings = song.events.filter((e) => e.type === 'controller' && e.controller === 7 && e.channel === INTRO_CHANNELS.strings);
  assert.equal(strings[0].tick, 0); assert.ok(strings[0].value < 50);
  const atRise = strings.filter((e) => e.tick <= introTick(0)).at(-1);
  assert.ok(atRise.value >= 100, `the strings at ${atRise.value} by the rise`);
  for (const e of strings.filter((x) => x.tick > 0 && x.tick < introTick(0))) assert.ok(e.value <= atRise.value);
});

test('INTRO3b: not flat - every section its own voice (the bed an ensemble, spread), every drum its own skin, the press letting a drum through, the halo over the choir where the band opens out, the low brass’s braam under every brass bar and with every hit, the timpani on three, the cellos on every step at the fullest, the snare rolls, and a swell into every landmark and turn', () => {
  const { HARMONY, CHORDS } = INTRO_SCORE_TABLES;
  const voices = songVoices(song), kit = songKit(song);
  assert.ok(voices && kit, 'the song carries its own voices and kit');
  for (const [voice, channel] of Object.entries(INTRO_CHANNELS)) {
    if (voice === 'kit') continue;
    assert.deepEqual(voices[channel], { ...INTRO_VOICES[voice] }, `${voice}'s voice, in range as written`);
  }
  for (const voice of ['strings', 'violins', 'choir', 'pad', 'halo', 'brass']) assert.ok(INTRO_VOICES[voice].unison >= 3 && INTRO_VOICES[voice].spread >= 0.4, `${voice} is an ensemble, spread`);
  assert.equal(INTRO_VOICES.contrabass.sub, undefined, 'no sub under the contrabass: 24 Hz at G1, under the floor');
  for (const e of notes.filter((x) => x.channel === INTRO_CHANNELS.kit)) assert.ok(kit.has(e.note), `drum ${e.note} has its own skin`);
  assert.ok(kit.get(87).click > 0 && kit.get(87).decay >= 1, 'the taiko is long, with its beater');
  assert.ok(kit.get(38).body > 0, 'the snare is a crack over a skin');
  assert.ok(kit.get(49).decay >= 2, 'the crash is long');
  assert.equal(songPress(song).attack, 0.012, 'the press lets a drum’s first 12 ms through');
  // the halo: the choir's chord an octave up where the band opens out (bar 14) and over the cloud break; none at the theme's entry
  const halo = (m) => at(introTick(m), INTRO_CHANNELS.halo).map((e) => e.note).sort((a, b) => a - b);
  const over = (chord) => CHORDS[chord].choir.map((n) => midiNote(n) + 12).sort((a, b) => a - b);
  assert.deepEqual(halo(14), over(HARMONY[14][0]));
  assert.deepEqual(halo(CLOUD_BAR), over('C'));
  assert.deepEqual(halo(8), []);
  // the braam: the low brass an octave under the section's bottom note - under a brass bar's second half (18) and a bar
  // that is no turn (45), with the hit on a turn (41), on the impact
  const braam = (m, beat, chord) => at(introTick(m, beat), INTRO_CHANNELS.brass).some((e) => e.note === midiNote(CHORDS[chord].brass[0]) - 12);
  assert.ok(braam(18, 2, HARMONY[18][1]), 'bar 18, the second half: the braam under the section');
  assert.ok(braam(45, 0, HARMONY[45][0]), 'bar 45: the braam under the section');
  assert.ok(braam(41, 0, 'Gm'), 'bar 41: the braam with the hit');
  assert.ok(braam(IMPACT_BAR, 0, 'Gm'), 'the impact: the braam');
  assert.ok(!braam(9, 0, HARMONY[9][0]), 'bar 9 has no brass');
  // the suspended cymbal's wash: soft crashes on one and three under the groove (bar 9), on every beat at the fullest (bar 44), none under the low drums alone (bar 7)
  const wash = (m) => notes.filter((e) => e.channel === INTRO_CHANNELS.kit && e.note === 49 && e.tick >= introTick(m) && e.tick < introTick(m + 1)).map((e) => (e.tick - introTick(m)) / INTRO_SCORE_TPQ);
  assert.deepEqual(wash(9), [0, 2]); assert.deepEqual(wash(44), [0, 1, 2, 3]); assert.deepEqual(wash(7), []);
  assert.ok(notes.filter((e) => e.channel === INTRO_CHANNELS.kit && e.note === 49 && e.tick > introTick(9) && e.tick < introTick(10)).every((e) => e.velocity < 50), 'the wash is soft');
  // the timpani answers on three where the groove plays (bar 9), not where only the low drums do (bar 7)
  assert.ok(at(introTick(9, 2), INTRO_CHANNELS.timpani).some((e) => e.note === midiNote(CHORDS[HARMONY[9][1]].root) + 12));
  assert.equal(at(introTick(7, 2), INTRO_CHANNELS.timpani).length, 0);
  // the cellos: every step of the pulse where the drums are fullest (bar 44), the accents alone where they are not (bar 9)
  const cellos = (m) => notes.filter((e) => e.channel === INTRO_CHANNELS.cellos && e.tick >= introTick(m) && e.tick < introTick(m + 1)).length;
  assert.equal(cellos(44), 10); assert.equal(cellos(9), 6);
  // the snare rolls into the build's top and the last statement: sixteenths over the bar before, rising (the groove's own
  // snare on one and three stands over the roll where they meet - one note a key a moment)
  for (const [bar, beats] of [[55, 2], [67, 4]]) {
    const roll = notes.filter((e) => e.channel === INTRO_CHANNELS.kit && e.note === 38 && e.tick >= introTick(bar - 1, 4 - beats) && e.tick < introTick(bar));
    assert.equal(roll.length, beats * 4, `the roll into ${bar}`);
    const climbing = roll.filter((e) => (e.tick - introTick(bar - 1)) % (2 * INTRO_SCORE_TPQ) !== INTRO_SCORE_TPQ);
    for (let i = 1; i < climbing.length; i++) assert.ok(climbing[i].velocity > climbing[i - 1].velocity, 'the roll only rises');
  }
  // the swell: over the bar before each landmark and turn the strings climb back to their level on the bar line, having sunk through the bar before that
  for (const bar of [CLOUD_BAR, IMPACT_BAR, 8, 17, 41, 55, 61, 67]) {
    const cc7 = (from, to) => song.events.filter((e) => e.type === 'controller' && e.controller === 7 && e.channel === INTRO_CHANNELS.strings && e.tick >= from && e.tick <= to);
    const rise = cc7(introTick(bar - 1), introTick(bar)), sink = cc7(introTick(bar - 2), introTick(bar - 1));
    assert.ok(rise.length >= 9 && sink.length >= 9, `a swell into ${bar}`);
    assert.equal(rise.at(-1).value, 100); assert.ok(rise[0].value < 100); assert.equal(sink[0].value, 100);
    for (let i = 1; i < rise.length; i++) assert.ok(rise[i].value >= rise[i - 1].value, 'the surge only rises');
    for (let i = 1; i < sink.length; i++) assert.ok(sink[i].value <= sink[i - 1].value, 'the sink only falls');
  }
});

test('INTRO3: nothing fetches or decodes a recording - the intro plays the score through the game’s own player', () => {
  const src = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
  const theme = src('src/systems/introTheme.js');
  assert.match(theme, /import \{ SongPlayer \} from '\.\/song\/songPlayer\.js';/);
  assert.match(theme, /import \{ introThemeSong \} from '\.\/introScore\.js';/);
  for (const gone of ['decodeAudioData', 'fetcher', 'fetch(', 'theme.mp3', 'createBufferSource']) assert.ok(!theme.includes(gone), `introTheme.js still says ${gone}`);
  const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const f of walk(new URL('../../src', import.meta.url).pathname).filter((p) => p.endsWith('.js'))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /theme\.mp3['"`]/, `${f} still loads the recording`);
  }
  assert.match(src('.github/workflows/intro-quality.yml'), /node tools\/introScoreProbe\.mjs/);
});
