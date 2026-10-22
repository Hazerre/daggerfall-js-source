// What the decoration look may offer for the thing under the crosshair. One call, run at once: a later
// confirm/discard list can record the same action instead of performing it.
// A player piece that stores or crafts is still that player's decoration. The building's own furniture, its
// cupboards and its structure are not.

const NONE = Object.freeze({ move: false, duplicate: false, remove: false });

/** `decor` a placed piece, `container` or `station` one that does that, `door` a placed door, `base` the
 *  building's own furniture, `structural` a door, exit or ladder that is not a placed piece. */
export function decorAimKind(key, piece) {
  if (piece) {
    if (piece.door) return 'door';
    if (piece.station) return 'station';
    if (piece.storage) return 'container';
    return 'decor';
  }
  if (typeof key !== 'string') return null;
  if (key.startsWith('base:')) return 'base';
  if (key.startsWith('container:') || key.startsWith('shelf:')) return 'container';
  if (key.startsWith('exit:') || key.startsWith('act:') || key.startsWith('ladder:')) return 'structural';
  return null;
}

/**
 * Move, duplicate and remove, for one aim. Nothing for the building's own furniture or its structure, nor when
 * the player may not edit this room. A piece that holds anything is not removed. One's own thing is not copied.
 * @param {{ kind?: string, key?: string, piece?: any, holds?: boolean, mayEdit?: boolean } | null} aim
 */
export function decorLookOffers(aim) {
  if (!aim?.piece || aim.mayEdit === false) return { ...NONE };
  const kind = aim.kind ?? decorAimKind(aim.key, aim.piece);
  if (kind !== 'decor' && kind !== 'container' && kind !== 'station' && kind !== 'door') return { ...NONE };
  return { move: true, duplicate: !aim.piece.item, remove: !aim.holds };
}
