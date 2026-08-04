import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { DEFAULT_SETTINGS, type Item, type Settings, type Store } from './lib'

export const win = getCurrentWindow()
export const label = win.label
export const isMac = navigator.userAgent.includes('Mac')

const EMPTY: Store = { items: [], snippets: [], settings: DEFAULT_SETTINGS, nextId: 0 }

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

/** Transient confirmation message, cleared after a moment. */
export function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fire = useCallback((msg: string) => {
    setToast(msg)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 1700)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return { toast, fire }
}

export const copyItem = (id: number) => invoke<string | null>('copy_item', { id })
export const copyText = (text: string) => invoke('copy_text', { text })
export const copyFiles = (paths: string[]) => invoke<boolean>('copy_files', { paths })
export const togglePin = (id: number) => invoke('toggle_pin', { id })
export const toggleFav = (id: number) => invoke('toggle_fav', { id })
export const removeItem = (id: number) => invoke('remove_item', { id })
export const clearHistory = () => invoke('clear_history')
export const saveSettings = (settings: Settings) => invoke('set_settings', { settings })
export const addSnippet = (name: string, trigger: string, body: string) =>
  invoke('add_snippet', { name, trigger, body })
export const runSnippet = (id: number) => invoke<string | null>('use_snippet', { id })
export const removeSnippet = (id: number) => invoke('remove_snippet', { id })
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
export const thumbUrl = (it: Item) => (it.path ? `url("${convertFileSrc(it.path)}")` : undefined)

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
