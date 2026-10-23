// @ts-check
// ═══════════════════════════════════════════════════════════════════
// JUNGLE-ROADSIDE (bible/03-World/Bantha-Jungle.md, The roadside pairs): A PIXEL'S ROADSIDE PAIRS STOOD - a module the
// pixel's build wires (scenes/pixelBuild.js; HOST-SPLIT, bible/01-Overview/Host-Split.md). The layout stood each pair's
// two trees as jungle trees carrying their pair (world/terrain/jungleNature.js withJungle, world/jungle/jungleRoadside.js
// standPairs); here each whole pair (wholePairs) stands as:
//   - ITS SPAN near the eye: the owner's file whole - both trees as they drew them and the lianas between - one instance
//     of its near-only prototype in the jungle door's near set, at its anchor, turned across its road and at its scale
//     (world/lowPolyTrees.js buildTreeSet `turn`, `own`);
//   - ITS TWO TREES far off and as things: each joins a group of the build's jungle groups of its own (`P<kind>.<side>`)
//     carrying `span` - its far picture its species' (the batch giving way near the eye where its SPAN draws:
//     `lptProto`), its trunk's body and its cover its species' measures - but never the near set (the span draws it) and
//     never Logging's (a pair is the road's: felling one tree would leave lianas strung to nothing).
// A pair whose span cannot stand (its prototype missing) stands its trees as the jungle's own canopy trees.
// ═══════════════════════════════════════════════════════════════════
import { wholePairs } from '../world/jungle/jungleRoadside.js';

/**
 * @param {{ door: any, flats: any[], keep: (f: any) => boolean, groups: Map<string, any>, handles: any[], set: any[],
 *   sway: (proto: any, record: number) => void }} deps
 *   `door` the jungle's, loaded (systems/jungleTreesAssets.js - pairProto, farPicture, acquire); `flats` the pixel's pair
 *   trees; `keep(f)` whether the build would stand a flat there; `groups` the build's jungle groups (each pair tree's
 *   added); `handles` and `set` the pixel's jungle handles and near set (each span's added, its handle held as the
 *   species' are); `sway(proto, record)` the build's wind maps written for a span's prototype by its first tree's record.
 * Answers how many pairs stood.
 */
export async function standRoadside({ door, flats, keep, groups, handles, set, sway }) {
  const spans = new Map();   // a pair's kind -> its handle and its near set entry (null where it cannot stand)
  const pairs = wholePairs(flats, keep);
  for (const p of pairs) {
    if (!spans.has(p.kind)) {
      const proto = door.pairProto(p.kind);
      const h = proto ? await door.farPicture(proto) : null;
      let entry = null;
      if (h) {
        door.acquire(h);
        handles.push(h);
        entry = { h: handles.length - 1, centers: [], wild: null, own: [], fit: null, turn: [] };
        set.push(entry);
        sway(proto, p.trees[0].record);
      }
      spans.set(p.kind, { h, entry });
    }
    const { h, entry } = spans.get(p.kind);
    if (entry) { entry.centers.push([p.ax, p.ay, p.az]); entry.own.push(p.js); entry.turn.push(p.turn); }
    p.trees.forEach((t, side) => {
      const gk = h ? `P${p.kind}.${side}` : `J${t.jungle}`;
      let g = groups.get(gk);
      if (!g) groups.set(gk, (g = { species: t.jungle, young: false, centers: [], own: [], span: h }));
      g.centers.push([t.x, t.y, t.z]); g.own.push(t.js);
    });
  }
  for (const { entry } of spans.values()) if (entry) { entry.own = Float32Array.from(entry.own); entry.turn = Float32Array.from(entry.turn); }
  return pairs.length;
}
