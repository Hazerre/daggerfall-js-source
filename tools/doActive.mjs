#!/usr/bin/env node
// COST-0 (2026-10-24, the owner's bill: about $90 a day, $50 of it Durable Objects compute DURATION) - HOW MANY ROOMS
// ARE AWAKE, READ BY THE OPERATOR. Cloudflare bills an object's duration while it runs or sits in memory unable to
// hibernate, 128 MB a second at $12.50 per million GB-s: $0.135 an object-day. $50 a day is some 370 objects awake around
// the clock, and nothing in the tree could say which. Cloudflare's GraphQL analytics can: `durableObjectsPeriodicGroups`
// carries each object's active time (HUB-PULL read it by hand for the hub's shards, bible/11-Multiplayer/Scale-Arc.md
// "HUB-PULL and DO-ASK"). Its fields are not in Cloudflare's docs, so this asks the schema first and builds every
// question from what the account's schema says it has. .github/workflows/do-active.yml runs it by hand with the
// deploy's token. It reads only.
//
//   node tools/doActive.mjs --account <id> --days [days]   the reading, as Markdown on stdout (the token from
//                                                         CLOUDFLARE_API_TOKEN); the schema first, so a run that
//                                                         stops part way still says what the account exposes
//   node tools/doActive.mjs --check [days]                 the window a run reads (refused like the run refuses it)
//
// THE READING, for each of the last `days` whole UTC days: every object's summed active time (its hours awake that
// day), how many were awake over ALWAYS_ON_H hours (the chat layer and the hub, if COST-0's reading of the code is
// right), the object-days the day's total comes to and what they cost - split by namespace (the relay's `Room`, the
// Worker's `AdmitGate`) where the schema has one - and over the window a histogram of hours a day and the objects awake
// longest. THE UNIT IS NOT DOCUMENTED: the busiest object-day is read under each candidate unit, and the reading used is
// the one that puts it nearest a whole day without passing it (the hub's bus is awake all day). THE PAGE IS CUT: a day
// touches more objects than a page holds, so the per-object rows are the busiest first and a cut page says so; the
// day's total is its own question, never a sum of a cut page.

import { isMain } from './lib/isMain.mjs';

export const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';
/** The dataset read. */
export const DATASET = 'durableObjectsPeriodicGroups';
/** The longest window asked, whole days; the default too. */
export const DAYS_MAX = 7;
export const DAY_S = 86_400;
/** An object awake more than this many hours of a day is counted as always awake. */
export const ALWAYS_ON_H = 22;
/** What an object-day of duration costs: 128 MB (0.125 GB) held DAY_S seconds at $12.50 per million GB-s. */
export const OBJECT_DAY_USD = (0.125 * DAY_S * 12.5) / 1e6;
/** The histogram's upper edges, hours a day. */
export const HOUR_EDGES = Object.freeze([1, 2, 4, 8, 12, 16, 20, 22, 24]);
/** The units `activeTime` may be in, each its seconds - Cloudflare's GraphQL times are microseconds elsewhere. */
export const UNITS = Object.freeze([['microseconds', 1e-6], ['milliseconds', 1e-3]]);
/** How many of the objects awake longest the summary lists. */
export const TOP_N = 40;
/** The most rows a page asks for, whatever the account's settings allow. */
export const PAGE_MAX = 10_000;
/** The settings this reads, where the account's schema has them. */
const SETTINGS = ['enabled', 'maxDuration', 'maxNumberOfFields', 'maxPageSize', 'notOlderThan'];

/** A window in whole days, 1 to DAYS_MAX (an empty input is DAYS_MAX), or throw: digits only. */
export function activeDays(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return DAYS_MAX;
  const d = /^[0-9]{1,2}$/.test(s) ? Number(s) : NaN;
  if (!Number.isSafeInteger(d) || d < 1 || d > DAYS_MAX) throw new Error(`not a window: ${JSON.stringify(raw)} - whole days, 1 to ${DAYS_MAX}`);
  return d;
}

/** An account id as wrangler.toml carries it, or throw - it is written into the questions. */
export function accountId(raw) {
  const s = String(raw ?? '').trim();
  if (!/^[0-9a-f]{32}$/.test(s)) throw new Error(`not an account id: ${JSON.stringify(raw)}`);
  return s;
}

