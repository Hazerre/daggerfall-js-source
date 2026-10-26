// @ts-check
// LOCKPICK (2026-10-26, the owner: "I want to build a detailed lock picking minigame and introduce a lockpick item";
// bible/06-Systems/Lockpicking.md section 4): THE LOCK'S WINDOW - the tumblers seen in cross-section, the pick under them
// and the tension wrench in the keyway, over the machine (systems/lockpick/lockpickAct.js) its door hands it. A window
// redesigned on purpose, not one of DFU's (Daggerfall has none - it rolls the chance and says a line): it cites its own
// design record, Lockpicking.md section 4, under THE NATIVE-WINDOW RULE's SCOPE1 sentence (Home.md).
//
// WHAT IT DRAWS (a canvas, LOCK_W x LOCK_H, scaled to the window): the brass housing over the plug, the shear line between
// them; a chamber a pin, each its spring, its steel driver pin (a spool's waisted) and its brass key pin cut to its own
// length; a set pin's driver held above the shear line and its key pin dropped back - the gap a set pin leaves; the pick
// along the keyway, its tip under the pin it is aimed at and lifting with it; the wrench at the keyway's mouth. A hand
// that senses the binding pin (Lockpicking 50 - lockpickLaw.js sensesBinding) sees its chamber lit; a spool's false set
// turns the plug back a hair; a snapped pick's tip falls; the open lock's plug turns. Under the system's reduced motion
// the plug never shakes and nothing pulses - the pins move, because their moving is the lock.
//
// HOW IT IS PLAYED: the pick moves along the pins (Left / Right, A / D, a pin's number, the mouse over a chamber), and one
// press LIFTS a pin at rest or SETS the one moving (Space, Up, W, Enter, a click or a tap on its chamber); Q is the Auto
// attempt; Esc leaves. Under Gentle work (uiPrefs gentleActs - the professions' accessibility choice) the tumblers are
// shown and only the Auto attempt is offered. Every answer has its words (`answerWords`) and its sound (the door's ear).
import { t } from '../systems/textManager.js';
import { FRAME_TONES as T } from './enhanced/enhancedFrame.js';
import { PIN } from '../systems/lockpick/lockpickAct.js';
import { overlayAction } from './input.js';

/** The canvas's own size; the window scales it. */
export const LOCK_W = 520;
export const LOCK_H = 260;
/** The lock's geometry on the canvas: the housing's box, the shear line, the keyway's floor, a pin's widths and lengths. */
export const LOCK_GEOM = Object.freeze({
  left: 70, right: 470, top: 26, shear: 128, bottom: 222, keyway: 206, chamber: 30, driver: 40, keyMin: 26, keyMax: 46,
});
/** A false set's turn back and a snap's fall, in seconds. */
const SHAKE_S = 0.28;
const FALL_S = 0.6;
const OPEN_S = 0.7;

const STYLE_ID = 'lockpick-window-style';
export const LOCKPICK_CSS = `
.lk-host { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(4,5,8,0.45); z-index: 13; }
.lk-win { width: min(560px, 94vw); background: ${T.ground}; border: 2px solid ${T.stoneMid}; box-shadow: 0 0 0 2px ${T.outline}, 0 10px 0 rgba(0,0,0,0.55);
  color: #f1ead8; font: 15px/1.35 Georgia, 'Times New Roman', serif; padding: 0 0 10px; user-select: none; -webkit-user-select: none; touch-action: none; }
.lk-head { padding: 10px 14px 8px; background: linear-gradient(${T.stoneDim}, ${T.stoneDark}); border-bottom: 2px solid ${T.outline}; }
.lk-title { color: ${T.brassHi}; font-size: 18px; letter-spacing: 0.02em; }
.lk-diff { color: #d9d0bc; font-style: italic; font-size: 14px; }
.lk-canvas { display: block; width: calc(100% - 20px); margin: 10px auto 6px; aspect-ratio: ${LOCK_W} / ${LOCK_H}; background: #0b0d11;
  border: 2px solid ${T.outline}; box-shadow: inset 0 0 0 2px ${T.stoneDim}; cursor: pointer; image-rendering: auto; }
.lk-word { min-height: 2.7em; padding: 0 14px; text-align: center; color: #fbf8f0; }   /* two lines held, so the window never jumps as its words change */
.lk-word.bad { color: #ffc4bb; } .lk-word.good { color: #c9f0b0; } .lk-word.warn { color: #ffd98a; }
.lk-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; padding: 4px 14px 0; color: #e2dccd; font-size: 13px; }
.lk-meta b { color: ${T.brassHi}; font-weight: normal; }
.lk-acts { display: flex; justify-content: center; gap: 10px; padding: 10px 14px 2px; }
.lk-acts button { font: inherit; color: #f1ead8; background: ${T.groundButton}; border: 2px solid ${T.stoneMid}; box-shadow: 0 0 0 2px ${T.outline}, 0 3px 0 ${T.outline};
  padding: 5px 14px; cursor: pointer; }
.lk-acts button:hover:not(:disabled) { border-color: ${T.brass}; background: ${T.groundButtonHi}; }
.lk-acts button:disabled { opacity: 0.45; cursor: default; }
.lk-acts .lk-leave { border-color: #7a3b34; }
.lk-keys { padding: 6px 14px 0; text-align: center; color: #a89e88; font-size: 12px; }
@media (max-width: 560px) { .lk-keys { display: none; } .lk-acts button { padding: 8px 16px; } }
`;

