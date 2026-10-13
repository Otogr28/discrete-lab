"use strict";
/* ===========================================================================
   Graph algorithms. Pure functions over (n, edges): vertices are 0..n-1 and
   an edge is [u, v] or [u, v, w] with u !== v. No drawing in here, so the
   same file runs in the browser and under `node --test`, and every verdict a
   lab shows is checked against brute force in tests/.

   Vertex order is label order. Where a book algorithm says "smallest label"
   (Keller–Trotter Algorithm 5.14) that is the smallest index here.
   =========================================================================== */
(function (root) {

const key = (u, v) => u < v ? u + "-" + v : v + "-" + u;

function adjacency(n, edges) {
  const A = Array.from({length: n}, () => []);
  for (const [u, v] of edges) { A[u].push(v); A[v].push(u); }
  for (const a of A) a.sort((x, y) => x - y);
  return A;
}

function degrees(n, edges) {
  const d = new Array(n).fill(0);
  for (const [u, v] of edges) { d[u]++; d[v]++; }
  return d;
}

function hasEdge(edges, u, v) {
  return edges.some(([a, b]) => (a === u && b === v) || (a === v && b === u));
}

/* Components by BFS. `comp[v]` is the component index of v. */
function components(n, edges) {
  const A = adjacency(n, edges), comp = new Array(n).fill(-1), list = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1) continue;
    const c = list.length, q = [s], members = [];
    comp[s] = c;
    while (q.length) {
      const x = q.shift(); members.push(x);
      for (const y of A[x]) if (comp[y] === -1) { comp[y] = c; q.push(y); }
    }
    list.push(members);
  }
  return {comp, count: list.length, list};
}

const isConnected = (n, edges) => n === 0 || components(n, edges).count === 1;

/* Theorem 16.1: bipartite iff no odd cycle. BFS two-colours each component;
   an edge inside one BFS layer closes an odd cycle, which is returned so the
   page can show the reason, not just the verdict. */
function bipartite(n, edges) {
  const A = adjacency(n, edges);
  const side = new Array(n).fill(-1), parent = new Array(n).fill(-1),
        depth = new Array(n).fill(0);
  for (let s = 0; s < n; s++) {
    if (side[s] !== -1) continue;
    side[s] = 0;
    const q = [s];
    while (q.length) {
      const x = q.shift();
      for (const y of A[x]) {
        if (side[y] === -1) {
          side[y] = 1 - side[x]; parent[y] = x; depth[y] = depth[x] + 1; q.push(y);
        } else if (side[y] === side[x]) {
          /* walk both ends up to their common ancestor */
          let a = x, b = y;
          const pa = [a], pb = [b];
          while (a !== b) {
            if (depth[a] >= depth[b]) { a = parent[a]; pa.push(a); }
            else { b = parent[b]; pb.push(b); }
          }
          pb.pop();                       /* the meeting vertex is in pa */
          return {ok: false, cycle: pa.concat(pb.reverse())};
        }
      }
    }
  }
  return {ok: true, side};
}

/* Definition 16.3. */
function complement(n, edges) {
  const out = [];
  for (let u = 0; u < n; u++)
    for (let v = u + 1; v < n; v++)
      if (!hasEdge(edges, u, v)) out.push([u, v]);
  return out;
}

/* ================================================================= euler
   The verdict and its reason. Vertices with no edges are ignored for
   connectivity, as Keller–Trotter does ("a graph without isolated
   vertices"), and the page says so. */
function eulerVerdict(n, edges) {
  const d = degrees(n, edges);
  const odd = [];
  for (let v = 0; v < n; v++) if (d[v] % 2) odd.push(v);
  const touched = [];
  for (let v = 0; v < n; v++) if (d[v] > 0) touched.push(v);
  let connected = true;
  if (touched.length) {
    const {comp} = components(n, edges);
    connected = touched.every(v => comp[v] === comp[touched[0]]);
  }
  let type = "none";
  if (edges.length && connected && odd.length === 0) type = "circuit";
  else if (edges.length && connected && odd.length === 2) type = "trail";
  return {type, odd, connected, isolated: n - touched.length};
}

