// Every graph verdict the site shows, checked against brute force on many
// small random graphs. Run with: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import GA from "../js/graph.js";

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function randomGraph(r, n, p) {
  const e = [];
  for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (r() < p) e.push([u, v]);
  return e;
}
const edgeSet = (edges) => new Set(edges.map(([u, v]) => GA.key(u, v)));

// ---------------------------------------------------------------- basics
test("handshake: sum of degrees is twice the edges (Prop 16.1, 16.2)", () => {
  const r = rng(1);
  for (let t = 0; t < 300; t++) {
    const n = 1 + Math.floor(r() * 9), e = randomGraph(r, n, r());
    const d = GA.degrees(n, e);
    assert.equal(d.reduce((a, b) => a + b, 0), 2 * e.length);
    assert.equal(d.filter(x => x % 2).length % 2, 0);
  }
});

test("complement has every missing pair and nothing else", () => {
  const r = rng(2);
  for (let t = 0; t < 100; t++) {
    const n = 1 + Math.floor(r() * 8), e = randomGraph(r, n, r());
    const c = GA.complement(n, e);
    assert.equal(e.length + c.length, n * (n - 1) / 2);
    const s = edgeSet(e);
    for (const [u, v] of c) assert.ok(!s.has(GA.key(u, v)));
  }
});

// ------------------------------------------------------------- bipartite
function brute2col(n, edges) {
  for (let mask = 0; mask < (1 << n); mask++)
    if (edges.every(([u, v]) => ((mask >> u) & 1) !== ((mask >> v) & 1))) return true;
  return false;
}
test("bipartite matches brute force; odd cycle is a real odd cycle (Thm 16.1)", () => {
  const r = rng(3);
  for (let t = 0; t < 500; t++) {
    const n = 1 + Math.floor(r() * 9), e = randomGraph(r, n, r() * 0.6);
    const b = GA.bipartite(n, e);
    assert.equal(b.ok, brute2col(n, e));
    const s = edgeSet(e);
    if (b.ok) {
      for (const [u, v] of e) assert.notEqual(b.side[u], b.side[v]);
    } else {
      const c = b.cycle;
      assert.equal(c.length % 2, 1, "cycle length is odd");
      assert.equal(new Set(c).size, c.length, "no repeated vertex");
      for (let i = 0; i < c.length; i++)
        assert.ok(s.has(GA.key(c[i], c[(i + 1) % c.length])), "cycle edge exists");
    }
  }
});

// ----------------------------------------------------------------- euler
function bruteEuler(n, edges, closed) {
  const m = edges.length;
  if (!m) return false;
  const used = new Array(m).fill(false);
  function go(x, k, s) {
    if (k === m) return !closed || x === s;
    for (let i = 0; i < m; i++) {
      if (used[i]) continue;
      const [u, v] = edges[i];
      if (u !== x && v !== x) continue;
      used[i] = true;
      if (go(u === x ? v : u, k + 1, s)) return true;
      used[i] = false;
    }
    return false;
  }
  for (let s = 0; s < n; s++) if (go(s, 0, s)) return true;
  return false;
}
test("Euler verdict matches exhaustive search (KT Thm 5.13)", () => {
  const r = rng(4);
  for (let t = 0; t < 400; t++) {
    const n = 2 + Math.floor(r() * 6);
    let e = randomGraph(r, n, 0.3 + r() * 0.5);
    if (e.length > 11) e = e.slice(0, 11);
    const v = GA.eulerVerdict(n, e);
    const circ = bruteEuler(n, e, true), trail = bruteEuler(n, e, false);
    assert.equal(v.type === "circuit", circ);
    assert.equal(v.type === "trail", trail && !circ);
    if (v.type === "circuit") {
      const f = GA.eulerFinder(n, e);
      assert.ok(f.ok);
      assert.ok(GA.isEulerWalk(n, e, f.circuit, true));
    }
    if (v.type !== "none") {
      const tr = GA.eulerTrail(n, e);
      assert.ok(GA.isEulerWalk(n, e, tr, v.type === "circuit"));
      if (v.type === "trail") assert.deepEqual([tr[0], tr[tr.length - 1]].sort(), v.odd.slice().sort());
    }
  }
});

test("Algorithm 5.14 reproduces the book's worked example (KT Fig 5.15)", () => {
  // Edges read off the example's final circuit, vertices 1..11 -> 0..10.
  const one = [[1,2],[2,4],[4,3],[3,1],[2,5],[5,8],[8,2],[4,6],[6,7],[7,4],
               [4,9],[9,6],[6,10],[10,4],[7,9],[9,11],[11,7]];
  const e = one.map(([u, v]) => [u - 1, v - 1]);
  const f = GA.eulerFinder(11, e);
  assert.ok(f.ok);
  const circuits = f.steps.map(s => s.circuit.map(x => x + 1).join(","));
  assert.deepEqual(circuits, [
    "1",
    "1,2,4,3,1",
    "1,2,5,8,2,4,3,1",
    "1,2,5,8,2,4,6,7,4,9,6,10,4,3,1",
    "1,2,5,8,2,4,6,7,9,11,7,4,9,6,10,4,3,1",
  ]);
});

