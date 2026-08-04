#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, LogicalPosition, Manager, State, WindowEvent};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

const POLL: Duration = Duration::from_millis(600);
const MAX_IMAGE_WIDTH: u32 = 1280;

/* ------------------------------------------------------------------ *
 * model
 * ------------------------------------------------------------------ */

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Item {
    id: u64,
    /// code | link | color | text | image | file
    kind: String,
    title: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    url: Option<String>,
    #[serde(default)]
    value: Option<String>,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    dims: Option<String>,
    #[serde(default)]
    size: Option<String>,
    #[serde(default)]
    lang: Option<String>,
    /// Bytes on disk / in memory, for the storage stat.
    #[serde(default)]
    bytes: u64,
    /// Content hash, so a restart doesn't re-capture what's already on top.
    #[serde(default)]
    hash: u64,
    app: String,
    ts: u64,
    pinned: bool,
    fav: bool,
    secret: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Snippet {
    id: u64,
    trigger: String,
    name: String,
    body: String,
    uses: u32,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Settings {
    theme: String,   // system | light | dark
    accent: String,  // hex
    density: String, // Comfortable | Compact
    show_counts: bool,
    launch_at_login: bool,
    ignore_password_managers: bool,
    /// Never | 1 hour | 1 day
    auto_clear: String,
    /// Unlimited | 200 | 500 | 1000
    history_limit: String,
    paused: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            accent: "#0a84ff".into(),
            density: "Comfortable".into(),
            show_counts: true,
            launch_at_login: false,
            ignore_password_managers: true,
            auto_clear: "1 hour".into(),
            history_limit: "Unlimited".into(),
            paused: false,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Default)]
struct Store {
    #[serde(default)]
    items: Vec<Item>,
    #[serde(default)]
    snippets: Vec<Snippet>,
    #[serde(default)]
    settings: Settings,
    #[serde(default)]
    next_id: u64,
}

struct AppState {
    dir: PathBuf,
    store: Mutex<Store>,
    /// Hash of the clipboard content we last saw (or wrote ourselves).
    seen: Mutex<u64>,
    /// Ignore the clipboard until this timestamp (ms) — used after we write it.
    suppress_until: Mutex<u64>,
}

/* ------------------------------------------------------------------ *
 * persistence
 * ------------------------------------------------------------------ */

fn store_path(dir: &PathBuf) -> PathBuf {
    dir.join("store.json")
}

fn load(dir: &PathBuf) -> Store {
    // ponytail: one JSON file. Swap for SQLite when history outgrows a full rewrite per capture.
    std::fs::read_to_string(store_path(dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save(dir: &PathBuf, store: &Store) {
    let _ = std::fs::create_dir_all(dir);
    if let Ok(json) = serde_json::to_string(store) {
        let _ = std::fs::write(store_path(dir), json);
    }
}

/// Persist, then push the whole store to every window.
fn publish(app: &AppHandle) {
    let state = app.state::<AppState>();
    let store = state.store.lock().unwrap();
    save(&state.dir, &store);
    let _ = app.emit("store", &*store);
}

/* ------------------------------------------------------------------ *
 * capture
 * ------------------------------------------------------------------ */

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn hash<T: Hash>(v: T) -> u64 {
    let mut h = DefaultHasher::new();
    v.hash(&mut h);
    h.finish()
}

/// Name of the frontmost app, so an item can say where it came from.
fn frontmost_app() -> String {
    // ponytail: `lsappinfo` needs no Accessibility prompt, unlike System Events.
    // Other platforms report Unknown until someone needs them.
    #[cfg(target_os = "macos")]
    {
        // `lsappinfo front` yields an ASN; asking it for that ASN's name gives
        // `"LSDisplayName"="Safari"`.
        let asn = std::process::Command::new("lsappinfo")
            .arg("front")
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
            .unwrap_or_default();

        if !asn.is_empty() {
            if let Ok(out) = std::process::Command::new("lsappinfo")
                .args(["info", "-only", "name", &asn])
                .output()
            {
                let s = String::from_utf8_lossy(&out.stdout);
                if let Some(name) = s.split('=').nth(1) {
                    let name = name.trim().trim_matches('"').trim();
                    if !name.is_empty() {
                        return name.to_string();
                    }
                }
            }
        }
    }
    "Unknown".into()
}

const PASSWORD_MANAGERS: [&str; 6] = [
    "1Password",
    "Keychain Access",
    "Bitwarden",
    "LastPass",
    "Dashlane",
    "KeePassXC",
];

const SECRET_MARKERS: [&str; 8] = [
    "sk_live_",
    "sk_test_",
    "-----BEGIN",
    "api_key",
    "apikey",
    "secret_key",
    "AKIA",
    "ghp_",
];

fn looks_secret(text: &str) -> bool {
    let lower = text.to_lowercase();
    SECRET_MARKERS
        .iter()
        .any(|m| lower.contains(&m.to_lowercase()))
}

fn looks_like_code(text: &str) -> bool {
    let symbols = text
        .chars()
        .filter(|c| "{};=<>()[]".contains(*c))
        .count();
    text.contains('\n') && symbols >= 3
}

fn language_of(text: &str) -> Option<String> {
    let t = text.trim_start();
    let lang = if t.starts_with('<') {
        "html"
    } else if t.starts_with("def ") || t.starts_with("class ") || t.contains("\ndef ") {
        "py"
    } else if t.starts_with("fn ") || t.contains("let mut ") || t.contains("-> ") {
        "rs"
    } else if (t.starts_with('.') || t.starts_with('#')) && t.contains('{') && t.contains(':') {
        "css"
    } else if t.contains("=>")
        || t.contains("function ")
        || t.contains("const ")
        || t.contains("let ")
        || t.contains("import ")
    {
        "ts"
    } else {
        "txt"
    };
    Some(lang.into())
}

fn is_color(text: &str) -> bool {
    let t = text.trim();
    t.starts_with('#')
        && matches!(t.len(), 4 | 7 | 9)
        && t[1..].chars().all(|c| c.is_ascii_hexdigit())
}

fn truncate(s: &str, max: usize) -> String {
    let s = s.trim();
    if s.chars().count() <= max {
        return s.to_string();
    }
    s.chars().take(max).collect::<String>() + "…"
}

fn text_item(id: u64, text: &str, app_name: String) -> Item {
    let trimmed = text.trim();
    let first_line = trimmed.lines().next().unwrap_or("").trim();
    let mut item = Item {
        id,
        kind: "text".into(),
        title: truncate(first_line, 60),
        body: Some(text.to_string()),
        url: None,
        value: None,
        path: None,
        dims: None,
        size: None,
        lang: None,
        bytes: text.len() as u64,
        hash: hash(&text.to_string()),
        app: app_name,
        ts: now_ms(),
        pinned: false,
        fav: false,
        secret: looks_secret(text),
    };

    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        if !trimmed.contains(char::is_whitespace) {
            let host = trimmed
                .trim_start_matches("https://")
                .trim_start_matches("http://")
                .split('/')
                .next()
                .unwrap_or(trimmed)
                .to_string();
            item.kind = "link".into();
            item.title = host;
            item.url = Some(trimmed.to_string());
            item.body = None;
            return item;
        }
    }

    if is_color(trimmed) {
        item.kind = "color".into();
        item.title = trimmed.to_uppercase();
        item.value = Some(trimmed.to_uppercase());
        item.body = None;
        return item;
    }

    // Only absolute paths, so an ordinary word that happens to match a file in
    // the working directory isn't mistaken for one.
    let path = PathBuf::from(trimmed);
    if !trimmed.contains('\n') && trimmed.starts_with('/') && path.exists() {
        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        item.kind = "file".into();
        item.title = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| trimmed.to_string());
        item.path = Some(trimmed.to_string());
        item.size = Some(human_size(size));
        item.bytes = size;
        item.body = None;
        return item;
    }

    if looks_like_code(text) {
        item.kind = "code".into();
        item.lang = language_of(text);
    }
    item
}

fn human_size(bytes: u64) -> String {
    match bytes {
        b if b >= 1 << 20 => format!("{:.1} MB", b as f64 / (1u64 << 20) as f64),
        b if b >= 1 << 10 => format!("{:.0} KB", b as f64 / (1u64 << 10) as f64),
        b => format!("{b} B"),
    }
}

/// Drop items the retention settings say we should no longer keep.
fn prune(store: &mut Store) {
    let limit = store.settings.history_limit.parse::<usize>().ok();
    let clear_after = match store.settings.auto_clear.as_str() {
        "1 hour" => Some(60 * 60 * 1000),
        "1 day" => Some(24 * 60 * 60 * 1000),
        _ => None,
    };
    let now = now_ms();

    if let Some(window) = clear_after {
        store
            .items
            .retain(|i| !i.secret || i.pinned || now.saturating_sub(i.ts) < window);
    }
    if let Some(limit) = limit {
        let mut kept = 0;
        store.items.retain(|i| {
            if i.pinned {
                return true;
            }
            kept += 1;
            kept <= limit
        });
    }
}

fn watch_clipboard(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(POLL);
        let state = app.state::<AppState>();
        if state.store.lock().unwrap().settings.paused {
            continue;
        }
        if now_ms() < *state.suppress_until.lock().unwrap() {
            continue;
        }

        let text = app.clipboard().read_text().ok().filter(|t| !t.trim().is_empty());
        let captured = match text {
            Some(text) => capture_text(&app, &state, text),
            None => capture_image(&app, &state),
        };

        let mut changed = captured;
        {
            let mut store = state.store.lock().unwrap();
            let before = store.items.len();
            prune(&mut store);
            changed |= store.items.len() != before;
        }
        if changed {
            publish(&app);
        }
    });
}

