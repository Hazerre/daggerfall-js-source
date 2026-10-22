// @ts-check
// ═══════════════════════════════════════════════════════════════════
// STAFF-PANEL2 (2026-10-22, mob: "do all 6"; design doc "DFO Staff Panel: design", build step 2) - THE PANEL'S REPORTS:
// the open chat cases most urgent first, one case read with its lines and the account's strike record, a case claimed
// and let go, and Mute, Ban, Unban and Dismiss - Admins and Moderators both (mob, 03:03Z: Moderators get "only chat report
// notifications with Mute and Ban").
//
// NOTHING NEW IS JUDGED. Every act is the one the game's own moderators' routes make (index.js /v1/mod/*): MOD1's
// muteAccount, SAFE4's banAccount and unbanAccount, AUDIT SAFE DOC-4's modCase and modDismiss - so a panel act lands in the
// same strike history (`mod_actions`), closes the case as an in-game act does, and its order reaches the relay's door
// (pushLaw) as one does. What the panel adds is who acted from where ("(staff panel)"), the audit row, and the claim.
//
// WHAT GOES FIRST (design doc, "What goes first"; mob, 04:05Z: "prioty of reports"): each case a level - high, medium or
// low - and the words that say why, from what mod_cases and mod_reports already hold (caseUrgency). The reviewer's
// severity is read off the row, never `modCases`' verdict, which hides one while a case is read again. The weights are
// starting numbers to tune, not measured ones.
//
// A CLAIM (mob, 04:13Z: "admin can alwasy take a case", "mods can only take one"): a Moderator holds one open case at a
// time, checked in the statement that takes it; an Admin takes any, one a Moderator holds too, and the Moderator is told
// (`claim_from`, answered as `lost`). A claim lets go CLAIM_S after its holder's last look or act on it. While another
// member holds a case, the panel's acts on its account are refused (`staff-claimed`), and so is a Discord press on it
// (discord.js onPress).
//
// EVERY LIST PAGES (mob, 19:25Z: "put inf scroll in anything that pull lists"): `from` the offset of the next page,
// answered as `next` while more stand.
import { displayName, muteAccount } from './accounts.js';
import { modCase, modDismiss, resolveCase } from './safety.js';
import { banAccount, unbanAccount, strikesLook, findAccount, actionStatement, lawOrder, pushLaw } from './sanctions.js';
import { LADDER_BAN_AT, STRIKE_WINDOW_S } from '../../src/net/safety/safetyLaw.js';

/** A claim lets go this long after its holder's last look or act on the case (design doc: "a starting number to tune"). */
export const CLAIM_S = 30 * 60;
/** Cases one page answers. */
export const CASES_PAGE = 25;
/** The open cases one read ranks at most - the ranking is the whole list's, so it is read whole. */
export const CASES_RANKED_MAX = 500;
/** A reviewer's read still waiting this long is itself a reason to look. */
export const AI_WAIT_S = 10 * 60;
/** A case nobody has touched this long goes up one level. */
export const STALE_S = 24 * 60 * 60;
/** Reporters who count, inside one hour, that make a case high. */
export const CREDIBLE_WAVE = 3;

export const CASE_ROUTES = Object.freeze(['/v1/staff/cases', '/v1/staff/case', '/v1/staff/claim', '/v1/staff/release',
  '/v1/staff/strikes', '/v1/staff/mute', '/v1/staff/ban', '/v1/staff/unban', '/v1/staff/dismiss']);

const LEVELS = Object.freeze(['low', 'medium', 'high']);
const SEVERITY_WORD = Object.freeze({ 1: 'low', 2: 'medium', 3: 'high' });

/**
 * A CASE'S LEVEL, and why - the design doc's rules, from the row and its reports.
 * @param {any} c a mod_cases row
 * @param {{ reports: Array<{ reason: string, counted: number, at: number }>, strikes: number, nowS: number }} what
 * @returns {{ level: 'high'|'medium'|'low', why: string[] }}
 */
