// THE KETCH LAB (KETCH, 2026-10-24; bible/11-Multiplayer/Sky-Ketch.md section 3): the sky-ketch Mzunthar drawn by the game's
// own renderer from its own parts, with no game data - the ship, its parts, the Sailwalk's Steps and the land below are all
// made in code (world/ketch/ketchModel.js, world/ketch/ketchArt.js, scenes/superDungeon/sdSteps.js with the Ketch's course),
// lit and fogged as the dungeon arm lights the Ketch (scenes/ketch/ketchDeckHost.js ketchFrameLook), so what this page
// shows is what a crew sees.
//
//   ?view=<name>     a camera (the panel's list)            ?t=<seconds>   the shared clock, pinned   ?still
//   ?stage=0-5       the voyage's stage the parts stand for (the hatches, the lift, the cabin's door, the bosun's line)
//   ?sec=<k,k>       the bridge's sections fallen            ?law           the colliders as wire
//   &secAt=<s>       (KL0) their moment on the shared clock: warned before it, falling, gone, risen 7 s after
//   ?hour=<0-24>     the hour the light is at               ?nopanel       the panel hidden (probes)
//   ?x=&y=&z=&yaw=&pitch=   an exact eye (the deck's frame, metres; degrees)
//   KETCH-LOOK KL0 (bible/11-Multiplayer/Sky-Ketch-Look.md section 17) - the lab's eyes, read off the query by
//   src/tools/ketchLabViews.js ketchLabKnobs:
//   ?grey            the frame in grey (every meaning carried by shape, place and motion, never by hue alone)
//   ?lite            the phone's tier (ui/touch/touchDevice.js isTouchDevice's answer, forced: the Steps' lite set)
//   ?bill            the frame's bill on screen and on window.__lab.bill(): GL draws, the ship's draws, its shadow
//                    casters and how many of them MOVED this frame (the shadow probe's - none may), lights, its CPU
//   ?sky=0           no sky (the world's sky stands over her by default, as the dungeon arm's host.drawSky draws it in
//                    the game - the procedural sky's, render/enhancedSky.js, at ?hour= and ?weather=)
// `window.__frame` counts drawn frames; `window.__lab` moves the camera and the clock from a probe.
import { Renderer, WORLD_FRAME } from '../render/renderer.js';
import { EL_LANE, exposureFor } from '../render/enhancedLighting.js';
import { applyFog } from '../render/underwaterFog.js';
import { createSdSteps } from '../scenes/superDungeon/sdSteps.js';
import { createKetchDeck, ketchFrameLook } from '../scenes/ketch/ketchDeckHost.js';
import { KT_COURSE, deckToDungeon } from '../net/ketch/ketchDeck.js';
import { perspective, lookAt, identity, mirrorProjectionX } from '../world/mat4.js';
import { lightList, packLight } from '../render/lightId.js';
import { EnhancedSkyRenderer, skyState } from '../render/enhancedSky.js';
import { KT_LAB_VIEWS, ketchLabKnobs } from './ketchLabViews.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('c');
const $ = (id) => document.getElementById(id);
if (params.has('nopanel')) $('panel').style.display = 'none';
const knobs = ketchLabKnobs(location.search);
if (knobs.grey) canvas.style.filter = 'grayscale(1)';
canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
const renderer = new Renderer(canvas);
const gl = renderer.gl;

