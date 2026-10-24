// @ts-check
// STAFF-PANEL5-FOLLOW (2026-10-22, design doc "DFO Staff Panel: design", Invisible follow - What staff see: "The view is
// from the player's own eyes ... It stays locked on them everywhere ... It only lets go when staff press Unlock, or click
// another player's nameplate") - THE HOST'S HALF OF A FOLLOW, out of bootWorld (HOST-SPLIT). The follow itself is
// net/staffHook.js; this is what the scene does with it: while it is locked the host's own room is left (the staff
// member's body is in no room), the place the target's note names is entered the way a staff /tp enters it (the
// "spectator enter" - the TP host's prepare, never placed), and after the motor the camera sits at the target's eyes
// and faces where they face. Nothing here moves anyone but the staff member's own camera and body, and nothing fights.
import { staffDestinationKey } from '../net/staffTeleport.js';
import { createStaffHook, staffHookDoor } from '../net/staffHook.js';
import { createStaffMap, noteHidden } from '../net/staffMap.js';
import { createStaffFollowBar } from '../ui/staffFollowBar.js';   // STAFF-FOLLOW-UNLOCK: the follow's Unlock in the game   // STAFF-MAP: the Staff Panel's region map
import { RIDE_EYE_HEIGHT, CAPSULE_HEIGHT } from '../player/motor.js';   // a peer's eye, as the peers' bodies stand it (world.js: a rider's the saddle's)

/** `where()` names the place the staff member stands in (its mode and map pixel): let go, the body the camera carried
 *  stands where the target stood, so the host stays out of every room until it is somewhere else (a door, fast travel,
 *  a teleport, or a walk off that map pixel) - it never reappears beside the player it watched. FOLLOW-HIDDEN-REJOIN
 *  (2026-10-24, mob: "when i change form invis all players dont load", after a follow): a game that is hidden (`hidden()`,
 *  its last token's `hd`) has no body anyone sees, so it parks nowhere and joins where it stands at once.
 *  @param {{ hook: any, prepare: (d: any) => Promise<any>, mode: () => string, where: () => string, toScene: (p: any) => number[] | null, eyeHeight: (p: any) => number, hidden?: () => boolean }} deps */
export function createStaffFollowHost({ hook, prepare, mode, where, toScene, eyeHeight, hidden = () => false }) {
  let entered = /** @type {string|null} */ (null), entering = false, held = false, parked = /** @type {string|null} */ (null);
  return {
    /** The online frame: the follow ticked; true while the host must stand in no room - a follow locked, or let go
     *  where it left the body. */
    frame() {
      hook.tick();
      if (!hook.locked()) {
        if (held) { held = false; entered = null; parked = where(); }
        if (parked !== null && (hidden() || parked !== where())) parked = null;
        return parked !== null;
      }
      held = true;
      const d = hook.place();
      const key = d ? staffDestinationKey(d) : null;
      // the open air carries itself (the camera walks with the target, and the world streams under it) while they are seen
      if (d && !entering && key !== entered && !(d.kind === 'exterior' && mode() === 'exterior' && hook.view())) {
        entering = true;
        Promise.resolve().then(() => prepare(d))
          .catch((e) => console.warn('[staff] the follow could not enter their place:', e?.message ?? e))
          .finally(() => { entered = key; entering = false; });   // tried once a place: their next place tries again
      }
      return true;
    },
    /** After the motor took the eye: the camera at the target's eyes, the body under it (the world streams round the
     *  body). False while there is nothing to copy. @param {{ pos: number[], _airVelX?: number, _airVelZ?: number, velY?: number, falling?: boolean, fallStart?: number }} player @param {{ pos: number[], yaw: number, pitch: number }} cam */
    eye(player, cam) {
      const v = !entering && hook.locked() ? hook.view() : null;
      const q = v ? toScene(v) : null;
      if (!q) return false;
      player.pos[0] = q[0]; player.pos[1] = q[1]; player.pos[2] = q[2];
      // carried, never fallen: no flight is registered for a follow (the motor's one flight slot is a battle spectator's)
      player._airVelX = 0; player._airVelZ = 0; player.velY = 0; player.falling = false; player.fallStart = q[1];
      cam.pos = [q[0], q[1] + eyeHeight(v), q[2]];
      cam.yaw = v.yaw; cam.pitch = v.pitch;
      return true;
    },
  };
}

