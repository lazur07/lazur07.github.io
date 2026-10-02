import type { Graph, GraphNode, Level } from "./lib/graph";

// 1. Configuration
const NS = "http://www.w3.org/2000/svg";
const LABEL_LEVEL: Level = 0;
const NODE_RADIUS: Record<Level, number> = { 0: 5.2, 1: 3.4, 2: 2.3 };
const CONTAINS_REST: Record<Level, number> = { 0: 0, 1: 68, 2: 44 };
const CONTAINS_STRENGTH = 0.000012;
const CITES_PULL = 0.8;
const CITES_STRENGTH = 0.000001;
const STAR_STRENGTH = 0.000006;
const ROOT_TIE_STRENGTH = 0.00001;
const ANCHOR_STRENGTH = 0.0000011;
const STAR_DAMPING = 0.9986;
const CONTENT_DAMPING = 0.996;
const REPULSION = 0.035;
const REPULSION_REACH = 90;
const MAX_SPEED = 0.055;
const PAD = 18;
const HIT_RADIUS = 10;
const WARMUP_STEPS = 600;
const RELEASE_SCALE = 0.34;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damping: number;
  drift: { phaseX: number; phaseY: number; speedX: number; speedY: number; strength: number };
  level?: Level;
  label?: string;
  href?: string;
  anchor?: [number, number];
}

interface Edge {
  a: Node;
  b: Node;
  rest: number;
  strength: number;
  kind: "contains" | "cites" | "star";
}

interface Drag {
  node: Node;
  group: SVGGElement;
  startX: number;
  startY: number;
  target: { x: number; y: number };
  lastTime: number;
  vx: number;
  vy: number;
  moved: boolean;
}

run(document.getElementById("constellation") as unknown as SVGSVGElement, JSON.parse(document.getElementById("graph")!.textContent!) as Graph);

