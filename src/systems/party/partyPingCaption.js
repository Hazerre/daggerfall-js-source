// @ts-check
// PARTY-PING: the name a look is pointing at — a foe, a door, a chest —
// so the mark can say it. Not a DFU member.
import { pickFoeHit, pickActivatableHit, activationTargets } from '../../player/activate.js';
import { enemyDisplayName } from '../../characters/enemy/enemyBasics.js';
import { properName } from '../../systems/champions.js';
import { isEliteFoe } from '../../systems/eliteFoes.js';
import { isActionDoorObject } from '../../world/actionSystem.js';
import { searchableKind, searchName } from '../../systems/searchables.js';

const clean = (s) => String(s ?? '').replace(/[^\w .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 48);

/**
 * The named thing under a look, the nearest of a foe and an action object.
 * Null when the look names nothing. `at` is where the mark should stand.
 * @param {ArrayLike<number>} eye
 * @param {ArrayLike<number>} dir
 * @param {{ collider?: object|null, foes?: ReadonlyArray<object>|null, objects?: { get?: (k: string) => object|null, values?: () => Iterable<object> }|null, look?: { targets?: ReadonlyArray<object>, name?: (key: string) => string }|null, reach?: number }} src
 * @returns {{ name: string, elite: boolean, dist: number }|null}
 */
export function pingSubject(eye, dir, { collider = null, foes = null, objects = null, look = null, reach = 64 } = {}) {
  if (!eye || !dir || !collider) return null;
  /** @type {{ name: string, elite: boolean, dist: number }[]} */
  const found = [];
  const foeHit = foes?.length ? pickFoeHit(eye, dir, foes, collider, reach) : null;
  if (foeHit?.foe && Number.isFinite(foeHit.distance)) {
    const foe = foeHit.foe;
    const entity = foe.entity ?? null;
    const own = properName(entity);
    const mobile = foe.mobileType ?? entity?.mobileType ?? -1;
    const name = clean(own ? String(own).replace(/^The /, '') : enemyDisplayName(mobile));
    if (name) found.push({ name, elite: isEliteFoe(entity), dist: foeHit.distance });
  }
  if (look?.targets && typeof look.name === 'function') {
    const act = pickActivatableHit(eye, dir, look.targets, collider);
    const title = act ? clean(look.name(act.key)) : '';
    if (title && Number.isFinite(act.distance)) found.push({ name: title, elite: false, dist: act.distance });
  } else if (objects && typeof objects.values === 'function' && typeof objects.get === 'function') {
    const act = pickActivatableHit(eye, dir, activationTargets(objects, reach), collider);
    const o = act ? objects.get(act.key) : null;
    const name = objectName(o);
    if (name && act && Number.isFinite(act.distance)) found.push({ name, elite: false, dist: act.distance });
  }
  found.sort((a, b) => a.dist - b.dist);
  return found[0] ?? null;
}

/** @param {object|null|undefined} o */
function objectName(o) {
  if (!o) return null;
  if (isActionDoorObject(o)) return 'Door';
  const kind = searchableKind(o.modelIdNum);
  if (!kind) return null;
  return searchName(kind, (o.currentLockValue ?? 0) > 0);
}
