// THE KETCH LAB (KETCH, 2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): the sky-ketch Mzunthar drawn by the game's
// own renderer from its own parts, with no game data - the ship, its parts, the Sailwalk's Steps and the land below are all
// made in code (world/ketch/ketchModel.js, world/ketch/ketchArt.js, scenes/superDungeon/sdSteps.js with the Ketch's course),
// lit and fogged as the dungeon arm lights the Ketch (scenes/ketch/ketchDeckHost.js ketchFrameLook), so what this page
// shows is what a crew sees.
//
//   ?view=<name>     a camera (the panel's list)            ?t=<seconds>   the shared clock, pinned   ?still
//   ?stage=0-5       the voyage's stage the parts stand for (the hatches, the lift, the cabin's door, the bosun's line)
//   ?sec=<k,k>       the bridge's sections fallen            ?law           the colliders as wire
//   ?hour=<0-24>     the hour the light is at               ?nopanel       the panel hidden (probes)
//   ?x=&y=&z=&yaw=&pitch=   an exact eye (the deck's frame, metres; degrees)
// `window.__frame` counts drawn frames; `window.__lab` moves the camera and the clock from a probe.
import { Renderer, WORLD_FRAME } from '../render/renderer.js';
import { EL_LANE, exposureFor } from '../render/enhancedLighting.js';
import { applyFog } from '../render/underwaterFog.js';
import { createSdSteps } from '../scenes/superDungeon/sdSteps.js';
import { createKetchDeck, ketchFrameLook } from '../scenes/ketch/ketchDeckHost.js';
import { KT_COURSE, deckToDungeon } from '../net/ketch/ketchDeck.js';
import { perspective, lookAt, identity, mirrorProjectionX } from '../world/mat4.js';
import { lightList, packLight } from '../render/lightId.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const $ = (id) => document.getElementById(id);
if (params.has('nopanel')) $('panel').style.display = 'none';
canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
const renderer = new Renderer(canvas);
const gl = renderer.gl;

/** The cameras, in the deck's frame (yaw 0 faces +z, the stern; degrees). */
const VIEWS = {
  arrive: { at: [0, 1.7, 6], yaw: 0, pitch: -2 },
  waist: { at: [-9, 2.2, 20], yaw: 25, pitch: -6 },
  'waist-aft': { at: [0, 4, 30], yaw: 0, pitch: -4 },
  gallery: { at: [0, -4.3, 62], yaw: 0, pitch: -6 },
  landing: { at: [-6, -4.3, 112], yaw: 40, pitch: -10 },
  hold: { at: [0, -10.3, 128], yaw: 180, pitch: -6 },
  engine: { at: [6, -9.6, 76], yaw: 200, pitch: -10 },
  lift: { at: [2, -10.3, 58], yaw: 90, pitch: 4 },
  top: { at: [5, 17.7, 56], yaw: 70, pitch: -6 },
  sailwalk: { at: [24, 17.7, 59], yaw: 0, pitch: -6 },
  'sailwalk-side': { at: [44, 24, 100], yaw: -100, pitch: -10 },
  bridge: { at: [16, 1.7, 186], yaw: -60, pitch: -2 },
  helm: { at: [0, 2.4, 190], yaw: 0, pitch: -2 },
  cabin: { at: [0, 1.7, 226], yaw: 0, pitch: -6 },
  bow: { at: [-30, 14, -30], yaw: 40, pitch: -14 },
  side: { at: [90, 30, 110], yaw: -90, pitch: -12 },
  stern: { at: [40, 20, 280], yaw: -150, pitch: -10 },
  above: { at: [0, 140, 110], yaw: 0, pitch: -85 },
  below: { at: [30, -60, 90], yaw: -30, pitch: 30 },
  city: { at: [0, 1.7, 30], yaw: -100, pitch: -24 },
};
const viewSel = $('view');
for (const k of Object.keys(VIEWS)) { const o = document.createElement('option'); o.value = o.textContent = k; viewSel.append(o); }
viewSel.value = VIEWS[params.get('view')] ? params.get('view') : 'arrive';
if (params.has('t')) $('t').value = params.get('t');
if (params.get('lane') === 'off') $('lane').checked = false;
if (params.has('still')) $('still').checked = true;
let clock = Number($('t').value);
const cam = { pos: [0, 0, 0], yaw: 0, pitch: 0 };
function setView(name) {
  const v = VIEWS[name] ?? VIEWS.arrive;
  cam.pos = deckToDungeon(v.at[0], v.at[1], v.at[2]);
  cam.yaw = (v.yaw * Math.PI) / 180; cam.pitch = (v.pitch * Math.PI) / 180;
}
setView(viewSel.value);
if (params.has('x')) cam.pos = deckToDungeon(Number(params.get('x')), Number(params.get('y') ?? 1.7), Number(params.get('z') ?? 0));
if (params.has('yaw')) cam.yaw = (Number(params.get('yaw')) * Math.PI) / 180;
if (params.has('pitch')) cam.pitch = (Number(params.get('pitch')) * Math.PI) / 180;
viewSel.addEventListener('change', () => setView(viewSel.value));

let laneOn = null;
function syncLane() {
  const on = $('lane').checked;
  if (on === laneOn) return;
  laneOn = on;
  renderer.setLightingLane(on ? EL_LANE : null);
  if (on) { renderer.setExposure?.(exposureFor('')); renderer.setAir?.(true); }
}

