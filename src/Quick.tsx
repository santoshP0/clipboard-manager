import { useCallback, useEffect, useRef, useState } from 'react'

import {
  copyItem, hideSelf, isMac, removeItem, togglePin, useFitWindow, useQuickOpen, type Loaded,
} from './api'
import {
  PIN_PATH, SEL_BAR, fz, hay, metaFor, relTime, s, segFilter, sub, subFont, tintColor,
  typeLabel,
} from './lib'
import {
  EmptyClipboard, IconBox, KeyHint, LoadingRows, NoMatches, Preview, SearchIcon,
} from './ui'
import { dissolveElement } from './dissolve'

const SEG_NAMES = ['Recent', 'Pinned', 'Images', 'Code', 'Files', 'Links', 'Collections']

export default function Quick({ loaded, fire }: { loaded: Loaded; fire: (msg: string) => void }) {
  const { store, state } = loaded
  const { settings } = store
  const [seg, setSeg] = useState('Recent')
  const [q, setQ] = useState('')
  const [selRaw, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  useFitWindow(panel)

  const list = segFilter(store.items, seg).filter((x) => fz(q, hay(x)))
  const sel = Math.min(selRaw, Math.max(0, list.length - 1))
  const selItem = list[sel]
  const meta = metaFor(selItem)
  const rowPad = settings.density === 'Compact' ? '6px 12px' : '10px 12px'
  const hotkey = isMac ? '⌘⇧V' : 'Ctrl+Shift+V'

  const reset = useCallback(() => {
    setQ('')
    setSeg('Recent')
    setSel(0)
    input.current?.focus()
  }, [])
  useQuickOpen(reset)
  useEffect(() => {
    input.current?.focus()
  }, [])

  const copyAndClose = useCallback(async () => {
    const it = list[sel]
    if (!it) return
    await copyItem(it.id)
    await hideSelf()
  }, [list, sel])

  // Keep the selected row visible while arrowing through the list.
  useEffect(() => {
    listRef.current?.querySelector('[data-sel="1"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel, seg, q])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      const it = list[sel]

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel(Math.min(list.length - 1, sel + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSel(Math.max(0, sel - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        void copyAndClose()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        void hideSelf()
      } else if (mod && e.key.toLowerCase() === 'f' && it) {
        e.preventDefault()
        void togglePin(it.id)
        fire((it.pinned ? 'Unpinned “' : 'Pinned “') + it.title + '”')
      } else if (mod && (e.key === 'Backspace' || e.key === 'Delete') && it) {
        e.preventDefault()
        const row = document.querySelector<HTMLElement>(`[data-row="${it.id}"]`)
        if (row) dissolveElement(row, ['var(--text)', tintColor(it.kind), '#ffffff'])
        void removeItem(it.id)
        fire('Deleted “' + it.title + '”')
      } else if (mod && /^[1-7]$/.test(e.key)) {
        e.preventDefault()
        setSeg(SEG_NAMES[Number(e.key) - 1])
        setSel(0)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [list, sel, copyAndClose, fire])

  return (
    <div ref={panel} style={s('width:760px;animation:popIn .22s cubic-bezier(.32,.72,0,1)')}>
      <div
        style={{
          ...s('background:var(--glass);border:.5px solid var(--line);overflow:hidden'),
          borderRadius: isMac ? '18px' : '12px',
        }}
      >
        {/* search row */}
        <div style={s('display:flex;align-items:center;gap:12px;padding:16px 20px 15px')}>
          <SearchIcon />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0) }}
            placeholder="Search your clipboard…"
            spellCheck={false}
            style={s('flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:20px;font-weight:420;letter-spacing:-.015em;color:var(--text)')}
          />
          <div style={s('display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:var(--text-3);background:var(--surface-3);padding:4px 9px;border-radius:7px')}>
            {list.length} items
          </div>
        </div>
        <div style={s('height:.5px;background:var(--line)')} />

        {/* segments */}
        <div className="mem-scroll" style={s('display:flex;align-items:center;gap:3px;padding:9px 14px;overflow-x:auto')}>
          {SEG_NAMES.map((name) => {
            const on = seg === name
            return (
              <button
                key={name}
                onClick={() => { setSeg(name); setSel(0) }}
                style={{
                  ...s('flex:none;border:0;cursor:pointer;font:inherit;font-size:12.5px;padding:6px 12px;border-radius:8px;transition:all .16s ease;display:flex;align-items:center;gap:6px'),
                  fontWeight: on ? 640 : 520,
                  color: on ? '#fff' : 'var(--text-2)',
                  background: on ? 'var(--accent)' : 'transparent',
                }}
              >
                {name}
                {settings.showCounts && (
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: on ? 'rgba(255,255,255,.75)' : 'var(--text-3)' }}>
                    {segFilter(store.items, name).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div style={s('height:.5px;background:var(--line)')} />

        {/* body: list + preview */}
        <div style={s('display:grid;grid-template-columns:1fr 300px;height:372px')}>
          <div ref={listRef} className="mem-scroll" style={s('overflow-y:auto;padding:8px')}>
            {state === 'loading' ? (
              <LoadingRows />
            ) : store.items.length === 0 ? (
              <EmptyClipboard hotkey={hotkey} />
            ) : list.length === 0 ? (
              <NoMatches seg={seg} q={q} />
            ) : (
              list.map((it, i) => (
                <div
                  key={it.id}
                  data-row={it.id}
                  data-sel={i === sel ? '1' : '0'}
                  onClick={() => setSel(i)}
                  onDoubleClick={copyAndClose}
                  className={'row' + (i === sel ? ' sel' : '')}
                  style={{
                    ...s('display:flex;align-items:center;gap:12px;border-radius:10px;cursor:pointer;position:relative'),
                    padding: rowPad,
                  }}
                >
                  {i === sel && <div style={s(SEL_BAR + ';top:9px;bottom:9px')} />}
                  <IconBox it={it} size={34} radius={9} icon={17} />
                  <div style={s('flex:1;min-width:0')}>
                    <div style={s('display:flex;align-items:center;gap:7px')}>
                      <div style={s('font-size:13.5px;font-weight:560;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)')}>
                        {it.title}
                      </div>
                      {it.pinned && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--orange)" stroke="none">
                          <path d={PIN_PATH} />
                        </svg>
                      )}
                    </div>
                    <div
                      style={{
                        ...s('font-size:11.5px;color:var(--text-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px'),
                        fontFamily: subFont(it),
                      }}
                    >
                      {sub(it)}
                    </div>
                  </div>
                  <div style={s('flex:none;font-size:10.5px;font-weight:500;color:var(--text-3);text-align:right')}>
                    {relTime(it.ts)}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* preview */}
          <div style={s('border-left:.5px solid var(--line);background:var(--glass-2);display:flex;flex-direction:column')}>
            {selItem && (
              <div className="mem-scroll" style={s('flex:1;overflow-y:auto;padding:18px')}>
                <div style={s('display:flex;align-items:center;gap:8px;margin-bottom:14px')}>
                  <div style={s('font-size:11px;font-weight:660;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3)')}>
                    {typeLabel(selItem.kind)}
                  </div>
                </div>
                <div style={s('border-radius:12px;overflow:hidden;border:.5px solid var(--line);background:var(--surface);margin-bottom:16px')}>
                  <Preview it={selItem} />
                </div>
                <div style={s('font-size:13px;font-weight:600;letter-spacing:-.01em;line-height:1.35;margin-bottom:14px')}>
                  {selItem.title}
                </div>
                <div style={s('display:flex;flex-direction:column;gap:9px')}>
                  {[
                    ['Source', selItem.app],
                    ['Copied', relTime(selItem.ts) + ' ago'],
                    [meta.label, meta.value],
                  ].map(([k, v]) => (
                    <div key={k} style={s('display:flex;justify-content:space-between;font-size:11.5px')}>
                      <span style={{ color: 'var(--text-3)' }}>{k}</span>
                      <span style={{ color: 'var(--text-2)', fontWeight: 520 }}>{v}</span>
                    </div>
                  ))}
                </div>
                {selItem.secret && (
                  <div style={s('display:flex;flex-wrap:wrap;gap:6px;margin-top:16px')}>
                    <span style={s('font-size:11px;font-weight:540;color:var(--red);background:rgba(255,69,58,.12);padding:4px 9px;border-radius:7px')}>
                      secret
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div style={s('height:.5px;background:var(--line)')} />

        {/* footer kbd hints */}
        <div style={s('display:flex;align-items:center;justify-content:space-between;padding:9px 16px;background:var(--glass-2)')}>
          <div style={s('display:flex;align-items:center;gap:16px')}>
            <KeyHint keys="↑↓" label="Navigate" />
            <KeyHint keys="↵" label="Copy" />
            <KeyHint keys={isMac ? '⌘F' : 'Ctrl+F'} label="Pin" />
          </div>
          <button
            onClick={copyAndClose}
            style={s('border:0;cursor:pointer;font:inherit;font-size:11.5px;font-weight:600;color:#fff;background:var(--accent);padding:6px 14px;border-radius:8px;display:flex;align-items:center;gap:7px;box-shadow:var(--shadow-sm)')}
          >
            Copy
            <span style={s('font-family:ui-monospace,monospace;opacity:.8')}>↵</span>
          </button>
        </div>
        <div style={s('height:.5px;background:var(--line)')} />
        <div style={s('text-align:center;padding:8px 16px;font-size:11px;color:var(--text-3);font-weight:500;background:var(--glass-2)')}>
          Invoked with{' '}
          <span style={s('font-family:ui-monospace,monospace;font-weight:640;color:var(--text-2)')}>{hotkey}</span>{' '}
          — copies the item and closes instantly
        </div>
      </div>
    </div>
  )
}
