// @ts-check
// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow, In game: the staff view, and
// the weak spots "The panel must not lean on game internals that change between builds" and "No camera looks through the
// player's eyes yet") - THE GAME'S STAFF HOOK. Small, versioned, and the only door the Staff Panel uses into the game.
//
// It carries no combat and no movement code: it follows one player, by their account, and lets go. Following, it holds
// two sockets of its own - a hub link and, once the hub has said where, a link to the target's room - both on follow
// tokens the Staff Panel mints on its staff session (server-account/src/staffFollow.js, the claims `hd` and `fo`), never
// on the player's own login. Nothing it holds shows the staff member: the relay keeps a hidden spectator out of every
// list, count and fan (the hidden builder's half), and the host leaves its own room while the follow is locked
// (scenes/world.js). The camera copies the target only after the hub itself said `on` to this hook's hub link - the
// relay-checked flag: a token the relay did not verify as a follow is never told `on`, so a page script calling
// follow() moves no camera.
//
// THE PANEL'S DOOR (the extension's content script cannot reach this page's objects, so it is window messages, same
// window and origin only):
//   { dfoStaff: 'hook?' }                          -> { dfoStaff: 'hook', v: STAFF_HOOK_VERSION }  (an unknown v: the
//                                                     panel switches itself off with a clear message)
//   { dfoStaff: 'follow', sub }                    follow that account at once (another pick switches to it)
//   { dfoStaff: 'unlock' }                         let go
//   the hook asks { dfoStaff: 'token', sub, room } and the panel answers { dfoStaff: 'token', sub, room, tok } - a
//   follow token for that room (a token opens each room once), or tok null when the staff session refuses it.
import { OnlineSession } from './online.js';
import { SOCIAL_ROOM, cellRoomOfWire, isCellRoom } from './wire.js';
import { ID_RE, TOKEN_MAX_CHARS } from './identityToken.js';
import { noteRoom } from './staffFollow.js';
import { notePlace } from './staffTeleport.js';

/** The hook's version - the panel reads it and refuses a build it does not know. */
export const STAFF_HOOK_VERSION = 1;
/** How long the hook waits for the panel's token before its link counts the room refused. */
export const STAFF_TOKEN_WAIT_MS = 5000;
/** The name a follow's sockets say - the relay shows them to nobody, and the token's own name is the service's. */
const SPECTATOR = 'Spectator';

/** THE FOLLOW. `main()` the game's presence session (its relay's address) or null offline; `askToken(sub, room)` a
 *  follow token for a room, from the panel. Pure of any scene: the host reads `locked`, `view` and `place`.
 *  @param {{ main: () => any, askToken: (sub: string, room: string) => Promise<string|null>, Session?: any }} deps */
