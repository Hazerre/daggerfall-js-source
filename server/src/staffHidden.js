// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL5-HIDDEN (2026-10-22, mob: "no tag no faint outline nothing just nothing", "true invis not lattys invis", "we
// want the player to have no idea we are wathcing them"; design doc "DFO Staff Panel: design", Invisible follow and Weak
// spots "Invisible follow and the in-game view") - THE RELAY'S HALF OF A HIDDEN STAFF MEMBER.
//
// NOT THE GAME'S INVISIBILITY (INVIS-NET, INVIS-LOOK, src/net/remotePlayers.js), which still sends the player's place to
// every game. A socket whose VERIFIED token says `hd: 1` (identityToken.js; minted by the account service for an Admin or
// a Moderator holding a live staff session with Hide me on - server-account/src/staffHidden.js) is marked `hid` on its
// attachment at its hello (index.js `_named` marks the hello off the signature, `hiddenHello` the attachment), and from
// then on:
//
//   NEVER PASSED ON. Everything it says is dropped at the top of `_message` (`hiddenMay`) but the spectator's allow list
//   - its pose (kept on its own attachment for range alone, so it hears the room near it - never fanned: `hiddenPose`),
//   its ping, a staff-channel line, a find, a lease (LEASE1's door would freeze a socket that hands none on) and Message
//   on screen. A frame dropped is dropped silently: a game in hidden mode may send what a player's sends, and a strike
//   would close the staff member's own view.
//   NAMED BY NOBODY. Left out of every walk that names or counts a room's sockets (index.js `_othersOf` - the welcome's
//   who-is-here and a region's travellers - `_namedCount`, `_busCount`, `_findNames`, `_everyoneSaid` - the World and
//   Region lists - `_idFirst`, every directed frame's target), its join and its leave never said, never a room's host
//   (`_hostWalk`, `_leads`), never in a census (no `lk`), and never the hub's account (no friends' presence, no party).
//   Its own name is the token's - HIDDEN_NAME, never the account's - and its subject a staff session's, never an account.
//   OUTSIDE THE CAP. A hidden seat is asked at the upgrade (`?hd=1`) and taken from HIDDEN_RESERVE over the room's own
//   cap; a visible socket's fullness leaves hidden ones out (`seatsTaken`). A hidden seat said hello with a visible token
//   is closed (`hiddenHello`): the reserve is the spectator's alone.
//   ADMITTED AS STAFF, WRITING NOTHING. A private home (privateInteriorAdmits' staff right), a seat-limited instance
//   (instanceAdmits' staff right), an Elite Breach and a Super dungeon's realm let a hidden socket in without its
//   admission's membership or seat written. Entering a private home is reported to the account service's audit log
//   (`hiddenEntered`, net/hiddenSeen.js) - the subject and the room, signed with the relay's receipt key.
//   CLOSED WHEN THE MARK LAPSES, NEVER SHOWN. The account service pushes a hide order (identityToken.js mintHideOrder) when
//   the staff member presses Show myself, signs out, is cut or is removed; the hub closes every hidden socket of that
//   subject whose token is no newer (`hiddenLapse`, HIDDEN_LAPSED). A mark is never taken off a live socket: a socket is
//   hidden from its hello to its close.
//
// THE FOLLOW BUILDER'S HOOKS (Invisible follow): `isHidden(a)` is the one test of an attachment; `hiddenMay` the one
// allow list (HIDDEN_FRAMES - a follow's frame type goes there); `hiddenLapse` closes by subject.
import { verifyOrder } from '../../src/net/identityToken.js';
import { sealHiddenSeen, HIDDEN_SEEN_V, HIDDEN_SEEN_SIG_HEADER, HIDDEN_SEEN_POST_MS } from '../../src/net/hiddenSeen.js';
import { isChatRoom } from './relay.js';

/** The hidden seats a room holds over its cap - a few staff watching, never a crowd. */
export const HIDDEN_RESERVE = 8;
/** The frame types a hidden socket is heard in (with a staff-channel line, `hiddenMay`). Message on screen's frame type
 *  joins this list when its builder names it; a follow's the same. */
export const HIDDEN_FRAMES = Object.freeze(['ping', 'pose', 'lease', 'find']);
/** The chat channel a hidden socket may speak in - the staff's own (assumed from the staff chat builder: net/wire.js
 *  CHAT_LINE_CHANNELS names no such channel yet, so today no hidden line is ever said). */
export const HIDDEN_CHAT = 'staff';
/** The word a hidden socket is closed with when its mark lapses - and when a hidden seat says hello with a visible token. */
export const HIDDEN_LAPSED = 'hidden lapsed';
/** The longest frame a hidden socket is heard in - a pose, a find or a line is far under it. */
const HIDDEN_FRAME_MAX = 4096;

/** Whether an attachment is a hidden staff spectator's. @param {any} a */
export const isHidden = (a) => a?.hid === 1;

/** Whether a frame a hidden socket sent is one it is heard in - read before any door, so nothing it says reaches one.
 *  @param {unknown} message */
export function hiddenMay(message) {
  if (typeof message !== 'string' || message.length > HIDDEN_FRAME_MAX) return false;
  let m;
  try { m = JSON.parse(message); } catch { return false; }
  if (!m || typeof m !== 'object') return false;
  return HIDDEN_FRAMES.includes(m.t) || (m.t === 'chat' && m.ch === HIDDEN_CHAT);
}

