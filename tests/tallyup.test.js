const test = require("node:test");
const assert = require("node:assert");
const { parseReceipt, toCents } = require("../src/parse.js");
const { allocate, computeSplit } = require("../src/split.js");

test("toCents handles thousands, comma decimals and plain numbers", () => {
  assert.strictEqual(toCents("1,250.00"), 125000);
  assert.strictEqual(toCents("12,50"), 1250);
  assert.strictEqual(toCents("340"), 34000);
});

test("parses items, quantities and extra charges from a bill", () => {
  const text = [
    "THE GOOD TABLE",
    "Table 12   Date 04/11/2026",
    "2 x Masala Dosa     180.00",
    "Filter Coffee 60.00",
    "Paneer Tikka .... 320.00",
    "Subtotal 560.00",
    "CGST 2.5%  14.00",
    "SGST 2.5%  14.00",
    "Service Charge 56.00",
    "Total 644.00",
  ].join("\n");
  const { items, extras } = parseReceipt(text);
  assert.deepStrictEqual(items.map((i) => [i.name, i.qty, i.price]), [
    ["Masala Dosa", 2, 18000], ["Filter Coffee", 1, 6000], ["Paneer Tikka", 1, 32000],
  ]);
  assert.strictEqual(extras.tax, 2800);
  assert.strictEqual(extras.service, 5600);
  assert.strictEqual(extras.subtotal, 56000);
  assert.strictEqual(extras.total, 64400);
});

test("ignores header and footer lines", () => {
  const { items } = parseReceipt("Invoice No 1234\nCashier 4\nBurger 9.50\nThank you visit again 2");
  assert.deepStrictEqual(items.map((i) => i.name), ["Burger"]);
});

test("allocate never loses a cent", () => {
  const out = allocate(100, { a: 1, b: 1, c: 1 });
  assert.strictEqual(out.a + out.b + out.c, 100);
  assert.deepStrictEqual(Object.values(out).sort(), [33, 33, 34]);
});

test("allocate supports negative amounts and zero weights", () => {
  const neg = allocate(-100, { a: 1, b: 1, c: 1 });
  assert.strictEqual(neg.a + neg.b + neg.c, -100);
  const zero = allocate(10, { a: 0, b: 0 });
  assert.strictEqual(zero.a + zero.b, 10);
});

const people = [{ id: "a", name: "Asha" }, { id: "b", name: "Ben" }, { id: "c", name: "Chen" }];

test("shared items split evenly and extras follow what each person ate", () => {
  const items = [
    { id: 1, name: "Pizza", price: 3000, qty: 1, people: ["a", "b", "c"] },
    { id: 2, name: "Steak", price: 4000, qty: 1, people: ["a"] },
    { id: 3, name: "Salad", price: 1000, qty: 1, people: ["b"] },
  ];
  const r = computeSplit({ items, people, charges: { tax: 800, tip: 0, service: 0, discount: 0 } });
  const by = Object.fromEntries(r.people.map((p) => [p.id, p]));
  assert.strictEqual(by.a.food, 5000);
  assert.strictEqual(by.b.food, 2000);
  assert.strictEqual(by.c.food, 1000);
  assert.strictEqual(by.a.extras, 500);
  assert.strictEqual(r.assignedTotal, r.grandTotal);
  assert.strictEqual(r.grandTotal, 8800);
  assert.strictEqual(r.unassigned.length, 0);
});

test("totals still match with odd amounts and a discount", () => {
  const items = [
    { id: 1, name: "A", price: 1001, qty: 1, people: ["a", "b"] },
    { id: 2, name: "B", price: 777, qty: 1, people: ["b", "c"] },
    { id: 3, name: "C", price: 333, qty: 1, people: ["a", "b", "c"] },
  ];
  const r = computeSplit({ items, people, charges: { tax: 191, service: 99, tip: 250, discount: 120 } });
  assert.strictEqual(r.assignedTotal, r.grandTotal);
});

test("reports unassigned items", () => {
  const r = computeSplit({ items: [{ id: 1, name: "Ghost", price: 500, qty: 1, people: [] }], people });
  assert.strictEqual(r.unassigned.length, 1);
});