/* Keller–Trotter Algorithm 5.14 (Eulerian Circuit Finder), step by step.
   Returns the list of circuits C after each splice plus the outcome, so the
   page can animate exactly what the book's procedure does:
     - start C = (first vertex with an edge, normally vertex 0)
     - find the FIRST position in C whose vertex still has an untraversed edge
     - from there walk, always to the smallest-labelled neighbour along an
       untraversed edge, until stuck
     - stuck somewhere else: that vertex has odd degree. Stuck at the start:
       splice the walk into C in place of that vertex.
   `start` lets the trail variant begin at an odd vertex. */
function eulerFinder(n, edges, start) {
  const A = adjacency(n, edges);
  const used = new Set();
  const free = (x) => A[x].filter(y => !used.has(key(x, y)));
  /* the book starts at vertex 1; with isolated vertices allowed, the first
     vertex that has an edge */
  let s0 = start;
  if (s0 === undefined) {
    s0 = 0;
    while (s0 < n - 1 && !A[s0].length) s0++;
  }
  let C = [s0];
  const steps = [{circuit: C.slice(), walk: null, from: null}];
  while (used.size < edges.length) {
    let pos = -1;
    for (let i = 0; i < C.length; i++) if (free(C[i]).length) { pos = i; break; }
    if (pos === -1) {
      const left = edges.find(([u, v]) => !used.has(key(u, v)));
      steps.push({circuit: C.slice(), walk: null, from: null});
      return {ok: false, why: "disconnected", component: [...new Set(C)],
              edge: left.slice(0, 2), steps};
    }
    const u0 = C[pos], W = [u0];
    let x = u0;
    for (;;) {
      const f = free(x);
      if (!f.length) break;
      const y = f[0];
      used.add(key(x, y)); W.push(y); x = y;
    }
    if (x !== u0) {
      steps.push({circuit: C.slice(), walk: W, from: pos});
      return {ok: false, why: "odd", vertex: x, walk: W, steps};
    }
    C = C.slice(0, pos).concat(W, C.slice(pos + 1));
    steps.push({circuit: C.slice(), walk: W, from: pos});
  }
  return {ok: true, circuit: C, steps};
}

/* An Euler trail when exactly two vertices are odd: join them with a
   temporary edge, run the finder from one of them, cut the temporary edge
   out of the circuit. (The page explains this trick; it is not one of the
   books' numbered algorithms.) */
function eulerTrail(n, edges) {
  const v = eulerVerdict(n, edges);
  if (v.type === "circuit") return eulerFinder(n, edges).circuit;
  if (v.type !== "trail") return null;
  const [a, b] = v.odd;
  /* a fake vertex n adjacent to both keeps the graph simple */
  const ext = edges.map(e => [e[0], e[1]]).concat([[a, n], [n, b]]);
  const r = eulerFinder(n + 1, ext, n);
  if (!r.ok) return null;
  const c = r.circuit.slice(1, -1);       /* drop the fake vertex at both ends */
  return c;
}

/* Is `seq` an Euler circuit/trail of the graph? Used by the tests and by the
   "build your own" mode, where the reader clicks a route edge by edge. */
function isEulerWalk(n, edges, seq, closed) {
  if (seq.length !== edges.length + 1) return false;
  if (closed && seq[0] !== seq[seq.length - 1]) return false;
  const want = new Set(edges.map(([u, v]) => key(u, v))), seen = new Set();
  for (let i = 0; i + 1 < seq.length; i++) {
    const k = key(seq[i], seq[i + 1]);
    if (!want.has(k) || seen.has(k)) return false;
    seen.add(k);
  }
  return seen.size === want.size;
}

/* ============================================================== hamilton
   Backtracking. Fine up to a dozen or so vertices, which is every graph
   anyone draws by hand; `limit` stops runaway searches on bigger ones. */
