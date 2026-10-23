// MEM-AUDIT (2026-10-23, the owner: "a comprehensive performance audit, looking for memory leaks"): what a place, a map
// pixel, a menu or a session online left standing after its life (bible/07-Rendering/Performance-Priority.md MEM-AUDIT).
// Each pin drives the module that owned the leak, or reads the host's one line where the host is the owner; each names
// its mutant (tools/mutants/memaudit.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StaticBatchBuilder, keyResolver } from '../../src/render/staticBatch.js';
import { trs } from '../../src/world/mat4.js';
import { SnowCoverage } from '../../src/systems/snowfall.js';
import { SnowfallRuntime } from '../../src/systems/snowfallRuntime.js';
import { snowPixelBox } from '../../src/scenes/snowfallHost.js';
import { drawPixelGround } from '../../src/ui/pixelGround.js';
import { createEotbArt, WALKER_OUTFITS_KEPT, WALKER_OUTFIT_IDLE_MS, outfitOfLayeredKey } from '../../src/net/peer/peerRiders.js';
import { createMarketBook, MARKET_CACHE_KEPT, MARKET_CACHE_MS } from '../../src/net/marketBook.js';
import { hostText } from '../hostText.mjs';

const rd = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8');
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };
const flush = () => new Promise((r) => setTimeout(r, 0));

// ─── THE STATIC BATCH ────────────────────────────────────────────────

function quad() {
  return {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    subMeshes: [{ textureArchive: 7, textureRecord: 1, startIndex: 0, primitiveCount: 2 }],
  };
}

test('MEM-AUDIT the static batch: the merge spends its inputs - the builder a host\'s build scope keeps holds no model\'s copy once merged, sliced or whole, and the mesh is the same (mutant: the inputs kept)', async () => {
  for (const sliced of [false, true]) {
    const b = new StaticBatchBuilder();
    for (let i = 0; i < 3; i++) b.add(quad(), trs(i * 10, 0, 0, 0, 0, 0), keyResolver(new Map()));
    assert.equal(b.chunks.length, 3);
    const m = sliced ? await b.finishSliced(async () => {}) : b.finish();
    assert.deepEqual([m.vertexCount, m.triangles, m.models], [12, 6, 3], 'the mesh is every model\'s');
    assert.deepEqual(Array.from(m.positions.slice(24, 27)), [20, 0, 0], 'the third model where it stood');
    assert.deepEqual([b.chunks.length, b.groups.size, b.vertexCount, b.triangles, b.models], [0, 0, 0, 0, 0], `${sliced ? 'sliced' : 'whole'}: spent`);
    assert.equal(b.finish(), null, 'a second merge is an empty builder\'s');
  }
});

// ─── THE SNOW'S BLANKET ──────────────────────────────────────────────

const MASKS = [103, 303, 403].map((a) => new Uint8Array(readFileSync(new URL(`../../public/art/snowfall/snow_surface_masks_${a}.bytes`, import.meta.url))));
const SIZE = 819.2, RING = 3, X0 = 500, Y0 = 250;
/** SNOW-HOLD's world (fb1021b_snowhold.test.js): tiles stand within three pixels of the player's, destroyed as they leave. */
function streamingWorld() {
  const live = new Map(), dead = new WeakSet();
  let at = [X0, Y0], rt = null, now = 0;
  const make = (mx, my) => ({ mapX: mx, mapY: my, size: SIZE, tileMap: new Uint8Array(16384).fill(1 << 2), winterArchive: 303, stamp: 1, roads: null,
    origin: (out) => { out[0] = (mx - X0) * SIZE; out[1] = 0; out[2] = -(my - Y0) * SIZE; return out; },
    height: () => 0, normal: (lx, lz, out) => { out[0] = 0; out[1] = 1; out[2] = 0; return out; } });
  const tileOf = (mx, my) => live.get(`${mx},${my}`) ?? null;
  const stream = () => {
    const [cx, cy] = at;
    for (const [k, t] of live) if (Math.max(Math.abs(t.mapX - cx), Math.abs(t.mapY - cy)) > RING) { live.delete(k); dead.add(t); }
    for (let j = -RING; j <= RING; j++) for (let i = -RING; i <= RING; i++) {
      const k = `${cx + i},${cy + j}`;
      if (!live.has(k)) { const t = make(cx + i, cy + j); live.set(k, t); rt?.terrainPromoted(t, now, null); }
    }
  };
  const world = {
    terrainAt: (x, z) => tileOf(X0 + Math.floor(x / SIZE), Y0 - Math.floor(z / SIZE)),
    terrainsNear: (r) => { const out = []; const [cx, cy] = at; for (let d = 0; d <= Math.min(r, RING); d++) for (let j = -d; j <= d; j++) for (let k = -d; k <= d; k++) if (Math.max(Math.abs(j), Math.abs(k)) === d) { const t = tileOf(cx + k, cy + j); if (t) out.push(t); } return out; },
    terrainsIn: (minX, minZ, maxX, maxZ) => { const b = snowPixelBox(minX, minZ, maxX, maxZ), out = []; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const t = tileOf(x, y); if (t) out.push(t); } return out; },
    toGlobal: (x, z) => [X0 * SIZE + x, (Y0 - 1) * SIZE + z], settlements: () => [], terrainDistance: 3,
  };
  stream();
  return { world, dead, bind: (r) => { rt = r; }, move: (x, z, t) => { now = t; at = [X0 + Math.floor(x / SIZE), Y0 - Math.floor(z / SIZE)]; stream(); } };
}

