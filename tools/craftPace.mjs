#!/usr/bin/env node
// FIRST-BUDGET (2026-10-25, SaberGGaming's report: "Provisioning is slow"; bible/06-Systems/Professions-Arc.md 50): THE
// CRAFTS A TRACK TAKES TO JOURNEYMAN AND TO MASTER, MEASURED. Each crafting track is walked from no XP: every act the best
// the rank opens - an unmade first-make where one is open (its own XP and its first's), else the best repeat - each a
// unit (a cut, a mix, a dish, a brew, a piece); the clean act wherever the act has one (a clean pan, a clean chisel - a
// player levelling plays it well); no Firmament, no seat, no crafter's limit; a Sculptor's carvings only at 100. `first`
// what a first-make pays: the law's own share (recipeLaw firstCraftXp, workFirstXp, brewFirstXp), or a flat figure - 500,
// the law before FIRST-BUDGET.
//
//   node tools/craftPace.mjs           the law's
//   node tools/craftPace.mjs 500       a flat first of 500 (as it stood)
import { RECIPES, firstCraftKey, firstCraftPays, firstCraftXp, workFirstXp, brewFirstXp, craftXp, cookXp, masonXp } from '../src/net/recipeLaw.js';
import { WORK_RECIPES, trackOf, rankOfXp, xpForRank, JOURNEYMAN_RANK, PROF_RANK_MAX } from '../src/net/professionLaw.js';
import { POTIONS, brewXp, brewFirstPays } from '../src/net/alchemyLaw.js';
import { isMain } from './lib/isMain.mjs';

/** Each crafting track's acts: { key, rank, spec, first, xp(rank) }. @param {number|null} flat */
function actsOf(flat) {
  const acts = new Map();
  const add = (track, a) => acts.set(track, [...(acts.get(track) ?? []), a]);
  for (const r of RECIPES) {
    if (r.later) continue;
    add(trackOf(r.profession), {
      key: firstCraftKey(r), rank: r.rank, spec: r.spec ?? null,
      first: flat == null ? firstCraftXp(r) : firstCraftPays(r) ? flat : 0,
      xp: (rank) => (r.kind === 'dish' ? cookXp(rank, { clean: true }) : craftXp(r.tier, rank)),
    });
  }
  for (const w of WORK_RECIPES) {
    if (!w.act) continue;
    add(trackOf(w.xp), { key: `work:${w.id}`, rank: w.rank ?? 0, spec: null, first: flat == null ? workFirstXp(w) : flat, xp: (rank) => masonXp(1, rank, { clean: true }) });
  }
  for (const p of POTIONS) {
    add(trackOf('alchemy'), { key: `brew:${p.id}`, rank: p.rank, spec: null, first: flat == null ? brewFirstXp(p) : brewFirstPays(p) ? flat : 0, xp: (rank) => brewXp(p, rank) });
  }
  return acts;
}

/** { track: { journeyman, master, firsts } } - the crafts each took, and the first-makes made on the way. @param {number|null} [flat] */
export function craftPace(flat = null) {
  const out = {};
  for (const [track, list] of actsOf(flat)) {
    let xp = 0, n = 0, journeyman = null, master = null;
    const made = new Set();
    while (xp < xpForRank(PROF_RANK_MAX) && n < 100_000) {
      const rank = rankOfXp(xp);
      let best = 0, bestKey = null;
      for (const a of list) {
        if (rank < a.rank || (a.spec && rank < PROF_RANK_MAX)) continue;
        const first = made.has(a.key) ? 0 : a.first;
        const v = a.xp(rank) + first;
        if (v > best) { best = v; bestKey = first > 0 ? a.key : null; }
      }
      if (bestKey) made.add(bestKey);
      xp += best; n++;
      if (journeyman == null && xp >= xpForRank(JOURNEYMAN_RANK)) journeyman = n;
      if (master == null && xp >= xpForRank(PROF_RANK_MAX)) master = n;
    }
    out[track] = { journeyman, master, firsts: made.size };
  }
  return out;
}

if (isMain(import.meta.url)) {
  const flat = process.argv[2] != null ? Number(process.argv[2]) : null;
  console.log(JSON.stringify(craftPace(flat), null, 2));
}