function hamilton(n, edges, wantCycle, limit) {
  limit = limit || 2e6;
  if (n === 0) return {found: false, path: null, complete: true};
  if (n === 1) return wantCycle ? {found: false, path: null, complete: true}
                                : {found: true, path: [0], complete: true};
  if (wantCycle && n < 3) return {found: false, path: null, complete: true};
  const A = adjacency(n, edges);
  const inPath = new Array(n).fill(false), path = [];
  let calls = 0, aborted = false;
  function go(x) {
    if (++calls > limit) { aborted = true; return false; }
    if (path.length === n)
      return !wantCycle || A[x].includes(path[0]);
    for (const y of A[x]) {
      if (inPath[y]) continue;
      inPath[y] = true; path.push(y);
      if (go(y)) return true;
      if (aborted) return false;
      inPath[y] = false; path.pop();
    }
    return false;
  }
  const starts = wantCycle ? [0] : [...Array(n).keys()];
  for (const s of starts) {
    inPath[s] = true; path.push(s);
    if (go(s)) return {found: true, path: path.slice(), complete: true};
    inPath[s] = false; path.pop();
    if (aborted) break;
  }
  return {found: false, path: null, complete: !aborted};
}

/* Theorem 16.2 (Ore): n > 2 and deg x + deg y >= n for every nonadjacent
   pair. Returns the pairs that break it. */
function ore(n, edges) {
  const d = degrees(n, edges), bad = [];
  for (let u = 0; u < n; u++)
    for (let v = u + 1; v < n; v++)
      if (!hasEdge(edges, u, v) && d[u] + d[v] < n) bad.push([u, v]);
  return {applies: n > 2, holds: n > 2 && bad.length === 0, bad};
}

/* Keller–Trotter Theorem 5.19 (Dirac): n >= 3 and every degree >= ceil(n/2). */
function dirac(n, edges) {
  const d = degrees(n, edges), need = Math.ceil(n / 2);
  const bad = [];
  for (let v = 0; v < n; v++) if (d[v] < need) bad.push(v);
  return {applies: n >= 3, holds: n >= 3 && bad.length === 0, need, bad};
}

/* ================================================================= trees */
/* Any cycle in the graph, as a vertex list, or null. */
function findCycle(n, edges) {
  const A = adjacency(n, edges), seen = new Array(n).fill(false),
        parent = new Array(n).fill(-1);
  for (let s = 0; s < n; s++) {
    if (seen[s]) continue;
    const stack = [[s, -1]];
    while (stack.length) {
      const [x, p] = stack.pop();
      if (seen[x]) continue;
      seen[x] = true; parent[x] = p;
      for (const y of A[x]) {
        if (y === p) continue;
        if (seen[y]) {
          /* y is an ancestor of x (or reached on another branch already);
             build the cycle from the tree paths of x and y */
          const px = [], py = [];
          for (let a = x; a !== -1; a = parent[a]) px.push(a);
          for (let b = y; b !== -1; b = parent[b]) py.push(b);
          const sx = new Set(px);
          const meet = py.find(b => sx.has(b));
          const cyc = px.slice(0, px.indexOf(meet) + 1)
            .concat(py.slice(0, py.indexOf(meet)).reverse());
          if (cyc.length >= 3) return cyc;
          continue;
        }
        stack.push([y, x]);
      }
    }
  }
  return null;
}

function treeInfo(n, edges) {
  const {count} = components(n, edges);
  const cycle = findCycle(n, edges);
  const d = degrees(n, edges);
  const leaves = [];
  for (let v = 0; v < n; v++) if (d[v] === 1) leaves.push(v);
  const forest = cycle === null;
  return {forest, tree: forest && count === 1 && n > 0, components: count,
          cycle, leaves, edges: edges.length, n};
}

