(() => {
  // 1. Configuration
  const svg = document.getElementById("constellation");
  if (!svg || !window.GRAPH) return;

  const NS = "http://www.w3.org/2000/svg";
  const LABEL_LEVEL = 0;
  const NODE_RADIUS = [5.2, 3.4, 2.3];
  const CONTAINS_REST = [0, 68, 44];
  const CONTAINS_STRENGTH = 0.000012;
  const CITES_PULL = 0.8;
  const CITES_STRENGTH = 0.000001;
  const WARMUP_STEPS = 600;
  const STAR_DAMPING = 0.9986;
  const CONTENT_DAMPING = 0.996;
  const STAR_STRENGTH = 0.000006;
  const HIT_RADIUS = 10;
  const rand = mulberry32(20260930);

  let width = window.innerWidth;
  let height = window.innerHeight;
  let last = performance.now();

  let dragging = null;
  let dragGroup = null;
  let dragStart = null;
  let dragTarget = null;
  let dragLastTarget = null;
  let dragLastTime = null;
  let releaseVX = 0;
  let releaseVY = 0;
  let didDrag = false;

  // 2. Nodes: decorative stars, then content nodes placed by level
  const stars = buildStars(width < 700 ? 54 : 90);
  const content = buildContent(GRAPH.nodes);
  const nodes = [...stars, ...content];
  const byId = new Map(content.map((n) => [n.id, n]));

  // 3. Edges: containment (short, strong), citations (long, weak), star lattice
  const edges = [
    ...content.filter((n) => n.parent).map((n) => ({
      a: byId.get(n.parent), b: n, rest: CONTAINS_REST[n.level], strength: CONTAINS_STRENGTH, kind: "contains"
    })),
    ...GRAPH.edges.map((e) => {
      const a = byId.get(e.a);
      const b = byId.get(e.b);
      return { a, b, rest: Math.hypot(a.x - b.x, a.y - b.y) * CITES_PULL, strength: CITES_STRENGTH, kind: "cites" };
    }),
    ...buildStarEdges(stars, content.filter((n) => n.level === 0))
  ];

  // 4. DOM
  const edgeEls = edges.map((e) => {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("class", `edge ${e.kind}`);
    svg.appendChild(line);
    return line;
  });

  const nodeEls = nodes.map((n) => {
    const g = document.createElementNS(NS, "g");

    if (n.href) {
      const hit = document.createElementNS(NS, "circle");
      hit.setAttribute("r", HIT_RADIUS);
      hit.setAttribute("class", "hit");
      g.appendChild(hit);
    }

    const circle = document.createElementNS(NS, "circle");
    circle.setAttribute("r", n.r);
    circle.setAttribute("class", n.href ? "node content" : `node ${n.r < 1.5 ? "tiny" : ""}`);
    g.appendChild(circle);

    if (n.label) {
      const label = document.createElementNS(NS, "text");
      label.setAttribute("class", `node-label ${n.level <= LABEL_LEVEL ? "visible" : ""}`);
      label.setAttribute("x", n.r + 10);
      label.setAttribute("y", 4);
      label.textContent = n.label;
      g.appendChild(label);

      if (n.level > LABEL_LEVEL) {
        g.addEventListener("pointerenter", () => label.classList.add("peek"));
        g.addEventListener("pointerleave", () => label.classList.remove("peek"));
      }
    }

    g.addEventListener("pointerdown", (e) => startDrag(e, n, g));
    if (n.href) {
      g.addEventListener("click", () => {
        if (!didDrag) window.location.href = n.href;
      });
    }

    svg.appendChild(g);
    return g;
  });

  // 5. Events
  svg.addEventListener("pointermove", moveDrag);
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  svg.addEventListener("pointerleave", (e) => {
    if (dragging && e.buttons === 0) endDrag(e);
  });

  window.addEventListener("resize", () => {
    const sx = window.innerWidth / Math.max(width, 1);
    const sy = window.innerHeight / Math.max(height, 1);
    width = window.innerWidth;
    height = window.innerHeight;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    for (const n of nodes) {
      n.x *= sx;
      n.y *= sy;
      if (n.anchor) {
        n.anchorX = width * n.anchor[0];
        n.anchorY = height * n.anchor[1];
      }
    }
  });

  // 6. Loop
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  for (let i = 0; i < WARMUP_STEPS; i++) physics(16, 0);
  tick(performance.now());

  function tick(now) {
    const dt = Math.min(24, now - last || 16);
    last = now;
    physics(dt, now);
    draw();
    requestAnimationFrame(tick);
  }

  function buildStars(count) {
    const margin = 28;
    const result = [];
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const radial = 0.28 + rand() * 0.72;
      result.push({
        id: `star-${i}`,
        x: clamp(width * 0.5 + Math.cos(angle) * width * 0.48 * radial, margin, width - margin),
        y: clamp(height * 0.5 + Math.sin(angle) * height * 0.48 * radial, margin, height - margin),
        vx: (rand() - 0.5) * 0.002,
        vy: (rand() - 0.5) * 0.002,
        r: rand() < 0.16 ? 2.5 + rand() * 1.7 : 0.8 + rand() * 1.15,
        driftPhaseX: rand() * Math.PI * 2,
        driftPhaseY: rand() * Math.PI * 2,
        driftSpeedX: 0.018 + rand() * 0.018,
        driftSpeedY: 0.016 + rand() * 0.018,
        driftStrength: 0.0000001 + rand() * 0.00000015,
        damping: STAR_DAMPING
      });
    }
    return result;
  }

  function buildContent(spec) {
    const placed = new Map();
    const ordered = [...spec].sort((a, b) => a.level - b.level);

    return ordered.map((s) => {
      let x, y;
      if (s.anchor) {
        x = width * s.anchor[0];
        y = height * s.anchor[1];
      } else {
        const p = placed.get(s.parent);
        const angle = rand() * Math.PI * 2;
        const rest = CONTAINS_REST[s.level];
        x = clamp(p.x + Math.cos(angle) * rest, 28, width - 28);
        y = clamp(p.y + Math.sin(angle) * rest, 28, height - 28);
      }
      const node = {
        id: s.id,
        level: s.level,
        parent: s.parent,
        label: s.label,
        href: s.href,
        anchor: s.anchor,
        anchorX: s.anchor ? x : null,
        anchorY: s.anchor ? y : null,
        x, y, vx: 0, vy: 0,
        r: NODE_RADIUS[s.level],
        driftPhaseX: rand() * Math.PI * 2,
        driftPhaseY: rand() * Math.PI * 2,
        driftSpeedX: 0.012 + rand() * 0.012,
        driftSpeedY: 0.012 + rand() * 0.012,
        driftStrength: 0.00000008,
        damping: CONTENT_DAMPING
      };
      placed.set(s.id, node);
      return node;
    });
  }

  function buildStarEdges(stars, roots) {
    const result = [];
    const reach = Math.min(width, height) * 0.24;

    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      const nearest = stars
        .slice(i + 1)
        .map((b) => ({ b, d: Math.hypot(a.x - b.x, a.y - b.y) }))
        .sort((p, q) => p.d - q.d)
        .slice(0, rand() < 0.42 ? 2 : 1);

      for (const { b, d } of nearest) {
        if (d < reach) result.push({ a, b, rest: d, strength: STAR_STRENGTH + rand() * 0.000007, kind: "star" });
      }
    }

    for (const root of roots) {
      stars
        .map((b) => ({ b, d: Math.hypot(b.x - root.x, b.y - root.y) }))
        .sort((p, q) => p.d - q.d)
        .slice(0, 3)
        .forEach(({ b, d }) => result.push({ a: root, b, rest: d, strength: 0.00001, kind: "star" }));
    }

    return result;
  }

  function physics(dt, now) {
    const t = now * 0.001;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 80;
        const d = Math.sqrt(d2);
        if (d > 90) continue;

        const force = 0.035 / d2;
        dx /= d;
        dy /= d;
        if (a !== dragging) { a.vx -= dx * force * dt; a.vy -= dy * force * dt; }
        if (b !== dragging) { b.vx += dx * force * dt; b.vy += dy * force * dt; }
      }
    }

    for (const e of edges) {
      let dx = e.b.x - e.a.x;
      let dy = e.b.y - e.a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - e.rest) * e.strength * dt;
      dx /= d;
      dy /= d;
      if (e.a !== dragging) { e.a.vx += dx * f; e.a.vy += dy * f; }
      if (e.b !== dragging) { e.b.vx -= dx * f; e.b.vy -= dy * f; }
    }

    for (const node of nodes) {
      if (node === dragging) {
        const follow = 1 - Math.exp(-dt / 95);
        const oldX = node.x;
        const oldY = node.y;
        node.x += (dragTarget.x - node.x) * follow;
        node.y += (dragTarget.y - node.y) * follow;
        node.vx = (node.x - oldX) / Math.max(dt, 1);
        node.vy = (node.y - oldY) / Math.max(dt, 1);
        continue;
      }

      node.vx += Math.sin(t * node.driftSpeedX + node.driftPhaseX) * node.driftStrength * dt;
      node.vy += Math.cos(t * node.driftSpeedY + node.driftPhaseY) * node.driftStrength * dt;

      if (node.anchorX !== null && node.anchorX !== undefined) {
        node.vx += (node.anchorX - node.x) * 0.0000011 * dt;
        node.vy += (node.anchorY - node.y) * 0.0000011 * dt;
      }

      const damping = Math.pow(node.damping, dt / 16);
      node.vx *= damping;
      node.vy *= damping;

      const speed = Math.hypot(node.vx, node.vy);
      const maxSpeed = 0.055;
      if (speed > maxSpeed) {
        node.vx = (node.vx / speed) * maxSpeed;
        node.vy = (node.vy / speed) * maxSpeed;
      }

      node.x += node.vx * dt;
      node.y += node.vy * dt;

      const pad = 18;
      if (node.x < pad) { node.x = pad; node.vx *= 0.12; }
      if (node.x > width - pad) { node.x = width - pad; node.vx *= 0.12; }
      if (node.y < pad) { node.y = pad; node.vy *= 0.12; }
      if (node.y > height - pad) { node.y = height - pad; node.vy *= 0.12; }
    }
  }

  function draw() {
    edges.forEach((e, i) => {
      const el = edgeEls[i];
      el.setAttribute("x1", e.a.x);
      el.setAttribute("y1", e.a.y);
      el.setAttribute("x2", e.b.x);
      el.setAttribute("y2", e.b.y);
    });
    nodes.forEach((n, i) => {
      nodeEls[i].setAttribute("transform", `translate(${n.x},${n.y})`);
    });
  }

  function startDrag(e, node, g) {
    e.preventDefault();
    dragging = node;
    dragGroup = g;
    dragStart = { x: e.clientX, y: e.clientY };
    didDrag = false;

    const pt = clientToSvg(e.clientX, e.clientY);
    dragTarget = pt;
    dragLastTarget = pt;
    dragLastTime = performance.now();
    releaseVX = node.vx;
    releaseVY = node.vy;

    g.setPointerCapture?.(e.pointerId);
    g.querySelector(".node")?.classList.add("dragging");
  }

  function moveDrag(e) {
    if (!dragging) return;

    const now = performance.now();
    const pt = clientToSvg(e.clientX, e.clientY);
    dragTarget = pt;

    const elapsed = Math.max(8, now - dragLastTime);
    releaseVX = releaseVX * 0.76 + ((pt.x - dragLastTarget.x) / elapsed) * 0.24;
    releaseVY = releaseVY * 0.76 + ((pt.y - dragLastTarget.y) / elapsed) * 0.24;
    dragLastTarget = pt;
    dragLastTime = now;

    if (dragStart && Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y) > 5) didDrag = true;
  }

  function endDrag() {
    if (!dragging) return;

    dragGroup?.querySelector(".node")?.classList.remove("dragging");
    dragging.vx = clamp(releaseVX * 0.34, -0.05, 0.05);
    dragging.vy = clamp(releaseVY * 0.34, -0.05, 0.05);

    dragging = null;
    dragGroup = null;
    dragTarget = null;
    dragLastTarget = null;
    dragLastTime = null;
    setTimeout(() => { didDrag = false; }, 0);
  }

  function clientToSvg(x, y) {
    const rect = svg.getBoundingClientRect();
    return { x: (x - rect.left) * width / rect.width, y: (y - rect.top) * height / rect.height };
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
})();
