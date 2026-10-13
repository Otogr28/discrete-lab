"use strict";
/* ===========================================================================
   Lab 6 · Probability (Hammack 7.1–7.4 + Keller–Trotter 10.4).
   1. The two-dice sample space: events as sets of cells, conditioning as
      shrinking the sample space, independence checked with exact fractions.
   2. Bayes' formula (Fact 7.4) as a tree and as a crowd of 400 people.
   3. Expected value (KT 10.4) and a simulation whose running average
      settles on it.

   Some example families and question types are left out of this lab on
   purpose, because they are assigned course problems and are not shown.
   =========================================================================== */
(function () {
const {F, Frac, DICE, dk} = CT;

/* ---------------------------------------------------------------- events */
const EVENTS = [
  ["sum is 7", (w, b) => w + b === 7],
  ["sum is at least 10", (w, b) => w + b >= 10],
  ["sum is even", (w, b) => (w + b) % 2 === 0],
  ["at least one 6", (w, b) => w === 6 || b === 6],
  ["white die shows 6", (w) => w === 6],
  ["white die is even", (w) => w % 2 === 0],
  ["black die is 1 or 2", (w, b) => b <= 2],
  ["white > black", (w, b) => w > b],
  ["product is odd", (w, b) => (w * b) % 2 === 1],
  ["sum is 4", (w, b) => w + b === 4],
];
const evSet = (f) => new Set(DICE.filter(([w, b]) => f(w, b)).map(([w, b]) => dk(w, b)));
let A = evSet(EVENTS[3][1]), B = evSet(EVENTS[4][1]), aName = EVENTS[3][0], bName = EVENTS[4][0];
let editing = "A", conditioned = false;

let bay = {prior: 0.02, sens: 0.9, fp: 0.08};

const DISTS = [
  ["KT's spinner, prize X(i) = i² (Example 10.15)", [[1, 1], [4, 2], [9, 1], [16, 1], [25, 3]]],
  ["One fair die", [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1]]],
  ["Raffle: $50 w.p. 1/100, $5 w.p. 9/100, else $0", [[50, 1], [5, 9], [0, 90]]],
  ["Bet: win $3 w.p. 1/3, lose $2 w.p. 2/3", [[3, 1], [-2, 2]]],
];
let dist = DISTS[0][1].map(x => x.slice());
let sims = [];

function build() { buildDice(); buildBayes(); buildEV();
  Quiz.mount($("prob-quiz"), [qDiceP, qCond, qIndep, qBayes, qEV, qComplement]); }

/* ================================================================== dice */
function buildDice() {
  const host = $("prob-dice");
  const left = h("div", {class: "panel pad"}), right = h("div", {class: "panel pad"});
  host.append(left, right);
  const mk = (which) => {
    const sel = h("select", {class: "btn", "aria-label": "event " + which},
      EVENTS.map(([name], i) => h("option", {value: String(i)}, name)), h("option", {value: "custom"}, "custom (tap cells)"));
    sel.value = String(EVENTS.findIndex(e => e[0] === (which === "A" ? aName : bName)));
    sel.onchange = () => {
      if (sel.value === "custom") { if (which === "A") aName = "custom"; else bName = "custom"; editing = which; }
      else { const [name, f] = EVENTS[+sel.value]; if (which === "A") { A = evSet(f); aName = name; } else { B = evSet(f); bName = name; } }
      drawDice();
    };
    return sel;
  };
  const selA = mk("A"), selB = mk("B");
  const editSeg = h("div", {class: "seg evseg", role: "group", "aria-label": "tapping a cell edits"});
  for (const k of ["A", "B"]) {
    const b = h("button", {type: "button", "aria-pressed": String(k === editing), "data-ev": k}, "Tap edits " + k);
    b.onclick = () => { editing = k; drawDice(); };
    editSeg.append(b);
  }
  const cond = h("button", {type: "button", class: "btn"}, "Condition on B");
  cond.onclick = () => { conditioned = !conditioned; drawDice(); };
  left.append(
    h("div", {class: "evrow evA"}, h("span", {class: "evtag"}, "Event A"), selA),
    h("div", {class: "evrow evB"}, h("span", {class: "evtag"}, "Event B"), selB),
    h("div", {class: "steprow", style: "margin:4px 0 12px"}, editSeg, cond),
    h("div", {class: "dicekey", id: "dice-key"}),
    h("div", {class: "dicehead"}, "rows: white die · columns: black die"),
    h("div", {class: "dice", id: "dice-grid"}));
  right.append(h("div", {id: "dice-read"}));
  drawDice.editSeg = editSeg; drawDice.cond = cond; drawDice.selA = selA; drawDice.selB = selB;
  drawDice();
}
function drawDice() {
  for (const b of drawDice.editSeg.children) b.setAttribute("aria-pressed", String(b.textContent.endsWith(editing)));
  drawDice.cond.classList.toggle("on", conditioned);
  if (aName === "custom") drawDice.selA.value = "custom";
  if (bName === "custom") drawDice.selB.value = "custom";
  const G = $("dice-grid");
  G.textContent = "";
  G.append(h("span", {}));
  for (let b = 1; b <= 6; b++) G.append(h("span", {class: "hd"}, b));
  for (let w = 1; w <= 6; w++) {
    G.append(h("span", {class: "hd"}, w));
    for (let b = 1; b <= 6; b++) {
      const k = dk(w, b), inA = A.has(k), inB = B.has(k);
      const tag = inA && inB ? "A∩B" : inA ? "A" : inB ? "B" : "";
      const cell = h("button", {type: "button", class: (inA ? "inA " : "") + (inB ? "inB " : "") + (conditioned && !inB ? "out" : ""),
        "aria-label": `white ${w}, black ${b}${inA ? ", in A" : ""}${inB ? ", in B" : ""}`, "aria-pressed": String(editing === "A" ? inA : inB)},
        h("span", {class: "xy"}, `${w},${b}`), tag ? h("span", {class: "tag"}, tag) : null);
      cell.onclick = () => {
        const S = editing === "A" ? A : B;
        if (S.has(k)) S.delete(k); else S.add(k);
        if (editing === "A") aName = "custom"; else bName = "custom";
        drawDice();
      };
      G.append(cell);
    }
  }
  const p = CT.probs(A, B);
  /* key above the grid: every region named, coloured and counted */
  const K = $("dice-key");
  K.textContent = "";
  for (const [cls, label, n] of [["kA", "A only", p.a - p.ab], ["kAB", "A ∩ B", p.ab], ["kB", "B only", p.b - p.ab], ["kN", "neither", 36 - p.a - p.b + p.ab]])
    K.append(h("span", {class: "key " + cls}, h("i", {}), `${label} `, h("b", {}, n)));
  const R = $("dice-read");
  R.textContent = "";
  const fr = (x) => x === null ? "undefined (B is empty)" : x.toString();
  const pU = p.pA.add(p.pB).sub(p.pAB);
  R.append(h("h4", {}, "Counting cells (Fact 7.1: p(E) = |E| / |S|, |S| = 36)"),
    h("dl", {class: "rows"},
      h("dt", {class: "dA"}, "p(A) · " + aName), h("dd", {}, `${p.a}/36 = ${p.pA}`),
      h("dt", {class: "dB"}, "p(B) · " + bName), h("dd", {}, `${p.b}/36 = ${p.pB}`),
      h("dt", {class: "dAB"}, "p(A ∩ B)"), h("dd", {}, `${p.ab}/36 = ${p.pAB}`),
      h("dt", {}, "p(A ∪ B) (Fact 7.2)"), h("dd", {}, `${p.pA} + ${p.pB} − ${p.pAB} = ${pU}`),
      h("dt", {}, "p(not A) (Fact 7.2)"), h("dd", {}, `1 − ${p.pA} = ${F(1).sub(p.pA)}`)));
  R.append(h("div", {class: "verdict " + (conditioned ? "warn" : "info"), style: "margin-top:12px", html:
    `<b>p(A | B) = ${fr(p.pAgivenB)}</b>` +
    (p.b ? `<span class="why">${p.ab} of B's ${p.b} cells are in A (Fact 7.3).</span>` : "")}));
  const ind = p.independent;
  R.append(h("div", {class: "verdict " + (ind ? "good" : "bad"), html:
    `<b>${ind ? "Independent" : "Dependent"}.</b>` +
    `<span class="why">p(A) = ${p.pA} ${p.pAgivenB && p.pAgivenB.eq(p.pA) ? "=" : "≠"} p(A | B) = ${fr(p.pAgivenB)} (Definition 7.3).<br>` +
    `Equivalently p(A)·p(B) = ${p.pA.mul(p.pB)} ${ind ? "=" : "≠"} p(A ∩ B) = ${p.pAB}.</span>`}));
  if (p.exclusive && p.a && p.b) R.append(h("div", {class: "verdict warn", html:
    `<b>Mutually exclusive</b> (Def 7.1): A ∩ B = ∅, so not independent.`}));
}

/* ================================================================= Bayes */
function buildBayes() {
  const host = $("prob-bayes");
  const left = h("div", {class: "panel pad"}), right = h("div", {class: "panel pad"});
  host.append(left, right);
  const slider = (key, label, min, max, step) => {
    const s = h("input", {type: "range", min, max, step, value: String(bay[key]), "aria-label": label});
    const o = h("output", {});
    const set = () => { o.textContent = (bay[key] * 100).toFixed(bay[key] < 0.1 ? 1 : 0) + "%"; };
    s.oninput = () => { bay[key] = +s.value; set(); drawBayes(); };
    set();
    return h("div", {class: "ctl"}, h("label", {}, label), s, o);
  };
  left.append(h("h4", {}, "A screening test"),
    h("div", {class: "evdefs"},
      h("div", {}, h("span", {class: "evpill s1"}, "S₁"), h("span", {}, "the person ", h("b", {}, "has"), " the condition")),
      h("div", {}, h("span", {class: "evpill s2"}, "S₂"), h("span", {}, "the person ", h("b", {}, "does not have"), " it")),
      h("div", {}, h("span", {class: "evpill e"}, "E"), h("span", {}, "the test comes out ", h("b", {}, "positive")))),
    slider("prior", "p(S₁)", "0.001", "0.5", "0.001"),
    slider("sens", "p(E | S₁)", "0.5", "1", "0.01"),
    slider("fp", "p(E | S₂)", "0", "0.5", "0.01"),
    h("div", {class: "tree", id: "bayes-tree"}));
  right.append(h("div", {id: "bayes-read"}));
  drawBayes();
}
const pc = (x) => (x * 100).toFixed(x < 0.01 ? 2 : 1) + "%";
function drawBayes() {
  const {prior, sens, fp} = bay;
  const b = CT.bayes(prior, sens, fp);
  /* the tree */
  const s = svg("svg", {viewBox: "0 0 520 250", role: "img", "aria-label": "probability tree for the screening test"});
  const node = (x, y, t, cls) => { const e = svg("text", {x, y, class: cls || "", "dominant-baseline": "central"}); e.textContent = t; s.append(e); };
  const ln = (x1, y1, x2, y2, hot) => s.append(svg("line", {x1, y1, x2, y2, class: hot ? "hot" : ""}));
  ln(20, 125, 145, 60); ln(20, 125, 145, 190);
  ln(232, 60, 320, 25, true); ln(232, 60, 320, 95); ln(232, 190, 320, 155, true); ln(232, 190, 320, 225);
  node(150, 60, "S₁ has it", "lbl"); node(150, 190, "S₂ doesn't", "lbl");
  node(60, 78, pc(prior)); node(60, 172, pc(1 - prior));
  node(250, 30, pc(sens)); node(250, 92, pc(1 - sens)); node(250, 160, pc(fp)); node(250, 222, pc(1 - fp));
  node(326, 25, "E positive  " + pc(b.joint1), ""); node(326, 95, "not E  " + pc(prior * (1 - sens)));
  node(326, 155, "E positive  " + pc(b.joint2)); node(326, 225, "not E  " + pc((1 - prior) * (1 - fp)));
  const host = $("bayes-tree"); host.textContent = ""; host.append(s);

  /* the crowd */
  const N = 400;
  const sick = Math.round(N * prior), sickPos = Math.round(sick * sens), healthyPos = Math.round((N - sick) * fp);
  const crowd = h("div", {class: "pop", "aria-label": `${N} people: ${sick} have the condition, ${sickPos + healthyPos} test positive`});
  for (let i = 0; i < N; i++) {
    let c;
    if (i < sick) c = i < sickPos ? "s1e" : "s1";
    else c = (i - sick) < healthyPos ? "s2e" : "s2";
    crowd.append(h("i", {class: c}));
  }
  const R = $("bayes-read");
  R.textContent = "";
  R.append(h("h4", {}, "p(S₁ | E): has it, given a positive test"),
    h("div", {class: "big"}, pc(b.post1 ?? 0), h("small", {}, "  by Bayes' formula")),
    h("div", {class: "formula", html: tex(`p(S_1\\mid E)=\\frac{p(S_1)\\,p(E\\mid S_1)}{p(S_1)\\,p(E\\mid S_1)+p(S_2)\\,p(E\\mid S_2)} = \\frac{${b.joint1.toFixed(4)}}{${b.joint1.toFixed(4)} + ${b.joint2.toFixed(4)}}`, true)}),
    h("p", {class: "sub", style: "font-size:13.5px"}, "Fact 7.4 (amber branches)."),
    h("h4", {style: "margin-top:12px"}, `${N} people`), crowd,
    h("div", {class: "legend", html: `<span><i class="dot" style="background:var(--red);box-shadow:0 0 0 2px var(--amber)"></i>has it, positive (${sickPos})</span><span><i class="dot" style="background:var(--red)"></i>has it, negative (${sick - sickPos})</span><span><i class="dot" style="background:var(--blue)"></i>doesn't, positive (${healthyPos})</span>`}),
    h("div", {class: "verdict info", style: "margin-top:10px", html: sickPos + healthyPos
      ? `Of the <b>${sickPos + healthyPos}</b> people who test positive, <b>${sickPos}</b> have the condition: ${sickPos}/${sickPos + healthyPos} ≈ ${pc(sickPos / (sickPos + healthyPos))}. `
      : "Nobody tests positive at these settings."}));
}

/* ======================================================== expected value */
function buildEV() {
  const host = $("prob-ev");
  const left = h("div", {class: "panel pad"}), right = h("div", {class: "panel pad"});
  host.append(left, right);
  const sel = h("select", {class: "btn", "aria-label": "example random variable"}, DISTS.map(([n], i) => h("option", {value: String(i)}, n)));
  sel.onchange = () => { dist = DISTS[+sel.value][1].map(x => x.slice()); sims = []; drawEV(); };
  left.append(h("h4", {}, "A random variable X"), h("div", {class: "ev"}, sel),
    h("p", {class: "sub", style: "font-size:13.5px"}, "p(x) = weight / total weight."),
    h("div", {id: "ev-table", class: "dist"}),
    h("div", {class: "steprow"},
      h("button", {type: "button", class: "btn small", onclick: () => { if (dist.length < 8) dist.push([0, 1]); sims = []; drawEV(); }}, "+ value"),
      h("button", {type: "button", class: "btn small", onclick: () => { if (dist.length > 1) dist.pop(); sims = []; drawEV(); }}, "− value")),
    h("div", {id: "ev-formula", style: "margin-top:10px"}));
  right.append(h("h4", {}, "Play it many times"),
    h("div", {class: "steprow", style: "margin-top:0"},
      h("button", {type: "button", class: "btn small primary", onclick: () => simulate(10)}, "+10 plays"),
      h("button", {type: "button", class: "btn small", onclick: () => simulate(100)}, "+100"),
      h("button", {type: "button", class: "btn small", onclick: () => simulate(1000)}, "+1000"),
      h("button", {type: "button", class: "btn small", onclick: () => { sims = []; drawEV(); }}, "Reset")),
    h("div", {class: "chart", id: "ev-chart", style: "margin-top:10px"}), h("div", {id: "ev-read"}));
  drawEV();
}
function distFracs() {
  const tot = dist.reduce((a, [, w]) => a + Math.max(0, w), 0);
  return dist.map(([x, w]) => ({x, p: tot ? F(Math.max(0, w), tot) : F(0)}));
}
function simulate(k) {
  const D = distFracs();
  if (!D.some(d => d.p.p > 0)) return;
  for (let i = 0; i < k && sims.length < 20000; i++) {
    let u = Math.random(), acc = 0, val = D[D.length - 1].x;
    for (const d of D) { acc += d.p.value; if (u < acc) { val = d.x; break; } }
    sims.push(val);
  }
  drawEV(true);
}
function drawEV(keepTable) {
  const D = distFracs();
  if (!keepTable) {
    const T = $("ev-table");
    T.textContent = "";
    T.append(h("span", {class: "mono", style: "font-size:12px;color:var(--muted)"}, "value x"), h("span", {class: "mono", style: "font-size:12px;color:var(--muted)"}, "weight"), h("span", {class: "mono", style: "font-size:12px;color:var(--muted)"}, "p(x)"));
    dist.forEach((row, i) => {
      const xi = h("input", {type: "number", value: String(row[0]), "aria-label": `value ${i + 1}`});
      const wi = h("input", {type: "number", min: "0", value: String(row[1]), "aria-label": `weight ${i + 1}`});
      const po = h("span", {class: "mono"});
      xi.oninput = () => { row[0] = parseFloat(xi.value) || 0; sims = []; drawEV(true); };
      wi.oninput = () => { row[1] = Math.max(0, parseInt(wi.value, 10) || 0); sims = []; drawEV(true); };
      po.dataset.i = i;
      T.append(xi, wi, po);
    });
  }
  $("ev-table").querySelectorAll("span[data-i]").forEach(s => { s.textContent = D[+s.dataset.i].p.toString(); });
  const allInt = dist.every(([x]) => Number.isInteger(x));
  const E = allInt ? CT.expectation(D) : null;
  const Ev = D.reduce((a, d) => a + d.x * d.p.value, 0);
  const terms = D.map(d => `${d.x < 0 ? "(" + d.x + ")" : d.x}\\cdot ${d.p.tex()}`).join(" + ");
  const Fm = $("ev-formula");
  Fm.innerHTML = "";
  Fm.append(h("div", {class: "formula", html: tex(`E(X) = \\sum_x x\\,p(x) = ${terms} = ${E ? E.tex() : ""}${E && E.q !== 1 ? "\\approx " + Ev.toFixed(3) : E ? "" : Ev.toFixed(4)}`, true)}),
    h("p", {class: "sub", style: "font-size:13.5px"}, "KT 10.4."));

  /* running average chart: x = number of plays, y = average of the plays so
     far, with E(X) as a labelled reference line. Ticks are round numbers,
     grid lines recessive, and a crosshair reads any point on hover. */
  const Wd = 540, Ht = 270, padL = 58, padR = 16, padT = 14, padB = 46;
  const PW = Wd - padL - padR, PH = Ht - padT - padB;
  const s = svg("svg", {viewBox: `0 0 ${Wd} ${Ht}`, role: "img", "aria-label": "average of the plays so far, against the number of plays, with E(X) as a reference line"});
  const xs = D.map(d => d.x);
  const n = sims.length;
  const nice = (lo, hi, count) => {
    const raw = (hi - lo) / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(st => st >= raw);
    const t0 = Math.floor(lo / step) * step, out = [];
    for (let v = t0; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };
  let lo = Math.min(...xs, Ev), hi = Math.max(...xs, Ev);
  if (hi === lo) { hi += 1; lo -= 1; }
  const yt = nice(lo, hi, 5);
  lo = Math.min(lo, yt[0]); hi = Math.max(hi, yt[yt.length - 1]);
  const xMax = Math.max(10, n);
  const xt = nice(0, xMax, 5).filter(v => v <= xMax);
  const Y = (v) => padT + PH * (1 - (v - lo) / (hi - lo));
  const X = (i) => padL + PW * (i / xMax);              /* i = number of plays */
  const ax = "font-family:var(--mono);font-size:11px;fill:var(--muted)";
  for (const v of yt) {
    s.append(svg("line", {x1: padL, x2: Wd - padR, y1: Y(v), y2: Y(v), style: "stroke:var(--grid);stroke-width:1"}));
    const t = svg("text", {x: padL - 8, y: Y(v) + 4, "text-anchor": "end", style: ax}); t.textContent = v; s.append(t);
  }
  for (const v of xt) {
    s.append(svg("line", {x1: X(v), x2: X(v), y1: padT + PH, y2: padT + PH + 5, style: "stroke:var(--muted)"}));
    const t = svg("text", {x: X(v), y: padT + PH + 18, "text-anchor": "middle", style: ax}); t.textContent = v; s.append(t);
  }
  s.append(svg("line", {x1: padL, x2: Wd - padR, y1: padT + PH, y2: padT + PH, style: "stroke:var(--muted);stroke-width:1"}));
  const tx = svg("text", {x: padL + PW / 2, y: Ht - 6, "text-anchor": "middle", style: "font-family:var(--sans);font-size:12.5px;font-weight:700;fill:var(--ink2)"});
  tx.textContent = "number of plays"; s.append(tx);
  const ty = svg("text", {x: 0, y: 0, transform: `translate(14 ${padT + PH / 2}) rotate(-90)`, "text-anchor": "middle", style: "font-family:var(--sans);font-size:12.5px;font-weight:700;fill:var(--ink2)"});
  ty.textContent = "average of X so far"; s.append(ty);
  /* E(X) reference line, labelled directly */
  s.append(svg("line", {x1: padL, x2: Wd - padR, y1: Y(Ev), y2: Y(Ev), style: "stroke:var(--amber);stroke-width:2;stroke-dasharray:6 5"}));
  const el = svg("text", {x: Wd - padR - 4, y: Y(Ev) - 7, "text-anchor": "end", style: "font-family:var(--sans);font-size:12px;font-weight:700;fill:var(--ink2)"});
  el.textContent = `E(X) = ${+Ev.toFixed(3)}`; s.append(el);
  const avgs = [];
  if (n) {
    let acc = 0;
    for (let i = 0; i < n; i++) { acc += sims[i]; avgs.push(acc / (i + 1)); }
    const step = Math.max(1, Math.floor(n / 600)), pts = [];
    for (let i = 0; i < n; i++) if (i % step === 0 || i === n - 1) pts.push(`${X(i + 1).toFixed(1)},${Y(avgs[i]).toFixed(1)}`);
    s.append(svg("polyline", {points: pts.join(" "), style: "fill:none;stroke:var(--blue);stroke-width:2;stroke-linejoin:round"}));
    /* crosshair + tooltip */
    const hair = svg("line", {y1: padT, y2: padT + PH, style: "stroke:var(--ink2);stroke-width:1;stroke-dasharray:3 3;visibility:hidden"});
    const dot = svg("circle", {r: 5, style: "fill:var(--blue);stroke:var(--panel);stroke-width:2;visibility:hidden"});
    const tip = svg("g", {style: "visibility:hidden;pointer-events:none"});
    const tipBox = svg("rect", {rx: 6, height: 24, style: "fill:var(--ink)"});
    const tipTx = svg("text", {y: 16, x: 8, style: "font-family:var(--mono);font-size:11.5px;fill:var(--bg)"});
    tip.append(tipBox, tipTx);
    const hit = svg("rect", {x: padL, y: padT, width: PW, height: PH, style: "fill:transparent;cursor:crosshair"});
    s.append(hair, dot, tip, hit);
    const show = (ev) => {
      const m = s.getScreenCTM(); if (!m) return;
      const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
      const i = Math.max(1, Math.min(n, Math.round((pt.x - padL) / PW * xMax)));
      const x = X(i), y = Y(avgs[i - 1]);
      for (const e of [hair, dot, tip]) e.style.visibility = "visible";
      hair.setAttribute("x1", x); hair.setAttribute("x2", x);
      dot.setAttribute("cx", x); dot.setAttribute("cy", y);
      tipTx.textContent = `play ${i} · average ${avgs[i - 1].toFixed(3)}`;
      const w = tipTx.getComputedTextLength() + 16;
      tipBox.setAttribute("width", w);
      const left = x + 10 + w > Wd - padR ? x - 10 - w : x + 10;
      tip.setAttribute("transform", `translate(${left} ${Math.max(padT, Math.min(padT + PH - 24, y - 30))})`);
    };
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", () => { for (const e of [hair, dot, tip]) e.style.visibility = "hidden"; });
  }
  const C = $("ev-chart"); C.textContent = ""; C.append(s);
  const avg = n ? sims.reduce((a, b) => a + b, 0) / n : null;
  const R = $("ev-read");
  R.textContent = "";
  R.append(h("div", {class: "legend", html: `<span><i style="background:var(--blue)"></i>average of the plays so far</span><span><i style="background:repeating-linear-gradient(90deg,var(--amber) 0 6px,transparent 6px 10px)"></i>E(X) = ${Ev.toFixed(3)}</span>`}),
    h("div", {class: "verdict info", style: "margin-top:10px", html: n
      ? `${n} plays: average <b>${avg.toFixed(3)}</b> (E(X) = ${Ev.toFixed(3)}).`
      : "Press a button to play."}));
}

/* ------------------------------------------------------- check yourself */
function qDiceP(r) {
  const [name, f] = pick(r, EVENTS);
  const S = evSet(f), p = F(S.size, 36);
  const opts = [...new Set([F(S.size + 1, 36), F(S.size, 30), F(Math.max(1, S.size - 2), 36), F(36 - S.size, 36)].map(String))].filter(x => x !== String(p)).slice(0, 3);
  return {prompt: `Roll a white die and a black die. What is the probability that the <b>${name}</b>?`,
    choices: [{html: String(p), ok: true}, ...opts.map(x => ({html: x, ok: false}))],
    explain: `All 36 outcomes (white, black) are equally likely. ${S.size} of them satisfy “${name}”, so p = ${S.size}/36 = <b>${p}</b> (Fact 7.1).`};
}
function qCond(r) {
  let a, b, A_, B_;
  for (let t = 0; t < 30; t++) {
    a = pick(r, EVENTS); b = pick(r, EVENTS);
    if (a === b) continue;
    A_ = evSet(a[1]); B_ = evSet(b[1]);
    if (B_.size) break;
  }
  const p = CT.probs(A_, B_);
  const right = p.pAgivenB;
  const opts = [...new Set([p.pA, p.pAB, p.pBgivenA || F(0)].map(String))].filter(x => x !== String(right)).slice(0, 3);
  return {prompt: `Two dice. Given that the <b>${b[0]}</b>, what is the probability that the <b>${a[0]}</b>?`,
    choices: [{html: String(right), ok: true}, ...opts.map(x => ({html: x, ok: false}))],
    explain: `Shrink the sample space to the ${p.b} outcomes where the ${b[0]}. Of those, ${p.ab} also have the ${a[0]}. So p(A|B) = ${p.ab}/${p.b} = <b>${right}</b> (Fact 7.3).`};
}
function qIndep(r) {
  const a = pick(r, EVENTS), b = pick(r, EVENTS);
  if (a === b) return null;
  const p = CT.probs(evSet(a[1]), evSet(b[1]));
  return {prompt: `Two dice. A: <b>${a[0]}</b>. B: <b>${b[0]}</b>. Are A and B independent?`,
    choices: [{html: "Independent", ok: p.independent}, {html: "Dependent", ok: !p.independent}],
    explain: `p(A) = ${p.pA}, p(B) = ${p.pB}, p(A∩B) = ${p.ab}/36 = ${p.pAB}. The product p(A)p(B) = ${p.pA.mul(p.pB)}, which ${p.independent ? "<b>equals</b>" : "<b>differs from</b>"} p(A∩B), so they are <b>${p.independent ? "independent" : "dependent"}</b>.`};
}
function qBayes(r) {
  const prior = pick(r, [F(1, 10), F(1, 5), F(1, 4), F(3, 10)]);
  const s = pick(r, [F(4, 5), F(9, 10), F(3, 4)]), fpv = pick(r, [F(1, 10), F(1, 5), F(1, 4)]);
  const ctx = pick(r, [
    ["A factory has two machines. Machine 1 makes", "of the parts; ", "of its parts are defective. Machine 2's parts are defective", "A part is defective. What is the probability it came from machine 1?"],
    ["An email filter: a fraction", "of all emails are spam; the filter flags", "of spam. It also flags", "An email is flagged. What is the probability it is spam?"],
  ]);
  const b = CT.bayes(prior, s, fpv);
  const right = b.post1;
  const opts = [...new Set([s, b.pE, b.joint1, prior].map(String))].filter(x => x !== String(right)).slice(0, 3);
  const text = ctx[0].startsWith("A factory")
    ? `A factory has two machines. Machine 1 makes ${prior} of the parts and ${s} of its parts are defective. Machine 2 makes the rest, and ${fpv} of its parts are defective. A part is defective. What is the probability it came from machine 1?`
    : `A fraction ${prior} of all emails are spam. A filter flags ${s} of spam emails, and also wrongly flags ${fpv} of the others. An email is flagged. What is the probability it is spam?`;
  return {prompt: text, choices: [{html: String(right), ok: true}, ...opts.map(x => ({html: x, ok: false}))],
    explain: `Bayes (Fact 7.4) with S₁ = ${ctx[0].startsWith("A factory") ? "machine 1" : "spam"}: \\(\\frac{${prior}\\cdot ${s}}{${prior}\\cdot ${s} + ${b.pS2}\\cdot ${fpv}} = \\frac{${b.joint1}}{${b.pE}} = ${right}\\).`};
}
function qEV(r) {
  const k = ri(r, 2, 3);
  const vals = shuffle(r, [-4, -2, -1, 0, 2, 3, 5, 8, 10]).slice(0, k);
  const ws = vals.map(() => ri(r, 1, 4));
  const tot = ws.reduce((a, b) => a + b, 0);
  const D = vals.map((x, i) => ({x, p: F(ws[i], tot)}));
  const E = CT.expectation(D);
  const naive = F(vals.reduce((a, b) => a + b, 0), k);
  const opts = [...new Set([naive, E.add(1), E.sub(F(1, 2))].map(String))].filter(x => x !== String(E)).slice(0, 3);
  return {prompt: `A game pays X dollars where ${D.map(d => `X = ${d.x} with probability ${d.p}`).join(", ")}. What is E(X)?`,
    choices: [{html: String(E), ok: true}, ...opts.map(x => ({html: x, ok: false}))],
    explain: `E(X) = Σ x·p(x) = ${D.map(d => `(${d.x})(${d.p})`).join(" + ")} = <b>${E}</b>. Just averaging the values (${naive}) ignores that they are not equally likely.`};
}
function qComplement(r) {
  const [name, f] = pick(r, EVENTS);
  const S = evSet(f);
  const p = F(36 - S.size, 36);
  return {prompt: `Two dice. What is the probability that it is <b>not</b> the case that the ${name}?`,
    choices: [{html: String(p), ok: true}, {html: String(F(S.size, 36)), ok: false}, {html: String(F(Math.max(0, 35 - S.size), 36)), ok: false}].filter((c, i, a) => a.findIndex(x => x.html === c.html) === i),
    explain: `Fact 7.2: p(not A) = 1 − p(A) = 1 − ${S.size}/36 = <b>${p}</b>. Counting the complement is often quicker.`};
}

registerLab("prob", {build, redraw() { drawBayes(); drawEV(true); }});
})();
