// @ts-check
// COLLECTIONS-II (2026-10-22, the owner: "with the introduction of a lot of titles, auras, profile icons, etc I think its
// time we introduce these elements to the collections tab, along with telling how they are found, even if they arent
// currently able to be obtained"; bible/10-UI/Collections.md): THE WARDROBE CATALOGUE - every thing an account's
// wardrobe can hold (the account card's word for them: ui/enhanced/enhancedAccount.js wardrobe), held or not: each
// title, aura, profile icon and glyph of the vocabulary both ends share (net/identityToken.js TITLES, AURAS, ICONS,
// GLYPHS), with where it comes from, whether it can be had now, and how.
//
// THE SERVICE DECIDES WHAT IS HELD (server-account/src/titles.js titlesHeld, aurasHeld, iconsHeld, glyphsOf); this is the
// same law said to a player. Where a number of the law is the client's too, it is read here (the Broker's and the Wyrd
// Sister's prices, the Hearth Offerings' counts, the festival's dates, a questline's giver and level); where it is the
// service's alone (a roll's odds, the Redoubts an honour asks), it is written here and test/ui/collections2.test.js
// holds it to the service's own table, so the two cannot drift apart unnoticed.
//
// Pure but for the text core: no DOM. Not a DFU member - Daggerfall Unity has no accounts. Ledger A (COLLECTIONS-II).
import { t, intlLocale } from '../../systems/textManager.js';
import { TITLES, AURAS, ICONS, GLYPHS } from '../../net/identityToken.js';
import { TITLE_TEXT, AURA_TEXT } from '../playerBadge.js';
import { ICON_TEXT } from '../profileIcons.js';
import { GLYPH_LABEL } from '../enhanced/enhancedAccount.js';
import { insigniaById } from '../../net/insignia.js';
import { wareById, festivalAt, HEARTHKEEPER_GIVEN, SOULCAKE_TAKEN } from '../../net/festivalLaw.js';
import { QL_LINES } from '../../systems/questlines/qlLines.js';
import { QL_SERVICE_LINES } from '../../net/questlineClaims.js';

/** The four kinds, in the Collections page's order, and the wardrobe's list that holds each (accountFlow.js wardrobe). */
export const WARDROBE_KINDS = Object.freeze(['title', 'aura', 'icon', 'glyph']);
const HELD_LIST = Object.freeze({ title: 'titles', aura: 'auras', icon: 'icons', glyph: 'glyphs' });
const VOCABULARY = Object.freeze({ title: TITLES, aura: AURAS, icon: ICONS, glyph: GLYPHS });

/** `[id, its words]`, frozen - a list's row (a source here, a filter, a part). */
export const wordPair = (/** @type {string} */ id, /** @type {() => string} */ words) => /** @type {readonly [string, () => string]} */ (Object.freeze([id, words]));
/** WHERE A THING COMES FROM, in the order the page lists them: what play earns first, what no play can earn last. */
export const WARDROBE_SOURCES = Object.freeze([
  wordPair('spire', () => t('coll.src.spire', 'The Elite Breach')),
  wordPair('abyss', () => t('coll.src.abyss', 'The Abyss Dungeons')),
  wordPair('serpent', () => t('coll.src.serpent', 'The Sea Serpent')),
  wordPair('broker', () => t('coll.src.broker', 'The Sigil Broker')),
  wordPair('questlines', () => t('coll.src.questlines', 'Questlines')),
  wordPair('festival', () => t('coll.src.festival', 'The Witches’ Festival')),
  wordPair('seats', () => t('coll.src.seats', 'The Seats')),
  wordPair('chapters', () => t('coll.src.chapters', 'The Guild Chapters')),
  wordPair('ranked', () => t('coll.src.ranked', 'The Arena and the Card Tables')),
  wordPair('world', () => t('coll.src.world', 'Around the Bay')),
  wordPair('account', () => t('coll.src.account', 'Your Account')),
  wordPair('patrons', () => t('coll.src.patrons', 'Patrons')),
  wordPair('staff', () => t('coll.src.staff', 'The Game’s Staff')),
  wordPair('bestowed', () => t('coll.src.bestowed', 'Bestowed by Name')),
]);
const SOURCE_IDS = WARDROBE_SOURCES.map(([id]) => id);
/** A source's name, as a player reads it. */
export const sourceName = (/** @type {string} */ id) => WARDROBE_SOURCES.find(([s]) => s === id)?.[1]() ?? id;

