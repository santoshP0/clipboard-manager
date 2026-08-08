import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { DEFAULT_SETTINGS, type Item, type Settings, type Store } from './lib'

export const win = getCurrentWindow()
export const label = win.label
export const isMac = navigator.userAgent.includes('Mac')

const EMPTY: Store = { items: [], snippets: [], collections: [], settings: DEFAULT_SETTINGS, nextId: 0 }

export type Loaded = { store: Store; state: 'loading' | 'ready' | 'error' }

/** The whole store, kept in sync by the `store` event the backend emits. */
export function useStore(): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ store: EMPTY, state: 'loading' })

  useEffect(() => {
    invoke<Store>('snapshot')
      .then((store) => setLoaded({ store, state: 'ready' }))
      .catch(() => setLoaded({ store: EMPTY, state: 'error' }))
    const un = listen<Store>('store', (e) => setLoaded({ store: e.payload, state: 'ready' }))
    return () => {
      un.then((off) => off())
    }
  }, [])

  return loaded
}

/** Fires when the global hotkey re-opens Quick Access, so it can reset itself. */
export function useQuickOpen(onOpen: () => void) {
  useEffect(() => {
    const un = listen('quick:open', onOpen)
    return () => {
      un.then((off) => off())
    }
  }, [onOpen])
}

export type Toast = { msg: string; action?: { label: string; run: () => void }; ms?: number }

/** Transient confirmation message, cleared after a moment. */
export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // An offer to undo has to outlive a plain "copied" nudge, so callers can
  // pass their own duration.
  const fire = useCallback((msg: string, extra?: Omit<Toast, 'msg'>) => {
    setToast({ msg, ...extra })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), extra?.ms ?? 1700)
  }, [])
  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { toast, fire, dismiss }
}

/** The `fire` handed down to panels. */
export type Fire = (msg: string, extra?: Omit<Toast, 'msg'>) => void

export const copyItem = (id: number) => invoke<string | null>('copy_item', { id })
export const copyText = (text: string) => invoke('copy_text', { text })
export const copyFiles = (paths: string[]) => invoke<boolean>('copy_files', { paths })
export const togglePin = (id: number) => invoke('toggle_pin', { id })
export const toggleFav = (id: number) => invoke('toggle_fav', { id })
export const removeItem = (id: number) => invoke<boolean>('remove_item', { id })
export const removeItems = (ids: number[]) => invoke<number>('remove_items', { ids })
/** Restore the last deleted batch. Returns how many came back. */
export const undoDelete = () => invoke<number>('undo_delete')
export const clearHistory = () => invoke('clear_history')
export const addCollection = (name: string) => invoke<number>('add_collection', { name })
export const lockCollection = (id: number) => invoke('lock_collection', { id })
export const removeCollection = (id: number) => invoke<boolean>('remove_collection', { id })
export const moveItems = (ids: number[], coll: number | null) =>
  invoke<number>('move_items', { ids, coll })
export const saveSettings = (settings: Settings) => invoke('set_settings', { settings })
export const addSnippet = (name: string, trigger: string, body: string) =>
  invoke('add_snippet', { name, trigger, body })
export const runSnippet = (id: number) => invoke<string | null>('use_snippet', { id })
export const removeSnippet = (id: number) => invoke('remove_snippet', { id })
/** Reports whether the OS trusts us to observe typing. Never prompts. */
export const accessibility = () => invoke<boolean>('accessibility')
/** Show Stash.app in Finder, to drag into the Accessibility list. */
export const revealSelf = () => invoke('reveal_self')
/** macOS 26 renamed the Privacy pane; the old id no longer resolves. */
export const openAccessibilityPane = () =>
  openPath('x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_Accessibility')
export const showMain = (section?: string) => invoke('show_main', { section })
export const showQuick = () => invoke('show_quick')
export const openPath = (path: string) => invoke('open_path', { path })
export const quitApp = () => invoke('quit')

/** Main window listens for "open this section" requests from the tray menu. */
export function useGoto(onGoto: (section: string) => void) {
  useEffect(() => {
    const un = listen<string>('goto', (e) => onGoto(e.payload))
    return () => {
      un.then((off) => off())
    }
  }, [onGoto])
}

export const hideSelf = () => win.hide()

/** Image items live on disk; the asset protocol makes them loadable. */
export const thumbUrl = (it: Item) => {
  // Finder-copied images keep `path` on the original file, which the asset
  // protocol can't read; `thumb` is the preview we wrote into app data.
  const src = it.thumb ?? it.path
  return src ? `url("${convertFileSrc(src)}")` : undefined
}

/** Shrink-wrap the window around its panel, so macOS can draw the real shadow. */
export function useFitWindow(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let applied = ''
    const fit = () => {
      const width = Math.ceil(el.offsetWidth)
      const height = Math.ceil(el.offsetHeight)
      if (!width || !height) return
      const next = `${width}x${height}`
      if (next === applied) return
      applied = next
      void win.setSize(new LogicalSize(width, height))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
}
