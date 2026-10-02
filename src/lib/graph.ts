import { render } from "astro:content";
import { entries } from "./entries";
import { SITE } from "../site";

export type Level = 0 | 1 | 2;

export interface GraphNode {
  id: string;
  level: Level;
  label: string;
  href: string;
  parent?: string;
  anchor?: readonly [number, number];
}

export interface Graph {
  nodes: GraphNode[];
  edges: { a: string; b: string }[];
}

// Sections are level 0; each blog post and project is level 1 under its section; their h2 headings are level 2.
export async function buildGraph(): Promise<Graph> {
  const nodes: GraphNode[] = SITE.sections.map((s) => ({ id: s.id, level: 0, label: s.id, href: `/${s.id}/`, anchor: s.anchor }));
  const edges: Graph["edges"] = [];

  for (const section of ["blog", "projects"] as const) {
    for (const entry of await entries(section)) {
      const href = `/${section}/${entry.id}/`;
      nodes.push({ id: entry.id, level: 1, parent: section, label: entry.data.label ?? entry.data.title, href });
      for (const h of (await render(entry)).headings.filter((h) => h.depth === 2)) {
        nodes.push({ id: `${entry.id}#${h.slug}`, level: 2, parent: entry.id, label: h.text, href: `${href}#${h.slug}` });
      }
      for (const b of entry.data.cites) edges.push({ a: entry.id, b });
    }
  }
  return { nodes, edges };
}