/**
 * WHETHER IT CAN BE HAD, as the catalogue states it - `seasonal` is resolved against the festival's dates when read
 * (wardrobeAvail): 'seasonal' while one is open, 'offseason' while none is.
 *   open      play earns it now          chance    a roll on a deed, earned by trying
 *   ranked    held while on top of a board, and passed on
 *   seasonal  the Witches' Festival's     patron    a Patreon pledge's, held while it stands
 *   dormant   in the vocabulary, given out by nothing yet
 *   staff     the game's own people      bestowed  made for one player, granted by name
 *   retired   given once and closed (the founders' date, a first company's name)
 */
export const WARDROBE_AVAIL = Object.freeze(['open', 'chance', 'ranked', 'seasonal', 'offseason', 'patron', 'dormant', 'staff', 'bestowed', 'retired']);
/** The availabilities a player can act on now - the page's "Obtainable" filter. */
export const AVAIL_NOW = Object.freeze(['open', 'chance', 'ranked', 'seasonal', 'patron']);
/** Each availability's tag (a chip on the row), as a player reads it. */
export const AVAIL_TAG = Object.freeze({
  open: () => t('coll.avail.open', 'Obtainable'),
  chance: () => t('coll.avail.chance', 'Rare drop'),
  ranked: () => t('coll.avail.ranked', 'Ranked'),
  seasonal: () => t('coll.avail.seasonal', 'Seasonal'),
  offseason: () => t('coll.avail.offseason', 'Out of season'),
  patron: () => t('coll.avail.patron', 'Patron reward'),
  dormant: () => t('coll.avail.dormant', 'Not yet available'),
  staff: () => t('coll.avail.staff', 'Staff only'),
  bestowed: () => t('coll.avail.bestowed', 'Bestowed'),
  retired: () => t('coll.avail.retired', 'No longer obtainable'),
});
/** Each availability in a sentence (the row opened whole). `date` the open festival's last day, in words. */
export const AVAIL_LINE = Object.freeze({
  open: () => t('coll.availLine.open', 'You can earn it now.'),
  chance: () => t('coll.availLine.chance', 'You can earn it now, by chance - it may take many tries.'),
  ranked: () => t('coll.availLine.ranked', 'Held only while you stay on top. It passes to whoever takes your place.'),
  seasonal: (/** @type {string} */ date) => t('coll.availLine.seasonal', 'Only during the Witches’ Festival - on now, until {date}.', { date }),
  offseason: () => t('coll.availLine.offseason', 'Only during the Witches’ Festival, which is not on now.'),
  patron: () => t('coll.availLine.patron', 'Held while your pledge stands.'),
  dormant: () => t('coll.availLine.dormant', 'Not open to players yet.'),
  staff: () => t('coll.availLine.staff', 'Held by the game’s staff alone.'),
  bestowed: () => t('coll.availLine.bestowed', 'It cannot be earned.'),
  retired: () => t('coll.availLine.retired', 'It can no longer be obtained. Those who hold it keep it.'),
});

// ── the numbers the service keeps to itself (the pin holds each to its table) ─────────────────────────────────────────
/** The Brass Remnant's rolls (server-account/src/sds.js SD_TITLE_CHANCE, SD_AURA_CHANCE): one kill in four, in eight. */
export const REMNANT_ODDS = Object.freeze({ hourbreaker: 4, turninghour: 8 });
/** The Sea Serpent's (server-account/src/serpents.js SERPENT_TITLE_CHANCE, SERPENT_AURA_CHANCE): one in twenty, fifty. */
export const SERPENT_ODDS = Object.freeze({ coilbreaker: 20, maelstrom: 50 });
/** The Redoubt an Elite Breach honour asks (server-account/src/egHonours.js EG_REDOUBT_HONOURS, EG_UNFALLEN_REDOUBT). */
export const REDOUBT_OF = Object.freeze({ spirewalker: 2, beaconlighter: 5, kynbane: 10, unfallen: 10, battlemage: 15, wellheadwalker: 20, beaconlight: 10, burningstair: 20 });
/** A Descent bracket's companies that hold Spire Champion (egHonours.js EG_CHAMPIONS_TOP). */
export const SPIRE_CHAMPIONS_TOP = 10;

