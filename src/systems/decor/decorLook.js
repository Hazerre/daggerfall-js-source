// What the decoration look may offer for the thing under the crosshair. One call, run at once: a later
// confirm/discard list can record the same action instead of performing it.
// A player piece that stores or crafts is still that player's decoration. The building's own furniture may
// only be taken out. A room's swing door (`intdoor:`) may be taken out, and nothing else. An exit, a chained
// door or a ladder is the building's structure.

const NONE = Object.freeze({ move: false, duplicate: false, remove: false, out: false });

/** `decor` a placed piece, `container` or `station` one that does that, `door` a placed door, `roomdoor` one of
 *  the building's own swing doors, `base` the building's own furniture, `structural` an exit, a chained door or a ladder. */
export function decorAimKind(key, piece) {
  if (piece?.roomDoor) return 'roomdoor';
  if (piece) {
    if (piece.door) return 'door';
    if (piece.station) return 'station';
    if (piece.storage) return 'container';
    return 'decor';
  }
  if (typeof key !== 'string') return null;
  if (key.startsWith('intdoor:')) return 'roomdoor';
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
  if (!aim || aim.mayEdit === false) return { ...NONE };
  const kind = aim.kind ?? decorAimKind(aim.key, aim.piece);
  if (kind === 'roomdoor') return { move: false, duplicate: false, remove: true, out: false };
  if (kind === 'base') return { move: false, duplicate: false, remove: false, out: true };
  if (!aim.piece) return { ...NONE };
  if (kind !== 'decor' && kind !== 'container' && kind !== 'station' && kind !== 'door') return { ...NONE };
  return { move: true, duplicate: !aim.piece.item, remove: !aim.holds, out: false };
}

const PLAQUE_LABEL = { move: 'Move', duplicate: 'Duplicate', remove: 'Remove', out: 'Take out' };

/**
 * The hover plaque's title and its wheel list, for one aim while decorating. No list, the name the room already
 * had. A chair the room does not name on its own takes the catalogue's name.
 * @param {{ title?: string, subs?: any, actions?: any[] } | null} named
 * @param {{ kind?: string, key?: string, piece?: any, holds?: boolean, mayEdit?: boolean, name?: string } | null} aim
 */
export function decorPlaque(named, aim) {
  const offers = decorLookOffers(aim ? { ...aim, kind: aim.kind ?? decorAimKind(aim.key, aim.piece) } : null);
  const actions = [];
  if (offers.move) actions.push({ id: 'move', label: PLAQUE_LABEL.move });
  if (offers.duplicate) actions.push({ id: 'duplicate', label: PLAQUE_LABEL.duplicate });
  if (offers.remove) actions.push({ id: 'remove', label: PLAQUE_LABEL.remove });
  if (offers.out) actions.push(aim?.holds
    ? { id: 'out', label: PLAQUE_LABEL.out, disabled: true, why: 'it holds something' }
    : { id: 'out', label: PLAQUE_LABEL.out });
  if (!actions.length) return named ?? null;
  return { ...(named && typeof named === 'object' ? named : {}), title: named?.title || aim?.name || 'Piece', actions };
}

/** A built-in piece while decorating: its name, and Take out alone. Not decorating, the name the room already had. */
export function decorBuiltInPlaque(title, entry, editing) {
  const name = title || 'Piece';
  if (!editing || !entry?.baseKey) return title ? { title } : null;
  const holds = Array.isArray(entry.items) && entry.items.length > 0;
  return decorPlaque({ title: name }, { key: entry.baseKey, kind: 'base', mayEdit: true, name, holds });
}
