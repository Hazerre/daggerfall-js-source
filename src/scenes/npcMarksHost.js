// @ts-check
// NPC-MARKS (2026-10-21, the owner: "For morrowind models, vendors and quests npcs are hard to find due to everyone looking
// the same. Could we make a bobbing icon above their character for morrowind specifically?"): THE MARKS OVER THE PEOPLE
// WHO DO SOMETHING. Daggerfall's standing people are pictures, and the picture says who they are - a shop's keeper wears
// the shop's own sprite. In a Morrowind body (bible/04-Characters/Morrowind-NPCs.md) everyone is dressed by their
// faction's wardrobe off their seed (characters/wardrobe.js), so a shopkeeper and a customer can look alike. Over each
// person whose body stands, whom a click takes somewhere other than talk, a mark bobs (render/npcMarkPass.js):
//
//   - 'quest'    a gold "!" - a person a live quest holds (their QuestResourceBehaviour: a click on them is the quest's
//                first, PlayerActivate.cs:1523-1528 - worldModes.js openStaticNpc's doClick), and a quest's stood
//                person (a questor at a marker - worldModes.js offerQuestStands). A quest set aside (QUEST-SHELF),
//                ended or broken marks no one. Over the other two: what the quest wants first.
//   - 'merchant' a gold coin - StaticNPCClick's merchant arm (systems/guild/guildServiceFlow.js staticNpcRoute: a
//                Merchants-group person in a shop, a bank or a tavern, or a custom merchant service's).
//   - 'service'  a blue gem - its guild-service arm and the coven's (a guild's trainer, spell seller or quest giver).
//
// The route is staticNpcRoute's own, built by `staticNpcRouteIn` - the one the click takes (worldModes.js openStaticNpc
// asks it too), so a mark never promises a door the click does not open. A person's route is read once (their room
// and their faction do not change while they stand); their quest every frame. Only a body standing in the lane is
// marked - a classic sprite keeps its own picture, so off the Morrowind lane nothing is drawn - the nearest
// NPC_MARKS_MAX within NPC_MARKS_REACH, hung over the body's own height (its race's). The player's switch is the
// Features page's 'npc-marks' (`npcMarks`, on by default).
//
// A HOST'S WIRING: `begin()` as its frame begins, `consider(holder, ctx)` for each person it offers the people lane (or
// `gather(ctx, people, stands)` - the begin and both lists in one call), and `draw(proj, view, eye, lane, seconds)` after
// its billboards (the depth the world wrote hides a mark behind a wall), which lets the frame's candidates go; `ctx` is
// the host's one object ({ dict, building } - getters, made once). No allocation a frame: the candidates and the marks
// live in this module's own pools.
//
// Not a DFU member. Ledger A row (NPC-MARKS).
import { NpcMarkRenderer, NPC_MARKS_MAX, markBob } from '../render/npcMarkPass.js';
import { staticNpcRoute } from '../systems/guild/guildServiceFlow.js';
import { hasCustomMerchantService } from '../systems/guild/guildServices.js';
import { isShop, isRepairShop } from '../systems/shopStock.js';
import { BUILDING_TYPES } from '../world/buildingNames.js';
import { isShelved } from '../systems/quest/quest.js';
import { getPref } from '../systems/uiPrefs.js';

/** How far from the eye a mark stands (metres) - the people lane's Near range (characters/npcBodies.js NPC_BODY_TIERS). */
export const NPC_MARKS_REACH = 30;
/** The share of the reach over which a mark fades out, at its far end. */
export const NPC_MARKS_FADE = 0.2;
/** How far over the body's crown the icon's centre hangs (metres). */
export const MARK_OVER_HEAD_M = 0.38;
/** The most people a frame considers - a hall of people, past which the rest are not asked. */
export const NPC_MARKS_CANDIDATES = 96;

/** The player's switch (Features, 'npc-marks'): on unless turned off. */
export const npcMarksOn = () => getPref('npcMarks') !== false;