// ── the words of how ──────────────────────────────────────────────────────────────────────────────────────────────────
const bestowed = () => t('coll.how.bestowed', 'Made for one player and granted to them by name.');
const patron = (/** @type {string} */ tier) => () => t('coll.how.patron', 'Support DFO Online on Patreon at the {tier} tier, then link Patreon from your profile.', { tier: TITLE_TEXT[/** @type {keyof typeof TITLE_TEXT} */ (tier)] });
/** Apostle: a Patreon tier's title no pledge maps yet (server-account/wrangler.toml PATREON_TIERS), held by name alone. */
const apostle = () => t('coll.how.apostle', 'A Patreon reward with no tier to pledge yet - for now it is granted by name.');
const developer = () => t('coll.how.developer', 'The game’s developers.');
const dungeonMaster = () => t('coll.how.dungeonmaster', 'The game’s Dungeon Master, who may speak to chat in orange with /dm.');
const broker = (/** @type {string} */ id) => () => t('coll.how.broker', 'Buy it from the Sigil Broker for {price} Deadlands Embers. Closing Dagon’s Breaches pays the embers.', { price: insigniaById(id)?.price ?? 0 });
const wyrd = (/** @type {string} */ id) => () => t('coll.how.wyrdSister', 'Buy it from a Wyrd Sister for {price} Soul Cakes during the Witches’ Festival.', { price: wareById(id)?.price ?? 0 });
const remnant = (/** @type {keyof typeof REMNANT_ODDS} */ k) => () => t('coll.how.remnant', 'A chance of one in {n} each time you help break the Brass Remnant in an Abyss Dungeon.', { n: REMNANT_ODDS[k] });
const serpent = (/** @type {keyof typeof SERPENT_ODDS} */ k) => () => t('coll.how.serpent', 'A chance of one in {n} for each ship that wounds a Sea Serpent when it is slain.', { n: SERPENT_ODDS[k] });
const redoubt = (/** @type {keyof typeof REDOUBT_OF} */ k) => () => t('coll.how.redoubt', 'Take Redoubt {n} or a deeper one in the Elite Breach (a Rehearsal does not count).', { n: REDOUBT_OF[k] });
const hoursFirst = () => t('coll.how.hoursfirst', 'Granted by name to the first company to break an Abyss Dungeon.');
const spireFirst = () => t('coll.how.spirefirst', 'Granted by name to the first company to take Redoubt 10.');
const arenaTop = () => t('coll.how.arenachampion', 'Stand first on the Arena’s ranked board this season.');
const crown = (/** @type {string} */ kingdom) => () => t('coll.how.crown', 'Belong to a guild that holds the crown seat of {kingdom}.', { kingdom });

/** THE QUESTLINE THAT PAYS A TITLE (net/questlineClaims.js QL_SERVICE_LINES), its line's own words (qlLines.js): its
 *  name, and who begins it from what level - or the line it follows. */
export const questlineOf = (/** @type {string} */ title) => {
  const id = Object.entries(QL_SERVICE_LINES).find(([, l]) => l.title === title)?.[0];
  return QL_LINES.find((l) => l.id === id) ?? null;
};
const questline = (/** @type {string} */ title) => () => {
  const l = questlineOf(title);
  if (!l) return '';
  const after = l.opens.after ? QL_LINES.find((x) => x.id === l.opens.after) : null;
  return after
    ? t('coll.how.questlineAfter', 'Finish the questline {line}, which follows {after}.', { line: l.title(), after: after.title() })
    : t('coll.how.questline', 'Finish the questline {line}, offered from level {level} by {giver}.', { line: l.title(), giver: l.giver(), level: l.opens.level ?? 1 });
};

/** @typedef {{ src: string, avail: string, how: () => string, look?: () => string, with?: ReadonlyArray<string>, via?: string }} WardrobeEntry */
/** One entry: `with` what comes beside it (`kind:key`, both ways); `via` the title whose holding it follows (High Master,
 *  only ever signed in a Chapter Master's place - never held, never worn, never counted on its own). */