test("Algorithm 5.14 reports an odd vertex or a disconnection when it fails", () => {
  const r = rng(5);
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(r() * 7), e = randomGraph(r, n, r());
    if (!e.length) continue;
    const f = GA.eulerFinder(n, e), v = GA.eulerVerdict(n, e);
    assert.equal(f.ok, v.type === "circuit");
    if (!f.ok && f.why === "odd") assert.ok(v.odd.includes(f.vertex));
    if (!f.ok && f.why === "disconnected") assert.ok(!v.connected);
  }
});

// -------------------------------------------------------------- hamilton
function* perms(a) {
  if (a.length <= 1) { yield a; return; }
  for (let i = 0; i < a.length; i++)
    for (const p of perms(a.slice(0, i).concat(a.slice(i + 1)))) yield [a[i], ...p];
}
function bruteHam(n, edges, cycle) {
  const s = edgeSet(edges);
  for (const p of perms([...Array(n).keys()])) {
    let ok = true;
    for (let i = 0; i + 1 < n && ok; i++) ok = s.has(GA.key(p[i], p[i + 1]));
    if (ok && cycle) ok = n >= 3 && s.has(GA.key(p[n - 1], p[0]));
    if (ok) return true;
  }
  return false;
}
test("Hamilton search matches brute force over all orderings", () => {
  const r = rng(6);
  for (let t = 0; t < 300; t++) {
    const n = 1 + Math.floor(r() * 7), e = randomGraph(r, n, r());
    for (const cyc of [true, false]) {
      const h = GA.hamilton(n, e, cyc);
      assert.equal(h.found, bruteHam(n, e, cyc));
      if (h.found) {
        const s = edgeSet(e);
        assert.equal(new Set(h.path).size, n);
        for (let i = 0; i + 1 < n; i++) assert.ok(s.has(GA.key(h.path[i], h.path[i + 1])));
        if (cyc) assert.ok(s.has(GA.key(h.path[n - 1], h.path[0])));
      }
    }
  }
});

test("Ore and Dirac are sufficient: whenever they hold, a Hamilton cycle exists", () => {
  const r = rng(7);
  for (let t = 0; t < 400; t++) {
    const n = 3 + Math.floor(r() * 5), e = randomGraph(r, n, 0.5 + r() * 0.5);
    if (GA.ore(n, e).holds || GA.dirac(n, e).holds) assert.ok(bruteHam(n, e, true));
  }
  // the counterexample direction the page shows: C_6 is Hamiltonian, Ore fails
  const c6 = GA.families.C(6);
  assert.ok(!GA.ore(6, c6.edges).holds);
  assert.ok(GA.hamilton(6, c6.edges, true).found);
  // Petersen is not Hamiltonian (KT Fig 5.18)
  const pg = GA.families.petersen();
  assert.equal(GA.hamilton(10, pg.edges, true).found, false);
  // Q_n is Hamiltonian (Thm 16.3) and every vertex has degree n
  for (const d of [2, 3, 4]) {
    const q = GA.families.Q(d);
    assert.ok(GA.hamilton(q.n, q.edges, true).found);
    assert.ok(GA.degrees(q.n, q.edges).every(x => x === d));
  }
});

// ----------------------------------------------------------------- trees
test("forest iff edges = n - c (Cor 16.1); cycles found are real", () => {
  const r = rng(8);
  for (let t = 0; t < 500; t++) {
    const n = 1 + Math.floor(r() * 9), e = randomGraph(r, n, r() * 0.5);
    const info = GA.treeInfo(n, e);
    assert.equal(info.forest, e.length === n - info.components);
    if (info.tree) assert.equal(e.length, n - 1);
    if (info.cycle) {
      const s = edgeSet(e), c = info.cycle;
      assert.ok(c.length >= 3);
      assert.equal(new Set(c).size, c.length);
      for (let i = 0; i < c.length; i++) assert.ok(s.has(GA.key(c[i], c[(i + 1) % c.length])));
    }
    if (info.tree && n > 1) assert.ok(info.leaves.length >= 2);  // Lemma 16.1 (and more)
  }
});

function* subsets(arr, k, start = 0, cur = []) {
  if (cur.length === k) { yield cur.slice(); return; }
  for (let i = start; i < arr.length; i++) { cur.push(arr[i]); yield* subsets(arr, k, i + 1, cur); cur.pop(); }
}
test("Kruskal's total equals the brute-force minimum spanning tree (KT Alg 12.8)", () => {
  const r = rng(9);
  for (let t = 0; t < 150; t++) {
    const n = 2 + Math.floor(r() * 5);
    const e = randomGraph(r, n, 0.5 + r() * 0.5).map(([u, v]) => [u, v, 1 + Math.floor(r() * 9)]);
    if (!GA.isConnected(n, e)) continue;
    let best = Infinity;
    for (const s of subsets(e, n - 1)) {
      if (GA.treeInfo(n, s).tree) best = Math.min(best, s.reduce((a, x) => a + x[2], 0));
    }
    const k = GA.kruskal(n, e);
    assert.ok(k.spanning);
    assert.equal(k.total, best);
    for (const st of k.steps) if (!st.take) {
      assert.equal(st.cycle[0], st.edge.u);
      assert.equal(st.cycle[st.cycle.length - 1], st.edge.v);
    }
  }
});