export function createStaffHook({ main, askToken, Session = OnlineSession }) {
  /** @type {string|null} */ let target = null;
  let on = false, note = /** @type {any} */ (null), room = /** @type {string|null} */ (null), ly = 0, seen = /** @type {any} */ (null);
  let hub = /** @type {any} */ (null), eye = /** @type {any} */ (null);
  const close = () => { hub?.leave(); eye?.leave(); hub = null; eye = null; on = false; note = null; room = null; ly = 0; seen = null; };
  const mint = (/** @type {string} */ sub) => (/** @type {string} */ r) => (sub === target ? askToken(sub, r) : Promise.resolve(null));
  /** The hub's word (net/staffFollow.js validFollowOut), for this follow's target alone. @param {any} f */
  function heard(f) {
    if (!f || f.sub !== target) return;
    if (f.k === 'on') on = true;
    else if (f.k === 'note') { note = f.p; const r = noteRoom(f.p); if (r) { room = r.room; ly = r.ly; } }
    else if (f.k === 'in') { room = f.room; ly = f.ly ?? 0; }
    else if (f.k === 'gone') { room = null; seen = null; }   // offline: the follow stands, and waits for their next note
    // 'out': the room keeps its socket until the hub's next note says where they went
  }
  /** The target as the room I watch from shows them, or null. */
  function peer() {
    if (!eye) return null;
    for (const p of eye.peers?.values?.() ?? []) if (p?.sub === target) return p.shown ?? p.pose ?? null;
    return null;
  }
  return {
    version: STAFF_HOOK_VERSION,
    /** Follow `sub` at once - another pick lets the last go. False for no account. @param {unknown} sub */
    follow(sub) {
      if (typeof sub !== 'string' || !ID_RE.test(sub)) return false;
      if (sub !== target) { close(); target = sub; }
      return true;
    },
    /** Let go. */
    unlock() { close(); target = null; },
    /** Whether the camera is the target's: a follow the hub said `on` to. */
    locked: () => !!target && on,
    target: () => target,
    /** The room the follow watches from (a cell's or a world room's), or null while the hub has not said. */
    room: () => room,
    /** The target's pose (net/wire.js validPose) while their room shows them to me, else null. */
    view: () => (target && on ? peer() : null),
    /** Where the target's last note puts staff (net/staffTeleport.js notePlace) - the host's "spectator enter". */
    place: () => (target && on && note ? notePlace({ ...note, ...(room ? { rk: room } : {}) }) : null),
    /** The hub's word, as a session hands it (online.js onFollow). */
    heard,
    /** Every frame: the hub link held, and the room link where the hub says, standing on the target for range. */
    tick() {
      const m = main?.();
      if (!target || !m?.url) { if (hub || eye) close(); return; }
      if (!hub) { hub = new Session({ url: m.url, name: SPECTATOR, presence: false, mintToken: mint(target) }); hub.onFollow = heard; }
      if (hub.room !== SOCIAL_ROOM) hub.join(SOCIAL_ROOM, null);
      hub.tick();
      if (!on) return;
      const v = peer();
      if (v) seen = v;
      // outdoors the target's own pose names the next cell before their note does (a crossing is not a door)
      const want = seen && room && isCellRoom(room) ? cellRoomOfWire(seen.x, seen.z) ?? room : room;
      if (!want) return;
      if (!eye) eye = new Session({ url: m.url, name: SPECTATOR, presence: true, mintToken: mint(target) });
      const at = seen ?? (Number.isFinite(note?.wx) ? { x: note.wx, y: note.wy, z: note.wz, yaw: 0, pitch: 0, mv: 0 } : null);
      if (eye.room !== want) { eye.layerHint = ly; eye.join(want, at); } else if (at) eye.sendPose(at);
      eye.tick();
    },
  };
}

/** THE PANEL'S DOOR on a window (above) - `hookOf()` the follow; answers the panel's `hook?`, takes its `follow` and
 *  `unlock`, and hands back `askToken` for the follow's links and `panel()`, whether a panel has spoken on this page (a
 *  /tp follows on only then - with no panel no token comes, and its links would knock for nothing). Messages from
 *  another window or origin are not the panel's.
 *  @param {any} win @param {() => any} hookOf @param {{ setTimer?: typeof setTimeout, clearTimer?: typeof clearTimeout }} [t] */
export function staffHookDoor(win, hookOf, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  /** @type {Map<string, (tok: string|null) => void>} */
  const waiting = new Map();
  let seen = false;
  const origin = win?.location?.origin;
  const post = (/** @type {object} */ m) => win.postMessage(m, origin);
  win?.addEventListener?.('message', (/** @type {any} */ e) => {
    const m = e?.data;
    if (e?.source !== win || e?.origin !== origin || !m || typeof m.dfoStaff !== 'string') return;
    const hook = hookOf();
    if (m.dfoStaff === 'hook?') { seen = true; post({ dfoStaff: 'hook', v: STAFF_HOOK_VERSION }); }
    else if (m.dfoStaff === 'follow') { seen = true; hook?.follow(m.sub); }
    else if (m.dfoStaff === 'unlock') hook?.unlock();
    else if (m.dfoStaff === 'token' && 'tok' in m) waiting.get(`${m.sub}|${m.room}`)?.(typeof m.tok === 'string' && m.tok.length <= TOKEN_MAX_CHARS ? m.tok : null);
  });
  /** @param {string} sub @param {string} room @returns {Promise<string|null>} */
  const askToken = (sub, room) => new Promise((resolve) => {
    const k = `${sub}|${room}`;
    waiting.get(k)?.(null);
    const done = (/** @type {string|null} */ tok) => { if (waiting.get(k) === done) waiting.delete(k); clearTimer(timer); resolve(tok); };
    const timer = setTimer(() => done(null), STAFF_TOKEN_WAIT_MS);
    waiting.set(k, done);
    post({ dfoStaff: 'token', sub, room });
  });
  return { askToken, panel: () => seen };
}