/**
 * StaticNPCClick's route for a standing person (PlayerActivate.cs:1540-1600, staticNpcRoute) in the place they stand:
 * `building` the room's building record ({ factionId, buildingType }) or null in the street or a dungeon, `dict` the
 * faction table. The one construction of the route's arguments - the click and the marks ask it alike.
 * @param {{ npcFactionId: number, dict: any, building?: any }} o
 */
export function staticNpcRouteIn({ npcFactionId, dict, building = null }) {
  const buildingFactionId = building?.factionId ?? 0;
  return staticNpcRoute(/** @type {any} */ ({   // its defaults type its doors `() => false`
    npcFactionId,
    npcFaction: dict?.get(npcFactionId) ?? null,
    buildingFaction: buildingFactionId ? (dict?.get(buildingFactionId) ?? null) : null,
    buildingType: building?.buildingType ?? -1,
    insideBuilding: !!building,
    isShop,
    isRepairShop,
    isBank: (t) => t === BUILDING_TYPES.Bank,
    isTavern: (t) => t === BUILDING_TYPES.Tavern,
    hasCustomMerchantService,   // RR3: Services.HasCustomMerchantService (PlayerActivate.cs:1574)
  }));
}

/** The mark a route earns: a merchant's coin, a guild's or the coven's gem, none for talk. Pure. @param {any} route */
export function routeMark(route) {
  if (route?.kind === 'merchant') return 'merchant';
  if (route?.kind === 'guildService' || route?.kind === 'witchesCoven') return 'service';
  return null;
}

/** Whether a quest resource behaviour holds this person for a live quest - one a click would reach first
 *  (QuestResourceBehaviour.doClick: not destroyed, a target, the quest not set aside), and neither ended nor broken.
 *  @param {any} b */
export function questMarked(b) {
  if (!b || b.isComponentDestroyed) return false;
  const q = b.targetQuest ?? b.machine?.getQuest?.(b.questUID) ?? null;
  if (!q || q.questComplete || q.questBreak || isShelved(q)) return false;
  return (b.targetResource ?? q.getResource?.(b.targetSymbol) ?? null) != null;
}

/** A standing person's mark, or null: the quest's first, then their route's (read once, when the faction table is in).
 *  @param {any} holder a person (a StaticNPC record, a quest's stand) @param {{ dict: any, building?: any }} ctx */
export function markKindOf(holder, ctx) {
  if (!holder || holder.active === false || holder.dead) return null;
  if (questMarked(holder.questBehaviour ?? holder.behaviour)) return 'quest';
  if (holder.factionID == null) return null;   // a quest's stand carries no faction of its own: it is the quest's or no one's
  if (holder._mwMarkRoute === undefined) {
    const dict = ctx?.dict ?? null;
    if (!dict) return null;   // never before the faction table: asked again
    holder._mwMarkRoute = routeMark(staticNpcRouteIn({ npcFactionId: holder.factionID, dict, building: ctx?.building ?? null }));
  }
  return holder._mwMarkRoute;
}

/** A small stable phase for a holder's bob (0..1), off its lane id - so a room's marks do not rise as one. */
const phaseOf = (id) => {
  const s = String(id);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
};