/* The path between two vertices (BFS); in a tree it is the only one. */
function pathBetween(n, edges, a, b) {
  const A = adjacency(n, edges), prev = new Array(n).fill(-2);
  prev[a] = -1;
  const q = [a];
  while (q.length) {
    const x = q.shift();
    if (x === b) break;
    for (const y of A[x]) if (prev[y] === -2) { prev[y] = x; q.push(y); }
  }
  if (prev[b] === -2) return null;
  const p = [];
  for (let x = b; x !== -1; x = prev[x]) p.push(x);
  return p.reverse();
}

/* Keller–Trotter Algorithm 12.8 (Kruskal, "Avoid Cycles"). Edges sorted by
   weight, ties broken by the edge's endpoint labels so the run is the same
   every time. Each step records whether the edge was taken and, if not, the
   cycle it would have closed. */
function kruskal(n, edges) {
  const order = edges.map((e, i) => ({u: Math.min(e[0], e[1]), v: Math.max(e[0], e[1]),
                                      w: e[2] === undefined ? 1 : e[2], i}))
    .sort((a, b) => a.w - b.w || a.u - b.u || a.v - b.v);
  const S = [], steps = [];
  let total = 0;
  for (const e of order) {
    if (S.length === n - 1) break;
    const path = pathBetween(n, S.map(s => [s.u, s.v]), e.u, e.v);
    if (path === null) { S.push(e); total += e.w; steps.push({edge: e, take: true}); }
    else steps.push({edge: e, take: false, cycle: path});
  }
  return {tree: S, total, steps, spanning: S.length === n - 1};
}

/* ============================================================= planarity */
/* Proper crossing of segments pq and rs (shared endpoints do not count). */
function segCross(p, q, r, s) {
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const o1 = o(p, q, r), o2 = o(p, q, s), o3 = o(r, s, p), o4 = o(r, s, q);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) {
    /* collinear touching: count overlap of collinear segments as a crossing */
    const on = (a, b, c) => Math.min(a.x, b.x) <= c.x && c.x <= Math.max(a.x, b.x) &&
                            Math.min(a.y, b.y) <= c.y && c.y <= Math.max(a.y, b.y);
    if (o1 === 0 && on(p, q, r)) return true;
    if (o2 === 0 && on(p, q, s)) return true;
    if (o3 === 0 && on(r, s, p)) return true;
    if (o4 === 0 && on(r, s, q)) return true;
    return false;
  }
  return o1 !== o2 && o3 !== o4;
}

function crossings(pos, edges) {
  const out = [];
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const [a, b] = edges[i], [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segCross(pos[a], pos[b], pos[c], pos[d])) out.push([i, j]);
    }
  return out;
}

/* Faces of a straight-line drawing with no crossings, traced from the
   drawing itself: each half-edge u->v is followed by v->w where w is the
   next neighbour of v clockwise after u. Every orbit is one face. This
   counts f independently of Euler's formula, so the page can check
   v - e + f = 2 instead of assuming it. Only meaningful for a connected
   drawing with no crossings. Returns faces as vertex cycles; the outer face
   is the one with negative signed area (screen coordinates, y down). */
function faces(n, pos, edges) {
  const A = adjacency(n, edges);
  const ang = (u, v) => Math.atan2(pos[v].y - pos[u].y, pos[v].x - pos[u].x);
  const rot = A.map((nb, u) => nb.slice().sort((a, b) => ang(u, a) - ang(u, b)));
  const seen = new Set(), out = [];
  for (const [u0, v0] of edges) {
    for (const [s, t] of [[u0, v0], [v0, u0]]) {
      if (seen.has(s + ">" + t)) continue;
      const cyc = [];
      let u = s, v = t;
      while (!seen.has(u + ">" + v)) {
        seen.add(u + ">" + v); cyc.push(u);
        const r = rot[v], i = r.indexOf(u);
        const w = r[(i - 1 + r.length) % r.length];
        u = v; v = w;
      }
      let area = 0;
      for (let i = 0; i < cyc.length; i++) {
        const a = pos[cyc[i]], b = pos[cyc[(i + 1) % cyc.length]];
        area += a.x * b.y - b.x * a.y;
      }
      out.push({cycle: cyc, area: area / 2});
    }
  }
  return out;
}

