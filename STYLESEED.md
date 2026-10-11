# StyleSeed — BYVIT blog design lock

- App domain: content
- Surface: responsive website
- Surface adapter: product-ui
- Page type: detail
- Output grammar: editorial-reading
- Grammar path: built-in:engine/RULESETS.md
- Grammar fallback: editorial-reading
- Reference confidence: n/a
- Brand recipe: editorial-authority
- Palette recipe: editorial-ink
- Aesthetic profile: none
- Skin: custom
- Primary action: #123D30
- Font: Montserrat headings / Inter body; Russian
- Radius: restrained, existing BYVIT hairline cards
- Elevation: flat surfaces; no new shadows
- Density: comfortable
- Motion: none for editorial content; existing shop motion unchanged
- Imagery/data role: article covers support topic discovery; catalog cards retain live prices
- Signature move: readable article aligned with the logo on desktop, full blog cards on the right, compact contents, then selected catalog products
- Locked: 2026-10-11

## Bounded brand and product constraints

Apply this lock only to the new blog module. Preserve the existing shop and admin design.
Use existing CSS semantic tokens (forest accent, graphite text, cream secondary surface,
beige hairlines, light primary canvas). Keep product-card behavior and the five mobile tabs.
Blog discovery: three/two/one columns at desktop/tablet/mobile; card titles below images.
Article: maximum 740px text measure; 16–18px body; no catalog sidebar, comments,
newsletter or AI controls. Admin uses its existing form/layout conventions.
Above 1100px, align the article to the main container left edge and reuse the existing
related articles as a right column of full blog cards with cover, description and reading link.
Reuse the same card styling as the blog listing. At 1100px and below keep the original
single reading column and related articles beneath it. Routes, data and editor stay unchanged.
Empty, missing article, keyboard focus and safe preview states are required.