const reducedMotionReader = () => {
  let at = -Infinity, reduced = false;
  return (nowS) => {
    if (nowS - at > 1) { at = nowS; try { reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { reduced = false; } }
    return reduced;
  };
};

/**
 * THE HOST'S MARKS - one renderer a GL context, built once (a context that will not build it draws nothing).
 * @param {WebGL2RenderingContext | null} gl
 * @param {{ build?: (gl: any) => any, reduced?: (nowS: number) => boolean }} [o]
 */
export function createNpcMarks(gl, { build = (g) => new NpcMarkRenderer(g), reduced = reducedMotionReader() } = {}) {
  let pass = null;
  try { pass = gl ? build(gl) : null; } catch (e) { console.warn('[npc-marks] the pass would not build', /** @type {any} */ (e)?.message ?? e); pass = null; }
  /** @type {any[]} */
  const holders = [];
  /** @type {string[]} */
  const kinds = [];
  let n = 0;
  /** @type {{ at: number[], kind: string, alpha: number, d: number }[]} */
  const marks = Array.from({ length: NPC_MARKS_MAX }, () => ({ at: [0, 0, 0], kind: 'quest', alpha: 0, d: 0 }));
  let shown = 0;
  /** The candidates let go - after each draw, so a room left behind is held by no pool. */
  const release = () => { for (let i = 0; i < n; i++) holders[i] = null; n = 0; };
  return {
    /** A frame begins: any candidates not drawn let go. */
    begin() { release(); },
    /** One person the host offers the people lane. @param {any} holder @param {{ dict: any, building?: any }} ctx */
    consider(holder, ctx) {
      if (!pass || n >= NPC_MARKS_CANDIDATES || !npcMarksOn()) return;
      const kind = markKindOf(holder, ctx);
      if (!kind) return;
      holders[n] = holder; kinds[n] = kind; n++;
    },
    /** Each of a list. @param {Iterable<any> | null | undefined} list @param {{ dict: any, building?: any }} ctx */
    considerAll(list, ctx) { if (list && pass && npcMarksOn()) for (const h of list) this.consider(h, ctx); },
    /** A frame's people in one call: `begin`, then each of `people` and of `stands` (a host's quest stands).
     *  @param {{ dict: any, building?: any }} ctx @param {Iterable<any> | null | undefined} people @param {Iterable<any> | null} [stands] */
    gather(ctx, people, stands = null) { this.begin(); this.considerAll(people, ctx); this.considerAll(stands, ctx); },
    /**
     * The marks over the bodies `lane` stands (a population lane: `heightOf(id)`), nearest first - after the host's
     * billboards. Answers whether it drew one (the host marks its foreign pass when it did).
     * @param {Float32Array} proj @param {Float32Array} view @param {ArrayLike<number>} eye
     * @param {{ heightOf?: (id: any) => number } | null | undefined} lane @param {number} seconds
     */
    draw(proj, view, eye, lane, seconds) {
      shown = 0;
      if (!pass || !n || !lane?.heightOf || !npcMarksOn()) { release(); return false; }
      const still = reduced(seconds);
      for (let i = 0; i < n; i++) {
        const h = holders[i], id = h._mwActor?.id, feet = h._mwFeet;
        if (id == null || !feet) continue;
        const tall = lane.heightOf(id);
        if (!(tall > 0)) continue;   // no body stands for them: their own picture is their mark
        const d = Math.hypot(feet[0] - eye[0], feet[1] + tall - eye[1], feet[2] - eye[2]);
        if (!(d <= NPC_MARKS_REACH)) continue;
        // the nearest NPC_MARKS_MAX, kept sorted as they come: a free slot, or the farthest kept's, taken and moved in
        if (shown === NPC_MARKS_MAX && marks[shown - 1].d <= d) continue;
        let at = shown < NPC_MARKS_MAX ? shown++ : NPC_MARKS_MAX - 1;
        const m = marks[at];
        while (at > 0 && marks[at - 1].d > d) { marks[at] = marks[at - 1]; at--; }
        marks[at] = m;
        m.d = d; m.kind = kinds[i];
        m.at[0] = feet[0]; m.at[1] = feet[1] + tall + MARK_OVER_HEAD_M + markBob(seconds, phaseOf(id), still); m.at[2] = feet[2];
        const fadeFrom = NPC_MARKS_REACH * (1 - NPC_MARKS_FADE);
        m.alpha = d <= fadeFrom ? 1 : Math.max(0, (NPC_MARKS_REACH - d) / (NPC_MARKS_REACH - fadeFrom));
      }
      release();
      if (!shown) return false;
      pass.draw(marks, shown, proj, view, eye);
      return pass.drawn > 0;
    },
    /** The marks the last draw stood, nearest first (for the tests). */
    shown() { return marks.slice(0, shown).map(({ at, kind, alpha }) => ({ at: [...at], kind, alpha })); },
  };
}