/** A pin's key length on the canvas - each its own, by the lock's seed and its place (a key's cut). Pure. */
export const keyLength = (seed, i) => {
  const G = LOCK_GEOM;
  const h = Math.imul((seed ^ (i + 1) * 0x9e3779b1) >>> 0, 0x85ebca6b) >>> 0;
  return G.keyMin + ((h >>> 8) % (G.keyMax - G.keyMin + 1));
};
/** A chamber's middle on the canvas, for a lock of `n` pins. Pure. */
export const chamberX = (n, i) => {
  const G = LOCK_GEOM, span = G.right - G.left - 90;
  return n <= 1 ? (G.left + G.right) / 2 : G.left + 45 + (span * i) / (n - 1);
};
/** The chamber under a point `x` of the canvas, or -1 between them. Pure. */
export const chamberAt = (n, x) => {
  for (let i = 0; i < n; i++) if (Math.abs(x - chamberX(n, i)) <= LOCK_GEOM.chamber * 0.9) return i;
  return -1;
};

/** THE WORDS for every answer of the machine, and for the picks running out (L10N4: read when said). */
export const LOCK_WORDS = Object.freeze({
  title: (/** @type {string} */ what) => t('lock.window.title', 'Picking {what}', { what }),
  start: () => t('lock.window.start', 'Lift the pins one by one. The binding pin rises slowly and hangs at the line - press again to set it.'),
  gentle: () => t('lock.window.gentle', 'Gentle work is on: the tumblers need no timing, and Auto attempt picks the lock.'),
  lift: () => t('lock.word.lift', 'The pin binds against the pick... set it as it hangs.'),
  springy: () => t('lock.word.springy', 'That pin springs straight back - it is not binding yet.'),
  set: () => t('lock.word.set', 'Click. The pin sets.'),
  'false-set': () => t('lock.word.falseSet', 'A false set - that pin is a spool. Lift it and set it again.'),
  already: () => t('lock.word.already', 'That pin is already set.'),
  slip: () => t('lock.word.slip', 'Your pick slips, and a pin drops back.'),
  break: (/** @type {number} */ left) => (left > 0
    ? t('lock.word.break', 'Your lockpick snaps! {count} left.', { count: left })
    : t('lock.word.breakLast', 'Your last lockpick snaps!')),
  open: () => t('lock.word.open', 'The plug turns. The lock is open.'),
  none: () => t('lock.word.none', 'You have no lockpicks left.'),
  picks: (/** @type {number} */ n) => t('lock.meta.picks', 'Lockpicks: {count}', { count: n }),
  pins: (/** @type {number} */ set, /** @type {number} */ n) => t('lock.meta.pins', 'Pins set: {set} of {count}', { set, count: n }),
  skill: (/** @type {number} */ s) => t('lock.meta.skill', 'Lockpicking {value}', { value: s }),
  auto: () => t('lock.act.auto', 'Auto attempt (Q)'),
  leave: () => t('lock.act.leave', 'Leave (Esc)'),
  keys: () => t('lock.window.keys', 'Left / Right or 1-6: choose a pin  -  Space, Up or click: lift and set  -  Q: auto  -  Esc: leave'),
});
/** The tone each answer's words are drawn in. */
const TONE = Object.freeze({ set: 'good', open: 'good', 'false-set': 'warn', slip: 'bad', break: 'bad', none: 'bad', springy: 'warn' });