const E = (/** @type {string} */ src, /** @type {string} */ avail, /** @type {() => string} */ how, extra = {}) => Object.freeze({ src, avail, how, ...extra, ...(extra.with ? { with: Object.freeze([...extra.with]) } : {}) });

/** @type {Readonly<Record<string, Readonly<Record<string, WardrobeEntry>>>>} */
export const WARDROBE = Object.freeze({
  title: Object.freeze({
    founder: E('account', 'retired', () => t('coll.how.founder', 'Every account that first played before 25 September 2026.')),
    developer: E('staff', 'staff', developer, { with: ['aura:seraphwings', 'glyph:dev'] }),
    dungeonmaster: E('staff', 'staff', dungeonMaster, { with: ['glyph:dm'] }),
    disciple: E('patrons', 'patron', patron('disciple'), { with: ['glyph:disciple'] }),
    apostle: E('patrons', 'dormant', apostle, { with: ['glyph:apostle'] }),
    hierophant: E('patrons', 'patron', patron('hierophant'), { with: ['glyph:hierophant'] }),
    shadowfang: E('bestowed', 'bestowed', bestowed, { with: ['aura:shadowcloak', 'glyph:shadowfang'] }),
    penitent: E('bestowed', 'bestowed', bestowed, { with: ['glyph:penitent'] }),
    gatebreaker: E('broker', 'open', broker('title:gatebreaker')),
    herald: E('patrons', 'patron', patron('herald'), { with: ['glyph:herald'] }),
    warden: E('seats', 'open', () => t('coll.how.warden', 'Lead a guild that holds a town’s palace seat. You wear it as “Warden of” the town.')),
    protector: E('seats', 'open', () => t('coll.how.protector', 'Lead a guild that holds a kingdom’s crown seat. You wear it as “Protector of” the kingdom.')),
    crowned: E('seats', 'open', () => t('coll.how.crowned', 'Lead a guild that holds a crown seat when a Season ends. Kept for good, with the Season’s number.')),
    keeper: E('seats', 'open', () => t('coll.how.keeper', 'Lead a guild that holds a seat for a whole Season. Kept for good as “Keeper of” the town.')),
    champion: E('seats', 'open', () => t('coll.how.champion', 'Win a kingdom’s Royal Tourney, the week-long duel ladder at its castle. Kept for good as “Champion of” the kingdom.')),
    grandchampion: E('ranked', 'open', () => t('coll.how.grandchampion', 'Beat the champion of the Arena’s tenth and highest tier.')),
    arenachampion: E('ranked', 'ranked', arenaTop, { with: ['glyph:laurel'] }),
    aegis: E('bestowed', 'bestowed', bestowed, { with: ['aura:oblivionward', 'glyph:aegis'] }),
    primarch: E('bestowed', 'bestowed', bestowed, { with: ['aura:radiance', 'glyph:primarch'] }),
    crystalfist: E('bestowed', 'bestowed', bestowed, { with: ['aura:resonance', 'glyph:crystalfist'] }),
    hourbreaker: E('abyss', 'chance', remnant('hourbreaker')),
    hoursfirst: E('abyss', 'retired', hoursFirst, { with: ['aura:firsthour'] }),
    iliacchampion: E('ranked', 'ranked', () => t('coll.how.iliacchampion', 'Stand first on Iliac Hand’s ranked board this season.')),
    // CHAP4c's titles: minted only while the service's CHAPTER_TITLES is on (server-account/wrangler.toml - off; the pin
    // reads the switch, so turning it on fails until these say so)
    chaptermaster: E('chapters', 'dormant', () => t('coll.how.chaptermaster', 'Hold the Master’s seat of a guild chapter.')),
    chapterofficer: E('chapters', 'dormant', () => t('coll.how.chapterofficer', 'Sit on a guild chapter’s council.')),
    formermaster: E('chapters', 'dormant', () => t('coll.how.formermaster', 'Lose a chapter’s Master seat. Held for the rest of that Season.')),
    highmaster: E('chapters', 'dormant', () => t('coll.how.highmaster', 'Shown in place of Chapter Master while your chapter stands Ascendant.'), { via: 'chaptermaster' }),
    seasonmaster: E('chapters', 'dormant', () => t('coll.how.seasonmaster', 'Hold a chapter’s Master seat for a whole Season. Kept for good.')),
    ilovelamp: E('world', 'open', () => t('coll.how.ilovelamp', 'Speak with a lamp keeper.')),
    grandmaster: E('ranked', 'ranked', () => t('coll.how.grandmaster', 'Stand first on The King’s Gambit’s ranked board this season.')),
    coilbreaker: E('serpent', 'chance', serpent('coilbreaker')),
    spirewalker: E('spire', 'open', redoubt('spirewalker')),
    beaconlighter: E('spire', 'open', redoubt('beaconlighter')),
    kynbane: E('spire', 'open', redoubt('kynbane'), { with: ['aura:beaconlight'] }),
    unfallen: E('spire', 'open', () => t('coll.how.unfallen', 'Take Redoubt {n} of the Elite Breach with no one falling, in a breach begun at Hall 1.', { n: REDOUBT_OF.unfallen })),
    lonebeacon: E('spire', 'open', () => t('coll.how.lonebeacon', 'Fell a Court alone while in a company of four or more in the Elite Breach.')),
    battlemage: E('spire', 'open', redoubt('battlemage')),
    wellheadwalker: E('spire', 'open', redoubt('wellheadwalker'), { with: ['aura:burningstair'] }),
    mastergallery: E('spire', 'open', () => t('coll.how.mastergallery', 'Win every feat against the lords of the Galleries in the Elite Breach.')),
    mastercairn: E('spire', 'open', () => t('coll.how.mastercairn', 'Win every feat against the lords of the Cairn in the Elite Breach.')),
    mastershade: E('spire', 'open', () => t('coll.how.mastershade', 'Win every feat against the lords of the Shade in the Elite Breach.')),
    masterwellhead: E('spire', 'open', () => t('coll.how.masterwellhead', 'Win every feat against the lords of the Wellhead in the Elite Breach.')),
    spirechampion: E('spire', 'ranked', () => t('coll.how.spirechampion', 'End a season in the top {n} of a Descent bracket on the Elite Breach’s boards. Held through the next season.', { n: SPIRE_CHAMPIONS_TOP })),
    spirefirst: E('spire', 'retired', spireFirst, { with: ['aura:firstlight'] }),
    wikimaid: E('bestowed', 'bestowed', bestowed, { with: ['aura:lilacwarren', 'glyph:wikimaid'] }),
    doorwarden: E('questlines', 'open', questline('doorwarden')),
    covenbane: E('questlines', 'open', questline('covenbane')),
    weirwalker: E('questlines', 'open', questline('weirwalker')),
    hourwitness: E('questlines', 'open', questline('hourwitness')),
    satakalwitness: E('questlines', 'open', questline('satakalwitness')),
    starwarden: E('questlines', 'seasonal', questline('starwarden')),
    witchwarden: E('festival', 'seasonal', wyrd('title:witchwarden')),
    hearthkeeper: E('festival', 'seasonal', () => t('coll.how.hearthkeeper', 'Give {n} Soul Cakes through your Hearth Offerings during the Witches’ Festival.', { n: HEARTHKEEPER_GIVEN })),
  }),
  aura: Object.freeze({
    dagonfire: E('broker', 'open', broker('aura:dagonfire'), { look: () => t('coll.look.dagonfire', 'A ring of Oblivion’s fire burning on the ground at your feet.') }),
    oblivionward: E('bestowed', 'bestowed', bestowed, { with: ['title:aegis'], look: () => t('coll.look.oblivionward', 'A ring of violet runes turning about your feet.') }),
    radiance: E('bestowed', 'bestowed', bestowed, { with: ['title:primarch'], look: () => t('coll.look.radiance', 'A column of golden light about you.') }),
    shadowcloak: E('bestowed', 'bestowed', bestowed, { with: ['title:shadowfang'], look: () => t('coll.look.shadowcloak', 'A hooded cloak of shadow and crimson light.') }),
    seraphwings: E('staff', 'staff', developer, { with: ['title:developer'], look: () => t('coll.look.seraphwings', 'Wings of flowing golden light.') }),
    resonance: E('bestowed', 'bestowed', bestowed, { with: ['title:crystalfist'], look: () => t('coll.look.resonance', 'Tiny purple crystals rising and falling about your feet.') }),
    turninghour: E('abyss', 'chance', remnant('turninghour'), { look: () => t('coll.look.turninghour', 'A turning wheel of brass gears and gold light.') }),
    firsthour: E('abyss', 'retired', hoursFirst, { with: ['title:hoursfirst'], look: () => t('coll.look.firsthour', 'The Turning Hour’s wheel in the light of the first dawn.') }),
    maelstrom: E('serpent', 'chance', serpent('maelstrom'), { look: () => t('coll.look.maelstrom', 'A whirlpool of tide and foam about your feet.') }),
    beaconlight: E('spire', 'open', redoubt('beaconlight'), { with: ['title:kynbane'], look: () => t('coll.look.beaconlight', 'Gold-white motes rising like a beacon’s sparks.') }),
    burningstair: E('spire', 'open', redoubt('burningstair'), { with: ['title:wellheadwalker'], look: () => t('coll.look.burningstair', 'Embers falling about you as if down a burning stair.') }),
    firstlight: E('spire', 'retired', spireFirst, { with: ['title:spirefirst'], look: () => t('coll.look.firstlight', 'A dawn-white ring of light.') }),
    lilacwarren: E('bestowed', 'bestowed', bestowed, { with: ['title:wikimaid'], look: () => t('coll.look.lilacwarren', 'Rabbits hopping round your feet on a ring of lilac light.') }),
    witchfire: E('festival', 'seasonal', wyrd('aura:witchfire'), { look: () => t('coll.look.witchfire', 'A coven’s green fire round your feet, tallow candles burning in its ring.') }),
  }),
  icon: Object.freeze({
    tallowskull: E('festival', 'seasonal', wyrd('icon:tallowskull')),
    twinmoons: E('festival', 'seasonal', wyrd('icon:twinmoons')),
    wyrdcauldron: E('festival', 'seasonal', wyrd('icon:wyrdcauldron')),
    soulcake: E('festival', 'seasonal', () => t('coll.how.soulcake', 'Take {n} Soul Cakes from other players’ Hearth Offerings during the Witches’ Festival.', { n: SOULCAKE_TAKEN })),
  }),
  glyph: Object.freeze({
    sprout: E('account', 'open', () => t('coll.how.sprout', 'Every new account shows it for its first two weeks.')),
    dev: E('staff', 'staff', developer, { with: ['title:developer'] }),
    mod: E('staff', 'staff', () => t('coll.how.moderator', 'The game’s moderators.')),
    dm: E('staff', 'staff', dungeonMaster, { with: ['title:dungeonmaster'] }),
    disciple: E('patrons', 'patron', patron('disciple'), { with: ['title:disciple'] }),
    apostle: E('patrons', 'dormant', apostle, { with: ['title:apostle'] }),
    hierophant: E('patrons', 'patron', patron('hierophant'), { with: ['title:hierophant'] }),
    shadowfang: E('bestowed', 'bestowed', bestowed, { with: ['title:shadowfang'] }),
    penitent: E('bestowed', 'bestowed', bestowed, { with: ['title:penitent'] }),
    herald: E('patrons', 'patron', patron('herald'), { with: ['title:herald'] }),
    tower: E('seats', 'open', () => t('coll.how.tower', 'Belong to a guild that holds a town’s palace seat.')),
    crownDF: E('seats', 'open', crown('Daggerfall')),
    crownWR: E('seats', 'open', crown('Wayrest')),
    crownSN: E('seats', 'open', crown('Sentinel')),
    laurel: E('ranked', 'ranked', arenaTop, { with: ['title:arenachampion'] }),
    aegis: E('bestowed', 'bestowed', bestowed, { with: ['title:aegis'] }),
    primarch: E('bestowed', 'bestowed', bestowed, { with: ['title:primarch'] }),
    crystalfist: E('bestowed', 'bestowed', bestowed, { with: ['title:crystalfist'] }),
    wikimaid: E('bestowed', 'bestowed', bestowed, { with: ['title:wikimaid'] }),
  }),
});

