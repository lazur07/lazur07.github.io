// Single source of truth for the constellation. Containment comes from `parent`; `edges` lists citations only.
window.GRAPH = {
  nodes: [
    { id: "blog",       level: 0, label: "blog",      href: "blog.html",                     anchor: [0.24, 0.28] },
    { id: "about",      level: 0, label: "about",     href: "about.html",                    anchor: [0.76, 0.30] },
    { id: "projects",   level: 0, label: "projects",  href: "projects.html",                 anchor: [0.70, 0.73] },

    { id: "blog-1",     level: 1, parent: "blog",     label: "blog 1",    href: "posts/blog-1.html" },
    { id: "blog-1-s1",  level: 2, parent: "blog-1",   label: "section 1", href: "posts/blog-1.html#section-1" },
    { id: "blog-1-s2",  level: 2, parent: "blog-1",   label: "section 2", href: "posts/blog-1.html#section-2" },
    { id: "blog-2",     level: 1, parent: "blog",     label: "blog 2",    href: "posts/blog-2.html" },

    { id: "project-1",  level: 1, parent: "projects", label: "project 1", href: "projects.html#project-1" }
  ],
  edges: [
    { a: "blog-1", b: "project-1", type: "cites" },
    { a: "blog-2", b: "blog-1",    type: "cites" }
  ]
};
