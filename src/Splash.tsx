import { useEffect, useRef, useState } from 'react'

import { s } from './lib'

/** A short native-feeling launch beat, without delaying a fast startup. */
const MIN_MS = 700
/** Splash fade-out and app fade-in run together, so they share this. */
export const FADE_MS = 280

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
        transform: leaving ? 'scale(1.018)' : 'none',
        transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
        pointerEvents: leaving ? 'none' : 'auto',
      }}
    >
      <div style={s('position:absolute;inset:0;background:radial-gradient(circle at 50% 42%,var(--sel),transparent 38%)')} />

      <div style={s('position:relative;display:flex;flex-direction:column;align-items:center')}>
        <img
          src="/mark.svg"
          width={78}
          height={78}
          alt=""
          style={s('display:block;border-radius:18px;box-shadow:0 14px 35px -14px rgba(0,0,0,.45);animation:splashIcon .5s cubic-bezier(.2,.8,.2,1) both')}
        />

        <div style={s('text-align:center;margin-top:17px;animation:fadeUp .35s .12s both')}>
          <div style={s('font-size:21px;font-weight:680;letter-spacing:-.025em')}>Stash</div>
          <div style={s('font-size:12px;color:var(--text-3);font-weight:500;margin-top:5px')}>
            Everything you copy, kept
          </div>
        </div>

        <div style={s('width:112px;height:2px;border-radius:2px;background:var(--surface-3);overflow:hidden;margin-top:22px;animation:fadeUp .35s .2s both')}>
          <div style={s('width:42%;height:100%;border-radius:2px;background:var(--accent);animation:loadBar .9s cubic-bezier(.65,0,.35,1) infinite')} />
        </div>
      </div>
    </div>
  )
}
