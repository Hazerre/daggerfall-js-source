-- CRAFT-WRITS (2026-10-22, the Discord's #feature-feedback, "Crafting seems unrewarding": "crafting writs instead of only
-- gathering writs ... The reward can be crafting xp, silver, and rep"; bible/06-Systems/Professions-Arc.md section 49).
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI), before the Worker that
-- posts and fills the writs (acct168).
--
-- A CRAFTING WRIT. A realm character is asked three a UTC day of its own (src/net/craftWritLaw.js craftWritsFor), written
-- down the first time it reads a board that day: the product (`potion:<id>`, `dish:<id>`, a kit's recipe id), the guild
-- that asks it (`faction`), the count, and the pay, XP and Renown the law gave it then. Filled whole by its owner alone
-- (`filled_at`, the request's `rid` and its nonce `n`, as every act's row): `xp_given` the XP the crafter's limit let the
-- track take, `goods` the pieces' provenance ids a dish or kit writ took (JSON) - none for a potion writ, whose bottles
-- are any of its recipe. A FILLED POTION WRIT STAYS: the brews it took are counted against the character's brews by it
-- (server-account/src/craftWrits.js brewedLeftSql), so it is never swept; an unfilled one goes the day after its own.
CREATE TABLE IF NOT EXISTS craft_writs (
  id         TEXT PRIMARY KEY,
  player     TEXT NOT NULL,
  owner      TEXT NOT NULL,
  day        INTEGER NOT NULL,
  slot       INTEGER NOT NULL CHECK (slot BETWEEN 0 AND 2),
  product    TEXT NOT NULL,
  faction    INTEGER NOT NULL,
  tier       INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 7),
  qty        INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 20),
  pay        INTEGER NOT NULL CHECK (pay >= 1),
  xp         INTEGER NOT NULL CHECK (xp >= 0),
  renown     INTEGER NOT NULL CHECK (renown >= 0),
  track      TEXT NOT NULL CHECK (track IN ('provisioning', 'smithing')),
  expires_at INTEGER NOT NULL,
  filled_at  INTEGER,
  xp_given   INTEGER CHECK (xp_given IS NULL OR xp_given >= 0),
  goods      TEXT,
  rid        TEXT,
  n          TEXT,
  UNIQUE (day, owner, slot),
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
-- a request asked again finds its row; the account's fills of a day are counted; a character's potion writs filled are
-- summed against its brews
CREATE UNIQUE INDEX IF NOT EXISTS idx_craft_writs_rid ON craft_writs (player, rid) WHERE rid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_craft_writs_day ON craft_writs (player, day, filled_at);
CREATE INDEX IF NOT EXISTS idx_craft_writs_taken ON craft_writs (owner, product, filled_at);

-- A BREW WITNESSED WHOLE. A potion writ pays silver for potions the service saw brewed - but a station spends a cauldron's
-- LOOSE units first (AUDIT BAG-CRAFT A1, migration 0097: what the pack put in that the service never handed out - a
-- looted herb, a reagent bought for gold), and a potion of them is gold's goods, which never fetch silver (GOLD-MARKET).
-- `witnessed` is 1 where the brew spent none (alchemy.js brewAtStation writes it in the brew's own decision); every brew
-- before this column reads 0, its units' origins unknown, so a crafting writ counts the brews from this release on.
ALTER TABLE prof_brews ADD COLUMN witnessed INTEGER NOT NULL DEFAULT 0 CHECK (witnessed IN (0, 1));
