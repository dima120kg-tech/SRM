# masterSRM v0.3 — ATR 72

PWA for iPhone in Cockpit Navy style, using official SRM location figures as an interactive damage locator.

## New in v0.3
- Official SRM Figure 5 is used as the main tappable aircraft map.
- Separate LH / RH selection is retained as part of the damage location context.
- Fuselage refinement screen uses official SRM Figure 2 with selectable ST2 / ST3 / ST7 (Freighter) configuration.
- Tap directly along the fuselage to place a red location marker; the app gives an approximate X/STA and nearest major FR reference.
- The visible source figure retains all printed STA / FR / section markings from the SRM image.
- Official SRM Figure 3 is used as a second interactive map for Vertical Stabilizer, Wing-to-Fuselage Fairing, Belly Fairings and Power Plant/Nacelle areas.
- Selected location is carried into the damage wizard.
- Cargo Door Area still branches to door vs surrounding fuselage skin and then damage type.
- Home icon continues to return immediately to the initial page.
- All location figures are cached for offline PWA use.

## Source figures included
Only the user-approved pages from the supplied 9-page SRM extract are used:
- extract page 1: Figure 2 Sheet 1 / ST2
- extract page 2: Figure 2 Sheet 2 / ST3
- extract page 3: Figure 2 Sheet 3 / ST7 Freighter
- extract page 5: Figure 3 / Vertical Stabilizer, Top/Belly Fairings, Power Plants and Nacelles
- extract page 7: Figure 5 / Major Sub Zones

Extract pages 4, 6, 8 and 9 are intentionally not used.

## Damage assessment
The locator identifies and narrows the structural location. Automatic dimensional evaluation is only performed where a verified rule is present in the built-in index (currently Ice Shield, FWD fuselage skin dents, rear fuselage skin dents, and Cargo Compartment Door skin dents). For other clicked locations the app stores the location and routes to SRM search without inventing a limit.

## Local SRM
The full SRM PDF is not included in this public package. The user can load it locally into IndexedDB on the iPhone; source buttons then open the corresponding physical PDF page.
