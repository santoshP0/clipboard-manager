import { useEffect, useRef, useState, type ReactNode } from 'react'

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
  const swatch = it.kind === 'color' ? it.value ?? undefined : undefined
  const image = it.kind === 'image' ? thumbUrl(it) : undefined

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
      {swatch || image ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: swatch,
            backgroundImage: image,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
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
          backgroundImage: thumbUrl(it),
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: 'var(--surface-2)',
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
        to reopen Stash anytime.
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
        Stash’s background process isn’t responding. Retry, or restart the app.
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

/* ------------------------------------------------------------------ *
 * settings controls
 * ------------------------------------------------------------------ */

/** Multi-option switch: every choice visible, current one raised. */
export function Segmented({
  options, value, onChange,
}: {
  options: readonly string[]; value: string; onChange: (next: string) => void
}) {
  return (
    <div style={s('flex:none;display:flex;gap:2px;background:var(--surface-3);padding:3px;border-radius:9px')}>
      {options.map((option) => {
        const on = option === value
        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            style={{
              ...s('border:0;cursor:pointer;font:inherit;font-size:11.5px;font-weight:560;padding:5px 10px;border-radius:6.5px;white-space:nowrap;transition:all .18s ease'),
              color: on ? 'var(--text)' : 'var(--text-2)',
              background: on ? 'var(--surface)' : 'transparent',
              boxShadow: on ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Settings dropdown, for choices that grow at runtime — Segmented lays its
 * options out side by side and falls apart past three or four.
 */
export type Option = { value: string; label: string; dot?: string }

/** Open/close plumbing shared by the pickers: outside click and Escape. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return { open, setOpen, box }
}

const TRIGGER =
  'display:flex;align-items:center;gap:7px;border:.5px solid var(--line);cursor:pointer;font:inherit;font-size:11.5px;font-weight:560;padding:6px 9px 6px 11px;border-radius:9px;background:var(--surface);color:var(--text);min-width:132px'
const MENU =
  'position:absolute;top:calc(100% + 6px);right:0;z-index:40;min-width:100%;max-height:240px;overflow-y:auto;padding:5px;background:var(--glass);border:.5px solid var(--line);border-radius:10px;box-shadow:var(--shadow);animation:popIn .14s cubic-bezier(.32,.72,0,1);transform-origin:top right'
const MENU_ROW =
  'display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;cursor:pointer;font:inherit;font-size:12px;font-weight:520;color:var(--text);padding:7px 9px;border-radius:7px;text-align:left;white-space:nowrap'

const Tick = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12l5 5L20 7" />
  </svg>
)

const Chevron = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

export function Picker({
  options, value, onChange,
}: {
  options: Option[]
  value: string
  onChange: (next: string) => void
}) {
  const { open, setOpen, box } = usePopover()
  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <div ref={box} style={s('position:relative;flex:none')}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...s(TRIGGER),
          borderColor: open ? 'var(--accent)' : 'var(--line)',
          boxShadow: open ? '0 0 0 3px var(--sel)' : 'var(--shadow-sm)',
        }}
      >
        {current?.dot && (
          <span style={{ ...s('width:7px;height:7px;border-radius:50%;flex:none'), background: current.dot }} />
        )}
        <span style={s('flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
          {current?.label}
        </span>
        <Chevron />
      </button>

      {open && (
        <div className="mem-scroll" style={s(MENU)}>
          {options.map((option) => (
            <button
              key={option.value}
              className="mi"
              onClick={() => {
                setOpen(false)
                onChange(option.value)
              }}
              style={s(MENU_ROW)}
            >
              {option.dot && (
                <span style={{ ...s('width:7px;height:7px;border-radius:50%;flex:none'), background: option.dot }} />
              )}
              <span style={s('flex:1;overflow:hidden;text-overflow:ellipsis')}>{option.label}</span>
              {option.value === value && <Tick />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Same dropdown, but the rows toggle. An empty selection reads as "all", which
 * is what you want for a filter — a new collection is included by default
 * instead of silently missing.
 */
export function MultiPicker({
  options, values, onChange, allLabel = 'All', noun = 'selected',
}: {
  options: Option[]
  values: string[]
  onChange: (next: string[]) => void
  allLabel?: string
  noun?: string
}) {
  const { open, setOpen, box } = usePopover()
  const chosen = options.filter((o) => values.includes(o.value))
  const label =
    chosen.length === 0 ? allLabel : chosen.length === 1 ? chosen[0].label : `${chosen.length} ${noun}`

  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])

  return (
    <div ref={box} style={s('position:relative;flex:none')}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...s(TRIGGER),
          borderColor: open ? 'var(--accent)' : 'var(--line)',
          boxShadow: open ? '0 0 0 3px var(--sel)' : 'var(--shadow-sm)',
        }}
      >
        {chosen.length === 1 && chosen[0].dot && (
          <span style={{ ...s('width:7px;height:7px;border-radius:50%;flex:none'), background: chosen[0].dot }} />
        )}
        <span style={s('flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis')}>
          {label}
        </span>
        <Chevron />
      </button>

      {open && (
        <div className="mem-scroll" style={s(MENU)}>
          <button className="mi" onClick={() => onChange([])} style={s(MENU_ROW)}>
            <span style={s('flex:1;overflow:hidden;text-overflow:ellipsis')}>{allLabel}</span>
            {values.length === 0 && <Tick />}
          </button>
          {options.length > 0 && <div style={s('height:.5px;background:var(--line);margin:4px 4px')} />}
          {options.map((option) => (
            <button key={option.value} className="mi" onClick={() => toggle(option.value)} style={s(MENU_ROW)}>
              {option.dot && (
                <span style={{ ...s('width:7px;height:7px;border-radius:50%;flex:none'), background: option.dot }} />
              )}
              <span style={s('flex:1;overflow:hidden;text-overflow:ellipsis')}>{option.label}</span>
              {values.includes(option.value) && <Tick />}
            </button>
          ))}
          {options.length === 0 && (
            <div style={s('font-size:11.5px;color:var(--text-3);padding:6px 9px')}>No collections yet</div>
          )}
        </div>
      )}
    </div>
  )
}

/** Same switch, but the choices are the colours themselves. */
export function SwatchPicker({
  options, value, onChange, names,
}: {
  options: readonly string[]
  value: string
  onChange: (next: string) => void
  names: Record<string, string>
}) {
  return (
    <div style={s('flex:none;display:flex;gap:4px;background:var(--surface-3);padding:4px;border-radius:9px')}>
      {options.map((color) => {
        const on = color === value
        return (
          <button
            key={color}
            title={names[color] ?? color}
            onClick={() => onChange(color)}
            style={{
              width: 18,
              height: 18,
              padding: 0,
              border: 0,
              borderRadius: '50%',
              cursor: 'pointer',
              background: color,
              transition: 'box-shadow .18s ease',
              boxShadow: on ? '0 0 0 2px var(--surface-3), 0 0 0 3.5px ' + color : 'none',
            }}
          />
        )
      })}
    </div>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div
      onClick={onChange}
      style={{
        ...s('flex:none;width:40px;height:24px;border-radius:20px;padding:2px;cursor:pointer;transition:background .2s ease;display:flex'),
        background: on ? 'var(--accent)' : 'var(--surface-3)',
        justifyContent: on ? 'flex-end' : 'flex-start',
      }}
    >
      <div style={s('width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:all .2s ease')} />
    </div>
  )
}

/** Finder's multi-selection look: the picked items fanned out as a stack. */
export function StackPreview({ items }: { items: Item[] }) {
  const shown = items.slice(0, 4)
  const angles = [10, -7, 4, -12]

  return (
    <div style={s('position:relative;height:150px;display:grid;place-items:center;margin-bottom:14px')}>
      {shown.map((it, i) => {
        const image = it.kind === 'image' ? thumbUrl(it) : undefined
        // Last drawn sits on top and straightest, like a dropped pile.
        const depth = shown.length - 1 - i
        return (
          <div
            key={it.id}
            style={{
              position: 'absolute',
              width: 116,
              height: 84,
              borderRadius: 8,
              overflow: 'hidden',
              display: 'grid',
              placeItems: 'center',
              border: '.5px solid var(--line)',
              background: it.kind === 'color' ? (it.value ?? undefined) : 'var(--surface)',
              backgroundImage: image,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              boxShadow: 'var(--shadow-sm)',
              transform: `rotate(${angles[depth % angles.length]}deg) translate(${depth * -4}px, ${depth * -3}px)`,
              zIndex: i,
            }}
          >
            {!image && it.kind !== 'color' && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={tintColor(it.kind)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={iconPath(it.kind)} />
              </svg>
            )}
          </div>
        )
      })}
    </div>
  )
}
