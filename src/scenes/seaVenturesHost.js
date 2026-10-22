// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEA VENTURES (2026-10-22, the owner: "Build ever single bit of this and dont return until its perfected" - the Eltheric
// Ocean's reasons to venture; bible/03-World/Eltheric-Ocean.md SEA-VAULTS and the sections after it) - THE SEA'S WIRING in
// the streaming world: what the world host (scenes/world.js) asks of the sea's ventures, in a module of its own (HOST-SPLIT:
// fishHost.js's shape - the host wires, this holds).
//
//   THE VAULTS (SEA-VAULTS): the day's vaults of the deep (systems/sea/seaVaults.js) while the open sea is an open zone -
//   the one the player stands at (`vaultHere`: the door's hall, the mountains' gate's - its hub lock, its epoch, its
//   high-tier foes), the chart's marks (`chartWord`: each vault, its crows, my padlock) and the crows' news (`crowLine`);
//   and where the open sea is (`openSeaAt` - nothing keeps an instance there, as in the mountains).
//
// deps = {
//   live() -> bool          the open sea is an open zone now (online, at a relay that raises it, the sea standing)
//   day() -> number         the relay's day (world.js wdunDayNow - the halls' own)
//   pixel() -> { x, y }     the player's map pixel (a building's or a dungeon's: its door's)
//   locks: Map              the hub's word on my locks, key -> until (world.js _wdunLocks)
//   crows: Map              the crows over every hall, key -> until (world.js _wdunCrows)
//   mine() -> { dungeon, until } | null   my own remains (world.js _wildMine) - a lock never shuts my way back to them
// }
// ═══════════════════════════════════════════════════════════════════
import { inEther } from '../world/ethericSea.js';
import { seaVaultPicks, seaVaultAt, seaVaultByKey } from '../systems/sea/seaVaults.js';
import { seaVaultCell } from '../net/wire.js';
import { etherRingName, etherWildRingAt } from '../systems/wild/etherWild.js';
import { t } from '../systems/textManager.js';

/** A name opening a sentence, its first letter raised ("the Isle of X" leads as "The Isle of X"). */
const capFirst = (s) => String(s ?? '').replace(/^./, (c) => c.toUpperCase());

/** @param {any} deps */
export function createSeaVentures(deps) {
  const live = () => !!deps.live?.();
  /** The open sea at map pixel `p` (`{ x, y }`): live, and past Veilhaven's peace inside the sea's box - where nothing keeps
   *  an instance (scenes/instanceDoor.js `wild`, the mountains' own rule). */
  const openSeaAt = (p) => live() && !!p && etherWildRingAt(p.x, p.y) > 0;
  /** The day's vaults of the deep, while the open sea is an open zone - none otherwise. */
  const vaultsNow = () => (live() ? seaVaultPicks(deps.day()) : []);
  /** The vault whose ruin stands at the player's pixel today, or null. */
  function vaultHere() {
    if (!live()) return null;
    const p = deps.pixel?.();
    if (!p || !inEther(p.x, p.y)) return null;
    return seaVaultAt(vaultsNow(), p.x, p.y);
  }
  const myWayBack = (key, now) => { const m = deps.mine?.(); return !!m && m.dungeon === key && m.until > now; };
  /** The chart's word of the sea's ventures: the open sea's fights (`pvp`) and the day's vaults - each its place, its
   *  name and band, my padlock on it (my lock still shuts it, and no remains of mine lie in it) and its crows. */
  function chartWord(now = Date.now()) {
    return {
      pvp: live(),
      vaults: vaultsNow().map((v) => ({
        key: v.key, x: v.x, y: v.y, name: v.name, band: v.band, ring: v.ring,
        locked: (deps.locks?.get(v.key) ?? 0) > now && !myWayBack(v.key, now), crows: !!deps.crows?.has(v.key),
      })),
    };
  }
  /** THE CROWS' NEWS of a vault of the deep (`"e<cx>,<cy>"`): its name and its band - today's vault or yesterday's (a body
   *  lies twelve minutes past the day's turn) - or, a vault no day names, the sea's own words; null for a mountain hall. */
  function crowLine(h) {
    if (!seaVaultCell(h)) return null;
    const d = Number(deps.day?.()) || 0;
    const v = seaVaultByKey(vaultsNow(), h) ?? (live() ? seaVaultByKey(seaVaultPicks(d - 1), h) : null);
    return v
      ? t('sea.vault.crows', 'Crows gather over {name} ({band}). Someone has fallen there.', { name: capFirst(v.name), band: etherRingName(v.ring) })
      : t('sea.vault.crowsAnon', 'Crows gather over a vault of the deep. Someone has fallen there.');
  }
  return { vaultsNow, vaultHere, openSeaAt, chartWord, crowLine };
}
