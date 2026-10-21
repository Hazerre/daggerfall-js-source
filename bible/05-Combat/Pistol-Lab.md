# The pistol lab - a dwarven flintlock pistol, one in either hand, prototyped before it exists

`pistol-proto.html` + `src/tools/pistolLab.js` + `tools/pistolProtoProbe.mjs` + `vite.config.pistol.js`
(PISTOL-LAB, 2026-10-21)

The owner, handing over six frames: *"So this spritesheet is to be for our new weapon type, which can also be duel
wielded. Its a dwarven flintlock style pistol. We need to use the same prototype testing we did for the thunderlock to
ensure we get this right"*.

The Thunderlock's prototype testing is `Gun-Lab.md`: a page of its own where a new weapon type is judged on the classic
surface, at a real window size, with a real cadence, with a Chromium probe that pins what the page claims, before a line
of the game changes. This is that method for the second gun. DFU has no gun and no dual wielding (`Two-Hands.md`, "What
DFU does"), so all of this is our own (SCOPE1); it reads DFU's placement law first and names each departure below.

## What it is, and what it is not

**Nothing here touches the game.** No module the game runs imports `src/tools/pistolLab.js`, and
`test/combat/weapon/pistolLab.test.js` fails if `weaponRig.js`, `fpsWeapon.js`, the Weapon Widget, the gun's viewmodel, the
Two-Hands law or `thunderlock.js` ever does. There is no item, no template, no skill and no damage. The lab answers the
question a source sweep cannot: what does a pair of these FEEL like?

## What it runs rather than restates

The gun lab's hardest lesson (FIELD-GUN12, `Gun-Lab.md` "It graduated"): two copies of a frame do not converge by being
corrected. So the pistol lab writes no placement, motion or feel of its own. It imports them, and the pins hold that by
identity, not by value:

- **The game's gun frame**, `combat/gun/gunViewmodel.js` `gunFrameRect`: FPSWeapon's 320x200 rect (FPSWeapon.cs:378-388)
  over the anchor box, Weapon Widget's Offset, Bob and Inertia over that, the kick after the mod's floor, and the union
  expansion. The page never calls `placeSprite`, `widgetTransformRect` or `unionDrawRect` itself (AUDIT 68 S08's law,
  pinned for this page too).
- **The gun's feel**, `combat/gun/gunFeel.js`: the recoil spring, the trauma screenshake (which moves the camera and not the
  weapons), and the muzzle light's curve.
- **The gun lab's machine and sound player** (`src/tools/gunLab.js`): Idle, then six frames, then the reload, then Idle;
  a hit frame; a one-shot that cannot be interrupted. The same CC0 clips, baked to DAGGER.SND's 11025 Hz 8-bit mono.
- **The Two-Hands law** for the pair (`combat/twoHands/handsLaw.js`): which hand fires (`strikeHandOf`, the flurry the
  dual wielder's swords obey), the resting hand's guard (`guardStep`, `guardOffset`), and the mirror (a left hand is a
  right hand in the glass).

## The art: a strip, not a sheet

`public/art/pistol-frames.png` is the owner's six 88x113 frames laid side by side in the order they were given, with their
pixels unchanged (528x113). Unlike the Thunderlock's art, which was a contact sheet on a white page, these frames arrive
on transparent canvases that **register them to each other**: the forearm leaves every frame through the same
bottom-right corner, and the pistol moves inside the canvas because the art moves it. So the strip is cut at a fixed
stride. There is no background key, no badge gutter and no flood fill.

| Frame | What it is |
|---|---|
| 1 | rest - the anchor (82x101 at 6,12 after the cut) |
| 2 | the shot: the flash, the pistol kicked back |
| 3 | settling |
| 4, 5 | muzzle up - one picture twice, a hold |
| 6 | settling (the same picture as 3) |

The union of the six (88x104 at 0,9) and the anchor share the arm's corner. The flash overflows up and to the left, and
the cut stays on the view's edge. The probe measures the drawn rect on every frame of a slowed live shot and fails on
any drift. It measured 0px.

**The 1-bit cut** (`hardenAlpha`). The frames carry soft alpha: an antialiased fringe and the flash's glow, 870 to 1,200
texels a frame. The port's screen quad discards texels under 0.5 (`drawScreenQuad`), so the lab cuts at 128 by default
and keeps the threshold as a live slider. At 0.5 the flash's core survives and its halo does not, which is what the game
would draw. The slider exists so that cost can be judged rather than assumed. The file keeps the art's own alpha; the
cut is made on load.

**Native size.** The Thunderlock's art was a 1790px painting and took its size from a slider (`widthPct`, the gun lab's
one declared departure from the CIF law). These frames are drawn at Daggerfall's own scale, a WEAPON*.CIF record's size.
So the classic law applies whole: at `size x native` 1, one art pixel is one pixel of the 320-wide design surface
(`nativeWidthPct`). The slider remains, as a multiple of native.

