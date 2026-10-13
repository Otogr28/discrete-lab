"use strict";
/* ===========================================================================
   "Try": a question generated from a seed, a few choices, and an
   explanation that says WHY, using the same theorem the lab just showed.
   Every question is generated fresh; none is a homework or quiz problem.

   A generator is fn(r) -> {prompt, choices: [{html, ok}], explain,
                            graph?, decor?, fig?(host)}
   =========================================================================== */
const Quiz = {
  mount(host, generators, opts) {
    opts = opts || {};
    const box = h("div", {class: "panel pad quiz"});
    host.append(box);
    let right = 0, total = 0, streak = 0;
    const score = h("span", {class: "score"});
    const updScore = () => { score.textContent = total ? `${right}/${total} right · streak ${streak}` : "no answers yet"; };

    const next = () => {
      box.textContent = "";
      const r = rng(newSeed());
      const gen = pick(r, generators);
      let q = null;
      for (let tries = 0; tries < 40 && !q; tries++) q = gen(r);
      if (!q) { box.append(h("p", {}, "Could not build a question, try again.")); return; }
      const hasFig = !!(q.graph || q.fig);
      const left = h("div", {});
      const wrap = h("div", {class: "q" + (hasFig ? "" : " nofig")}, left);
      left.append(h("div", {class: "prompt", html: q.prompt}));
      const choices = h("div", {class: "choices"});
      const explain = h("div", {class: "explain hidden", html: q.explain});
      const order = shuffle(r, q.choices);
      for (const c of order) {
        const b = h("button", {type: "button", class: "choice", html: c.html});
        b.onclick = () => {
          total++;
          if (c.ok) { right++; streak++; } else streak = 0;
          for (const [i, bb] of [...choices.children].entries()) {
            bb.disabled = true;
            if (order[i].ok) bb.classList.add("right");
          }
          if (!c.ok) b.classList.add("wrong");
          explain.classList.remove("hidden");
          explain.classList.add(c.ok ? "ok" : "no");
          explain.prepend(h("span", {class: "head"}, c.ok ? "Correct!" : "Not quite."));
          updScore();
          renderMath(explain);
        };
        choices.append(b);
      }
      left.append(choices, explain);
      if (hasFig) {
        const fig = h("div", {class: "fig"});
        wrap.append(fig);
        if (q.graph) staticGraph(fig, q.graph, q.decor, q.label);
        else q.fig(fig);
      }
      box.append(wrap, h("div", {class: "bar"},
        h("button", {type: "button", class: "btn primary", onclick: next}, "Next question"), score));
      updScore();
      renderMath(box);
    };
    next();
  },
};