export function caseUrgency(c, { reports, strikes, nowS }) {
  const why = [];
  let rank = 0;
  const raise = (/** @type {number} */ to, /** @type {string} */ word) => { if (to > rank) rank = to; why.push(word); };
  const n = Number(c.reports) || reports.length;
  why.push(`${n} reporter${n === 1 ? '' : 's'}`);
  const sev = c.ai_category ? Number(c.ai_severity) : 0;
  if (sev) {
    const word = `AI check: ${c.ai_category}, ${SEVERITY_WORD[/** @type {1|2|3} */ (sev)] ?? sev}`;
    if (sev >= 3 || (sev === 2 && (c.ai_category === 'threat' || c.ai_category === 'personal-info'))) raise(2, word);
    else raise(sev === 2 ? 1 : 0, word);
  } else {
    // before the reviewer has read it, the reporters' own reason stands in
    const said = new Set(reports.map((r) => r.reason));
    if (said.has('threat')) raise(2, 'reported as a threat');
    else if (said.has('hate') || said.has('sexual')) raise(1, `reported as ${said.has('hate') ? 'hate' : 'sexual'}`);
    else if (said.has('harassment') && n >= 2) raise(1, 'reported as harassment');
  }
  if (c.ai_state === 'failed') raise(2, 'AI check failed');
  else if ((c.ai_state === 'due' || c.ai_state === 'reading') && nowS - Number(c.updated_at) >= AI_WAIT_S) raise(1, 'AI check still waiting');
  if (c.auto) raise(2, 'muted automatically, unchecked');
  const counted = reports.filter((r) => r.counted === 1).map((r) => r.at).sort((a, b) => a - b);
  let wave = 0;
  for (let i = 0, j = 0; j < counted.length; j++) { while (counted[j] - counted[i] > 3600) i++; wave = Math.max(wave, j - i + 1); }
  if (wave >= CREDIBLE_WAVE) raise(2, `${wave} trusted reporters within an hour`);
  else if (n >= 2 && counted.length) raise(1, '');   // reporters who are all guests or new accounts are low
  if (strikes >= LADDER_BAN_AT) raise(2, `${strikes} strikes: next is a ban`);
  else if (strikes > 0) raise(1, `${strikes} strike${strikes === 1 ? '' : 's'}`);
  if (c.discord_state === 'failed') raise(1, 'Discord card failed');
  if (reports.length && !counted.length) why.push('reporters all guests or new');
  if (nowS - Number(c.updated_at) >= STALE_S && rank < 2) { rank++; why.push('untouched for a day'); }
  return { level: /** @type {'high'|'medium'|'low'} */ (LEVELS[rank]), why: why.filter(Boolean) };
}

/** Whether a row's claim stands now, held by someone. @param {any} c @param {number} nowS */
const held = (c, nowS) => !!c?.claimed_by && Number(c.claim_until) > nowS;

/**
 * THE PANEL'S CASE DOORS. Answers the route's body, or `{ error }` (staff.js STAFF_STATUS its status).
 * @param {any} ctx @param {any} env @param {string} path @param {any} body
 * @param {{ player: any, role: string }} who
 * @param {(act: string, target?: string|null, detail?: object|null, how?: object) => any} audit
 */
