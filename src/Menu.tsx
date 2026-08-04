import {
  copyItem, hideSelf, isMac, quitApp, saveSettings, showMain, showQuick, type Loaded,
} from './api'
import { relTime, s } from './lib'
import { IconBox, SearchIcon } from './ui'

/** The tray popover. Anchored under the tray icon by the Rust side. */
export default function Menu({ loaded }: { loaded: Loaded }) {
  const { store } = loaded
  const { settings } = store
  const paused = settings.paused

  const row = s('display:flex;align-items:center;gap:11px;padding:9px 11px;border-radius:9px;cursor:pointer')
  const rowLabel = s('flex:1;font-size:13px;font-weight:520')
  const shortcut = s('font-family:ui-monospace,monospace;font-size:11px;color:var(--text-3)')

  const copyAndClose = async (id: number) => {
    await copyItem(id)
    await hideSelf()
  }

  return (
    <div style={s('width:300px;background:var(--glass);backdrop-filter:blur(50px) saturate(190%);-webkit-backdrop-filter:blur(50px) saturate(190%);border:.5px solid var(--line);border-radius:14px;box-shadow:var(--shadow);overflow:hidden;animation:popIn .2s cubic-bezier(.32,.72,0,1);transform-origin:top right')}>
      <div style={s('padding:13px 16px 11px;display:flex;align-items:center;gap:10px;border-bottom:.5px solid var(--line)')}>
        <div style={s('width:26px;height:26px;border-radius:8px;background:var(--text);display:grid;place-items:center')}>
          <div style={s('width:10px;height:10px;border:1.8px solid var(--surface);border-radius:3px')} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={s('font-size:13px;font-weight:640;letter-spacing:-.01em')}>Memory</div>
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

      <div style={{ padding: 6 }}>
        <div className="mi" onClick={() => void showQuick()} style={row}>
          <SearchIcon size={17} stroke="var(--text-2)" width={1.7} />
          <span style={rowLabel}>Quick Search</span>
          <span style={shortcut}>{isMac ? '⌘⇧V' : 'Ctrl+Shift+V'}</span>
        </div>
      </div>
      <div style={s('height:.5px;background:var(--line);margin:2px 12px')} />

      <div style={{ padding: 6 }}>
        <div style={s('font-size:10.5px;font-weight:640;letter-spacing:.04em;text-transform:uppercase;color:var(--text-3);padding:6px 11px 5px')}>
          Recent
        </div>
        {store.items.slice(0, 4).map((it) => (
          <div
            key={it.id}
            className="mi"
            onClick={() => void copyAndClose(it.id)}
            style={s('display:flex;align-items:center;gap:11px;padding:8px 11px;border-radius:9px;cursor:pointer')}
          >
            <IconBox it={it} size={24} radius={7} icon={13} />
            <span style={s('flex:1;min-width:0;font-size:12.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
              {it.title}
            </span>
            <span style={s('font-size:10.5px;color:var(--text-3)')}>{relTime(it.ts)}</span>
          </div>
        ))}
        {store.items.length === 0 && (
          <div style={s('font-size:12px;color:var(--text-3);padding:6px 11px 10px')}>Nothing captured yet</div>
        )}
      </div>
      <div style={s('height:.5px;background:var(--line);margin:2px 12px')} />

      <div style={{ padding: 6 }}>
        <div
          className="mi"
          onClick={() => void saveSettings({ ...settings, paused: !paused })}
          style={row}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.7" strokeLinecap="round">
            <path d={paused ? 'M8 5v14l11-7z' : 'M8 5v14M16 5v14'} />
          </svg>
          <span style={rowLabel}>{paused ? 'Resume Recording' : 'Pause Recording'}</span>
        </div>

        <div className="mi" onClick={() => void showMain()} style={row}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18" />
          </svg>
          <span style={rowLabel}>Open Memory…</span>
        </div>

        <div className="mi" onClick={() => void showMain('Settings')} style={row}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L16.5 2h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-.9-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5c.06-.33.1-.66.1-1z" />
          </svg>
          <span style={rowLabel}>Settings…</span>
          <span style={shortcut}>⌘,</span>
        </div>

        <div className="mi" onClick={() => void quitApp()} style={row}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.7" strokeLinecap="round">
            <path d="M9 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span style={{ ...rowLabel, color: 'var(--red)' }}>Quit Memory</span>
          <span style={shortcut}>⌘Q</span>
        </div>
      </div>
    </div>
  )
}