**No ARENA2 pixel in it.** The arm is a brown glove and a grey sleeve, and classic WEAPON10.CIF paints arms too
(`Two-Hands.md`, "The painted arm"), so before the doctrine row was written the art was checked against Daggerfall's own
weapon sprites (the freeware data, `tools/fetch-data.sh`). Every 6x6 fully opaque patch of frame 1 (45 patches) was
searched as exact RGB through ART_PAL.COL against every frame of WEAPON00-11.CIF (348 frames), both as drawn and mirrored.
There were no matches. Frame 1 also holds 1,180 distinct colours, which a 256-colour indexed record cannot. The row in
`test/tooling/doctrine.test.js` says it is ours.

## The pair

The page opens on two pistols. The left pistol is drawn through the same `gunFrameRect` with `flip`, which is
FPSWeapon's own AlignRight-to-AlignLeft swap (FPSWeapon.cs:459-464). It lands as the right pistol's exact mirror: the
right pistol's cut is on the view's bottom-right corner and the left pistol's on the bottom-left. At native size on a
16:10 window the two stand 576px apart, with no overlap.

**One rig per hand, on one clock.** The left rig runs flipped. That gives Two-Hands' two sway rules without any code of
the lab's own. Bob goes **outward**: the mod's flipped sprite takes it mirrored, and the probe measured the left pistol's
walking sway as the right pistol's mirror to 0.00px. Inertia **keeps the screen's direction**, because `inertiaStep`
pre-signs it for a flip.

**The trigger** - four ways, a select on the panel and keys 1-4:

| Trigger | A pull fires |
|---|---|
| alternate (opens on it) | the game's flurry, `strikeHandOf`: the lead opens; a pull while the last shot is in flight, or within `FLURRY_WINDOW` (0.75 s) of its end, is the other hand's |
| volley | both, on one pull |
| per hand | the left mouse button fires the right pistol; the right button fires the left |
| single | one pistol, DFU's one used hand (the gun lab's own case; a left lead is the handedness mirror) |

