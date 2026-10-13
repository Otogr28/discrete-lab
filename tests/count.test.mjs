// Counting formulas against enumeration; probability against exact counts.
import test from "node:test";
import assert from "node:assert/strict";
import CT from "../js/count.js";

const {F} = CT;

test("fractions reduce and do arithmetic exactly", () => {
  assert.equal(F(6, 36).toString(), "1/6");
  assert.equal(F(1, 6).add(F(1, 3)).toString(), "1/2");
  assert.equal(F(1, 2).mul(F(2, 3)).toString(), "1/3");
  assert.equal(F(1, 2).div(F(1, 4)).toString(), "2");
  assert.equal(F(3, -9).toString(), "-1/3");
  assert.ok(F(2, 4).eq(F(1, 2)));
});

test("every cell of the counting table equals its enumeration", () => {
  for (let n = 0; n <= 6; n++) for (let k = 0; k <= 5; k++)
    for (const order of [true, false]) for (const rep of [true, false]) {
      const list = CT.enumerate(n, k, order, rep);
      assert.equal(list.length, CT.countFormula(n, k, order, rep), `n=${n} k=${k} order=${order} rep=${rep}`);
      const keys = new Set(list.map(x => x.join(",")));
      assert.equal(keys.size, list.length, "no duplicates");
      for (const x of list) {
        assert.equal(x.length, k);
        if (!rep) assert.equal(new Set(x).size, k);
        if (!order) assert.deepEqual(x, x.slice().sort((a, b) => a - b));
      }
    }
});

test("P(n,k) = C(n,k) k! and the binomial theorem's row sums", () => {
  for (let n = 0; n <= 12; n++) {
    let row = 0;
    for (let k = 0; k <= n; k++) {
      assert.equal(CT.P(n, k), CT.C(n, k) * CT.fact(k));
      if (k > 0 && k < n) assert.equal(CT.C(n, k), CT.C(n - 1, k - 1) + CT.C(n - 1, k));
      row += CT.C(n, k);
    }
    assert.equal(row, 2 ** n);
  }
  assert.equal(CT.C(5, 7), 0);
});

test("Fact 6.9 counts MISSISSIPPI the way the book does", () => {
  assert.equal(CT.multinomial([1, 4, 4, 2]), 34650);
});

test("star-and-bar strings have k stars and n-1 bars (Fact 6.8)", () => {
  for (let n = 1; n <= 5; n++) for (let k = 0; k <= 5; k++) {
    const list = CT.enumerate(n, k, false, true);
    const strings = new Set();
    for (const ms of list) {
      const counts = new Array(n).fill(0);
      ms.forEach(x => counts[x]++);
      const s = CT.starsBars(counts);
      assert.equal(s.length, k + n - 1);
      assert.equal([...s].filter(c => c === "|").length, n - 1);
      strings.add(s);
    }
    assert.equal(strings.size, CT.C(k + n - 1, n - 1));
  }
});

test("inclusion-exclusion agrees with adding up the regions (Fact 6.7)", () => {
  let seed = 7;
  const r = () => (seed = (seed * 16807) % 2147483647) % 10;
  for (let t = 0; t < 200; t++) {
    for (const sets of [2, 3]) {
      const regions = {};
      for (let m = 1; m < (1 << sets); m++) regions[m] = r();
      const v = CT.venn(regions, sets);
      assert.equal(v.formula, v.direct);
    }
  }
});

test("dice probabilities: conditional, independence, exclusivity", () => {
  const ev = (f) => new Set(CT.DICE.filter(([w, b]) => f(w, b)).map(([w, b]) => CT.dk(w, b)));
  const sum7 = ev((w, b) => w + b === 7), w6 = ev((w) => w === 6), atLeast6 = ev((w, b) => w === 6 || b === 6);
  let p = CT.probs(sum7, w6);
  assert.equal(p.pA.toString(), "1/6");
  assert.equal(p.pAgivenB.toString(), "1/6");
  assert.ok(p.independent);
  p = CT.probs(atLeast6, w6);
  assert.equal(p.pA.toString(), "11/36");      // the book's Example 7.1
  assert.equal(p.pAgivenB.toString(), "1");
  assert.ok(!p.independent);
  const sum2 = ev((w, b) => w + b === 2), sum12 = ev((w, b) => w + b === 12);
  p = CT.probs(sum2, sum12);
  assert.ok(p.exclusive && !p.independent);
  // Fact 7.3 identity on every pair of these events
  for (const A of [sum7, w6, atLeast6, sum2]) for (const B of [sum7, w6, atLeast6, sum12]) {
    const q = CT.probs(A, B);
    if (q.pAgivenB) assert.ok(q.pAB.eq(q.pAgivenB.mul(q.pB)));
  }
});

test("Bayes (Fact 7.4) agrees with counting a population", () => {
  // 1000 people, 10 have it; test catches 9 of them; 99 of the 990 healthy test positive
  const b = CT.bayes(F(1, 100), F(9, 10), F(1, 10));
  assert.equal(b.pE.toString(), F(9 + 99, 1000).toString());
  assert.equal(b.post1.toString(), F(9, 108).toString());
  assert.ok(b.post1.add(b.post2).eq(1));
  const nb = CT.bayes(0.01, 0.9, 0.1);
  assert.ok(Math.abs(nb.post1 - 9 / 108) < 1e-12);
});

test("expected value of a fair die is 7/2", () => {
  const die = [1, 2, 3, 4, 5, 6].map(x => ({x, p: F(1, 6)}));
  assert.equal(CT.expectation(die).toString(), "7/2");
});
