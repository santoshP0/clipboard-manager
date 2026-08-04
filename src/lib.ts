import type { CSSProperties } from 'react'

/* ------------------------------------------------------------------ *
 * style helper
 * ------------------------------------------------------------------ */

// ponytail: the design ships its inline styles as raw CSS strings. Parse them
// once each (cached) instead of hand-porting ~200 declarations to camelCase.
const styleCache = new Map<string, CSSProperties>()
export function s(text: string): CSSProperties {
  let out = styleCache.get(text)
  if (!out) {
    const obj: Record<string, string> = {}
    for (const decl of text.split(';')) {
      const i = decl.indexOf(':')
      if (i < 0) continue
      const prop = decl.slice(0, i).trim()
      const value = decl.slice(i + 1).trim()
      if (!prop || !value) continue
      const key = prop.startsWith('--')
        ? prop
        : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      obj[key] = value
    }
    out = obj as CSSProperties
    styleCache.set(text, out)
  }
  return out
}

/** #rrggbb + alpha → rgba(), for deriving the accent tints. */
export function hexA(hex: string, alpha: number): string {
  let h = (hex || '#0a84ff').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

/* ------------------------------------------------------------------ *
 * model — mirrors src-tauri/src/main.rs
 * ------------------------------------------------------------------ */

export type Kind = 'code' | 'link' | 'color' | 'text' | 'image' | 'file'

export type Item = {
  id: number
  kind: Kind
  title: string
  body?: string | null
  url?: string | null
  value?: string | null
  path?: string | null
  thumb?: string | null
  dims?: string | null
  size?: string | null
  lang?: string | null
  bytes: number
  app: string
  ts: number
  pinned: boolean
  fav: boolean
  secret: boolean
}

export type Snippet = { id: number; trigger: string; name: string; body: string; uses: number }

export type Settings = {
  theme: 'system' | 'light' | 'dark'
  accent: string
  density: 'Comfortable' | 'Compact'
  showCounts: boolean
  launchAtLogin: boolean
  ignorePasswordManagers: boolean
  autoClear: string
  historyLimit: string
  paused: boolean
}

export type Store = {
  items: Item[]
  snippets: Snippet[]
  settings: Settings
  nextId: number
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: '#0a84ff',
  density: 'Comfortable',
  showCounts: true,
  launchAtLogin: false,
  ignorePasswordManagers: true,
  autoClear: '1 hour',
  historyLimit: 'Unlimited',
  paused: false,
}

export const ACCENTS = ['#0a84ff', '#bf5af2', '#ff375f', '#30d158', '#8e8e93']
export const ACCENT_NAMES: Record<string, string> = {
  '#0a84ff': 'Blue',
  '#bf5af2': 'Purple',
  '#ff375f': 'Pink',
  '#30d158': 'Green',
  '#8e8e93': 'Graphite',
}
export const HISTORY_LIMITS = ['Unlimited', '1000', '500', '200']
export const AUTO_CLEAR = ['Never', '1 hour', '1 day']

/* ------------------------------------------------------------------ *
 * item helpers
 * ------------------------------------------------------------------ */

const ICON_PATH: Record<string, string> = {
  code: 'M8 8l-4 4 4 4M16 8l4 4-4 4',
  link: 'M10 13a4 4 0 0 0 5.7 0l2-2A4 4 0 0 0 12 5.3l-1 1M14 11a4 4 0 0 0-5.7 0l-2 2A4 4 0 0 0 12 18.7l1-1',
  text: 'M5 7h14M5 12h14M5 17h9',
  image: 'M4 5h16v14H4zM4 15l4-4 3 3 4-4 5 5',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  color: 'M12 3a9 9 0 1 0 0 18 3 3 0 0 0 0-6 3 3 0 0 1 0-6z',
}
export const iconPath = (k: string) => ICON_PATH[k] ?? ICON_PATH.text

const TINT: Record<string, string> = {
  code: 'rgba(191,90,242,.14)', link: 'var(--sel)', text: 'rgba(110,110,115,.14)',
  image: 'rgba(48,209,88,.14)', file: 'rgba(255,159,10,.14)', color: 'var(--surface-3)',
}
export const tint = (k: string) => TINT[k] ?? 'var(--surface-3)'

const TINT_COLOR: Record<string, string> = {
  code: 'var(--purple)', link: 'var(--accent)', text: 'var(--text-2)',
  image: 'var(--green)', file: 'var(--orange)', color: 'var(--text-2)',
}
export const tintColor = (k: string) => TINT_COLOR[k] ?? 'var(--text-2)'

const TYPE_LABEL: Record<string, string> = {
  code: 'Code', link: 'Link', text: 'Text', image: 'Image', file: 'File', color: 'Color',
}
export const typeLabel = (k: string) => TYPE_LABEL[k] ?? k

/** Subsequence ("fuzzy") match — every char of q appears in str, in order. */
export function fz(q: string, str: string): boolean {
  const needle = (q || '').toLowerCase().trim()
  if (!needle) return true
  const haystack = (str || '').toLowerCase()
  let i = 0
  for (const c of haystack) {
    if (c === needle[i]) i++
    if (i >= needle.length) return true
  }
  return false
}

export const hay = (it: Item) =>
  [it.title, it.kind, it.app, it.body, it.url, it.value, it.path].filter(Boolean).join(' ')

/* --- time --- */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function relTime(ts: number, now = Date.now()): string {
  const d = Math.max(0, now - ts)
  if (d < MINUTE) return 'now'
  if (d < HOUR) return Math.floor(d / MINUTE) + 'm'
  if (d < DAY) return Math.floor(d / HOUR) + 'h'
  if (d < 2 * DAY) return 'Yesterday'
  return Math.floor(d / DAY) + 'd'
}

export function exactTime(ts: number, now = Date.now()): string {
  const date = new Date(ts)
  if (now - ts < DAY) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/** Today / Yesterday / Earlier — the timeline's grouping. */
export function dayBucket(ts: number, now = Date.now()): string {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  if (ts >= startOfToday) return 'Today'
  if (ts >= startOfToday - DAY) return 'Yesterday'
  return 'Earlier'
}

/* --- presentation --- */

export function sub(it: Item): string {
  if (it.kind === 'code') return (it.body || '').split('\n')[0]
  if (it.kind === 'link') return it.url || ''
  if (it.kind === 'color') return (it.value || '') + ' · ' + it.app
  if (it.kind === 'image') return [it.dims, it.size].filter(Boolean).join(' · ')
  if (it.kind === 'file') return [it.size, it.path].filter(Boolean).join(' · ')
  return (it.body || '').replace(/\s+/g, ' ').trim()
}

export const subFont = (it: Item) =>
  it.kind === 'code' || it.kind === 'link' ? 'ui-monospace,SF Mono,monospace' : 'inherit'

export function metaFor(it?: Item): { label: string; value: string } {
  if (!it) return { label: 'Size', value: '—' }
  if (it.kind === 'code')
    return { label: 'Language', value: (it.lang || 'txt').toUpperCase() + ' · ' + (it.body || '').length + ' chars' }
  if (it.kind === 'color') return { label: 'Format', value: 'HEX · sRGB' }
  if (it.kind === 'image') return { label: 'Dimensions', value: it.dims || '—' }
  if (it.kind === 'file') return { label: 'Size', value: it.size || '—' }
  if (it.kind === 'link')
    return { label: 'Domain', value: (it.url || '').replace(/^https?:\/\//, '').split('/')[0] }
  return { label: 'Length', value: (it.body || '').length + ' chars' }
}

export function humanSize(bytes: number): string {
  if (bytes >= 1 << 20) return (bytes / (1 << 20)).toFixed(1) + ' MB'
  if (bytes >= 1 << 10) return Math.round(bytes / (1 << 10)) + ' KB'
  return bytes + ' B'
}

/* --- filtering --- */

const SEG_KIND: Record<string, Kind> = { Images: 'image', Code: 'code', Files: 'file', Links: 'link' }

/** Pinned items ride at the top of every list; the rest stay newest-first. */
const pinnedFirst = (items: Item[]): Item[] =>
  [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.ts - a.ts)

export function segFilter(items: Item[], seg: string): Item[] {
  if (seg === 'Recent' || seg === 'Collections') return pinnedFirst(items)
  if (seg === 'Pinned') return pinnedFirst(items.filter((x) => x.pinned))
  return pinnedFirst(items.filter((x) => x.kind === SEG_KIND[seg]))
}

export function sectionFilter(items: Item[], section: string): Item[] {
  if (section === 'Favorites') return pinnedFirst(items.filter((x) => x.fav))
  const kind = SEG_KIND[section]
  return pinnedFirst(kind ? items.filter((x) => x.kind === kind) : items)
}

/* ------------------------------------------------------------------ *
 * shared icon paths + style fragments (used by several components)
 * ------------------------------------------------------------------ */

export const PIN_PATH = 'M9 4h6l-1 6 3 3v2h-4v5l-1 2-1-2v-5H6v-2l3-3z'
export const HEART_PATH =
  'M12 21l-1.5-1.4C5 14.6 2 11.9 2 8.5 2 6 4 4 6.5 4 8 4 9.4 4.7 12 7c2.6-2.3 4-3 5.5-3C20 4 22 6 22 8.5c0 3.4-3 6.1-8.5 11.1z'
export const SEL_BAR = 'position:absolute;left:0;width:3px;border-radius:3px;background:var(--accent)'
export const KEY_STYLE =
  'font-family:ui-monospace,monospace;font-size:11px;font-weight:600;padding:2px 6px;background:var(--surface);border:.5px solid var(--line);border-radius:5px;box-shadow:0 1px 0 var(--line)'