/** One entry, or null. */
export const wardrobeEntry = (/** @type {string} */ kind, /** @type {string} */ key) => {
  const of = /** @type {Record<string, WardrobeEntry> | undefined} */ (WARDROBE[kind]);
  return of && Object.hasOwn(of, key) ? of[key] : null;
};

/** A thing's name, as a player reads it - the words the account card and the name over a head use. */
export function wardrobeName(/** @type {string} */ kind, /** @type {string} */ key) {
  const table = /** @type {Record<string, string>} */ ({ title: TITLE_TEXT, aura: AURA_TEXT, icon: ICON_TEXT, glyph: GLYPH_LABEL }[kind] ?? {});
  return table[key] ?? key;
}

/** A kind's entries in the page's order - by source, then the vocabulary's own order: `{ kind, key, ...entry }`. */
export function wardrobeEntries(/** @type {string} */ kind) {
  const keys = VOCABULARY[/** @type {keyof typeof VOCABULARY} */ (kind)] ?? [];
  return keys.map((key, i) => ({ kind, key, i, ...(/** @type {WardrobeEntry} */ (wardrobeEntry(kind, key))) }))
    .filter((e) => e.src)
    .sort((a, b) => SOURCE_IDS.indexOf(a.src) - SOURCE_IDS.indexOf(b.src) || a.i - b.i);
}