// ── the ship, stood as the deck host stands it ─────────────────────────────────────────────────────────────────
const dynamicDraws = [];
const deck = createKetchDeck({ renderer });
deck.stand({ dynamicDraws, collider: null });
const steps = createSdSteps({ renderer, course: KT_COURSE });
steps.stand({ dynamicDraws, collider: null });
const stage = Number(params.get('stage') ?? 0);
const fallen = (params.get('sec') ?? '').split(',').filter(Boolean).map(Number);
const labVoyage = () => ({ sg: stage, cl: { cr: [1, 1, 0, 1, 1, 1], br: [1, 1], lo: [], ca: [], bk: Math.min(stage >= 2 ? 3 : 0, 7), nd: 5, sk: stage >= 2 ? [1, 1, 1, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0] },
  ws: stage === 4 ? { ph: 3, rs: [1, 0, 1, 0], sec: fallen.map((k) => [k, clock * 1000 - 500, clock * 1000 + 6000]), fk: params.has('forks') ? { i: 1, at: clock * 1000 + 5000, m: 100, c: [[3, 205, 100], [-6, 196, 100], [8, 197, 100]] } : null } : null });
const lawMesh = params.has('law') ? (() => {
  const tris = deck.colliderTris(), n = tris.length / 3;
  return renderer.createMesh({ positions: tris, normals: new Float32Array(n * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), uvs: new Float32Array(n * 2), indices: Uint32Array.from({ length: n }, (_, i) => i), subMeshes: [{ textureArchive: 38311, textureRecord: 11, startIndex: 0, primitiveCount: n / 3 }] });
})() : null;

const keys = new Set();
addEventListener('keydown', (e) => keys.add(e.code));
addEventListener('keyup', (e) => keys.delete(e.code));
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  cam.yaw -= (e.clientX - drag[0]) * 0.005; cam.pitch = Math.max(-1.5, Math.min(1.5, cam.pitch - (e.clientY - drag[1]) * 0.005));
  drag = [e.clientX, e.clientY];
});
canvas.addEventListener('pointerup', () => { drag = null; });

let last = performance.now();
window.__frame = 0;
window.__lab = {
  view: (name) => { viewSel.value = name; setView(name); },
  eye: (x, y, z, yawDeg, pitchDeg) => { cam.pos = deckToDungeon(x, y, z); cam.yaw = (yawDeg * Math.PI) / 180; cam.pitch = (pitchDeg * Math.PI) / 180; },
  clock: (s) => { clock = s; $('t').value = String(s); },
};
$('t').addEventListener('input', () => { clock = Number($('t').value); });
const NO_SHADOW = Object.freeze({ noShadow: true }), WITH_SHADOW = Object.freeze({ noShadow: false });

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!$('still').checked && !params.has('t')) { clock += dt; $('t').value = String(clock); }
  $('tV').textContent = clock.toFixed(1);
  syncLane();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const fwd = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)];
  const right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
  const sp = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 30 : 7) * dt;
  const mv = (v, s) => { cam.pos[0] += v[0] * s; cam.pos[1] += v[1] * s; cam.pos[2] += v[2] * s; };
  if (keys.has('KeyW')) mv(fwd, sp); if (keys.has('KeyS')) mv(fwd, -sp);
  if (keys.has('KeyD')) mv(right, -sp); if (keys.has('KeyA')) mv(right, sp);
  if (keys.has('KeyE')) cam.pos[1] += sp; if (keys.has('KeyQ')) cam.pos[1] -= sp;
  const view = lookAt(cam.pos, [cam.pos[0] + fwd[0], cam.pos[1] + fwd[1], cam.pos[2] + fwd[2]], [0, 1, 0]);
  const proj = mirrorProjectionX(perspective((65 * Math.PI) / 180, w / h, 0.1, 4000));
  const lane = !!renderer.lightingLane;
  const minute = Number(params.get('hour') ?? 13) * 60;
  const look = ketchFrameLook(cam.pos, minute, lane);
  renderer.setMoonlight(null);
  renderer.setLighting(look.ambient, look.sunScale, look.sunColor);
  applyFog(renderer, look.fog);
  deck.pose(labVoyage(), clock, clock * 1000, null);
  steps.ride(clock, dt, null, true);
  const lights = deck.lightsNear(cam.pos, renderer.maxPointLights ?? 16);
  const data = lightList(lights.length), colors = new Float32Array(Math.max(1, lights.length) * 3);
  lights.forEach((l, i) => { packLight(data, i, l); colors.set(l.color, i * 3); });
  renderer.setPointLights(data, null, colors.subarray(0, lights.length * 3));
  renderer.setClearColor(look.clear);
  renderer.beginFrame(proj, view, look.sunDir, WORLD_FRAME);
  for (const d of dynamicDraws) if (!d.hidden && !d.culled) renderer.drawMesh(d.gpu, d.object.matrix, d.texRemap ?? null, d.noShadow ? NO_SHADOW : WITH_SHADOW);
  if (lawMesh) renderer.drawMeshWire(lawMesh, identity(), null);
  const camRight = new Float32Array([-view[0], -view[4], -view[8]]);
  renderer.drawBillboards(deck.billboards(cam.pos, clock), camRight, new Float32Array([0, 1, 0]));
  renderer.resolveFrame();
  window.__frame++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
