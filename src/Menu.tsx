import { useRef, useState, type ReactNode } from 'react'

import {
  copyItem, hideSelf, isMac, quitApp, saveSettings, showMain, showQuick, useFitWindow,
  type Loaded,
} from './api'
import { collViewId, menuFilter, relTime, s } from './lib'
import { IconBox, SearchIcon } from './ui'

/**
 * Icon-only action. Names itself in the strip's label while hovered; `title`
 * stays as the fallback for anyone who pauses on it.
 */
function IconAction({
  label, onHint, onClick, tint = 'var(--text-2)', hot: hotTint, children,
}: {
  label: string
  onHint: (label: string | null) => void
  onClick: () => void
  tint?: string
  hot?: string
  children: ReactNode
}) {
  const [hot, setHot] = useState(false)
  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => {
        setHot(true)
        onHint(label)
      }}
      onMouseLeave={() => {
        setHot(false)
        onHint(null)
      }}
      style={{
        ...s('width:36px;height:30px;border:0;border-radius:9px;cursor:pointer;display:grid;place-items:center;flex:none;transition:background .15s ease,box-shadow .15s ease,transform .15s ease'),
        background: hot ? 'var(--surface)' : 'transparent',
        boxShadow: hot ? 'var(--shadow-sm)' : 'none',
        transform: hot ? 'translateY(-1px)' : 'none',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke={hot ? (hotTint ?? 'var(--text)') : tint}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: 'stroke .15s ease' }}
      >
        {children}
      </svg>
    </button>
  )
}

/** The tray popover. Anchored under the tray icon by the Rust side. */
export default function Menu({ loaded }: { loaded: Loaded }) {
  const { store } = loaded
  const { settings } = store
  const paused = settings.paused

  const row = s('display:flex;align-items:center;gap:9px;padding:5px 9px;border-radius:7px;cursor:pointer')
  const rowLabel = s('flex:1;font-size:12.5px;font-weight:520')
  const shortcut = s('font-family:ui-monospace,monospace;font-size:10.5px;color:var(--text-3)')

  // Whatever the user picked in Settings; falls back to the newest items. A
  // collection that has since been deleted falls back too, rather than showing
  // an empty list under a name that no longer exists.
  const view = settings.menuView ?? 'Recent'
  const colls = store.collections ?? []
  const picks = settings.menuColls ?? []
  const legacy = colls.find((c) => c.id === collViewId(view))
  const live = collViewId(view) != null && !legacy ? 'Recent' : view
  const listed = menuFilter(store.items, live, picks).slice(0, 4)
  // One collection selected names itself; several keep the generic heading.
  const only = picks.length === 1 ? colls.find((c) => c.id === picks[0]) : undefined
  const heading = legacy?.name ?? (view === 'Collections' ? only?.name ?? 'Collections' : live)

  const [hint, setHint] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  useFitWindow(panel)

  const copyAndClose = async (id: number) => {
    await copyItem(id)
    await hideSelf()
  }

  return (
    <div
      ref={panel}
      style={s('width:300px;background:var(--glass);border:.5px solid var(--line);border-radius:14px;overflow:hidden;animation:popIn .2s cubic-bezier(.32,.72,0,1);transform-origin:top right')}
    >
      <div style={s('padding:10px 12px 9px;display:flex;align-items:center;gap:9px;border-bottom:.5px solid var(--line)')}>
        <img src="/mark.svg" width={26} height={26} alt="" style={s('display:block;border-radius:6px;flex:none')} />
        <div style={{ flex: 1 }}>
          <div style={s('font-size:13px;font-weight:640;letter-spacing:-.01em')}>Stash</div>
          <div style={s('font-size:11px;color:var(--text-2)')}>
            {store.items.length.toLocaleString()} items · {paused ? 'paused' : 'recording'}
          </div>
        </div>
        <div
          style={{
            ...s('width:7px;height:7px;border-radius:50%'),
            background: paused ? 'var(--orange)' : 'var(--green)',
            boxShadow: paused ? '0 0 0 3px rgba(255,159,10,.18)' : '0 0 0 3px rgba(48,209,88,.18)',
          }}
        />
      </div>

      <div style={{ padding: 5 }}>
        <div className="mi" onClick={() => void showQuick()} style={row}>
          <SearchIcon size={15} stroke="var(--text-2)" width={1.7} />
          <span style={rowLabel}>Quick Search</span>
          <span style={shortcut}>{isMac ? '⌘⇧V' : 'Ctrl+Shift+V'}</span>
        </div>
      </div>
      <div style={s('height:.5px;background:var(--line);margin:2px 12px')} />

      <div style={{ padding: 5 }}>
        <div style={s('font-size:10px;font-weight:640;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3);padding:4px 9px 4px')}>
          {heading}
        </div>
        {listed.map((it) => (
          <div
            key={it.id}
            className="mi"
            onClick={() => void copyAndClose(it.id)}
            style={s('display:flex;align-items:center;gap:9px;padding:5px 9px;border-radius:7px;cursor:pointer')}
          >
            <IconBox it={it} size={21} radius={6} icon={12} />
            <span style={s('flex:1;min-width:0;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
              {it.title}
            </span>
            <span style={s('font-size:10px;color:var(--text-3)')}>{relTime(it.ts)}</span>
          </div>
        ))}
        {listed.length === 0 && (
          <div style={s('font-size:11.5px;color:var(--text-3);padding:4px 9px 7px')}>
            {live === 'Recent' ? 'Nothing captured yet' : `Nothing in ${heading} yet`}
          </div>
        )}
      </div>
      <div style={s('height:.5px;background:var(--line);margin:2px 12px')} />

      {/* Icon strip in a tray, the way Segmented already looks elsewhere. The
          label names whatever is under the cursor, so nothing is a guess. */}
      <div style={s('padding:9px 12px 11px;display:flex;align-items:center;gap:10px')}>
        <div style={s('display:flex;align-items:center;gap:2px;background:var(--surface-3);padding:3px;border-radius:12px;flex:none')}>
          <IconAction
            label={paused ? 'Resume recording' : 'Pause recording'}
            onHint={setHint}
            onClick={() => void saveSettings({ ...settings, paused: !paused })}
            tint={paused ? 'var(--orange)' : 'var(--text-2)'}
            hot={paused ? 'var(--green)' : 'var(--orange)'}
          >
            <path d={paused ? 'M8 5v14l11-7z' : 'M8 5v14M16 5v14'} />
          </IconAction>

          <IconAction label="Open Stash" onHint={setHint} onClick={() => void showMain()} hot="var(--accent)">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18" />
          </IconAction>

          <IconAction label="Settings  ⌘," onHint={setHint} onClick={() => void showMain('Settings')} hot="var(--accent)">
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L16.5 2h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-.9-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5c.06-.33.1-.66.1-1z" />
          </IconAction>

          {/* Quit sits behind a hairline so it isn't the neighbour of Settings. */}
          <div style={s('width:1px;height:17px;background:var(--line);margin:0 4px;flex:none')} />

          <IconAction label="Quit Stash  ⌘Q" onHint={setHint} onClick={() => void quitApp()} tint="var(--red)" hot="var(--red)">
            <path d="M9 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H9" />
          </IconAction>
        </div>

        {/* Empty until something is hovered — the header already carries the
            item count, and repeating it here was just noise. */}
        <span
          style={{
            ...s('flex:1;min-width:0;text-align:right;font-size:11.5px;font-weight:580;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .15s ease'),
            opacity: hint ? 1 : 0,
          }}
        >
          {hint ?? ''}
        </span>
      </div>
    </div>
  )
}
