"use strict";
/* ===========================================================================
   Lab 3 · Trees and spanning trees (Hammack 16.2 + Keller–Trotter 12.1).
   Bench 1: is it a tree, a forest, or neither, and why (Def 16.4, Prop 16.3,
   Cor 16.1, Lemma 16.1); the unique path between two vertices (KT Prop 12.4).
   Bench 2: Kruskal's algorithm (KT Algorithm 12.8, "Avoid Cycles") on a
   weighted graph, one edge decision at a time.

   Some example families and question types are left out of this lab on
   purpose, because they are assigned course problems and are not shown.
   =========================================================================== */
(function () {
let ed, kd, view = "tree", picks = [], kstep = null, ktimer = null;

const PRESETS = [
  ["Random tree", (r) => Presets.tree(r, ri(r, 7, 12))],
  ["Random tree + one edge", (r) => {
    const g = Presets.tree(r, ri(r, 7, 10));
    for (let t = 0; t < 50; t++) {
      const u = ri(r, 0, g.n - 1), v = ri(r, 0, g.n - 1);
      if (u !== v && !GA.hasEdge(g.edges, u, v)) { g.edges.push([Math.min(u, v), Math.max(u, v)]); break; }
    }
    return g;
  }],
  ["Random forest", (r) => {
    const a = Presets.tree(r, ri(r, 3, 5)), b = Presets.tree(r, ri(r, 2, 4)), c = Presets.tree(r, ri(r, 2, 3));
    const n = a.n + b.n + c.n;
    const edges = a.edges.concat(b.edges.map(([u, v]) => [u + a.n, v + a.n]),
                                 c.edges.map(([u, v]) => [u + a.n + b.n, v + a.n + b.n]));
    const shift = (pos, dx, s) => pos.map(p => ({x: 400 + (p.x - 400) * s + dx, y: 60 + (p.y - 50) * 0.9}));
    return {n, edges, pos: shift(a.pos, -250, 0.35).concat(shift(b.pos, 30, 0.3), shift(c.pos, 260, 0.25))};
  }],
  ["Path P₇", () => Presets.P(7)],
  ["Cycle C₆", () => Presets.C(6)],
];
const KPRESETS = [
  ["Random weighted graph (7 vertices)", (r) => Presets.weighted(r, 7)],
  ["Random weighted graph (9 vertices)", (r) => Presets.weighted(r, 9)],
  ["Random weighted graph with ties", (r) => { const g = Presets.weighted(r, 8); g.edges.forEach(e => e[2] = ri(r, 1, 5)); return g; }],
];

function build() {
  /* ---- bench 1 */
  const host = $("trees-bench");
  const left = h("div", {class: "panel"}), right = h("div", {});
  host.append(left, right);
  ed = new GraphEditor(left, {lab: "trees", presets: PRESETS, onChange: () => { picks = []; update(); }, onDrag: update,
    aria: "graph editor: is it a tree?"});
  const seg = h("div", {class: "seg", role: "group", "aria-label": "what to show"});
  for (const [k, label] of [["tree", "Tree?"], ["path", "Unique path"]]) {
    const b = h("button", {type: "button", "aria-pressed": String(k === view)}, label);
    b.onclick = () => {
      view = k; picks = [];
      ed.pickHandler = k === "path" ? (v) => { picks = picks.length >= 2 ? [v] : picks.concat([v]); update(); } : null;
      ed.hintEl.innerHTML = k === "path" ? "<b>Tap two vertices</b> to see the path between them. Drag still moves." :
        "<b>Tap</b> empty space for a vertex · <b>tap two vertices</b> to join them · <b>drag</b> to move · <b>Erase</b> removes";
      for (const x of seg.children) x.setAttribute("aria-pressed", String(x === b));
      update();
    };
    seg.append(b);
  }
  ed.addTool(seg);
  right.append(h("div", {class: "panel pad", id: "trees-read"}), h("div", {class: "panel pad", id: "trees-verdict"}));
  const p = hashParams().get("g"), g = p && decodeGraph(p);
  ed.set(g && !g.edges.some(e => e.length > 2) ? g : Presets.tree(rng(7), 10));

  /* ---- bench 2: Kruskal */
  const kh = $("trees-kruskal");
  const kl = h("div", {class: "panel"}), kr = h("div", {});
  kh.append(kl, kr);
  kd = new GraphEditor(kl, {lab: "trees", weighted: true, presets: KPRESETS,
    onChange: () => { kstep = null; stopK(); kupdate(); }, onDrag: kupdate,
    hint: "<b>Tap a weight</b> to change it · tap two vertices to join them (the weight starts at their distance) · <b>Erase</b> removes",
    aria: "weighted graph for Kruskal's algorithm"});
  kr.append(h("div", {class: "panel pad", id: "kruskal-read"}));
  kd.set(g && g.edges.some(e => e.length > 2) ? g : Presets.weighted(rng(2026), 8));

  Quiz.mount($("trees-quiz"), [qIsTree, qLeaves, qKruskalNext, qOneCycle, qTreeEdges]);
}

/* --------------------------------------------------------- bench 1 */
function update() {
  const g = ed.g, n = g.n, E = g.edges;
  const info = GA.treeInfo(n, E);
  const decor = {v: {}, e: {}};
  const R = $("trees-read"), V = $("trees-verdict");
  R.textContent = ""; V.textContent = "";
  R.append(h("h4", {}, "Counts"), h("dl", {class: "rows"},
    h("dt", {}, "vertices n"), h("dd", {}, n),
    h("dt", {}, "edges"), h("dd", {}, E.length),
    h("dt", {}, "components c"), h("dd", {}, n ? info.components : "–"),
    h("dt", {}, "n − c"), h("dd", {}, n ? n - info.components : "–"),
    h("dt", {}, "leaves (degree 1)"), h("dd", {}, info.leaves.length)));

  if (view === "tree") {
    for (const v of info.leaves) decor.v[v] = {ring: "var(--green)"};
    V.append(h("h4", {}, "Verdict"));
    if (!n) V.append(h("div", {class: "verdict"}, "Draw something."));
    else if (info.tree) {
      V.append(h("div", {class: "verdict good", html: `<b>A tree:</b> connected and no cycles (Definition 16.4).` +
        `<span class="why">Prop 16.3: a tree on n = ${n} vertices has n − 1 = ${n - 1} edges. Count them: ${E.length}. ✓</span>`}));
    } else if (info.forest) {
      V.append(h("div", {class: "verdict warn", html: `<b>A forest, not a tree:</b> no cycles, but ${info.components} components.` +
        `<span class="why">Corollary 16.1: edges = n − c = ${n} − ${info.components} = ${n - info.components}. Count them: ${E.length}. ✓</span>`}));
    } else {
      const c = info.cycle;
      for (let i = 0; i < c.length; i++) decor.e[GA.key(c[i], c[(i + 1) % c.length])] = {stroke: "var(--red)", width: 5};
      V.append(h("div", {class: "verdict bad", html: `<b>Not a forest:</b> it has a cycle (red):<span class="why mono">${c.map(vname).join(" – ")} – ${vname(c[0])}</span>` +
        ``}));
    }
  }

  if (view === "path") {
    V.append(h("h4", {}, "The path between two vertices"));
    picks.forEach(v => decor.v[v] = {fill: "var(--navy)", ink: "var(--bg)", stroke: "var(--navy)"});
    if (picks.length < 2) V.append(h("div", {class: "verdict"}, picks.length ? `From ${vname(picks[0])} to… tap a second vertex.` : "Tap a first vertex."));
    else {
      const [a, b] = picks;
      const p = GA.pathBetween(n, E, a, b);
      if (!p) V.append(h("div", {class: "verdict bad", html: `<b>No path:</b> ${vname(a)} and ${vname(b)} are in different components.`}));
      else {
        for (let i = 0; i + 1 < p.length; i++) decor.e[GA.key(p[i], p[i + 1])] = {stroke: "var(--blue)", width: 5};
        if (info.forest) V.append(h("div", {class: "verdict good", html: `<b>The only path:</b> <span class="mono">${p.map(vname).join(" – ")}</span>` +
          `<span class="why">In a tree it is unique (KT Prop 12.4).</span>`}));
        else {
          /* show a second, different path if one exists: remove one edge of p and search again */
          let alt = null;
          for (let i = 0; i + 1 < p.length && !alt; i++) {
            const k = GA.key(p[i], p[i + 1]);
            const q = GA.pathBetween(n, E.filter(([u, v]) => GA.key(u, v) !== k), a, b);
            if (q) alt = q;
          }
          if (alt) {
            for (let i = 0; i + 1 < alt.length; i++) {
              const k = GA.key(alt[i], alt[i + 1]);
              if (!decor.e[k]) decor.e[k] = {stroke: "var(--orange)", width: 5, dash: "9 6"};
            }
            V.append(h("div", {class: "verdict warn", html: `<b>Two different paths</b> (blue, dashed orange):<span class="why mono">${p.map(vname).join(" – ")}<br>${alt.map(vname).join(" – ")}</span>` +
              ``}));
          } else V.append(h("div", {class: "verdict info", html: `Path: <span class="mono">${p.map(vname).join(" – ")}</span>`}));
        }
      }
    }
  }
  ed.setDecor(decor);
}

/* --------------------------------------------------------- Kruskal */
function stopK() { if (ktimer) { clearInterval(ktimer); ktimer = null; } }

function kupdate() {
  const g = kd.g, n = g.n, E = g.edges;
  const R = $("kruskal-read");
  R.textContent = "";
  const decor = {v: {}, e: {}};
  R.append(h("h4", {}, "Kruskal: avoid cycles"));
  if (!E.length) { R.append(h("p", {class: "sub"}, "Load a weighted example or draw one.")); kd.setDecor(decor); return; }
  const run = GA.kruskal(n, E);
  const S = run.steps.length;
  if (kstep === null) kstep = 0;
  kstep = Math.max(0, Math.min(S, kstep));
  const sorted = E.map(e => ({u: Math.min(e[0], e[1]), v: Math.max(e[0], e[1]), w: e[2]}))
    .sort((a, b) => a.w - b.w || a.u - b.u || a.v - b.v);
  const status = new Map();
  let total = 0;
  for (let i = 0; i < kstep; i++) {
    const s = run.steps[i];
    status.set(GA.key(s.edge.u, s.edge.v), s);
    if (s.take) total += s.edge.w;
  }
  for (const e of E) {
    const k = GA.key(e[0], e[1]), s = status.get(k);
    if (!s) decor.e[k] = {dim: false};
    else if (s.take) decor.e[k] = {stroke: "var(--green)", width: 6, labelFill: "var(--green-soft)", labelInk: "var(--green)"};
    else decor.e[k] = {stroke: "var(--red)", width: 2, dash: "4 6", labelInk: "var(--red)"};
  }
  const cur = kstep > 0 ? run.steps[kstep - 1] : null;
  if (cur && !cur.take) {
    const c = cur.cycle;
    for (let i = 0; i + 1 < c.length; i++) decor.e[GA.key(c[i], c[i + 1])] = {stroke: "var(--amber)", width: 7, labelFill: "var(--amber-soft)"};
    decor.e[GA.key(cur.edge.u, cur.edge.v)] = {stroke: "var(--red)", width: 4, dash: "10 6", labelInk: "var(--red)"};
  }
  if (cur) for (const v of [cur.edge.u, cur.edge.v]) decor.v[v] = {ring: cur.take ? "var(--green)" : "var(--red)"};

  let msg;
  if (!GA.isConnected(n, E)) msg = `<b>The graph is not connected</b>, so it has no spanning tree. Kruskal still builds a minimum spanning <i>forest</i>.`;
  else if (kstep === 0) msg = `Press ▶ to decide the next edge.`;
  else if (cur.take) msg = `<b>Take ${vname(cur.edge.u)}${vname(cur.edge.v)}</b> (weight ${cur.edge.w}): its ends are not yet connected by chosen edges, so no cycle.`;
  else msg = `<b>Skip ${vname(cur.edge.u)}${vname(cur.edge.v)}</b> (weight ${cur.edge.w}): the chosen edges already connect ${vname(cur.edge.u)} to ${vname(cur.edge.v)} along <span class="mono">${cur.cycle.map(vname).join("–")}</span> (amber), so it would close a cycle.`;
  if (kstep === S && run.spanning) msg += ` <b>Done:</b> ${n - 1} edges taken, a spanning tree of total weight <b>${run.total}</b>. That is the minimum (KT Algorithm 12.8).`;
  R.append(h("div", {class: "verdict " + (kstep === S && run.spanning ? "good" : "info"), html: msg}));

  const go = (k) => { stopK(); kstep = k; kupdate(); };
  const play = h("button", {type: "button", class: "btn small primary"}, ktimer ? "Pause" : "Play");
  play.onclick = () => {
    if (ktimer) { stopK(); kupdate(); return; }
    if (kstep >= S) kstep = 0;
    ktimer = setInterval(() => { if (kstep >= S) { stopK(); kupdate(); return; } kstep++; kupdate(); }, 1100);
    kupdate();
  };
  R.append(h("div", {class: "steprow"},
    h("button", {type: "button", class: "btn small", onclick: () => go(0), "aria-label": "restart"}, "⏮"),
    h("button", {type: "button", class: "btn small", onclick: () => go(kstep - 1), "aria-label": "back one edge"}, "◀"),
    play,
    h("button", {type: "button", class: "btn small", onclick: () => go(kstep + 1), "aria-label": "next edge"}, "▶"),
    h("button", {type: "button", class: "btn small", onclick: () => go(S), "aria-label": "finish"}, "⏭"),
    h("span", {class: "count"}, `weight so far ${total}`)));

  /* the sorted list, the way you would write it on paper */
  const list = h("div", {class: "seq", style: "margin-top:10px;line-height:1.75"});
  list.innerHTML = sorted.map(e => {
    const s = status.get(GA.key(e.u, e.v));
    const tag = !s ? "" : s.take ? ` <span class="chip green">✓</span>` : ` <span class="chip red">✗ cycle</span>`;
    const isCur = cur && GA.key(cur.edge.u, cur.edge.v) === GA.key(e.u, e.v);
    return `<div${isCur ? ' class="cur"' : ""}>${vname(e.u)}${vname(e.v)} &nbsp;${e.w}${tag}</div>`;
  }).join("");
  R.append(h("h4", {style: "margin-top:12px"}, "Edges sorted by weight"), list);
  if (sorted.some((e, i) => i && e.w === sorted[i - 1].w)) R.append(h("p", {class: "sub", style: "margin-top:8px;font-size:13px", html:
    "Ties are broken alphabetically."}));
  kd.setDecor(decor);
}

/* ------------------------------------------------------- check yourself */
function smallTreeish(r) {
  const kind = pick(r, ["tree", "tree", "cycle", "forest"]);
  const n = ri(r, 6, 8);
  const g = Presets.tree(r, n);
  if (kind === "cycle") {
    for (let t = 0; t < 30; t++) { const u = ri(r, 0, n - 1), v = ri(r, 0, n - 1);
      if (u !== v && !GA.hasEdge(g.edges, u, v)) { g.edges.push([u, v]); break; } }
  } else if (kind === "forest") g.edges.splice(ri(r, 0, g.edges.length - 1), 1);
  g.pos = Layout.scatter(n, r, 120);
  return g;
}
function qIsTree(r) {
  const g = smallTreeish(r);
  const info = GA.treeInfo(g.n, g.edges);
  const ans = info.tree ? "tree" : info.forest ? "forest" : "cyc";
  return {prompt: "What is this graph?", graph: g,
    choices: [{html: "A tree", ok: ans === "tree"}, {html: "A forest with more than one component", ok: ans === "forest"},
              {html: "Not a forest: it has a cycle", ok: ans === "cyc"}],
    explain: ans === "tree" ? `Connected, no cycles: a tree. Check: ${g.n} vertices and ${g.edges.length} = ${g.n} − 1 edges (Prop 16.3).`
      : ans === "forest" ? `No cycles, but ${info.components} components, so it is a forest and not a tree. Check: ${g.edges.length} edges = n − c = ${g.n} − ${info.components} (Cor 16.1).`
      : `It has the cycle <span class="mono">${info.cycle.map(vname).join("–")}–${vname(info.cycle[0])}</span>. Also a giveaway: it is connected with ${g.edges.length} edges, more than n − 1 = ${g.n - 1}.`};
}
function qLeaves(r) {
  const n = ri(r, 7, 10);
  const g = Presets.tree(r, n);
  g.pos = Layout.tree(n, g.edges);
  const L = GA.treeInfo(n, g.edges).leaves;
  const k = L.length;
  const opts = [...new Set([k + 1, k - 1, k + 2, n - k].filter(x => x > 0 && x !== k))].slice(0, 3);
  return {prompt: "How many <b>leaves</b> does this tree have?", graph: g,
    choices: [{html: String(k), ok: true}, ...opts.map(x => ({html: String(x), ok: false}))],
    explain: `A leaf is a vertex of degree 1: ${vlist(L)}. That is <b>${k}</b>. (The root drawn at the top counts too if its degree is 1.)`};
}
function qKruskalNext(r) {
  const g = Presets.weighted(r, ri(r, 5, 6));
  if (!GA.isConnected(g.n, g.edges) || g.edges.length < g.n + 1) return null;
  const run = GA.kruskal(g.n, g.edges);
  /* find a step where Kruskal skips the smallest remaining edge or just takes one */
  const takenIdx = run.steps.map((s, i) => s.take ? i : -1).filter(i => i >= 0);
  if (takenIdx.length < 3) return null;
  const at = takenIdx[ri(r, 1, takenIdx.length - 1)];
  const chosen = run.steps.slice(0, at).filter(s => s.take).map(s => s.edge);
  const nextE = run.steps[at].edge;
  const decor = {e: {}};
  for (const e of chosen) decor.e[GA.key(e.u, e.v)] = {stroke: "var(--green)", width: 6};
  const skipped = run.steps.slice(0, at).filter(s => !s.take).map(s => s.edge);
  const rest = run.steps.slice(at + 1).map(s => s.edge);
  const wrong = shuffle(r, skipped.concat(rest)).slice(0, 2);
  if (wrong.length < 1) return null;
  const nm = (e) => `${vname(e.u)}${vname(e.v)} (weight ${e.w})`;
  return {prompt: `Kruskal's algorithm has already chosen the green edges. Which edge does it choose <b>next</b>?`, graph: g, decor,
    choices: [{html: nm(nextE), ok: true}, ...wrong.map(e => ({html: nm(e), ok: false}))],
    explain: `Go down the edges in order of weight. Any edge whose ends are already joined by green edges would close a cycle and is skipped${skipped.length ? ` (that is why ${skipped.map(e => vname(e.u) + vname(e.v)).join(", ")} ${skipped.length === 1 ? "was" : "were"} skipped)` : ""}. The lightest remaining edge that joins two different green pieces is <b>${nm(nextE)}</b>.`};
}
function qOneCycle(r) {
  const n = ri(r, 8, 40);
  return {prompt: `T is a tree with ${n} vertices. You add <b>one</b> new edge between two of its vertices. How many cycles does the new graph have?`,
    choices: [{html: "Exactly one", ok: true}, {html: "None", ok: false}, {html: "At least two", ok: false}, {html: "It depends on which edge", ok: false}],
    explain: `The new edge xy joins two vertices that already had exactly one path between them in T. That path plus the new edge is a cycle, and it is the only one, since every cycle must use the new edge and continue along the unique x–y path. (This is the idea behind KT's exchange principle, Prop 12.4.)`};
}
function qTreeEdges(r) {
  const n = ri(r, 12, 60);
  return {prompt: `A tree has ${n} vertices. How many edges does it have?`,
    choices: [{html: String(n - 1), ok: true}, {html: String(n), ok: false}, {html: String(n + 1), ok: false}, {html: String(2 * (n - 1)), ok: false}],
    explain: `Prop 16.3: a tree with n vertices has n − 1 edges, here ${n - 1}. Picture building it one leaf at a time: every new vertex brings exactly one new edge, and the very first vertex brings none.`};
}

registerLab("trees", {build, redraw() { update(); kupdate(); },
  enter(q) { const p = q.get("g"), g = p && decodeGraph(p); if (g && ed) { if (g.edges.some(e => e.length > 2)) kd.set(g); else ed.set(g); } }});
})();