fn capture_text(app: &AppHandle, state: &State<AppState>, text: String) -> bool {
    let h = hash(&text);
    {
        let mut seen = state.seen.lock().unwrap();
        if *seen == h {
            return false;
        }
        *seen = h;
    }

    let source = frontmost_app();
    let mut store = state.store.lock().unwrap();
    if store.settings.ignore_password_managers
        && PASSWORD_MANAGERS.iter().any(|p| source.contains(p))
    {
        return false;
    }
    if store.items.first().is_some_and(|i| i.hash == h) {
        return false;
    }
    store.next_id += 1;
    let item = text_item(store.next_id, &text, source);
    store.items.insert(0, item);
    drop(store);
    let _ = app; // keep signature symmetrical with capture_image
    true
}

fn capture_image(app: &AppHandle, state: &State<AppState>) -> bool {
    let Ok(img) = app.clipboard().read_image() else {
        return false;
    };
    let (w, h) = (img.width(), img.height());
    if w == 0 || h == 0 {
        return false;
    }
    let rgba = img.rgba().to_vec();
    let digest = hash(&rgba);
    {
        let mut seen = state.seen.lock().unwrap();
        if *seen == digest {
            return false;
        }
        *seen = digest;
    }

    let Some(buf) = image::RgbaImage::from_raw(w, h, rgba) else {
        return false;
    };
    let buf = if w > MAX_IMAGE_WIDTH {
        image::imageops::resize(
            &buf,
            MAX_IMAGE_WIDTH,
            h * MAX_IMAGE_WIDTH / w,
            image::imageops::FilterType::Triangle,
        )
    } else {
        buf
    };

    let source = frontmost_app();
    let mut store = state.store.lock().unwrap();
    if store.items.first().is_some_and(|i| i.hash == digest) {
        return false;
    }
    store.next_id += 1;
    let id = store.next_id;
    let dir = state.dir.join("images");
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(format!("{id}.png"));
    if buf.save(&path).is_err() {
        return false;
    }
    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    store.items.insert(
        0,
        Item {
            id,
            kind: "image".into(),
            title: format!("Image {}", id),
            body: None,
            url: None,
            value: None,
            path: Some(path.to_string_lossy().to_string()),
            dims: Some(format!("{w} × {h}")),
            size: Some(human_size(size)),
            lang: None,
            bytes: size,
            hash: digest,
            app: source,
            ts: now_ms(),
            pinned: false,
            fav: false,
            secret: false,
        },
    );
    true
}

