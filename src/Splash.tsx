import { useEffect, useRef, useState } from 'react'

import { s } from './lib'

/** Held long enough to read, even though the store loads almost instantly. */
const MIN_MS = 1100
const FADE_MS = 420

/** Launch screen for the main window. Removes itself once the store is in. */
export default function Splash({ ready }: { ready: boolean }) {
  const born = useRef(Date.now())
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!ready) return
    const wait = Math.max(0, MIN_MS - (Date.now() - born.current))
    const timer = setTimeout(() => setLeaving(true), wait)
    return () => clearTimeout(timer)
  }, [ready])

  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => setGone(true), FADE_MS)
    return () => clearTimeout(timer)
  }, [leaving])

  if (gone) return null

  return (
    <div
      style={{
        ...s('position:absolute;inset:0;z-index:120;display:grid;place-items:center;background:var(--surface)'),
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'scale(1.04)' : 'none',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <div style={s('display:flex;flex-direction:column;align-items:center;gap:18px;animation:popIn .5s cubic-bezier(.32,.72,0,1)')}>
        {/* The same mark the tray and menu header use. */}
        <div style={s('position:relative;width:72px;height:72px;border-radius:20px;background:var(--text);display:grid;place-items:center;box-shadow:var(--shadow)')}>
          <div style={s('width:26px;height:26px;border:3px solid var(--surface);border-radius:8px')} />
          <div
            style={s('position:absolute;inset:-6px;border-radius:26px;border:1px solid var(--accent);opacity:.35;animation:haloPulse 2s ease-in-out infinite')}
          />
        </div>

        <div style={s('text-align:center')}>
          <div style={s('font-size:21px;font-weight:700;letter-spacing:-.02em')}>Memory</div>
          <div style={s('font-size:12px;color:var(--text-3);font-weight:500;margin-top:3px')}>
            Everything you copy, kept
          </div>
        </div>

        <div style={s('width:132px;height:3px;border-radius:3px;background:var(--surface-3);overflow:hidden')}>
          <div style={s('width:45%;height:100%;border-radius:3px;background:var(--accent);animation:loadBar 1.15s cubic-bezier(.65,0,.35,1) infinite')} />
        </div>
      </div>
    </div>
  )
}