**Alternate's one departure, which belongs to the gun.** A sword can always swing; a pistol mid-reload cannot fire. When
the hand the law names is reloading and the other hand is loaded, the pull falls to the loaded pistol, so the trigger
never clicks on an empty pistol while a loaded one is in hand. This is pinned (`pistolLab.test.js`, "alternate's one
departure"), so it is a decision and not an accident. A held trigger pulls whenever no shot is in flight, so a pair on
auto takes turns a shot's frames apart.

**The guard** (`GUARD.LOWER`): while one pistol fires and the other does not, the resting pistol lowers 0.12 of its own
drawn height, straight down so its cut stays on the view's edge, and eases back. This is Two-Hands' rule for a resting
weapon. It never applies in a volley, where both hands are the striking hand. The first cut lowered both pistols in a
volley, each because the other was firing; the probe's shake check found it (both weapons moved 48px with the kick off),
and it has its own check now. The hand that fired last is drawn over the other.

**One camera.** Every shot punches the shake's trauma, so a volley is two punches. Trauma is capped at 1 and squared,
which is why the opening shake is two thirds of the Thunderlock's.

**Each hand reloads on its own.** The reload lowers that hand on the Offset module's easing, with its own two sound ends.
Carrying a pair is a way of covering one pistol's reload with the other.

## The opening numbers - a first pass, for the owner's hand

`PISTOL_OPENING`, one frozen row that the page, the probe and the pins all read. The Thunderlock's panel opened on a first
pass too, and Mac moved it. These are not decisions:

| | Value | Why it opens there |
|---|---|---|
| size, raise, offset | 1x native, 0, 0 | the arm's cut on the corner, where the art put it (the Thunderlock sank 8 units because its painting had no arm to hide) |
| fire fps, hit frame, reload | 12, frame 2 (the flash), 1400 ms | a pistol cycles faster than a rifle, and a pair covers each other's reloads |
| kick | 3 (the Thunderlock: 5) | the art already kicks (frames 2 and 4-5), so the spring is the after-shock |
| shake | 20 / roll 2.5 / decay 5 (the Thunderlock: 30 / 4 / 5) | a volley lands two punches |
| reload drop | 0.7 of the sprite's height | deeper than the Thunderlock's 0.55, a guess for a shorter sprite; the probe measured it at 283px down on an 800px window |
| sound | `fire-musket` (black powder), the Thunderlock's reload pair | the closest of the gun lab's clips to a flintlock |

## Running it, and its own deploy

    npx vite                # then open /pistol-proto.html
    npm run pistolproto     # the probe: boots vite, drives Chromium, writes the six
                            # frames, the pair at rest, the guard, the volley, the reload
                            # and the walk to scratch/pistol-proto/

`vite.config.pistol.js` builds the lab and nothing else into `dist-pistol/`, with a relative base. `deploy.yml` mounts it
at **`/preview/pistol-lab/`**, beside the gun lab, built from the production checkout (AUDIT-THUNDERLOCK F6: never from a
feature branch by name). The house build registers the page too (`vite.config.js` `pistolProto`; AUDIT 68 X2 fails a
root page that is not an input).

**The probe, 23 checks, all passing at the commit that added it**: the strip cuts to six frames and to 1 bit; the flash
has room and shares the arm's corner; the pair is drawn; native size; the cut is on the corner; the left is the mirror and
does not overlap; six frames with zero drift; single is one pistol; the flurry; the guard lowers and returns; the volley
fires both and guards neither; per hand; the reload lowers and returns; Bob goes outward; the shake moves the room and
neither weapon; no page errors.

## What graduation will need - not built here

When the pistol becomes a weapon, the Thunderlock's own record (`Dwarven-Thunderlock.md`) is the checklist: templates,
skill, damage, ammunition, all four hosts, icons and the paperdoll. Three things are this weapon's own:

- **The pair is a departure from Two-Hands.** `handsLaw.js` `DUAL_TYPES` deliberately excludes "the port's own gun", so a
  pistol pair needs a row there, a balance row beside `DUAL`'s (the off hand's damage, its to-hit, its burden), and a
  Port-Ledger A entry.
- **Pellets.** Two pistols spend from one pouch, so the out-of-ammo guard (AUDIT-THUNDERLOCK F5) has to answer per hand.
- **A pistol's own sounds.** The lab offers the Thunderlock's clips. A flintlock's pan flash, and a ramrod for its reload,
  are a search the lab has not yet run (`tools/freesoundPick.mjs`).
- **The flash may be clipped at the canvas edge.** On frame 2 the flame reaches column 0 of its 88px canvas. If it was
  painted longer than that, the art needs a wider canvas. The lab draws what the file holds.