/** The cameras (src/tools/ketchLabViews.js - pure, checked in node). */
const VIEWS = KT_LAB_VIEWS;
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
const steps = createSdSteps({ renderer, course: KT_COURSE, lite: knobs.lite });
steps.stand({ dynamicDraws, collider: null });
const stage = Number(params.get('stage') ?? 0);
const fallen = (params.get('sec') ?? '').split(',').filter(Boolean).map(Number);
const secAt = params.has('secAt') ? Number(params.get('secAt')) : null;   // KL0: the fallen sections' moment on the shared clock (their warning before it, their return 7 s after) - a fall a probe can watch run
const labVoyage = () => ({ sg: stage, cl: { cr: [1, 1, 0, 1, 1, 1], br: [1, 1], lo: [], ca: [], bk: Math.min(stage >= 2 ? 3 : 0, 7), nd: 5, sk: stage >= 2 ? [1, 1, 1, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0] },
  ws: stage === 4 ? { ph: 3, rs: [1, 0, 1, 0], sec: fallen.map((k) => (secAt != null ? [k, secAt * 1000, secAt * 1000 + 7000] : [k, clock * 1000 - 500, clock * 1000 + 6000])), fk: params.has('forks') ? { i: 1, at: clock * 1000 + 5000, m: 100, c: [[3, 205, 100], [-6, 196, 100], [8, 197, 100]] } : null } : null });
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
// the world's sky over her (the game's dungeon arm draws it after the opaque level: host.drawSky)
const sky = knobs.sky ? new EnhancedSkyRenderer(gl) : null;
// THE BILL (KETCH-LOOK KL0): what the frame cost, and whether any part that moved recorded a shadow
const bill = { gl: 0, draws: 0, casters: 0, moving: 0, lights: 0, cpuMs: 0 };   // gl: the ship's GL draws, one a submesh
const _was = new Map();
const billBox = knobs.bill ? Object.assign(document.body.appendChild(document.createElement('pre')), { id: 'bill' }) : null;
if (billBox) Object.assign(billBox.style, { position: 'fixed', right: '10px', top: '10px', margin: '0', padding: '6px 8px', background: 'rgba(14,16,19,0.85)', color: '#e9e4d9', font: '12px monospace' });
let _movedSince = 0;   // the most moving casters any frame drew since the bill was last read (a probe steps the clock, then reads)
window.__lab.bill = () => { const b = { ...bill, moving: Math.max(bill.moving, _movedSince) }; _movedSince = 0; return b; };

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
  const minute = knobs.hour * 60;
  const look = ketchFrameLook(cam.pos, minute, lane);
  renderer.setMoonlight(null);
  renderer.setLighting(look.ambient, look.sunScale, look.sunColor);
  applyFog(renderer, look.fog);
  const cpu0 = performance.now();
  deck.pose(labVoyage(), clock, clock * 1000, null);
  steps.ride(clock, dt, null, true);
  bill.cpuMs = performance.now() - cpu0;
  const lights = deck.lightsNear(cam.pos, renderer.maxPointLights ?? 16);
  const data = lightList(lights.length), colors = new Float32Array(Math.max(1, lights.length) * 3);
  lights.forEach((l, i) => { packLight(data, i, l); colors.set(l.color, i * 3); });
  renderer.setPointLights(data, null, colors.subarray(0, lights.length * 3));
  renderer.setClearColor(look.clear);
  renderer.beginFrame(proj, view, look.sunDir, WORLD_FRAME);
  bill.gl = 0; bill.draws = 0; bill.casters = 0; bill.moving = 0; bill.lights = lights.length;
  for (const d of dynamicDraws) {
    if (d.hidden || d.culled) continue;
    renderer.drawMesh(d.gpu, d.object.matrix, d.texRemap ?? null, d.noShadow ? NO_SHADOW : WITH_SHADOW);
    bill.draws++; bill.gl += d.gpu?.subMeshes?.length ?? 1;   // a GL draw a submesh (the colour pass's)
    // a caster MOVED when it cast in the frame before too and its matrix changed between them (a part that comes to rest
    // and casts from there - a section risen home - moved before it cast)
    const m = d.object.matrix, was = _was.get(d);
    if (!d.noShadow) { bill.casters++; if (was && was.cast && was.m.some((v, i) => v !== m[i])) bill.moving++; }
    if (was) { was.m.set(m); was.cast = !d.noShadow; } else _was.set(d, { m: Float32Array.from(m), cast: !d.noShadow });
  }
  _movedSince = Math.max(_movedSince, bill.moving);
  if (lawMesh) renderer.drawMeshWire(lawMesh, identity(), null);
  if (sky) {
    sky.setState(skyState({ minuteOfDay: minute, weather: knobs.weather, seconds: clock }));
    sky.draw(cam.yaw, cam.pitch, (65 * Math.PI) / 180, w / h);
  }
  const camRight = new Float32Array([-view[0], -view[4], -view[8]]);
  renderer.drawBillboards(deck.billboards(cam.pos, clock), camRight, new Float32Array([0, 1, 0]));
  renderer.resolveFrame();
  if (billBox) billBox.textContent = `ship GL draws ${bill.gl}\nship meshes ${bill.draws}\ncasters ${bill.casters} (moving ${bill.moving})\nlights ${bill.lights}\nship CPU ${bill.cpuMs.toFixed(2)} ms`;
  window.__frame++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
