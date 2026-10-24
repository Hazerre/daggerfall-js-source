// A house offered at its own door. The service keeps the gold, the goods and the owner.

function field(doc, label, kind) {
  const row = doc.createElement('label');
  row.textContent = label;
  const input = doc.createElement('input');
  input.type = kind;
  row.append(input);
  return { row, input };
}

function ask(doc, title, build, onYes) {
  const root = doc.createElement('div');
  root.className = 'dfhome-transfer';
  const box = doc.createElement('form');
  const head = doc.createElement('p');
  head.textContent = title;
  box.append(head);
  const bits = build(box);
  const yes = doc.createElement('button');
  yes.type = 'submit';
  yes.textContent = 'Confirm';
  const no = doc.createElement('button');
  no.type = 'button';
  no.textContent = 'Cancel';
  box.append(yes, no);
  root.append(box);
  const close = () => root.remove();
  no.addEventListener('click', close);
  box.addEventListener('submit', (e) => {
    e.preventDefault();
    close();
    onYes(bits);
  });
  (doc.body ?? doc.documentElement).append(root);
}

async function send(host, body) {
  const homes = host.onlineHomes;
  if (!homes?.transfer) return { ok: false, error: 'server' };
  const act = host.realmAct;
  if (!act || body.op !== 'accept') return homes.transfer(body);
  return act({ needsAnswer: true, call: (at) => homes.transfer({ ...body, realm: at }) });
}

/** The owner's door: who receives the house, for how much, and whether its furnishings and goods go with it. */
export function openHomeTransfer(mapId, buildingKey, host, say, refusal, giving = null) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc || !host?.onlineHomes) return false;
  if (giving) {
    ask(doc, 'An offer is already out.', () => ({}), async () => {
      const r = await send(host, { op: 'cancel', id: giving, mapId, buildingKey });
      say?.(r?.ok ? 'The offer is withdrawn.' : (refusal?.(r?.error) ?? 'It could not be withdrawn.'));
    });
    return true;
  }
  ask(doc, 'Transfer ownership', (box) => {
    const name = field(doc, 'Account', 'text');
    const price = field(doc, 'Price', 'number');
    price.input.value = '0';
    price.input.min = '0';
    const decor = field(doc, 'Keep decorations', 'checkbox');
    decor.input.checked = true;
    const goods = field(doc, 'Transfer all contents', 'checkbox');
    decor.input.addEventListener('change', () => { if (!decor.input.checked) goods.input.checked = false; });
    goods.input.addEventListener('change', () => { if (goods.input.checked) decor.input.checked = true; });
    box.append(name.row, price.row, decor.row, goods.row);
    return { name, price, decor, goods };
  }, async (bits) => {
    const keepDecor = bits.decor.input.checked;
    const keepItems = bits.goods.input.checked && keepDecor;
    const r = await send(host, {
      op: 'offer', mapId, buildingKey, to: bits.name.input.value.trim(),
      price: Number(bits.price.input.value), keepDecor, keepItems,
      character: host.decorCharacter?.() ?? null,
    });
    say?.(r?.ok ? 'The offer is out.' : (refusal?.(r?.error) ?? 'It could not be offered.'));
  });
  return true;
}

/** The account named on the offer: accept it, or decline it. */
export function answerHomeTransfer(mapId, buildingKey, home, accept, host, say, refusal) {
  const offer = home?.offer;
  if (!offer) return false;
  const word = accept
    ? (offer.price > 0 ? `Take this house for ${offer.price} gold?` : 'Take this house?')
    : 'Decline this house?';
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return false;
  ask(doc, word, () => ({}), async () => {
    const r = await send(host, { op: accept ? 'accept' : 'decline', id: offer.id, mapId, buildingKey, character: host.decorCharacter?.() ?? null });
    say?.(r?.ok ? (accept ? 'The house is yours.' : 'The offer is declined.') : (refusal?.(r?.error) ?? 'It could not be answered.'));
  });
  return true;
}