/** WHETHER THE WARDROBE HOLDS IT - the service's answer read (a wardrobe from a service too old to say a kind holds none
 *  of it). High Master follows its Chapter Master. Pure. */
export function wardrobeHeld(/** @type {string} */ kind, /** @type {string} */ key, /** @type {any} */ wardrobe) {
  const via = wardrobeEntry(kind, key)?.via;
  if (via) return wardrobeHeld(kind, via, wardrobe);
  const list = wardrobe?.[HELD_LIST[/** @type {keyof typeof HELD_LIST} */ (kind)]];
  return Array.isArray(list) && list.includes(key);
}
/** WHETHER IT IS WORN: the one title, aura or icon the wardrobe says is worn; a glyph held and not taken off. A `via`
 *  entry is never worn of itself. Pure. */
export function wardrobeWorn(/** @type {string} */ kind, /** @type {string} */ key, /** @type {any} */ wardrobe) {
  if (wardrobeEntry(kind, key)?.via || !wardrobeHeld(kind, key, wardrobe)) return false;
  if (kind === 'glyph') return !(Array.isArray(wardrobe?.glyphsOff) && wardrobe.glyphsOff.includes(key));
  return wardrobe?.[kind] === key;
}
/** Whether an entry counts toward its kind's "n of m" - every one but a `via`'s. */
export const wardrobeCounted = (/** @type {{ via?: string }} */ e) => !e.via;
/** A kind's count: `{ held, total }` over its counted entries. Pure. */
export function wardrobeCount(/** @type {string} */ kind, /** @type {any} */ wardrobe) {
  const counted = wardrobeEntries(kind).filter(wardrobeCounted);
  return { held: counted.filter((e) => wardrobeHeld(kind, e.key, wardrobe)).length, total: counted.length };
}

/** THE AVAILABILITY NOW: a seasonal entry's resolved against the festival's dates (net/festivalLaw.js FESTIVALS). */
export function wardrobeAvail(/** @type {{ avail: string }} */ e, nowMs = Date.now()) {
  if (e.avail !== 'seasonal') return e.avail;
  return festivalAt(nowMs) ? 'seasonal' : 'offseason';
}
/** The open festival's last day in the player's own words ("7 November"), or '' with none open. */
export function festivalUntilText(nowMs = Date.now()) {
  const f = festivalAt(nowMs);
  if (!f) return '';
  try { return new Date(f.toMs - 1).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'long', timeZone: 'UTC' }); } catch { return new Date(f.toMs - 1).toISOString().slice(0, 10); }
}
/** An entry's availability in a sentence, now. */
export function availLine(/** @type {{ avail: string }} */ e, nowMs = Date.now()) {
  const a = wardrobeAvail(e, nowMs);
  return a === 'seasonal' ? AVAIL_LINE.seasonal(festivalUntilText(nowMs)) : AVAIL_LINE[/** @type {Exclude<keyof typeof AVAIL_LINE, 'seasonal'>} */ (a)]();
}