test('MEM-AUDIT the snow\'s blanket: idle (the travel view up, a door), its overlays are pruned still - a journey keeps no tile the world destroyed, a dropped overlay holds neither its tile nor its arrays, and a tile still standing keeps its own (mutants: the prune active alone, the drop keeping the tile)', () => {
  const s = streamingWorld();
  const rt = new SnowfallRuntime({ world: s.world, coverage: new SnowCoverage(MASKS), frameBudgetMs: 50 });
  s.bind(rt);
  const st = { now: 0, x: 10, z: 10, sec: 1_000_000 };
  const frame = (player) => rt.frame({ now: st.now, inside: false, enabled: true, player, winter: true, desert: false, snowing: false, gameSeconds: st.sec, npcs: [], corpses: [] });
  const standing = () => ({ x: st.x, y: 0, z: st.z, grounded: true, swimming: false, levitating: false });
  quiet(() => { for (let i = 0; i < 900; i++) { st.now += 1 / 30; st.sec += 2; frame(standing()); } });   // thirty seconds standing: the blanket laid
  const laid = [...rt.blanket.overlays.values()].filter((o) => o.ready);
  assert.ok(laid.length >= 9, `overlays laid (${laid.length})`);
  // a door: nothing moves, the tier idle - every standing tile keeps its overlay through the prune
  quiet(() => { for (let i = 0; i < 300; i++) { st.now += 1 / 30; frame(null); } });
  assert.equal(rt.blanket.active, false);
  assert.ok(laid.every((o) => rt.blanket.overlays.get(o.t) === o && !o.dead), 'a tile still standing keeps its overlay for the door');
  // the travel view: the world streams on under a player who is not drawn
  quiet(() => { for (let i = 0; i < 1500; i++) { st.now += 1 / 30; st.x += 3000 / 30; s.move(st.x, st.z, st.now); frame(null); } });
  const B = rt.blanket;
  const held = [...B.overlays.keys(), ...B.live, ...(B.building ? [B.building.t] : [])];
  assert.equal(held.filter((t) => s.dead.has(t)).length, 0, 'no destroyed tile held by the blanket');
  const dropped = [...rt.dirty.blanket].filter((o) => o.dead);
  assert.ok(dropped.length >= laid.length - (2 * RING + 1) ** 2 + 1 || dropped.length > 0, 'the old ring dropped, its GPU halves waiting on the sync');
  assert.ok(dropped.every((o) => o.t === null && o.pos === null && o.nrm === null && o.ctx === null && o.statics === null), 'and holding nothing of their tiles');
});

// ─── THE MENUS' SKY ──────────────────────────────────────────────────

