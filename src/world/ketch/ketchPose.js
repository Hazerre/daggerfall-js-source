// @ts-check
// KETCH (bible/11-Multiplayer/Sky-Ketch.md sections 3 and 8): WHERE THE KETCH'S MOVING PARTS STAND AT A MOMENT - pure, read
// by the deck's set (scenes/ketch/ketchDeckHost.js) and pinned by its tests. Every clock here is the law's (net/ketch/
// ketchDeck.js - the shared clock's seconds every screen and the relay read alike), so the hammer a screen draws slamming
// is the one the relay judges, and the section a screen draws falling is the one the room let fall.
//
//   A HAMMER'S HEAD (hammerHeadY): at rest under its housing; drawn back up its wind-up (KT_HAMMER.wu); slammed to the deck
//     at its landing and held there its span (KT_HAMMER.sp); hauled back up to rest.
//   A STEAM LANE, AN ARC (hazardState): quiet, hissing or crackling through its wind-up, live through its span.
//   A SECTION OF THE BRIDGE'S OUTER RING (sectionPose): whole; shuddering through its warning; fallen at its moment and
//     dropping away out of sight; gone; and risen back into its place in the last KT_SECTION_RISE_MS before it is whole.
//
// Not a DFU member. Ledger A (KETCH).
import { KT_HAMMER, KT_STEAM, KT_ARCS, KT_GALLERY, hammerPhase } from '../../net/ketch/ketchDeck.js';

/** A hammer's head's foot (deck y) at rest, drawn back and slammed home; how long its slam takes and its haul back. */
export const KT_HAMMER_POSE = Object.freeze({ rest: KT_GALLERY.y + 3.0, top: KT_GALLERY.y + 4.3, floor: KT_GALLERY.y + 0.02, slam: 0.12, haul: 0.7 });
const ease = (k) => { const x = Math.max(0, Math.min(1, k)); return x * x * (3 - 2 * x); };
const wrap = (t, c) => ((t % c) + c) % c;

/** Hammer (row `ri`, lane `li`)'s head's foot at shared second `t` (deck y). Pure. */
export function hammerHeadY(ri, li, t) {
  const H = KT_HAMMER, P = KT_HAMMER_POSE, c = H.cycle, sp = H.sp / 1000, wu = H.wu / 1000;
  const u = wrap(t - hammerPhase(ri, li), c);   // seconds since its last landing
  if (u < sp) return P.floor;
  if (u < sp + P.haul) return P.floor + (P.rest - P.floor) * ease((u - sp) / P.haul);
  if (u < c - wu) return P.rest;
  if (u < c - P.slam) return P.rest + (P.top - P.rest) * ease((u - (c - wu)) / (wu - P.slam));
  return P.top + (P.floor - P.top) * ((u - (c - P.slam)) / P.slam) ** 2;
}

/**
 * A steam lane's or an arc's state at shared second `t`: `{ live, warn, k }` - live through its span from each landing,
 * warning through its wind-up before (`k` how far into the wind-up, 0..1). `kind` 'steam' or 'arc', `j` its place. Pure.
 */
export function hazardState(kind, j, t) {
  const H = kind === 'steam' ? KT_STEAM : KT_ARCS, phase = kind === 'steam' ? (j * H.cycle) / 2 : (j * H.cycle) / 3;
  const u = wrap(t - phase, H.cycle), sp = H.sp / 1000, wu = H.wu / 1000;
  if (u < sp) return { live: true, warn: false, k: 1 };
  if (u >= H.cycle - wu) return { live: false, warn: true, k: (u - (H.cycle - wu)) / wu };
  return { live: false, warn: false, k: 0 };
}

/** How far a fallen section drops before it is out of sight (m), how fast (m/s^2), and how long its rise back takes (ms). */
export const KT_SECTION_DROP = Object.freeze({ seen: 60, g: 14, shudder: 0.06 });
export const KT_SECTION_RISE_MS = 1200;
/**
 * Section `k`'s pose at relay ms `now` from the fight's word of the ring (`sec` - `[[k, at, back], ...]`, the wire's): `{
 * solid, dy, shake, hidden }` - solid (its collider in place) until its moment and again from its return; `dy` its drop
 * (0 whole, negative falling or rising back), `shake` its shudder through its warning, `hidden` once out of sight.
 * `warnMs` how long its warning runs before its moment. Pure.
 */
export function sectionPose(k, sec, now, warnMs) {
  const s = (sec ?? []).find((e) => e[0] === k);
  if (!s || now >= s[2]) return { solid: true, dy: 0, shake: 0, hidden: false };
  const at = s[1], back = s[2];
  if (now < at - warnMs) return { solid: true, dy: 0, shake: 0, hidden: false };
  if (now < at) return { solid: true, dy: 0, shake: KT_SECTION_DROP.shudder * Math.sin(now / 23) * ((now - (at - warnMs)) / warnMs), hidden: false };
  const D = KT_SECTION_DROP;
  if (now >= back - KT_SECTION_RISE_MS) { const k2 = (back - now) / KT_SECTION_RISE_MS; return { solid: false, dy: -D.seen * k2 * k2, shake: 0, hidden: false }; }
  const f = (now - at) / 1000, dy = -0.5 * D.g * f * f;
  return dy < -D.seen ? { solid: false, dy: -D.seen, shake: 0, hidden: true } : { solid: false, dy, shake: 0, hidden: false };
}
