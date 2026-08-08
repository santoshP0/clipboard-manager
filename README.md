<div align="center">

<img src="src-tauri/icons/128x128@2x.png" width="120" alt="Stash">

# Stash

### Everything you copy, kept.

Your Mac forgets the last thing you copied the moment you copy the next one.
Stash remembers all of it — searchable, organised, and one keystroke away.

[**Download**](https://github.com/santoshP0/clipboard-manager/releases/latest) ·
[Features](#features) ·
[Shortcuts](#keyboard-shortcuts) ·
[Text expansion](#text-expansion) ·
[Run locally](#run-it-locally)

[![Release](https://img.shields.io/github/v/release/santoshP0/clipboard-manager?include_prereleases&label=download)](https://github.com/santoshP0/clipboard-manager/releases/latest)
![Platform](https://img.shields.io/badge/macOS%2011%2B-supported-success)
[![Licence](https://img.shields.io/badge/licence-MIT-success)](LICENSE)
![No telemetry](https://img.shields.io/badge/telemetry-none-success)

<sub>First launch: right-click the app → **Open** → **Open**. It isn't notarised by Apple, so a plain double-click is blocked. Once only.</sub>

</div>

---

## The problem

You copy a link, then copy an address, and the link is gone. You paste the wrong
thing into the wrong chat. You retype the same email signature for the
four-hundredth time. You copy a code snippet, get distracted, copy something
else, and lose it.

Stash fixes all four. Press **⌘⇧V**, search, hit Enter — it's on your clipboard.

---

## Features

| Feature | What it does |
| --- | --- |
| **Smart history** | Records everything you copy and recognises what it is — text, links, code, colours, images, files — with the right preview for each. Syntax-tinted code, real image thumbnails, colour swatches, link domains. |
| **No duplicates** | Copy the same thing twice and the existing entry moves back to the top instead of piling up, keeping the pin, star and collection you gave it. |
| **Quick Access** `⌘⇧V` | A floating panel over whatever you're doing. Fuzzy search — type `mmry` to find "memory-notes" — live preview, and seven segments: Recent, Pinned, Images, Code, Files, Links, Collections. |
| **Collections** | Group things you reach for constantly — client details, licence keys, boilerplate — into named collections. |
| **Locking** | Lock a collection and its contents freeze: can't be deleted, can't be moved out, skipped by auto-clear and the history limit. Enforced in the backend, so `⌘⌫`, the menu bar and Clear history all refuse alike. |
| **Snippets** | Save text you retype constantly. Copy it from the list, or find it instantly by typing its trigger into Quick Access. |
| **Text expansion** <sub>macOS</sub> | Type `sig` in any app and it becomes the full text as you type — like iOS Text Replacement. [Setup ↓](#text-expansion) |
| **Undo delete** | Deleted something you needed? The confirmation offers **Undo**. Configurable: off, or 3 / 5 / 10 seconds. |
| **Password managers ignored** | Copies from 1Password, Keychain Access, Bitwarden, LastPass, Dashlane and KeePassXC are never recorded. |
| **Secrets expire** | Anything containing `sk_live_`, `AKIA`, `ghp_`, `-----BEGIN`, `api_key` and similar is flagged and auto-cleared on your schedule — Never, 1 hour or 1 day. |
| **Pause any time** | One click in the menu bar and Stash stops recording. |
| **Stays on your Mac** | No account, no sync, no analytics, no crash reporting. No network calls at all. |
| **Multi-select** | Finder rules — click, `⌘`-click, `⇧`-click. Copy, move or delete a whole batch at once. |
| **Views** | List, timeline grouped by day, image grid, and usage statistics. |
| **Appearance** | Light, dark and system themes, five accent colours, and a compact density option. |
| **Menu bar list** | Point the tray popover at Recent, Pinned, Favorites, or any set of collections. |

---

## Keyboard shortcuts

**Anywhere**

| Shortcut | Action |
| --- | --- |
| `⌘⇧V` | Open Quick Access |

**Quick Access**

| Shortcut | Action |
| --- | --- |
| `↑` `↓` | Move through the list |
| `Enter` | Copy and close |
| `Esc` | Close |
| `⌘F` | Pin / unpin the highlighted item |
| `⌘⌫` | Delete the highlighted item |
| `⌘1`–`⌘7` | Jump to a segment |

**Main window**

| Shortcut | Action |
| --- | --- |
| `⌘A` | Select every item in the list |
| `⌘⌫` | Delete the selection |
| `⌘,` | Settings |
| Click / `⌘`-click / `⇧`-click | Select · add to selection · extend range |
| Double-click | Copy |

---

## Text expansion

Type a short trigger, get the full text — in any app, as you type.

| | |
| --- | --- |
| **You type** | `sig` |
| **You get** | `Santosh Kumar`<br>`Engineering · santosh@example.com` |

Stash types it for you in other apps, which macOS gates behind Accessibility
permission. It asks **once**, when you save your first snippet, and never again.

| Step | What to do |
| --- | --- |
| **1** | **Snippets → + New snippet.** Name it, give it a trigger like `sig`, paste the text it should become. |
| **2** | **Grant Accessibility** when macOS asks. No prompt? The banner on the Snippets page has an **Open** button — add Stash there with **+**. |
| **3** | **Wait for green.** The banner checks continuously and turns green the moment permission lands. No restart. |
| **4** | **Type your trigger** anywhere. |

**Rules worth knowing**

| | |
| --- | --- |
| **What's watched** | A rolling 40-character window, in memory only. Cleared the moment it can't complete a trigger, and again on every click, arrow key and `⌘`-shortcut. |
| **What's stored** | Nothing. Not written to disk, not logged, not transmitted. |
| **Off by default** | The feature stays completely dark until you enable it. Turning it off stops the watching. |
| **macOS only** | Windows and Linux have no equivalent API; the option is hidden there rather than shown broken. |

---

## Run it locally

**1. Install the toolchain**

| | |
| --- | --- |
| [Bun](https://bun.sh) | `curl -fsSL https://bun.sh/install \| bash` |
| [Rust](https://rustup.rs) | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Xcode Command Line Tools | `xcode-select --install` |

On Windows and Linux, follow the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) instead of the
Xcode step.

**2. Clone and install**

```sh
git clone https://github.com/santoshP0/clipboard-manager.git
cd clipboard-manager
bun install
```

**3. Run**

```sh
bun run app
```

The app launches and the interface hot-reloads as you edit `src/`. Changes to
`src-tauri/src/` rebuild the Rust binary and relaunch, which takes a minute.

**Building a release**

```sh
bun run app:build
```

Bundles land in `src-tauri/target/release/bundle/` — `.app` and `.dmg` on macOS,
`.msi` and `.exe` on Windows, `.deb` and `.AppImage` on Linux.

macOS signing uses a local self-signed identity named `Memory Dev`. Create one
in Keychain Access, or remove `bundle.macOS.signingIdentity` from
`src-tauri/tauri.conf.json` to fall back to ad-hoc signing.

## Licence

[MIT](LICENSE) — free to use, modify and distribute.

<div align="center">
<sub>Built with Tauri, Rust and React.</sub>
</div>
