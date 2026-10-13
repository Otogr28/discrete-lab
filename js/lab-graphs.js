"use strict";
/* ===========================================================================
   Lab 1 · Graph Playground (Hammack 16.1–16.2).
   Three lenses on one drawing: degrees (Prop 16.1, 16.2), two-colouring
   (Theorem 16.1) and the complement (Definition 16.3).
   =========================================================================== */
(function () {
let ed, view = "deg";

const PRESETS = [
  ["Path P₅", () => Presets.P(5)],
  ["Cycle C₆", () => Presets.C(6)],
  ["Cycle C₇", () => Presets.C(7)],
  ["Complete K₄", () => Presets.K(4)],
  ["Complete K₆", () => Presets.K(6)],
  ["Complete bipartite K₂,₃", () => Presets.Kmn(2, 3)],
  ["Complete bipartite K₃,₄", () => Presets.Kmn(3, 4)],
  ["Hypercube Q₃", () => Presets.Q(3)],
  ["Petersen graph", () => Presets.petersen()],
  ["Random graph", (r) => Presets.random(r, ri(r, 6, 9), 0.3)],
  ["Random tree", (r) => Presets.tree(r, ri(r, 7, 11))],
];

function build() {
  const host = $("graphs-bench");
  const left = h("div", {class: "panel"}), right = h("div", {});
  host.append(left, right);
  ed = new GraphEditor(left, {lab: "graphs", presets: PRESETS, onChange: update, onDrag: update,
    aria: "graph editor: degrees, two-colouring and complement"});
  const seg = h("div", {class: "seg", role: "group", "aria-label": "what to show"});
  for (const [k, label] of [["deg", "Degrees"], ["bip", "Two-colour"], ["comp", "Complement"]]) {
    const b = h("button", {type: "button", "aria-pressed": String(k === view)}, label);
    b.onclick = () => { view = k; for (const x of seg.children) x.setAttribute("aria-pressed", String(x === b)); update(); };
    seg.append(b);
  }
  ed.addTool(seg);
  right.append(h("div", {class: "panel pad", id: "graphs-read"}),
               h("div", {class: "panel pad", id: "graphs-verdict"}));
  const p = hashParams().get("g"), g = p && decodeGraph(p);
  ed.set(g || Presets.petersen());
  Quiz.mount($("graphs-quiz"), [qEdges, qBadSequence, qBipartite, qOdd]);
}

function update() {
  const g = ed.g, n = g.n, E = g.edges;
  const d = GA.degrees(n, E);
  const odd = d.map((x, i) => [x, i]).filter(([x]) => x % 2).map(([, i]) => i);
  const comps = GA.components(n, E).count;
  const decor = {v: {}, e: {}};
  const read = $("graphs-read"), out = $("graphs-verdict");
  read.textContent = ""; out.textContent = "";

  const seq = d.slice().sort((a, b) => b - a);
  const sum = d.reduce((a, b) => a + b, 0);
  read.append(h("h4", {}, "This graph"),
    h("dl", {class: "rows"},
      h("dt", {}, "vertices |V|"), h("dd", {}, n),
      h("dt", {}, "edges |E|"), h("dd", {}, E.length),
      h("dt", {}, "components"), h("dd", {}, n ? comps + (comps === 1 ? " (connected)" : "") : "–"),
      h("dt", {}, "degree sequence"), h("dd", {}, n ? "(" + seq.join(", ") + ")" : "–")));

  if (view === "deg") {
    for (let v = 0; v < n; v++) {
      decor.v[v] = {badge: d[v]};
      if (d[v] % 2) decor.v[v].ring = "var(--red)", decor.v[v].badgeInk = "var(--red)";
    }
    out.append(h("h4", {}, "Degrees"));
    out.append(h("div", {class: "verdict info", html:
      `<b>Prop 16.1:</b> add up the degrees and you count every edge twice.<span class="why mono">` +
      (n ? `${d.join(" + ")} = ${sum} = 2 · ${E.length}` : "draw something") + `</span>`}));
    out.append(h("div", {class: "verdict " + (odd.length ? "warn" : "good"), html:
      `<b>${odd.length} odd-degree vert${odd.length === 1 ? "ex" : "ices"}</b>` +
      (odd.length ? ` (ringed red: ${vlist(odd)})` : "") +
      `<span class="why">Always even (Prop 16.2).</span>`}));
  }

  if (view === "bip") {
    const b = GA.bipartite(n, E);
    out.append(h("h4", {}, "Two-colouring"));
    if (!n) out.append(h("div", {class: "verdict"}, "Draw a graph first."));
    else if (b.ok) {
      const X = [], Y = [];
      for (let v = 0; v < n; v++) {
        (b.side[v] ? Y : X).push(v);
        decor.v[v] = b.side[v] ? {fill: "var(--orange)", ink: "#fff", stroke: "var(--orange)"}
                               : {fill: "var(--blue)", ink: "#fff", stroke: "var(--blue)"};
      }
      out.append(h("div", {class: "verdict good", html:
        `<b>Bipartite.</b> Every edge joins a blue vertex to an orange one.` +
        `<span class="why">X = {${vlist(X)}}<br>Y = {${vlist(Y)}}</span>`}));
    } else {
      const c = b.cycle;
      for (let i = 0; i < c.length; i++) {
        decor.e[GA.key(c[i], c[(i + 1) % c.length])] = {stroke: "var(--red)", width: 5};
        decor.v[c[i]] = {stroke: "var(--red)", ring: "var(--red)"};
      }
      out.append(h("div", {class: "verdict bad", html:
        `<b>Not bipartite.</b> It contains an odd cycle of length ${c.length}:` +
        `<span class="why mono">${c.map(vname).join(" – ")} – ${vname(c[0])}</span>`}));
    }
  }

  if (view === "comp") {
    const C = GA.complement(n, E);
    for (const [u, v] of E) decor.e[GA.key(u, v)] = {dim: true};
    decor.dots = [];
    out.append(h("h4", {}, "Complement"));
    out.append(h("div", {class: "verdict info", html:
      `<b>Dashed violet:</b> the ${C.length} edges of Ḡ. Faded: G.` +
      `<span class="why mono">|E(G)| + |E(Ḡ)| = ${E.length} + ${C.length} = ${E.length + C.length} = C(${n},2)</span>`}));
    const swap = h("button", {type: "button", class: "btn small"}, "Make Ḡ the graph");
    swap.onclick = () => ed.set({n, pos: g.pos, edges: C});
    out.append(h("div", {class: "steprow"}, swap));
    ed.decor = decor; ed.draw();
    /* the complement's edges are not in the graph, so draw them on top */
    for (const [u, v] of C) {
      const a = g.pos[u], b = g.pos[v];
      const l = svg("line", {x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        style: "stroke:var(--violet);stroke-width:2.4;stroke-dasharray:7 6;pointer-events:none"});
      ed.svg.insertBefore(l, ed.svg.querySelector(".v"));
    }
    return;
  }
  ed.setDecor(decor);
}

/* ------------------------------------------------------- check yourself */
function randomConnected(r, n, p) {
  for (let t = 0; t < 50; t++) {
    const g = Presets.random(r, n, p);
    if (GA.isConnected(n, g.edges)) { g.pos = Layout.circle(n); return g; }
  }
  return null;
}
function graphical(seq) {           /* Havel–Hakimi */
  let s = seq.slice();
  for (;;) {
    s.sort((a, b) => b - a);
    if (!s.length || s[0] === 0) return true;
    const k = s.shift();
    if (k > s.length) return false;
    for (let i = 0; i < k; i++) { s[i]--; if (s[i] < 0) return false; }
  }
}

function qEdges(r) {
  const g = Presets.random(r, ri(r, 5, 8), 0.45);
  const d = GA.degrees(g.n, g.edges).sort((a, b) => b - a);
  const m = g.edges.length;
  if (m < 3) return null;
  const sum = 2 * m;
  const wrong = [...new Set([sum, m + 1, m - 1, g.n].filter(x => x !== m && x >= 0))].slice(0, 3);
  return {
    prompt: `A graph has degree sequence <span class="mono">(${d.join(", ")})</span>. How many edges does it have?`,
    choices: [{html: String(m), ok: true}, ...wrong.map(x => ({html: String(x), ok: false}))],
    explain: `The degrees add up to ${sum}. Each edge adds 1 to the degree of <i>both</i> of its ends, so the sum is twice the number of edges (Prop 16.1): ${sum} / 2 = <b>${m}</b>.`,
  };
}

function qBadSequence(r) {
  const n = ri(r, 5, 7);
  const goods = [];
  while (goods.length < 3) {
    const g = Presets.random(r, n, 0.4 + r() * 0.3);
    const s = GA.degrees(n, g.edges).sort((a, b) => b - a);
    if (s[0] === 0) continue;
    if (!goods.some(x => x.join() === s.join())) goods.push(s);
  }
  const bad = goods[0].slice();
  const i = bad.findIndex(x => x < n - 1);
  if (i < 0) return null;
  bad[i]++;
  bad.sort((a, b) => b - a);
  if (goods.some(x => x.join() === bad.join()) || bad.reduce((a, b) => a + b, 0) % 2 === 0) return null;
  return {
    prompt: `Each list is the degree sequence of a ${n}-vertex graph, except one that <b>no graph</b> can have. Which one?`,
    choices: [{html: `<span class="mono">(${bad.join(", ")})</span>`, ok: true},
              ...goods.slice(1).concat([goods[0]]).slice(0, 3).map(s => ({html: `<span class="mono">(${s.join(", ")})</span>`, ok: false}))],
    explain: `Add each list up. The impossible one sums to <b>${bad.reduce((a, b) => a + b, 0)}</b>, an odd number, but by Prop 16.1 the degrees of any graph sum to 2|E|, which is even. (Equivalently it has an odd number of odd degrees, which Prop 16.2 forbids.)`,
  };
}

function qBipartite(r) {
  const n = ri(r, 6, 8);
  let g;
  if (r() < 0.5) {
    const side = Array.from({length: n}, () => r() < 0.5 ? 0 : 1);
    const edges = [];
    for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (side[u] !== side[v] && r() < 0.55) edges.push([u, v]);
    g = {n, edges};
  } else g = Presets.random(r, n, 0.35);
  if (!GA.isConnected(n, g.edges) || g.edges.length < n) return null;
  g.pos = Layout.circle(n);
  const b = GA.bipartite(n, g.edges);
  let explain;
  if (b.ok) {
    const X = [], Y = [];
    for (let v = 0; v < n; v++) (b.side[v] ? Y : X).push(v);
    explain = `It is bipartite: put X = {${vlist(X)}} and Y = {${vlist(Y)}}. Every edge goes between X and Y. Equivalently (Theorem 16.1) it has no odd cycle.`;
  } else {
    explain = `It is not bipartite. It contains the odd cycle <span class="mono">${b.cycle.map(vname).join("–")}–${vname(b.cycle[0])}</span> of length ${b.cycle.length}, and by Theorem 16.1 a graph with an odd cycle cannot be bipartite.`;
  }
  return {prompt: "Is this graph bipartite?", graph: g,
    choices: [{html: "Yes, it is bipartite", ok: b.ok}, {html: "No, it is not", ok: !b.ok}], explain};
}

function qOdd(r) {
  const g = randomConnected(r, ri(r, 6, 8), 0.4);
  if (!g) return null;
  const d = GA.degrees(g.n, g.edges);
  const k = d.filter(x => x % 2).length;
  const opts = [...new Set([k, k + 1, k + 2, Math.max(0, k - 1), k + 3])].filter(x => x !== k).slice(0, 3);
  return {prompt: "How many vertices of this graph have <b>odd</b> degree?", graph: g,
    choices: [{html: String(k), ok: true}, ...opts.map(x => ({html: String(x), ok: false}))],
    explain: `Degrees: ${d.map((x, i) => vname(i) + "=" + x).join(", ")}. The odd ones number <b>${k}</b>. Notice the count is even, as Prop 16.2 promises, so the odd choices could be crossed out straight away.`};
}

registerLab("graphs", {build, redraw: update,
  enter(q) { const p = q.get("g"), g = p && decodeGraph(p); if (g && ed) ed.set(g); }});
})();