/** The last `days` whole UTC days before `now`, oldest first, as YYYY-MM-DD. */
export function windowDays(days, now = Date.now()) {
  const today = Math.floor(now / 1000 / DAY_S) * DAY_S;
  return Array.from({ length: days }, (_, i) => new Date((today - (days - i) * DAY_S) * 1000).toISOString().slice(0, 10));
}

// ─────────────────────────────────────────── the schema ───────────────────────────────────────────
const TYPE_REF = 'name kind ofType { name kind ofType { name kind ofType { name kind } } }';
/** One type's introspection - standard GraphQL, which Cloudflare's endpoint answers. */
export const typeQuery = (name) => `query { __type(name: ${JSON.stringify(name)}) { name kind fields { name type { ${TYPE_REF} } args { name type { ${TYPE_REF} } } } inputFields { name } enumValues { name } } }`;
/** A type reference's named type, through its LIST and NON_NULL wrappers. */
const unwrap = (t) => { let x = t; while (x && !x.name) x = x.ofType; return x ?? null; };
const named = (t) => unwrap(t)?.name ?? null;
const fieldOf = (type, name) => type?.fields?.find((f) => f.name === name) ?? null;
const names = (list) => (list ?? []).map((f) => f.name);

/**
 * WHAT THE ACCOUNT EXPOSES: the schema walked from its root to the dataset - the query type, `viewer`, `accounts`, the
 * dataset's group and each of its parts (dimensions, sum, max, ...), its filter's fields and its orders - and the
 * account's settings for it, where the schema has a `settings` node. Every name past the root is the schema's own.
 * @param {(query: string) => Promise<any>} ask a GraphQL question's `data`
 * @param {string} account
 */
export async function introspect(ask, account) {
  const type = async (name) => {
    const t = (await ask(typeQuery(name)))?.__type;
    if (!t) throw new Error(`the schema has no type ${name}`);
    return t;
  };
  const step = async (from, field) => {
    const f = fieldOf(from, field);
    if (!f) throw new Error(`${from.name} has no field ${field} - its fields: ${names(from.fields).join(', ')}`);
    return { field: f, type: await type(named(f.type)) };
  };
  const root = (await ask('query { __schema { queryType { name } } }'))?.__schema?.queryType?.name;
  if (!root) throw new Error('the schema names no query type');
  const viewer = await step(await type(root), 'viewer');
  const accounts = await step(viewer.type, 'accounts');
  const group = await step(accounts.type, DATASET);
  const parts = {};
  for (const f of group.type.fields ?? []) {
    const t = unwrap(f.type);
    parts[f.name] = t?.kind === 'OBJECT' ? names((await type(t.name)).fields) : null;   // null: a value of the group's own (a count)
  }
  const argType = async (arg) => { const a = group.field.args?.find((x) => x.name === arg); return a ? type(named(a.type)) : null; };
  const filters = names((await argType('filter'))?.inputFields);
  const orders = names((await argType('orderBy'))?.enumValues);
  let settings = null;
  const s = fieldOf(accounts.type, 'settings');
  if (s) {
    const st = await type(named(s.type));
    const sd = fieldOf(st, DATASET);
    const have = sd ? names((await type(named(sd.type))).fields).filter((n) => SETTINGS.includes(n)) : [];
    if (have.length) settings = (await ask(`query { viewer { accounts(filter: {accountTag: "${accountId(account)}"}) { settings { ${DATASET} { ${have.join(' ')} } } } } }`))?.viewer?.accounts?.[0]?.settings?.[DATASET] ?? null;
  }
  return { root, group: group.type.name, parts, filters, orders, settings };
}

/** The schema's answer drawn - each part's fields, the filters, the orders that sort by active time, the settings. */
export function schemaTable(schema) {
  const rows = [['group', schema.group]];
  for (const [p, f] of Object.entries(schema.parts)) rows.push([p, f ? f.join(', ') : '(a value)']);
  rows.push(['filter', schema.filters.join(', ')]);
  rows.push(['orderBy (activeTime)', schema.orders.filter((o) => /activeTime/.test(o)).join(', ') || '(none)']);
  rows.push(['settings', schema.settings ? Object.entries(schema.settings).map(([k, v]) => `${k} ${v}`).join(', ') : '(not exposed)']);
  return `**What the account exposes (\`${DATASET}\`)**\n\n| part | fields |\n|---|---|\n${rows.map(([a, b]) => `| ${a} | ${String(b).replace(/\|/g, '\\|')} |`).join('\n')}\n`;
}