export async function staffCases(ctx, env, path, body, who, audit) {
  const { db, nowS, subtle } = ctx;
  const me = who.player;
  const admin = who.role === 'admin';
  const asName = `${displayName(me)} (staff panel)`;

  if (path === '/v1/staff/cases') {
    const sort = body.sort === 'newest' ? 'newest' : 'urgent';
    const from = Number.isSafeInteger(body.from) && body.from > 0 ? body.from : 0;
    const rows = (await db.prepare(`SELECT c.*, p.handle, p.guest_name, h.handle AS holder_handle, h.guest_name AS holder_guest
      FROM mod_cases c JOIN players p ON p.id = c.target LEFT JOIN players h ON h.id = c.claimed_by
      WHERE c.status = 'open' ORDER BY c.opened_at DESC LIMIT ?1`).bind(CASES_RANKED_MAX).all())?.results ?? [];
    const reports = rows.length ? (await db.prepare(`SELECT r.case_id, r.reason, r.counted, r.at FROM mod_reports r JOIN mod_cases c ON c.id = r.case_id
      WHERE c.status = 'open'`).all())?.results ?? [] : [];
    const strikes = rows.length ? (await db.prepare(`SELECT a.target, COUNT(*) AS n FROM mod_actions a WHERE a.kind IN ('mute', 'ban') AND a.at > ?1
      AND a.void_at IS NULL AND a.target IN (SELECT target FROM mod_cases WHERE status = 'open') GROUP BY a.target`).bind(nowS - STRIKE_WINDOW_S).all())?.results ?? [] : [];
    const strikesOf = new Map(strikes.map((s) => [s.target, Number(s.n)]));
    const ranked = rows.map((c) => {
      const mine = reports.filter((r) => r.case_id === c.id);
      const u = caseUrgency(c, { reports: mine, strikes: strikesOf.get(c.target) ?? 0, nowS });
      const claim = held(c, nowS) ? { by: c.claimed_by, name: c.holder_handle ?? c.holder_guest ?? null, until: c.claim_until, mine: c.claimed_by === me.id } : null;
      return {
        id: c.id, target: c.target, name: displayName(c), reports: c.reports, credible: c.credible, reasons: [...new Set(mine.map((r) => String(r.reason)))],
        level: u.level, why: u.why, ai: c.ai_category ? { category: c.ai_category, severity: c.ai_severity, confidence: c.ai_confidence, state: c.ai_state } : null,
        auto: c.auto ?? null, openedAt: c.opened_at, updatedAt: c.updated_at, lastReport: mine.reduce((a, r) => Math.max(a, r.at), 0), claim,
      };
    });
    const lvl = (/** @type {any} */ x) => LEVELS.indexOf(x.level);
    ranked.sort(sort === 'newest' ? (a, b) => b.openedAt - a.openedAt : (a, b) => lvl(b) - lvl(a)
      || (a.claim ? 1 : 0) - (b.claim ? 1 : 0)   // a claimed case sorts below the rest of its level
      || (b.ai?.confidence ?? 0) - (a.ai?.confidence ?? 0)
      || (nowS - b.lastReport < 3600 ? 1 : 0) - (nowS - a.lastReport < 3600 ? 1 : 0)   // reports still coming in
      || a.openedAt - b.openedAt);
    const page = ranked.slice(from, from + CASES_PAGE);
    const lost = from ? [] : ((await db.prepare(`SELECT c.id, c.target, p.handle, p.guest_name, h.handle AS holder FROM mod_cases c JOIN players p ON p.id = c.target
      LEFT JOIN players h ON h.id = c.claimed_by WHERE c.status = 'open' AND c.claim_from = ?1 AND c.claimed_by IS NOT ?1 AND c.claim_until > ?2`).bind(me.id, nowS).all())?.results ?? [])
      .map((c) => ({ id: c.id, target: c.target, name: displayName(c), by: c.holder ?? null }));
    await audit('cases-read', null, { sort }, { onceIn: 10 * 60 }).run();
    return { cases: page, next: from + CASES_PAGE < ranked.length ? from + CASES_PAGE : null, total: ranked.length, lost };
  }

  // every other door names one account: by its id, or a name (sanctions.js findAccount)
  const row = await findAccount(db, { target: body.target, name: body.name });
  if ('error' in row) return row;
  const open = await db.prepare("SELECT id, claimed_by, claim_until FROM mod_cases WHERE target = ?1 AND status = 'open'").bind(row.id).first();
  const theirs = held(open, nowS) && open.claimed_by !== me.id;
  /** The holder's look or act keeps the claim. */
  const keep = () => (open && held(open, nowS) && open.claimed_by === me.id
    ? db.prepare("UPDATE mod_cases SET claim_until = ?3 WHERE id = ?1 AND claimed_by = ?2 AND status = 'open'").bind(open.id, me.id, nowS + CLAIM_S).run() : null);

  if (path === '/v1/staff/case' || path === '/v1/staff/strikes') {
    const look = await strikesLook(ctx, me, env, { target: row.id });
    if ('error' in look) return look;
    const one = path === '/v1/staff/case' ? await modCase(ctx, me, env, { target: row.id }) : null;
    if (one && 'error' in one) return one;
    await keep();
    await audit(path === '/v1/staff/case' ? 'case-read' : 'strikes-read', row.id, { name: displayName(row) }, { onceIn: 10 * 60 }).run();
    const c = open ? await db.prepare(`SELECT c.claimed_by, c.claim_until, h.handle, h.guest_name FROM mod_cases c LEFT JOIN players h ON h.id = c.claimed_by WHERE c.id = ?1`).bind(open.id).first() : null;
    return {
      ...(one ? { case: one.case } : {}), record: look,
      claim: held(c, nowS) ? { by: c.claimed_by, name: c.handle ?? c.guest_name ?? null, until: c.claim_until, mine: c.claimed_by === me.id } : null,
    };
  }

  if (path === '/v1/staff/claim' || path === '/v1/staff/release') {
    if (!open) return { error: 'no-case' };
    if (path === '/v1/staff/release') {
      const [, r] = await db.batch([
        audit('case-release', row.id, { case: open.id }, { okIf: { sql: "EXISTS (SELECT 1 FROM mod_cases WHERE id = ? AND claimed_by = ? AND status = 'open')", args: [open.id, me.id] } }),
        db.prepare("UPDATE mod_cases SET claimed_by = NULL, claim_until = NULL, claim_from = NULL WHERE id = ?1 AND claimed_by = ?2 AND status = 'open'").bind(open.id, me.id),
      ]);
      return r.meta.changes ? { ok: true, case: open.id } : { error: 'no-case' };
    }
    const until = nowS + CLAIM_S;
    // an Admin takes any open case, and the member it was taken from is told; a Moderator takes one nobody holds, and
    // only while holding no other - both in the statement that takes it, so two takes at once land one
    const take = admin
      ? db.prepare(`UPDATE mod_cases SET claim_from = CASE WHEN claimed_by IS NOT NULL AND claimed_by != ?2 AND claim_until > ?3 THEN claimed_by ELSE NULL END,
          claimed_by = ?2, claim_until = ?4 WHERE id = ?1 AND status = 'open'`).bind(open.id, me.id, nowS, until)
      : db.prepare(`UPDATE mod_cases SET claim_from = NULL, claimed_by = ?2, claim_until = ?4 WHERE id = ?1 AND status = 'open'
          AND (claimed_by IS NULL OR claimed_by = ?2 OR claim_until <= ?3)
          AND NOT EXISTS (SELECT 1 FROM mod_cases o WHERE o.status = 'open' AND o.claimed_by = ?2 AND o.claim_until > ?3 AND o.id != ?1)`).bind(open.id, me.id, nowS, until);
    const r = await take.run();
    if (!r.meta.changes) {
      await audit('case-claim', row.id, { case: open.id, why: theirs ? 'held' : 'one-case' }, { outcome: 'denied' }).run();
      return { error: theirs ? 'staff-claimed' : 'staff-one-case' };
    }
    await audit('case-claim', row.id, { case: open.id, ...(admin && theirs ? { from: open.claimed_by } : {}) }).run();
    return { ok: true, case: open.id, until };
  }

  // ═══ THE ACTS: the game's moderators' own, made as this member, from the panel ═══
  if (theirs) {
    await audit(path.slice('/v1/staff/'.length), row.id, { why: 'held' }, { outcome: 'denied' }).run();
    return { error: 'staff-claimed' };
  }
  /** @type {any} */
  let r;
  let detail = /** @type {any} */ ({ name: displayName(row) });
  if (path === '/v1/staff/mute') {
    r = await muteAccount(ctx, me, env, { target: row.id, minutes: body.minutes });
    detail = { ...detail, minutes: body.minutes };
    if (!r.error) {
      await actionStatement(db, { target: row.id, kind: r.until ? 'mute' : 'unmute', until: r.until || null, actor: me.id, actorName: asName, at: nowS }).run();
      if (r.until) await resolveCase(db, { target: row.id, status: 'actioned', by: displayName(me), resolution: `muted until ${new Date(r.until * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC (staff panel)`, nowS }).run();
      await pushLaw(env, (u, i) => globalThis.fetch(u, i), await lawOrder(env, subtle, nowS, { s: row.id, mu: r.until }));
    }
  } else if (path === '/v1/staff/ban' || path === '/v1/staff/unban') {
    r = path === '/v1/staff/ban'
      ? await banAccount(ctx, me, env, { target: row.id, days: body.days, reason: body.reason, caseId: open?.id ?? null, actorName: asName })
      : await unbanAccount(ctx, me, env, { target: row.id, actorName: asName });
    if (path === '/v1/staff/ban') detail = { ...detail, days: body.days, reason: typeof body.reason === 'string' ? body.reason.slice(0, 200) : null };
    if (!r.error) {
      if (path === '/v1/staff/ban') await resolveCase(db, { target: row.id, status: 'actioned', by: displayName(me), resolution: 'banned (staff panel)', nowS }).run();
      await pushLaw(env, (u, i) => globalThis.fetch(u, i), await lawOrder(env, subtle, nowS, { s: row.id, bn: r.until }));
    }
  } else if (path === '/v1/staff/dismiss') {
    r = await modDismiss(ctx, me, env, { target: row.id });
  } else return { error: 'not-found' };
  if (r.error) {
    await audit(path.slice('/v1/staff/'.length), row.id, { ...detail, error: r.error }, { outcome: 'failed' }).run();
    return r;
  }
  await keep();
  await audit(path.slice('/v1/staff/'.length), row.id, detail).run();
  return { ...r, order: undefined };   // no rooms to carry it to: the relay's door has it
}
