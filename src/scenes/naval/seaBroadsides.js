// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SHIP-PVP (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - broadsides
// between captains in the open sea, a ship wrecked and boarded, her hold a prize; bible/03-World/Eltheric-Ocean.md
// SHIP-PVP) - THE OPEN SEA'S GUNS, the page's naval half. Built by the sea's host (scenes/seaVenturesHost.js) and attached
// to the naval host (scenes/naval/navalHost.js `pvp` - its seams: my ship as the referee is told of her, the referee's word
// laid on her, her wreck). The relay referees every word (net/sea/seaRef.js); this module says them and lays its answers.
//
//   - OPEN: online, in the open zone at sea (past Veilhaven's peace - systems/wild/etherWild.js ETHER_KIND), at a relay
//     that referees the sea's guns (online.js `seaPvpOk`): my balls meet a stranger captain's ship (never my party's or my
//     guild's - world.js wildIsStranger), and a peer's are seen to meet another's (seen only: her own game is told).
//   - MY HELM, said to the referee (`helm`) every SEA_HELM_SAY_MS, and whenever my ship, her hull or her toughness changes
//     (at most every SEA_HELM_MIN_MS) - and that I have left her when I do.
//   - MY SHOTS on her ship, gathered (`shot` - the hull and canvas my game reckoned they struck, a fire set) and said each
//     SEA_SHOT_MS a ship.
//   - THE REFEREE'S WORDS (`hear`): a shot landed on mine laid on her (`hull` - in shares of her bar and canvas: her hull no
//     higher than its bar leaves her); my ship wrecked; one I wrecked - which I board (`board`, to the room that wrecked
//     her) when my ship comes within SEA_BOARD_NEAR_M of hers, of where I last saw her, or of where she lay when the
//     wreck was said (her captain gone, or jumped away, leaves her wreck - seaRef.js seaBoard); the wreck signed, handed
//     to the wreck's service half (scenes/seaWreckHost.js).
//
// deps = {
//   live() -> bool          the open sea's guns are open here (online, the open zone at sea, a relay that referees them)
//   naval() -> host | null  the naval host (its `pvp` seams)
//   send(data, { room }) -> bool   a wild frame out (online.js sendWild - a room's word to `room`'s socket)
//   me() -> id | null       my peer id on the relay
//   stranger(id) -> bool    a peer outside my party and guild
//   name(id) -> string      a peer's name, as shown
//   receipt(rc)             a wreck's signed receipt, carried (seaWreckHost.js)
//   say(text, s) / mid(text, s)
//   now() -> ms             this machine's clock
// }
// ═══════════════════════════════════════════════════════════════════
import { SEA_SHOT_MAX } from '../../net/wire.js';
import { SEA_REF } from '../../net/sea/seaRef.js';
import { t } from '../../systems/textManager.js';

/** A ship's shots are said this often, gathered (ms). */
export const SEA_SHOT_MS = 250;   // a word a ship four times a second - two ships under my guns within the referee's SEA_REF.hz
/** My helm is said at least this often while I sail the open sea (ms) - within the referee's SEA_REF.helmMs. */
export const SEA_HELM_SAY_MS = 5_000;
/** ...and, changed, no sooner than this after the last (ms). */
export const SEA_HELM_MIN_MS = 500;
/** I board a wreck of mine when my ship comes this near her captain (metres - within the referee's SEA_REF.boardM). */
export const SEA_BOARD_NEAR_M = 30;
/** A boarding said again this often until the referee answers it (ms). */
export const SEA_BOARD_RETRY_MS = 2_000;
/** A captain's guns on me, and mine on hers, said once this often a captain (ms). */
export const SEA_SAID_MS = 60_000;

