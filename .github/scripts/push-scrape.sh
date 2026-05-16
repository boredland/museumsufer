#!/usr/bin/env bash
# Push a fresh scrape commit, recovering from rebase conflicts on the
# auto-generated data files. Scrape jobs run in parallel, so the remote
# can move under us between `git commit` and `git push` — when that
# happens, `git pull --rebase` conflicts on the generated file. Since
# the file is rewritten from scratch each scrape, the freshest version
# always wins: resolve the conflict by taking "theirs" during rebase
# (which, in rebase parlance, is our just-scraped commit).
#
# Usage: push-scrape.sh <generated-file>...
set -uo pipefail

paths=("$@")
if [ "${#paths[@]}" -eq 0 ]; then
  echo "push-scrape.sh: at least one path required" >&2
  exit 2
fi

resolve_rebase_conflict() {
  for p in "${paths[@]}"; do
    git checkout --theirs -- "$p"
    git add -- "$p"
  done
  # `core.editor=true` no-ops the commit-message editor that --continue
  # would otherwise spawn for the rebased commit.
  GIT_EDITOR=true git rebase --continue
}

for attempt in 1 2 3; do
  if git pull --rebase origin main; then
    if git push; then
      exit 0
    fi
  elif [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
    if resolve_rebase_conflict && git push; then
      exit 0
    fi
    git rebase --abort 2>/dev/null || true
  fi
  echo "push attempt $attempt failed, retrying"
  sleep $((attempt * 2))
done

exit 1