/* ------------------------------------------------------------------ *
 * commands
 * ------------------------------------------------------------------ */

#[tauri::command]
fn snapshot(state: State<AppState>) -> Store {
    state.store.lock().unwrap().clone()
}

/// Put an item back on the clipboard. Returns the text so the UI can toast it.
#[tauri::command]
fn copy_item(app: AppHandle, state: State<AppState>, id: u64) -> Option<String> {
    let (payload, title) = {
        let store = state.store.lock().unwrap();
        let item = store.items.iter().find(|i| i.id == id)?;

        // Images go back as pixels, not as the path we happen to store them at.
        if item.kind == "image" {
            if let Some(path) = item.path.clone() {
                let title = item.title.clone();
                drop(store);
                if write_clipboard_image(&app, &state, &path) {
                    return Some(title);
                }
                return None;
            }
        }

        let payload = item
            .body
            .clone()
            .or_else(|| item.url.clone())
            .or_else(|| item.value.clone())
            .or_else(|| item.path.clone())
            .unwrap_or_else(|| item.title.clone());
        (payload, item.title.clone())
    };
    write_clipboard(&app, &state, &payload);
    Some(title)
}

#[tauri::command]
fn copy_text(app: AppHandle, state: State<AppState>, text: String) {
    write_clipboard(&app, &state, &text);
}

