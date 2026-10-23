// INTRO3 - THE MAIN THEME, PLAYED BY THE GAME'S OWN PLAYER IN A REAL BROWSER, RENDERED AND MEASURED.
//
// node holds the score's shape (test/systems/intro3_score.test.js); what node cannot answer is what it SOUNDS like through the
// game's own song player and FM bank: whether the whole of it sounds, whether it clips, whether it stands as loud as
// the recording it replaced, and whether the film's two landmarks are heard where the cue sheet puts them. So: the
// repo's own modules served as they are, the theme played by systems/song/songPlayer.js into an OfflineAudioContext (the
// player's clock carried through the song window by window, as its own pump carries it, as tools/gateScoreProbe.mjs
// does), the render read back and measured.
//
//     node tools/introScoreProbe.mjs [--wav <file>] [--seconds <n>]
//         --wav writes the render there as 16-bit WAV from the song's own tick 0 (the film's time zero), normalised to
//               -1 dBFS, for a person to listen to and for tools/introCapture.mjs's preview
//         --seconds renders only the opening (the whole song by default; the loudness against the recording is
//               measured over 24-160 s, so a shorter render skips it - intro-quality.yml renders the film's 27 s)
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLOUD_REVEAL_TIME, TITLE_IMPACT_TIME } from '../src/ui/intro/introCue.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const wavAt = arg('--wav');
const SECONDS = Number(arg('--seconds') ?? 170);
const out = []; const check = (n, ok, d = '') => { out.push(ok); console.log(`${ok ? 'ok  ' : 'FAIL'} ${n}${d ? ` - ${d}` : ''}`); };

// The recording INTRO3 replaced (assets/intro/theme.mp3, 164.3 s), measured the same way before it left the tree: its
// loudness from 24 s to 160 s, a second at a time, stereo RMS at full scale times the 0.82 the intro played it at and
// the 0.5 MusicVolume this renders at.
const RECORDING_DB = -22.4;

const PAGE = `<!doctype html><html><body><script type=module>
import { SongPlayer } from '/src/systems/song/songPlayer.js';
import { introThemeSong, INTRO_PRESS } from '/src/systems/introScore.js';
import { INTRO_THEME_GAIN, introSpace } from '/src/systems/introTheme.js';
const RATE = 44100;
window.render = async (seconds) => {
  const song = introThemeSong();
  const secs = Math.min(seconds, song.durationTicks * song.secondsPerTick + 0.06);   // one pass: the loop's seam is not the song
  const real = new OfflineAudioContext(2, Math.ceil(RATE * secs), RATE);
  // the player's clock, carried by hand: it reads ctx.currentTime, which an offline context holds at 0 until it renders
  let now = 0;
  const ctx = new Proxy(real, { get(t, k) { if (k === 'currentTime') return now; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v; } });
  // the intro's own gain under the player's master, and the hall under it, as systems/introTheme.js wires them (INTRO3b)
  const gain = real.createGain(); gain.gain.value = INTRO_THEME_GAIN; gain.connect(real.destination);
  const space = introSpace(real, gain);
  const p = new SongPlayer(ctx, gain, space?.send ?? null);
  p.play(song);
  clearInterval(p._timer);
  const origin = p._originTime;
  for (now = 0; now < secs; now += 0.1) p._pump();
  p.loop = false;
  const buf = await real.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0, nan = 0;
  const rms = [];
  for (let s = 0; s < Math.floor(secs); s++) {
    let acc = 0;
    for (let i = s * RATE; i < (s + 1) * RATE; i++) { const a = L[i], b = R[i]; if (!Number.isFinite(a) || !Number.isFinite(b)) { nan++; continue; } acc += a * a + b * b; peak = Math.max(peak, Math.abs(a), Math.abs(b)); }
    rms.push(Math.sqrt(acc / (2 * RATE)));
  }
  // mono at 12 kHz for the onset measure (tools/introAudioCheck.mjs's method), from the song's own tick 0
  const step = RATE / 12000, mono = [];
  for (let i = Math.round(origin * RATE); i < L.length; i += step) { const j = Math.floor(i); mono.push((L[j] + R[j]) / 2); }
  // INTRO3b: how alike the two channels are - the correlation of L and R over the sounding part (from 1 s), 1 is mono
  let sl = 0, sr = 0, sll = 0, srr = 0, slr = 0, cn = 0;
  for (let i = RATE; i < L.length; i++) { const a = L[i], b = R[i]; sl += a; sr += b; sll += a * a; srr += b * b; slr += a * b; cn++; }
  const ml = sl / cn, mr = sr / cn, corr = (slr / cn - ml * mr) / Math.sqrt(Math.max(1e-18, (sll / cn - ml * ml) * (srr / cn - mr * mr)));
  const k = peak > 0 ? 0.89 / peak : 1, from = Math.round(origin * RATE);
  const pcm = new Int16Array((L.length - from) * 2);
  for (let i = from; i < L.length; i++) { const o = 2 * (i - from); pcm[o] = Math.max(-32767, Math.min(32767, Math.round(L[i] * k * 32767))); pcm[o + 1] = Math.max(-32767, Math.min(32767, Math.round(R[i] * k * 32767))); }
  const bytes = new Uint8Array(pcm.buffer);
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { secs, origin, peak, nan, rms, corr, ceiling: INTRO_PRESS.ceiling, gain: INTRO_THEME_GAIN, mono: Array.from(mono), pcm: btoa(bin), rate: RATE };
};
window.ready = true;
</script></body></html>`;

