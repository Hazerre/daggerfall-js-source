// @ts-check
// EG-FALL (2026-10-21, the owner: "I notice in the Elite Breaches, when the boss dies it freezes in place. Oblivion gates do
// the boss death the best way"; bible/11-Multiplayer/Elite-Gates.md section 16.2 and EG-FALL): A LORD'S FALL IS THE GATE'S.
// A felled lord's body stayed in the fight on the relay's word (net/eliteGates/egLink.js - fallen, EG_FL.fell, so a Twin can be
// raised again) and the screen held it on its fourth hurt frame, standing, for as long as the hall stood. Section 16.2 had
// promised "the gate's fall beats (WB13e): FELLED, the body down"; the card shipped, the body never went down.
// Now every lord falls as the Warden does (world/gate/gateBoss.js bossAct's fall, scenes/gate/gateCourt.js fallEvent and
// drawCorpse), each number the gate's own, grown by the lord's drawn size over the Warden's (EG_FALL_PER):
//   THE BODY (egLordFallAct) - its hurt frames to the floor by THUD_AT_MS, then sunk FALL_SINK_M into the stone over the rest
//     of FALL_MS, and gone; a flyer drops out of its hover as it falls (`aloft`), on its feet by the thud; where it fell,
//     never carried on along a walk the relay said before it (scenes/eliteGates/egFight.js drawBody).
//   THE KILL - its death cry (the gate's `fall` cue in the lord's own voice), a burst of Dagon's size out of its chest in
//     its element's ember (egLordEmber), the hall's light white for FALL_FLASH_MS and the camera shaken FALL_SHAKE under the
//     player's own motion (world/eliteGates/egTelegraph.js egShakeMotion - the Spire's shakes' law).
//   THE THUD - its body meeting the floor (the gate's `thud` cue), a column of embers off the floor, COLUMN_BURSTS of them
//     COLUMN_STEP_MS apart, its ember's glow dying over the fall (the gate's bossGlow while he falls).
//   ITS BODY LEFT - its mobile's own corpse (characters/enemy/enemyBasics.js corpseTexture) where it fell, at the gate's
//     CORPSE_SCALE grown as the lord is, for as long as the hall's fight keeps the lord; put away when it goes, when a Twin
//     is raised (and played again at its next fall), at a new hall and out of the breach.
// Each beat once a fall, and only while it is news (the gate's FALL_CRY_LATE_MS and its thud's and column's second): a
// screen that comes to the hall after the fall sees the body on the floor, and nothing played again.
// Drawn by the gate's own spark pass (render/gate/gateFx.js GateFxRenderer, in the fight's world pass - egFight drawPass);
// its batches and lights ride the fight's own lists. Not a DFU member: Daggerfall Unity's foes drop where they die
// (DaggerfallEnemy's corpse marker) with no fall of their own. Ledger A (ELITE-GATES).
import { FALL_MS, THUD_AT_MS, FALL_SINK_M, CORPSE_SCALE, BOSS_LOOKS, BOSS_CUES, GLOW_RANGE, emberColor } from '../../world/gate/gateBoss.js';
import { BOSS_H } from '../../net/gate/gateBrain.js';
import { FALL_FLASH_MS, FALL_SHAKE, COLUMN_BURSTS, COLUMN_STEP_MS, FALL_CRY_LATE_MS, WHITE } from '../gate/gateCourt.js';
import { GateFxRenderer, GATE_FX_PROGRAMS, FX_KINDS, FX_BURST_MS, FX_BURSTS_MAX } from '../../render/gate/gateFx.js';
import { compiledPass } from '../../render/glProgram.js';
import { ENEMY_BASICS } from '../../characters/enemy/enemyBasics.js';
import { billboardSize } from '../../world/rmbFlats.js';
import { egBodyPlace, egBodyHeight } from '../../net/eliteGates/egLink.js';
import { EG_LORDS, EG_BANDS } from '../../net/eliteGates/egLaw.js';
import { EG_BOSS_KEYS } from '../../net/eliteGates/egLords.js';

/** The gate's fall was measured on the Warden at his look's scale (world/gate/gateBoss.js BOSS_LOOKS: three Daedra Lords
 *  tall, BOSS_H); a lord drawn at `drawn` (scenes/eliteGates/egFight.js egLookOf) falls by the same numbers grown by this. Pure. */