/** Whether an upgrade asks for a hidden seat. @param {Request} request */
export const hiddenAsked = (request) => new URL(request.url).searchParams.get('hd') === '1';

/** How many of the room's sockets are hidden - hello'd hidden, or holding a hidden seat not yet said hello.
 *  @param {any} room */
export function hiddenSeats(room) {
  let n = 0;
  for (const [ws, b] of room._all()) if ((b.hid || b.hs) && !room._dead.has(ws) && !room._gone.has(ws)) n++;
  return n;
}

/** The seats an upgrade measures against the room's cap: a visible one, every socket but the hidden ones; a hidden one,
 *  its reserve's (full at HIDDEN_RESERVE). Under the cap with every socket counted, nothing is walked.
 *  @param {any} room @param {boolean} ask @param {number} cap */
export function seatsTaken(room, ask, cap) {
  const all = room.state.getWebSockets().length;
  if (!ask && all < cap) return all;
  const n = hiddenSeats(room);
  return ask ? cap - HIDDEN_RESERVE + n : all - n;
}

/** A hello's hidden word: `who` marked `hid` when `_named` verified a hidden token for it (the room's `_hidHellos`, a
 *  WeakSet of hello frames - never a field of the frame, which is the client's word), then its refusal for being
 *  hidden, or null - a hidden seat said hello with a visible token (the reserve is the spectator's), or a hidden hello
 *  naming an id a visible socket holds (a reconnect never turns a player into a watcher - its old socket would be
 *  replaced with no leave said, and stand frozen before everyone).
 *  @param {any} room @param {any} ws @param {any} a @param {any} m @param {any} who */
export function hiddenHello(room, ws, a, m, who) {
  if (room._hidHellos.has(m)) who.hid = 1;
  if (a.hs && !who.hid) return HIDDEN_LAPSED;
  if (who.hid && room._withId(m.id, ws).some(([, b]) => !isHidden(b))) return 'id taken';
  return null;
}

/** A hidden socket's pose or ping: metered as any socket's, its pose kept on its own attachment (a listener's range) and
 *  a ping answered - nothing fanned, nothing judged, no trail, no census stamp. @param {any} room @param {any} ws
 *  @param {any} a @param {any} m */
export function hiddenPose(room, ws, a, m) {
  const posed = m.t === 'pose' && !isChatRoom(a.key);
  const met = room._meter(ws, a, Date.now(), { pose: posed ? m.p : a.pose }, {}, posed);
  if (met && m.t === 'ping') room._send(ws, '{"t":"pong"}');
}

/**
 * THE MARK LAPSED: a hide order (identityToken.js `{ o: 'hide', s, hd: 0, i, e }`) - every hidden socket of its subject
 * whose token is no newer than the order is closed HIDDEN_LAPSED, never shown. Answers whether this room believed it.
 * @param {any} room @param {unknown} order @param {number} now
 */
export async function hiddenLapse(room, order, now) {
  if (typeof order !== 'string' || !order || order.length > 1024) return false;
  await room._loadKey();
  if (!room._verifyKey) return false;
  const r = await verifyOrder(order, room._verifyKey, { subtle: crypto.subtle, nowS: Math.floor(now / 1000), kind: 'hide' });
  if (!r.ok) return false;
  const { s, i } = r.claims;
  for (const [ws, b] of [...room._all()]) if (isHidden(b) && b.sub === s && !(b.gio > i)) room._refuse(ws, HIDDEN_LAPSED);   // a token minted after the order is the service's newer word
  return true;
}

/**
 * A HIDDEN SOCKET ENTERED A PRIVATE HOME: its subject and the room, signed with the relay's receipt key and posted to
 * the account service's audit door (HIDDEN_SEEN_URL, through the ACCOUNTS binding where the Worker has it - the feed's
 * way, AUDIT SAFE RELAY S1). Never awaited by the hello; off until HIDDEN_SEEN_URL is set; a post that fails is said in
 * the log. Answers the post's promise (a test's), or null when nothing goes.
 * @param {any} room @param {string} key @param {string} sub
 */
export function hiddenEntered(room, key, sub) {
  const url = room.env?.HIDDEN_SEEN_URL;
  if (typeof url !== 'string' || !url.startsWith('https://') || !String(key).startsWith('owned:')) return null;
  return (async () => {
    try {
      const id = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(16).padStart(2, '0')).join('');
      const sealed = await sealHiddenSeen({ v: HIDDEN_SEEN_V, id, at: Date.now(), s: sub, r: key }, await room._receiptKeyOf(), { subtle: crypto.subtle });
      if (!sealed) return false;
      const init = { method: 'POST', headers: { 'content-type': 'application/json', [HIDDEN_SEEN_SIG_HEADER]: sealed.sig }, body: sealed.body, signal: AbortSignal.timeout(HIDDEN_SEEN_POST_MS) };
      const svc = room.env?.ACCOUNTS;
      const res = typeof svc?.fetch === 'function' ? await svc.fetch(new Request(url, init)) : await fetch(url, init);
      if (!res.ok) console.warn('[hidden] the service said', res.status);
      return res.ok;
    } catch (e) { console.warn('[hidden] seen post failed', e?.message ?? e); return false; }
  })();
}