function run(svg: SVGSVGElement, graph: Graph): void {
  let width = window.innerWidth;
  let height = window.innerHeight;
  let last = performance.now();
  let drag: Drag | null = null;
  let justDragged = false;
  const rand = mulberry32(20260930);

  // 2. Nodes: decorative stars, then content nodes placed level by level around their parent
  const stars: Node[] = Array.from({ length: width < 700 ? 54 : 90 }, () => {
    const angle = rand() * Math.PI * 2;
    const radial = 0.28 + rand() * 0.72;
    return {
      x: clamp(width * 0.5 + Math.cos(angle) * width * 0.48 * radial, 28, width - 28),
      y: clamp(height * 0.5 + Math.sin(angle) * height * 0.48 * radial, 28, height - 28),
      vx: (rand() - 0.5) * 0.002,
      vy: (rand() - 0.5) * 0.002,
      r: rand() < 0.16 ? 2.5 + rand() * 1.7 : 0.8 + rand() * 1.15,
      damping: STAR_DAMPING,
      drift: drift(0.018, 0.0000001 + rand() * 0.00000015)
    };
  });

  const content = new Map<string, Node>();
  for (const s of [...graph.nodes].sort((a: GraphNode, b: GraphNode) => a.level - b.level)) {
    const p = s.parent === undefined ? null : content.get(s.parent)!;
    const angle = rand() * Math.PI * 2;
    const node: Node = {
      x: s.anchor ? width * s.anchor[0] : clamp(p!.x + Math.cos(angle) * CONTAINS_REST[s.level], 28, width - 28),
      y: s.anchor ? height * s.anchor[1] : clamp(p!.y + Math.sin(angle) * CONTAINS_REST[s.level], 28, height - 28),
      vx: 0,
      vy: 0,
      r: NODE_RADIUS[s.level],
      damping: CONTENT_DAMPING,
      drift: drift(0.012, 0.00000008),
      level: s.level,
      label: s.label,
      href: s.href
    };
    if (s.anchor) node.anchor = s.anchor;
    content.set(s.id, node);
  }
  const nodes = [...stars, ...content.values()];

  // 3. Edges: containment (short, strong), citations (long, weak), star lattice, roots tied to nearby stars
  const edges: Edge[] = [];
  for (const s of graph.nodes) {
    if (s.parent !== undefined) {
      edges.push({ a: content.get(s.parent)!, b: content.get(s.id)!, rest: CONTAINS_REST[s.level], strength: CONTAINS_STRENGTH, kind: "contains" });
    }
  }
  for (const e of graph.edges) {
    const a = content.get(e.a)!;
    const b = content.get(e.b)!;
    edges.push({ a, b, rest: Math.hypot(a.x - b.x, a.y - b.y) * CITES_PULL, strength: CITES_STRENGTH, kind: "cites" });
  }
  const reach = Math.min(width, height) * 0.24;
  stars.forEach((a, i) => {
    nearest(a, stars.slice(i + 1), rand() < 0.42 ? 2 : 1)
      .filter(({ d }) => d < reach)
      .forEach(({ b, d }) => edges.push({ a, b, rest: d, strength: STAR_STRENGTH + rand() * 0.000007, kind: "star" }));
  });
  for (const root of nodes.filter((n) => n.level === 0)) {
    nearest(root, stars, 3).forEach(({ b, d }) => edges.push({ a: root, b, rest: d, strength: ROOT_TIE_STRENGTH, kind: "star" }));
  }

  // 4. DOM
  const edgeEls = edges.map((e) => {
    const line = document.createElementNS(NS, "line");
    line.setAttribute("class", `edge ${e.kind}`);
    svg.appendChild(line);
    return line;
  });

  const nodeEls = nodes.map((n) => {
    const g = document.createElementNS(NS, "g");
    if (n.href) g.appendChild(circle(HIT_RADIUS, "hit"));
    g.appendChild(circle(n.r, n.href ? "node content" : `node ${n.r < 1.5 ? "tiny" : ""}`));

    if (n.href && n.label) {
      const label = document.createElementNS(NS, "text");
      label.setAttribute("class", `node-label ${n.level! <= LABEL_LEVEL ? "visible" : ""}`);
      label.setAttribute("x", String(n.r + 10));
      label.setAttribute("y", "4");
      label.textContent = n.label;
      g.appendChild(label);
      if (n.level! > LABEL_LEVEL) {
        g.addEventListener("pointerenter", () => label.classList.add("peek"));
        g.addEventListener("pointerleave", () => label.classList.remove("peek"));
      }
      g.addEventListener("click", () => {
        if (!justDragged) window.location.href = n.href!;
      });
    }

    g.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const target = toSvg(e);
      drag = { node: n, group: g, startX: e.clientX, startY: e.clientY, target, lastTime: performance.now(), vx: n.vx, vy: n.vy, moved: false };
      g.setPointerCapture?.(e.pointerId);
      g.querySelector(".node")?.classList.add("dragging");
    });

    svg.appendChild(g);
    return g;
  });

  // 5. Events
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const now = performance.now();
    const pt = toSvg(e);
    const elapsed = Math.max(8, now - drag.lastTime);
    drag.vx = drag.vx * 0.76 + ((pt.x - drag.target.x) / elapsed) * 0.24;
    drag.vy = drag.vy * 0.76 + ((pt.y - drag.target.y) / elapsed) * 0.24;
    drag.target = pt;
    drag.lastTime = now;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5) drag.moved = true;
  });
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);
  svg.addEventListener("pointerleave", (e) => {
    if (drag && e.buttons === 0) endDrag();
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
    }
  });

  // 6. Loop
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  for (let i = 0; i < WARMUP_STEPS; i++) physics(16, 0);
  requestAnimationFrame(tick);

  function tick(now: number): void {
    const dt = Math.min(24, now - last || 16);
    last = now;
    physics(dt, now);
    edges.forEach((e, i) => {
      const el = edgeEls[i]!;
      el.setAttribute("x1", String(e.a.x));
      el.setAttribute("y1", String(e.a.y));
      el.setAttribute("x2", String(e.b.x));
      el.setAttribute("y2", String(e.b.y));
    });
    nodes.forEach((n, i) => nodeEls[i]!.setAttribute("transform", `translate(${n.x},${n.y})`));
    requestAnimationFrame(tick);
  }

  function physics(dt: number, now: number): void {
    const t = now * 0.001;
    const held = drag?.node ?? null;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 80;
        const d = Math.sqrt(d2);
        if (d > REPULSION_REACH) continue;
        const f = (REPULSION / d2) * dt;
        dx /= d;
        dy /= d;
        if (a !== held) { a.vx -= dx * f; a.vy -= dy * f; }
        if (b !== held) { b.vx += dx * f; b.vy += dy * f; }
      }
    }

    for (const e of edges) {
      let dx = e.b.x - e.a.x;
      let dy = e.b.y - e.a.y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (d - e.rest) * e.strength * dt;
      dx /= d;
      dy /= d;
      if (e.a !== held) { e.a.vx += dx * f; e.a.vy += dy * f; }
      if (e.b !== held) { e.b.vx -= dx * f; e.b.vy -= dy * f; }
    }

    for (const n of nodes) {
      if (drag && n === drag.node) {
        const follow = 1 - Math.exp(-dt / 95);
        const oldX = n.x;
        const oldY = n.y;
        n.x += (drag.target.x - n.x) * follow;
        n.y += (drag.target.y - n.y) * follow;
        n.vx = (n.x - oldX) / Math.max(dt, 1);
        n.vy = (n.y - oldY) / Math.max(dt, 1);
        continue;
      }

      n.vx += Math.sin(t * n.drift.speedX + n.drift.phaseX) * n.drift.strength * dt;
      n.vy += Math.cos(t * n.drift.speedY + n.drift.phaseY) * n.drift.strength * dt;
      if (n.anchor) {
        n.vx += (width * n.anchor[0] - n.x) * ANCHOR_STRENGTH * dt;
        n.vy += (height * n.anchor[1] - n.y) * ANCHOR_STRENGTH * dt;
      }

      const damping = Math.pow(n.damping, dt / 16);
      n.vx *= damping;
      n.vy *= damping;
      const speed = Math.hypot(n.vx, n.vy);
      if (speed > MAX_SPEED) {
        n.vx *= MAX_SPEED / speed;
        n.vy *= MAX_SPEED / speed;
      }

      n.x += n.vx * dt;
      n.y += n.vy * dt;
      if (n.x < PAD) { n.x = PAD; n.vx *= 0.12; }
      if (n.x > width - PAD) { n.x = width - PAD; n.vx *= 0.12; }
      if (n.y < PAD) { n.y = PAD; n.vy *= 0.12; }
      if (n.y > height - PAD) { n.y = height - PAD; n.vy *= 0.12; }
    }
  }

  function endDrag(): void {
    if (!drag) return;
    drag.group.querySelector(".node")?.classList.remove("dragging");
    drag.node.vx = clamp(drag.vx * RELEASE_SCALE, -0.05, 0.05);
    drag.node.vy = clamp(drag.vy * RELEASE_SCALE, -0.05, 0.05);
    justDragged = drag.moved;
    drag = null;
    setTimeout(() => { justDragged = false; }, 0);
  }

  function toSvg(e: PointerEvent): { x: number; y: number } {
    const rect = svg.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) * width) / rect.width, y: ((e.clientY - rect.top) * height) / rect.height };
  }

  function drift(speedBase: number, strength: number): Node["drift"] {
    return {
      phaseX: rand() * Math.PI * 2,
      phaseY: rand() * Math.PI * 2,
      speedX: speedBase + rand() * speedBase,
      speedY: speedBase + rand() * speedBase,
      strength
    };
  }
}

function nearest(a: Node, candidates: Node[], count: number): { b: Node; d: number }[] {
  return candidates
    .map((b) => ({ b, d: Math.hypot(a.x - b.x, a.y - b.y) }))
    .sort((p, q) => p.d - q.d)
    .slice(0, count);
}

function circle(r: number, cls: string): SVGCircleElement {
  const c = document.createElementNS(NS, "circle");
  c.setAttribute("r", String(r));
  c.setAttribute("class", cls);
  return c;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
