# Home Landing Notes

## Scope

- Home route `/` remains independent from `AppShell`.
- No left navigation is rendered on the landing page.
- Real API usage on the landing page is limited to `systemApi.getHealth`.
- Carousel metrics and demo charts use local fixed data only for presentation.

## Visual Direction

- Keep the product title full-screen centered.
- Extend additional content only below the main CTA.
- Use more solid surfaces in dark mode, especially for the lower cards and demo panels.
- Increase type size for all landing-page copy outside the product title.
- Add a physical industrial-control-device illustration beside the attack-and-crash storyline.

## Carousel Rules

- Three full cards are aligned along a diagonal offset, without cropping the selected card.
- The active card is always on the highest layer and fully opaque.
- Rotation is automatic; only dot indicators remain for manual selection.
- When a card reaches the front, its chart values animate from zero to the target values.

## Discovery Flow Rules

- Narrative: protocol fuzz input flood -> device instability and protective stop -> crash function localization.
- Device visuals are hand-built with HTML/CSS blocks and inline SVG, not copied from vendor assets.
- The dark theme uses lower transparency and stronger panel separation than the light theme.

## Motion and Cleanup

- Particle network respects `prefers-reduced-motion`.
- `requestAnimationFrame`, `setInterval`, resize listeners, pointer listeners, and blur/mouseleave listeners are cleaned up on unmount.
