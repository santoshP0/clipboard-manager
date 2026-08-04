import type { ReactNode } from 'react'

import { thumbUrl } from './api'
import { KEY_STYLE, iconPath, s, tint, tintColor, type Item } from './lib'

const SHIMMER = 'linear-gradient(90deg,var(--surface-3) 25%,var(--surface) 50%,var(--surface-3) 75%)'

export const SearchIcon = ({ size = 19, stroke = 'var(--text-3)', width = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </svg>
)

export function KeyHint({ keys, label }: { keys: string; label: string }) {
  return (
    <div style={s('display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-2)')}>
      <span style={s(KEY_STYLE)}>{keys}</span>
      {label}
    </div>
  )
}

export function IconBox({
  it, size, radius, icon, border = true,
}: {
  it: Item; size: number; radius: number; icon: number; border?: boolean
}) {
  const fill =
    it.kind === 'color' ? it.value ?? undefined : it.kind === 'image' ? thumbUrl(it) : undefined

  return (
    <div
      style={{
        flex: 'none',
        width: size,
        height: size,
        borderRadius: radius,
        background: tint(it.kind),
        display: 'grid',
        placeItems: 'center',
        color: tintColor(it.kind),
        overflow: 'hidden',
        ...(border ? { border: '.5px solid var(--line-2)' } : null),
      }}
    >
      {fill ? (
        <div style={{ width: '100%', height: '100%', background: fill, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      ) : (
        <svg
          width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d={iconPath(it.kind)} />
        </svg>
      )}
    </div>
  )
}

/** Very small syntax tint for the code preview. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = []
  const re =
    /(\/\/.*$|#.*$)|('[^']*'|"[^"]*"|`[^`]*`)|\b(const|let|var|function|return|import|from|export|class|if|else|for|while|await|async|def|fn|pub|use)\b|([{}()[\];:,.])/g
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index))
    let color = 'inherit'
    if (m[1]) color = 'var(--text-3)'
    else if (m[2]) color = 'var(--green)'
    else if (m[3]) color = 'var(--purple)'
    else if (m[4]) color = 'var(--text-3)'
    out.push(
      <span key={k++} style={{ color }}>
        {m[0]}
      </span>,
    )
    last = re.lastIndex
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

/** Rich preview of the selected item, used by both inspectors. */
export function Preview({ it }: { it?: Item }) {
  if (!it) return null

  if (it.kind === 'color')
    return (
      <div style={{ height: 96, background: it.value ?? undefined, display: 'flex', alignItems: 'flex-end', padding: 10 }}>
        <span style={s('font-family:ui-monospace,monospace;font-size:12px;font-weight:640;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.4)')}>
          {it.value}
        </span>
      </div>
    )

  if (it.kind === 'image')
    return (
      <div
        style={{
          height: 140,
          background: thumbUrl(it),
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    )

  if (it.kind === 'code')
    return (
      <div style={s('padding:12px 14px;font-family:ui-monospace,SF Mono,monospace;font-size:11.5px;line-height:1.65;background:var(--surface-2);max-height:150px;overflow:auto')}>
        {(it.body || '').split('\n').map((ln, i) => (
          <div key={i} style={{ whiteSpace: 'pre', color: 'var(--text)' }}>
            {highlight(ln)}
          </div>
        ))}
      </div>
    )

  if (it.kind === 'link')
    return (
      <div style={s('padding:14px;display:flex;align-items:center;gap:10px')}>
        <div style={s('width:32px;height:32px;border-radius:8px;background:var(--sel);color:var(--accent);display:grid;place-items:center;font-weight:700;font-size:14px')}>
          {(it.title || 'L')[0].toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={s('font-size:12.5px;font-weight:560;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
            {it.title}
          </div>
          <div style={s('font-size:11px;color:var(--accent);font-family:ui-monospace,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
            {it.url}
          </div>
        </div>
      </div>
    )

  if (it.kind === 'file') {
    const ext = (it.path || '').split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'
    return (
      <div style={s('padding:16px;display:flex;align-items:center;gap:12px')}>
        <div style={s('width:38px;height:44px;border-radius:6px;background:var(--surface-2);border:.5px solid var(--line);display:grid;place-items:center;color:var(--orange);font-size:9px;font-weight:800')}>
          {ext}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={s('font-size:12.5px;font-weight:560')}>{it.title}</div>
          <div style={s('font-size:11px;color:var(--text-3)')}>{it.size}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s('padding:14px;font-size:12.5px;line-height:1.6;color:var(--text);white-space:pre-wrap;max-height:150px;overflow:auto')}>
      {it.body}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * states — the design's Empty / Loading / Error panels, used for real
 * ------------------------------------------------------------------ */

export function EmptyClipboard({ hotkey }: { hotkey: string }) {
  return (
    <div style={s('height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:0 40px')}>
      <div style={s('width:56px;height:56px;border-radius:16px;background:var(--surface);border:.5px solid var(--line);display:grid;place-items:center')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="8" y="4" width="12" height="16" rx="2" />
          <path d="M4 8v12a2 2 0 0 0 2 2h8" />
        </svg>
      </div>
      <div style={s('font-size:15px;font-weight:620;letter-spacing:-.01em')}>Your clipboard is clear</div>
      <div style={s('font-size:12.5px;color:var(--text-2);line-height:1.5;max-width:250px')}>
        Copy anything and it appears here instantly. Press{' '}
        <span style={s('font-family:ui-monospace,monospace;font-weight:640;color:var(--text)')}>{hotkey}</span>{' '}
        to reopen Memory anytime.
      </div>
    </div>
  )
}

export function NoMatches({ seg, q }: { seg: string; q: string }) {
  return (
    <div style={s('height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 40px;text-align:center')}>
      <div style={s('width:54px;height:54px;border-radius:15px;background:var(--surface-3);display:grid;place-items:center')}>
        <SearchIcon size={24} width={1.6} />
      </div>
      <div style={s('font-size:15px;font-weight:600;letter-spacing:-.01em')}>No matches</div>
      <div style={s('font-size:12.5px;color:var(--text-2);line-height:1.5;max-width:230px')}>
        Nothing in <b style={{ color: 'var(--text)' }}>{seg}</b> matches “{q}”. Try a different term or segment.
      </div>
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div style={s('height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:0 40px')}>
      <div style={s('width:56px;height:56px;border-radius:16px;background:rgba(255,69,58,.12);display:grid;place-items:center')}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      </div>
      <div style={s('font-size:15px;font-weight:620;letter-spacing:-.01em')}>Couldn’t reach the clipboard service</div>
      <div style={s('font-size:12.5px;color:var(--text-2);line-height:1.5;max-width:260px')}>
        Memory’s background process isn’t responding. Retry, or restart the app.
      </div>
      <div style={s('display:flex;gap:9px;margin-top:2px')}>
        <button
          onClick={onRetry}
          style={s('border:0;cursor:pointer;font:inherit;font-size:12.5px;font-weight:600;color:#fff;background:var(--accent);padding:8px 16px;border-radius:9px')}
        >
          Retry
        </button>
      </div>
    </div>
  )
}

const SKELETONS = [
  { w1: '60%', w2: '38%' }, { w1: '45%', w2: '55%' },
  { w1: '70%', w2: '30%' }, { w1: '52%', w2: '42%' },
]

export function LoadingRows() {
  const bar = (h: number, w: string) => ({
    height: h, width: w, borderRadius: 5, background: SHIMMER,
    backgroundSize: '320px 100%', animation: 'shimmer 1.4s infinite linear',
  })
  return (
    <div style={s('padding:14px;display:flex;flex-direction:column;gap:10px')}>
      {SKELETONS.map((k, i) => (
        <div key={i} style={s('display:flex;align-items:center;gap:12px;padding:6px 4px')}>
          <div style={{ flex: 'none', ...bar(36, '36px'), borderRadius: 10 }} />
          <div style={s('flex:1;display:flex;flex-direction:column;gap:7px')}>
            <div style={bar(11, k.w1)} />
            <div style={bar(9, k.w2)} />
          </div>
        </div>
      ))}
      <div style={s('margin-top:auto;display:flex;align-items:center;gap:8px;justify-content:center;color:var(--text-3);font-size:12px')}>
        <div style={s('width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite')} />
        Loading history…
      </div>
    </div>
  )
}
