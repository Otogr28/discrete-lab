"use strict";
/* ===========================================================================
   The graph editor every graph lab draws on. An SVG with a fixed 800 x 480
   coordinate system that scales to its box.

     tap empty space            add a vertex
     tap a vertex, then another join them (tap the pair again to unjoin);
                                the second vertex stays selected, so a path
                                is drawn by tapping along it
     drag a vertex              move it
     Erase mode, tap anything   remove it
     weighted graphs: tap a weight to change it

   A lab never edits the SVG. It reads `ed.g`, computes, and hands back a
   `decor` object saying how to colour vertices, edges and faces. Then the
   editor draws. That keeps every lab's picture a pure function of the graph.
   =========================================================================== */

const SVGNS = "http://www.w3.org/2000/svg";
const W = 800, H = 480, R = 17;

function svg(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) el.setAttribute(k, v);
  return el;
}

/* =================================================================== layouts */
const Layout = {
  circle(n, cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 50, rot = -Math.PI / 2) {
    return Array.from({length: n}, (_, i) => ({
      x: cx + r * Math.cos(rot + 2 * Math.PI * i / n),
      y: cy + r * Math.sin(rot + 2 * Math.PI * i / n)}));
  },
  line(n) {
    const step = Math.min(110, (W - 100) / Math.max(1, n - 1));
    const x0 = W / 2 - step * (n - 1) / 2;
    return Array.from({length: n}, (_, i) => ({x: x0 + i * step, y: H / 2 + (i % 2 ? -40 : 40)}));
  },
  twoRows(m, k) {
    const row = (cnt, y) => Array.from({length: cnt}, (_, i) => ({
      x: W / 2 + (i - (cnt - 1) / 2) * Math.min(120, (W - 120) / Math.max(1, cnt - 1)), y}));
    return row(m, 120).concat(row(k, 360));
  },
  cube(d) {
    /* Q_d: bits 0,1 make a square, bit 2 shifts inward, bit 3 shifts right */
    const pos = [];
    for (let v = 0; v < (1 << d); v++) {
      let x = (v & 1 ? 1 : -1) * 150, y = (v & 2 ? 1 : -1) * 150;
      if (v & 4) { x *= 0.45; y *= 0.45; }
      if (d === 4) { x = x * 0.62 + (v & 8 ? 180 : -180); y *= 0.9; }
      pos.push({x: W / 2 + x, y: H / 2 + y});
    }
    return pos;
  },
  petersen() {
    return Layout.circle(5, W / 2, H / 2 + 8, 200).concat(Layout.circle(5, W / 2, H / 2 + 8, 95));
  },
  /* spread points with a minimum distance, so nothing starts on top of
     anything */
  scatter(n, r, minD = 90) {
    const pts = [];
    let tries = 0;
    while (pts.length < n && tries < 5000) {
      tries++;
      const p = {x: 50 + r() * (W - 100), y: 45 + r() * (H - 90)};
      if (pts.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= (tries > 3000 ? minD / 2 : minD))) pts.push(p);
    }
    while (pts.length < n) pts.push({x: 50 + r() * (W - 100), y: 45 + r() * (H - 90)});
    return pts;
  },
  /* layered drawing of a tree rooted at 0 */
  tree(n, edges) {
    const A = GA.adjacency(n, edges), depth = new Array(n).fill(-1), layers = [];
    depth[0] = 0;
    const q = [0];
    while (q.length) {
      const x = q.shift();
      (layers[depth[x]] = layers[depth[x]] || []).push(x);
      for (const y of A[x]) if (depth[y] < 0) { depth[y] = depth[x] + 1; q.push(y); }
    }
    const pos = new Array(n);
    const dy = Math.min(110, (H - 90) / Math.max(1, layers.length - 1));
    layers.forEach((L, d) => L.forEach((v, i) => {
      pos[v] = {x: W / 2 + (i - (L.length - 1) / 2) * Math.min(120, (W - 90) / Math.max(1, L.length - 1 || 1)),
                y: 50 + d * dy};
    }));
    for (let v = 0; v < n; v++) if (!pos[v]) pos[v] = {x: 60 + 40 * v, y: H - 40};
    return pos;
  },
};