/** The sky as PX1 drew it before MEM-AUDIT, restated: the strings split at every pixel, a new image every draw. */
function oldSky(W, H, t) {
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const RAMP = ['#07080d', '#0b0d14', '#10141d', '#161c27', '#1e2632', '#28313f'];
  const hx = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
  const data = new Uint8ClampedArray(W * H * 4);
  let seed = 0xda66e4;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  const fogs = [
    { x: W * (0.30 + 0.05 * Math.sin(t / 41)), y: H * (0.72 + 0.03 * Math.cos(t / 53)), r: H * 0.55, k: 1.4 },
    { x: W * (0.78 + 0.06 * Math.cos(t / 47)), y: H * (0.35 + 0.04 * Math.sin(t / 59)), r: H * 0.45, k: 0.9 },
  ];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = y / H;
    for (const f of fogs) { const d = Math.hypot(x - f.x, y - f.y) / f.r; if (d < 1) v += (1 - d) * (1 - d) * 0.22 * f.k; }
    v = Math.max(0, Math.min(1, v));
    const tt = v * (RAMP.length - 1), i0 = Math.floor(tt), th = (BAYER[y & 3][x & 3] + 0.5) / 16;
    const c = hx(RAMP[Math.min(RAMP.length - 1, i0 + (tt - i0 > th ? 1 : 0))]);
    const o = (y * W + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  const n = Math.round((W * H) / 1440);
  for (let i = 0; i < n; i++) {
    const x = (rnd() * W) | 0, y = (rnd() * H * 0.55) | 0, bright = rnd() < 0.25, phase = rnd() * Math.PI * 2;
    let b = bright ? 200 : 120;
    if (bright) b = [140, 170, 200, 230][Math.floor(2 + 1.99 * Math.sin(t / 1.7 + phase))];
    const o = (y * W + x) * 4;
    data[o] = b; data[o + 1] = b; data[o + 2] = b - 10;
  }
  return data;
}

test('MEM-AUDIT the menus\' sky: the same bytes as PX1\'s every draw, its image made once a size and its canvas sized only when the size moves (mutants: the fog\'s skip past its reach, the image a draw)', () => {
  let made = 0, sized = 0, last = null;
  const ctx = { createImageData: (w, h) => { made++; return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }, putImageData(img) { last = img.data; } };
  let w = 300, h = 150;
  const canvas = { get width() { return w; }, set width(v) { sized++; w = v; }, get height() { return h; }, set height(v) { sized++; h = v; }, getContext: () => ctx };
  for (const [vw, vh] of [[1280, 720], [390, 844], [1280, 720]]) {
    for (const t of [0, 0.125, 41.2, 1234.5]) {
      drawPixelGround(canvas, vw, vh, t);
      assert.deepEqual(last, oldSky(w, h, t), `${vw}x${vh} at ${t}: PX1's bytes`);
    }
  }
  assert.equal(made, 3, 'one image a size the canvas took (the third the first size again)');
  assert.equal(sized, 6, 'the canvas sized three times, both sides');
});

// ─── THE OTHERS' LAYERED WALKERS ─────────────────────────────────────

test('MEM-AUDIT the others\' layered walkers: each outfit is its own pictures and decodes, let go once WALKER_OUTFITS_KEPT others were drawn since and it stood undrawn a minute - a walker drawn is never let go (mutant: an outfit never let go)', async () => {
  const evicted = [], decoded = [];
  let now = 0;
  const art = createEotbArt({
    renderer: { uploadTexture: () => {}, evictTexture: (k) => evicted.push(k) },
    urlFor: (k) => k, decode: async (u) => { decoded.push(u); return { width: 4, height: 4, colors: new Uint8Array(64).fill(9) }; }, clock: () => now,
  });
  const sprite = (code, f = 0) => ({ archive: 9100, record: 10, frame: f, mirror: false, key: `LA:m:2:10-${f}:${code}`, rec: `${code}_10-${f}` });
  assert.equal(outfitOfLayeredKey(sprite('123~4', 3).key), 'LA:m:2:123~4');
  const worn = sprite('000');
  for (let i = 1; i < WALKER_OUTFITS_KEPT; i++) {   // with the walker in view, WALKER_OUTFITS_KEPT outfits
    art.ensure(sprite(`${i}`)); art.ensure(sprite(`${i}`, 1));
    art.ensure(worn);   // one walker stays in view throughout
    now += WALKER_OUTFIT_IDLE_MS + 1;
  }
  await flush();
  assert.equal(evicted.length, 0, `${WALKER_OUTFITS_KEPT} outfits, all kept until one past the cap`);
  art.ensure(sprite('999'));
  await flush();
  assert.deepEqual(evicted.sort(), ['9100_1_10-0', '9100_1_10-1'], 'the outfit longest undrawn, every frame of it');
  assert.ok(art.ensure(worn), 'the walker in view stands');
  const before = decoded.filter((u) => u.endsWith(':1')).length;
  assert.equal(art.ensure(sprite('1')), null, 'asked again, decoded again');
  await flush();
  assert.equal(decoded.filter((u) => u.endsWith(':1')).length, before + 1, 'its decode went with it');
});

// ─── THE MARKET'S READS ──────────────────────────────────────────────

test('MEM-AUDIT the market\'s reads: the cache keeps MARKET_CACHE_KEPT, the oldest written going first - a read in its minute is still answered from it (mutant: the cache uncapped)', async () => {
  const reads = [];
  const door = { account: () => 'acct-1', read: async (b) => { reads.push(b.page); return { ok: true, status: 200, data: { listings: [], page: b.page } }; } };
  const book = createMarketBook({ door, character: () => 'c-1', now: () => 1000, sleep: async () => {} });
  for (let p = 0; p <= MARKET_CACHE_KEPT; p++) await book.read('materials', { region: 17, page: p });
  assert.equal(reads.length, MARKET_CACHE_KEPT + 1);
  await book.read('materials', { region: 17, page: MARKET_CACHE_KEPT });
  assert.equal(reads.length, MARKET_CACHE_KEPT + 1, 'the newest answered from the cache, inside its minute');
  await book.read('materials', { region: 17, page: 0 });
  assert.equal(reads.length, MARKET_CACHE_KEPT + 2, 'the oldest gone - asked again');
  assert.ok(MARKET_CACHE_MS >= 1000);
});

// ─── THE HOSTS' AND THE WINDOWS' OWN LINES ───────────────────────────

test('MEM-AUDIT the place left is let go: setMode clears what latched the last room\'s and the last castle\'s context (mutants: a latch kept)', () => {
  const src = hostText('src/scenes/worldModes.js');
  const line = src.slice(src.indexOf('  const setMode = (next) => {'), src.indexOf('};', src.indexOf('  const setMode = (next) => {')));
  assert.match(line, /if \(next !== 'interior'\) \{ _arrowsCtx = null; interiorArrows\.clear\(\); cardLookedCtx = null; cardStandsDue\.clear\(\); gambitStandsDue\.clear\(\); \}/);
  assert.match(line, /if \(next !== 'dungeon'\) \{ _crownTried = null; arenaWall = null; _arenaStage = _arenaStageCtx = null; _pitStage = _pitStageCtx = null; \}/);
});

test('MEM-AUDIT the windows\' listeners and caches: the account card\'s focus listener goes with its card, the menu\'s foot observer with the menu, an item menu\'s pair with its menu, the icons\' encodings with their pictures (mutants: each kept)', () => {
  const acct = rd('ui/enhanced/enhancedAccount.js'), menu = rd('ui/enhanced/enhancedMenu.js'), inv = rd('ui/enhanced/enhancedInventory.js');
  assert.match(acct, /off = \(\) => win\.removeEventListener\('focus', onFocus\);/);
  assert.match(acct, /return \{ root, paint, off \};/);
  assert.match(menu, /acctPaint = card\.paint;\n {2}acctOff\?\.\(\); acctOff = card\.off \?\? null;/, 'the card drawn before is let go');
  assert.match(menu, /footObs\?\.disconnect\?\.\(\); footObs = null;\n {6}acctPaint = null; acctOff\?\.\(\); acctOff = null;/, 'the unmount');
  assert.match(inv, /menuOff = \(\) => \{ clearTimeout\(timer\); document\.removeEventListener\('pointerdown', away, true\);/);
  assert.match(rd('ui/item/itemIconUrl.js'), /const _iconUrls = new WeakMap\(\);/);
});

test('MEM-AUDIT a still batch in an arena makes no indices of its own - the batch with its own buffers alone writes them (mutant: the indices a batch again)', () => {
  const src = rd('render/renderer.js');
  const fn = src.slice(src.indexOf('  createBillboardBatch(archive, record, size, centers'), src.indexOf('const bounds = boundsOf(centers.flat());'));
  const arena = fn.indexOf('if (!dynamic && count > 0 && this._bbArenas) {'), own = fn.indexOf('} else {', arena);
  assert.ok(arena > 0 && own > arena);
  assert.equal(fn.slice(0, own).includes('new Uint32Array(count * 6)'), false, 'none made before the batch\'s own branch');
  assert.ok(fn.slice(own).includes('const indices = new Uint32Array(count * 6);'), 'made there');
});