/** @param {any} deps */
export function createSeaBroadsides(deps) {
  const now = () => Number(deps.now?.()) || Date.now();
  const pending = new Map();   // peer -> { d, s, f } gathered since the last word
  const mine = new Map();      // r -> { victim, at, sentAt, name, room, site, seen } - my wrecks, to board
  const saidTo = new Map();    // `${kind}:${peer}` -> when said
  let shotAt = 0, helmAt = -Infinity, helmKey = 'off', open = false;
  const pvp = () => deps.naval?.()?.pvp ?? null;
  const once = (/** @type {string} */ key, /** @type {() => void} */ fn) => { const at = saidTo.get(key) ?? -Infinity; if (now() - at < SEA_SAID_MS) return; saidTo.set(key, now()); if (saidTo.size > 64) saidTo.delete(saidTo.keys().next().value); fn(); };
  const nameOf = (/** @type {string} */ id) => deps.name?.(id) || t('sea.pvp.someone', 'another captain');
  /** My ship as the referee is told of her - or null (no ship of mine at hand, or none whose uid it can sign). */
  const helm = () => (open ? pvp()?.helm?.() ?? null : null);

  /**
   * MAY THIS BALL MEET HER SHIP? - `peer` her captain, `shooter` the ball's, `byMe` whether it is mine: mine where the sea's
   * guns are open, she a stranger and my ship no wreck; a peer's ball on another peer's ship where they are open here (seen
   * only - neither is mine to judge).
   * @param {string} peer @param {unknown} shooter @param {boolean} byMe
   */
  function openOn(peer, shooter, byMe) {
    if (!open) return false;
    if (byMe) { const h = helm(); return !!h && !h.wrecked && !!deps.stranger?.(peer); }
    return typeof shooter === 'string' && shooter.startsWith('peer:') && shooter.slice(5) !== peer;
  }
  /** MY BALL STRUCK HER SHIP (navalHost.js landHit): its hull and canvas, and a fire, gathered for her word. */
  function shot(/** @type {string} */ peer, /** @type {any} */ hurt) {
    if (!open || !hurt) return;
    const acc = pending.get(peer) ?? { d: 0, s: 0, f: false };
    acc.d += Math.max(0, Number(hurt.hull) || 0);
    acc.s += Math.max(0, Number(hurt.sail) || 0);
    acc.f = acc.f || !!hurt.fire;
    pending.set(peer, acc);
  }
  /** My helm said: changed, at most each SEA_HELM_MIN_MS; unchanged, each SEA_HELM_SAY_MS. */
  function sayHelm(/** @type {number} */ at) {
    const h = helm();
    const word = h && !h.wrecked ? { k: 'helm', hl: h.hl, t: Math.max(100, Math.min(240, Math.round(h.t * 100))), u: h.u, h: Math.max(0, Math.min(1000, Math.round(h.h * 1000))) } : null;
    const key = word ? `${word.hl},${word.u},${word.t},${word.h}` : 'off';
    if (key === helmKey ? at - helmAt < SEA_HELM_SAY_MS || key === 'off' : at - helmAt < SEA_HELM_MIN_MS) return;
    if (deps.send?.(word ?? { k: 'helm', hl: -1, t: 100, u: 0, h: 0 })) { helmKey = key; helmAt = at; }
  }
  /** A peer boat's place, copied (her `pos` is the shown place, moved each frame - comeSailAwayPeers.js helmBoats) - or null. */
  const placeOf = (/** @type {unknown} */ p) => (Array.isArray(p) ? [Number(p[0]), Number(p[1]), Number(p[2])] : null);
  /** Within boarding reach of my ship `h` - `p` a place in my scene (or none). */
  const alongside = (/** @type {any} */ h, /** @type {unknown} */ p) => Array.isArray(p) && Math.hypot(h.pos[0] - p[0], h.pos[2] - p[2]) <= SEA_BOARD_NEAR_M;
  /**
   * THE STEP, each exterior frame (the sea's host's): the open sea's gate read; my helm said; my gathered shots said each
   * SEA_SHOT_MS; a wreck of mine boarded when my ship comes alongside her - or where I last saw her, or where she lay.
   */
  function step() {
    const at = now();
    const was = open;
    open = !!deps.live?.();
    if (!open) {
      pending.clear();
      if (was && helmKey !== 'off' && deps.send?.({ k: 'helm', hl: -1, t: 100, u: 0, h: 0 })) { helmKey = 'off'; helmAt = at; }
      return;
    }
    sayHelm(at);
    if (at - shotAt >= SEA_SHOT_MS && pending.size) {
      shotAt = at;
      for (const [to, acc] of pending) {
        const d = Math.min(SEA_SHOT_MAX, Math.round(acc.d)), s = Math.min(SEA_SHOT_MAX, Math.round(acc.s));
        if (d > 0 || s > 0 || acc.f) deps.send?.({ k: 'shot', to, d, s, f: acc.f ? 1 : 0 });
      }
      pending.clear();
    }
    const h = mine.size ? helm() : null;
    for (const [r, w] of mine) {
      if (at - w.at > SEA_REF.boardMs) { mine.delete(r); continue; }
      const her = placeOf(pvp()?.peerAt?.(w.victim));
      if (her) w.seen = her;
      if (!h?.pos || at - w.sentAt < SEA_BOARD_RETRY_MS || !(alongside(h, w.seen) || alongside(h, w.site))) continue;
      if (deps.send?.({ k: 'board', r }, { room: w.room })) {
        if (!w.sentAt) deps.mid?.(t('sea.pvp.boarded', 'You come alongside {name}\'s wreck and board her. Her hold is open to you.', { name: w.name }), 5);
        w.sentAt = at;
      }
    }
  }
  /** THE REFEREE'S WORD (world.js wildRefIn's sea kinds - wire.js validWildRefOut), from `room`: what landed, a wreck, a
   *  wreck signed. */
  function hear(/** @type {any} */ g, /** @type {string | null} */ room = null) {
    const me = deps.me?.();
    if (!g || !me) return;
    if (g.k === 'hull') {
      if (g.to === me) {
        pvp()?.struck?.({ frac: g.d / 1000, sail: g.s / 1000, fire: g.f === 1, left: g.h / 1000 });
        once(`on:${g.by}`, () => deps.say?.(t('sea.pvp.underFire', '{name}\'s guns are on you!', { name: nameOf(g.by) }), 4));
      } else if (g.by === me) once(`by:${g.to}`, () => deps.say?.(t('sea.pvp.striking', 'Your broadside strikes {name}\'s ship.', { name: nameOf(g.to) }), 4));
      return;
    }
    if (g.k === 'wreck') {
      if (g.id === me) { pvp()?.wreck?.(); deps.mid?.(t('sea.pvp.wrecked', 'Your ship is wrecked by {name}\'s guns! She lies crippled.', { name: nameOf(g.by) }), 6); return; }
      if (g.by !== me) return;
      const name = nameOf(g.id), site = placeOf(pvp()?.peerAt?.(g.id));
      mine.set(g.r, { victim: g.id, at: now(), sentAt: 0, name, room, site, seen: site });
      if (mine.size > 8) mine.delete(mine.keys().next().value);
      deps.mid?.(t('sea.pvp.wreckedHer', '{name}\'s ship is wrecked! Come alongside and board her for her hold.', { name }), 6);
      return;
    }
    if (g.k === 'wc') { mine.delete(g.r); deps.receipt?.(g.rc); }
  }
  return { open: openOn, shot, step, hear, get live() { return open; } };
}