/// Put a stored PNG back on the clipboard as an image.
fn write_clipboard_image(app: &AppHandle, state: &State<AppState>, path: &str) -> bool {
    let Ok(decoded) = image::open(path) else {
        return false;
    };
    let rgba = decoded.to_rgba8();
    let (width, height) = rgba.dimensions();
    let bytes = rgba.into_raw();
    // Same hash shape the watcher computes, so we don't re-capture our own write.
    *state.seen.lock().unwrap() = hash(&bytes);
    app.clipboard()
        .write_image(&tauri::image::Image::new_owned(bytes, width, height))
        .is_ok()
}

/// Put files themselves on the clipboard, so pasting attaches them.
#[tauri::command]
fn copy_files(state: State<AppState>, paths: Vec<String>) -> bool {
    if paths.is_empty() {
        return false;
    }
    // A control character (\r, \t, NUL...) would terminate the AppleScript string
    // literal and let a crafted filename inject script. Quote-escaping alone
    // doesn't cover it, so refuse those paths outright.
    if paths
        .iter()
        .any(|p| p.is_empty() || p.chars().any(char::is_control))
    {
        return false;
    }
    *state.suppress_until.lock().unwrap() = now_ms() + 2500;

    // ponytail: AppleScript is the only no-dependency way to put a file list on
    // the pasteboard; the clipboard plugin only speaks text and images.
    #[cfg(target_os = "macos")]
    {
        let list = paths
            .iter()
            .map(|p| format!("POSIX file \"{}\"", p.replace('\\', "\\\\").replace('"', "\\\"")))
            .collect::<Vec<_>>()
            .join(", ");
        return std::process::Command::new("osascript")
            .args(["-e", &format!("set the clipboard to {{{list}}}")])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
    }
    #[cfg(not(target_os = "macos"))]
    false
}

/// Write to the clipboard without capturing what we just wrote.
fn write_clipboard(app: &AppHandle, state: &State<AppState>, text: &str) {
    *state.seen.lock().unwrap() = hash(&text.to_string());
    let _ = app.clipboard().write_text(text.to_string());
}

#[tauri::command]
fn toggle_pin(app: AppHandle, state: State<AppState>, id: u64) {
    if let Some(item) = state
        .store
        .lock()
        .unwrap()
        .items
        .iter_mut()
        .find(|i| i.id == id)
    {
        item.pinned = !item.pinned;
    }
    publish(&app);
}

#[tauri::command]
fn toggle_fav(app: AppHandle, state: State<AppState>, id: u64) {
    if let Some(item) = state
        .store
        .lock()
        .unwrap()
        .items
        .iter_mut()
        .find(|i| i.id == id)
    {
        item.fav = !item.fav;
    }
    publish(&app);
}

#[tauri::command]
fn remove_item(app: AppHandle, state: State<AppState>, id: u64) {
    {
        let mut store = state.store.lock().unwrap();
        if let Some(item) = store.items.iter().find(|i| i.id == id) {
            if let (Some(path), "image") = (item.path.clone(), item.kind.as_str()) {
                let _ = std::fs::remove_file(path);
            }
        }
        store.items.retain(|i| i.id != id);
    }
    publish(&app);
}

#[tauri::command]
fn clear_history(app: AppHandle, state: State<AppState>) {
    {
        let mut store = state.store.lock().unwrap();
        let _ = std::fs::remove_dir_all(state.dir.join("images"));
        store.items.retain(|i| i.pinned);
    }
    publish(&app);
}

#[tauri::command]
fn set_settings(app: AppHandle, state: State<AppState>, settings: Settings) {
    let autostart = settings.launch_at_login;
    {
        let mut store = state.store.lock().unwrap();
        store.settings = settings;
        prune(&mut store);
    }
    let manager = app.autolaunch();
    let _ = if autostart {
        manager.enable()
    } else {
        manager.disable()
    };
    publish(&app);
}

#[tauri::command]
fn add_snippet(app: AppHandle, state: State<AppState>, name: String, trigger: String, body: String) {
    {
        let mut store = state.store.lock().unwrap();
        store.next_id += 1;
        let id = store.next_id;
        store.snippets.push(Snippet {
            id,
            trigger,
            name,
            body,
            uses: 0,
        });
    }
    publish(&app);
}

#[tauri::command]
fn use_snippet(app: AppHandle, state: State<AppState>, id: u64) -> Option<String> {
    let body = {
        let mut store = state.store.lock().unwrap();
        let snippet = store.snippets.iter_mut().find(|s| s.id == id)?;
        snippet.uses += 1;
        snippet.body.clone()
    };
    write_clipboard(&app, &state, &body);
    publish(&app);
    Some(body)
}

