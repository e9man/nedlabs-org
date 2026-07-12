# build

`cancer-center/index.html` is generated. Do not edit it by hand.

Source of truth is the Claude Design project:
https://claude.ai/design/p/b5590216-7b66-4429-95e1-1177ab242be1?file=NED+Labs+Site.dc.html

## Regenerate

    node build/gen.js cancer-center/index.html

## Why a build step

The design is a `.dc.html` component, not a page. It uses `<sc-for>`, `<sc-if>`,
`{{ }}` interpolation and a `DCLogic` class, all resolved at runtime by
`support.js`. None of that runs as a static file, so `gen.js` resolves the loops
and the team/institution ordering at build time.

Two behaviors have no static equivalent and are translated by hand in
`template.html`:

- The component reads `window.innerWidth < 720` to reorder the team list and to
  swap the timeline arrow between horizontal and vertical. Both variants are
  emitted and toggled by a media query at the same breakpoint (`.ned-wide` /
  `.ned-narrow`).
- The email field folds the typed address into the `mailto:` body. Reproduced
  with a small inline script.

**Consequence:** when the design changes *structurally*, `template.html` must be
re-translated by a human. Re-running `gen.js` alone will regenerate the old
structure with new data. Content-only changes (copy, team list) are safe to
propagate by editing `gen.js`/`template.html` text.

## Assets

`DesignSync.get_file` caps responses at 256 KiB, so the photographic assets
cannot be pulled through the API. They are committed here directly.
`hero-building.jpg` was re-encoded from a 3.8 MB PNG.