function wav(pcmB64, rate) {
  const data = Buffer.from(pcmB64, 'base64');
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Positive spectral flux over a local mean (tools/introAudioCheck.mjs): Hann 1024, hop 128, 12 kHz, peak centre. */
function onsets(pcm, rate = 12000, size = 1024, hop = 128) {
  const count = 1 + Math.floor((pcm.length - size) / hop), flux = new Float64Array(count);
  let previous = null;
  for (let i = 0; i < count; i++) {
    const real = new Float64Array(size), imag = new Float64Array(size);
    for (let n = 0; n < size; n++) real[n] = pcm[i * hop + n] * (0.5 - 0.5 * Math.cos(2 * Math.PI * n / (size - 1)));
    for (let a = 1, j = 0; a < size; a++) { let bit = size >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (a < j) { [real[a], real[j]] = [real[j], real[a]]; [imag[a], imag[j]] = [imag[j], imag[a]]; } }
    for (let n = 2; n <= size; n <<= 1) {
      const angle = -2 * Math.PI / n;
      for (let a = 0; a < size; a += n) for (let j = 0; j < n / 2; j++) {
        const x = a + j, y = x + n / 2, c = Math.cos(angle * j), s = Math.sin(angle * j);
        const r = real[y] * c - imag[y] * s, v = real[y] * s + imag[y] * c;
        real[y] = real[x] - r; imag[y] = imag[x] - v; real[x] += r; imag[x] += v;
      }
    }
    const m = new Float64Array(size / 2 + 1); for (let b = 0; b <= size / 2; b++) m[b] = Math.hypot(real[b], imag[b]);
    if (previous) for (let b = 0; b < m.length; b++) flux[i] += Math.max(0, m[b] - previous[b]);
    previous = m;
  }
  const radius = Math.floor(0.5 * rate / hop);
  const norm = flux.map((f, i) => { let sum = 0; for (let j = Math.max(0, i - radius); j <= Math.min(count - 1, i + radius); j++) sum += flux[j]; return f / Math.max(1e-9, sum / (radius * 2 + 1)); });
  const peakBetween = (from, to) => { let best = -1; for (let i = 0; i < count; i++) { const t = (i * hop + size / 2) / rate; if (t >= from && t <= to && (best < 0 || norm[i] > norm[best])) best = i; } return { time: (best * hop + size / 2) / rate, strength: norm[best] }; };
  return { peakBetween };
}

/** INTRO3b: the spectrum's centre of weight (Hz) and the share of its energy from 2 kHz up (dB), over the mono at 12 kHz
 *  from `from` s - Hann 4096, hop 2048, the power averaged over the frames. The flat render measured 265 Hz against the
 *  recording's 552 over the film, its 2-6 kHz share 12 dB under the recording's. */
function spectrum(pcm, rate = 12000, from = 1, size = 4096, hop = 2048) {
  const power = new Float64Array(size / 2 + 1);
  let frames = 0;
  for (let start = Math.round(from * rate); start + size <= pcm.length; start += hop) {
    const real = new Float64Array(size), imag = new Float64Array(size);
    for (let n = 0; n < size; n++) real[n] = pcm[start + n] * (0.5 - 0.5 * Math.cos(2 * Math.PI * n / (size - 1)));
    for (let a = 1, j = 0; a < size; a++) { let bit = size >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (a < j) { [real[a], real[j]] = [real[j], real[a]]; [imag[a], imag[j]] = [imag[j], imag[a]]; } }
    for (let n = 2; n <= size; n <<= 1) {
      const angle = -2 * Math.PI / n;
      for (let a = 0; a < size; a += n) for (let j = 0; j < n / 2; j++) {
        const x = a + j, y = x + n / 2, c = Math.cos(angle * j), s = Math.sin(angle * j);
        const r = real[y] * c - imag[y] * s, v = real[y] * s + imag[y] * c;
        real[y] = real[x] - r; imag[y] = imag[x] - v; real[x] += r; imag[x] += v;
      }
    }
    for (let b = 0; b <= size / 2; b++) power[b] += real[b] * real[b] + imag[b] * imag[b];
    frames++;
  }
  let total = 0, weighted = 0, high = 0;
  for (let b = 1; b <= size / 2; b++) {
    const hz = (b * rate) / size;
    if (hz < 20) continue;
    total += power[b]; weighted += power[b] * hz;
    if (hz >= 2000) high += power[b];
  }
  return { frames, centroid: total > 0 ? weighted / total : 0, presenceDb: total > 0 ? 10 * Math.log10(Math.max(1e-18, high / total)) : -Infinity };
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/probe/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
  const f = join(ROOT, url);
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : extname(f) === '.json' ? 'application/json' : 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/probe/`);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  const r = await page.evaluate((s) => window.render(s), SECONDS);
  if (wavAt) writeFileSync(wavAt, wav(r.pcm, r.rate));
  const body = r.rms.slice(24, 160), meanDb = body.length ? db(body.reduce((a, b) => a + b, 0) / body.length) : -Infinity;
  console.log(`     ${r.secs.toFixed(1)} s, peak ${db(r.peak).toFixed(1)} dBFS, loudness ${meanDb.toFixed(1)} dBFS (24-160 s) at MusicVolume 0.5 and the intro's ${r.gain}`);
  check('it plays - every second of it sounding, no NaN', r.nan === 0 && r.rms.slice(1, Math.floor(r.secs) - 1).every((x) => x > 1e-4), r.rms.map((x) => db(x).toFixed(0)).join(' '));
  // at the highest MusicVolume (twice the 0.5 this renders at: +6 dB) the intro's level of the press's ceiling
  check(`never clipping, under its ceiling of ${r.ceiling} dBFS even at the highest MusicVolume`, db(r.peak) + 6.02 <= r.ceiling + 0.05, `${(db(r.peak) + 6.02).toFixed(2)} dBFS at full volume`);
  if (r.rms.length >= 160) check(`as loud as the recording it replaced (${RECORDING_DB} dBFS, within 2 dB)`, Math.abs(meanDb - RECORDING_DB) <= 2, `${meanDb.toFixed(1)} dBFS`);
  else console.log(`     (the loudness against the recording needs 160 s rendered; this render is ${r.secs.toFixed(0)} s)`);
  // the opening swells from nothing, and the cloud break and the impact are the loudest moments of the film's first 22 s
  check('the opening swells from quiet', r.rms[1] < r.rms[7] * 0.5, r.rms.slice(0, 9).map((x) => db(x).toFixed(0)).join(' '));
  const { peakBetween } = onsets(Float32Array.from(r.mono));
  for (const [name, at] of [['cloud break', CLOUD_REVEAL_TIME], ['impact', TITLE_IMPACT_TIME]]) {
    const near = peakBetween(at - 0.25, at + 0.25), wide = peakBetween(at - 2, at + 1);
    check(`the ${name} is heard on its cue (${at.toFixed(3)} s): the strongest onset from 2 s before it, within 25 ms`, Math.abs(near.time - at) <= 0.025 && Math.abs(wide.time - near.time) < 1e-9, `onset at ${near.time.toFixed(3)} s, ${((near.time - at) * 1000).toFixed(1)} ms, strength ${near.strength.toFixed(2)}`);
  }
  // INTRO3b: not flat - wide (the two channels are not one: the recording's L/R correlation is 0.33 over the film, 0.59
  // over its body; the dry render's was 0.985, INTRO3b's 0.58) and present (the spectrum's centre of weight and its
  // share from 2 kHz up, measured on the recording the same way: 521 Hz and -12.8 dB over the film; the dry render's
  // 305 Hz and -25.0 dB, INTRO3b's 474 Hz and -14.8 - the pins a margin under where it lands)
  const sp = spectrum(Float32Array.from(r.mono));
  check('wide: the two channels are not one (L/R correlation under 0.8)', r.corr < 0.8, `correlation ${r.corr.toFixed(3)}`);
  check('present: the spectrum’s centre of weight over 420 Hz and its share from 2 kHz up over -16 dB', sp.centroid > 420 && sp.presenceDb > -16, `centroid ${sp.centroid.toFixed(0)} Hz, 2 kHz up ${sp.presenceDb.toFixed(1)} dB over ${sp.frames} frames`);
  check('no page error', errs.length === 0, errs.join('; '));
} finally {
  await browser.close();
  server.close();
}
const failed = out.filter((o) => !o).length;
console.log(`\n${out.length - failed}/${out.length} checks passed`);
process.exit(failed ? 1 : 0);
