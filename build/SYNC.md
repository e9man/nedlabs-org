# Design sync runbook

Followed by the scheduled agent. Also usable by hand.

Design source of truth:
`https://claude.ai/design/p/b5590216-7b66-4429-95e1-1177ab242be1?file=NED+Labs+Site.dc.html`
projectId `b5590216-7b66-4429-95e1-1177ab242be1`, path `NED Labs Site.dc.html`.

## Rules

1. **Never push to `main`.** Open a PR. Merging `main` deploys, because GitHub
   Pages serves this repo and `nedlabs.org/cancer-center*` bypasses the Cloudflare Worker.
2. **Never hand-edit `cancer-center/index.html`.** It is generated. Edit `build/template.html`.
3. **A STRUCTURAL verdict means a human re-translates `build/template.html`.**
   `gen.js` resolves data, not layout. Re-running it against an old template
   regenerates the old structure wearing the new copy, and every automated check
   except a visual one will pass.

## Steps

1. Fetch the design with the `DesignSync` MCP tool (`get_file`). If it reports
   `truncated: true`, abort: the file is incomplete, do not compare against it.
   If the tool reports it needs authorization, abort and tell the user to run
   `/design-login` — do not retry in a loop.

   Write it verbatim to `/tmp/design-new.dc.html`.

2. Classify:

       node build/classify.js build/design-snapshot.dc.html /tmp/design-new.dc.html

   - exit 0 `IDENTICAL`  — nothing to do. Exit silently, no PR, no notification.
   - exit 1 `CONTENT`    — copy and/or the DCLogic data arrays moved. Apply the
     added strings to `build/template.html` (and team/institution data to
     `build/gen.js` if the data arrays changed).
   - exit 2 `STRUCTURAL` — markup, inline styles, or DCLogic control flow moved.
     Re-translate `build/template.html` against the new design by hand. Pay
     attention to anything the static build cannot express:
       * `sc-if` on runtime state (e.g. `window.innerWidth < 720`) becomes the
         `.ned-wide` / `.ned-narrow` media-query pair.
       * `{{ }}` bound handlers (e.g. `onEmailChange`) become the inline script.
       * `url("…")` in a `{{ }}` binding must be single-quoted so it survives
         inside a double-quoted `style` attribute.

3. Rebuild and gate:

       node build/gen.js cancer-center/index.html
       node build/check-parity.js /tmp/design-new.dc.html cancer-center/index.html

   `gen.js` throws if template syntax leaks through or the viewport is not
   `device-width`. `check-parity.js` fails if any design string is missing from
   the page. Note that parity does **not** catch structural drift — copy can
   match perfectly while the layout is stale. Do not treat it as sufficient.

4. Verify visually. Render at 390px and at 1400px and actually look:

       (cd . && python3 -m http.server 8899 &)
       # 390px: Chrome enforces a 500px minimum window width, so a
       # --window-size=390 screenshot lays out at 500 and crops to 390, which
       # looks exactly like horizontal overflow. Render in a 390px <iframe>.
       "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         --headless=new --disable-gpu --hide-scrollbars \
         --screenshot=/tmp/desk.png --window-size=1400,4700 \
         --virtual-time-budget=10000 http://localhost:8899/cancer-center/

   Confirm `document.documentElement.scrollWidth === clientWidth` at 320/360/390.

5. Refresh the snapshot so the next run diffs against this state:

       cp /tmp/design-new.dc.html build/design-snapshot.dc.html
       shasum -a 256 build/design-snapshot.dc.html | cut -d' ' -f1 > build/design.sha256

6. Branch, commit, open a PR. Title it with the verdict. In the body paste the
   full `classify.js` output, and state plainly whether a human needs to check
   the layout. Label a STRUCTURAL PR as needing visual review.

7. Assets: `DesignSync.get_file` caps at 256 KiB, so photographic assets cannot
   be fetched. If the design references an asset not in `cancer-center/assets/`, say so in
   the PR and leave the `<img>` out rather than shipping a 404.

   Before publishing any photo, look at it. `researcher-desk.jpg` had a legible
   screen showing an internal transcript; `opacity:0.22` hides nothing, since the
   file is served at full resolution. It was blurred before publishing.

## After merging

Cloudflare caches. Purge, then verify against the real domain, not the origin:

    curl -s -o /dev/null -w "%{http_code}\n" https://nedlabs.org/cancer-center/
