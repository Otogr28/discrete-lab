"use strict";
/* ===========================================================================
   Counting and probability arithmetic: exact fractions, the four counting
   formulas of Chapter 6, and the enumerations the Counting lab lists next to
   them. Pure, like graph.js, so tests/ checks every formula against an
   honest enumeration.
   =========================================================================== */
(function (root) {

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };

/* A fraction p/q in lowest terms with q > 0. Small integers only, which is
   all a two-dice grid or a tree diagram ever needs. */
class Frac {
  constructor(p, q = 1) {
    if (q === 0) throw new Error("zero denominator");
    if (q < 0) { p = -p; q = -q; }
    const g = gcd(p, q) || 1;
    this.p = p / g; this.q = q / g;
  }
  add(o) { o = F(o); return new Frac(this.p * o.q + o.p * this.q, this.q * o.q); }
  sub(o) { o = F(o); return new Frac(this.p * o.q - o.p * this.q, this.q * o.q); }
  mul(o) { o = F(o); return new Frac(this.p * o.p, this.q * o.q); }
  div(o) { o = F(o); return new Frac(this.p * o.q, this.q * o.p); }
  eq(o) { o = F(o); return this.p === o.p && this.q === o.q; }
  get value() { return this.p / this.q; }
  toString() { return this.q === 1 ? String(this.p) : this.p + "/" + this.q; }
  tex() { return this.q === 1 ? String(this.p) : `\\tfrac{${this.p}}{${this.q}}`; }
}
const F = (x, q) => x instanceof Frac ? x : new Frac(x, q === undefined ? 1 : q);

/* ============================================================ the formulas */
function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
/* Fact 6.4 */
function P(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 0; i < k; i++) r *= n - i; return r; }
/* Fact 6.5 (and 0 outside 0 <= k <= n) */
function C(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
  return Math.round(r);
}
/* Fact 6.8: k-element multisets from an n-element set */
const multisets = (n, k) => n === 0 ? (k === 0 ? 1 : 0) : C(k + n - 1, k);
/* Fact 6.9: permutations of a multiset with multiplicities ps */
function multinomial(ps) {
  const n = ps.reduce((a, b) => a + b, 0);
  return ps.reduce((r, p) => r / fact(p), fact(n));
}

/* The four cells of the counting table. `order` = order matters,
   `rep` = repetition allowed. */
function countFormula(n, k, order, rep) {
  if (order && rep) return Math.pow(n, k);
  if (order && !rep) return P(n, k);
  if (!order && !rep) return C(n, k);
  return multisets(n, k);
}

/* Every outcome, as arrays of indices into the n-element set. Lists come in
   lexicographic order; for unordered cells each outcome is sorted. */
function enumerate(n, k, order, rep, cap) {
  cap = cap || Infinity;
  const out = [], cur = [];
  const used = new Array(n).fill(false);
  (function go(start) {
    if (out.length >= cap) return;
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let x = order ? 0 : start; x < n; x++) {
      if (!rep && used[x]) continue;
      used[x] = true; cur.push(x);
      go(rep ? x : x + 1);
      cur.pop(); used[x] = false;
      if (out.length >= cap) return;
    }
  })(0);
  return out;
}

/* Star-and-bar string of a multiset given by its counts (Fact 6.8). */
const starsBars = (counts) => counts.map(c => "*".repeat(c)).join("|");

/* ================================================== inclusion-exclusion */
/* regions: counts of the 2^k - 1 Venn regions keyed by bitmask (1 = A,
   2 = B, 4 = C). Returns |A|, |B|, ... intersections, union, both ways. */
function venn(regions, sets) {
  const masks = [];
  for (let m = 1; m < (1 << sets); m++) masks.push(m);
  const size = (want) => masks.filter(m => (m & want) === want)
                              .reduce((a, m) => a + (regions[m] || 0), 0);
  const terms = masks.map(m => {
    let bits = 0; for (let b = 0; b < sets; b++) if (m & (1 << b)) bits++;
    return {mask: m, bits, sign: bits % 2 ? 1 : -1, size: size(m)};
  }).sort((a, b) => a.bits - b.bits || a.mask - b.mask);
  const formula = terms.reduce((a, t) => a + t.sign * t.size, 0);
  const direct = masks.reduce((a, m) => a + (regions[m] || 0), 0);
  return {terms, formula, direct};
}

/* ============================================================ probability */
/* Two dice, outcomes (w, b) with w, b in 1..6. An event is a Set of
   "w,b" strings. */
const DICE = [];
for (let w = 1; w <= 6; w++) for (let b = 1; b <= 6; b++) DICE.push([w, b]);
const dk = (w, b) => w + "," + b;

function probs(A, B) {
  const S = 36;
  let a = 0, b = 0, ab = 0;
  for (const [w, x] of DICE) {
    const inA = A.has(dk(w, x)), inB = B.has(dk(w, x));
    if (inA) a++; if (inB) b++; if (inA && inB) ab++;
  }
  const pA = F(a, S), pB = F(b, S), pAB = F(ab, S);
  return {a, b, ab, S, pA, pB, pAB,
    pAgivenB: b ? F(ab, b) : null,
    pBgivenA: a ? F(ab, a) : null,
    independent: pAB.eq(pA.mul(pB)),
    exclusive: ab === 0};
}

/* Fact 7.4, Bayes with two parts S1, S2 = complement of S1. Arguments are
   Frac or numbers in [0, 1]. */
function bayes(pS1, pEgS1, pEgS2) {
  const num = typeof pS1 === "number";
  const one = num ? 1 : F(1);
  const mul = (x, y) => num ? x * y : F(x).mul(y);
  const add = (x, y) => num ? x + y : F(x).add(y);
  const sub = (x, y) => num ? x - y : F(x).sub(y);
  const div = (x, y) => num ? x / y : F(x).div(y);
  const pS2 = sub(one, pS1);
  const a = mul(pS1, pEgS1), b = mul(pS2, pEgS2);
  const pE = add(a, b);
  return {pS2, joint1: a, joint2: b, pE,
    post1: (num ? pE === 0 : pE.p === 0) ? null : div(a, pE),
    post2: (num ? pE === 0 : pE.p === 0) ? null : div(b, pE)};
}

/* Expected value of a finite distribution [{x, p}] with Frac p. */
function expectation(dist) {
  return dist.reduce((s, {x, p}) => s.add(F(x).mul(p)), F(0));
}

const CT = {gcd, Frac, F, fact, P, C, multisets, multinomial, countFormula,
  enumerate, starsBars, venn, DICE, dk, probs, bayes, expectation};

if (typeof module !== "undefined" && module.exports) module.exports = CT;
else root.CT = CT;
})(typeof window !== "undefined" ? window : globalThis);
