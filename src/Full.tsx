import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import {
  addSnippet, copyItem, isMac, openPath, removeItem, removeSnippet, saveSettings, thumbUrl,
  copyFiles, copyText, toggleFav, togglePin, runSnippet, useGoto, addCollection, lockCollection,
  removeCollection, moveItems, accessibility, revealSelf, openAccessibilityPane, type Loaded,
} from './api'
import {
  ACCENTS, ACCENT_NAMES, AUTO_CLEAR, HEART_PATH, HISTORY_LIMITS, MENU_VIEWS, PIN_PATH, SEL_BAR, dayBucket,
  exactTime, frozen, fz, hay, humanSize, metaFor, relTime, s, sectionFilter, sub, subFont,
  tintColor, typeLabel, type Collection, type Item, type Settings,
} from './lib'
import {
  EmptyClipboard, IconBox, LoadingRows, NoMatches, Preview, SearchIcon, Segmented, StackPreview,
  SwatchPicker, Toggle, Picker,
} from './ui'
import { dissolveElement } from './dissolve'
import FlameWrap from './flame-wrap'

const NAV_GROUPS: { label: string; items: [string, string][] }[] = [
  {
    label: 'Library',
    items: [
      ['History', 'M12 8v4l3 2M4 12a8 8 0 1 0 3-6L4 8m0-4v4h4'],
      ['Timeline', 'M4 6h16M4 12h16M4 18h10'],
      ['Favorites', 'M12 4l2.5 5 5.5.8-4 3.9 1 5.5L12 16.6 7 19.2l1-5.5-4-3.9L9.5 9z'],
      ['Collections', 'M3 5h7v6H3zM14 5h7v6h-7zM3 13h7v6H3zM14 13h7v6h-7z'],
    ],
  },
  {
    label: 'Types',
    items: [
      ['Images', 'M4 5h16v14H4zM4 15l4-4 3 3 4-4 5 5'],
      ['Files', 'M7 3h7l5 5v13H7zM14 3v5h5'],
      ['Code', 'M8 8l-4 4 4 4M16 8l4 4-4 4'],
      ['Links', 'M10 13a4 4 0 0 0 5.7 0l2-2A4 4 0 0 0 12 5.3M14 11a4 4 0 0 0-5.7 0l-2 2A4 4 0 0 0 12 18.7'],
      ['Snippets', 'M6 4h9l4 4v12H6zM14 4v5h5M9 13h6M9 16h4'],
    ],
  },
  {
    label: 'System',
    items: [
      ['Statistics', 'M4 20V10M10 20V4M16 20v-7M22 20H2'],
      [
        'Settings',
        'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L16.5 2h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-.9-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5c.06-.33.1-.66.1-1z',
      ],
      ['About', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v5M12 8h.01'],
    ],
  },
]

const MODE: Record<string, string> = {
  History: 'list', Favorites: 'list', Code: 'list', Links: 'list', Files: 'list',
  Timeline: 'timeline', Images: 'grid', Collections: 'collections', Snippets: 'snippets',
  Statistics: 'stats', Settings: 'settings', About: 'about',
}

const SUBTITLE: Record<string, string> = {
  History: 'All captured items',
  Favorites: 'Starred for quick reach',
  Timeline: 'Grouped by when you copied',
  Images: 'Visual clipboard history',
  Files: 'Copied files & paths',
  Code: 'Snippets with syntax',
  Collections: 'Your groups — lock one to protect what is in it',
  Links: 'URLs you’ve copied',
  Snippets: 'Reusable expansions',
  Statistics: 'Your clipboard, quantified',
  Settings: 'Preferences & privacy',
  About: 'Free, yours, and staying that way',
}

const COUNTED = ['History', 'Favorites', 'Images', 'Files', 'Code', 'Links']
const TINTS = [
  ['rgba(10,132,255,.14)', 'var(--accent)'],
  ['rgba(191,90,242,.14)', 'var(--purple)'],
  ['rgba(255,69,58,.14)', 'var(--red)'],
  ['rgba(255,159,10,.14)', 'var(--orange)'],
  ['rgba(48,209,88,.14)', 'var(--green)'],
]
const DAY = 24 * 60 * 60 * 1000

/** "2 images, 1 text" — the Finder-style breakdown of a selection. */
function kindSummary(items: Item[]): string {
  const counts = new Map<string, number>()
  for (const it of items) counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => n + ' ' + typeLabel(kind).toLowerCase() + (n > 1 ? 's' : ''))
    .join(', ')
}

/** What an item puts on the clipboard as text. */
const payloadOf = (it: Item) => it.body || it.url || it.value || it.path || it.title
const hotkeyLabel = isMac ? '⌘⇧V' : 'Ctrl+Shift+V'

