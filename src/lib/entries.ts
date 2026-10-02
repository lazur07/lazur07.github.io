import { getCollection } from "astro:content";

export type Section = "blog" | "projects";

// Entries with `public: false` in their frontmatter stay out of every page and out of the constellation.
export const entries = async (section: Section) => (await getCollection(section)).filter((e) => e.data.public);

export const stamp = (d: Date) => d.toISOString().slice(0, 10).replaceAll("-", ".");
