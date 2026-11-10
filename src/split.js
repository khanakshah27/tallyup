/* Works out who owes what. All amounts are integers (minor units), and the shares always add up to the exact total. */
(function (root) {
  "use strict";

  // Split `amount` across keys in proportion to `weights`, using the largest-remainder method so nothing is lost to rounding.
  function allocate(amount, weights) {
    const keys = Object.keys(weights);
    const out = {};
    keys.forEach((k) => (out[k] = 0));
    const sum = keys.reduce((a, k) => a + weights[k], 0);
    if (!keys.length) return out;
    if (sum <= 0) { // nobody has anything yet: share equally
      keys.forEach((k) => (weights[k] = 1));
      return allocate(amount, weights);
    }
    const sign = amount < 0 ? -1 : 1, abs = Math.abs(amount);
    const raw = keys.map((k) => ({ k, exact: (abs * weights[k]) / sum }));
    raw.forEach((r) => { out[r.k] = Math.floor(r.exact); });
    let left = abs - raw.reduce((a, r) => a + out[r.k], 0);
    raw.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)) || (a.k < b.k ? -1 : 1));
    for (let i = 0; left > 0; i = (i + 1) % raw.length, left--) out[raw[i].k] += 1;
    keys.forEach((k) => (out[k] *= sign));
    return out;
  }

  /**
   * items:   [{ id, name, price, qty, people: [personId, ...] }]  (price is the line total)
   * people:  [{ id, name }]
   * charges: { tax, service, discount, tip }  (discount is a positive number that is subtracted)
   */
  function computeSplit({ items, people, charges = {} }) {
    const result = {};
    people.forEach((p) => { result[p.id] = { id: p.id, name: p.name, lines: [], food: 0, extras: 0, total: 0 }; });
    const unassigned = [];

    for (const it of items) {
      const who = (it.people || []).filter((id) => result[id]);
      if (!who.length) { unassigned.push(it); continue; }
      const shares = allocate(it.price, Object.fromEntries(who.map((id) => [id, 1])));
      who.forEach((id) => {
        result[id].lines.push({ name: it.name, share: shares[id], shared: who.length > 1 });
        result[id].food += shares[id];
      });
    }

    const foodWeights = Object.fromEntries(people.map((p) => [p.id, result[p.id].food]));
    const extraTotal = (charges.tax || 0) + (charges.service || 0) + (charges.tip || 0) - (charges.discount || 0);
    const extraShares = people.length ? allocate(extraTotal, { ...foodWeights }) : {};
    people.forEach((p) => {
      result[p.id].extras = extraShares[p.id] || 0;
      result[p.id].total = result[p.id].food + result[p.id].extras;
    });

    const itemsTotal = items.reduce((a, i) => a + i.price, 0);
    return {
      people: people.map((p) => result[p.id]),
      unassigned,
      grandTotal: itemsTotal + extraTotal,
      assignedTotal: people.reduce((a, p) => a + result[p.id].total, 0),
    };
  }

  const api = { allocate, computeSplit };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TallyUp = Object.assign(root.TallyUp || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