/* ================================================================== presets
   Each returns {n, edges, pos}. Each lab chooses which ones to offer. */
const Presets = {
  K: (n) => Object.assign(GA.families.K(n), {pos: Layout.circle(n)}),
  C: (n) => Object.assign(GA.families.C(n), {pos: Layout.circle(n)}),
  P: (n) => Object.assign(GA.families.P(n), {pos: Layout.line(n)}),
  Kmn: (m, k) => Object.assign(GA.families.Kmn(m, k), {pos: Layout.twoRows(m, k)}),
  Q: (d) => Object.assign(GA.families.Q(d), {pos: Layout.cube(d)}),
  petersen: () => Object.assign(GA.families.petersen(), {pos: Layout.petersen()}),
  random(r, n, p) {
    const edges = [];
    for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++) if (r() < p) edges.push([u, v]);
    return {n, edges, pos: Layout.scatter(n, r)};
  },
  /* random tree: vertex i joins a random earlier vertex */
  tree(r, n) {
    const edges = [];
    for (let v = 1; v < n; v++) edges.push([ri(r, 0, v - 1), v]);
    return {n, edges, pos: Layout.tree(n, edges)};
  },
  /* a planar graph: scatter points, add non-crossing edges shortest first */
  planar(r, n, density = 0.75) {
    const pos = Layout.scatter(n, r, 110);
    const pairs = [];
    for (let u = 0; u < n; u++) for (let v = u + 1; v < n; v++)
      pairs.push([u, v, Math.hypot(pos[u].x - pos[v].x, pos[u].y - pos[v].y)]);
    pairs.sort((a, b) => a[2] - b[2]);
    const edges = [];
    for (const [u, v] of pairs) {
      if (r() > density) continue;
      const ok = edges.every(([a, b]) => a === u || a === v || b === u || b === v ||
        !GA.segCross(pos[u], pos[v], pos[a], pos[b]));
      if (ok) edges.push([u, v]);
    }
    /* make sure it is connected: join components along short non-crossing edges */
    for (const [u, v] of pairs) {
      if (GA.isConnected(n, edges)) break;
      const {comp} = GA.components(n, edges);
      if (comp[u] === comp[v]) continue;
      const ok = edges.every(([a, b]) => a === u || a === v || b === u || b === v ||
        !GA.segCross(pos[u], pos[v], pos[a], pos[b]));
      if (ok) edges.push([u, v]);
    }
    return {n, edges, pos};
  },
  weighted(r, n) {
    const g = Presets.planar(r, n, 0.9);
    g.edges = g.edges.map(([u, v]) => [u, v, ri(r, 1, 15)]);
    return g;
  },
};

/* ============================================================ hash encoding */
function encodeGraph(g) {
  const p = g.pos.map(q => Math.round(q.x) + "." + Math.round(q.y)).join("_");
  const e = g.edges.map(([u, v, w]) => w === undefined ? u + "-" + v : u + "-" + v + "-" + w).join("_");
  return g.n + "~" + p + "~" + e;
}
function decodeGraph(s) {
  try {
    const [ns, ps, es] = s.split("~");
    const n = parseInt(ns, 10);
    if (!(n >= 0 && n <= 40)) return null;
    const pos = ps ? ps.split("_").map(t => { const [x, y] = t.split(".").map(Number); return {x, y}; }) : [];
    const edges = es ? es.split("_").map(t => t.split("-").map(Number)) : [];
    if (pos.length !== n) return null;
    for (const e of edges) if (e.length < 2 || e[0] === e[1] || e.slice(0, 2).some(x => !(x >= 0 && x < n))) return null;
    return {n, pos, edges: edges.map(e => e.length > 2 ? [e[0], e[1], e[2]] : [e[0], e[1]])};
  } catch (err) { return null; }
}

