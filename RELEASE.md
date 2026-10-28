# Stash release instructions

1. Pull or merge every change that belongs in the release.
2. Add concise, user-facing release notes to `WHATS_NEW.txt`.
3. Commit the application changes and release notes, then confirm the working
   tree is clean with `git status`.
4. Run the release command with the next version:

   ```sh
   npm run release -- 1.1.0
   ```

   Version examples:

   - Minor: `1.1.0`, then `1.2.0`
   - Bug fix: `1.1.1`, then `1.1.2`
   - Major: `2.0.0`

5. Monitor the [Release workflow](https://github.com/santoshP0/clipboard-manager/actions/workflows/release.yml).

## What the release command does

- Requires a clean `main` branch containing the latest `origin/main`.
- Validates the version and `WHATS_NEW.txt`.
- Updates the web, Tauri, Rust, lockfile, and in-app version values.
- Runs lint, the production frontend build, and `cargo check`.
- Creates the release commit and annotated `v*` tag.
- Atomically pushes `main` and the tag to GitHub.
- Starts the multi-platform GitHub Actions release build.
- Empties `WHATS_NEW.txt` only after the release tag is successfully pushed.
- Commits and pushes the empty notes file for the following release.

Tag-triggered builds publish the GitHub release. Starting the workflow manually
creates a draft instead, so it can be used as a non-public build test.

## Updater signing key

Updater bundles are signed with `TAURI_SIGNING_PRIVATE_KEY` in GitHub Actions.
The corresponding private key is backed up locally at
`~/.tauri/stash-updater.key`; it must never be committed or shared. The public
key is embedded in `src-tauri/tauri.conf.json`. Losing the private key prevents
future versions from updating installations that trust this key.
