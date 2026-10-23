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
// STAFF-VIEW1 (2026-10-23, mob: "np player esp in staff panel?", "i need staff panel to have esp"; design doc, In game:
// the staff view - the staff tags, scenes/staffViewHost.js). Two more, and no version bump: an existing message keeps
// its meaning, and a panel that does not know these leaves them unanswered (tags then name the player alone):
//   the hook asks { dfoStaff: 'tags?' }            when the staff view turns on, on Shift+M and every 60 s while on
//   and the panel answers { dfoStaff: 'tags', dist, list: [{ sub, level, why, watch }] } - kept as validTags reads it:
//                                                  known fields only, ID_RE subs, TAGS_MAX rows, a why of TAG_WHY_MAX
//   the host posts { dfoStaff: 'act', act: 'follow', sub, name } after a tag click followed - the chat menu's act shape,
//   so the panel opens its card on the player the game follows (the panel acts on nothing it carries)
import { OnlineSession } from './online.js';
import { SOCIAL_ROOM, cellRoomOfWire, isCellRoom } from './wire.js';
import { ID_RE, TOKEN_MAX_CHARS } from './identityToken.js';
import { noteRoom } from './staffFollow.js';
import { notePlace } from './staffTeleport.js';

/** The hook's version - the panel reads it and refuses a build it does not know. */
export const STAFF_HOOK_VERSION = 1;
/** STAFF-VIEW1: the panel's tags answer, as the game keeps it - rows at most, a flag's words at most, the urgencies, and
 *  the nameplate distances Your settings offers (m), the middle one when the answer names none of them. */
export const TAGS_MAX = 200;
export const TAG_WHY_MAX = 80;
export const TAG_LEVELS = Object.freeze(['high', 'medium', 'low']);
export const NAMEPLATE_DISTS = Object.freeze([50, 100, 200]);
export const NAMEPLATE_DIST = 100;
/** How long the hook waits for the panel's token before its link counts the room refused. */
export const STAFF_TOKEN_WAIT_MS = 5000;
/** The name a follow's sockets say - the relay shows them to nobody, and the token's own name is the service's. */
const SPECTATOR = 'Spectator';

/** STAFF-PANEL5-FOLLOW-FIX (the relay review's finding 18): a WebSocket class whose every room asks a hidden seat
 *  (`?hd=1`, server/src/staffHidden.js hiddenAsked) - the reserve over a full layer's cap, so the eye joins the target's
 *  layer rather than being walked to another, and a hello without its hidden token there is closed, never shown. Only
 *  the eye's: the reserve is HIDDEN_RESERVE seats a room however empty, and the hub holds every hidden staff game's link.
 *  @param {any} WS */
export const hiddenSeat = (WS) => WS && class extends WS {
  /** @param {string} url @param {any[]} more */
  constructor(url, ...more) { super(`${url}${url.includes('?') ? '&' : '?'}hd=1`, ...more); }
};

/** THE FOLLOW. `main()` the game's presence session (its relay's address) or null offline; `askToken(sub, room)` a
 *  follow token for a room, from the panel. Pure of any scene: the host reads `locked`, `view` and `place`.
 *  @param {{ main: () => any, askToken: (sub: string, room: string) => Promise<string|null>, Session?: any, WS?: any }} deps */
