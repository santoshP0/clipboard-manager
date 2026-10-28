#!/usr/bin/env bash
set -euo pipefail

version="${1#v}"
tag="v${version}"

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo "Usage: ./release.sh <major.minor.patch>" >&2
  exit 1
fi

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Release aborted: switch to the main branch first." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Release aborted: commit or stash the current changes first." >&2
  exit 1
fi

git fetch origin main --quiet
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "Release aborted: main must be fully synced with origin/main." >&2
  exit 1
fi

if [[ ! -s WHATS_NEW.txt ]] || ! grep -q '[[:alnum:]]' WHATS_NEW.txt; then
  echo "Release aborted: add the release notes to WHATS_NEW.txt first." >&2
  exit 1
fi

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "Release aborted: tag $tag already exists locally." >&2
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/$tag" >/dev/null 2>&1; then
  echo "Release aborted: tag $tag already exists on origin." >&2
  exit 1
fi

node scripts/set-version.mjs "$version"

echo "Verifying v${version}..."
bun run build
bun run lint
cargo check --manifest-path src-tauri/Cargo.toml

git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml \
  src-tauri/Cargo.lock src/Full.tsx
git commit -m "chore(release): ${tag}"
git tag -a "$tag" -F WHATS_NEW.txt

echo "Publishing ${tag} from main..."
git push --atomic origin main "$tag"

# The tag points at the commit that still contains these notes, so the release
# workflow can read them even after main is prepared for the next release.
: > WHATS_NEW.txt
git add WHATS_NEW.txt
git commit -m "chore: prepare notes for the next release"
git push origin main

echo "Published ${tag}. GitHub Actions is now building the installers."
echo "WHATS_NEW.txt is empty and ready for the next release."

