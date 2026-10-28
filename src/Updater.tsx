import { useEffect, useRef, useState } from 'react'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'

import { s } from './lib'

const FIRST_CHECK_MS = 5_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1_000

/** Quietly checks in the background, prompting only when an update exists. */
export default function Updater() {
  const held = useRef<Update | null>(null)
  const checking = useRef(false)
  const [update, setUpdate] = useState<Update | null>(null)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const run = async () => {
      if (checking.current || held.current) return
      checking.current = true
      try {
        const found = await check()
        if (!alive) {
          await found?.close()
          return
        }
        if (found) {
          held.current = found
          setUpdate(found)
        }
      } catch {
        // Offline, a missing manifest, or GitHub being unavailable should
        // never interrupt launch. The next scheduled check simply tries again.
      } finally {
        checking.current = false
      }
    }

    const first = window.setTimeout(() => void run(), FIRST_CHECK_MS)
    const interval = window.setInterval(() => void run(), CHECK_EVERY_MS)
    return () => {
      alive = false
      window.clearTimeout(first)
      window.clearInterval(interval)
      void held.current?.close()
      held.current = null
    }
  }, [])

  if (!update) return null

  const later = async () => {
    await update.close()
    held.current = null
    setUpdate(null)
    setError('')
  }

  const install = async () => {
    setInstalling(true)
    setError('')
    setProgress(0)
    let downloaded = 0
    let total = 0
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? 0
        if (event.event === 'Progress') downloaded += event.data.chunkLength
        if (event.event === 'Finished') setProgress(100)
        else if (total > 0) setProgress(Math.min(99, Math.round((downloaded / total) * 100)))
      })
      await relaunch()
    } catch {
      setError('The update could not be installed. Check your connection and try again.')
      setInstalling(false)
    }
  }

  return (
    <div style={s('position:fixed;inset:0;z-index:115;display:grid;place-items:center;background:rgba(0,0,0,.28);padding:24px')}>
      <div style={s('width:min(440px,100%);background:var(--surface);border:.5px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:22px')}>
        <div style={s('display:flex;align-items:center;gap:13px')}>
          <img src="/mark.svg" width={46} height={46} alt="" style={s('border-radius:11px;box-shadow:var(--shadow-sm)')} />
          <div style={s('flex:1;min-width:0')}>
            <div style={s('font-size:16px;font-weight:670;letter-spacing:-.015em')}>Stash {update.version} is available</div>
            <div style={s('font-size:12px;color:var(--text-3);margin-top:3px')}>A new version is ready to install.</div>
          </div>
        </div>

        {update.body && (
          <div className="mem-scroll" style={s('max-height:180px;overflow-y:auto;white-space:pre-wrap;font-size:12.5px;line-height:1.55;color:var(--text-2);background:var(--surface-2);border-radius:10px;padding:12px 14px;margin-top:17px')}>
            {update.body}
          </div>
        )}

        {installing && (
          <div style={s('margin-top:17px')}>
            <div style={s('display:flex;justify-content:space-between;font-size:11.5px;color:var(--text-3);margin-bottom:7px')}>
              <span>{progress >= 100 ? 'Installing…' : 'Downloading update…'}</span>
              <span>{progress}%</span>
            </div>
            <div style={s('height:4px;border-radius:4px;background:var(--surface-3);overflow:hidden')}>
              <div style={{ width: `${progress}%`, height: '100%', borderRadius: 4, background: 'var(--accent)', transition: 'width .15s ease' }} />
            </div>
          </div>
        )}

        {error && <div style={s('font-size:12px;line-height:1.45;color:var(--red);margin-top:14px')}>{error}</div>}

        <div style={s('display:flex;justify-content:flex-end;gap:9px;margin-top:19px')}>
          <button
            disabled={installing}
            onClick={() => void later()}
            style={{
              ...s('border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:560;padding:8px 15px;border-radius:9px;color:var(--text-2);background:var(--surface-3)'),
              opacity: installing ? 0.55 : 1,
            }}
          >
            Later
          </button>
          <button disabled={installing} onClick={() => void install()} style={s('border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:620;padding:8px 16px;border-radius:9px;color:#fff;background:var(--accent)')}>
            {installing ? 'Updating…' : 'Update and restart'}
          </button>
        </div>
      </div>
    </div>
  )
}
