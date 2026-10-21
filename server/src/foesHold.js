// FOES-HOLD (2026-10-21, bible/11-Multiplayer/Scale-Arc.md FOES-HOLD): A ROOM'S FIRST FRAMES WAIT THEIR TURN.
//
// FOES-FIRST put the full frames first on a room's foes budget, and where they alone are more than the budget (a
// Starfall's crowd: 40 owners of 80 sockets ask 2.4 times it in full frames) it left them first-come and blind to
// size: a refused frame was dropped, and the next one to arrive took whatever the bucket had refilled. A small frame
// always fits sooner than a large one, so ONE LARGE OWNER among smaller ones - a star's stander, its waves, its master
// and its circle on one owner, 48 records to 79 listeners - heard none of its full frames (tools/foesFirstBench.mjs
// `stander`: 0%), and the owners the draw happened to pass over waited 37 s between theirs (`star80`'s p99).
//
// So a frame that goes first is HELD when the budget cannot take it, and every held frame goes in its turn: the room's
// first frames are served first come, first served, ONE A SENDER A TURN - each sender in the place its first unserved
// frame took, a newer full frame of its replacing the older one IN that place (the readers want the newest list; the
// place is the sender's), and a sender with more held behind (a handover's batches) taking a new place at the back for
// each, so no sender's frames, however many or however large, keep another's from their turn. A held frame goes the
// moment the bucket holds its fan, and while any is held no other frame of the room spends the bucket: a delta waits
// behind the full frames as FOES-FIRST meant it to. And nothing of a sender overtakes its own held frame - the readers
// drop a frame whose `n` is not past the owner's last (scenes/exteriorFoes.js applyFoes, dungeonContext.js
// applyFoesFrame), so a delta that passed would turn the held full frame into one they refuse: it is dropped instead,
// and the held frame, which says everything it said, goes in its turn.
//
// No frame jumps the line: FOES-FIRST's handover went first once a second whatever waited, and a page that marks every
// record with an heir (the word is the sender's own) would take that turn every second at any size - with a line to
// jump, the whole budget. A handover waits its turn as any first frame does, and is never replaced and never ages out
// (the owner has let those foes go); its sender's leave gives what it still holds a last try (`_foesLeft`).
//
// This module is the hold's own law - pure; the Room's methods wire it (server/src/index.js `_foesFan`, `_foesDrain`).
import { FOES_FRAME_MAX } from '../../src/net/wire.js';

/** FOES-HOLD: the most frames one sender holds on a lane - its newest full frame and the handovers behind it (world/
 *  foeHandover.js splits an owner's handed foes into frames of FOES_FRAME_MAX, so an owner of a few dozen foes with their
 *  loot hands them on in two or three); more is refused, counted as a drop. */
export const FOES_HELD_PER_SENDER = 4;
/** FOES-HOLD: the most bytes a lane holds, the frames' own lengths - 64 of the largest frame a lane takes, or 256
 *  sockets' 16 KiB full frames. A fan is the frame times its listeners, so this is the memory, not the budget; past it
 *  the next frame to be held is refused, counted as a drop. */
export const FOES_HELD_BYTES_MAX = 64 * FOES_FRAME_MAX;
/** FOES-HOLD: a sender's turn in the line - its held frames' own lengths, the first whatever its size. 16 KiB: a full
 *  frame of a few dozen foes and a handover's batches beside it go in one turn; a page whose every frame is a 16 KiB
 *  "handover" sends one a turn, as any sender does. */
export const FOES_TURN_BYTES = 16 * 1024;
/** FOES-HOLD: how often a lane's held senders are asked whether their readers are owed a beat (`_foesBeats`) - a
 *  quarter of a second: a beat is owed at FOES_UNHEARD_MS of silence, and the readers let go at FOES_STALE_MS. */
export const FOES_BEAT_SCAN_MS = 250;

/** A lane's hold: its frames in the order they took their places, the next place's number, the bytes held, and the
 *  turn under way (its sender and the bytes it has sent in it). */
export const createFoesHold = () => ({ entries: [], seq: 0, bytes: 0, turn: null });

/** The frames one sender holds, in their order. */
export const heldOf = (hold, ws) => hold.entries.filter((e) => e.ws === ws);

/** The frame whose turn it is - the one that took its place first. */
export function heldHead(hold) {
  let best = null;
  for (const e of hold.entries) if (!best || e.seq < best.seq) best = e;
  return best;
}

/** A frame out of the hold unsent - gone stale, or its sender gone. Answers whether it was held. */
export function unhold(hold, e) {
  const i = hold.entries.indexOf(e);
  if (i < 0) return false;
  hold.entries.splice(i, 1);
  hold.bytes -= e.length;
  if (hold.turn?.ws === e.ws) hold.turn = null;
  return true;
}

/** A held frame SENT, in its turn: out of the hold, and its sender's next held frame, if any, goes in the same turn
 *  while the turn's frames come to FOES_TURN_BYTES (a handover's small batches together, with the full frame they
 *  followed) - else it, and every frame of that sender behind it, takes a new place at the back: a turn is a sender's,
 *  and no sender's frames, however many or however large, keep another's from theirs. */
export function served(hold, e) {
  const turn = (hold.turn?.ws === e.ws ? hold.turn.bytes : 0) + e.length;
  unhold(hold, e);
  const mine = heldOf(hold, e.ws);
  if (mine.length && turn + mine[0].length <= FOES_TURN_BYTES) { mine[0].seq = e.seq; hold.turn = { ws: e.ws, bytes: turn }; return; }
  for (const next of mine) next.seq = hold.seq++;
}

/**
 * A first frame into the hold - `frame` is `{ ws, data, length, ranged, full, hands, at }`. Answers what became of it:
 *   'held'        it took a place of its own - a sender's first held frame its place in the line; one behind the
 *                 sender's own (a handover's next batch) a place after it
 *   'replaced'    a full frame, in the place of its sender's newest held frame when that is no handover (a full frame,
 *                 or an unheard sender's delta - a full frame says all either said)
 *   'refused'     past FOES_HELD_PER_SENDER or FOES_HELD_BYTES_MAX, or a frame that is neither full nor a handover from
 *                 a sender already holding one (that frame says everything this one could, and goes in its turn)
 */
export function holdFrame(hold, frame) {
  const mine = heldOf(hold, frame.ws);
  const last = mine.at(-1);
  if (frame.full && !frame.hands && last && !last.hands) {
    if (hold.bytes - last.length + frame.length > FOES_HELD_BYTES_MAX) return 'refused';
    hold.bytes += frame.length - last.length;
    Object.assign(last, { data: frame.data, length: frame.length, ranged: frame.ranged, full: true, at: frame.at });
    return 'replaced';
  }
  if (mine.length && !frame.full && !frame.hands) return 'refused';
  if (mine.length >= FOES_HELD_PER_SENDER || hold.bytes + frame.length > FOES_HELD_BYTES_MAX) return 'refused';
  hold.entries.push({ ...frame, seq: hold.seq++, since: frame.at });
  hold.bytes += frame.length;
  return 'held';
}