/**
 * Mount the window in `host`. `deps`:
 *   act       - the machine (systems/lockpick/lockpickAct.js createLockpickAct)
 *   what      - the lock's name, said in its title ("the door", "the chest")
 *   difficulty- DFU's look-at line for it (world/actionSystem.js lookAtLockText)
 *   skill     - the live Lockpicking, shown
 *   seed      - the lock's seed (its key pins' cuts)
 *   picks     - () => the pack's lockpicks now
 *   gentle    - Gentle work: only the Auto attempt
 *   reduced   - () => the system's reduced motion
 *   onAnswer  - (answer) => the door's word for every press (its ear, the pack's picks, the end)
 *   onExit    - the window's way out
 * Answers `{ out(), repaint(), unmount() }` - `out` the picks gone (only Leave stays).
 * @param {HTMLElement} host @param {any} deps
 */
export function mountLockpickWindow(host, deps) {
  const doc = host.ownerDocument ?? globalThis.document;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = LOCKPICK_CSS; (doc.head ?? doc.body).append(s); }
  const el = (tag, cls, text = '') => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const act = deps.act, st = act.state;
  const gentle = deps.gentle === true;
  const win = el('div', 'lk-win');
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-label', LOCK_WORDS.title(deps.what ?? ''));
  const head = el('div', 'lk-head');
  head.append(el('div', 'lk-title', LOCK_WORDS.title(deps.what ?? '')), el('div', 'lk-diff', deps.difficulty ?? ''));
  const canvas = /** @type {HTMLCanvasElement} */ (el('canvas', 'lk-canvas'));
  canvas.width = LOCK_W; canvas.height = LOCK_H;
  const word = el('div', 'lk-word', gentle ? LOCK_WORDS.gentle() : LOCK_WORDS.start());
  word.setAttribute('aria-live', 'polite');
  const meta = el('div', 'lk-meta');
  const acts = el('div', 'lk-acts');
  const autoB = /** @type {HTMLButtonElement} */ (el('button', 'lk-auto', LOCK_WORDS.auto()));
  const leaveB = /** @type {HTMLButtonElement} */ (el('button', 'lk-leave', LOCK_WORDS.leave()));
  autoB.type = 'button'; leaveB.type = 'button';
  acts.append(autoB, leaveB);
  win.append(head, canvas, word, meta, acts, el('div', 'lk-keys', LOCK_WORDS.keys()));
  host.classList.add('lk-host');
  host.append(win);
  const ctx = canvas.getContext('2d');
  let alive = true, out = false, raf = 0, last = null;
  /** the moments the window draws: a false set's shake, a snapped tip's fall, the plug's turn - seconds since */
  const fx = { shake: -1, fall: -1, open: -1, fallX: 0 };
  const reduced = () => { try { return !!deps.reduced?.(); } catch { return false; } };

  const say = (text, tone = '') => { word.textContent = text; word.className = `lk-word${tone ? ` ${tone}` : ''}`; };
  const drawMeta = () => {
    const n = Math.max(0, Number(deps.picks?.()) || 0);
    meta.replaceChildren(...[LOCK_WORDS.picks(n), LOCK_WORDS.pins(st.next, st.n), LOCK_WORDS.skill(Math.trunc(Number(deps.skill) || 0))].map((s) => { const b = el('span', ''); b.append(el('b', '', s)); return b; }));
    autoB.disabled = out || st.done;
  };
  /** One answer of the machine: its words, its moment, and the door told. */
  const answered = (a) => {
    if (!a) return;
    if (a === 'false-set' && !reduced()) fx.shake = 0;
    if (a === 'break') { fx.fall = 0; fx.fallX = st.lastPin >= 0 ? chamberX(st.n, st.lastPin) : chamberX(st.n, st.pos); }
    if (a === 'open') fx.open = 0;
    deps.onAnswer?.(a);
    if (!alive) return;
    const left = Math.max(0, Number(deps.picks?.()) || 0);
    if (a === 'break') say(LOCK_WORDS.break(left), TONE.break);
    else say(LOCK_WORDS[a]?.() ?? '', TONE[a] ?? '');
    drawMeta();
  };
  const press = () => { if (!out && !gentle && !st.done) answered(act.press()); };
  const auto = () => { if (!out && !st.done) answered(act.auto()); };
  const move = (d) => { if (!out && !gentle) act.move(d); };
  const aim = (i) => { if (!out && !gentle) act.aim(i); };
  autoB.onclick = (e) => { e.preventDefault(); auto(); };
  leaveB.onclick = (e) => { e.preventDefault(); deps.onExit?.(); };

  // THE POINTER: over a chamber the pick goes there; a press (a click, a tap) lifts or sets the pin it is under
  const canvasX = (e) => { const r = canvas.getBoundingClientRect(); return ((e.clientX - r.left) / Math.max(1, r.width)) * LOCK_W; };
  canvas.addEventListener('pointermove', (e) => { const i = chamberAt(st.n, canvasX(e)); if (i >= 0) aim(i); });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const i = chamberAt(st.n, canvasX(e));
    if (i >= 0) aim(i);
    press();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // THE KEYBOARD, the window's own (the DOM doors' capture law - ui/brokerWindow.js): a key it answers goes no further
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.code;
    let took = true;
    if (k === 'ArrowLeft' || k === 'KeyA') move(-1);
    else if (k === 'ArrowRight' || k === 'KeyD') move(1);
    else if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW' || k === 'Enter' || k === 'NumpadEnter') { if (!e.repeat) press(); }
    else if (k === 'KeyQ') { if (!e.repeat) auto(); }
    else if (/^(Digit|Numpad)[1-9]$/.test(k)) aim(Number(k.slice(-1)) - 1);
    else if (overlayAction(e) === 'back') deps.onExit?.();
    else took = false;
    if (took) { e.preventDefault(); e.stopPropagation(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });

  // THE DRAW, a frame at a time: the machine ticked, the lock drawn as it stands
  const G = LOCK_GEOM;
  const lit = (x, y, w, h, c0, c1) => { const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, c0); g.addColorStop(1, c1); ctx.fillStyle = g; ctx.fillRect(x, y, w, h); };
  function drawPin(i, now) {
    const p = st.pins[i], x = chamberX(st.n, i), w = 18, key = keyLength(deps.seed ?? 0, i);
    const restTop = G.keyway - key;                  // the key pin's top at rest
    const rise = restTop - G.shear;                  // how far it lifts to meet the shear line
    const binding = act.binding === i;
    const lift = p.phase === PIN.set ? 0 : p.y * rise;
    const keyTop = restTop - lift;
    const driverBottom = p.phase === PIN.set ? G.shear - 1 : keyTop;
    const driverTop = driverBottom - G.driver;
    // the chamber
    ctx.fillStyle = '#16120c';
    ctx.fillRect(x - G.chamber / 2, G.top + 6, G.chamber, G.keyway - G.top - 6);
    if (st.sense && binding && !st.done && !out) {
      const k = reduced() ? 0.7 : 0.55 + 0.25 * Math.sin(now * 5);
      ctx.strokeStyle = `rgba(243,207,134,${k.toFixed(3)})`; ctx.lineWidth = 2;
      ctx.strokeRect(x - G.chamber / 2 - 2, G.top + 4, G.chamber + 4, G.keyway - G.top - 2);
    }
    // the spring, from the chamber's top to the driver's
    ctx.strokeStyle = '#8f949c'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    const coils = 7, s0 = G.top + 8, s1 = driverTop;
    for (let c = 0; c <= coils * 2; c++) { const yy = s0 + ((s1 - s0) * c) / (coils * 2); ctx.lineTo(x + (c % 2 ? 7 : -7), yy); }
    ctx.stroke();
    // the driver pin - a spool waisted
    lit(x - w / 2, driverTop, w, G.driver, '#d7dbe2', '#7b818c');
    if (p.spool) {
      ctx.fillStyle = '#16120c';
      ctx.fillRect(x - w / 2, driverTop + G.driver * 0.35, 4, G.driver * 0.3);
      ctx.fillRect(x + w / 2 - 4, driverTop + G.driver * 0.35, 4, G.driver * 0.3);
      if (p.falseSet) { ctx.fillStyle = 'rgba(255,217,138,0.85)'; ctx.fillRect(x - w / 2, driverTop - 3, w, 2); }
    }
    // the key pin, its tip pointed where the key's cut meets it
    const keyBottom = p.phase === PIN.set ? G.keyway : keyTop + key;
    const kt = p.phase === PIN.set ? G.keyway - key : keyTop;
    lit(x - w / 2, kt, w, keyBottom - kt - 5, '#f3cf86', '#9a6a2c');
    ctx.fillStyle = '#9a6a2c';
    ctx.beginPath(); ctx.moveTo(x - w / 2, keyBottom - 5); ctx.lineTo(x + w / 2, keyBottom - 5); ctx.lineTo(x, keyBottom + 1); ctx.fill();
    if (p.phase === PIN.set) { ctx.fillStyle = 'rgba(201,240,176,0.9)'; ctx.fillRect(x - w / 2 - 3, G.shear - 2, w + 6, 2); }
    return { x, tip: p.phase === PIN.set ? G.keyway : keyBottom };
  }
  function draw(now) {
    const shakeX = fx.shake >= 0 && fx.shake < SHAKE_S ? Math.sin(fx.shake * 70) * 3 * (1 - fx.shake / SHAKE_S) : 0;
    const turn = fx.open >= 0 ? Math.min(1, fx.open / OPEN_S) : 0;
    ctx.clearRect(0, 0, LOCK_W, LOCK_H);
    ctx.fillStyle = '#0b0d11'; ctx.fillRect(0, 0, LOCK_W, LOCK_H);
    // the housing and the plug, the shear line between
    lit(G.left, G.top, G.right - G.left, G.shear - G.top, '#b88a46', '#6f4e22');
    ctx.save();
    ctx.translate(shakeX, turn * 6);
    lit(G.left + 6, G.shear, G.right - G.left - 12, G.bottom - G.shear, '#9c7436', '#4e3616');
    ctx.fillStyle = '#0d0b08'; ctx.fillRect(G.left + 6, G.keyway, G.right - G.left - 12, 8);   // the keyway
    ctx.restore();
    ctx.fillStyle = '#1b130a'; ctx.fillRect(G.left, G.shear - 1, G.right - G.left, 2);
    ctx.strokeStyle = T.outline; ctx.lineWidth = 2; ctx.strokeRect(G.left, G.top, G.right - G.left, G.bottom - G.top);
    // the pins
    const tips = [];
    for (let i = 0; i < st.n; i++) tips.push(drawPin(i, now));
    // the tension wrench at the keyway's mouth
    ctx.strokeStyle = '#a7adb7'; ctx.lineWidth = 5; ctx.lineCap = 'square';
    ctx.beginPath(); ctx.moveTo(22, G.keyway - 34 + turn * 10); ctx.lineTo(22, G.keyway + 14); ctx.lineTo(G.left + 26, G.keyway + 14); ctx.stroke();
    // the pick along the keyway, its tip under the pin aimed at, lifting with it
    if (!out && !(st.done && !st.open)) {
      const at = tips[st.pos] ?? tips[0];
      const tipY = st.done ? G.keyway : Math.min(G.keyway, at.tip + 1);
      ctx.strokeStyle = '#dfe3ea'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, G.keyway + 4); ctx.lineTo(at.x - 12, G.keyway + 4); ctx.lineTo(at.x - 2, tipY); ctx.lineTo(at.x + 3, tipY - 2); ctx.stroke();
      ctx.fillStyle = '#6b4428'; ctx.fillRect(0, G.keyway + 1, 34, 7);   // the grip's wrap at the edge
    }
    // a snapped tip falling
    if (fx.fall >= 0 && fx.fall < FALL_S) {
      const k = fx.fall / FALL_S;
      ctx.strokeStyle = `rgba(223,227,234,${(1 - k).toFixed(3)})`; ctx.lineWidth = 3;
      const y = G.keyway + 2 + k * k * 40;
      ctx.beginPath(); ctx.moveTo(fx.fallX - 10, y); ctx.lineTo(fx.fallX + 2, y - 4); ctx.stroke();
    }
    if (fx.open >= 0 && !reduced()) { ctx.fillStyle = `rgba(201,240,176,${(0.18 * (1 - Math.min(1, fx.open / OPEN_S))).toFixed(3)})`; ctx.fillRect(0, 0, LOCK_W, LOCK_H); }
  }
  const frame = (ms) => {
    if (!alive) return;
    const now = ms / 1000;
    const dt = last == null ? 0 : Math.min(0.25, Math.max(0, now - last));
    last = now;
    act.tick(dt);
    for (const k of ['shake', 'fall', 'open']) if (fx[k] >= 0) fx[k] += dt;
    if (ctx) draw(now);
    raf = globalThis.requestAnimationFrame?.(frame) ?? 0;
  };
  drawMeta();
  raf = globalThis.requestAnimationFrame?.(frame) ?? 0;
  if (gentle) { canvas.style.cursor = 'default'; }

  return {
    /** The picks are gone: only Leave stays. */
    out() { out = true; act.cancel(); say(LOCK_WORDS.none(), TONE.none); drawMeta(); leaveB.focus?.(); },
    repaint() { drawMeta(); },
    /** For the gamepad's and a host's mapped presses (the door's `input`). */
    act(a) { if (a === 'left') move(-1); else if (a === 'right') move(1); else if (a === 'press') press(); else if (a === 'auto') auto(); },
    unmount() {
      if (!alive) return;
      alive = false;
      if (raf) globalThis.cancelAnimationFrame?.(raf);
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      win.remove();
      host.classList.remove('lk-host');
    },
  };
}
