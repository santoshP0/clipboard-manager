import { useCallback, useEffect, useState } from 'react'

import {
  addSnippet, copyItem, isMac, openPath, removeItem, removeSnippet, saveSettings, thumbUrl,
  toggleFav, togglePin, runSnippet, useGoto, type Loaded,
} from './api'
import {
  ACCENTS, ACCENT_NAMES, AUTO_CLEAR, HEART_PATH, HISTORY_LIMITS, PIN_PATH, SEL_BAR, dayBucket,
  exactTime, fz, hay, humanSize, metaFor, relTime, s, sectionFilter, sub, subFont, tintColor,
  typeLabel, type Item, type Settings,
} from './lib'
import {
  EmptyClipboard, IconBox, LoadingRows, NoMatches, Preview, SearchIcon,
} from './ui'

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
    ],
  },
]

const MODE: Record<string, string> = {
  History: 'list', Favorites: 'list', Code: 'list', Links: 'list', Files: 'list',
  Timeline: 'timeline', Images: 'grid', Collections: 'collections', Snippets: 'snippets',
  Statistics: 'stats', Settings: 'settings',
}

const SUBTITLE: Record<string, string> = {
  History: 'All captured items',
  Favorites: 'Starred for quick reach',
  Timeline: 'Grouped by when you copied',
  Images: 'Visual clipboard history',
  Files: 'Copied files & paths',
  Code: 'Snippets with syntax',
  Collections: 'Grouped by source app',
  Links: 'URLs you’ve copied',
  Snippets: 'Reusable expansions',
  Statistics: 'Your clipboard, quantified',
  Settings: 'Preferences & privacy',
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
const hotkeyLabel = isMac ? '⌘⇧V' : 'Ctrl+Shift+V'

export default function Full({ loaded, fire }: { loaded: Loaded; fire: (msg: string) => void }) {
  const { store, state } = loaded
  const { settings } = store
  const [section, setSection] = useState('History')
  const [fq, setFq] = useState('')
  const [selRaw, setSel] = useState(0)

  useGoto(useCallback((next: string) => setSection(next), []))

  const mode = MODE[section] ?? 'list'
  const list = sectionFilter(store.items, section).filter((x) => fz(fq, hay(x)))
  const sel = Math.min(selRaw, Math.max(0, list.length - 1))
  const item = list[sel]
  const meta = metaFor(item)
  const rowPad = settings.density === 'Compact' ? '7px 12px' : '11px 12px'

  const patch = (next: Partial<Settings>) => void saveSettings({ ...settings, ...next })

  const copy = useCallback(
    async (it: Item) => {
      await copyItem(it.id)
      fire('Copied “' + it.title + '” to clipboard')
    },
    [fire],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.key === ',') {
        e.preventDefault()
        setSection('Settings')
      } else if (mod && (e.key === 'Backspace' || e.key === 'Delete') && item) {
        e.preventDefault()
        void removeItem(item.id)
        fire('Deleted “' + item.title + '”')
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [item, fire])

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
                    onClick={() => { setSection(name); setSel(0); setFq('') }}
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
            <div style={s('font-size:19px;font-weight:680;letter-spacing:-.02em')}>{section}</div>
            <div style={s('font-size:12px;color:var(--text-3);font-weight:500;margin-top:2px')}>
              {SUBTITLE[section] ?? ''}
            </div>
            <div style={s('margin-left:auto;display:flex;align-items:center;gap:10px')}>
              <div style={s('display:flex;align-items:center;gap:8px;background:var(--surface-3);padding:6px 11px;border-radius:9px;width:200px')}>
                <SearchIcon size={14} />
                <input
                  value={fq}
                  onChange={(e) => { setFq(e.target.value); setSel(0) }}
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
                        onClick={() => setSel(i)}
                        onDoubleClick={() => void copy(it)}
                        className={'row' + (i === sel ? ' sel' : '')}
                        style={{
                          ...s('display:flex;align-items:center;gap:13px;border-radius:10px;cursor:pointer;position:relative'),
                          padding: rowPad,
                        }}
                      >
                        {i === sel && <div style={s(SEL_BAR + ';top:10px;bottom:10px')} />}
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
                <Collections items={store.items} onOpen={() => setSection('History')} />
              ) : mode === 'snippets' ? (
                <Snippets loaded={loaded} fire={fire} />
              ) : mode === 'stats' ? (
                <Stats items={store.items} />
              ) : (
                <SettingsPane settings={settings} patch={patch} />
              )}
            </div>

            {/* inspector */}
            {mode === 'list' && (
              <div className="mem-scroll" style={s('width:300px;flex:none;border-left:.5px solid var(--line);background:var(--glass-2);overflow-y:auto;padding:20px')}>
                <div style={s('display:flex;align-items:center;justify-content:space-between;margin-bottom:16px')}>
                  <div style={s('font-size:11px;font-weight:660;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3)')}>
                    Inspector
                  </div>
                  <div style={s('display:flex;gap:6px')}>
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

                <div style={s('font-size:11px;font-weight:640;letter-spacing:.03em;text-transform:uppercase;color:var(--text-3);margin-bottom:8px')}>
                  Actions
                </div>
                <div style={s('display:flex;flex-direction:column;gap:7px')}>
                  <ActionRow
                    label="Copy to clipboard"
                    iconPath="M4 6h16M4 12h10M4 18h7"
                    onClick={() => item && void copy(item)}
                  />
                  {item && (item.kind === 'link' || item.kind === 'file' || item.kind === 'image') && (
                    <ActionRow
                      label={item.kind === 'link' ? 'Open in browser' : 'Reveal in file manager'}
                      iconPath="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"
                      onClick={() => void openPath((item.url || item.path) as string)}
                    />
                  )}
                  <ActionRow
                    label="Delete from history"
                    iconPath="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13"
                    onClick={() => {
                      if (!item) return
                      void removeItem(item.id)
                      fire('Deleted “' + item.title + '”')
                    }}
                  />
                </div>

                <button
                  onClick={() => item && void copy(item)}
                  style={s('width:100%;margin-top:18px;border:0;cursor:pointer;font:inherit;font-size:13px;font-weight:600;color:#fff;background:var(--accent);padding:11px;border-radius:10px;box-shadow:var(--shadow-sm)')}
                >
                  Copy to clipboard
                </button>
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

function ActionRow({ label, iconPath, onClick }: { label: string; iconPath: string; onClick: () => void }) {
  return (
    <div className="ai" onClick={onClick} style={s('display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:9px;border:.5px solid var(--line);cursor:pointer;background:var(--surface)')}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={iconPath} />
      </svg>
      <span style={s('flex:1;font-size:12.5px;font-weight:520')}>{label}</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </div>
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
              background: it.kind === 'color' ? (it.value ?? undefined) : thumbUrl(it),
              backgroundSize: 'cover',
              backgroundPosition: 'center',
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

/** ponytail: a "collection" is the app an item came from — real grouping, and no tagging UI to build. */
function Collections({ items, onOpen }: { items: Item[]; onOpen: () => void }) {
  const byApp = new Map<string, Item[]>()
  for (const it of items) {
    const bucket = byApp.get(it.app) ?? []
    bucket.push(it)
    byApp.set(it.app, bucket)
  }
  const groups = [...byApp.entries()].sort((a, b) => b[1].length - a[1].length)

  if (groups.length === 0) {
    return (
      <div style={{ height: 320 }}>
        <EmptyClipboard hotkey={hotkeyLabel} />
      </div>
    )
  }

  return (
    <div style={s('padding:18px;display:grid;grid-template-columns:repeat(2,1fr);gap:14px')}>
      {groups.map(([app, group], i) => {
        const [bg, color] = TINTS[i % TINTS.length]
        const chips = [...new Set(group.map((g) => tintColor(g.kind)))].slice(0, 3)
        return (
          <div key={app} onClick={onOpen} className="tile" style={s('border:.5px solid var(--line);border-radius:14px;padding:18px;cursor:pointer;background:var(--surface)')}>
            <div style={s('display:flex;align-items:center;gap:11px;margin-bottom:14px')}>
              <div style={{ ...s('width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:14px;font-weight:700'), background: bg, color }}>
                {app.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={s('font-size:14px;font-weight:620;letter-spacing:-.01em')}>{app}</div>
                <div style={s('font-size:11.5px;color:var(--text-3)')}>{group.length} items</div>
              </div>
            </div>
            <div style={s('display:flex;gap:6px')}>
              {chips.map((c) => (
                <div key={c} style={{ flex: 1, height: 6, borderRadius: 4, background: c }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Snippets({ loaded, fire }: { loaded: Loaded; fire: (msg: string) => void }) {
  const { snippets } = loaded.store
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', trigger: '', body: '' })

  const field = s('border:.5px solid var(--line);border-radius:8px;padding:8px 10px;font:inherit;font-size:12.5px;background:var(--surface);color:var(--text);outline:0;width:100%')

  const save = async () => {
    if (!form.body.trim()) return
    await addSnippet(form.name || 'Snippet', form.trigger || ';new', form.body)
    setForm({ name: '', trigger: '', body: '' })
    setAdding(false)
  }

  return (
    <div style={s('padding:16px 18px;display:flex;flex-direction:column;gap:12px')}>
      {adding ? (
        <div style={s('border:.5px solid var(--line);border-radius:12px;padding:14px;background:var(--surface);display:flex;flex-direction:column;gap:9px')}>
          <div style={s('display:flex;gap:9px')}>
            <input style={field} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input style={field} placeholder=";trigger" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} />
          </div>
          <textarea
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
  settings, patch,
}: {
  settings: Settings; patch: (next: Partial<Settings>) => void
}) {
  const cycle = <T,>(values: readonly T[], current: T) =>
    values[(values.indexOf(current) + 1) % values.length]

  const groups: {
    label: string
    rows: { title: string; desc: string; toggle?: boolean; value?: string; onClick?: () => void }[]
  }[] = [
    {
      label: 'General',
      rows: [
        {
          title: 'Launch at login',
          desc: 'Start Memory when you log in',
          toggle: settings.launchAtLogin,
          onClick: () => patch({ launchAtLogin: !settings.launchAtLogin }),
        },
        { title: 'Global hotkey', desc: 'Open Quick Access', value: hotkeyLabel },
        {
          title: 'History limit',
          desc: 'Items to retain',
          value: settings.historyLimit,
          onClick: () => patch({ historyLimit: cycle(HISTORY_LIMITS, settings.historyLimit) }),
        },
      ],
    },
    {
      label: 'Privacy',
      rows: [
        {
          title: 'Ignore password managers',
          desc: 'Never capture from 1Password, Keychain',
          toggle: settings.ignorePasswordManagers,
          onClick: () => patch({ ignorePasswordManagers: !settings.ignorePasswordManagers }),
        },
        {
          title: 'Auto-clear sensitive',
          desc: 'Remove detected secrets after',
          value: settings.autoClear,
          onClick: () => patch({ autoClear: cycle(AUTO_CLEAR, settings.autoClear) }),
        },
      ],
    },
    {
      label: 'Appearance',
      rows: [
        {
          title: 'Theme',
          desc: 'Match app to system or force one',
          value: settings.theme[0].toUpperCase() + settings.theme.slice(1),
          onClick: () => patch({ theme: cycle(['system', 'light', 'dark'] as const, settings.theme) }),
        },
        {
          title: 'Accent',
          desc: 'Selection & focus color',
          value: ACCENT_NAMES[settings.accent] ?? settings.accent,
          onClick: () => patch({ accent: cycle(ACCENTS, settings.accent) }),
        },
        {
          title: 'Density',
          desc: 'Row height in lists',
          value: settings.density,
          onClick: () => patch({ density: cycle(['Comfortable', 'Compact'] as const, settings.density) }),
        },
        {
          title: 'Show counts',
          desc: 'Item counts beside segments and sections',
          toggle: settings.showCounts,
          onClick: () => patch({ showCounts: !settings.showCounts }),
        },
      ],
    },
  ]

  return (
    <div style={s('padding:20px;max-width:620px')}>
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
                <div style={{ flex: 1 }}>
                  <div style={s('font-size:13.5px;font-weight:520')}>{row.title}</div>
                  <div style={s('font-size:11.5px;color:var(--text-3);margin-top:2px')}>{row.desc}</div>
                </div>
                {row.toggle !== undefined ? (
                  <div
                    onClick={row.onClick}
                    style={{
                      ...s('width:40px;height:24px;border-radius:20px;padding:2px;cursor:pointer;transition:background .2s ease;display:flex'),
                      background: row.toggle ? 'var(--accent)' : 'var(--surface-3)',
                      justifyContent: row.toggle ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={s('width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:all .2s ease')} />
                  </div>
                ) : (
                  <div
                    onClick={row.onClick}
                    style={{
                      ...s('display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text-2);font-weight:520;background:var(--surface-3);padding:5px 11px;border-radius:8px'),
                      cursor: row.onClick ? 'pointer' : 'default',
                    }}
                  >
                    {row.value}
                    {row.onClick && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