// ─────────────────────────────────────────── the questions ───────────────────────────────────────────
/**
 * The plan the schema allows, or throw naming what is missing: the per-object dimension, the active time, a filter by
 * day, the page and the order. A window the account keeps no data for is cut to what it keeps.
 */
export function readingPlan(schema, days) {
  const dims = schema.parts.dimensions ?? [];
  const sums = schema.parts.sum ?? [];
  const missing = [];
  if (!dims.includes('objectId')) missing.push('dimensions.objectId');
  if (!sums.includes('activeTime')) missing.push('sum.activeTime');
  const byDay = schema.filters.includes('date') ? 'date' : schema.filters.includes('date_geq') && schema.filters.includes('date_leq') ? 'date_range' : schema.filters.includes('datetime_geq') && schema.filters.includes('datetime_lt') ? 'datetime' : null;
  if (!byDay) missing.push('a filter by day (date, date_geq/date_leq or datetime_geq/datetime_lt)');
  const maxDuration = Number(schema.settings?.maxDuration);
  if (byDay !== 'datetime' && Number.isFinite(maxDuration) && maxDuration > 0 && maxDuration < DAY_S) missing.push(`a filter finer than a day (maxDuration ${maxDuration} s)`);
  if (missing.length) throw new Error(`the account's ${DATASET} lacks ${missing.join('; ')} - nothing past the schema can be read`);
  const notOlder = Number(schema.settings?.notOlderThan);
  const kept = Number.isFinite(notOlder) && notOlder > 0 ? Math.floor(notOlder / DAY_S) - 1 : days;
  const pageSize = Math.min(PAGE_MAX, Number(schema.settings?.maxPageSize) > 0 ? Number(schema.settings.maxPageSize) : PAGE_MAX);
  const slice = byDay === 'datetime' && Number.isFinite(maxDuration) && maxDuration > 0 ? Math.min(DAY_S, maxDuration) : DAY_S;
  return {
    days: Math.max(1, Math.min(days, kept)),
    cut: kept < days ? kept : null,
    byDay, slice, pageSize,
    order: schema.orders.includes('sum_activeTime_DESC') ? 'sum_activeTime_DESC' : null,
    namespace: dims.includes('namespaceId'),
  };
}

/** A day's filters, one a slice of `plan.slice` seconds, each a GraphQL literal. */
export function dayFilters(plan, day) {
  if (plan.byDay === 'date') return [`{date: "${day}"}`];
  if (plan.byDay === 'date_range') return [`{date_geq: "${day}", date_leq: "${day}"}`];
  const t0 = Date.parse(`${day}T00:00:00Z`) / 1000;
  const out = [];
  for (let t = t0; t < t0 + DAY_S; t += plan.slice) {
    out.push(`{datetime_geq: "${new Date(t * 1000).toISOString()}", datetime_lt: "${new Date(Math.min(t + plan.slice, t0 + DAY_S) * 1000).toISOString()}"}`);
  }
  return out;
}

const groups = (account, args, body) => `query { viewer { accounts(filter: {accountTag: "${accountId(account)}"}) { g: ${DATASET}(${args}) { ${body} } } } }`;
/** A slice's objects, the busiest first: each its id, its namespace where the schema has one, and its active time. */
export const objectsQuery = (account, plan, filter) => groups(account, `limit: ${plan.pageSize}, filter: ${filter}${plan.order ? `, orderBy: [${plan.order}]` : ''}`, `dimensions { objectId${plan.namespace ? ' namespaceId' : ''} } sum { activeTime }`);
/** A slice's total active time - by namespace where the schema has one, never through a page that could be cut. */
export const totalQuery = (account, plan, filter) => groups(account, `limit: ${plan.pageSize}, filter: ${filter}`, `${plan.namespace ? 'dimensions { namespaceId } ' : ''}sum { activeTime }`);

