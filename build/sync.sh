#!/bin/bash
# Design sync checker. Run by the launchd agent com.nedlabs.design-sync,
# or by hand: ./build/sync.sh
#
# Checks BOTH design pages against their committed snapshots and opens one PR
# per changed page. Never pushes to main: merging main deploys.
#
# Pages:
#   NED Labs Site.dc.html    -> cancer-center/index.html  (full design)
#   NED Labs Minimal (no logos).dc.html -> home/index.html           (minimalist)
#
# Two things this script has already been bitten by, do not undo them:
#   * It must stay TRACKED by git. `git clean -fd` deletes untracked files, and
#     an untracked copy of this script deletes itself mid-run.
#   * `git reset --hard origin/main` DISCARDS local commits. Push before running
#     this by hand, or the work is gone.
set -uo pipefail

REPO="$HOME/code/nedlabs-org"
LOG="$HOME/Library/Logs/nedlabs-design-sync.log"
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.npm-global/bin"

exec >>"$LOG" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') design-sync starting ==="

cd "$REPO" || { echo "FATAL: $REPO missing"; exit 1; }

# The ambient gh account is `glicksman`, which has no write access to e9man/*.
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

if ! git fetch --quiet origin main; then
  echo "FATAL: git fetch failed (network? auth?)"
  echo "=== $(date '+%H:%M:%S') design-sync finished (rc=1) ==="
  exit 1
fi

# Static prompt with placeholders, substituted per page. Keeping it static (not a
# heredoc that expands) avoids shell-escaping the design's own text.
PROMPT_TMPL="$(cat "$REPO/build/sync-prompt.txt")"

# page | design file | generator | snapshot | hash | output | branch-slug
PAGES=(
  "full|NED Labs Site.dc.html|build/gen.js|build/design-snapshot.dc.html|build/design.sha256|cancer-center/index.html|cancer-center"
  "minimal|NED Labs Minimal (no logos).dc.html|build/gen-minimal.js|build/design-minimal-snapshot.dc.html|build/design-minimal.sha256|home/index.html|home"
)

overall=0
for spec in "${PAGES[@]}"; do
  IFS='|' read -r page design gen snap hash out slug <<<"$spec"
  echo "--- page: $page ($design -> $out) ---"

  # Reset to a clean main before each page so branches never bleed together.
  git checkout --quiet main && git reset --quiet --hard origin/main && git clean -qfd

  prompt="${PROMPT_TMPL//__DESIGN_FILE__/$design}"
  prompt="${prompt//__GENERATOR__/$gen}"
  prompt="${prompt//__SNAPSHOT__/$snap}"
  prompt="${prompt//__HASH__/$hash}"
  prompt="${prompt//__OUTPUT__/$out}"
  prompt="${prompt//__SLUG__/$slug}"

  run_claude -p --dangerously-skip-permissions "$prompt"
  rc=$?
  [ "$rc" -ne 0 ] && overall=1
  echo "  ($page rc=$rc)"
done

git checkout --quiet main && git reset --quiet --hard origin/main && git clean -qfd
echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') design-sync finished (rc=$overall) ==="
exit "$overall"
