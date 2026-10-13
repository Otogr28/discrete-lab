"use strict";
/* ===========================================================================
   Shared machinery: the router, the theme, math rendering and the small DOM
   helpers every lab uses. Loaded after graph.js and count.js, before the
   editor and the labs.
   =========================================================================== */

const $ = (id) => document.getElementById(id);

/* h("div", {class: "x", onclick: f}, child, "text", ...) */
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/* KaTeX if it loaded, readable plain text if it did not (offline, blocked
   CDN). The page must never show raw backslashes to a reader. */
function tex(s, display) {
  if (window.katex) {
    try { return katex.renderToString(s, {throwOnError: false, displayMode: !!display}); }
    catch (e) { /* fall through */ }
  }
  return `<code>${s.replace(/\\(tfrac|frac)\{([^}]*)\}\{([^}]*)\}/g, "($2)/($3)")
    .replace(/\\binom\{([^}]*)\}\{([^}]*)\}/g, "C($1,$2)")
    .replace(/\\[a-zA-Z]+/g, m => ({"\\cdot": "·", "\\le": "≤", "\\ge": "≥", "\\cap": "∩",
      "\\cup": "∪", "\\mid": "|", "\\times": "×", "\\neq": "≠", "\\chi": "χ",
      "\\Delta": "Δ", "\\overline": "¬"}[m] || ""))
    .replace(/[{}]/g, "")}</code>`;
}
function renderMath(el) {
  if (window.renderMathInElement) {
    renderMathInElement(el, {delimiters: [
      {left: "\\[", right: "\\]", display: true},
      {left: "\\(", right: "\\)", display: false}], throwOnError: false});
  }
}

const cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const isDark = () => cssv("color-scheme").includes("dark");

/* Vertex names. Letters, because the books' alphabetical tie-breaking
   (Algorithm 5.14) then reads naturally: "smallest label" is "earliest
   letter". */
function vname(i) {
  const a = "abcdefghijklmnopqrstuvwxyz";
  return i < 26 ? a[i] : a[i % 26] + Math.floor(i / 26);
}
const vlist = (vs) => vs.map(vname).join(", ");

/* Seeded generator (mulberry32), so a "Try" question can be
   regenerated from its seed. */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
function shuffle(r, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const newSeed = () => (Math.random() * 2 ** 31) >>> 0;

/* =================================================================== router
   One hash parameter picks the lab; a graph can ride along in `g` so any
   drawing is a link you can send. */
const LABS = {};           /* id -> {build, enter, built} */
const ORDER = ["home", "graphs", "paths", "trees", "planar", "counting", "prob"];
const SITE = {lab: "home"};

function registerLab(id, mod) { LABS[id] = Object.assign({built: false}, mod); }

function hashParams() { return new URLSearchParams(location.hash.slice(1)); }

function showLab(id, push) {
  if (!ORDER.includes(id)) id = "home";
  SITE.lab = id;
  for (const x of ORDER) {
    $("lab-" + x).classList.toggle("hidden", x !== id);
    const t = $("tab-" + x);
    if (t) t.setAttribute("aria-selected", String(x === id));
  }
  const L = LABS[id];
  if (L && !L.built) { L.build(); L.built = true; renderMath($("lab-" + id)); }
  if (L && L.enter) L.enter(hashParams());
  colorTheorems($("lab-" + id));
  if (push) {
    history.replaceState(null, "", id === "home" ? location.pathname : "#lab=" + id);
    window.scrollTo({top: 0, behavior: "auto"});
  }
  const tab = $("tab-" + id);
  if (tab && tab.scrollIntoView) tab.scrollIntoView({block: "nearest", inline: "nearest"});
}

function shareLink(lab, extra) {
  const q = new URLSearchParams({lab});
  for (const [k, v] of Object.entries(extra || {})) q.set(k, v);
  return location.origin + location.pathname + "#" + q.toString();
}
function copyText(text, btn) {
  const done = () => { if (btn) { const o = btn.textContent; btn.textContent = "copied"; setTimeout(() => btn.textContent = o, 1300); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => prompt("Copy this link:", text));
  else prompt("Copy this link:", text);
}

/* ==================================================================== theme */
function wireTheme() {
  $("themebtn").onclick = () => {
    document.documentElement.setAttribute("data-theme", isDark() ? "light" : "dark");
    try { localStorage.setItem("dl-theme", document.documentElement.getAttribute("data-theme")); } catch (e) {}
    redrawAll();
  };
  try {
    const t = localStorage.getItem("dl-theme");
    if (t) document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redrawAll);
}
/* ======================================================= theorem colours
   The theorem boxes are a graph-colouring problem of their own: each box is
   a vertex, two boxes are adjacent when they touch (side by side in a row,
   or one above the other), and touching boxes never share a colour. The
   grid reflows with the window, so adjacency is read from where the boxes
   actually are and recomputed on resize. The colouring uses chi colours,
   the fewest possible (GA.chromatic, the same search Lab 4 uses); a grid
   is bipartite, so that is 2 whenever two boxes touch. */
function colorTheorems(scope) {
  if (!scope) return;
  for (const grid of scope.querySelectorAll(".theory")) {
    const boxes = [...grid.querySelectorAll(".thm")];
    const R = boxes.map(b => b.getBoundingClientRect());
    if (!R.length || !R[0].width) continue;
    const gap = 24, overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 8;
    const touch = (a, b) =>
      (overlap(a.top, a.bottom, b.top, b.bottom) && (Math.abs(a.right - b.left) < gap || Math.abs(b.right - a.left) < gap)) ||
      (overlap(a.left, a.right, b.left, b.right) && (Math.abs(a.bottom - b.top) < gap || Math.abs(b.bottom - a.top) < gap));
    const edges = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) if (touch(R[i], R[j])) edges.push([i, j]);
    const {col} = GA.chromatic(boxes.length, edges);
    /* keep the first box blue: relabel colours in order of first use */
    const map = new Map();
    boxes.forEach((b, i) => { if (!map.has(col[i])) map.set(col[i], map.size); b.dataset.c = map.get(col[i]); });
  }
}

function redrawAll() {
  for (const L of Object.values(LABS)) if (L.built && L.redraw) L.redraw();
}

/* ===================================================================== boot */
function boot() {
  wireTheme();
  document.querySelectorAll("[data-lab]").forEach(b => {
    b.addEventListener("click", () => showLab(b.dataset.lab, true));
  });
  window.addEventListener("hashchange", () => {
    const want = hashParams().get("lab") || "home";
    if (want !== SITE.lab) showLab(want, false);
  });
  let rt = null;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => colorTheorems($("lab-" + SITE.lab)), 120); });
  renderMath($("lab-home"));
  showLab(hashParams().get("lab") || "home", false);
}
