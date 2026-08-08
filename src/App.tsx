import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { label, useStore, useToast } from './api'
import Full from './Full'
import Menu from './Menu'
import Quick from './Quick'
import Splash, { FADE_MS } from './Splash'
import { hexA, s } from './lib'
import { ErrorState } from './ui'

/** Resolves settings.theme, following the OS when it says "system". */
function useTheme(preference: string) {
  const [system, setSystem] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return preference === 'system' ? system : preference
}

export default function App() {
  const loaded = useStore()
  const { toast, fire, dismiss } = useToast()
  const [revealed, setRevealed] = useState(false)
  const reveal = useCallback(() => setRevealed(true), [])
  const { settings } = loaded.store
  const theme = useTheme(settings.theme)

  const accent = {
    '--accent': settings.accent,
    '--accent-2': settings.accent,
    '--sel': hexA(settings.accent, theme === 'dark' ? 0.22 : 0.12),
    '--sel-strong': hexA(settings.accent, theme === 'dark' ? 0.28 : 0.16),
  } as React.CSSProperties

  // Each window is its own frameless panel, so the page itself stays transparent.
  const layout: Record<string, string> = {
    quick: 'display:block',
    menu: 'display:block',
    main: 'padding:0',
  }

  return (
    <div
      data-theme={theme}
      style={{
        ...s('position:fixed;inset:0;background:transparent;color:var(--text);overflow:hidden'),
        ...s(layout[label] ?? layout.main),
        ...accent,
      }}
    >
      {loaded.state === 'error' ? (
        <div style={s('width:420px;height:300px;background:var(--surface);border:.5px solid var(--line);border-radius:14px;box-shadow:var(--shadow)')}>
          <ErrorState onRetry={() => window.location.reload()} />
        </div>
      ) : label === 'quick' ? (
        <Quick loaded={loaded} fire={fire} />
      ) : label === 'menu' ? (
        <Menu loaded={loaded} />
      ) : (
        <>
          {/* Crossfade: the app scales up as the splash scales past it. */}
          <div
            style={{
              ...s('height:100%'),
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'none' : 'scale(.97)',
              transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms cubic-bezier(.32,.72,0,1)`,
            }}
          >
            <Full loaded={loaded} fire={fire} />
          </div>
          <Splash ready={loaded.state !== 'loading'} onLeave={reveal} />
        </>
      )}

      {/* Portalled to the body so panel layout changes — the inspector
          appearing or vanishing as items are deleted — can't shift it. */}
      {toast && createPortal(
        <div style={s('position:fixed;bottom:32px;left:50%;transform:translateX(-50%);z-index:80;display:flex;align-items:center;gap:10px;padding:11px 18px;background:var(--glass);backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);border:.5px solid var(--line);border-radius:12px;box-shadow:var(--shadow);animation:toastIn .2s cubic-bezier(.32,.72,0,1)')}>
          <div style={s('width:20px;height:20px;border-radius:50%;background:var(--green);display:grid;place-items:center')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <span style={s('font-size:13px;font-weight:560;letter-spacing:-.01em')}>{toast.msg}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.run()
                dismiss()
              }}
              style={s('margin-left:4px;border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:640;color:var(--accent);background:var(--sel);padding:5px 11px;border-radius:8px')}
            >
              {toast.action.label}
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
