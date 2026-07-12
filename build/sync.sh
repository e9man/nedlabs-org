#!/bin/bash
# Design sync checker. Run by the launchd agent org.nedlabs.design-sync,
# or by hand: ./build/sync.sh
#
# Fetches the Claude Design source, classifies the change, and opens a PR.
# Never pushes to main: merging main deploys to nedlabs.org/home.
#
# Two things this script has already been bitten by, do not undo them:
#
#   * It must stay TRACKED by git. `git clean -fd` below deletes untracked files,
#     and an untracked copy of this script deletes itself mid-run.
#   * `git reset --hard origin/main` DISCARDS local commits. Push your work before
#     running this by hand, or it is gone.
set -uo pipefail

REPO="$HOME/code/nedlabs-org"
LOG="$HOME/Library/Logs/nedlabs-design-sync.log"
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.npm-global/bin"

exec >>"$LOG" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') design-sync starting ==="

cd "$REPO" || { echo "FATAL: $REPO missing"; exit 1; }

# The ambient gh account is `glicksman`, which has no write access to e9man/*.
# Both `git push` and `gh pr create` must run as e9man.
GH_TOKEN="$(gh auth token -u e9man 2>/dev/null)"
if [ -z "$GH_TOKEN" ]; then
  echo "FATAL: no gh token for e9man (run: gh auth login -u e9man)"
  echo "=== $(date '+%H:%M:%S') design-sync finished (rc=1) ==="
  exit 1
fi
export GH_TOKEN

ASKPASS="$(mktemp -t nedlabs-askpass)"
cat > "$ASKPASS" <<'EOF'
#!/bin/sh
case "$1" in
  Username*) echo "x-access-token" ;;
  Password*) echo "$GH_TOKEN" ;;
esac
EOF
chmod 700 "$ASKPASS"
trap 'rm -f "$ASKPASS"' EXIT
export GIT_ASKPASS="$ASKPASS"
export GIT_TERMINAL_PROMPT=0
git config --local credential.helper ""

# The CLI self-updates by unlinking and replacing its binary. Testing -x before
# exec does not help: the file can vanish in the window between the two. Retry
# the exec itself when it fails with 127 (ENOENT).
run_claude() {
  local rc attempt=1
  while [ "$attempt" -le 4 ]; do
    "$(command -v claude 2>/dev/null || echo "$HOME/.npm-global/bin/claude")" "$@"
    rc=$?
    [ "$rc" -ne 127 ] && return "$rc"
    echo "  claude exec returned 127 (self-update race?), attempt $attempt; retrying in 20s"
    sleep 20
    attempt=$((attempt + 1))
  done
  echo "FATAL: claude CLI unusable after $((attempt - 1)) attempts"
  return 127
}

# Start from a clean copy of main so a half-finished previous run cannot poison the diff.
if ! git fetch --quiet origin main; then
  echo "FATAL: git fetch failed (network? auth?)"
  echo "=== $(date '+%H:%M:%S') design-sync finished (rc=1) ==="
  exit 1
fi
git checkout --quiet main && git reset --quiet --hard origin/main && git clean -qfd

run_claude -p --dangerously-skip-permissions "$(cat <<'PROMPT'
You are the nedlabs.org design-sync job, running unattended in ~/code/nedlabs-org.

Read build/SYNC.md and follow it exactly. Summary of the contract:

1. Load DesignSync (ToolSearch "select:DesignSync"). Fetch projectId
   b5590216-7b66-4429-95e1-1177ab242be1, path "NED Labs Site.dc.html".
   - If it needs authorization, print "BLOCKED: design auth" and STOP. Do not retry.
   - If truncated is true, print "BLOCKED: truncated" and STOP.
   Write it verbatim to /tmp/design-new.dc.html.

2. Run: node build/classify.js build/design-snapshot.dc.html /tmp/design-new.dc.html
   Exit 0 IDENTICAL  -> print "NO CHANGE" and STOP. Do not open a PR. Do not commit.
   Exit 1 CONTENT    -> apply the added/removed strings to build/template.html
                        (and to the data arrays in build/gen.js if dclogic_data_changed).
   Exit 2 STRUCTURAL -> re-translate build/template.html against the new design.
                        Preserve the static-only translations: the .ned-wide /
                        .ned-narrow media-query pair standing in for sc-if on
                        window.innerWidth, the inline script standing in for the
                        {{ onEmailChange }} binding, and single-quoted url() inside
                        style attributes.

3. Rebuild and gate. Both must pass; if either fails, print the failure and STOP
   without opening a PR:
     node build/gen.js home/index.html
     node build/check-parity.js /tmp/design-new.dc.html home/index.html

4. Refresh the snapshot:
     cp /tmp/design-new.dc.html build/design-snapshot.dc.html
     shasum -a 256 build/design-snapshot.dc.html | cut -d' ' -f1 > build/design.sha256

5. Open a PR on a new branch named design-sync/<verdict-lowercase>-<first 7 chars of
   the new design sha256>. NEVER push to main. GH_TOKEN and GIT_ASKPASS are already
   exported and authenticate as e9man; do not change git auth. Use:
     git push -u origin <branch>
     gh pr create --repo e9man/nedlabs-org --base main --head <branch> ...
   Title: "Design sync: <VERDICT>"
   Body: the full classify.js output in a code block, then one of:
     - CONTENT: "Copy-only change. Structure unchanged. Parity gate passed."
     - STRUCTURAL: "**Layout changed. A human must render this at 390px and 1400px
       before merging.** check-parity.js does not catch structural drift: the copy
       can match while the layout is stale."
   If the design references an asset missing from home/assets/, say so in the PR body
   and leave the <img> out rather than shipping a 404. Assets over 256 KiB cannot be
   fetched through DesignSync at all. Note home/assets/ ships .jpg where the design
   names .png for hero-building and researcher-desk; that substitution is deliberate
   (researcher-desk.jpg is redacted) and must not be "fixed".

Print exactly one final line: "NO CHANGE", "PR: <url>", or "BLOCKED: <reason>".
PROMPT
)"
rc=$?

echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') design-sync finished (rc=$rc) ==="
exit "$rc"
