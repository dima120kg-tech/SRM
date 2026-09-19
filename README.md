# masterSRM v0.2 — ATR 72

PWA in Cockpit Navy style for fast SRM navigation on iPhone.

## New in v0.2
- Interactive ATR 72 side-view locator: tap the airplane to choose FWD fuselage, Cargo Door area, Ice Shield, center fuselage, rear fuselage, wing or tail.
- LH / RH side selector.
- Cargo Door Area continues into a more precise choice: fuselage skin vs door and FWD/AFT/ABOVE/BELOW.
- Home icon in the header always returns to the initial page.
- New ATR 72-500 / SRM application icon.
- Four-tab bottom navigation: Search / Aircraft / Damage / SRM.

## Existing functions
- Russian/English quick search for indexed SRM structural-damage tasks.
- Damage wizard: location → structure → damage type → measurements.
- Ice Shield depth evaluation from SRM 535181-200-801-A01.
- FWD/REAR fuselage skin dent evaluation for configured indexed tasks.
- Cargo Compartment Door skin dent evaluation.
- Cargo Door Surround identification shortcuts.
- Local SRM PDF upload into IndexedDB; the PDF is not part of the public GitHub repo.
- Open original PDF at the indexed physical PDF page.
- Offline PWA shell and Cockpit Navy light/dark themes.

## Important
The aircraft picture is a navigation schematic, not an SRM structural drawing. Always confirm the exact structural part, A/C configuration/effectivity and the original current approved SRM page before making a maintenance decision.

## GitHub Pages
Upload all files/folders from this directory to the repository root. The service-worker cache version was changed to v0.2.0 so an installed PWA can update after deployment/reopen.

Source basis: user-provided ATR72 Structural Repair Manual, Revision 110, Jun 01/21.
