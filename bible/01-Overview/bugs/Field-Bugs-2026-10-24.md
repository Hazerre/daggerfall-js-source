# FIELD BUGS 2026-10-24 - four Discord threads

Four threads from the Discord, handed over by the owner as phone screenshots: one from #feature-feedback, three from
#bug-reports. Read on main's `f58525b0a`. The pins are named under each fix, the mutants `tools/mutants/fb1024.json`.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | #bug-reports, "Potential Bug: Regens Health: In Darkness": "`src/scenes/hostEnchant.js` defines inSunlight and inHolyPlace in createEnchantCtx(), but apparently never provides inDarkness ... the enchantment may never activate, even at night or inside dungeons" | Proven as written. RegensHealth's InDarkness arm asks `ctx.inDarkness`, and the one enchant ctx every host mounts never carried it, so the arm read `false` everywhere. The E1 pin fed the arm a hand-built ctx | DARK-REGEN |

## DARK-REGEN (1) - `src/scenes/hostEnchant.js`, `src/systems/passiveSpecials.js`

DFU: RegensHealth.cs:97-98 regenerates on `Params.InDarkness` (2) when `PlayerEnterExit.IsPlayerInDarkness`, which is
`!isPlayerInSunlight` (PlayerEnterExit.cs:201, "Same as !IsPlayerInSunlight"). No departure, no Ledger row owed.

THE CHANGE. `playerInDarkness` (`passiveSpecials.js:"export const playerInDarkness = (nowMinutes = null) =>"`) is
`!playerInSunlight` over the same host seam, and the shared ctx answers it
(`hostEnchant.js:"inDarkness: () => playerInDarkness(),"`). The enchantment's darkness is DFU's: a roof at noon is
dark. The career's Regenerate Health: In Darkness keeps its own law (`!day || dungeon`, PassiveSpecialsEffect.cs), as
DFU has the two. Both heal, so a class with the advantage and a ring stack, as the report expected.

THE FOUR HOSTS: the ctx is `createEnchantCtx`'s, which `world.js` (and through it `worldModes.js`'s interiors),
`exterior.js` and the standalone `dungeonContext.js` all mount; the seam it reads is registered by each.

PINS: `test/systems/fb1024_darkregen.test.js` builds the ctx from the producer (TEST THE SHAPE THE PRODUCER MINTS) and
runs the real ring through the round pump - at midnight, under a roof at noon, and on the noon street.