export const EG_FALL_PER = (drawn) => (drawn > 0 ? drawn : BOSS_LOOKS.ruhn.scale) / BOSS_LOOKS.ruhn.scale;
/** How far a lord drawn at `drawn` sinks into the stone (m), how tall it stands (m, its chest at the gate's shares of it), and
 *  the scale its corpse lies at. Pure. */
export const egFallSinkM = (drawn) => FALL_SINK_M * EG_FALL_PER(drawn);
export const egFallTallM = (drawn) => BOSS_H * EG_FALL_PER(drawn);
export const egCorpseScale = (drawn) => CORPSE_SCALE * EG_FALL_PER(drawn);
/** The gate's shares of his height: the kill's burst out of his middle (gateCourt.js fallEvent), his glow at his chest
 *  (gateBoss.js GLOW_UP); and the hall's flash this high over where he fell (gateCourt.js lights), and his glow's flare. */
export const EG_FALL_BURST_UP = 0.5;
export const EG_FALL_GLOW_UP = 0.55;
export const EG_FALL_FLASH_Y = 3;
export const EG_FALL_FLASH = Object.freeze({ k: 4, range: 40 });
export const EG_FALL_GLOW = 2.2;
/** A thud or an ember of the column is heard and seen this long after its moment, and no later (gateCourt.js bodySounds
 *  and fallEvent: "each only while news"). */
export const EG_FALL_NEWS_MS = 1000;
/** WHAT A FALLEN LORD IS DOING `since` ms into its fall - the gate's (world/gate/gateBoss.js bossAct): its hurt frames
 *  (`anims`) played to the floor by THUD_AT_MS, then sunk egFallSinkM into the stone over the rest of FALL_MS; gone past
 *  it (its corpse lies there). `aloft` the share of a flyer's hover still under it - it drops out of the air, on the floor
 *  by the thud. Pure. @param {number} since @param {any} anims @param {number} [drawn] */
export function egLordFallAct(since, anims, drawn = BOSS_LOOKS.ruhn.scale) {
  if (since >= FALL_MS) return { act: 'gone', anims, frame: 0, loop: false, sink: 0, aloft: 0 };
  const s = Math.max(0, since), k = Math.min(1, s / THUD_AT_MS);
  const sink = s > THUD_AT_MS ? egFallSinkM(drawn) * Math.min(1, (s - THUD_AT_MS) / (FALL_MS - THUD_AT_MS)) : 0;
  return { act: 'fall', anims, frame: Math.max(0, Math.min(4, Math.floor(k * 5))), loop: false, sink, aloft: 1 - k * k };
}
/** A lord's element's aspect - the gate's aspects (world/gate/gateBoss.js ASPECT_COLORS) by the element the lord carries;
 *  none, its band's (net/eliteGates/egLaw.js EG_BANDS `aspect`). */
export const EG_FALL_ASPECT = Object.freeze({ fire: 'burning', frost: 'rime', shock: 'storm', poison: 'venom' });
/** A lord's element: its law's (net/eliteGates/egLaw.js EG_LORDS `el`) - a Twin's its own clan's (Vael the Fire, Isk the
 *  Frost - net/eliteGates/egLords.js egBossName), a champion none. Pure. @param {string} key @param {number} [pt] */
export const egLordEl = (key, pt = 0) => (key === 'twins' ? (pt === 1 ? 'frost' : 'fire') : EG_LORDS[key]?.el ?? null);
/** THE EMBER A LORD FALLS IN - the gate's own ember (world/gate/gateBoss.js emberColor) under its element's aspect, else its
 *  band's. Pure. @param {string} key @param {number} pt @param {number} band */
export const egLordEmber = (key, pt, band) => emberColor({ aspect: { id: EG_FALL_ASPECT[egLordEl(key, pt) ?? ''] ?? EG_BANDS[band]?.aspect ?? null } });
/** Its death cry: the gate's (BOSS_CUES `fall` - the Warden's own bark, low) in the lord's own voice. Pure.
 *  @param {number} mobile */
export const egFallCry = (mobile) => ({ ...BOSS_CUES.fall, clip: ENEMY_BASICS[mobile]?.barkSound ?? BOSS_CUES.fall.clip });

