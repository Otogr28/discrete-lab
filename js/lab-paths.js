"use strict";
/* ===========================================================================
   Lab 2 · Traversability (Hammack 16.3 + Keller–Trotter 5.3).
   Euler: the verdict from degrees (KT Theorem 5.13), the book's own circuit
   finder (KT Algorithm 5.14) step by step, and a "trace it yourself" mode.
   Hamilton: an exhaustive search, plus Ore (Thm 16.2) and Dirac (KT 5.19),
   which are sufficient and not necessary, and the page shows that too.

   Vertices are numbered 1, 2, 3, ... here, as in Keller–Trotter, so
   "smallest label" in Algorithm 5.14 means exactly what the book means.

   Some example families and question types are left out of this lab on
   purpose, because they are assigned course problems and are not shown.
   =========================================================================== */
(function () {
let ed, view = "euler", step = null, timer = null, trace = null;
const nm = (v) => String(v + 1);
const nlist = (vs) => vs.map(nm).join(", ");

/* Keller–Trotter's Figure 5.15 graph, the worked example of Algorithm 5.14.
   Same vertices and edges as the book; the layout is ours (crossing-free). */
const FIG515 = {
  n: 11,
  edges: [[1,2],[2,4],[4,3],[3,1],[2,5],[5,8],[8,2],[4,6],[6,7],[7,4],[4,9],[9,6],[6,10],[10,4],[7,9],[9,11],[11,7]]
    .map(([u, v]) => [u - 1, v - 1]),
  pos: [{x:70,y:250},{x:200,y:110},{x:200,y:390},{x:330,y:250},{x:90,y:45},{x:580,y:240},
        {x:600,y:50},{x:270,y:40},{x:760,y:420},{x:490,y:185},{x:760,y:130}],
};

/* random connected graph whose odd vertices are fixed up to `wantOdd` */
function parityGraph(r, n, wantOdd) {
  for (let t = 0; t < 200; t++) {
    const g = Presets.random(r, n, 0.35 + r() * 0.2);
    let E = g.edges.map(e => e.slice());
    const toggle = (a, b) => {
      const i = E.findIndex(([u, v]) => (u === a && v === b) || (u === b && v === a));
      if (i >= 0) E.splice(i, 1); else E.push([Math.min(a, b), Math.max(a, b)]);
    };
    let odd = GA.eulerVerdict(n, E).odd;
    odd = shuffle(r, odd);
    while (odd.length > wantOdd) { toggle(odd.pop(), odd.pop()); }
    if (wantOdd === 2 && odd.length === 0) {
      const a = ri(r, 0, n - 1); let b = ri(r, 0, n - 1);
      if (a === b) continue;
      toggle(a, b);
    }
    const v = GA.eulerVerdict(n, E);
    if (v.odd.length !== wantOdd || !GA.isConnected(n, E) || E.length < n) continue;
    return {n, edges: E, pos: g.pos};
  }
  return null;
}

const PRESETS = [
  ["Book's Figure 5.15 (KT)", () => FIG515],
  ["Random graph with an Euler circuit", (r) => parityGraph(r, ri(r, 6, 8), 0)],
  ["Random graph with an Euler trail", (r) => parityGraph(r, ri(r, 6, 8), 2)],
  ["Random graph", (r) => { const g = Presets.random(r, ri(r, 6, 8), 0.4); return g; }],
  ["Cycle C₇", () => Presets.C(7)],
  ["Path P₆", () => Presets.P(6)],
  ["Hypercube Q₃", () => Presets.Q(3)],
  ["Petersen graph", () => Presets.petersen()],
];

function build() {
  const host = $("paths-bench");
  const left = h("div", {class: "panel"}), right = h("div", {});
  host.append(left, right);
  ed = new GraphEditor(left, {lab: "paths", presets: PRESETS, label: nm,
    onChange: () => { stopPlay(); step = null; trace = null; update(); }, onDrag: () => update(),
    aria: "graph editor for Euler and Hamilton questions"});
  const seg = h("div", {class: "seg", role: "group", "aria-label": "which question"});
  for (const [k, label] of [["euler", "Euler"], ["trace", "Trace it"], ["ham", "Hamilton"]]) {
    const b = h("button", {type: "button", "aria-pressed": String(k === view)}, label);
    b.onclick = () => {
      view = k; stopPlay(); step = null;
      trace = k === "trace" ? [] : null;
      ed.pickHandler = k === "trace" ? tapTrace : null;
      ed.hintEl.innerHTML = k === "trace"
        ? "<b>Tap a starting vertex</b>, then tap neighbours one at a time. Each edge may be used once."
        : "<b>Tap</b> empty space for a vertex · <b>tap two vertices</b> to join them · <b>drag</b> to move · <b>Erase</b> removes";
      for (const x of seg.children) x.setAttribute("aria-pressed", String(x === b));
      update();
    };
    seg.append(b);
  }
  ed.addTool(seg);
  right.append(h("div", {class: "panel pad", id: "paths-verdict"}),
               h("div", {class: "panel pad", id: "paths-detail"}));
  const p = hashParams().get("g"), g = p && decodeGraph(p);
  ed.set(g || FIG515);
  Quiz.mount($("paths-quiz"), [qEulerFig, qEulerSeq, qOre, qOreConverse, qFirstWalk]);
}

function stopPlay() { if (timer) { clearInterval(timer); timer = null; } }

/* ------------------------------------------------------------- tracing */
function tapTrace(v) {
  const g = ed.g;
  if (!trace) trace = [];
  if (!trace.length) { trace.push(v); update(); return; }
  const x = trace[trace.length - 1];
  const used = new Set();
  for (let i = 0; i + 1 < trace.length; i++) used.add(GA.key(trace[i], trace[i + 1]));
  if (!GA.hasEdge(g.edges, x, v)) { flash(`${nm(x)} and ${nm(v)} are not adjacent.`); return; }
  if (used.has(GA.key(x, v))) { flash(`Edge ${nm(x)}${nm(v)} is already used.`); return; }
  trace.push(v); update();
}
let flashMsg = null;
function flash(msg) { flashMsg = msg; update(); flashMsg = null; }

/* --------------------------------------------------------------- update */
function update() {
  const g = ed.g, n = g.n, E = g.edges;
  const V = $("paths-verdict"), Dt = $("paths-detail");
  V.textContent = ""; Dt.textContent = "";
  const decor = {v: {}, e: {}};
  const ev = GA.eulerVerdict(n, E);
  const d = GA.degrees(n, E);

  if (view === "euler" || view === "trace") {
    V.append(h("h4", {}, "Euler: every edge exactly once"));
    for (const v of ev.odd) decor.v[v] = {ring: "var(--red)", badge: d[v], badgeInk: "var(--red)"};
    for (let v = 0; v < n; v++) if (!(v in decor.v)) decor.v[v] = {badge: d[v]};
    if (!E.length) V.append(h("div", {class: "verdict"}, "No edges yet."));
    else if (!ev.connected) V.append(h("div", {class: "verdict bad", html:
      `<b>Neither a circuit nor a trail.</b><span class="why">The edges are not all connected.</span>`}));
    else if (ev.type === "circuit") V.append(h("div", {class: "verdict good", html:
      `<b>Euler circuit exists.</b><span class="why">Connected, all degrees even (KT Thm 5.13).</span>`}));
    else if (ev.type === "trail") V.append(h("div", {class: "verdict warn", html:
      `<b>Euler trail, but no circuit.</b><span class="why">Exactly two odd vertices (${nlist(ev.odd)}): start at one, end at the other.</span>`}));
    else V.append(h("div", {class: "verdict bad", html:
      `<b>Neither.</b><span class="why">${ev.odd.length} odd vertices (ringed); a trail allows at most 2.</span>`}));
    if (ev.isolated && E.length) V.append(h("div", {class: "verdict info", html:
      `${ev.isolated} isolated vert${ev.isolated === 1 ? "ex" : "ices"} ignored.`}));
  }

  if (view === "euler") eulerDetail(Dt, decor, ev);
  if (view === "trace") traceDetail(Dt, decor, ev);
  if (view === "ham") hamDetail(V, Dt, decor);
  ed.setDecor(decor);
}

function eulerDetail(Dt, decor, ev) {
  const g = ed.g, n = g.n, E = g.edges;
  Dt.append(h("h4", {}, "Algorithm 5.14, step by step"));
  if (!E.length) { Dt.append(h("p", {class: "sub"}, "Draw a graph or load the book's Figure 5.15.")); return; }
  const run = GA.eulerFinder(n, E);
  const S = run.steps.length;
  if (step === null) step = 0;
  step = Math.min(step, S - 1);
  const st = run.steps[step];
  const C = st.circuit;
  /* edges of the current circuit in green, the walk just spliced in violet */
  const walkKeys = new Set();
  if (st.walk) for (let i = 0; i + 1 < st.walk.length; i++) walkKeys.add(GA.key(st.walk[i], st.walk[i + 1]));
  let order = 0;
  for (let i = 0; i + 1 < C.length; i++) {
    const k = GA.key(C[i], C[i + 1]);
    order++;
    decor.e[k] = walkKeys.has(k) ? {stroke: "var(--violet)", width: 5, label: order, labelInk: "var(--violet)"}
                                 : {stroke: "var(--green)", width: 4.5, label: order, labelInk: "var(--green)"};
  }
  if (!run.ok && step === S - 1 && st.walk) {
    for (let i = 0; i + 1 < st.walk.length; i++)
      decor.e[GA.key(st.walk[i], st.walk[i + 1])] = {stroke: "var(--red)", width: 5, dash: "8 6"};
  }
  /* what is the next start? */
  let nextFrom = null;
  if (step < S - 1 && run.steps[step + 1].from !== null) nextFrom = run.steps[step + 1].circuit[run.steps[step + 1].from];
  if (nextFrom !== null) decor.v[nextFrom] = Object.assign(decor.v[nextFrom] || {}, {ring: "var(--amber)"});

  const seq = h("div", {class: "seq"});
  seq.innerHTML = "C = (" + C.map((v, i) => {
    const inWalk = st.walk && st.from !== null && i >= st.from && i < st.from + st.walk.length;
    return `<span class="${inWalk ? "new" : ""}">${nm(v)}</span>`;
  }).join(", ") + ")";
  let msg = "";
  if (step === 0) msg = `Start with the trivial circuit C = (${nm(C[0])}).`;
  else if (st.walk && !(step === S - 1 && !run.ok)) msg = `Walk <span class="mono">${st.walk.map(nm).join("→")}</span> (smallest neighbour each time) returned to its start: spliced into C.`;
  if (step === S - 1) {
    if (run.ok) msg += ` <b>Every edge is used: this is an Euler circuit.</b>`;
    else if (run.why === "odd") msg = `Walked <span class="mono">${run.walk.map(nm).join("→")}</span> (dashed red) and got stuck at <b>${nm(run.vertex)}</b>, not at the start. The algorithm returns ${nm(run.vertex)} as a vertex of <b>odd degree</b>: no Euler circuit.`;
    else msg = `No vertex of C has an unused edge, but edge ${nm(run.edge[0])}${nm(run.edge[1])} is unused: the graph is <b>not connected</b>.`;
  } else if (nextFrom !== null) msg += ` Next: the first vertex in C with an unused edge is <b>${nm(nextFrom)}</b> (amber ring).`;

  Dt.append(seq, h("p", {class: "sub", style: "margin-top:8px", html: msg}));
  const go = (k) => { stopPlay(); step = Math.max(0, Math.min(S - 1, k)); update(); };
  const play = h("button", {type: "button", class: "btn small primary"}, timer ? "Pause" : "Play");
  play.onclick = () => {
    if (timer) { stopPlay(); update(); return; }
    if (step >= S - 1) step = 0;
    timer = setInterval(() => { if (step >= S - 1) { stopPlay(); update(); return; } step++; update(); }, 1300);
    update();
  };
  Dt.append(h("div", {class: "steprow"},
    h("button", {type: "button", class: "btn small", onclick: () => go(0), "aria-label": "first step"}, "⏮"),
    h("button", {type: "button", class: "btn small", onclick: () => go(step - 1), "aria-label": "previous step"}, "◀"),
    play,
    h("button", {type: "button", class: "btn small", onclick: () => go(step + 1), "aria-label": "next step"}, "▶"),
    h("button", {type: "button", class: "btn small", onclick: () => go(S - 1), "aria-label": "last step"}, "⏭"),
    h("span", {class: "count"}, `step ${step + 1} / ${S}`)));
  Dt.append(h("div", {class: "legend", html:
    `<span><i style="background:var(--green)"></i>in C (numbers = order)</span><span><i style="background:var(--violet)"></i>just spliced in</span><span><i class="dot" style="background:var(--amber)"></i>next start</span>`}));

  if (ev.type === "trail") {
    const tr = GA.eulerTrail(n, E);
    Dt.append(h("div", {class: "verdict warn", style: "margin-top:12px", html:
      `<b>An Euler trail:</b> <span class="mono">${tr.map(nm).join("→")}</span>` +
      ``}));
  }
}

function traceDetail(Dt, decor, ev) {
  const g = ed.g, E = g.edges;
  Dt.append(h("h4", {}, "Your route"));
  const T = trace || [];
  const used = new Set();
  for (let i = 0; i + 1 < T.length; i++) {
    const k = GA.key(T[i], T[i + 1]);
    used.add(k);
    decor.e[k] = {stroke: "var(--blue)", width: 5, label: i + 1, labelInk: "var(--blue)"};
  }
  if (T.length) {
    decor.v[T[0]] = Object.assign(decor.v[T[0]] || {}, {fill: "var(--blue-soft)"});
    decor.v[T[T.length - 1]] = Object.assign(decor.v[T[T.length - 1]] || {}, {ring: "var(--amber)"});
  }
  Dt.append(h("div", {class: "seq"}, T.length ? T.map(nm).join(" → ") : "tap a vertex to start"));
  const left = E.length - used.size;
  let cls = "info", msg = `${used.size} of ${E.length} edges used.`;
  if (T.length > 1 && left === 0) {
    const closed = T[0] === T[T.length - 1];
    cls = "good";
    msg = closed ? "<b>Euler circuit!</b> Every edge once, and back where you started." : "<b>Euler trail!</b> Every edge exactly once.";
  } else if (T.length) {
    const x = T[T.length - 1];
    const free = GA.adjacency(g.n, E)[x].filter(y => !used.has(GA.key(x, y)));
    if (!free.length) { cls = "bad"; msg = `Stuck at ${nm(x)} with ${left} edge${left === 1 ? "" : "s"} left. ` +
      (ev.type === "none" ? "With this many odd vertices no route can work." :
       ev.type === "trail" ? `Hint: a trail has to start at an odd vertex (${nlist(ev.odd)}).` : "Try again: undo and choose differently."); }
  }
  if (flashMsg) Dt.append(h("div", {class: "verdict bad"}, flashMsg));
  Dt.append(h("div", {class: "verdict " + cls, style: "margin-top:8px", html: msg}));
  Dt.append(h("div", {class: "steprow"},
    h("button", {type: "button", class: "btn small", onclick: () => { if (trace && trace.length) trace.pop(); update(); }}, "Undo"),
    h("button", {type: "button", class: "btn small", onclick: () => { trace = []; update(); }}, "Start over")));
}

function hamDetail(V, Dt, decor) {
  const g = ed.g, n = g.n, E = g.edges;
  V.append(h("h4", {}, "Hamilton: every vertex exactly once"));
  if (n < 3) { V.append(h("div", {class: "verdict"}, "Draw at least three vertices.")); return; }
  const cyc = GA.hamilton(n, E, true);
  const path = cyc.found ? cyc : GA.hamilton(n, E, false);
  if (cyc.found) {
    const p = cyc.path;
    for (let i = 0; i < n; i++) decor.e[GA.key(p[i], p[(i + 1) % n])] = {stroke: "var(--green)", width: 5};
    p.forEach((v, i) => decor.v[v] = {badge: i + 1, badgeInk: "var(--green)"});
    V.append(h("div", {class: "verdict good", html: `<b>Hamiltonian.</b> A Hamilton cycle:<span class="why mono">${p.map(nm).join("→")}→${nm(p[0])}</span>`}));
  } else if (path.found) {
    const p = path.path;
    for (let i = 0; i + 1 < n; i++) decor.e[GA.key(p[i], p[i + 1])] = {stroke: "var(--amber)", width: 5};
    p.forEach((v, i) => decor.v[v] = {badge: i + 1, badgeInk: "var(--amber)"});
    V.append(h("div", {class: "verdict warn", html: `<b>Not Hamiltonian</b>, but it has a Hamilton <i>path</i>:<span class="why mono">${p.map(nm).join("→")}</span>`}));
  } else if (cyc.complete && path.complete) {
    V.append(h("div", {class: "verdict bad", html: `<b>No Hamilton cycle and no Hamilton path.</b><span class="why">Checked every ordering of the vertices.</span>`}));
  } else {
    V.append(h("div", {class: "verdict info", html: `Graph too big: search stopped early.`}));
  }

  /* the two sufficient conditions */
  const o = GA.ore(n, E), di = GA.dirac(n, E);
  Dt.append(h("h4", {}, "Sufficient conditions"));
  const d = GA.degrees(n, E);
  if (o.holds) Dt.append(h("div", {class: "verdict good", html:
    `<b>Ore holds</b> (Thm 16.2): every nonadjacent pair has degree sum ≥ ${n}.`}));
  else {
    const [x, y] = o.bad[0];
    decor.v[x] = Object.assign(decor.v[x] || {}, {ring: "var(--red)"});
    decor.v[y] = Object.assign(decor.v[y] || {}, {ring: "var(--red)"});
    Dt.append(h("div", {class: "verdict bad", html:
      `<b>Ore fails</b> (Thm 16.2): ${nm(x)} and ${nm(y)} are not adjacent and deg ${nm(x)} + deg ${nm(y)} = ${d[x]} + ${d[y]} = ${d[x] + d[y]} &lt; ${n}` +
      (o.bad.length > 1 ? ` (and ${o.bad.length - 1} more pair${o.bad.length > 2 ? "s" : ""})` : "") + `. Ringed red.`}));
  }
  if (di.holds) Dt.append(h("div", {class: "verdict good", html:
    `<b>Dirac holds</b> (KT 5.19): every degree ≥ ${di.need}.`}));
  else Dt.append(h("div", {class: "verdict bad", html:
    `<b>Dirac fails</b> (KT 5.19): needs degree ≥ ${di.need}, but ${nlist(di.bad.slice(0, 6))}${di.bad.length > 6 ? ", …" : ""} ${di.bad.length === 1 ? "has" : "have"} fewer.`}));
  if (cyc.found && !o.holds) Dt.append(h("div", {class: "verdict info", html:
    `Conditions fail, yet the graph is Hamiltonian: they are sufficient, not necessary.`}));
}

/* ------------------------------------------------------- check yourself */
function qEulerFig(r) {
  const want = pick(r, [0, 2, 4]);
  const g = parityGraph(r, ri(r, 5, 7), want);
  if (!g) return null;
  g.pos = Layout.circle(g.n);
  const v = GA.eulerVerdict(g.n, g.edges);
  const d = GA.degrees(g.n, g.edges);
  const right = v.type;
  return {prompt: "Which is true of this graph?", graph: g, label: nm,
    choices: [{html: "It has an Euler circuit", ok: right === "circuit"},
              {html: "It has an Euler trail but no Euler circuit", ok: right === "trail"},
              {html: "It has neither", ok: right === "none"}],
    explain: `Degrees: ${d.map((x, i) => nm(i) + ":" + x).join(", ")}. It is connected and has <b>${v.odd.length}</b> odd vert${v.odd.length === 1 ? "ex" : "ices"}${v.odd.length ? " (" + nlist(v.odd) + ")" : ""}. ` +
      (right === "circuit" ? "All even means an Euler circuit (KT Theorem 5.13)." : right === "trail" ? "Exactly two odd means an Euler trail from one odd vertex to the other, but no circuit." : "More than two odd vertices means no trail and no circuit."),
  };
}

function qEulerSeq(r) {
  const want = pick(r, [0, 2, 4, 6]);
  const g = parityGraph(r, ri(r, 6, 8), want);
  if (!g) return null;
  const d = GA.degrees(g.n, g.edges).sort((a, b) => b - a);
  const v = GA.eulerVerdict(g.n, g.edges);
  return {prompt: `A <b>connected</b> graph has degree sequence <span class="mono">(${d.join(", ")})</span>. What can you say?`,
    choices: [{html: "It has an Euler circuit", ok: v.type === "circuit"},
              {html: "It has an Euler trail but no Euler circuit", ok: v.type === "trail"},
              {html: "It has neither", ok: v.type === "none"}],
    explain: `You don't need the picture, only the parities. There ${v.odd.length === 1 ? "is" : "are"} <b>${v.odd.length}</b> odd degree${v.odd.length === 1 ? "" : "s"} in the list. Connected + 0 odd → circuit; 2 odd → trail only; more → neither.`};
}

function qOre(r) {
  const n = ri(r, 5, 7);
  const g = Presets.random(r, n, 0.55 + r() * 0.35);
  if (!GA.isConnected(n, g.edges)) return null;
  g.pos = Layout.circle(n);
  const o = GA.ore(n, g.edges), d = GA.degrees(n, g.edges);
  let explain;
  if (o.holds) explain = `Every pair of nonadjacent vertices has degree sum at least n = ${n} (degrees: ${d.map((x, i) => nm(i) + ":" + x).join(", ")}). So Ore's theorem applies and the graph is Hamiltonian.`;
  else { const [x, y] = o.bad[0]; explain = `${nm(x)} and ${nm(y)} are not adjacent and their degrees add to ${d[x]} + ${d[y]} = ${d[x] + d[y]} &lt; ${n}. One bad pair is enough: Ore's theorem does not apply. (The graph might still be Hamiltonian; the theorem just doesn't say.)`; }
  return {prompt: `Does <b>Ore's theorem</b> (Theorem 16.2) guarantee that this graph is Hamiltonian?`, graph: g, label: nm,
    choices: [{html: "Yes, its condition holds", ok: o.holds}, {html: "No, its condition fails", ok: !o.holds}], explain};
}

function qOreConverse(r) {
  const n = ri(r, 5, 9);
  return {prompt: `The cycle C<sub>${n}</sub> fails Ore's condition: two nonadjacent vertices have degrees adding to 4 &lt; ${n}. What follows?`,
    choices: [{html: `C<sub>${n}</sub> is not Hamiltonian`, ok: false},
              {html: `Nothing: Ore's theorem just doesn't apply`, ok: true},
              {html: `C<sub>${n}</sub> has no Hamilton path either`, ok: false}],
    explain: `C<sub>${n}</sub> obviously <i>is</i> Hamiltonian: the cycle itself. Ore's theorem is "if the condition holds, then Hamiltonian". When the condition fails you can't conclude anything. Sufficient, not necessary.`};
}

function qFirstWalk(r) {
  const g = parityGraph(r, ri(r, 5, 6), 0);
  if (!g || g.edges.length > 9) return null;
  g.pos = Layout.circle(g.n);
  const run = GA.eulerFinder(g.n, g.edges);
  if (run.steps.length < 3) return null;
  const W = run.steps[1].walk;
  /* the same walk but always taking the LARGEST neighbour, as a distractor */
  const A = GA.adjacency(g.n, g.edges), used = new Set(), W2 = [0];
  let x = 0;
  for (;;) {
    const f = A[x].filter(y => !used.has(GA.key(x, y)));
    if (!f.length) break;
    const y = f[f.length - 1]; used.add(GA.key(x, y)); W2.push(y); x = y;
  }
  const fmt = (w) => `<span class="mono">${w.map(nm).join("→")}</span>`;
  const wrong = [W2, W.slice(0, -1).concat(W.length > 3 ? [W[1]] : [])]
    .filter(w => w.join() !== W.join());
  const opts = [...new Map(wrong.map(w => [w.join(), w])).values()].slice(0, 2);
  if (!opts.length) return null;
  return {prompt: `Algorithm 5.14 starts at vertex 1. What is the <b>first closed walk</b> it builds?`, graph: g, label: nm,
    choices: [{html: fmt(W), ok: true}, ...opts.map(w => ({html: fmt(w), ok: false}))],
    explain: `From each vertex the algorithm follows the unused edge to the neighbour with the <b>smallest</b> label, until it is stuck. That gives ${fmt(W)}. Back at 1, it is spliced into C and the algorithm looks for the first vertex of C that still has unused edges.`};
}

registerLab("paths", {build, redraw: update,
  enter(q) { const p = q.get("g"), g = p && decodeGraph(p); if (g && ed) ed.set(g); }});
})();
