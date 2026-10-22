// @ts-check
// FIELD BUGS 2026-10-21d REGARD-OWN, its other half (lumin: "Better feedback and controls on finding a spouse"): THE
// MOMENT A RESIDENT BECOMES A FRIEND IS SAID. A friend (relations.js FRIEND_AT) is where a courtship begins
// (legacy/marriage.js topicsFor), and nothing marked it: the Courtship row appeared under Tell me about the next time the
// list was read, and a player in the classic skin - no regard badge - had no way to know it had happened, nor what had
// made it. The word, or its tone, that carries a resident's regard into friendship says so on the HUD, and where the
// house can court them, where to ask.
import { t } from '../textManager.js';

const FRIEND_TEXT = '{name} counts you a friend now.';
const FRIEND_COURT_TEXT = '{name} counts you a friend now. You can court them: ask about Courtship under Tell me about.';

/**
 * The line for a regard that a word or its tone moved, or null when it did not make a friend.
 * @param {{ standing?: string } | null} before - the regard badge before the word (people.js regardBadge)
 * @param {{ standing?: string } | null} after - and after it
 * @param {{ name: string, court: boolean }} who - their name, and whether the Courtship row is theirs now
 */
export function friendWord(before, after, { name, court }) {
  if (!after || after.standing !== 'friend' || before?.standing === 'friend') return null;
  return court ? t('livingWorld.friend.court', FRIEND_COURT_TEXT, { name }) : t('livingWorld.friend.made', FRIEND_TEXT, { name });
}
