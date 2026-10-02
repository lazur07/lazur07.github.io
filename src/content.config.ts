import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const entry = z.object({
  title: z.string(),
  date: z.date(),
  summary: z.string(),
  label: z.string().optional(),
  meta: z.string().optional(),
  cites: z.array(z.string()).default([])
});

const collection = (base: string) => defineCollection({ loader: glob({ pattern: "**/*.mdx", base }), schema: entry });

export const collections = {
  blog: collection("./src/content/blog"),
  projects: collection("./src/content/projects"),
  about: defineCollection({ loader: glob({ pattern: "**/*.mdx", base: "./src/content/about" }), schema: z.object({ title: z.string() }) })
};