export function createStaffHook({ main, askToken, Session = OnlineSession, WS = globalThis.WebSocket }) {
  /** @type {string|null} */ let target = null;
  let on = false, note = /** @type {any} */ (null), room = /** @type {string|null} */ (null), ly = 0, seen = /** @type {any} */ (null);
  /** STAFF-PANEL5-FOLLOW-R2: the room `seen` was taken in - a pose is in its room's frame (an interior has its own, every
   *  cell shares the world's). @type {string|null} */
  let seenIn = null;
  let hub = /** @type {any} */ (null), eye = /** @type {any} */ (null);
  /** STAFF-PANEL5-FOLLOW-FIX (finding 1): the target's socket id, as a room said it (`in`) - a place room's roster names
   *  no account, so this is the one name its peers know them by. @type {string|null} */
  let pid = null;
  const close = () => { hub?.leave(); eye?.leave(); hub = null; eye = null; on = false; note = null; room = null; ly = 0; seen = null; pid = null; };
  const mint = (/** @type {string} */ sub) => (/** @type {string} */ r) => (sub === target ? askToken(sub, r) : Promise.resolve(null));
  /** The hub's word (net/staffFollow.js validFollowOut), for this follow's target alone. @param {any} f */
  function heard(f) {
    if (!f || f.sub !== target) return;
    if (f.k === 'on') on = true;
    // STAFF-PANEL5-FOLLOW-R2: the hub's newer word on their room wins over the pose seen before it (a fast travel, a door
    // out) - a pose seen after it leads again (tick)
    // STAFF-PANEL5-FOLLOW-R3: but a word naming the room that pose was seen in is no newer than it - the eye's own `in`
    // from the cell it just left, or a note sent before the crossing; dropping the pose on it sent the eye back while it
    // was on its way (a seam: two cells, every few frames, a token and a hello each). A note still wins once the eye's
    // new room has welcomed it and not shown them (gone back by a recall, say)
    else if (f.k === 'note') { note = f.p; const r = noteRoom(f.p); if (r) { room = r.room; ly = r.ly; if (r.room !== seenIn || eye?.welcomed) seen = null; } }
    else if (f.k === 'in') { room = f.room; ly = f.ly ?? 0; pid = f.id ?? pid; if (f.room !== seenIn) seen = null; }
    else if (f.k === 'gone') { room = null; seen = null; pid = null; }   // offline: the follow stands, and waits for their next note
    // 'out': the room keeps its socket until the hub's next note says where they went
  }
  /** The target as the room I watch from shows them, or null. */
  function peer() {
    if (!eye) return null;
    for (const p of eye.peers?.values?.() ?? []) if (p && (p.sub === target || (pid && p.id === pid))) return p.shown ?? p.pose ?? null;
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
    /** STAFF-VIEW1: the players the room I watch from draws - while a follow is locked the host has left its own room
     *  (its session's peers cleared), so these are the only players the staff view can tag. */
    peers: () => eye?.drawable?.() ?? [],
    /** Every frame: the hub link held, and the room link where the hub says, standing on the target for range. */
    tick() {
      const m = main?.();
      if (!target || !m?.url) { if (hub || eye) close(); return; }
      if (!hub) {
        const h = hub = new Session({ url: m.url, name: SPECTATOR, presence: false, mintToken: mint(target), WebSocketImpl: WS });
        h.onFollow = heard;
        // STAFF-PANEL5-FOLLOW-FIX (the relay review's finding 5): the hub's lease, kept on its link and handed to the eye
        // (as chatSafetyHost does for the game's own links) - with leaseDoor on, a lease room hears nothing else from it
        h.onLease = (/** @type {string} */ l) => { h.sendLease(l); eye?.sendLease(l); };
      }
      if (hub.room !== SOCIAL_ROOM) hub.join(SOCIAL_ROOM, null);
      hub.tick();
      if (!on) return;
      const v = peer();
      // STAFF-PANEL5-FOLLOW-R2: a pose leads only in the frame of the room the hub names (an interior's own pose names no
      // outdoor cell), and only while they stand in the room I saw them in - gone from it, the hub's word leads
      if (v && (eye.room === room || (isCellRoom(eye.room) && isCellRoom(room)))) { seen = v; seenIn = eye.room; }
      else if (!v && eye?.room === seenIn) seen = null;
      // outdoors the target's own pose names the next cell before their note does (a crossing is not a door)
      const want = seen && room && isCellRoom(room) ? cellRoomOfWire(seen.x, seen.z) ?? room : room;
      if (!want) return;
      if (!eye) { eye = new Session({ url: m.url, name: SPECTATOR, presence: true, mintToken: mint(target), WebSocketImpl: hiddenSeat(WS) }); eye.leaseFrom(hub); }
      const at = seen ?? (Number.isFinite(note?.wx) ? { x: note.wx, y: note.wy, z: note.wz, yaw: 0, pitch: 0, mv: 0 } : null);
      if (eye.room !== want) { eye.layerHint = ly; eye.join(want, at); } else if (at) eye.sendPose(at);
      eye.tick();
    },
  };
}

/** STAFF-VIEW1: THE PANEL'S TAGS ANSWER, AS THE GAME KEEPS IT - known fields only, read strictly: the nameplate distance
 *  one Your settings offers (else NAMEPLATE_DIST), and for each account the most urgent flag the rows give it (the
 *  highest level wins, with its words) and whether a watch names it. A row with an account that is no account id, a
 *  level that is none of TAG_LEVELS, or nothing to show is dropped; past TAGS_MAX rows nothing is read; words that are
 *  not a string of TAG_WHY_MAX at most are no words. Null for an answer with no list.
 *  @param {any} m @returns {{ dist: number, flags: Map<string, { level: string|null, why: string, watch: boolean }> }|null} */
export function validTags(m) {
  if (!Array.isArray(m?.list)) return null;
  /** @type {Map<string, { level: string|null, why: string, watch: boolean }>} */
  const flags = new Map();
  const rank = (/** @type {string|null} */ l) => (l ? TAG_LEVELS.indexOf(l) : TAG_LEVELS.length);
  for (const r of m.list.slice(0, TAGS_MAX)) {
    if (typeof r?.sub !== 'string' || !ID_RE.test(r.sub)) continue;
    const level = TAG_LEVELS.includes(r.level) ? r.level : null;
    const watch = r.watch === true;
    if (!level && !watch) continue;
    const why = level && typeof r.why === 'string' && r.why.length <= TAG_WHY_MAX ? r.why : '';
    const had = flags.get(r.sub);
    if (!had) { flags.set(r.sub, { level, why, watch }); continue; }
    if (rank(level) < rank(had.level)) { had.level = level; had.why = why; }
    had.watch = had.watch || watch;
  }
  return { dist: NAMEPLATE_DISTS.includes(m.dist) ? m.dist : NAMEPLATE_DIST, flags };
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
  /** STAFF-VIEW1: the panel's last tags answer (validTags), or null while it has given none. */
  let tags = /** @type {ReturnType<typeof validTags>} */ (null);
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
    else if (m.dfoStaff === 'tags') tags = validTags(m) ?? tags;   // STAFF-VIEW1: an answer with no list keeps the last
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
  // STAFF-VIEW1: `tags()` the panel's last answer, `askTags()` the ask - to this page's own origin, as every word here
  return { askToken, panel: () => seen, tags: () => tags, askTags: () => post({ dfoStaff: 'tags?' }) };
}