/**
 * A breach fight's fallen lords: their beats, their bursts, their lights and the bodies they leave. scenes/eliteGates/egFight.js
 * hands it each fallen lord as it draws it (`see`), sweeps it once a frame of bodies (`sweep`), and draws its bursts in its
 * world pass (`draw`); its corpses go into the fight's `batches` and its lights into the fight's `lights` as they stand.
 * @param {{ renderer?: any, gl?: any, getTexture?: any, uploadRecordFrame?: any, now: () => number, play3?: (cue: any, at: number[]|null) => void,
 *   shake?: (k: number) => void, motion?: () => number, band?: () => number, batches: any[], lights: any[] }} deps
 */
export function createEgLordFall({ renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, now, play3 = () => {}, shake = () => {}, motion = () => 1, band = () => 0, batches, lights }) {
  /** Each fallen lord this screen holds, by its number: its fall's moment, its beats played, its place, its corpse. */
  const lords = new Map();
  /** The corpses' pictures by archive - asked once each (a promise on its way, `{ tex }`, or `{ failed }`). */
  const textures = new Map();
  /** The bursts, slots reused (the gate's addBurst), and those standing this frame. */
  const bursts = [], live = [];
  let frameNo = 0;
  const fxDoor = compiledPass(gl, GATE_FX_PROGRAMS, () => new GateFxRenderer(gl), (e) => console.warn('[eg] a lord\'s fall would not build', e?.message ?? e));

  function corpseTexture(archive) {
    const had = textures.get(archive);
    if (had && !(had instanceof Promise)) return had.failed ? null : had.tex;
    if (!had && getTexture) textures.set(archive, Promise.resolve().then(() => getTexture(archive)).then((tex) => { textures.set(archive, tex ? { tex } : { failed: true }); }, () => { textures.set(archive, { failed: true }); }));
    return null;
  }
  function putAway(L) {
    if (L.corpse) { renderer?.destroyBillboardBatch?.(L.corpse); L.corpse = null; }
  }
  /** A burst from `at0` (the fight's clock) at `p`, its sparks resting on `floor` - the oldest slot given up past FX_BURSTS_MAX. */
  function addBurst(p, at0, kind, color, floor) {
    let b = bursts.length < FX_BURSTS_MAX ? null : bursts.reduce((o, q) => (q.at0 < o.at0 ? q : o));
    if (!b) { b = { at: [0, 0, 0], at0: 0, t: -1, kind, color, floor: NaN }; bursts.push(b); }
    b.at[0] = p[0]; b.at[1] = p[1]; b.at[2] = p[2]; b.at0 = at0; b.kind = kind; b.color = color; b.floor = floor;
  }
  /** The fallen lord's body left where it fell, once its pictures stand: its mobile's own corpse, grown as the lord is. */
  function lay(L, mobile) {
    const ct = ENEMY_BASICS[mobile]?.corpseTexture;
    if (L.corpse || !ct || !renderer?.createBillboardBatch) return;
    const tex = corpseTexture(ct.archive);
    if (!tex) return;
    const sz = billboardSize(tex, ct.record), k = egCorpseScale(L.drawn), w = (sz?.w ?? 1.6) * k, h = (sz?.h ?? 0.6) * k;
    const rkey = `${ct.record}#0`;
    if (!renderer.textures?.has?.(`${ct.archive}_${rkey}`)) uploadRecordFrame?.(ct.archive, ct.record, 0);
    const c = renderer.createBillboardBatch(ct.archive, rkey, { w, h }, [[0, 0, 0]]);
    if (!c) return;
    c.origin = [L.feet[0], L.feet[1], L.feet[2]]; c.record = rkey; c.size = { w, h };
    if (L.drawn > 1) c.noShadow = true;   // EG-LOOK (OW-BIG's law): a grown figure casts no giant's shadow
    L.corpse = c;
  }

  return {
    /** Fallen lord `b` (its look `look`, the hall's centre `centre`) at `t`: its beats while they are news, its glow, its
     *  flash and its corpse. A Twin raised and felled again falls again. */
    see(b, t, look, centre) {
      if (!centre || !(b?.fellAt > 0)) return;
      const since = t - b.fellAt;
      if (since < 0) return;
      let L = lords.get(b.i);
      if (L && L.at !== b.fellAt) { putAway(L); L = null; }
      if (!L) {
        const [x, z] = egBodyPlace(b, b.fellAt);
        L = { at: b.fellAt, feet: [centre[0] + x, centre[1] + egBodyHeight(b, b.fellAt), centre[2] + z], drawn: look.drawn, tall: egFallTallM(look.drawn), ember: egLordEmber(EG_BOSS_KEYS[b.k] ?? '', b.pt | 0, band()),
          thud: false, column: 0, flashAt: -Infinity, corpse: null, frame: 0, glow: { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0], carried: true }, flash: { x: 0, y: 0, z: 0, range: 0, color: [0, 0, 0], carried: true } };
        lords.set(b.i, L);
        if (since < FALL_CRY_LATE_MS) {   // THE KILL, while it is news
          const F = L.feet, chest = [F[0], F[1] + L.tall * EG_FALL_BURST_UP, F[2]];
          play3(egFallCry(look.mobile), chest);
          addBurst(chest, L.at, FX_KINDS.dagon, L.ember, F[1]);
          L.flashAt = L.at;
          const m = motion();
          if (m > 0) shake(FALL_SHAKE * m);
        }
      }
      L.frame = frameNo;
      const F = L.feet;
      // THE THUD: its body meeting the floor, and the column of embers off it - each once, and only while news
      if (!L.thud && since >= THUD_AT_MS) { L.thud = true; if (since < THUD_AT_MS + EG_FALL_NEWS_MS) play3(BOSS_CUES.thud, [F[0], F[1] + 1, F[2]]); }
      for (; L.column < COLUMN_BURSTS && since >= THUD_AT_MS + L.column * COLUMN_STEP_MS; L.column++) {
        const at0 = L.at + THUD_AT_MS + L.column * COLUMN_STEP_MS;
        if (t < at0 + EG_FALL_NEWS_MS) addBurst([F[0], F[1] + 0.1, F[2]], at0, FX_KINDS.embers, L.ember, F[1]);
      }
      // its ember's glow dying over the fall, the hall's flash at the kill
      if (since < FALL_MS) {
        const g = L.glow, k = EG_FALL_GLOW * (1 - since / FALL_MS);
        g.x = F[0]; g.y = F[1] + L.tall * EG_FALL_GLOW_UP; g.z = F[2]; g.range = GLOW_RANGE.landing;
        g.color[0] = L.ember[0] * k; g.color[1] = L.ember[1] * k; g.color[2] = L.ember[2] * k;
        lights.push(g);
      }
      if (t >= L.flashAt && t - L.flashAt < FALL_FLASH_MS) {
        const f = L.flash, k = EG_FALL_FLASH.k * (1 - (t - L.flashAt) / FALL_FLASH_MS);
        f.x = F[0]; f.y = F[1] + EG_FALL_FLASH_Y; f.z = F[2]; f.range = EG_FALL_FLASH.range;
        f.color[0] = WHITE[0] * k; f.color[1] = WHITE[1] * k; f.color[2] = WHITE[2] * k;
        lights.push(f);
      }
      // ITS BODY LEFT where it fell, once it has sunk
      if (since >= FALL_MS) { lay(L, look.mobile); if (L.corpse) batches.push(L.corpse); }
    },
    /** Once a frame, after the bodies: a lord no longer fallen here (raised, gone from the fight) has its body put away. */
    sweep() {
      for (const [i, L] of lords) if (L.frame !== frameNo) { putAway(L); lords.delete(i); }
      frameNo++;
    },
    /** The bursts standing at `t` (the fight's clock), as the spark pass takes them. */
    bursts(t = now()) {
      live.length = 0;
      for (const b of bursts) { b.t = (t - b.at0) / 1000; if (b.t >= 0 && b.t < FX_BURST_MS / 1000) live.push(b); }
      return live;
    },
    /** The bursts drawn with the gate's spark pass - built the frame one must be seen. Answers whether any drew. */
    draw(proj, view, eye, seconds, fog = null) {
      if (!this.bursts().length) return false;
      const pass = fxDoor(true);
      if (!pass) return false;
      pass.draw(live, null, proj, view, eye, seconds, fog);
      return pass.bursts > 0;
    },
    /** What it holds (tests): each fallen lord's beats and whether its body lies there. */
    state: () => [...lords].map(([i, L]) => ({ i, at: L.at, thud: L.thud, column: L.column, flashAt: L.flashAt, corpse: !!L.corpse, feet: [...L.feet] })),
    /** A new hall, or out of the breach: every body put away, every burst forgotten. */
    leave() {
      for (const L of lords.values()) putAway(L);
      lords.clear(); bursts.length = 0; live.length = 0;
    },
  };
}