// ─────────────────────────────────────────── the reading ───────────────────────────────────────────
/** The unit the busiest object-day says: each candidate's hours, and the one nearest a day without passing it (the
 *  hub's bus is awake all day) - or the first, said unsure, when every reading passes a day. */
export function unitOf(busiestRaw) {
  const readings = UNITS.map(([name, s]) => ({ name, s, hours: (busiestRaw * s) / 3600 }));
  const fit = readings.filter((r) => r.hours <= 24.5).sort((a, b) => b.hours - a.hours)[0];
  return { readings, chosen: fit ?? readings[0], sure: !!fit };
}

/** The histogram bucket an object-day's hours fall in: the first edge it does not pass. */
export const bucketOf = (h) => { const i = HOUR_EDGES.findIndex((e) => h <= e); return i < 0 ? HOUR_EDGES.length - 1 : i; };

const num = (v, d = 1) => (Number.isInteger(v) ? v.toLocaleString('en-US') : Number(v).toLocaleString('en-US', { maximumFractionDigits: d }));
const table = (title, cols, rows) => `**${title}**\n\n| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n`;

/**
 * THE RUN: the schema, then each day's objects and total, drawn as they come (`out`), so a run that stops part way keeps
 * what it read. Throws where it cannot go on; the caller says so.
 * @param {{ ask: (query: string) => Promise<any>, account: string, days: number, now?: number, out: (md: string) => void, namespaces?: Map<string, string> }} o
 */