/**
 * STAFF-HIDE-TOGGLE (2026-10-23, mob: "i cant talk in chat?", "need hide to be a toggle"): THE GAME'S OWN LINKS REMADE ON A
 * FRESH TOKEN, at the Staff Panel's `relink` (net/staffHook.js) - Hide me or Show myself just pressed. The account service
 * mints hidden or shown by the switch at each mint (server-account/src/staffHidden.js hiddenToken), so the held token is let
 * go (`minter.forget`, a mint still on its way with it) and every room the game holds is left and opened again: the
 * presence session's by the world frame, which joins a session standing in no room where the player is, the next frame
 * (scenes/world.js, the room key's join); each chat link's here, at once - a join clears a terminal close's wait (a hide
 * order's `hidden lapsed` on the hub link), which a rejoin would sit out for CHAT_REJOIN_MS. A link the seat or a ban took
 * out of every room stands in none and is left alone. Leave first, then open - never AURA-LIVE's swap (online.js
 * rehello): the relay refuses a hidden hello on an id a shown socket of the room still holds (`id taken`,
 * server/src/staffHidden.js hiddenHello), so the shown socket's close goes out before the new socket opens, mints and
 * says hello. A follow's own links are the hook's, on follow tokens, and stand.
 * @param {{ forget?: () => void } | null | undefined} minter @param {any} main the presence session @param {Iterable<any> | null | undefined} links the chat links
 */
export function relinkGame(minter, main, links) {
  minter?.forget?.();
  if (main?.room) main.leave();
  for (const link of links ?? []) { const room = link.room; if (room) { link.leave(); link.join(room); } }
}

/** THE PAGE'S FOLLOW, made once by the host (scenes/world.js): the panel's door on this window, the hook behind it and
 *  the host's half above - so bootWorld wires one object. `follow(sub)` is a /tp's follow-on (mob, 06:01Z: "tp should
 *  auto follow form thier view"), taken only where a Staff Panel has spoken on this page: with none, no token comes.
 *  `relink` the door's STAFF-HIDE-TOGGLE word (relinkGame, over the host's minter and links).
 *  @param {{ main: () => any, prepare: (d: any) => Promise<any>, mode: () => string, pixel: () => { x: number, y: number }, toScene: (p: any) => number[] | null, relink?: () => void, win?: any, Session?: any }} deps */
export function staffFollowOnPage({ main, prepare, mode, pixel, toScene, relink = undefined, win = globalThis.window, Session = undefined }) {
  // STAFF-MAP: the region map's link, its answers to the panel, and Hide me's relink remaking it too
  const door = staffHookDoor(win, () => hook, { relink: relink ? () => { relink(); map.relink(); } : relink, mapOf: () => map });
  const hook = createStaffHook({ main, askToken: door.askToken, ...(Session ? { Session } : {}) });
  const map = createStaffMap({ main, post: door.post, ...(Session ? { Session } : {}) });
  // FOLLOW-HIDDEN-REJOIN: whether the game is hidden now, read off each token its presence session mints (noteHidden wraps once)
  let hiddenNow = false;
  const watch = () => { const m = main(); if (m && typeof m.mintToken === 'function') m.mintToken = noteHidden(m.mintToken, (/** @type {boolean} */ h) => { hiddenNow = h; }); };
  const host = createStaffFollowHost({ hook, prepare, mode, where: () => `${mode()}|${pixel().x},${pixel().y}`, toScene, eyeHeight: (p) => (p.rd ? RIDE_EYE_HEIGHT : CAPSULE_HEIGHT - 0.2), hidden: () => hiddenNow });
  // STAFF-FOLLOW-UNLOCK: while a follow is locked, its bar and Unlock on the game's own screen
  const bar = createStaffFollowBar({ doc: win?.document, onUnlock: () => hook.unlock() });
  const barFrame = () => { if (hook.locked()) bar.show(); else bar.hide(); };
  return {
    hook, map, frame: () => { watch(); map.tick(); const out = host.frame(); barFrame(); return out; }, eye: host.eye, locked: () => hook.locked(),
    follow: (/** @type {unknown} */ sub) => door.panel() && hook.follow(sub),
    // STAFF-VIEW1 (mob: "np player esp in staff panel?"): what the staff view reads (scenes/staffViewHost.js) - whether a
    // panel spoke here, the followed room's players, the game's own session, its frame and mode, and the panel's tags
    panel: door.panel, peers: hook.peers, main, toScene, mode, tags: door.tags, askTags: door.askTags,
  };
}