/* ============================================================== coloring */
function greedyColoring(n, edges, order) {
  const A = adjacency(n, edges), col = new Array(n).fill(-1);
  for (const v of order || [...Array(n).keys()]) {
    const used = new Set(A[v].map(y => col[y]));
    let c = 0;
    while (used.has(c)) c++;
    col[v] = c;
  }
  return {col, k: n ? Math.max(...col) + 1 : 0};
}

/* A largest clique (Bron–Kerbosch with pivoting): the K_w inside G that
   gives the lower bound chi(G) >= w through Proposition 16.5. */
function maxClique(n, edges) {
  const A = adjacency(n, edges).map(a => new Set(a));
  let best = [];
  (function bk(R, P, X) {
    if (!P.length && !X.length) { if (R.length > best.length) best = R.slice(); return; }
    if (R.length + P.length <= best.length) return;
    const u = P.concat(X).reduce((m, v) => (A[v].size > A[m].size ? v : m), P.concat(X)[0]);
    for (const v of P.filter(v => !A[u].has(v))) {
      bk(R.concat([v]), P.filter(w => A[v].has(w)), X.filter(w => A[v].has(w)));
      P = P.filter(w => w !== v); X = X.concat([v]);
    }
  })([], [...Array(n).keys()], []);
  return best;
}

/* Exact chromatic number by trying k = 1, 2, ... with backtracking. */
function chromatic(n, edges) {
  if (n === 0) return {k: 0, col: []};
  const A = adjacency(n, edges);
  const order = [...Array(n).keys()].sort((a, b) => A[b].length - A[a].length);
  for (let k = 1; k <= n; k++) {
    const col = new Array(n).fill(-1);
    const go = (i) => {
      if (i === n) return true;
      const v = order[i];
      for (let c = 0; c < k; c++) {
        if (A[v].some(y => col[y] === c)) continue;
        col[v] = c;
        if (go(i + 1)) return true;
        col[v] = -1;
      }
      return false;
    };
    if (go(0)) return {k, col};
  }
  return null;
}

/* =============================================================== families
   Edge lists only; the editor lays them out. */
const families = {
  K(n) { const e = []; for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) e.push([u, v]); return {n, edges: e}; },
  C(n) { const e = []; for (let u = 0; u < n; u++) e.push([u, (u + 1) % n]); return {n, edges: e}; },
  P(n) { const e = []; for (let u = 0; u + 1 < n; u++) e.push([u, u + 1]); return {n, edges: e}; },
  Kmn(m, k) { const e = []; for (let u = 0; u < m; u++) for (let v = 0; v < k; v++) e.push([u, m + v]); return {n: m + k, edges: e}; },
  Q(d) {
    const n = 1 << d, e = [];
    for (let u = 0; u < n; u++) for (let b = 0; b < d; b++) { const v = u ^ (1 << b); if (u < v) e.push([u, v]); }
    return {n, edges: e};
  },
  petersen() {
    const e = [];
    for (let i = 0; i < 5; i++) { e.push([i, (i + 1) % 5]); e.push([i, i + 5]); e.push([5 + i, 5 + (i + 2) % 5]); }
    return {n: 10, edges: e};
  },
};

const GA = {key, adjacency, degrees, hasEdge, components, isConnected, bipartite,
  complement, eulerVerdict, eulerFinder, eulerTrail, isEulerWalk, hamilton, ore,
  dirac, findCycle, treeInfo, pathBetween, kruskal, segCross, crossings, faces,
  greedyColoring, maxClique, chromatic, families};

if (typeof module !== "undefined" && module.exports) module.exports = GA;
else root.GA = GA;
})(typeof window !== "undefined" ? window : globalThis);
