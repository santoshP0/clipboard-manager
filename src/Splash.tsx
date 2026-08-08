import { useEffect, useRef, useState } from 'react'

import { s } from './lib'

/** Held long enough to read, even though the store loads almost instantly. */
const MIN_MS = 1250
/** Splash fade-out and app fade-in run together, so they share this. */
export const FADE_MS = 460

/** Launch screen for the main window. Removes itself once the store is in. */
export default function Splash({ ready, onLeave }: { ready: boolean; onLeave: () => void }) {
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
    onLeave()
    const timer = setTimeout(() => setGone(true), FADE_MS)
    return () => clearTimeout(timer)
  }, [leaving, onLeave])

  if (gone) return null

  return (
    <div
      style={{
        ...s('position:absolute;inset:0;z-index:120;display:grid;place-items:center;overflow:hidden;background:var(--surface)'),
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'scale(1.06)' : 'none',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms cubic-bezier(.32,.72,0,1)`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      {/* Ambient accent light, so the panel isn't a flat white rectangle. */}
      <div style={s('position:absolute;width:420px;height:420px;left:-120px;top:-140px;border-radius:50%;background:var(--accent);opacity:.13;filter:blur(90px);animation:drift 9s ease-in-out infinite')} />
      <div style={s('position:absolute;width:360px;height:360px;right:-110px;bottom:-130px;border-radius:50%;background:var(--accent);opacity:.10;filter:blur(90px);animation:drift 11s ease-in-out infinite reverse')} />

      <div style={s('position:relative;display:flex;flex-direction:column;align-items:center;gap:20px')}>
        <div style={s('position:relative;animation:markIn .75s cubic-bezier(.34,1.42,.5,1) both,float 3.6s .75s ease-in-out infinite')}>
          {/* The Dock icon itself, so launch and Dock read as one thing. */}
          {/* Radius matches the SVG's own corners, so box-shadow traces the icon. */}
          <img src="/mark.svg" width={88} height={88} alt="" style={s('display:block;border-radius:20px;box-shadow:var(--shadow)')} />
          <div style={s('position:absolute;inset:-9px;border-radius:31px;border:1px solid var(--accent);animation:haloPulse 2.4s ease-in-out infinite')} />
        </div>

        <div style={s('text-align:center;animation:fadeUp .5s .3s both')}>
          <div style={s('font-size:22px;font-weight:700;letter-spacing:-.022em')}>Memory</div>
          <div style={s('font-size:12px;color:var(--text-3);font-weight:500;margin-top:4px;letter-spacing:-.005em')}>
            Everything you copy, kept
          </div>
        </div>

        <div style={s('width:132px;height:3px;border-radius:3px;background:var(--surface-3);overflow:hidden;animation:fadeUp .5s .45s both')}>
          <div style={s('width:45%;height:100%;border-radius:3px;background:var(--accent);animation:loadBar 1.15s cubic-bezier(.65,0,.35,1) infinite')} />
        </div>
      </div>
    </div>
  )
}