#[tauri::command]
fn remove_snippet(app: AppHandle, state: State<AppState>, id: u64) {
    state.store.lock().unwrap().snippets.retain(|s| s.id != id);
    publish(&app);
}

#[tauri::command]
fn show_main(app: AppHandle, section: Option<String>) {
    // Closing the window only hides it, which on macOS can leave the whole app
    // hidden — un-hide it first or show()/set_focus() land on nothing.
    #[cfg(target_os = "macos")]
    let _ = app.show();

    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        if let Some(section) = section {
            let _ = app.emit_to("main", "goto", section);
        }
    }
    hide("quick", &app);
    hide("menu", &app);
}

#[tauri::command]
fn show_quick(app: AppHandle) {
    hide("menu", &app);
    toggle_quick(&app);
}

/// Open a link in the browser, or reveal a file in the OS file manager.
#[tauri::command]
fn open_path(path: String) {
    // ponytail: two-line shell-out beats pulling in the opener plugin for one button.
    #[cfg(target_os = "macos")]
    let (cmd, args): (&str, Vec<&str>) = if path.starts_with("http") {
        ("open", vec![&path])
    } else {
        ("open", vec!["-R", &path])
    };
    #[cfg(target_os = "linux")]
    let (cmd, args): (&str, Vec<&str>) = ("xdg-open", vec![&path]);
    #[cfg(target_os = "windows")]
    let (cmd, args): (&str, Vec<&str>) = ("explorer", vec![&path]);

    let _ = std::process::Command::new(cmd).args(args).spawn();
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

fn hide(label: &str, app: &AppHandle) {
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.hide();
    }
}

/* ------------------------------------------------------------------ *
 * windows
 * ------------------------------------------------------------------ */

fn toggle_quick(app: &AppHandle) {
    let Some(win) = app.get_webview_window("quick") else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
        return;
    }
    let _ = win.center();
    let _ = win.show();
    let _ = win.set_focus();
    let _ = app.emit_to("quick", "quick:open", ());
}

fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Memory", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Memory", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit_item])?;

    // A stroke-only glyph so macOS can render it as a template (menu-bar) icon.
    let tray_icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?;

    TrayIconBuilder::with_id("tray")
        .icon(tray_icon)
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app.clone(), None),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            else {
                return;
            };
            let app = tray.app_handle();
            let Some(win) = app.get_webview_window("menu") else {
                return;
            };
            if win.is_visible().unwrap_or(false) {
                let _ = win.hide();
                return;
            }
            // Anchor the panel under the tray icon.
            let scale = win.scale_factor().unwrap_or(1.0);
            let icon = rect.position.to_logical::<f64>(scale);
            let size = rect.size.to_logical::<f64>(scale);
            let width = win.outer_size().map(|s| s.to_logical::<f64>(scale).width).unwrap_or(340.0);
            let _ = win.set_position(LogicalPosition::new(
                icon.x + size.width / 2.0 - width / 2.0,
                icon.y + size.height,
            ));
            let _ = win.show();
            let _ = win.set_focus();
        })
        .build(app)?;
    Ok(())
}

fn main() {
    let shortcut = Shortcut::new(
        Some(if cfg!(target_os = "macos") {
            Modifiers::SUPER | Modifiers::SHIFT
        } else {
            Modifiers::CONTROL | Modifiers::SHIFT
        }),
        Code::KeyV,
    );

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_quick(app);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            snapshot,
            copy_item,
            copy_text,
            copy_files,
            toggle_pin,
            toggle_fav,
            remove_item,
            clear_history,
            set_settings,
            add_snippet,
            use_snippet,
            remove_snippet,
            show_main,
            show_quick,
            open_path,
            quit,
        ])
        .on_window_event(|window, event| match event {
            // The panels are transient: losing focus dismisses them.
            WindowEvent::Focused(false) if window.label() != "main" => {
                let _ = window.hide();
            }
            // Closing the main window leaves the app running in the tray.
            WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .setup(move |app| {
            let handle = app.handle().clone();
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let store = load(&dir);
            app.manage(AppState {
                dir,
                store: Mutex::new(store),
                seen: Mutex::new(0),
                suppress_until: Mutex::new(0),
            });

            app.global_shortcut().register(shortcut)?;
            setup_tray(&handle)?;
            watch_clipboard(handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Memory")
        .run(|_app, _event| {
            // Clicking the Dock icon after the window was closed reopens it.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                show_main(_app.clone(), None);
            }
        });
}
