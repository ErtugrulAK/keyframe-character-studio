---
title: Wiki Schema
created: 2026-08-08
updated: 2026-08-08
type: meta
tags: [meta, schema]
---

# Wiki Schema

## Domain
Keyframe Character Studio (KCS) — staj projesi. Karakter animasyon editörü; React + TypeScript canvas uygulaması. Ayrıca yazılım geliştirme, araç zinciri ve genel mühendislik bilgisi.

## Conventions
- File names: lowercase, hyphens, no spaces (e.g., `canvas-render-pipeline.md`)
- Every wiki page starts with YAML frontmatter (see below)
- Use `[[wikilinks]]` to link between pages (minimum 2 outbound links per page)
- When updating a page, always bump the `updated` date
- Every new page must be added to `index.md` under the correct section
- Every action must be appended to `log.md`

## Frontmatter
```yaml
---
title: Page Title
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: entity | concept | comparison | query | summary
tags: [from taxonomy below]
sources: [raw/articles/source-name.md]
confidence: high | medium | low
---
```

## Tag Taxonomy
- **KCS**: canvas, render, gizmo, mask, animation, inspector, freeform, container, media
- **Stack**: react, typescript, vite, svg, css, git
- **Concepts**: architecture, performance, debugging, testing, workflow
- **Meta**: meta, schema, log

Rule: every tag on a page must appear in this taxonomy. If a new tag is needed, add it here first.

## Page Thresholds
- **Create a page** when an entity/concept appears in 2+ sources OR is central to one source
- **Add to existing page** when a source mentions something already covered
- **DON'T create a page** for passing mentions or minor details
- **Split a page** when it exceeds ~200 lines

## Update Policy
When new information conflicts with existing content:
1. Newer sources generally supersede older ones
2. If genuinely contradictory, note both positions with dates and sources
3. Flag for user review