export default function Full({ loaded, fire }: { loaded: Loaded; fire: (msg: string) => void }) {
  const { store, state } = loaded
  const { settings } = store
  const [section, setSection] = useState('History')
  const [fq, setFq] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [anchor, setAnchor] = useState(0)
  const [collection, setCollection] = useState<number | null>(null)

  useGoto(useCallback((next: string) => setSection(next), []))

  const colls = store.collections ?? []
  const open = colls.find((c) => c.id === collection)
  const inCollection = section === 'Collections' && !!open
  const mode = inCollection ? 'list' : (MODE[section] ?? 'list')
  const base = inCollection
    ? sectionFilter(store.items.filter((x) => x.coll === open.id), 'History')
    : sectionFilter(store.items, section)
  const list = base.filter((x) => fz(fq, hay(x)))
  const sel = Math.min(anchor, Math.max(0, list.length - 1))
  const item = list[sel]
  const selected = new Set(selectedIds)
  const marked = list.filter((x) => selected.has(x.id))
  const multi = marked.length > 1
  // Nothing explicitly picked yet: the anchor row still reads as current.
  const isSelected = (row: Item, i: number) => selected.has(row.id) || (!marked.length && i === sel)

  const clearSel = () => {
    setSelectedIds([])
    setAnchor(0)
  }

  /** Explorer rules: plain replaces, cmd/ctrl toggles, shift extends. */
  const pick = (e: React.MouseEvent, row: Item, i: number) => {
    if (e.shiftKey && list.length) {
      const [from, to] = sel <= i ? [sel, i] : [i, sel]
      setSelectedIds(list.slice(from, to + 1).map((x) => x.id))
      return
    }
    if (isMac ? e.metaKey : e.ctrlKey) {
      setSelectedIds((prev) =>
        prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id],
      )
      setAnchor(i)
      return
    }
    setSelectedIds([row.id])
    setAnchor(i)
  }
  const meta = metaFor(item)
  const rowPad = settings.density === 'Compact' ? '7px 12px' : '11px 12px'
  const canOpen =
    !multi && !!item && (item.kind === 'link' || item.kind === 'file' || item.kind === 'image')

  const patch = (next: Partial<Settings>) => void saveSettings({ ...settings, ...next })

  const copy = useCallback(
    async (it: Item) => {
      await copyItem(it.id)
      fire('Copied “' + it.title + '” to clipboard')
    },
    [fire],
  )

  const targets = marked.length ? marked : item ? [item] : []

  const copyMany = async () => {
    if (targets.length === 1) return copy(targets[0])

    // All files/images: hand over the files themselves, not their paths as text.
    const files = targets.filter((t) => (t.kind === 'image' || t.kind === 'file') && t.path)
    const asFiles =
      files.length === targets.length &&
      (await copyFiles(files.map((f) => f.path as string)).catch(() => false))
    if (asFiles) {
      fire('Copied ' + files.length + ' files to clipboard')
      return
    }

    await copyText(targets.map(payloadOf).join('\n'))
    fire('Copied ' + targets.length + ' items to clipboard')
  }

  /** Locked collections freeze their contents — the backend refuses too. */
  const lockedTargets = targets.filter((t) => frozen(t, colls))
  const canDelete = targets.length > 0 && lockedTargets.length === 0
  // The collection every target shares — undefined when they disagree.
  const sharedColl = targets.every((t) => (t.coll ?? null) === (targets[0].coll ?? null))
    ? (targets[0]?.coll ?? null)
    : undefined

  const moveTo = async (coll: number | null) => {
    if (!targets.length) return
    const moved = await moveItems(targets.map((t) => t.id), coll)
    const where = coll === null ? 'History' : colls.find((c) => c.id === coll)?.name
    fire(moved ? `Moved ${moved} item${moved > 1 ? 's' : ''} to ${where}` : 'Collection is locked')
    clearSel()
  }

  const deleteMany = () => {
    if (!canDelete) {
      if (lockedTargets.length) fire('Locked collection — unlock it to delete')
      return
    }
    // Scatter the rows before the store drops them.
    for (const t of targets) {
      const row = document.querySelector<HTMLElement>(`[data-row="${t.id}"]`)
      if (row) dissolveElement(row, ['var(--text)', tintColor(t.kind), '#ffffff'])
    }
    targets.forEach((t) => void removeItem(t.id))
    fire(targets.length === 1 ? 'Deleted “' + targets[0].title + '”' : 'Deleted ' + targets.length + ' items')
    clearSel()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key === ',') {
        e.preventDefault()
        setSection('Settings')
      } else if (mod && e.key.toLowerCase() === 'a' && mode === 'list') {
        e.preventDefault()
        setSelectedIds(list.map((x) => x.id))
      } else if (mod && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault()
        deleteMany()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  return (
    <div style={s('height:100%;display:flex;flex-direction:column;background:var(--surface);overflow:hidden')}>
      <TitleBar section={section} />

      <div style={s('flex:1;display:flex;min-height:0')}>
        {/* sidebar */}
        <div className="mem-scroll" style={s('width:220px;flex:none;background:var(--glass-2);border-right:.5px solid var(--line);overflow-y:auto;padding:12px 10px')}>
          {NAV_GROUPS.map((g) => (
            <div key={g.label} style={{ marginBottom: 14 }}>
              <div style={s('font-size:10.5px;font-weight:660;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3);padding:4px 10px 6px')}>
                {g.label}
              </div>
              {g.items.map(([name, path]) => {
                const on = section === name
                const count =
                  name === 'Snippets'
                    ? store.snippets.length
                    : COUNTED.includes(name)
                      ? sectionFilter(store.items, name).length
                      : null
                return (
                  <div
                    key={name}
                    onClick={() => { setSection(name); clearSel(); setFq(''); setCollection(null) }}
                    className={'row' + (on ? ' sel' : '')}
                    style={s('display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:8px;cursor:pointer')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={on ? 'var(--accent)' : 'var(--text-3)'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d={path} />
                    </svg>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: on ? 600 : 500, color: on ? 'var(--text)' : 'var(--text-2)', letterSpacing: '-.006em' }}>
                      {name}
                    </span>
                    {settings.showCounts && count !== null && (
                      <span style={s('font-size:11px;font-weight:560;color:var(--text-3)')}>{count}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* content */}
        <div style={s('flex:1;display:flex;flex-direction:column;min-width:0;background:var(--surface)')}>
          <div style={s('height:52px;flex:none;display:flex;align-items:center;gap:12px;padding:0 18px;border-bottom:.5px solid var(--line)')}>
            {inCollection && (
              <button
                onClick={() => { setCollection(null); clearSel(); setFq('') }}
                title="Back to collections"
                style={s('flex:none;border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:560;color:var(--text-2);background:var(--surface-3);padding:5px 10px;border-radius:8px;display:flex;align-items:center;gap:6px')}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
                Collections
              </button>
            )}
            <div style={s('font-size:19px;font-weight:680;letter-spacing:-.02em;display:flex;align-items:center;gap:8px')}>
              {open ? open.name : section}
              {open?.locked && <LockIcon size={15} />}
            </div>
            <div style={s('font-size:12px;color:var(--text-3);font-weight:500;margin-top:2px')}>
              {open
                ? `${base.length} items${open.locked ? ' · locked' : ''}`
                : (SUBTITLE[section] ?? '')}
            </div>
            <div style={s('margin-left:auto;display:flex;align-items:center;gap:10px')}>
              {open && (
                <button
                  onClick={() => {
                    void lockCollection(open.id)
                    fire(open.locked ? `Unlocked “${open.name}”` : `Locked “${open.name}”`)
                  }}
                  style={{
                    ...s('border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:560;padding:6px 11px;border-radius:9px;display:flex;align-items:center;gap:6px'),
                    background: open.locked ? 'var(--sel)' : 'var(--surface-3)',
                    color: open.locked ? 'var(--accent)' : 'var(--text-2)',
                  }}
                >
                  <LockIcon size={13} open={!open.locked} />
                  {open.locked ? 'Locked' : 'Lock'}
                </button>
              )}
              <div style={s('display:flex;align-items:center;gap:8px;background:var(--surface-3);padding:6px 11px;border-radius:9px;width:200px')}>
                <SearchIcon size={14} />
                <input
                  value={fq}
                  onChange={(e) => { setFq(e.target.value); clearSel() }}
                  placeholder="Search"
                  spellCheck={false}
                  style={s('flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:12.5px;color:var(--text)')}
                />
              </div>
            </div>
          </div>

          <div style={s('flex:1;display:flex;min-height:0')}>
            <div className="mem-scroll" style={s('flex:1;overflow-y:auto;min-width:0')}>
              {state === 'loading' && mode !== 'settings' ? (
                <LoadingRows />
              ) : mode === 'list' ? (
                store.items.length === 0 ? (
                  <div style={{ height: '100%' }}>
                    <EmptyClipboard hotkey={hotkeyLabel} />
                  </div>
                ) : list.length === 0 ? (
                  <div style={{ height: '100%' }}>
                    <NoMatches seg={section} q={fq} />
                  </div>
                ) : (
                  <div style={s('padding:8px 10px')}>
                    {list.map((it, i) => (
                      <div
                        key={it.id}
                        data-row={it.id}
                        onClick={(e) => pick(e, it, i)}
                        onDoubleClick={() => void copy(it)}
                        className={'row' + (isSelected(it, i) ? ' sel' : '')}
                        style={{
                          ...s('display:flex;align-items:center;gap:13px;border-radius:10px;cursor:pointer;position:relative'),
                          padding: rowPad,
                        }}
                      >
                        {isSelected(it, i) && <div style={s(SEL_BAR + ';top:10px;bottom:10px')} />}
                        <IconBox it={it} size={38} radius={10} icon={18} />
                        <div style={s('flex:1;min-width:0')}>
                          <div style={s('display:flex;align-items:center;gap:8px')}>
                            <div style={s('font-size:14px;font-weight:560;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
                              {it.title}
                            </div>
                            {it.pinned && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--orange)">
                                <path d={PIN_PATH} />
                              </svg>
                            )}
                            {it.fav && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--pink)">
                                <path d={HEART_PATH} />
                              </svg>
                            )}
                          </div>
                          <div
                            style={{
                              ...s('font-size:12px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px'),
                              fontFamily: subFont(it),
                            }}
                          >
                            {sub(it)}
                          </div>
                        </div>
                        <div style={s('flex:none;text-align:right')}>
                          <div style={s('font-size:11.5px;color:var(--text-3);font-weight:500')}>{relTime(it.ts)}</div>
                          <div style={s('font-size:10.5px;color:var(--text-3);margin-top:2px')}>{it.app}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : mode === 'timeline' ? (
                <Timeline items={store.items} onCopy={copy} />
              ) : mode === 'grid' ? (
                <Grid items={store.items} onCopy={copy} />
              ) : mode === 'collections' ? (
                <Collections items={store.items} colls={colls} onOpen={setCollection} fire={fire} />
              ) : mode === 'snippets' ? (
                <Snippets loaded={loaded} fire={fire} />
              ) : mode === 'stats' ? (
                <Stats items={store.items} />
              ) : mode === 'about' ? (
                <About items={store.items} />
              ) : (
                <SettingsPane settings={settings} patch={patch} colls={colls} />
              )}
            </div>

            {/* inspector */}
            {mode === 'list' && list.length > 0 && (
              <div className="mem-scroll" style={s('width:300px;flex:none;border-left:.5px solid var(--line);background:var(--glass-2);overflow-y:auto;overflow-x:hidden;padding:20px;display:flex;flex-direction:column')}>
                <div style={s('display:flex;align-items:center;justify-content:space-between;margin-bottom:16px')}>
                  <div style={s('font-size:11px;font-weight:660;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3)')}>
                    {multi ? marked.length + ' selected' : 'Inspector'}
                  </div>
                  <div style={{ ...s('display:flex;gap:6px'), visibility: multi ? 'hidden' : 'visible' }}>
                    <IconButton
                      onClick={() => {
                        if (!item) return
                        void togglePin(item.id)
                        fire((item.pinned ? 'Unpinned “' : 'Pinned “') + item.title + '”')
                      }}
                      path={PIN_PATH}
                      active={!!item?.pinned}
                      color="var(--orange)"
                    />
                    <IconButton
                      onClick={() => {
                        if (!item) return
                        void toggleFav(item.id)
                        fire((item.fav ? 'Removed “' : 'Added “') + item.title + '”')
                      }}
                      path={HEART_PATH}
                      active={!!item?.fav}
                      color="var(--pink)"
                    />
                  </div>
                </div>

                {multi ? (
                  <>
                    <StackPreview items={marked} />
                    <div style={s('font-size:15px;font-weight:640;letter-spacing:-.01em;text-align:center')}>
                      {marked.length} items
                    </div>
                    <div style={s('font-size:12px;color:var(--text-3);text-align:center;margin-top:3px;margin-bottom:18px')}>
                      {kindSummary(marked)} · {humanSize(marked.reduce((sum, x) => sum + (x.bytes || 0), 0))}
                    </div>
                    <div style={s('font-size:11px;font-weight:640;letter-spacing:.03em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px')}>
                      Information
                    </div>
                    <div style={s('display:flex;flex-direction:column;gap:10px;margin-bottom:16px')}>
                      {[
                        ['Newest', exactTime(Math.max(...marked.map((x) => x.ts)))],
                        ['Oldest', exactTime(Math.min(...marked.map((x) => x.ts)))],
                        ['Sources', [...new Set(marked.map((x) => x.app))].join(', ')],
                      ].map(([k, v]) => (
                        <div key={k} style={s('display:flex;justify-content:space-between;gap:12px;font-size:12px')}>
                          <span style={{ color: 'var(--text-3)', flex: 'none' }}>{k}</span>
                          <span style={s('color:var(--text-2);font-weight:520;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>
                            {v}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={s('border-radius:12px;overflow:hidden;border:.5px solid var(--line);background:var(--surface);margin-bottom:16px')}>
                      <Preview it={item} />
                    </div>
                    <div style={s('font-size:14px;font-weight:620;letter-spacing:-.01em;line-height:1.35;margin-bottom:16px')}>
                      {item ? item.title : 'Nothing selected'}
                    </div>
                    <div style={s('display:flex;flex-direction:column;gap:10px;margin-bottom:16px')}>
                      {[
                        ['Type', item ? typeLabel(item.kind) : '—'],
                        ['Source', item ? item.app : '—'],
                        ['Copied', item ? exactTime(item.ts) : '—'],
                        [meta.label, meta.value],
                      ].map(([k, v]) => (
                        <div key={k} style={s('display:flex;justify-content:space-between;font-size:12px')}>
                          <span style={{ color: 'var(--text-3)' }}>{k}</span>
                          <span style={{ color: 'var(--text-2)', fontWeight: 520 }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {item?.secret && (
                  <>
                    <div style={s('font-size:11px;font-weight:640;letter-spacing:.03em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px')}>
                      Tags
                    </div>
                    <div style={s('display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px')}>
                      <span style={s('font-size:11px;font-weight:540;color:var(--red);background:rgba(255,69,58,.12);padding:4px 9px;border-radius:7px')}>
                        secret · auto-clears
                      </span>
                    </div>
                  </>
                )}

                {targets.length > 0 && (
                  <>
                    <div style={s('font-size:11px;font-weight:640;letter-spacing:.03em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px')}>
                      Collection
                    </div>
                    <CollectionPicker
                      colls={colls}
                      items={store.items}
                      current={sharedColl}
                      locked={lockedTargets.length > 0}
                      count={targets.length}
                      onMove={(coll) => void moveTo(coll)}
                      onCreate={async (name) => {
                        const id = await addCollection(name)
                        if (id) await moveTo(id)
                      }}
                    />
                    <div style={s('font-size:11px;color:var(--text-3);margin:8px 0 18px;line-height:1.4')}>
                      {lockedTargets.length
                        ? 'Locked — unlock the collection to move or delete.'
                        : 'Filed items survive auto-clear and the history limit.'}
                    </div>
                  </>
                )}

                {canOpen && (
                  <>
                    <div style={s('font-size:11px;font-weight:640;letter-spacing:.03em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px')}>
                      Actions
                    </div>
                    <div style={s('display:flex;flex-direction:column;gap:7px')}>
                      <ActionRow
                        label={item.kind === 'link' ? 'Open in browser' : 'Reveal in file manager'}
                        iconPath="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"
                        onClick={() => void openPath((item.url || item.path) as string)}
                      />
                    </div>
                  </>
                )}

                <button
                  onClick={() => void copyMany()}
                  style={s('width:100%;margin-top:18px;border:0;cursor:pointer;font:inherit;font-size:13px;font-weight:600;color:#fff;background:var(--accent);padding:11px;border-radius:10px;box-shadow:var(--shadow-sm)')}
                >
                  {multi ? 'Copy ' + marked.length + ' items' : 'Copy to clipboard'}
                </button>

                {/* Pinned to the bottom of the panel, far from the primary
                    action, so a mis-aimed click on Copy can't land on Delete. */}
                <div style={s('margin-top:auto;padding-top:26px')}>
                  <div style={s('height:.5px;background:var(--line);margin-bottom:16px')} />
                  {!canDelete ? (
                    <div style={s('display:flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:540;color:var(--text-3);padding:12px;border:.5px dashed var(--line);border-radius:9px')}>
                      <LockIcon size={13} />
                      Protected by a locked collection
                    </div>
                  ) : (
                  <FlameWrap
                    color={[1, 0.22, 0.06]}
                    intensity={0.55}
                    height={46}
                    spread={9}
                    radius={9}
                    speed={0.35}
                    melt={2}
                    sparks={1.2}
                    sparkSize={0.3}
                    smoke={0.5}
                    rim={2}
                    ember={0}
                    scorch={0}
                  >
                    <ActionRow
                      label={multi ? 'Delete ' + marked.length + ' items' : 'Delete from history'}
                      iconPath="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"
                      onClick={deleteMany}
                      danger
                    />
                  </FlameWrap>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * titlebar
 * ------------------------------------------------------------------ */

function TitleBar({ section }: { section: string }) {
  return (
    <div
      data-tauri-drag-region
      style={s('height:44px;flex:none;display:flex;align-items:center;padding:0 14px;background:var(--glass);backdrop-filter:blur(30px);border-bottom:.5px solid var(--line);position:relative')}
    >
      {/* Space for the native traffic lights, which sit over this bar. */}
      {isMac && <div style={{ width: 70, flex: 'none' }} />}
      <div
        data-tauri-drag-region
        style={s('position:absolute;left:50%;transform:translateX(-50%);font-size:13px;font-weight:600;letter-spacing:-.01em;color:var(--text)')}
      >
        {section}
      </div>
    </div>
  )
}

function IconButton({
  onClick, path, active, color,
}: {
  onClick: () => void; path: string; active: boolean; color: string
}) {
  return (
    <div className="mi" onClick={onClick} style={s('width:28px;height:28px;border-radius:8px;background:var(--surface-3);display:grid;place-items:center;cursor:pointer')}>
      <svg
        width="14" height="14" viewBox="0 0 24 24"
        fill={active ? color : 'none'}
        stroke={active ? color : 'var(--text-2)'}
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d={path} />
      </svg>
    </div>
  )
}

function ActionRow({
  label, iconPath, onClick, danger = false,
}: {
  label: string; iconPath: string; onClick: () => void; danger?: boolean
}) {
  const color = danger ? 'var(--red)' : 'var(--text)'
  return (
    <button
      className={danger ? 'ai danger' : 'ai'}
      onClick={onClick}
      style={{
        ...s('display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:9px 12px;border-radius:9px;border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:560;background:var(--surface-3)'),
        color,
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * panes
 * ------------------------------------------------------------------ */

function Timeline({ items, onCopy }: { items: Item[]; onCopy: (it: Item) => void }) {
  const groups = ['Today', 'Yesterday', 'Earlier']
    .map((label) => ({ label, items: items.filter((x) => dayBucket(x.ts) === label) }))
    .filter((g) => g.items.length)

  if (groups.length === 0) {
    return (
      <div style={{ height: 320 }}>
        <EmptyClipboard hotkey={hotkeyLabel} />
      </div>
    )
  }

  return (
    <div style={s('padding:14px 18px')}>
      {groups.map((grp) => (
        <div key={grp.label} style={{ marginBottom: 24 }}>
          <div style={s('display:flex;align-items:center;gap:12px;margin-bottom:12px;position:sticky;top:0;background:var(--surface);padding:4px 0;z-index:2')}>
            <div style={s('font-size:13px;font-weight:660;letter-spacing:-.01em')}>{grp.label}</div>
            <div style={s('flex:1;height:.5px;background:var(--line)')} />
            <div style={s('font-size:11px;color:var(--text-3);font-weight:500')}>{grp.items.length} items</div>
          </div>
          <div style={s('position:relative;padding-left:22px')}>
            <div style={s('position:absolute;left:5px;top:4px;bottom:4px;width:1.5px;background:var(--line)')} />
            {grp.items.map((it) => (
              <div key={it.id} style={s('position:relative;margin-bottom:10px')}>
                <div
                  style={{
                    ...s('position:absolute;left:-21px;top:14px;width:9px;height:9px;border-radius:50%;background:var(--surface)'),
                    border: '2px solid ' + tintColor(it.kind),
                  }}
                />
                <div
                  onClick={() => onCopy(it)}
                  className="row"
                  style={s('display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer;border:.5px solid var(--line)')}
                >
                  <IconBox it={it} size={30} radius={8} icon={15} border={false} />
                  <div style={s('flex:1;min-width:0')}>
                    <div style={s('font-size:13px;font-weight:540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
                      {it.title}
                    </div>
                    <div
                      style={{
                        ...s('font-size:11.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),
                        fontFamily: subFont(it),
                      }}
                    >
                      {sub(it)}
                    </div>
                  </div>
                  <div style={s('flex:none;font-size:11px;color:var(--text-3);font-weight:500')}>{exactTime(it.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Grid({ items, onCopy }: { items: Item[]; onCopy: (it: Item) => void }) {
  const visuals = items.filter((x) => x.kind === 'image' || x.kind === 'color')
  if (visuals.length === 0) {
    return (
      <div style={{ height: 320 }}>
        <EmptyClipboard hotkey={hotkeyLabel} />
      </div>
    )
  }
  return (
    <div style={s('padding:18px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px')}>
      {visuals.map((it) => (
        <div
          key={it.id}
          onClick={() => onCopy(it)}
          className="card"
          style={s('border:.5px solid var(--line);border-radius:12px;overflow:hidden;cursor:pointer;background:var(--surface)')}
        >
          <div
            style={{
              aspectRatio: '16/10',
              background: it.kind === 'color' ? (it.value ?? undefined) : undefined,
              backgroundImage: it.kind === 'color' ? undefined : thumbUrl(it),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          <div style={s('padding:10px 12px')}>
            <div style={s('font-size:12.5px;font-weight:540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
              {it.title}
            </div>
            <div style={s('font-size:11px;color:var(--text-3);margin-top:2px')}>
              {it.kind === 'color' ? 'Swatch · ' + it.value : [it.dims, it.size].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Colour a collection carries everywhere it appears. */
const collColor = (colls: Collection[], id: number) =>
  TINTS[Math.max(0, colls.findIndex((c) => c.id === id)) % TINTS.length][1]

/**
 * Move-to-collection menu. A native <select> can't carry item counts, lock
 * badges or a "new collection" row, so this is a real popover.
 */
function CollectionPicker({
  colls, items, current, locked, count, onMove, onCreate,
}: {
  colls: Collection[]
  items: Item[]
  /** Collection shared by every target — null when unfiled, undefined when mixed. */
  current: number | null | undefined
  locked: boolean
  count: number
  onMove: (coll: number | null) => void
  onCreate: (name: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    setDraft(null)
  }
  const choose = (id: number | null) => {
    close()
    onMove(id)
  }
  const create = async () => {
    const name = (draft ?? '').trim()
    close()
    if (name) await onCreate(name)
  }

  const here = current == null ? undefined : colls.find((c) => c.id === current)
  const label = locked
    ? here?.name
    : here
      ? here.name
      : current === undefined
        ? 'Mixed — pick one'
        : 'Move to collection…'

  const row = 'display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:540;width:100%;border:0;background:transparent;color:var(--text);font-family:inherit;text-align:left'

  return (
    <div ref={box} style={s('position:relative')}>
      <button
        disabled={locked}
        onClick={() => {
          // Drop upward when the panel bottom is closer than the menu is tall.
          const rect = box.current?.getBoundingClientRect()
          if (rect) setUp(window.innerHeight - rect.bottom < 280 && rect.top > 280)
          setOpen((v) => !v)
        }}
        style={{
          ...s('width:100%;display:flex;align-items:center;gap:9px;font:inherit;font-size:12.5px;font-weight:560;padding:9px 11px;border:.5px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);outline:0;text-align:left'),
          cursor: locked ? 'default' : 'pointer',
          opacity: locked ? 0.75 : 1,
          boxShadow: open ? '0 0 0 3px var(--sel)' : 'var(--shadow-sm)',
          borderColor: open ? 'var(--accent)' : 'var(--line)',
        }}
      >
        {locked ? (
          <span style={{ color: 'var(--accent)', display: 'flex' }}><LockIcon size={13} /></span>
        ) : here ? (
          <span style={{ ...s('width:8px;height:8px;border-radius:50%;flex:none'), background: collColor(colls, here.id) }} />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="M3 7h5l2 2h11v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        )}
        <span style={{ ...s('flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'), color: here || locked ? 'var(--text)' : 'var(--text-3)' }}>
          {label}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="mem-scroll"
          style={{
            ...s('position:absolute;left:0;right:0;z-index:60;max-height:264px;overflow-y:auto;padding:6px;background:var(--glass);border:.5px solid var(--line);border-radius:11px;box-shadow:var(--shadow);animation:popIn .14s cubic-bezier(.32,.72,0,1)'),
            [up ? 'bottom' : 'top']: 'calc(100% + 6px)',
            transformOrigin: up ? 'bottom center' : 'top center',
          }}
        >
          <div style={s('font-size:10px;font-weight:660;letter-spacing:.05em;text-transform:uppercase;color:var(--text-3);padding:6px 10px 5px')}>
            Move {count > 1 ? count + ' items' : 'item'} to
          </div>

          {colls.length === 0 && draft === null && (
            <div style={s('font-size:12px;color:var(--text-3);padding:6px 10px 10px;line-height:1.4')}>
              No collections yet — make the first one below.
            </div>
          )}

          {colls.map((c) => (
            <button key={c.id} className="mi" onClick={() => choose(c.id)} style={s(row)}>
              <span style={{ ...s('width:8px;height:8px;border-radius:50%;flex:none'), background: collColor(colls, c.id) }} />
              <span style={s('flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{c.name}</span>
              {c.locked && <span style={{ color: 'var(--text-3)', display: 'flex' }}><LockIcon size={11} /></span>}
              <span style={s('font-size:11px;color:var(--text-3);font-weight:500')}>
                {items.filter((x) => x.coll === c.id).length}
              </span>
              {here?.id === c.id && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7" />
                </svg>
              )}
            </button>
          ))}

          <div style={s('height:.5px;background:var(--line);margin:5px 4px')} />

          {here && (
            <button className="mi" onClick={() => choose(null)} style={s(row)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <path d="M9 12h6M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18" />
              </svg>
              <span style={{ color: 'var(--text-2)' }}>Remove from collection</span>
            </button>
          )}

          {draft === null ? (
            <button className="mi" onClick={() => setDraft('')} style={s(row)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }}>
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span style={{ color: 'var(--accent)' }}>New collection…</span>
            </button>
          ) : (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create()
                if (e.key === 'Escape') setDraft(null)
              }}
              placeholder="Name, then Enter"
              spellCheck={false}
              style={s('width:100%;margin:2px 0;border:.5px solid var(--accent);border-radius:8px;padding:8px 10px;font:inherit;font-size:12.5px;background:var(--surface);color:var(--text);outline:0')}
            />
          )}
        </div>
      )}
    </div>
  )
}

/** Padlock — shackle lifts off the body when `open`. */
function LockIcon({ size = 14, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d={open ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  )
}

/** Collections the user makes and files items into. Lock freezes the contents. */
function Collections({
  items, colls, onOpen, fire,
}: {
  items: Item[]
  colls: Collection[]
  onOpen: (id: number) => void
  fire: (msg: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const create = async () => {
    const name = (draft ?? '').trim()
    setDraft(null)
    if (!name) return
    await addCollection(name)
    fire(`Created “${name}”`)
  }

  return (
    <div style={s('padding:18px;display:grid;grid-template-columns:repeat(2,1fr);gap:14px')}>
      {colls.map((coll, i) => {
        const [bg, color] = TINTS[i % TINTS.length]
        const group = items.filter((x) => x.coll === coll.id)
        const chips = [...new Set(group.map((g) => tintColor(g.kind)))].slice(0, 3)
        return (
          <div key={coll.id} onClick={() => onOpen(coll.id)} className="tile" style={s('border:.5px solid var(--line);border-radius:14px;padding:18px;cursor:pointer;background:var(--surface)')}>
            <div style={s('display:flex;align-items:center;gap:11px;margin-bottom:14px')}>
              <div style={{ ...s('width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:14px;font-weight:700'), background: bg, color }}>
                {coll.name.slice(0, 1).toUpperCase()}
              </div>
              <div style={s('flex:1;min-width:0')}>
                <div style={s('font-size:14px;font-weight:620;letter-spacing:-.01em;display:flex;align-items:center;gap:6px')}>
                  <span style={s('overflow:hidden;text-overflow:ellipsis;white-space:nowrap')}>{coll.name}</span>
                  {coll.locked && <span style={{ color: 'var(--accent)', flex: 'none' }}><LockIcon size={12} /></span>}
                </div>
                <div style={s('font-size:11.5px;color:var(--text-3)')}>
                  {group.length} items{coll.locked ? ' · locked' : ''}
                </div>
              </div>
              <div style={s('display:flex;gap:4px;flex:none')} onClick={(e) => e.stopPropagation()}>
                <TileButton
                  title={coll.locked ? 'Unlock' : 'Lock'}
                  active={coll.locked}
                  onClick={() => {
                    void lockCollection(coll.id)
                    fire(coll.locked ? `Unlocked “${coll.name}”` : `Locked “${coll.name}”`)
                  }}
                >
                  <LockIcon size={13} open={!coll.locked} />
                </TileButton>
                {!coll.locked && (
                  <TileButton
                    title="Delete collection"
                    onClick={() => {
                      void removeCollection(coll.id)
                      fire(`Deleted “${coll.name}” · items kept`)
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13" />
                    </svg>
                  </TileButton>
                )}
              </div>
            </div>
            <div style={s('display:flex;gap:6px')}>
              {(chips.length ? chips : ['var(--surface-3)']).map((c) => (
                <div key={c} style={{ flex: 1, height: 6, borderRadius: 4, background: c }} />
              ))}
            </div>
          </div>
        )
      })}

      {draft === null ? (
        <div
          onClick={() => setDraft('')}
          className="tile"
          style={s('border:1px dashed var(--line);border-radius:14px;padding:18px;cursor:pointer;display:flex;align-items:center;gap:11px;color:var(--text-2);min-height:96px')}
        >
          <div style={s('width:34px;height:34px;border-radius:9px;background:var(--surface-3);display:grid;place-items:center;flex:none')}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div>
            <div style={s('font-size:14px;font-weight:620;letter-spacing:-.01em;color:var(--text)')}>New collection</div>
            <div style={s('font-size:11.5px;color:var(--text-3)')}>Group what matters</div>
          </div>
        </div>
      ) : (
        <div style={s('border:.5px solid var(--accent);border-radius:14px;padding:18px;background:var(--surface);min-height:96px;display:flex;flex-direction:column;justify-content:center;gap:10px')}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void create()
              if (e.key === 'Escape') setDraft(null)
            }}
            onBlur={() => void create()}
            placeholder="Collection name"
            spellCheck={false}
            style={s('border:.5px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit;font-size:13px;background:var(--surface-2);color:var(--text);outline:0;width:100%')}
          />
          <div style={s('font-size:11px;color:var(--text-3)')}>Enter to create · Esc to cancel</div>
        </div>
      )}
    </div>
  )
}

/** Small square button that rides in a tile's corner. */
function TileButton({
  title, onClick, active, children,
}: {
  title: string
  onClick: () => void
  active?: boolean
  children: ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="wbtn"
      style={{
        ...s('width:26px;height:26px;border:0;border-radius:7px;cursor:pointer;display:grid;place-items:center;background:transparent'),
        color: active ? 'var(--accent)' : 'var(--text-3)',
      }}
    >
      {children}
    </button>
  )
}

/**
 * Snippet fields hold exact text that gets typed back out verbatim, so every
 * macOS convenience — autocorrect, autocapitalise, autocomplete — is corruption.
 * `;sig` has to stay `;sig`.
 */
const literal = {
  spellCheck: false,
  autoCorrect: 'off',
  autoCapitalize: 'off',
  autoComplete: 'off',
} as const

function Snippets({ loaded, fire }: { loaded: Loaded; fire: (msg: string) => void }) {
  const { snippets, settings } = loaded.store
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', trigger: '', body: '' })
  const [trusted, setTrusted] = useState(true)

  useEffect(() => {
    let alive = true
    const check = () => void accessibility().then((ok) => alive && setTrusted(ok))
    check()
    // Permission is granted in System Settings, outside this window — re-check
    // until it lands, then the banner goes away on its own.
    const timer = setInterval(check, 2000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const field = s('border:.5px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit;font-size:12.5px;background:var(--surface);color:var(--text);outline:0;width:100%')

  const save = async () => {
    if (!form.body.trim()) return
    await addSnippet(form.name || 'Snippet', form.trigger || ';new', form.body)
    setForm({ name: '', trigger: '', body: '' })
    setAdding(false)
  }

  const live = settings.expandSnippets && trusted

  return (
    <div style={s('padding:16px 18px;display:flex;flex-direction:column;gap:12px')}>
      {snippets.length > 0 && (
        <div
          style={{
            ...s('border-radius:11px;padding:13px 15px;display:flex;align-items:center;gap:12px'),
            border: `.5px solid ${live ? 'var(--line)' : 'var(--accent)'}`,
            background: live ? 'var(--surface)' : 'var(--surface)',
          }}
        >
          <span style={{ ...s('width:8px;height:8px;border-radius:50%;flex:none'), background: live ? 'var(--green)' : 'var(--orange)' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s('font-size:12.5px;font-weight:600')}>
              {live ? 'Expanding everywhere' : 'Expansion needs Accessibility'}
            </div>
            <div style={s('font-size:11.5px;color:var(--text-3);margin-top:2px;line-height:1.45')}>
              {live
                ? 'Type a trigger in any app and it turns into the body, like iOS Text Replacement.'
                : 'Add Stash under Privacy & Security → Accessibility. This updates by itself once you do.'}
            </div>
          </div>
          {!live && (
            <button
              onClick={() => void openAccessibilityPane()}
              style={s('flex:none;border:0;cursor:pointer;font:inherit;font-size:12px;font-weight:600;color:#fff;background:var(--accent);padding:7px 13px;border-radius:8px')}
            >
              Open
            </button>
          )}
        </div>
      )}

      {adding ? (
        <div style={s('border:.5px solid var(--line);border-radius:12px;padding:14px;background:var(--surface);display:flex;flex-direction:column;gap:9px')}>
          <div style={s('display:flex;gap:9px')}>
            <input {...literal} style={field} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input {...literal} style={field} placeholder="Trigger" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} />
          </div>
          <textarea
            {...literal}
            style={{ ...field, minHeight: 76, fontFamily: 'ui-monospace,SF Mono,monospace', resize: 'vertical' }}
            placeholder="Snippet body"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <div style={s('display:flex;gap:9px;justify-content:flex-end')}>
            <button onClick={() => setAdding(false)} style={s('cursor:pointer;font:inherit;font-size:12.5px;font-weight:560;color:var(--text-2);background:var(--surface-3);border:0;padding:8px 16px;border-radius:9px')}>
              Cancel
            </button>
            <button onClick={() => void save()} style={s('border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:600;color:#fff;background:var(--accent);padding:8px 16px;border-radius:9px')}>
              Save snippet
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={s('align-self:flex-start;border:.5px dashed var(--line);cursor:pointer;font:inherit;font-size:12.5px;font-weight:560;color:var(--text-2);background:transparent;padding:8px 14px;border-radius:9px')}
        >
          + New snippet
        </button>
      )}

      {snippets.map((sn) => (
        <div key={sn.id} style={s('border:.5px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface)')}>
          <div style={s('display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:.5px solid var(--line)')}>
            <span style={s('font-family:ui-monospace,monospace;font-size:11px;font-weight:640;color:var(--accent);background:var(--sel);padding:3px 8px;border-radius:6px')}>
              {sn.trigger}
            </span>
            <span style={s('font-size:13px;font-weight:560')}>{sn.name}</span>
            <span style={s('margin-left:auto;font-size:11px;color:var(--text-3)')}>{sn.uses} uses</span>
            <button
              onClick={async () => {
                await runSnippet(sn.id)
                fire('Copied “' + sn.name + '” to clipboard')
              }}
              style={s('border:0;cursor:pointer;font:inherit;font-size:11.5px;font-weight:600;color:#fff;background:var(--accent);padding:5px 12px;border-radius:7px')}
            >
              Copy
            </button>
            <button
              onClick={() => void removeSnippet(sn.id)}
              style={s('border:0;cursor:pointer;font:inherit;font-size:11.5px;font-weight:560;color:var(--text-2);background:var(--surface-3);padding:5px 10px;border-radius:7px')}
            >
              Delete
            </button>
          </div>
          <div style={s('padding:12px 14px;font-family:ui-monospace,SF Mono,monospace;font-size:12px;line-height:1.6;color:var(--text-2);white-space:pre-wrap')}>
            {sn.body}
          </div>
        </div>
      ))}
      {snippets.length === 0 && !adding && (
        <div style={s('font-size:12.5px;color:var(--text-3)')}>
          No snippets yet. Add one to reuse text you paste often.
        </div>
      )}
    </div>
  )
}

/**
 * Point this at your Ko-fi / Buy Me a Coffee / PayPal.me page and the support
 * buttons go live. Left empty the panel says so rather than pretending.
 */
const DONATE_URL: string = ''
const APP_VERSION = '0.1.0'

function About({ items }: { items: Item[] }) {
  const bytes = items.reduce((sum, x) => sum + (x.bytes || 0), 0)

  const give = (amount: string) => {
    const sep = DONATE_URL.endsWith('/') ? '' : '/'
    void openPath(amount === 'any' ? DONATE_URL : `${DONATE_URL}${sep}${amount}`)
  }

  const card = 'border:.5px solid var(--line);border-radius:13px;background:var(--surface);padding:18px 20px'

  return (
    <div style={s('padding:20px;max-width:660px;display:flex;flex-direction:column;gap:16px')}>
      <div style={{ ...s(card), display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src="/mark.svg" width={64} height={64} alt="" style={s('display:block;border-radius:15px;box-shadow:var(--shadow-sm);flex:none')} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s('font-size:19px;font-weight:700;letter-spacing:-.02em')}>Stash</div>
          <div style={s('font-size:12.5px;color:var(--text-2);margin-top:2px')}>
            Everything you copy, kept · Version {APP_VERSION}
          </div>
          <div style={s('font-size:11.5px;color:var(--text-3);margin-top:6px')}>
            {items.length.toLocaleString()} items kept · {humanSize(bytes)} on disk
          </div>
        </div>
      </div>

      <div style={s(card)}>
        <div style={s('font-size:14px;font-weight:640;letter-spacing:-.01em;margin-bottom:10px')}>
          Free to use. All of it.
        </div>
        <div style={s('font-size:12.5px;color:var(--text-2);line-height:1.65')}>
          No account, no subscription, no trial that expires, no feature locked behind a
          tier. Your clipboard history never leaves this Mac — it lives in a single file in
          your Application Support folder, and nothing is uploaded, synced or measured.
        </div>
        <div style={s('display:flex;flex-wrap:wrap;gap:7px;margin-top:14px')}>
          {['No accounts', 'No telemetry', 'No cloud', 'Local file only'].map((tag) => (
            <span key={tag} style={s('font-size:11px;font-weight:560;color:var(--green);background:rgba(48,209,88,.13);padding:5px 10px;border-radius:7px')}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Hidden until DONATE_URL points somewhere — buttons that go nowhere
          are worse than no buttons. Set it and this card comes back. */}
      {DONATE_URL ? (
      <div style={s(card)}>
        <div style={s('font-size:14px;font-weight:640;letter-spacing:-.01em;margin-bottom:6px')}>
          If it saves you time
        </div>
        <div style={s('font-size:12.5px;color:var(--text-2);line-height:1.65;margin-bottom:14px')}>
          Chip in whatever it's worth to you — any amount, once, never a subscription.
          Skipping this changes nothing: the app is complete either way.
        </div>
        <div style={s('display:flex;gap:8px;flex-wrap:wrap')}>
          {['3', '5', '10'].map((amount) => (
            <button
              key={amount}
              onClick={() => give(amount)}
              style={s('border:.5px solid var(--line);cursor:pointer;font:inherit;font-size:13px;font-weight:600;color:var(--text);background:var(--surface-2);padding:9px 18px;border-radius:9px')}
            >
              ${amount}
            </button>
          ))}
          <button
            onClick={() => give('any')}
            style={s('border:0;cursor:pointer;font:inherit;font-size:13px;font-weight:600;color:#fff;background:var(--accent);padding:9px 18px;border-radius:9px;box-shadow:var(--shadow-sm)')}
          >
            Any amount
          </button>
        </div>
      </div>
      ) : null}

      <div style={s('font-size:11.5px;color:var(--text-3);text-align:center;line-height:1.6;padding:4px 0 8px')}>
        Built with Tauri, Rust and React · Thanks for using it
      </div>
    </div>
  )
}

function Stats({ items }: { items: Item[] }) {
  const now = Date.now()
  const week = items.filter((x) => now - x.ts < 7 * DAY).length
  const prevWeek = items.filter((x) => now - x.ts >= 7 * DAY && now - x.ts < 14 * DAY).length
  const today = items.filter((x) => dayBucket(x.ts) === 'Today').length
  const bytes = items.reduce((sum, x) => sum + (x.bytes || 0), 0)
  const apps = new Set(items.map((x) => x.app))
  const delta = prevWeek ? Math.round(((week - prevWeek) / prevWeek) * 100) : 0

  const stats = [
    { label: 'Total items', value: items.length.toLocaleString(), delta: `+${today} today`, deltaColor: 'var(--green)' },
    {
      label: 'This week',
      value: String(week),
      delta: prevWeek ? `${delta >= 0 ? '+' : ''}${delta}% vs last` : 'first week',
      deltaColor: delta >= 0 ? 'var(--green)' : 'var(--red)',
    },
    { label: 'Pinned', value: String(items.filter((x) => x.pinned).length), delta: `${apps.size} sources`, deltaColor: 'var(--text-3)' },
    { label: 'Storage', value: humanSize(bytes), delta: `across ${items.length} items`, deltaColor: 'var(--text-3)' },
  ]

  // Last 7 days, oldest bar first.
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(now - (6 - i) * DAY).setHours(0, 0, 0, 0)
    return {
      count: items.filter((x) => x.ts >= start && x.ts < start + DAY).length,
      label: new Date(start).toLocaleDateString([], { weekday: 'narrow' }),
      today: i === 6,
    }
  })
  const max = Math.max(1, ...days.map((d) => d.count))

  const byKind = new Map<string, number>()
  for (const it of items) byKind.set(it.kind, (byKind.get(it.kind) ?? 0) + 1)
  const typeBreak = [...byKind.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([kind, count]) => ({
      label: typeLabel(kind),
      pct: Math.round((count / Math.max(1, items.length)) * 100) + '%',
      color: tintColor(kind),
    }))

  const byApp = new Map<string, number>()
  for (const it of items) byApp.set(it.app, (byApp.get(it.app) ?? 0) + 1)
  const topApps = [...byApp.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)

  return (
    <div style={{ padding: 20 }}>
      <div style={s('display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px')}>
        {stats.map((st) => (
          <div key={st.label} style={s('border:.5px solid var(--line);border-radius:13px;padding:16px 18px;background:var(--surface)')}>
            <div style={s('font-size:11.5px;color:var(--text-3);font-weight:560;margin-bottom:8px')}>{st.label}</div>
            <div style={s('font-size:28px;font-weight:700;letter-spacing:-.03em')}>{st.value}</div>
            <div style={{ fontSize: 11, color: st.deltaColor, fontWeight: 560, marginTop: 4 }}>{st.delta}</div>
          </div>
        ))}
      </div>

      <div style={s('border:.5px solid var(--line);border-radius:14px;padding:20px;background:var(--surface)')}>
        <div style={s('font-size:13px;font-weight:620;margin-bottom:18px')}>Activity — last 7 days</div>
        <div style={s('display:flex;align-items:flex-end;gap:14px;height:150px')}>
          {days.map((d, i) => (
            <div key={i} style={s('flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end')}>
              <div
                title={`${d.count} items`}
                style={{
                  width: '100%',
                  maxWidth: 38,
                  height: Math.round((d.count / max) * 100) + '%',
                  minHeight: 2,
                  background: d.today ? 'var(--accent)' : 'var(--surface-3)',
                  borderRadius: '6px 6px 0 0',
                  transition: 'height .3s ease',
                }}
              />
              <div style={s('font-size:11px;color:var(--text-3);font-weight:500')}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s('display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px')}>
        <div style={s('border:.5px solid var(--line);border-radius:14px;padding:18px;background:var(--surface)')}>
          <div style={s('font-size:13px;font-weight:620;margin-bottom:14px')}>By type</div>
          {typeBreak.map((tb) => (
            <div key={tb.label} style={{ marginBottom: 11 }}>
              <div style={s('display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px')}>
                <span style={{ color: 'var(--text-2)' }}>{tb.label}</span>
                <span style={{ fontWeight: 560 }}>{tb.pct}</span>
              </div>
              <div style={s('height:6px;border-radius:4px;background:var(--surface-3)')}>
                <div style={{ height: '100%', width: tb.pct, borderRadius: 4, background: tb.color }} />
              </div>
            </div>
          ))}
          {typeBreak.length === 0 && <div style={s('font-size:12px;color:var(--text-3)')}>No data yet.</div>}
        </div>

        <div style={s('border:.5px solid var(--line);border-radius:14px;padding:18px;background:var(--surface)')}>
          <div style={s('font-size:13px;font-weight:620;margin-bottom:14px')}>Top sources</div>
          {topApps.map(([app, count], i) => {
            const [bg, color] = TINTS[i % TINTS.length]
            return (
              <div key={app} style={s('display:flex;align-items:center;gap:10px;margin-bottom:12px')}>
                <div style={{ ...s('width:26px;height:26px;border-radius:7px;display:grid;place-items:center;font-size:11px;font-weight:700'), background: bg, color }}>
                  {app.slice(0, 1).toUpperCase()}
                </div>
                <span style={s('flex:1;font-size:12.5px;font-weight:500')}>{app}</span>
                <span style={s('font-size:12px;color:var(--text-3);font-weight:560')}>{count}</span>
              </div>
            )
          })}
          {topApps.length === 0 && <div style={s('font-size:12px;color:var(--text-3)')}>No data yet.</div>}
        </div>
      </div>
    </div>
  )
}

function SettingsPane({
  settings, patch, colls,
}: {
  settings: Settings
  patch: (next: Partial<Settings>) => void
  colls: Collection[]
}) {
  const [trusted, setTrusted] = useState(true)
  useEffect(() => {
    let alive = true
    const check = () => void accessibility().then((ok) => alive && setTrusted(ok))
    check()
    // Granting happens in System Settings, outside this window — poll for it.
    const timer = setInterval(check, 2000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  /** Plain switch — the permission is asked for once, when a snippet is saved. */
  const toggleExpand = async () => {
    patch({ expandSnippets: !settings.expandSnippets })
    setTrusted(await accessibility())
  }

  const needsSetup = settings.expandSnippets && !trusted

  const groups: { label: string; rows: { title: string; desc: string; control: ReactNode }[] }[] = [
    {
      label: 'General',
      rows: [
        {
          title: 'Launch at login',
          desc: 'Start Stash when you log in',
          control: <Toggle on={settings.launchAtLogin} onChange={() => patch({ launchAtLogin: !settings.launchAtLogin })} />,
        },
        {
          title: 'Global hotkey',
          desc: 'Open Quick Access',
          control: (
            <span style={s('flex:none;font-family:ui-monospace,monospace;font-size:12px;font-weight:600;color:var(--text-2);background:var(--surface-3);padding:6px 11px;border-radius:8px')}>
              {hotkeyLabel}
            </span>
          ),
        },
        {
          title: 'Menu bar list',
          desc: 'What the tray popover shows',
          control: (
            <Picker
              options={[
                ...MENU_VIEWS.map((v) => ({ value: v, label: v })),
                ...colls.map((c) => ({
                  value: `c:${c.id}`,
                  label: c.name,
                  dot: collColor(colls, c.id),
                })),
              ]}
              value={settings.menuView ?? 'Recent'}
              onChange={(menuView) => patch({ menuView })}
            />
          ),
        },
        {
          title: 'History limit',
          desc: 'Items to retain',
          control: (
            <Segmented
              options={HISTORY_LIMITS}
              value={settings.historyLimit}
              onChange={(historyLimit) => patch({ historyLimit })}
            />
          ),
        },
      ],
    },
    {
      label: 'Snippets',
      rows: [
        {
          title: 'Expand triggers as you type',
          desc: !settings.expandSnippets
            ? 'Watches typing system-wide. Needs Accessibility permission.'
            : trusted
              ? 'Ready — type a trigger in any app and it becomes the body'
              : 'Waiting on Accessibility. Grant it, then quit and reopen Stash.',
          control: <Toggle on={settings.expandSnippets} onChange={() => void toggleExpand()} />,
        },
      ],
    },
    {
      label: 'Privacy',
      rows: [
        {
          title: 'Ignore password managers',
          desc: 'Never capture from 1Password, Keychain',
          control: (
            <Toggle
              on={settings.ignorePasswordManagers}
              onChange={() => patch({ ignorePasswordManagers: !settings.ignorePasswordManagers })}
            />
          ),
        },
        {
          title: 'Auto-clear sensitive',
          desc: 'Remove detected secrets after',
          control: (
            <Segmented
              options={AUTO_CLEAR}
              value={settings.autoClear}
              onChange={(autoClear) => patch({ autoClear })}
            />
          ),
        },
      ],
    },
    {
      label: 'Appearance',
      rows: [
        {
          title: 'Theme',
          desc: 'Match app to system or force one',
          control: (
            <Segmented
              options={['System', 'Light', 'Dark']}
              value={settings.theme[0].toUpperCase() + settings.theme.slice(1)}
              onChange={(next) => patch({ theme: next.toLowerCase() as Settings['theme'] })}
            />
          ),
        },
        {
          title: 'Accent',
          desc: 'Selection & focus color',
          control: (
            <SwatchPicker
              options={ACCENTS}
              names={ACCENT_NAMES}
              value={settings.accent}
              onChange={(accent) => patch({ accent })}
            />
          ),
        },
        {
          title: 'Density',
          desc: 'Row height in lists',
          control: (
            <Segmented
              options={['Comfortable', 'Compact']}
              value={settings.density}
              onChange={(next) => patch({ density: next as Settings['density'] })}
            />
          ),
        },
        {
          title: 'Show counts',
          desc: 'Item counts beside segments and sections',
          control: <Toggle on={settings.showCounts} onChange={() => patch({ showCounts: !settings.showCounts })} />,
        },
      ],
    },
  ]

  return (
    <div style={s('padding:20px;max-width:660px')}>
      {/* macOS refuses to show its permission prompt for an ad-hoc signed app,
          so adding it by hand is the only way in. Spell it out. */}
      {needsSetup && (
        <div style={s('border:.5px solid var(--accent);border-radius:13px;background:var(--surface);padding:18px 20px;margin-bottom:24px')}>
          <div style={s('font-size:13.5px;font-weight:640;letter-spacing:-.01em;margin-bottom:6px')}>
            One step left — add Stash to Accessibility
          </div>
          <div style={s('font-size:12.5px;color:var(--text-2);line-height:1.6;margin-bottom:14px')}>
            macOS won’t pop its own prompt for an unsigned app, so add it yourself:
            open the pane, click <b>+</b>, and pick <b>Stash</b> — the Reveal button puts
            it in a Finder window you can drag straight in. This page notices the moment
            it’s granted.
          </div>
          <div style={s('display:flex;gap:9px;flex-wrap:wrap')}>
            <button
              onClick={() => void openAccessibilityPane()}
              style={s('border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:600;color:#fff;background:var(--accent);padding:9px 16px;border-radius:9px')}
            >
              Open Accessibility settings
            </button>
            <button
              onClick={() => void revealSelf()}
              style={s('border:.5px solid var(--line);cursor:pointer;font:inherit;font-size:12.5px;font-weight:600;color:var(--text);background:var(--surface-2);padding:9px 16px;border-radius:9px')}
            >
              Reveal Stash in Finder
            </button>
          </div>
        </div>
      )}

      {groups.map((grp) => (
        <div key={grp.label} style={{ marginBottom: 24 }}>
          <div style={s('font-size:12px;font-weight:660;letter-spacing:.02em;color:var(--text-2);margin-bottom:9px;padding-left:2px')}>
            {grp.label}
          </div>
          <div style={s('border:.5px solid var(--line);border-radius:13px;overflow:hidden;background:var(--surface)')}>
            {grp.rows.map((row, i) => (
              <div
                key={row.title}
                style={{
                  ...s('display:flex;align-items:center;gap:14px;padding:13px 16px'),
                  borderBottom: i === grp.rows.length - 1 ? '0' : '.5px solid var(--line)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={s('font-size:13.5px;font-weight:520')}>{row.title}</div>
                  <div style={s('font-size:11.5px;color:var(--text-3);margin-top:2px')}>{row.desc}</div>
                </div>
                {row.control}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
