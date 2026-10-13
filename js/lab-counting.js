"use strict";
/* ===========================================================================
   Lab 5 · Counting (Hammack Chapter 6).
   The counting table (Facts 6.1, 6.4, 6.5, 6.8) with every outcome listed
   next to the formula, stars and bars (Fact 6.8), Pascal's triangle and the
   binomial theorem (Theorem 6.6), and inclusion–exclusion on a Venn
   diagram (Fact 6.7).
   =========================================================================== */
(function () {
const L = "abcdefgh";
let tn = 4, tk = 2, order = true, rep = false;
let sbCounts = [2, 0, 1, 3];
let pasSel = [5, 2];
let vennSets = 3, regions = {1: 6, 2: 5, 3: 2, 4: 4, 5: 1, 6: 3, 7: 2}, hoverMask = null;

function build() {
  buildTable(); buildStars(); buildPascal(); buildVenn();
  Quiz.mount($("count-quiz"), [qWhich, qWhich, qMultiset, qWord, qBinom, qIncExc]);
}

/* ================================================================== table */
const CELLS = [
  {order: true, rep: true, name: "Lists, repetition allowed", f: (n, k) => `n^k`, src: "Fact 6.1 (multiplication)"},
  {order: true, rep: false, name: "Lists, no repetition (k-permutations)", f: () => `P(n,k)=\\frac{n!}{(n-k)!}`, src: "Fact 6.4"},
  {order: false, rep: false, name: "Subsets", f: () => `\\binom{n}{k}=\\frac{n!}{k!\\,(n-k)!}`, src: "Fact 6.5"},
  {order: false, rep: true, name: "Multisets", f: () => `\\binom{k+n-1}{k}`, src: "Fact 6.8"},
];
function buildTable() {
  const host = $("count-table");
  const left = h("div", {class: "panel pad"}), right = h("div", {class: "panel pad"});
  host.append(left, right);
  const nS = h("input", {type: "range", min: "1", max: "6", value: String(tn), "aria-label": "n, the size of the set"});
  const kS = h("input", {type: "range", min: "0", max: "6", value: String(tk), "aria-label": "k, how many to choose"});
  const nO = h("output", {}), kO = h("output", {});
  nS.oninput = () => { tn = +nS.value; drawTable(); };
  kS.oninput = () => { tk = +kS.value; drawTable(); };
  left.append(h("h4", {}, "Choose k things from an n-element set"),
    h("div", {class: "ctl"}, h("label", {}, "n (set size)"), nS, nO),
    h("div", {class: "ctl"}, h("label", {}, "k (how many)"), kS, kO),
    h("div", {id: "count-set", class: "mono", style: "margin:6px 0 12px;color:var(--ink2)"}),
    h("div", {class: "table2", id: "count-cells"}));
  right.append(h("div", {id: "count-result"}));
  drawTable.nO = nO; drawTable.kO = kO;
  drawTable();
}
function drawTable() {
  drawTable.nO.textContent = tn; drawTable.kO.textContent = tk;
  $("count-set").textContent = `X = {${L.slice(0, tn).split("").join(", ")}}`;
  const cells = $("count-cells");
  cells.textContent = "";
  cells.append(h("span", {}), h("span", {class: "h"}, "no repetition"), h("span", {class: "h"}, "repetition allowed"));
  for (const ord of [true, false]) {
    cells.append(h("span", {class: "h", style: "align-self:center"}, ord ? "order matters" : "order doesn't"));
    for (const rp of [false, true]) {
      const c = CELLS.find(x => x.order === ord && x.rep === rp);
      const b = h("button", {type: "button", class: "cell" + (ord === order && rp === rep ? " on" : ""), "aria-pressed": String(ord === order && rp === rep)},
        h("div", {}, c.name), h("div", {class: "f", html: tex(c.f())}), h("div", {class: "src"}, c.src));
      b.onclick = () => { order = ord; rep = rp; drawTable(); };
      cells.append(b);
    }
  }
  const R = $("count-result");
  R.textContent = "";
  const N = CT.countFormula(tn, tk, order, rep);
  let eval_;
  if (order && rep) eval_ = `${tn}^{${tk}} = ${N}`;
  else if (order) eval_ = `P(${tn},${tk}) = ${tk === 0 ? "1" : Array.from({length: tk}, (_, i) => tn - i).join("\\cdot ")} = ${N}`;
  else if (!rep) eval_ = `\\binom{${tn}}{${tk}} = ${N}`;
  else eval_ = `\\binom{${tk}+${tn}-1}{${tk}} = \\binom{${tk + tn - 1}}{${tk}} = ${N}`;
  R.append(h("h4", {}, "The count"), h("div", {class: "formula", html: tex(eval_, true)}));
  if (!rep && tk > tn) R.append(h("div", {class: "verdict info", html: `k &gt; n: you can't pick ${tk} <i>different</i> elements from ${tn}, so the count is 0.`}));
  const CAP = 720;
  const list = CT.enumerate(tn, tk, order, rep, CAP);
  const fmt = (x) => order ? (x.length ? x.map(i => L[i]).join("") : "()") : rep ? "[" + x.map(i => L[i]).join(",") + "]" : "{" + x.map(i => L[i]).join(",") + "}";
  const box = h("div", {class: "outcomes"});
  if (order && !rep && tk >= 2 && tk <= tn) {
    /* group the lists by the set they use: C(n,k) groups of k! lists */
    const groups = new Map();
    for (const x of list) { const s = x.slice().sort((a, b) => a - b).join(""); (groups.get(s) || groups.set(s, []).get(s)).push(x); }
    for (const [s, xs] of groups) box.append(h("div", {class: "grp"},
      h("span", {class: "glab"}, "{" + s.split("").map(i => L[+i]).join(",") + "}"), xs.map(x => h("span", {class: "o"}, fmt(x)))));
    R.append(h("div", {class: "verdict info", html:
      `Each row is one subset in all its orders: \\(P(${tn},${tk}) = \\binom{${tn}}{${tk}}\\cdot ${tk}!\\).`}));
  } else box.append(...list.map(x => h("span", {class: "o", title: !order && rep ? "stars and bars: " + CT.starsBars(L.slice(0, tn).split("").map((_, i) => x.filter(y => y === i).length)) : null}, fmt(x))));
  R.append(h("h4", {style: "margin-top:12px"}, `All ${N} outcome${N === 1 ? "" : "s"}` + (N > CAP ? ` (first ${CAP} shown)` : "")), box);
  renderMath(R);
}

/* =========================================================== stars & bars */
function buildStars() {
  const host = $("count-stars");
  const left = h("div", {class: "panel pad"}), right = h("div", {class: "panel pad"});
  host.append(left, right);
  const nS = h("input", {type: "range", min: "2", max: "6", value: String(sbCounts.length), "aria-label": "number of types"});
  const nO = h("output", {});
  nS.oninput = () => {
    const n = +nS.value;
    sbCounts = sbCounts.slice(0, n); while (sbCounts.length < n) sbCounts.push(0);
    drawStars();
  };
  left.append(h("h4", {}, "A multiset, as bins"), h("div", {class: "ctl"}, h("label", {}, "n (types)"), nS, nO),
    h("div", {class: "bins", id: "sb-bins"}));
  right.append(h("div", {id: "sb-read"}));
  drawStars.nO = nO;
  drawStars();
}
function drawStars() {
  const n = sbCounts.length, k = sbCounts.reduce((a, b) => a + b, 0);
  drawStars.nO.textContent = n;
  const bins = $("sb-bins");
  bins.textContent = "";
  sbCounts.forEach((c, i) => {
    bins.append(h("div", {class: "bin"},
      h("div", {class: "name"}, L[i] + " × " + c),
      h("div", {class: "dots"}, Array.from({length: c}, () => h("i", {}))),
      h("div", {class: "pm"},
        h("button", {type: "button", class: "btn small", "aria-label": "one fewer " + L[i], onclick: () => { if (sbCounts[i]) sbCounts[i]--; drawStars(); }}, "−"),
        h("button", {type: "button", class: "btn small", "aria-label": "one more " + L[i], onclick: () => { if (k < 12) sbCounts[i]++; drawStars(); }}, "+"))));
  });
  const R = $("sb-read");
  R.textContent = "";
  const s = CT.starsBars(sbCounts);
  const sb = h("div", {class: "sb", "aria-label": "star and bar string " + s});
  [...s].forEach((ch, i) => sb.append(h("span", {class: ch === "|" ? "bar" : ""}, ch === "*" ? "★" : "|", h("small", {}, i + 1))));
  const barsAt = [...s].map((ch, i) => ch === "|" ? i + 1 : null).filter(x => x !== null);
  R.append(h("h4", {}, "The same multiset as stars and bars"), sb,
    h("p", {class: "sub", style: "margin-top:6px", html:
      `${k} stars, ${n - 1} bars, length ${k + n - 1}. Bars at positions <span class="mono">{${barsAt.join(", ") || "none"}}</span>.`}),
    h("div", {class: "formula", html: tex(`\\#\\{\\text{${k}-element multisets from ${n} types}\\} = \\binom{${k}+${n}-1}{${n}-1} = \\binom{${k + n - 1}}{${n - 1}} = ${CT.multisets(n, k)}`, true)}),
    h("p", {class: "sub", style: "font-size:13.5px"}, "Fact 6.8."));
}

/* ================================================================= Pascal */
function buildPascal() {
  const host = $("count-pascal");
  const left = h("div", {class: "panel pad pascal"}), right = h("div", {class: "panel pad"});
  host.append(left, right);
  left.append(h("h4", {}, "Pascal's triangle (tap an entry)"), h("div", {id: "pascal-svg"}));
  right.append(h("div", {id: "pascal-read"}));
  drawPascal();
}
function drawPascal() {
  const N = 10, cw = 46, ch = 32, Wd = (N + 1) * cw, Ht = (N + 1) * ch + 6;
  const s = svg("svg", {viewBox: `0 0 ${Wd} ${Ht}`, width: Wd, style: "max-width:100%;height:auto", role: "img", "aria-label": "Pascal's triangle, rows 0 to 10"});
  const [sn, sk] = pasSel;
  for (let n = 0; n <= N; n++) for (let k = 0; k <= n; k++) {
    const x = Wd / 2 + (k - n / 2) * cw, y = n * ch + 3;
    const cls = "pc" + (n === sn && k === sk ? " sel" : "") + (n === sn - 1 && (k === sk - 1 || k === sk) && sk > 0 && sk < sn ? " par" : "") + (n === sn ? " row" : "");
    const g = svg("g", {class: cls, tabindex: "0", role: "button", "aria-label": `${n} choose ${k} equals ${CT.C(n, k)}`});
    g.append(svg("rect", {x: x - cw / 2 + 2, y, width: cw - 4, height: ch - 4, rx: 6}));
    const t = svg("text", {x, y: y + (ch - 4) / 2}); t.textContent = CT.C(n, k);
    g.append(t);
    const choose = () => { pasSel = [n, k]; drawPascal(); };
    g.addEventListener("click", choose);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
    s.append(g);
  }
  const host = $("pascal-svg");
  host.textContent = ""; host.append(s);
  const R = $("pascal-read");
  R.textContent = "";
  R.append(h("h4", {}, "The entry you picked"),
    h("div", {class: "formula", html: tex(`\\binom{${sn}}{${sk}} = \\frac{${sn}!}{${sk}!\\,${sn - sk}!} = ${CT.C(sn, sk)}`, true)}),
    h("p", {class: "sub"}, ""));
  if (sk > 0 && sk < sn) R.append(h("div", {class: "verdict warn", html:
    `<b>Sum of the two above (amber):</b>` + tex(`\\binom{${sn}}{${sk}} = \\binom{${sn - 1}}{${sk - 1}} + \\binom{${sn - 1}}{${sk}} = ${CT.C(sn - 1, sk - 1)} + ${CT.C(sn - 1, sk)}`, true) +
    ``}));
  const terms = [];
  for (let k = 0; k <= sn; k++) {
    const c = CT.C(sn, k), a = sn - k, b = k;
    const x = a === 0 ? "" : a === 1 ? "x" : `x^{${a}}`, y = b === 0 ? "" : b === 1 ? "y" : `y^{${b}}`;
    const body = (c === 1 && (x || y) ? "" : String(c)) + x + y;
    terms.push(k === sk ? `\\boxed{${body}}` : body);
  }
  R.append(h("h4", {style: "margin-top:14px"}, `Row ${sn} is the binomial theorem (Theorem 6.6)`),
    h("div", {class: "formula", html: tex(`(x+y)^{${sn}} = ${terms.join(" + ")}`, true)}),
    h("p", {class: "sub", style: "font-size:13.5px"}, `Row sum: ${2 ** sn} = 2^${sn}.`));
}

/* =================================================================== Venn */
const GEO = {
  3: {circles: [[250, 190], [390, 190], [320, 300]], r: 120, h: 430,
      at: {1: [185, 150], 2: [455, 150], 4: [320, 375], 3: [320, 142], 5: [238, 272], 6: [402, 272], 7: [320, 222]}},
  2: {circles: [[265, 180], [405, 180]], r: 125, h: 330, at: {1: [205, 180], 2: [465, 180], 3: [335, 180]}},
};
const SETN = ["A", "B", "C"];
const regionName = (m, sets) => {
  const ins = [], outs = [];
  for (let b = 0; b < sets; b++) (m & (1 << b) ? ins : outs).push(SETN[b]);
  return ins.join("∩") + (outs.length ? " only" : "");
};
function buildVenn() {
  const host = $("count-venn");
  const left = h("div", {class: "panel pad"}), right = h("div", {class: "panel pad"});
  host.append(left, right);
  const seg = h("div", {class: "seg", role: "group", "aria-label": "number of sets"});
  for (const k of [2, 3]) {
    const b = h("button", {type: "button", "aria-pressed": String(k === vennSets)}, k + " sets");
    b.onclick = () => { vennSets = k; for (const x of seg.children) x.setAttribute("aria-pressed", String(x === b)); drawVenn(); };
    seg.append(b);
  }
  left.append(h("div", {class: "steprow", style: "margin:0 0 8px"}, seg), h("div", {id: "venn-svg"}), h("div", {id: "venn-inputs", class: "dist"}));
  right.append(h("div", {id: "venn-read"}));
  drawVenn();
}
function drawVenn() {
  drawVennSvg();
  const sets = vennSets;
  const I = $("venn-inputs");
  I.textContent = "";
  for (let m = 1; m < (1 << sets); m++) {
    const inp = h("input", {type: "number", min: "0", max: "99", value: String(regions[m] || 0), "aria-label": "elements in " + regionName(m, sets)});
    inp.oninput = () => { regions[m] = Math.max(0, Math.min(99, parseInt(inp.value, 10) || 0)); drawVennRead(); drawVennSvg(); };
    I.append(h("span", {class: "mono", style: "font-size:13px;color:var(--ink2)"}, regionName(m, sets)), inp, h("span", {}));
  }
  drawVennRead();
}
function drawVennSvg() {
  const sets = vennSets, G = GEO[sets];
  const s = svg("svg", {viewBox: `0 0 640 ${G.h}`, style: "width:100%;height:auto;display:block", role: "img", "aria-label": `Venn diagram of ${sets} sets with region counts`});
  const defs = svg("defs", {});
  G.circles.forEach(([cx, cy], i) => {
    const cp = svg("clipPath", {id: `vc${i}`}); cp.append(svg("circle", {cx, cy, r: G.r})); defs.append(cp);
    const mk = svg("mask", {id: `vm${i}`}); mk.append(svg("rect", {x: 0, y: 0, width: 640, height: G.h, fill: "white"}), svg("circle", {cx, cy, r: G.r, fill: "black"})); defs.append(mk);
  });
  s.append(defs);
  /* highlight: every region that the hovered term counts */
  if (hoverMask) {
    for (let m = 1; m < (1 << sets); m++) {
      if ((m & hoverMask) !== hoverMask) continue;
      let node = svg("rect", {x: 0, y: 0, width: 640, height: G.h, style: "fill:var(--amber-soft)"});
      for (let b = 0; b < sets; b++) {
        const g = svg("g", (m & (1 << b)) ? {"clip-path": `url(#vc${b})`} : {mask: `url(#vm${b})`});
        g.append(node); node = g;
      }
      s.append(node);
    }
  }
  G.circles.forEach(([cx, cy], i) => {
    s.append(svg("circle", {cx, cy, r: G.r, style: `fill:none;stroke:${["var(--blue)", "var(--orange)", "var(--green)"][i]};stroke-width:3`}));
    const lx = cx + (i === 0 ? -G.r * 0.8 : i === 1 ? G.r * 0.8 : G.r * 0.95), ly = cy + (i === 2 ? G.r * 0.62 : -G.r * 0.75);
    const t = svg("text", {x: lx, y: ly, style: `font-family:var(--serif);font-size:24px;font-weight:700;fill:${["var(--blue)", "var(--orange)", "var(--green)"][i]};text-anchor:middle`});
    t.textContent = SETN[i]; s.append(t);
  });
  for (const [m, [x, y]] of Object.entries(G.at)) {
    const t = svg("text", {x, y, style: "font-family:var(--mono);font-size:20px;fill:var(--ink);text-anchor:middle;dominant-baseline:central;font-weight:600"});
    t.textContent = regions[m] || 0; s.append(t);
  }
  const host = $("venn-svg"); host.textContent = ""; host.append(s);
}
function drawVennRead() {
  const sets = vennSets;
  const v = CT.venn(regions, sets);
  const R = $("venn-read");
  R.textContent = "";
  const nameOf = (mask) => { const s = []; for (let b = 0; b < sets; b++) if (mask & (1 << b)) s.push(SETN[b]); return "|" + s.join("∩") + "|"; };
  const termsTex = v.terms.map((t, i) => (i === 0 ? "" : t.sign > 0 ? " + " : " − ") + nameOf(t.mask)).join("");
  const numsTex = v.terms.map((t, i) => (i === 0 ? "" : t.sign > 0 ? " + " : " − ") + t.size).join("");
  R.append(h("h4", {}, `|${SETN.slice(0, sets).join("∪")}| by inclusion–exclusion`),
    h("span", {}));
  const row = h("div", {class: "ev"});
  v.terms.forEach((t, i) => {
    const b = h("button", {type: "button", class: "btn small"}, (i === 0 ? "" : t.sign > 0 ? "+ " : "− ") + nameOf(t.mask) + " = " + t.size);
    const on = () => { hoverMask = t.mask; drawVennSvg(); };
    b.addEventListener("mouseenter", on); b.addEventListener("focus", on); b.addEventListener("click", on);
    b.addEventListener("mouseleave", () => { hoverMask = null; drawVennSvg(); });
    b.addEventListener("blur", () => { hoverMask = null; drawVennSvg(); });
    row.append(b);
  });
  R.append(row,
    h("div", {class: "formula mono", style: "font-size:15px"}, `${numsTex} = ${v.formula}`),
    h("div", {class: "verdict good", html: `Adding the regions directly: <b>${v.direct}</b>. Same answer.` +
      ``}));
}

/* ------------------------------------------------------- check yourself */
const SCEN = [
  {order: true, rep: true, make: (r) => { const n = pick(r, [5, 8, 10, 12]), k = pick(r, [3, 4, 5]); return [n, k, `A lock code is a sequence of ${k} symbols, each one of ${n} possible symbols, and symbols may repeat. How many codes are there?`]; }},
  {order: true, rep: false, make: (r) => { const n = ri(r, 7, 15), k = 3; return [n, k, `${n} runners finish a race (no ties). How many ways can the gold, silver and bronze medals be awarded?`]; }},
  {order: false, rep: false, make: (r) => { const n = ri(r, 9, 16), k = pick(r, [3, 4]); return [n, k, `A club with ${n} members picks a committee of ${k} (no roles, just members). How many committees are possible?`]; }},
  {order: false, rep: true, make: (r) => { const n = pick(r, [3, 4, 5]), k = pick(r, [6, 7, 8]); return [n, k, `A bakery sells ${n} kinds of bagels. You buy a bag of ${k} bagels (repeats allowed; the order in the bag doesn't matter). How many different bags are possible?`]; }},
];
function qWhich(r) {
  const sc = pick(r, SCEN);
  const [n, k, prompt] = sc.make(r);
  const right = CT.countFormula(n, k, sc.order, sc.rep);
  const others = SCEN.filter(x => x !== sc).map(x => CT.countFormula(n, k, x.order, x.rep));
  const vals = [...new Set(others.filter(x => x !== right))];
  const cell = CELLS.find(c => c.order === sc.order && c.rep === sc.rep);
  return {prompt, choices: [{html: String(right), ok: true}, ...vals.map(x => ({html: String(x), ok: false}))],
    explain: `Ask the two questions: does order matter? <b>${sc.order ? "Yes" : "No"}</b>. Can things repeat? <b>${sc.rep ? "Yes" : "No"}</b>. That is the cell “${cell.name}” (${cell.src}): \\(${cell.f()}\\) with n = ${n}, k = ${k}, giving <b>${right}</b>. The other choices are the other three cells of the table.`};
}
function qMultiset(r) {
  const n = ri(r, 3, 5), k = ri(r, 4, 9);
  const right = CT.multisets(n, k);
  const opts = [...new Set([CT.C(k + n, k), CT.C(n + k - 1, n), Math.pow(n, k), CT.C(k + n - 2, k)].filter(x => x !== right))].slice(0, 3);
  return {prompt: `How many ways can you put ${k} identical marbles into ${n} distinct jars (jars may stay empty)?`,
    choices: [{html: String(right), ok: true}, ...opts.map(x => ({html: String(x), ok: false}))],
    explain: `A distribution is a string of ${k} stars and ${n - 1} bars (walls between jars), length ${k + n - 1}. Choose where the ${n - 1} bars go: \\(\\binom{${k + n - 1}}{${n - 1}} = ${right}\\) (Fact 6.8).`};
}
const WORDS = ["BANANA", "LETTER", "COFFEE", "PEPPER", "GORDON", "BOOKKEEPER", "TATTOO", "REFERENCE"];
function qWord(r) {
  const w = pick(r, WORDS);
  const counts = {};
  for (const c of w) counts[c] = (counts[c] || 0) + 1;
  const ps = Object.values(counts);
  const right = CT.multinomial(ps);
  const opts = [...new Set([CT.fact(w.length), right * 2, CT.fact(w.length) / CT.fact(Math.max(...ps))].filter(x => x !== right))].slice(0, 3);
  const den = Object.entries(counts).filter(([, c]) => c > 1).map(([l, c]) => `${c}!`).join("\\,") || "1";
  return {prompt: `How many different arrangements of the letters of <b>${w}</b> are there?`,
    choices: [{html: String(right), ok: true}, ...opts.map(x => ({html: String(x), ok: false}))],
    explain: `${w.length} letters with repeats: ${Object.entries(counts).map(([l, c]) => `${l}×${c}`).join(", ")}. Fact 6.9: \\(\\frac{${w.length}!}{${den}} = ${right}\\). Swapping two equal letters gives the same word, so ${w.length}! overcounts.`};
}
function qBinom(r) {
  const n = ri(r, 5, 9), b = ri(r, 2, n - 2);
  const right = CT.C(n, b);
  const opts = [...new Set([CT.C(n, b - 1), CT.C(n - 1, b), n * b, CT.P(n, b)].filter(x => x !== right))].slice(0, 3);
  return {prompt: `What is the coefficient of \\(x^{${n - b}}y^{${b}}\\) in \\((x+y)^{${n}}\\)?`,
    choices: [{html: String(right), ok: true}, ...opts.map(x => ({html: String(x), ok: false}))],
    explain: `Binomial Theorem (6.6): the coefficient is \\(\\binom{${n}}{${b}} = ${right}\\), the number of ways to choose which ${b} of the ${n} factors give a y.`};
}
function qIncExc(r) {
  const a = ri(r, 15, 40), b = ri(r, 15, 40), ab = ri(r, 3, Math.min(a, b) - 2);
  const right = a + b - ab;
  return {prompt: `In a class, ${a} students play an instrument, ${b} play a sport, and ${ab} do both. How many do at least one?`,
    choices: [{html: String(right), ok: true}, {html: String(a + b), ok: false}, {html: String(a + b - 2 * ab), ok: false}, {html: String(a + b + ab), ok: false}],
    explain: `Fact 6.7: |A ∪ B| = |A| + |B| − |A ∩ B| = ${a} + ${b} − ${ab} = <b>${right}</b>. The ${ab} who do both were counted twice in ${a} + ${b}.`};
}

registerLab("counting", {build, redraw() { drawVennSvg(); }});
})();