export async function reading({ ask, account, days, now = Date.now(), out, namespaces = new Map() }) {
  const schema = await introspect(ask, account);
  out(`${schemaTable(schema)}\n`);
  const plan = readingPlan(schema, activeDays(days));
  if (plan.cut != null) out(`The account keeps ${plan.cut} whole day(s) of this dataset: the window is cut to it.\n\n`);
  const nsName = (id) => (id == null ? '(all)' : namespaces.get(id) ?? id);
  const perDay = [];
  for (const day of windowDays(plan.days, now)) {
    const objects = new Map();   // objectId -> { ns, raw }
    let cut = false;
    const totals = new Map();    // namespace -> raw
    for (const f of dayFilters(plan, day)) {
      const rows = (await ask(objectsQuery(account, plan, f)))?.viewer?.accounts?.[0]?.g ?? [];
      if (rows.length >= plan.pageSize) cut = true;
      for (const r of rows) {
        const id = r.dimensions?.objectId;
        if (!id) continue;
        const o = objects.get(id) ?? { ns: r.dimensions?.namespaceId ?? null, raw: 0 };
        o.raw += Number(r.sum?.activeTime ?? 0);
        objects.set(id, o);
      }
      for (const r of (await ask(totalQuery(account, plan, f)))?.viewer?.accounts?.[0]?.g ?? []) {
        const ns = r.dimensions?.namespaceId ?? null;
        totals.set(ns, (totals.get(ns) ?? 0) + Number(r.sum?.activeTime ?? 0));
      }
    }
    perDay.push({ day, objects, cut, totals });
  }
  let busiest = 0;
  for (const d of perDay) for (const o of d.objects.values()) busiest = Math.max(busiest, o.raw);
  const unit = unitOf(busiest);
  const h = (raw) => (raw * unit.chosen.s) / 3600;
  out(`**The unit of activeTime** (not in Cloudflare's docs): the busiest object-day reads ${num(busiest, 0)} - ${unit.readings.map((r) => `${num(r.hours, 2)} h as ${r.name}`).join(', ')}. Read as **${unit.chosen.name}**, ${unit.sure ? 'the reading nearest a whole day without passing it (the hub\'s bus is awake all day)' : 'UNSURE: every reading passes a whole day'}.\n\n`);

  const dayRows = [];
  let objectDays = 0;
  for (const d of perDay) {
    const byNs = new Map();
    for (const o of d.objects.values()) {
      const e = byNs.get(o.ns) ?? { n: 0, on: 0 };
      e.n++; if (h(o.raw) > ALWAYS_ON_H) e.on++;
      byNs.set(o.ns, e);
    }
    for (const [ns, raw] of d.totals) {
      const od = h(raw) / 24;
      objectDays += od;
      const e = byNs.get(ns) ?? { n: 0, on: 0 };
      dayRows.push([d.day, nsName(ns), num(e.n), d.cut ? `yes (${num(plan.pageSize)})` : 'no', num(e.on), num(od, 1), `$${num(od * OBJECT_DAY_USD, 2)}`]);
    }
  }
  out(`${table('Day by day (UTC)', ['day', 'namespace', 'objects', 'page cut', `awake > ${ALWAYS_ON_H} h`, 'object_days', 'duration $'], dayRows)}\n`);
  out(`Over the window: ${num(objectDays, 1)} object-days, ${num(objectDays / perDay.length, 1)} a day - $${num((objectDays / perDay.length) * OBJECT_DAY_USD, 2)} a day at $${num(OBJECT_DAY_USD, 3)} an object-day (the bill's duration line divided by it should come to the same).\n\n`);

  const hist = HOUR_EDGES.map(() => 0);
  let held = 0;
  for (const d of perDay) for (const o of d.objects.values()) { hist[bucketOf(h(o.raw))]++; held++; }
  out(`${table(`Hours awake a day (the ${num(held)} object-days the pages hold${perDay.some((d) => d.cut) ? '; a cut page leaves out the least awake' : ''})`, ['hours', 'object_days'], HOUR_EDGES.map((e, i) => [`${i ? HOUR_EDGES[i - 1] : 0}-${e}`, num(hist[i])]))}\n`);

  const byObject = new Map();
  for (const d of perDay) {
    for (const [id, o] of d.objects) {
      const e = byObject.get(id) ?? { ns: o.ns, days: 0, hours: 0, on: 0 };
      e.days++; e.hours += h(o.raw); if (h(o.raw) > ALWAYS_ON_H) e.on++;
      byObject.set(id, e);
    }
  }
  const top = [...byObject].sort((a, b) => b[1].hours - a[1].hours || (a[0] < b[0] ? -1 : 1)).slice(0, TOP_N);
  out(`${table(`The ${TOP_N} objects awake longest (hours a day over the days each was seen)`, ['object', 'namespace', 'days', 'hours_a_day', `days > ${ALWAYS_ON_H} h`], top.map(([id, e]) => [`\`${id}\``, nsName(e.ns), num(e.days), num(e.hours / e.days, 1), num(e.on)]))}\n`);
  return { schema, plan, unit, perDay, objectDays };
}

/** A GraphQL question's `data`, or throw its errors. */
export function graphqlAsk(token, fetchImpl = fetch) {
  return async (query) => {
    const res = await fetchImpl(GRAPHQL, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ query }), signal: AbortSignal.timeout(60_000) });
    const body = await res.json().catch(() => null);
    if (res.status === 401 || res.status === 403) throw new Error(`refused (HTTP ${res.status}) - the token needs Account Analytics: Read`);
    if (!res.ok || !body || body.errors?.length) throw new Error(`not answered (HTTP ${res.status}): ${JSON.stringify(body?.errors ?? body).slice(0, 400)}`);
    return body.data;
  };
}

/** The account's Durable Object namespaces by id, each its class (and script), or an empty map where the token may not
 *  read them - the split still stands on the ids. */
export async function namespacesOf(token, account, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId(account)}/workers/durable_objects/namespaces?per_page=100`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60_000) });
    const body = await res.json();
    if (!res.ok || !Array.isArray(body?.result)) return new Map();
    return new Map(body.result.map((n) => [n.id, `${n.class ?? n.name ?? n.id}${n.script ? ` (${n.script})` : ''}`]));
  } catch { return new Map(); }
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] ?? '' : null; };
  try {
    if (opt('--check') != null || argv[0] === '--check') console.log(activeDays(opt('--check')));
    else if (opt('--account') != null) {
      const token = process.env.CLOUDFLARE_API_TOKEN;
      if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set');
      const account = accountId(opt('--account'));
      const days = activeDays(opt('--days'));
      await reading({ ask: graphqlAsk(token), account, days, out: (md) => process.stdout.write(md), namespaces: await namespacesOf(token, account) });
    } else { console.error('usage: doActive.mjs --account <id> --days [days] | --check [days]'); process.exit(2); }
  } catch (e) {
    console.error(`::error::${e?.message ?? e}`);
    process.exit(1);
  }
}
