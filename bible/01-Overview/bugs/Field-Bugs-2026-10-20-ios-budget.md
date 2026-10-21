# Field bugs 2026-10-20: IOS-BUDGET - an iPhone's tab killed at 2 GB right after Play

GitHub issue #1040 (willdelion, 2026-10-19), an iPhone 17 Pro Max on iOS 27.0.1, the game opened from the Home Screen:
a white screen right after Play, then the home screen, at every setting. The reporter read the device log rather than
the console, and it is not a JavaScript error: the WebContent process stood at about 100 MB at Play, about 1492 MB
twenty-five seconds later, and the kernel killed it five seconds after that for passing `ActiveHard 2048 MB (fatal)`.
Every browser on iOS is WebKit and every one of them shares that cap; the player cannot raise it.

The reporter's own diagnosis pointed at `bundleBudgetBytes` and said out loud that it was not instrumented. It is read
here on the code, and it holds.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | #1040: the tab grows past 2 GB within thirty seconds of Play | DFMOD3's bundle budget scales with `navigator.deviceMemory` and read "no report" as an 8 GB machine. WebKit never reports it, so every iPhone and iPad took the 8 GB arm: 1536 MB for the texture mods' decoded pictures alone, on a tab that dies at 2048 | fixed (IOS-BUDGET) |

## IOS-BUDGET: the budget asks the device when the browser says nothing

`src/systems/textureReplacement.js` (`bundleBudgetGb`, `bundleBudgetBytes`, `IOS_TAB_GB`), reading
`src/ui/touch/touchDevice.js` (`isTouchDevice`, TI3's one home of "is this page pointed at by a finger").

**The cause.** DFMOD3 (2026-09-29) gave the bundle tier a memory budget so an HD mod set's thousands of decoded pictures
could not take the tab down, and DFMOD3b doubled it to 192 MB a GB up to 1536 MB, on the reading that
`navigator.deviceMemory` is capped at 8 by the browser and most players are past 8 GB. Both took the number as given
and fell to 8 when it was missing - `|| 8`. The number is missing on every WebKit browser, desktop and mobile, and on
Firefox. On a Mac that is the right answer. On an iPhone it is the one wrong answer: iOS gives a tab's WebContent
process about 2 GB and kills it past that, so a budget of 1536 MB left some 500 MB for the engine, ARENA2 in IndexedDB,
the WebGL context and the page, and the shipped texture packs (Vanilla Enhanced and its add-ons are worn by default,
VE4) spent it inside half a minute.

**The fix.** `bundleBudgetGb` answers the browser's report when there is one. When there is none it asks the device:
a finger-pointed page (`isTouchDevice`) is read as `IOS_TAB_GB`, 2 - the ceiling iOS gives a tab - and the same
192 MB a GB makes 384 MB (systems/textureReplacement.js:"export const IOS_TAB_GB = 2;"). A mouse-pointed page with no
report keeps the 8 GB reading and its 1536 MB. Android Chrome reports `deviceMemory`, so a phone that says 4 is scaled
as before, 768 MB, and the report wins over the device reading either way. `bundleBudgetBytes` keeps its callers:
both take the navigator and the window as arguments so the law is pinned without a window stub, and the call sites
pass nothing.

**Not done, and said so.** The budget was not instrumented on the device, by the reporter or here; a 1536 MB budget
on a 2 GB tab is a cause, and the log's growth curve fits it, but it is not proven the only one - the engine's own
textures and the data in IndexedDB are the other candidates the DFMOD3 log named. The reporter's second and third
suggestions - a ceiling for the whole tab, and `Enhancements/AssetInjection` off by default on iOS - are product
choices for Mac and are not taken here. If the kill stands after this, the next read is the WebContent footprint
with the texture packs off (Classic on the Texture Overhaul card), which splits the budget from the rest.

**Pinned.** `test/systems/dfmod1.test.js` +1 (IOS-BUDGET: no report and a finger is 2 GB and 384 MB; no report and a
mouse, or no window, stays 1536 MB; a report of 4 on a phone is 768 MB; a zero report is no report; 16 is still capped
at 1536), and DFMOD3's own pin re-aimed in its last assertion to say which browser keeps the full 1536 MB.
`tools/mutants/ios_budget.json` +4 (the no-report arm back to 8; the tab read as 4 GB; a report ignored on a phone; a
zero report taken as one), 4/4 dead.

**Verified.** The test file, the mutants, lint, types and the bible's gates, here. Not an iPhone: nobody on this
branch had one, and the fix is a number read off the device log, not a frame seen.
