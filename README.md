<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="112" alt="Stash">

# Stash

**Everything you copy, kept.**

A clipboard manager for macOS that remembers what you copied, lets you group and
lock what matters, and expands text shortcuts anywhere you type.

[![Release](https://img.shields.io/github/v/release/santoshP0/clipboard-manager?include_prereleases&label=release)](https://github.com/santoshP0/clipboard-manager/releases)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey)
![Built with](https://img.shields.io/badge/built%20with-Tauri%20%2B%20Rust%20%2B%20React-blue)

</div>

---

## What it does

Stash sits in your menu bar and quietly records everything you copy — text,
links, code, colours, images and files. Press **⌘⇧V** anywhere and your history
is right there, searchable, one keystroke from the clipboard.

Nothing is uploaded. There is no account, no subscription and no telemetry. Your
history is a single file in your own Application Support folder.

## Features

**History that understands what you copied.** Items are classified as text,
link, code, colour, image or file, each with its own preview — syntax-tinted
code, rendered images, colour swatches, link cards. Copy the same thing twice
and the existing entry moves to the top instead of piling up a duplicate.

**Quick Access (⌘⇧V).** A floating panel with fuzzy search, arrow-key
navigation, live preview, and segments for Recent, Pinned, Images, Code, Files,
Links and Collections. Enter copies and dismisses.

**Collections, with locks.** Group the things you keep coming back to. Lock a
collection and its contents freeze — no deleting, no moving out, and they're
skipped by auto-clear and the history limit. The lock is enforced in the Rust
backend, so ⌘⌫, the tray and Clear history all respect it.

**Snippets and text expansion.** Save text you retype constantly, then either
copy it from the list, find it by typing its trigger in Quick Access, or — on
macOS with Accessibility granted — type `;sig` in *any* app and watch it become
the full text, the way iOS Text Replacement works.

**Undo delete.** Deleted items are held briefly and restorable from the toast.
Configurable: on/off, and 3 / 5 / 10 seconds.

**Privacy controls.** Copies from password managers are ignored, anything that
looks like a secret is flagged and auto-cleared on a schedule you choose, and
you can pause recording from the menu bar at any time.

**Details.** Multi-select with Finder rules (click, ⌘-click, shift-click),
particle-dissolve delete animation, pinning and favourites, timeline and grid
views, usage statistics, light/dark themes with five accent colours, launch at
login, and a menu-bar list you can point at Recent, Pinned, Favorites or any set
of collections.

## Install

Grab the build for your platform from
[Releases](https://github.com/santoshP0/clipboard-manager/releases).

| Platform | File |
| --- | --- |
| macOS (Apple Silicon) | `Stash_1.0.0_aarch64.dmg` |
| macOS (Intel) | `Stash_1.0.0_x64.dmg` |
| Windows | `Stash_1.0.0_x64-setup.exe` / `.msi` |
| Linux | `stash_1.0.0_amd64.deb` / `.AppImage` |

**macOS first launch:** the builds are ad-hoc signed, so Gatekeeper blocks a
plain double-click. Right-click the app → **Open** → **Open**. Once only.

## Text expansion setup (macOS)

Expansion has to watch your typing outside Stash, which macOS gates behind
Accessibility permission. Stash asks for it once — when you save your first
snippet — and never again.

1. **Snippets** → **+ New snippet**, give it a name, a trigger and a body
2. Grant Accessibility when macOS asks. No prompt? The banner on the Snippets
   page has an **Open** button, then add Stash with **+**
3. The banner turns green on its own once the permission lands
4. Type your trigger anywhere

Start triggers with punctuation — `;sig`, not `sig`. The matcher checks whether
what you typed *ends with* a trigger, so a bare word would fire inside other
words (`cod` inside "code").

What's watched is deliberately narrow: a rolling 40-character window held in
memory, cleared the moment it can't complete a trigger. Nothing typed is stored,
logged or sent anywhere. The whole feature stays dark until you turn it on.

## Platform support

The app builds and runs everywhere, but some features need macOS APIs that have
no cross-platform equivalent yet. Anything unavailable is hidden rather than
shown broken.

| | macOS | Windows | Linux |
| --- | :---: | :---: | :---: |
| Clipboard history, search, previews | ✅ | ✅ | ✅ |
| Quick Access, global hotkey, tray | ✅ | ✅ | ✅ |
| Collections, locking, snippets | ✅ | ✅ | ✅ |
| Undo delete, themes, statistics | ✅ | ✅ | ✅ |
| Snippet expansion as you type | ✅ | — | — |
| Source app detection | ✅ | — | — |
| Copying files from the file manager | ✅ | — | — |

## Build from source

Needs [Bun](https://bun.sh), [Rust](https://rustup.rs) and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform.

```sh
bun install
bun run app          # dev, with frontend hot reload
bun run app:build    # release bundle
```

macOS signing: `tauri.conf.json` references a local self-signed identity called
`Memory Dev`. Either create one in Keychain Access, or drop the `macOS.signingIdentity`
key to fall back to ad-hoc signing.

Testing expansion in dev needs a real `.app` bundle — macOS won't grant
Accessibility to the bare binary `tauri dev` produces:

```sh
bun run app:ax       # signed debug bundle, then launches it
```

## How it's built

Rust does the work that has to be native — clipboard polling, the store, tray
and window management, the pasteboard flavours, and the key monitor behind
expansion. React draws everything, with the two halves talking over Tauri
commands and a single `store` event that pushes the whole state to every window.

The store is one JSON file, rewritten on each capture. That's honest for
hundreds of items; SQLite is the upgrade when history outgrows it.

```
src/            React — Full (main window), Quick, Menu (tray popover), shared ui
src-tauri/src/  Rust — capture, store, commands, tray, snippet expansion
```

## Releasing

Push a tag and GitHub Actions builds all four artifacts and opens a draft
release:

```sh
git tag v1.0.0 && git push origin --tags
```
