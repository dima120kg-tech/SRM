# masterSRM v0.1 — ATR 72

PWA prototype in Cockpit Navy style.

## What works now
- Russian/English quick search for a starter set of SRM structural-damage tasks.
- Damage wizard: location → structure → damage type → measurements.
- Ice Shield depth evaluation based on SRM 535181-200-801-A01.
- FWD/REAR fuselage skin dent evaluation using the SRM formula `allowable depth = A × 0.02`, capped at 2.0 mm, for the task condition D≥E.
- Cargo Compartment Door skin dent evaluation using the same source task formula.
- Cargo Door Surround identification shortcuts.
- Local SRM PDF upload into IndexedDB; the PDF is not part of the public GitHub repo.
- Open original PDF at the indexed physical PDF page.
- PWA/offline shell and Cockpit Navy light/dark themes.

## Important
This is a navigation and calculation aid. Always verify aircraft configuration/effectivity and the original current approved SRM page before making a maintenance decision.

## GitHub Pages
Upload all files/folders from this directory to the repository root, enable Pages from `main` / `(root)`, then open the site in Safari and Add to Home Screen.

## Source basis used for this prototype
ATR72 Structural Repair Manual, Revision 110, Jun 01/21, user-provided PDF.
