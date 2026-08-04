import { useEffect, useRef } from 'react'

/**
 * Particle dissolve for deleted rows — the ParticleScroll look, but built from
 * the element's own geometry and colours instead of a captured content texture
 * (html-in-canvas isn't available in WebKit).
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

let spawn: ((particles: Particle[]) => void) | null = null

/** Scatter an element into dust. Call before the element leaves the DOM. */
export function dissolveElement(el: HTMLElement, colors: string[]) {
  if (!spawn) return
  const rect = el.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return

  // Canvas fillStyle can't parse var(--x); resolve against the element first.
  const styles = getComputedStyle(el)
  const palette = colors.map((c) =>
    c.startsWith('var(') ? styles.getPropertyValue(c.slice(4, -1)).trim() || '#fff' : c,
  )

  // One grain per ~26px² keeps a dense row readable without flooding the loop.
  const count = Math.min(900, Math.round((rect.width * rect.height) / 26))
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    const fx = Math.random()
    const x = rect.left + fx * rect.width
    const y = rect.top + Math.random() * rect.height
    particles.push({
      x,
      y,
      vx: 12 + Math.random() * 70,
      vy: -30 + Math.random() * 30,
      size: Math.random() < 0.82 ? 1 : 2,
      // Sweep left to right so the row erodes rather than popping.
      delay: fx * 0.22 + Math.random() * 0.06,
      life: 0.5 + Math.random() * 0.45,
      age: 0,
      color: palette[(Math.random() * palette.length) | 0],
    })
  }
  spawn(particles)
}

const GRAVITY = 220

export function DissolveLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let particles: Particle[] = []
    let raf = 0
    let last = 0
    let running = false

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

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
        const fade = 1 - p.age / p.life
        ctx.globalAlpha = fade * fade
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)
      }
      ctx.globalAlpha = 1

      if (!alive) {
        particles = []
        running = false
        return
      }
      raf = requestAnimationFrame(frame)
    }

    spawn = (next) => {
      particles = particles.concat(next)
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }

    return () => {
      spawn = null
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    />
  )
}
