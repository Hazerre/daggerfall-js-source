// @ts-check
// DECOR-ACCESS: the room's answer for who may use a chest or a station, and a shared chest's own window.
// The window changes the pack only after the service has moved the good.

let storage = new Set();
let station = new Set();
let bin = new Set();
let door = null;

/** Asked when the room's list stands. The service says which of these pieces this player may use. */
export function noteDecorGrants(homeDecor, mapId, buildingKey, character) {
  storage = new Set();
  station = new Set();
  bin = new Set();
  if (!homeDecor?.use) return;
  Promise.resolve(homeDecor.use({ mapId, buildingKey, character, op: 'grants' })).then((res) => {
    if (!res?.ok) return;
    storage = new Set(res.data.storage ?? []);
    station = new Set(res.data.station ?? []);
    bin = new Set(res.data.bin ?? []);
  }, () => {});
}

export const decorMayStorage = (id) => storage.has(id);
export const decorMayStation = (id) => station.has(id);

/** What the shared chest's window needs. `items` is the pack array. `realm` is the record's act, or null. */
export function bindDecorHouse(next) { door = next; }

/** The host's door, in one call: the service, the pack, and where the record stands. */
export function bindDecorHouseFrom(host, player, say, refusal, mapId, buildingKey) {
  bindDecorHouse({
    doc: typeof document !== 'undefined' ? document : null,
    use: (body) => host.homeDecor?.use?.(body),
    realm: () => host.realmAct ?? null,
    mapId, buildingKey,
    character: () => host.decorCharacter?.() ?? null,
    items: () => player?.items ?? [],
    take(uid) { const list = player?.items ?? []; const i = list.findIndex((it) => it?.uid === uid); if (i >= 0) list.splice(i, 1); },
    give(it) { if (player) (player.items ??= []).push(it); },
    say, refusal,
  });
}

async function askUse(body) {
  const act = door.realm?.();
  if (!act || body.op === 'list' || body.op === 'grants') return door.use(body);
  return act({ needsAnswer: true, call: (at) => door.use({ ...body, realm: at }) });
}

/** A chest whose goods the service holds, for someone the service allowed. The pack moves on the answer. */
export async function openSharedChest(id) {
  const d = door;
  if (!d?.use || !d.doc) return false;
  const at = { mapId: d.mapId, buildingKey: d.buildingKey, character: d.character?.() ?? d.character, id };
  const listed = await d.use({ ...at, op: 'list' });
  if (!listed?.ok) { d.say?.(d.refusal?.(listed?.error) ?? 'The chest stays shut.'); return false; }
  const root = d.doc.createElement('div');
  root.className = 'dfdecor-access';
  const draw = (items) => {
    root.replaceChildren();
    const title = d.doc.createElement('p');
    title.textContent = 'Chest';
    root.append(title);
    for (const it of items) {
      const b = d.doc.createElement('button');
      b.type = 'button';
      b.textContent = `Take ${it.name ?? 'item'}`;
      b.addEventListener('click', async () => {
        const res = await askUse({ ...at, op: 'withdraw', uid: it.uid });
        if (!res?.ok || !res.data?.item) { d.say?.(d.refusal?.(res?.error) ?? 'It stays in the chest.'); return; }
        d.give?.(res.data.item);
        const again = await d.use({ ...at, op: 'list' });
        if (again?.ok) draw(again.data.items ?? []);
      });
      root.append(b);
    }
    for (const it of d.items?.() ?? []) {
      if (!it?.uid) continue;
      const b = d.doc.createElement('button');
      b.type = 'button';
      b.textContent = `Put in ${it.name ?? 'item'}`;
      b.addEventListener('click', async () => {
        const res = await askUse({ ...at, op: 'deposit', item: it });
        if (!res?.ok) { d.say?.(d.refusal?.(res?.error) ?? 'It stays with you.'); return; }
        d.take?.(it.uid);
        const again = await d.use({ ...at, op: 'list' });
        if (again?.ok) draw(again.data.items ?? []);
      });
      root.append(b);
    }
    const close = d.doc.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => root.remove?.());
    root.append(close);
  };
  draw(listed.data.items ?? []);
  d.doc.body?.append(root);
  return true;
}
