// @ts-check
// DECOR-BATCH: a decorating session's final differences. Nothing here talks to the service.
import { decorGoldMove, mintDecorId } from '../../net/decorLaw.js';

const shapeOf = (p) => JSON.stringify({
  model: p?.model ?? null,
  flat: p?.flat ?? null,
  item: p?.item ?? null,
  pos: p?.pos ?? null,
  rot: p?.rot ?? null,
  scale: p?.scale ?? null,
  light: p?.light ?? null,
  storage: !!p?.storage,
  paid: p?.paid ?? 0,
  station: p?.station ?? null,
});

/** A Confirm's id: long enough for decorLaw's DECOR_TXN_RE, and a new one after each kept Confirm. */
export function mintDecorTxn(rand = Math.random) {
  return `${mintDecorId(rand)}${mintDecorId(rand)}`;
}

/**
 * The final differences. A piece added and then removed is neither. Several edits of one piece are its last state.
 * @param {any[]} before @param {any[]} after
 */
export function decorDelta(before, after) {
  const was = new Map((before ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  const now = new Map((after ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  const put = [];
  const drop = [];
  for (const [id, p] of was) if (!now.has(id)) drop.push(id);
  for (const [id, p] of now) {
    const old = was.get(id);
    if (!old || shapeOf(old) !== shapeOf(p)) put.push(p);
  }
  return { put, drop };
}

/** What the record gains for the whole session (negative: the purse pays), off the same law as one piece. */
export function decorDraftGold(before, after) {
  const was = new Map((before ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  const now = new Map((after ?? []).filter((p) => p?.id).map((p) => [p.id, p]));
  let delta = 0;
  for (const [id, p] of was) if (!now.has(id)) delta += decorGoldMove(p, null, p.paid).delta;
  for (const [id, p] of now) {
    const old = was.get(id) ?? null;
    if (!old || shapeOf(old) !== shapeOf(p)) delta += decorGoldMove(old, p, old?.paid ?? 0).delta;
  }
  return delta;
}

/** The bar's line for that gold, before Confirm. */
export function decorDraftText(delta) {
  if (!delta) return 'nothing to pay';
  const n = Math.abs(delta).toLocaleString('en-US');
  return delta < 0 ? `${n} gold to confirm` : `${n} gold back on confirm`;
}
