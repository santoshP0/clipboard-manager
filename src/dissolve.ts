/**
 * Particle dissolve for deleted rows — the ParticleScroll look, built from the
 * element's own geometry and colours (html-in-canvas isn't available in WebKit).
 *
 * Self-contained on purpose: it owns its canvas and loop instead of pairing a
 * module-level singleton with a React layer, which HMR could split in two.
 */

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  delay: number
  life: number
  age: number
  color: string
}

/** Seconds a grain lives once it starts moving. */
const LIFE = 3.2
/** Slow fall so the dust drifts down rather than dropping out of frame. */
const GRAVITY = 55
const CANVAS_ID = 'memory-dissolve-layer'

let particles: Particle[] = []
let running = false
let last = 0

function layer(): CanvasRenderingContext2D | null {
  let canvas = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.id = CANVAS_ID
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483647'
    document.body.appendChild(canvas)
    window.addEventListener('resize', () => sizeTo(canvas as HTMLCanvasElement))
  }
  sizeTo(canvas)
  return canvas.getContext('2d')
}

function sizeTo(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.round(window.innerWidth * dpr)
  const h = Math.round(window.innerHeight * dpr)
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function frame(now: number) {
  const ctx = layer()
  if (!ctx) {
    running = false
    return
  }
  const gap = (now - last) / 1000
  last = now
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

  // No frames arrive while the window is minimised or the machine sleeps. A
  // long gap means this dust would have settled while we were away, so drop it
  // rather than resuming the burst mid-flight on restore.
  if (gap > 0.4) {
    particles = []
    running = false
    return
  }
  const dt = Math.min(gap, 1 / 30)

  let alive = 0
  for (const p of particles) {
    if (p.delay > 0) {
      p.delay -= dt
      alive++
      continue
    }
    p.age += dt
    if (p.age >= p.life) continue
    alive++
    p.vy += GRAVITY * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    // Hold near full opacity, then fall away late in the grain's life.
    ctx.globalAlpha = Math.min(1, (1 - p.age / p.life) * 2.2)
    ctx.fillStyle = p.color
    ctx.fillRect(p.x, p.y, p.size, p.size)
  }
  ctx.globalAlpha = 1

  if (!alive) {
    particles = []
    running = false
    return
  }
  requestAnimationFrame(frame)
}

/** Scatter an element into dust. Call before the element leaves the DOM. */
export function dissolveElement(el: HTMLElement, colors: string[]) {
  const rect = el.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return

  // Canvas fillStyle can't parse var(--x); resolve against the element first.
  const styles = getComputedStyle(el)
  const palette = colors.map((c) =>
    c.startsWith('var(') ? styles.getPropertyValue(c.slice(4, -1)).trim() || '#fff' : c,
  )

  // One grain per ~14px²: dense enough that the row visibly turns to dust.
  const count = Math.min(2200, Math.round((rect.width * rect.height) / 14))
  for (let i = 0; i < count; i++) {
    // Burst outwards in every direction, then let gravity take over.
    const angle = Math.random() * Math.PI * 2
    const speed = 8 + Math.random() * 52
    particles.push({
      x: rect.left + Math.random() * rect.width,
      y: rect.top + Math.random() * rect.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 10,
      size: Math.random() < 0.55 ? 1 : Math.random() < 0.85 ? 2 : 3,
      // The whole row goes at once — only a touch of jitter to avoid a hard pop.
      delay: Math.random() * 0.09,
      life: LIFE + Math.random() * 1.3,
      age: 0,
      color: palette[(Math.random() * palette.length) | 0],
    })
  }

  if (running) return
  running = true
  last = performance.now()
  requestAnimationFrame(frame)
}
