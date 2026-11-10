(function () {
  "use strict";
  const { parseReceipt, computeSplit } = globalThis.TallyUp;
  const $ = (id) => document.getElementById(id);
  const state = { items: [], people: [], seq: 1 };
  let currency = "₹";

  const money = (c) => currency + (c / 100).toFixed(2);
  const num = (s) => { const n = parseFloat(String(s).replace(/,/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
  const uid = () => "i" + state.seq++;
  const el = (tag, props = {}, ...kids) => {
    const n = Object.assign(document.createElement(tag), props);
    kids.forEach((k) => n.append(k));
    return n;
  };

  // ---------- OCR ----------
  async function readImage(file) {
    $("preview").src = URL.createObjectURL(file);
    $("preview").hidden = false;
    $("dropText").hidden = true;
    $("ocr").hidden = false;
    $("ocrText").textContent = "Reading the receipt…";
    $("bar").style.width = "4%";
    if (!globalThis.Tesseract) {
      $("ocrText").textContent = "The reader could not load (are you offline?). Add the items by hand below.";
      return;
    }
    try {
      const blob = await downscale(file, 1800);
      const { data } = await Tesseract.recognize(blob, "eng", {
        logger: (m) => { if (m.status === "recognizing text") $("bar").style.width = Math.round(10 + m.progress * 90) + "%"; },
      });
      const parsed = parseReceipt(data.text);
      if (/[$]/.test(data.text) && !/[₹]|rs\.?/i.test(data.text)) setCurrency("$");
      state.items = parsed.items.map((i) => ({ id: uid(), name: i.name, price: i.price, qty: i.qty, people: [] }));
      ["tax", "service", "tip", "discount"].forEach((k) => { if (parsed.extras[k]) $(k).value = (parsed.extras[k] / 100).toFixed(2); });
      $("ocrText").textContent = state.items.length
        ? "Found " + state.items.length + " items. Check them below and fix anything the reader got wrong."
        : "Could not find any items in that photo. Try a clearer, straighter shot, or add them by hand.";
      $("bar").style.width = "100%";
      render();
    } catch (e) {
      $("ocrText").textContent = "Something went wrong reading that image. Add the items by hand below.";
    }
  }

  function downscale(file, max) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const g = c.getContext("2d");
        g.filter = "grayscale(1) contrast(1.25)";
        g.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => resolve(b || file), "image/png");
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  }

  // ---------- rendering ----------
  function renderItems() {
    const box = $("items");
    box.replaceChildren();
    state.items.forEach((it) => {
      const name = el("input", { value: it.name + (it.qty > 1 ? "" : ""), placeholder: "Item name", ariaLabel: "Item name" });
      name.oninput = () => { it.name = name.value; renderAssign(); renderResult(); };
      const price = el("input", { value: (it.price / 100).toFixed(2), inputMode: "decimal", ariaLabel: "Price" });
      price.onchange = () => { it.price = num(price.value); price.value = (it.price / 100).toFixed(2); renderAssign(); renderResult(); };
      const rm = el("button", { className: "x", textContent: "×", title: "Remove", ariaLabel: "Remove item" });
      rm.onclick = () => { state.items = state.items.filter((x) => x !== it); render(); };
      box.append(el("div", { className: "item" }, name, price, rm));
    });
  }

  function renderPeople() {
    const box = $("people");
    box.replaceChildren();
    state.people.forEach((p) => {
      const rm = el("button", { textContent: "×", ariaLabel: "Remove " + p.name });
      rm.onclick = () => { state.people = state.people.filter((x) => x !== p); state.items.forEach((i) => (i.people = i.people.filter((id) => id !== p.id))); render(); };
      box.append(el("span", { className: "chip" }, p.name, rm));
    });
  }

  function renderAssign() {
    const box = $("assign");
    box.replaceChildren();
    const ready = state.items.length && state.people.length;
    $("assignHint").hidden = !!ready;
    $("everyone").hidden = !ready;
    if (!ready) return;
    state.items.forEach((it) => {
      const pick = el("div", { className: "pick" });
      state.people.forEach((p) => {
        const b = el("button", { type: "button", textContent: p.name, className: it.people.includes(p.id) ? "on" : "" });
        b.setAttribute("aria-pressed", it.people.includes(p.id));
        b.onclick = () => {
          it.people = it.people.includes(p.id) ? it.people.filter((x) => x !== p.id) : [...it.people, p.id];
          renderAssign(); renderResult();
        };
        pick.append(b);
      });
      box.append(el("div", { className: "as" }, el("div", { className: "t" }, el("span", { textContent: it.name || "Untitled item" }), el("span", { textContent: money(it.price) })), pick));
    });
  }

  function charges() { return { tax: num($("tax").value), service: num($("service").value), tip: num($("tip").value), discount: num($("discount").value) }; }

  function compute() { return computeSplit({ items: state.items, people: state.people, charges: charges() }); }

  function renderResult() {
    const r = compute();
    const box = $("result");
    box.replaceChildren();
    r.people.forEach((p) => {
      const ul = el("ul");
      p.lines.forEach((l) => ul.append(el("li", {}, el("span", { textContent: l.name + (l.shared ? " (shared)" : "") }), el("span", { textContent: money(l.share) }))));
      if (p.extras) ul.append(el("li", {}, el("span", { textContent: "Tax, service and tip" }), el("span", { textContent: money(p.extras) })));
      box.append(el("div", { className: "person" }, el("div", { className: "h" }, el("b", { textContent: p.name }), el("span", { className: "amt", textContent: money(p.total) })), ul));
    });
    if (!r.people.length) box.append(el("p", { className: "hint", textContent: "Add people to see who owes what." }));
    $("grand").textContent = money(r.grandTotal);
    const warn = $("warn");
    warn.hidden = !r.unassigned.length || !r.people.length;
    warn.textContent = r.unassigned.length
      ? r.unassigned.length + " item" + (r.unassigned.length > 1 ? "s are" : " is") + " not assigned to anyone yet (" + money(r.unassigned.reduce((a, i) => a + i.price, 0)) + "): " + r.unassigned.map((i) => i.name).join(", ")
      : "";
  }

  function render() { renderItems(); renderPeople(); renderAssign(); renderResult(); }

  function setCurrency(c) { currency = c; $("cur").value = c; render(); }

  function summaryText() {
    const r = compute();
    const lines = ["Bill split (total " + money(r.grandTotal) + ")"];
    r.people.forEach((p) => lines.push(p.name + ": " + money(p.total)));
    if (r.unassigned.length) lines.push("Not yet assigned: " + r.unassigned.map((i) => i.name).join(", "));
    return lines.join("\n");
  }

  // ---------- events ----------
  $("file").onchange = (e) => e.target.files[0] && readImage(e.target.files[0]);
  $("addItem").onclick = () => { state.items.push({ id: uid(), name: "", price: 0, qty: 1, people: [] }); render(); const ins = $("items").querySelectorAll("input"); ins[ins.length - 2].focus(); };
  $("personForm").onsubmit = (e) => {
    e.preventDefault();
    const name = $("personName").value.trim();
    if (!name) return;
    state.people.push({ id: "p" + state.seq++, name });
    $("personName").value = "";
    render();
  };
  $("everyone").onclick = () => { state.items.forEach((i) => { if (!i.people.length) i.people = state.people.map((p) => p.id); }); render(); };
  ["tax", "service", "tip", "discount"].forEach((k) => ($(k).oninput = renderResult));
  $("cur").onchange = () => setCurrency($("cur").value);
  $("copy").onclick = async () => {
    try { await navigator.clipboard.writeText(summaryText()); $("copy").textContent = "Copied"; } catch { $("copy").textContent = "Copy failed"; }
    setTimeout(() => ($("copy").textContent = "Copy summary"), 1500);
  };
  if (navigator.share) { $("share").hidden = false; $("share").onclick = () => navigator.share({ text: summaryText() }).catch(() => {}); }

  render();
})();