/* ==================================================================== editor */
class GraphEditor {
  /* opts: {lab, weighted, readonly, presets: [[label, fn]], onChange, hint,
            maxN, toolbar: false} */
  constructor(host, opts) {
    this.opts = Object.assign({maxN: 26}, opts || {});
    this.g = {n: 0, pos: [], edges: []};
    this.decor = {};
    this.sel = null;
    this.mode = "build";
    this.pickHandler = null;
    this.root = h("div", {class: "editor"});
    host.append(this.root);
    if (!this.opts.readonly && this.opts.toolbar !== false) this._toolbar();
    this.svg = svg("svg", {viewBox: `0 0 ${W} ${H}`, class: "stage" + (this.opts.readonly ? " readonly" : ""),
      role: "img", "aria-label": this.opts.aria || "graph drawing"});
    this.root.append(this.svg);
    this._watchSize();
    if (!this.opts.readonly) {
      this.hintEl = h("div", {class: "hint", html: this.opts.hint ||
        "<b>Tap</b> empty space for a vertex · <b>tap two vertices</b> to join them · <b>drag</b> to move · <b>Erase</b> removes"});
      this.root.append(this.hintEl);
      this._wire();
    }
  }

  _toolbar() {
    const tb = h("div", {class: "toolbar"});
    this.seg = h("div", {class: "seg", role: "group", "aria-label": "editing mode"});
    for (const [m, label] of [["build", "Draw"], ["erase", "Erase"]]) {
      const b = h("button", {type: "button", "aria-pressed": String(m === this.mode),
        onclick: () => this.setMode(m)}, label);
      b.dataset.mode = m;
      this.seg.append(b);
    }
    tb.append(this.seg);
    if (this.opts.presets && this.opts.presets.length) {
      const sel = h("select", {class: "btn", "aria-label": "load an example graph"},
        h("option", {value: ""}, "Examples…"),
        this.opts.presets.map(([label], i) => h("option", {value: String(i)}, label)));
      sel.onchange = () => {
        if (sel.value === "") return;
        const g = this.opts.presets[+sel.value][1](rng(newSeed()));
        this.set(g); sel.value = "";
      };
      tb.append(sel);
    }
    tb.append(h("button", {type: "button", class: "btn", onclick: () => this.set({n: 0, pos: [], edges: []})}, "Clear"));
    this.extra = h("span", {class: "sp"});
    tb.append(this.extra);
    if (this.opts.lab) {
      const lb = h("button", {type: "button", class: "btn", title: "copy a link to this exact graph"}, "Link");
      lb.onclick = () => copyText(shareLink(this.opts.lab, {g: encodeGraph(this.g)}), lb);
      tb.append(lb);
    }
    this.root.append(tb);
    this.tb = tb;
  }

  /* lab-specific buttons go to the left of "Link" */
  addTool(el) { this.tb.insertBefore(el, this.extra); return el; }

  setMode(m) {
    this.mode = m; this.sel = null;
    if (this.seg) for (const b of this.seg.children) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
    this.draw();
  }

  set(g, silent) {
    this.g = {n: g.n, pos: g.pos.map(p => ({x: p.x, y: p.y})),
              edges: g.edges.map(e => e.slice())};
    this.sel = null;
    if (!silent) this.changed(); else this.draw();
  }
  changed() {
    if (this.opts.onChange) this.opts.onChange(this.g);
    else this.draw();
  }
  setDecor(d) { this.decor = d || {}; this.draw(); }
  _watchSize() {
    if (typeof ResizeObserver === "undefined") return;
    let last = 0;
    new ResizeObserver(() => {
      const w = Math.round(this.svg.clientWidth);
      if (w && Math.abs(w - last) > 8) { last = w; this.draw(); }
    }).observe(this.svg);
  }

  /* ------------------------------------------------------------ editing */
  addVertex(x, y) {
    if (this.g.n >= this.opts.maxN) return;
    this.g.pos.push({x, y}); this.g.n++;
  }
  removeVertex(v) {
    this.g.edges = this.g.edges.filter(([a, b]) => a !== v && b !== v)
      .map(e => [e[0] > v ? e[0] - 1 : e[0], e[1] > v ? e[1] - 1 : e[1]].concat(e.length > 2 ? [e[2]] : []));
    this.g.pos.splice(v, 1); this.g.n--;
  }
  toggleEdge(u, v) {
    const i = this.g.edges.findIndex(([a, b]) => (a === u && b === v) || (a === v && b === u));
    if (i >= 0) this.g.edges.splice(i, 1);
    else {
      const e = [Math.min(u, v), Math.max(u, v)];
      if (this.opts.weighted) {
        const d = Math.hypot(this.g.pos[u].x - this.g.pos[v].x, this.g.pos[u].y - this.g.pos[v].y);
        e.push(Math.max(1, Math.min(20, Math.round(d / 45))));
      }
      this.g.edges.push(e);
    }
  }

