// Which of the game window's navigations may switch it onto a version of the game readied while it ran
// (app/main.cjs playReadyGame).
//
// The switch has to happen as the navigation starts, before the new document's files are requested. But Electron
// raises did-start-navigation BEFORE will-navigate, so a navigation the window's fence then cancels has started all the
// same. The fence lets only the game's own pages through; any other navigation never commits, and switching for it
// would leave the old page running on files no longer served, with a trial counted that no boot will ever end.
//
// Pure, no Electron: test/tooling/da13_gamechannel.test.js calls it.
'use strict';

/** The only pages the game window's fence lets it navigate to. */
const GAME_PAGES = 'dagger://game/';

/**
 * Does this did-start-navigation event load a new document of the game's own?
 * @param {{ isMainFrame?: boolean, isSameDocument?: boolean, url?: string } | null | undefined} navigation
 * @returns {boolean}
 */
function switchesReadyGame(navigation) {
  if (!navigation?.isMainFrame) return false;
  if (navigation.isSameDocument) return false;
  return typeof navigation.url === 'string' && navigation.url.startsWith(GAME_PAGES);
}

module.exports = { GAME_PAGES, switchesReadyGame };
