"use strict";
/* ===========================================================================
   Lab 4 · Planarity (Keller–Trotter 5.5) and colouring (Hammack 16.4).

   Planarity: drag to untangle with a live crossing count. Once a connected
   drawing has no crossings, its faces are traced from the drawing itself
   and coloured, so Euler's formula n − m + f = 2 (KT Theorem 5.33) is
   checked, not assumed. The edge bounds (KT Theorem 5.34 and its
   triangle-free cousin) say when no drawing can ever work.

   Colouring: tap to colour by hand, run greedy, or ask for chi(G), with
   the book's bounds: a clique from below (Prop 16.5), Delta + 1 (Thm 16.4)
   and Brooks (Thm 16.5) from above.

   Some example families and question types are left out of this lab on
   purpose, because they are assigned course problems and are not shown.
   =========================================================================== */
(function () {
let pd, cd, col = [], corder = null;
const FACE = ["var(--blue-soft)", "var(--orange-soft)", "var(--green-soft)", "var(--violet-soft)", "var(--amber-soft)", "var(--red-soft)"];
const COLORS = ["var(--blue)", "var(--orange)", "var(--green)", "var(--violet)", "var(--amber)", "var(--red)", "#3f8f8f", "#9a5a2e", "#6b6a65", "#c2549a"];

function scrambled(g, r) {
  const order = shuffle(r, [...Array(g.n).keys()]);
  const circle = Layout.circle(g.n);
  return {n: g.n, edges: g.edges, pos: order.map(i => circle[i])};
}
const PPRESETS = [
  ["Untangle me (6 vertices)", (r) => scrambled(Presets.planar(r, 6, 0.9), r)],
  ["Untangle me (8 vertices)", (r) => scrambled(Presets.planar(r, 8, 0.85), r)],
  ["Untangle me (10 vertices)", (r) => scrambled(Presets.planar(r, 10, 0.8), r)],
  ["Hypercube Q₃, scrambled", (r) => scrambled(Presets.Q(3), r)],
  ["K₅", () => Presets.K(5)],
  ["K₃,₃ (houses and utilities)", () => Presets.Kmn(3, 3)],
  ["Petersen graph", () => Presets.petersen()],
  ["Random tree", (r) => Presets.tree(r, 8)],
];
const CPRESETS = [
  ["Cycle C₅", () => Presets.C(5)],
  ["Cycle C₆", () => Presets.C(6)],
  ["Petersen graph", () => Presets.petersen()],
  ["Hypercube Q₃", () => Presets.Q(3)],
  ["Random planar graph", (r) => Presets.planar(r, 9, 0.9)],
  ["Random graph", (r) => Presets.random(r, 8, 0.4)],
];

function build() {
  const ph = $("planar-bench");
  const pl = h("div", {class: "panel"}), pr = h("div", {});
  ph.append(pl, pr);
  pd = new GraphEditor(ph.firstChild, {lab: "planar", presets: PPRESETS, onChange: pupdate, onDrag: pupdate,
    aria: "graph editor: drag vertices to remove crossings"});
  pr.append(h("div", {class: "panel pad", id: "planar-read"}), h("div", {class: "panel pad", id: "planar-verdict"}));
  const p = hashParams().get("g"), g = p && decodeGraph(p);
  pd.set(g || scrambled(Presets.planar(rng(228), 7, 0.9), rng(5)));

  const chh = $("color-bench");
  const cl = h("div", {class: "panel"}), cr = h("div", {});
  chh.append(cl, cr);
  cd = new GraphEditor(cl, {lab: "planar", presets: CPRESETS, onChange: () => { syncCol(); cupdate(); }, onDrag: cupdate,
    hint: "<b>Paint</b> mode: tap a vertex to cycle its colour. <b>Draw</b> mode edits the graph.",
    aria: "graph editor for colouring"});
  const paint = h("button", {type: "button", class: "btn"}, "Paint");
  paint.onclick = () => {
    const on = !cd.pickHandler;
    cd.pickHandler = on ? (v) => { const k = Math.max(0, ...col) + 2; col[v] = (col[v] + 1) % Math.min(COLORS.length, Math.max(2, k)); corder = null; cupdate(); } : null;
    paint.classList.toggle("on", on);
  };
  cd.addTool(paint);
  cr.append(h("div", {class: "panel pad", id: "color-read"}));
  cd.set(Presets.petersen(), true);
  col = GA.greedyColoring(cd.g.n, cd.g.edges).col;
  cupdate();
  paint.click();
  Quiz.mount($("planar-quiz"), [qBound, qBoundLogic, qFaces, qFacesFig, qChi, qBrooks]);
}

/* ------------------------------------------------------------ planarity */
function crossPoint(p, q, r, s) {
  const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
  if (!d) return {x: (p.x + q.x) / 2, y: (p.y + q.y) / 2};
  const t = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d;
  return {x: p.x + t * (q.x - p.x), y: p.y + t * (q.y - p.y)};
}
function hasTriangle(n, E) { return GA.maxClique(n, E).length >= 3; }

function pupdate() {
  const g = pd.g, n = g.n, E = g.edges;
  const R = $("planar-read"), V = $("planar-verdict");
  R.textContent = ""; V.textContent = "";
  const decor = {v: {}, e: {}, dots: [], faces: []};
  const X = GA.crossings(g.pos, E);
  for (const [i, j] of X) {
    const [a, b] = E[i], [c, d] = E[j];
    const pt = crossPoint(g.pos[a], g.pos[b], g.pos[c], g.pos[d]);
    decor.dots.push({x: pt.x, y: pt.y, color: "var(--red)", r: 7});
    decor.e[GA.key(a, b)] = {stroke: "var(--red)"};
    decor.e[GA.key(c, d)] = {stroke: "var(--red)"};
  }
  const conn = GA.isConnected(n, E);
  let f = null;
  if (!X.length && conn && n) {
    const F = GA.faces(n, g.pos, E);
    f = F.length;
    let k = 0;
    for (const face of F) if (face.area > 1e-6) decor.faces.push({pts: face.cycle, fill: FACE[k++ % FACE.length]});
  }
  R.append(h("h4", {}, "This drawing"), h("dl", {class: "rows"},
    h("dt", {}, "vertices n"), h("dd", {}, n),
    h("dt", {}, "edges m"), h("dd", {}, E.length),
    h("dt", {}, "crossings"), h("dd", {style: X.length ? "color:var(--red);font-weight:700" : "color:var(--green);font-weight:700"}, X.length),
    h("dt", {}, "faces f"), h("dd", {}, f === null ? "–" : f + " (incl. the outside)")));

  V.append(h("h4", {}, "What we can say"));
  if (!n) { V.append(h("div", {class: "verdict"}, "Draw a graph or load an example.")); pd.setDecor(decor); return; }
  if (!X.length && conn) {
    V.append(h("div", {class: "verdict good", html: `<b>A planar drawing</b>, so the graph is planar.` +
      `<span class="why">Euler's formula (KT Theorem 5.33), with faces counted from the picture:</span>` +
      `<span class="why mono">n − m + f = ${n} − ${E.length} + ${f} = ${n - E.length + f}</span>`}));
  } else if (!X.length && !conn) {
    V.append(h("div", {class: "verdict warn", html: `<b>No crossings</b>, but not connected; Euler's formula needs a connected graph.`}));
  } else {
    V.append(h("div", {class: "verdict bad", html: `<b>${X.length} crossing${X.length === 1 ? "" : "s"}</b> (red dots). Drag vertices to remove them.` +
      ``}));
  }
  if (n >= 3) {
    const b3 = 3 * n - 6;
    if (E.length > b3) V.append(h("div", {class: "verdict bad", html: `<b>Never planar:</b> m = ${E.length} &gt; 3n − 6 = ${b3}.` +
      `<span class="why">KT Thm 5.34.</span>`}));
    else {
      const tri = hasTriangle(n, E);
      if (!tri && E.length > 2 * n - 4) V.append(h("div", {class: "verdict bad", html: `<b>Never planar:</b> it has no triangles and m = ${E.length} &gt; 2n − 4 = ${2 * n - 4}.` +
        `<span class="why">No triangles ⇒ m ≤ 2n − 4.</span>`}));
      else V.append(h("div", {class: "verdict info", html: `m = ${E.length} ≤ 3n − 6 = ${b3}${!tri ? ` and ≤ 2n − 4 = ${2 * n - 4}` : ""}: the edge bounds <b>do not rule it out</b>. ` +
        ""}));
    }
  }
  pd.setDecor(decor);
}

/* ------------------------------------------------------------- colouring */
function syncCol() {
  const n = cd.g.n;
  /* a new graph starts properly coloured (greedy), so the first thing you
     see is never a wall of red */
  if (col.length !== n || cd.g.edges.some(([u, v]) => col[u] === col[v]))
    col = GA.greedyColoring(n, cd.g.edges).col;
  corder = null;
}
function cupdate() {
  const g = cd.g, n = g.n, E = g.edges;
  if (col.length !== n) syncCol();
  const R = $("color-read");
  R.textContent = "";
  const decor = {v: {}, e: {}};
  for (let v = 0; v < n; v++) decor.v[v] = {fill: COLORS[col[v] % COLORS.length], stroke: COLORS[col[v] % COLORS.length], ink: "#fff"};
  if (corder) corder.forEach((v, i) => decor.v[v].badge = i + 1);
  const bad = E.filter(([u, v]) => col[u] === col[v]);
  for (const [u, v] of bad) decor.e[GA.key(u, v)] = {stroke: "var(--red)", width: 6};
  const used = new Set(col).size;
  const d = GA.degrees(n, E), D = n ? Math.max(...d) : 0;

  R.append(h("h4", {}, "Your colouring"));
  if (!n) { R.append(h("div", {class: "verdict"}, "Draw a graph first.")); cd.setDecor(decor); return; }
  R.append(h("div", {class: "verdict " + (bad.length ? "bad" : "good"), html: bad.length
    ? `<b>Not proper:</b> ${bad.length} edge${bad.length === 1 ? " joins" : "s join"} two vertices of the same colour (red).`
    : `<b>Proper ${used}-colouring.</b> No edge joins two vertices of the same colour. So χ(G) ≤ ${used}.`}));

  const tools = h("div", {class: "steprow"});
  const greedy = (order) => { const r = GA.greedyColoring(n, E, order); col = r.col; corder = order; cupdate(); };
  tools.append(
    h("button", {type: "button", class: "btn small", onclick: () => greedy([...Array(n).keys()])}, "Greedy a→z"),
    h("button", {type: "button", class: "btn small", onclick: () => greedy(shuffle(rng(newSeed()), [...Array(n).keys()]))}, "Greedy, random order"),
    h("button", {type: "button", class: "btn small", onclick: () => { const c = GA.chromatic(n, E); col = c.col; corder = null; cupdate(); }}, "Fewest colours"),
    h("button", {type: "button", class: "btn small", onclick: () => { col = new Array(n).fill(0); corder = null; cupdate(); }}, "Reset"));
  R.append(tools);
  if (corder) R.append(h("p", {class: "sub", style: "margin-top:8px;font-size:13.5px", html:
    `Greedy order shown by the small numbers: <b>${new Set(col).size}</b> colours.`}));

  /* the bounds */
  const K = GA.maxClique(n, E);
  const bip = GA.bipartite(n, E).ok;
  const chi = n <= 14 ? GA.chromatic(n, E).k : null;
  const conn = GA.isConnected(n, E);
  const complete = E.length === n * (n - 1) / 2;
  const oddCycle = conn && n >= 3 && n % 2 === 1 && E.length === n && d.every(x => x === 2);
  const brooks = conn && !complete && !oddCycle;
  R.append(h("h4", {style: "margin-top:14px"}, "Bounds on χ(G)"));
  const lo = Math.max(K.length, bip ? 1 : 3, E.length ? 2 : 1);
  const hi = Math.min(D + 1, brooks && D > 0 ? D : D + 1);
  R.append(h("dl", {class: "rows"},
    h("dt", {}, "largest clique"), h("dd", {}, `K${K.length > 0 ? K.length : ""} {${vlist(K)}}`),
    h("dt", {}, "odd cycle?"), h("dd", {}, bip ? "no (bipartite)" : "yes"),
    h("dt", {}, "largest degree Δ"), h("dd", {}, D),
    h("dt", {}, "Δ + 1 (Thm 16.4)"), h("dd", {}, D + 1),
    h("dt", {}, "Brooks (Thm 16.5)"), h("dd", {}, brooks ? `applies: ≤ ${D}` : complete ? "no: complete graph" : oddCycle ? "no: odd cycle" : "no: not connected")));
  R.append(h("div", {class: "verdict info", style: "margin-top:10px", html:
    `So ${lo} ≤ χ(G) ≤ ${hi}.` + (chi !== null ? ` Searching every colouring gives <b>χ(G) = ${chi}</b>.` : "") +
    ``}));
  cd.setDecor(decor);
}

/* ------------------------------------------------------- check yourself */
function qBound(r) {
  const n = pick(r, [7, 8, 9, 11, 12, 14, 15, 20, 25, 30]);
  return {prompt: `A planar graph has ${n} vertices. What is the <b>largest</b> number of edges it can have?`,
    choices: [{html: String(3 * n - 6), ok: true}, {html: String(3 * n), ok: false}, {html: String(2 * n - 4), ok: false}, {html: String(n * (n - 1) / 2), ok: false}],
    explain: `KT Theorem 5.34: at most 3n − 6 = 3·${n} − 6 = <b>${3 * n - 6}</b>. (2n − 4 is the bound only for graphs with no triangles; n(n−1)/2 is K<sub>${n}</sub>, far too many.)`};
}
function qBoundLogic(r) {
  const n = pick(r, [7, 8, 9, 11, 12, 13]);
  const over = r() < 0.5;
  const m = over ? 3 * n - 6 + ri(r, 1, 4) : ri(r, n + 1, 3 * n - 6);
  return {prompt: `A connected graph has ${n} vertices and ${m} edges. Is it planar?`,
    choices: [{html: "Definitely planar", ok: false}, {html: "Definitely not planar", ok: over}, {html: "Can't tell from these numbers alone", ok: !over}],
    explain: over ? `3n − 6 = ${3 * n - 6} &lt; ${m}, so it has too many edges for any planar graph (KT Theorem 5.34).`
      : `3n − 6 = ${3 * n - 6} ≥ ${m}, so the bound is satisfied, but the bound is only <i>necessary</i>. K₃,₃ has 9 ≤ 12 edges and is still not planar. You'd need a drawing or Kuratowski's theorem.`};
}
function qFaces(r) {
  let n, m;
  do { n = ri(r, 5, 14); m = ri(r, n, 3 * n - 6); } while ((n === 6 && m === 10) || (n === 7 && m === 9) || n === 10);
  const f = m - n + 2;
  return {prompt: `A connected planar graph with ${n} vertices and ${m} edges is drawn with no crossings. How many faces does the drawing have (counting the outside)?`,
    choices: [{html: String(f), ok: true}, {html: String(f - 1), ok: false}, {html: String(f + 1), ok: false}, {html: String(m - n), ok: false}].filter((c, i, a) => a.findIndex(x => x.html === c.html) === i),
    explain: `Euler: n − m + f = 2, so f = 2 − n + m = 2 − ${n} + ${m} = <b>${f}</b>. Every planar drawing of it has that many, no matter how you draw it.`};
}
function qFacesFig(r) {
  const g = Presets.planar(r, ri(r, 5, 7), 0.8);
  if (!GA.isConnected(g.n, g.edges) || g.edges.length < g.n) return null;
  const f = GA.faces(g.n, g.pos, g.edges).length;
  return {prompt: "How many faces does this drawing have? Count the unbounded outside face too.", graph: g,
    choices: [{html: String(f), ok: true}, {html: String(f - 1), ok: false}, {html: String(f + 1), ok: false}],
    explain: `n = ${g.n}, m = ${g.edges.length}, so Euler gives f = m − n + 2 = <b>${f}</b>: ${f - 1} bounded regions plus the outside. Counting regions by eye and checking with Euler's formula is a good habit.`};
}
function qChi(r) {
  const kind = pick(r, ["cycle", "planar", "bip"]);
  let g;
  if (kind === "cycle") g = Presets.C(ri(r, 5, 9));
  else if (kind === "bip") { g = Presets.Q(3); }
  else { g = Presets.planar(r, ri(r, 6, 7), 0.85); }
  const c = GA.chromatic(g.n, g.edges).k;
  const K = GA.maxClique(g.n, g.edges);
  const bip = GA.bipartite(g.n, g.edges).ok;
  const opts = [...new Set([c - 1, c + 1, c + 2].filter(x => x >= 1 && x !== c))].slice(0, 3);
  let why = `χ(G) = <b>${c}</b>. `;
  if (bip) why += `The graph is bipartite (no odd cycle), so two colours suffice, and one edge needs two.`;
  else if (kind === "cycle") why += g.n % 2 ? `An odd cycle can't be 2-coloured (colours alternate and clash on returning), and 3 colours work.` : `An even cycle alternates two colours.`;
  else why += `A K${K.length} (vertices ${vlist(K)}) forces at least ${K.length}${K.length < 3 && !bip ? ", an odd cycle forces 3" : ""}, and the graph can be coloured with ${c}.`;
  return {prompt: "What is the chromatic number χ(G) of this graph?", graph: g,
    choices: [{html: String(c), ok: true}, ...opts.map(x => ({html: String(x), ok: false}))], explain: why};
}
function qBrooks(r) {
  const D = ri(r, 3, 7);
  return {prompt: `G is connected, is not a complete graph, is not an odd cycle, and its largest degree is ${D}. What is the best upper bound the book gives for χ(G)?`,
    choices: [{html: `χ(G) ≤ ${D}`, ok: true}, {html: `χ(G) ≤ ${D + 1}`, ok: false}, {html: `χ(G) = ${D}`, ok: false}, {html: `χ(G) ≤ ${D - 1}`, ok: false}],
    explain: `Theorem 16.4 alone gives Δ + 1 = ${D + 1}. Because G is connected and neither complete nor an odd cycle, Brooks' Theorem (16.5) improves it to Δ = <b>${D}</b>. It is an upper bound; χ could be smaller.`};
}

registerLab("planar", {build, redraw() { pupdate(); cupdate(); },
  enter(q) { const p = q.get("g"), g = p && decodeGraph(p); if (g && pd) pd.set(g); }});
})();