  _pt(ev) {
    const m = this.svg.getScreenCTM();
    if (!m) return {x: 0, y: 0};
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return {x: Math.max(R + 2, Math.min(W - R - 2, p.x)), y: Math.max(R + 2, Math.min(H - R - 2, p.y))};
  }

  _wire() {
    let down = null;
    this.svg.addEventListener("pointerdown", (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      const t = ev.target.closest("[data-v],[data-e],[data-w]");
      down = {t, p: this._pt(ev), moved: false, id: ev.pointerId};
      if (t && t.dataset.v !== undefined) this.svg.setPointerCapture(ev.pointerId);
    });
    this.svg.addEventListener("pointermove", (ev) => {
      if (!down || !down.t || down.t.dataset.v === undefined) return;
      const p = this._pt(ev);
      if (!down.moved && Math.hypot(p.x - down.p.x, p.y - down.p.y) < 6) return;
      down.moved = true;
      const v = +down.t.dataset.v;
      this.g.pos[v] = p;
      if (this.opts.onDrag) this.opts.onDrag(this.g); else this.draw();
    });
    const up = (ev) => {
      if (!down) return;
      const d = down; down = null;
      if (d.moved) { this.changed(); return; }
      const t = d.t;
      if (t && t.dataset.v !== undefined) {
        const v = +t.dataset.v;
        if (this.pickHandler && this.mode === "build") { this.pickHandler(v); return; }
        if (this.mode === "erase") { this.removeVertex(v); this.sel = null; this.changed(); return; }
        if (this.sel === null) { this.sel = v; this.draw(); }
        else if (this.sel === v) { this.sel = null; this.draw(); }
        else { this.toggleEdge(this.sel, v); this.sel = v; this.changed(); }
        return;
      }
      if (t && (t.dataset.e !== undefined || t.dataset.w !== undefined)) {
        const i = +(t.dataset.e !== undefined ? t.dataset.e : t.dataset.w);
        if (this.mode === "erase") { this.g.edges.splice(i, 1); this.changed(); return; }
        if (this.opts.weighted) this._editWeight(i);
        return;
      }
      if (this.mode !== "build" || this.pickHandler) return;
      if (this.sel !== null) { this.sel = null; this.draw(); return; }
      this.addVertex(d.p.x, d.p.y); this.changed();
    };
    this.svg.addEventListener("pointerup", up);
    this.svg.addEventListener("pointercancel", () => { down = null; });
    this.svg.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { this.sel = null; this.draw(); }
    });
  }

  _editWeight(i) {
    const e = this.g.edges[i];
    const a = this.g.pos[e[0]], b = this.g.pos[e[1]];
    const box = this.svg.getBoundingClientRect(), rb = this.root.getBoundingClientRect();
    const sx = box.width / W, sy = box.height / H;
    const inp = h("input", {type: "number", min: "0", max: "999", value: String(e[2] ?? 1),
      "aria-label": "edge weight",
      style: `position:absolute;left:${box.left - rb.left + (a.x + b.x) / 2 * sx - 34}px;` +
             `top:${box.top - rb.top + (a.y + b.y) / 2 * sy - 16}px;z-index:5`});
    const done = () => {
      const w = parseInt(inp.value, 10);
      if (Number.isFinite(w) && w >= 0) e[2] = Math.min(999, w);
      inp.remove(); this.changed();
    };
    inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") inp.blur(); if (ev.key === "Escape") { inp.value = e[2]; inp.blur(); } });
    inp.addEventListener("blur", done, {once: true});
    this.root.append(inp);
    inp.focus(); inp.select();
  }

  /* --------------------------------------------------------------- draw */
  draw() {
    const s = this.svg, g = this.g, D = this.decor || {};
    s.textContent = "";
    /* On a phone the 800-unit drawing is ~350 px wide and a vertex would be
       7 px across. Scale every mark up so it stays tappable and legible. */
    const cw = s.clientWidth || W;
    const k = Math.max(1, Math.min(2.1, 0.75 * W / cw));
    s.style.setProperty("--k", k);
    const ve = D.v || {}, ee = D.e || {};
    if (D.faces) for (const f of D.faces) {
      s.append(svg("polygon", {class: "face", points: f.pts.map(i => g.pos[i].x + "," + g.pos[i].y).join(" "),
        style: `fill:${f.fill}`}));
    }
    g.edges.forEach((e, i) => {
      const [u, v] = e, a = g.pos[u], b = g.pos[v];
      const d = ee[GA.key(u, v)] || {};
      const line = svg("line", {class: "e", x1: a.x, y1: a.y, x2: b.x, y2: b.y});
      const st = [];
      if (d.stroke) st.push(`stroke:${d.stroke}`);
      if (d.width) st.push(`stroke-width:${d.width * k}`);
      if (d.dash) st.push(`stroke-dasharray:${d.dash}`);
      if (d.dim) st.push("opacity:.22");
      if (st.length) line.setAttribute("style", st.join(";"));
      s.append(line);
      if (!this.opts.readonly) {
        const hit = svg("line", {class: "e-hit", x1: a.x, y1: a.y, x2: b.x, y2: b.y});
        hit.dataset.e = i;
        s.append(hit);
      }
      const lab = d.label !== undefined ? String(d.label) : (e.length > 2 ? String(e[2]) : null);
      if (lab !== null) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, wd = 10 + 8 * lab.length;
        const grp = svg("g", {class: "wlabel", transform: `translate(${mx},${my}) scale(${k}) translate(${-mx},${-my})`});
        grp.append(svg("rect", {x: mx - wd / 2, y: my - 11, width: wd, height: 22, rx: 6,
          style: d.labelFill ? `fill:${d.labelFill};stroke:${d.stroke || "var(--line)"}` : null}));
        const tx = svg("text", {x: mx, y: my + 1}); tx.textContent = lab;
        if (d.labelInk) tx.setAttribute("style", `fill:${d.labelInk}`);
        grp.append(tx);
        if (e.length > 2 && !this.opts.readonly) { grp.dataset.w = i; grp.style.cursor = "pointer"; }
        s.append(grp);
      }
    });
    if (D.dots) for (const p of D.dots) s.append(svg("circle", {cx: p.x, cy: p.y, r: (p.r || 6) * k, style: `fill:${p.color}`}));
    for (let v = 0; v < g.n; v++) {
      const p = g.pos[v], d = ve[v] || {};
      const grp = svg("g", {class: "v" + (this.sel === v ? " sel" : ""), transform: `translate(${p.x},${p.y}) scale(${k})`});
      grp.dataset.v = v;
      if (d.ring) grp.append(svg("circle", {r: R + 6, style: `fill:none;stroke:${d.ring};stroke-width:3`}));
      const c = svg("circle", {r: R});
      const st = [];
      if (d.fill) st.push(`fill:${d.fill}`);
      if (d.stroke) st.push(`stroke:${d.stroke}`);
      if (d.dim) st.push("opacity:.3");
      if (st.length) c.setAttribute("style", st.join(";"));
      grp.append(c);
      const t = svg("text", {y: 1}); t.textContent = d.text !== undefined ? d.text : (this.opts.label ? this.opts.label(v) : vname(v));
      if (d.ink) t.setAttribute("style", `fill:${d.ink}`);
      grp.append(t);
      if (d.badge !== undefined) {
        const b = svg("text", {class: "badge", y: d.ring ? -R - 13 : -R - 7}); b.textContent = d.badge;
        if (d.badgeInk) b.setAttribute("style", `fill:${d.badgeInk};font-weight:700`);
        grp.append(b);
      }
      s.append(grp);
    }
    if (!g.n && !this.opts.readonly) {
      const t = svg("text", {class: "empty", x: W / 2, y: H / 2}); t.textContent = this.opts.emptyText || "Tap anywhere to place a vertex, or load an example";
      s.append(t);
    }
  }
}

/* A small read-only drawing for "Try" questions. */
function staticGraph(host, g, decor, label) {
  const ed = new GraphEditor(host, {readonly: true, label});
  ed.g = g; ed.decor = decor || {}; ed.draw();
  return ed;
}
