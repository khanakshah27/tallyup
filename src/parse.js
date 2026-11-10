/* Turns OCR text from a restaurant bill into items and extra charges. Amounts are integer minor units (cents/paise). */
(function (root) {
  "use strict";

  const PRICE_END = /(?:[₹$€£]|rs\.?|inr)?\s*(\d{1,3}(?:,\d{3})*\.\d{2}|\d+[.,]\d{2}|\d{1,6})\s*[A-Za-z]?$/i;
  const EXTRA_WORDS = [
    ["total", /\b(grand\s*total|total\s*(amount|due|payable)?|amount\s*due|net\s*payable|balance\s*due)\b/i],
    ["subtotal", /\b(sub\s*-?\s*total|food\s*total|items?\s*total)\b/i],
    ["tip", /\b(tip|gratuity)\b/i],
    ["service", /\b(service\s*(charge|fee)?|sc)\b/i],
    ["tax", /\b(tax|gst|cgst|sgst|igst|vat|sales\s*tax|cess)\b/i],
    ["discount", /\b(discount|promo|coupon|offer|savings?)\b/i],
    ["round", /\b(round\s*-?\s*off|rounding|roundoff)\b/i],
  ];
  const IGNORE = /\b(invoice|bill\s*no|table|date|time|cashier|server|order|gstin|phone|tel|thank|visit|card|cash|change|upi|paid|qty|rate|amount\s*$)\b/i;

  function toCents(raw) {
    let s = String(raw).trim();
    if (/^\d{1,3}(,\d{3})+(\.\d{2})?$/.test(s)) s = s.replace(/,/g, "");       // 1,250.00
    else if (/^\d+,\d{2}$/.test(s)) s = s.replace(",", ".");                    // 12,50
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
  }

  function parseReceipt(text) {
    const items = [];
    const extras = { subtotal: 0, tax: 0, service: 0, tip: 0, discount: 0, round: 0, total: 0 };
    const lines = String(text || "").split(/\r?\n/).map((l) => l.replace(/[|_]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);

    for (const line of lines) {
      const m = PRICE_END.exec(line);
      if (!m) continue;
      const hasDecimal = /[.,]\d{2}$/.test(m[1]);
      let label = line.slice(0, m.index).replace(/[.:\-–—=*]+$/g, "").replace(/(?:[₹$€£]|rs\.?|inr)\s*$/i, "").trim();
      const cents = toCents(m[1]);
      if (!Number.isFinite(cents)) continue;

      const kind = EXTRA_WORDS.find(([, re]) => re.test(label));
      if (kind) {
        const k = kind[0];
        // "GST 5%  45.00": the percent is not the amount, so take the last decimal number on the line
        const decimals = line.match(/\d{1,3}(?:,\d{3})*\.\d{2}|\d+,\d{2}/g);
        const amount = decimals ? toCents(decimals[decimals.length - 1]) : cents;
        extras[k] += amount;
        continue;
      }
      if (!label || label.length < 2 || IGNORE.test(label) || /^[\d\s./:-]+$/.test(label)) continue;
      if (!hasDecimal && cents < 1000 && !/\d\s*x\s*/i.test(label)) {
        // whole-number prices are common on Indian bills, but a bare small number is more often a quantity or table no.
        if (cents < 100) continue;
      }

      let qty = 1;
      const q = /^(\d{1,2})\s*(?:x|×|\*)?\s+(.+)$/i.exec(label);
      if (q && Number(q[1]) > 0 && Number(q[1]) < 30) { qty = Number(q[1]); label = q[2]; }
      label = label.replace(/\s+\d+\s*(?:x|×)\s*$/i, "").trim();
      if (!label) continue;
      items.push({ name: label, price: cents, qty });
    }
    return { items, extras };
  }

  const api = { parseReceipt, toCents };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TallyUp = Object.assign(root.TallyUp || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this);