// ------------------------------------------------------------- planarity
test("crossings: K4 in convex position crosses once, in a triangle-with-centre never", () => {
  const k4 = GA.families.K(4).edges;
  const square = [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}];
  assert.equal(GA.crossings(square, k4).length, 1);
  const tri = [{x:0,y:0},{x:10,y:0},{x:5,y:9},{x:5,y:3}];
  assert.equal(GA.crossings(tri, k4).length, 0);
});

test("faces traced from a crossing-free drawing satisfy v - e + f = 2 (KT Thm 5.33)", () => {
  const r = rng(10);
  let checked = 0;
  for (let t = 0; t < 400; t++) {
    const n = 3 + Math.floor(r() * 8);
    const pos = Array.from({length: n}, () => ({x: r() * 100, y: r() * 100}));
    const e = [];
    const pairs = [];
    for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) pairs.push([u, v]);
    pairs.sort(() => r() - 0.5);
    for (const [u, v] of pairs) {
      if (r() < 0.3) continue;
      const ok = e.every(([a, b]) => a === u || a === v || b === u || b === v ||
                         !GA.segCross(pos[u], pos[v], pos[a], pos[b]));
      if (ok) e.push([u, v]);
    }
    if (!GA.isConnected(n, e)) continue;
    assert.equal(GA.crossings(pos, e).length, 0);
    const f = GA.faces(n, pos, e);
    assert.equal(n - e.length + f.length, 2);
    // exactly one outer face (negative signed area in y-down screen space)
    // unless the drawing is a tree, where the single face has area 0
    if (e.length >= n) assert.equal(f.filter(x => x.area < 0).length, 1);
    checked++;
  }
  assert.ok(checked > 100);
});

test("planar graphs never break e <= 3v - 6 (KT Thm 5.34) in our random drawings", () => {
  const r = rng(11);
  for (let t = 0; t < 200; t++) {
    const n = 3 + Math.floor(r() * 9);
    const pos = Array.from({length: n}, () => ({x: r() * 100, y: r() * 100}));
    const e = [];
    for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) {
      const ok = e.every(([a, b]) => a === u || a === v || b === u || b === v ||
                         !GA.segCross(pos[u], pos[v], pos[a], pos[b]));
      if (ok) e.push([u, v]);
    }
    assert.ok(e.length <= 3 * n - 6);
  }
});

// -------------------------------------------------------------- coloring
function bruteChi(n, edges) {
  for (let k = 1; k <= n; k++) {
    const col = new Array(n).fill(0);
    const go = (v) => {
      if (v === n) return edges.every(([a, b]) => col[a] !== col[b]);
      for (let c = 0; c < k; c++) { col[v] = c; if (go(v + 1)) return true; }
      return false;
    };
    if (go(0)) return k;
  }
  return 0;
}
test("chromatic number matches brute force; greedy is proper and uses <= Δ+1 (Thm 16.4)", () => {
  const r = rng(12);
  for (let t = 0; t < 200; t++) {
    const n = 1 + Math.floor(r() * 7), e = randomGraph(r, n, r());
    const c = GA.chromatic(n, e);
    assert.equal(c.k, bruteChi(n, e));
    for (const [u, v] of e) assert.notEqual(c.col[u], c.col[v]);
    const g = GA.greedyColoring(n, e);
    for (const [u, v] of e) assert.notEqual(g.col[u], g.col[v]);
    const D = Math.max(0, ...GA.degrees(n, e));
    assert.ok(g.k <= D + 1);
    assert.ok(g.k >= c.k);
  }
});

test("largest clique matches brute force over all vertex subsets", () => {
  const r = rng(13);
  for (let t = 0; t < 200; t++) {
    const n = 1 + Math.floor(r() * 8), e = randomGraph(r, n, r());
    const s = edgeSet(e);
    let best = 0;
    for (let mask = 1; mask < (1 << n); mask++) {
      const vs = [...Array(n).keys()].filter(v => (mask >> v) & 1);
      let ok = true;
      for (let i = 0; i < vs.length && ok; i++) for (let j = i + 1; j < vs.length && ok; j++) ok = s.has(GA.key(vs[i], vs[j]));
      if (ok) best = Math.max(best, vs.length);
    }
    const c = GA.maxClique(n, e);
    assert.equal(c.length, best);
    for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) assert.ok(s.has(GA.key(c[i], c[j])));
  }
});
