# Azure Lin — Constellation Homepage

A custom static academic site for GitHub Pages.

## Landing page

- no navigation bar
- center identity only
- force-directed draggable constellation
- selected nodes link to Blog / About / Projects
- U of T deep blue accent

## Files

- `index.html` — constellation landing page
- `graph.js` — single source of truth: content nodes (level, parent, href) and citation edges
- `constellation.js` — force simulation + drag interaction, reads `graph.js`
- `styles.css` — shared styling
- `blog.html` — blog index
- `about.html` — about page
- `projects.html` — project index
- `posts/` — individual posts

## Graph

- containment comes from each node's `parent`; `edges` lists citations only
- containment edges: short, strong, high opacity; citation edges: long, weak, low opacity; both solid
- labels are shown only for level 0; deeper content nodes reveal their label on hover and navigate on click
- decorative stars have no label and no hover response

## Deploy

Create a repository named `lazur07.github.io`, upload all files to the repository root,
then enable GitHub Pages from `main` / root.


## Motion model

The constellation uses a deliberately slow, viscous force simulation:

- no startup settling shock
- almost-zero initial velocity
- extremely soft spring links
- very weak ambient drift
- viscous drag that lags behind the pointer
- preserved release inertia
- connected nodes follow gradually instead of snapping
