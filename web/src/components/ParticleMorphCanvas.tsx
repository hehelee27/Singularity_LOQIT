import { useEffect, useRef } from 'react'

/* ─── Types ─────────────────────────────────────────────────────── */
interface Particle {
  // home position (text shape)
  hx: number; hy: number
  // current position
  x: number; y: number
  // velocity
  vx: number; vy: number
  // visual
  size: number
  colorIdx: number
}

/* ─── Theme Detection ───────────────────────────────────────────── */
function isLightMode(): boolean {
  return document.documentElement.classList.contains('light-mode')
}

function getThemeColors(light: boolean): string[] {
  if (light) {
    return ['#0d2d6e', '#1e40af', '#0e7490', '#1a5276', '#155e75', '#334155']
  }
  return ['#00f5ff', '#00e5cc', '#3D8EFF', '#60efff', '#aac7ff', '#e0eaff']
}

/* ─── Sample text into particle positions ───────────────────────── */
function sampleText(
  text: string,
  canvasW: number,
  canvasH: number,
  maxParticles: number,
): Array<{ x: number; y: number }> {
  const oc = document.createElement('canvas')
  oc.width = canvasW
  oc.height = canvasH
  const ctx = oc.getContext('2d')!

  // Compute font size to fit well within the canvas, with safety margin
  const fontSize = Math.min(
    Math.floor(canvasW / (text.length * 1.1)),
    Math.floor(canvasH * 0.3),
    85
  )

  ctx.fillStyle = '#fff'
  ctx.font = `900 ${fontSize}px "Inter", "Segoe UI", Arial, sans-serif`
  if ('letterSpacing' in ctx) {
    (ctx as any).letterSpacing = '22px'
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvasW / 2, canvasH / 2)

  const imageData = ctx.getImageData(0, 0, canvasW, canvasH)
  const data = imageData.data

  // Collect all opaque pixels
  const valid: Array<{ x: number; y: number }> = []
  const step = 2 // sample every 2px for density
  for (let py = 0; py < canvasH; py += step) {
    for (let px = 0; px < canvasW; px += step) {
      const i = (py * canvasW + px) * 4
      if (data[i + 3] > 100) {
        valid.push({ x: px, y: py })
      }
    }
  }

  // Evenly sample from valid pixel positions
  if (valid.length === 0) return []
  const result: Array<{ x: number; y: number }> = []
  const interval = Math.max(1, Math.floor(valid.length / maxParticles))
  for (let i = 0; i < valid.length && result.length < maxParticles; i += interval) {
    result.push(valid[i])
  }
  return result
}

/* ─── Main Component ─────────────────────────────────────────────── */
interface ParticleMorphCanvasProps {
  particleCount?: number
  className?: string
  style?: React.CSSProperties
}

export function ParticleMorphCanvas({
  particleCount = 3000,
  style,
  className,
}: ParticleMorphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({
    particles: [] as Particle[],
    mouseX: -9999,
    mouseY: -9999,
    mouseActive: false,
    raf: 0,
    initialized: false,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const state = stateRef.current

    const MOUSE_RADIUS = 90
    const PUSH_STRENGTH = 7000
    const SPRING = 0.045
    const DAMPING = 0.82

    /* ── Resize & rebuild ── */
    const buildParticles = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const positions = sampleText('LOQIT', w, h, particleCount)
      state.particles = positions.map((p, i) => ({
        hx: p.x,
        hy: p.y,
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        size: 1.2 + Math.random() * 1.6,
        colorIdx: Math.floor(Math.random() * 6),
      }))
      state.initialized = true
    }

    buildParticles()
    window.addEventListener('resize', buildParticles)

    /* ── Mouse tracking ── */
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      state.mouseX = e.clientX - rect.left
      state.mouseY = e.clientY - rect.top
      state.mouseActive = true
    }
    const onMouseLeave = () => {
      state.mouseActive = false
      state.mouseX = -9999
      state.mouseY = -9999
    }
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseleave', onMouseLeave)

    /* ── Animation loop ── */
    const animate = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      const light = isLightMode()
      const colors = getThemeColors(light)

      ctx.clearRect(0, 0, w, h)

      const mx = state.mouseX
      const my = state.mouseY
      const mouseOn = state.mouseActive

      for (let i = 0; i < state.particles.length; i++) {
        const p = state.particles[i]

        // ── Mouse repulsion (squishy push) ──
        if (mouseOn) {
          const dx = p.x - mx
          const dy = p.y - my
          const distSq = dx * dx + dy * dy
          const dist = Math.sqrt(distSq)

          if (dist < MOUSE_RADIUS && dist > 0.5) {
            // Inverse-square-ish push, capped for smoothness
            const force = PUSH_STRENGTH / (distSq + 200)
            const nx = dx / dist
            const ny = dy / dist
            p.vx += nx * force
            p.vy += ny * force
          }
        }

        // ── Spring back to home position ──
        const sx = (p.hx - p.x) * SPRING
        const sy = (p.hy - p.y) * SPRING
        p.vx = p.vx * DAMPING + sx
        p.vy = p.vy * DAMPING + sy
        p.x += p.vx
        p.y += p.vy

        // ── Displacement magnitude for visual feedback ──
        const dispX = p.x - p.hx
        const dispY = p.y - p.hy
        const disp = Math.sqrt(dispX * dispX + dispY * dispY)
        const dispAlpha = Math.min(disp / 40, 1.0) // 0..1 based on how far pushed

        const col = colors[p.colorIdx % colors.length]

        // ── Bloom glow layers (more intense when displaced) ──
        if (!light) {
          // Outer glow
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (4 + dispAlpha * 3), 0, Math.PI * 2)
          ctx.fillStyle = col
          ctx.globalAlpha = 0.025 + dispAlpha * 0.03
          ctx.fill()

          // Mid glow
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * (2 + dispAlpha * 1.5), 0, Math.PI * 2)
          ctx.fillStyle = col
          ctx.globalAlpha = 0.1 + dispAlpha * 0.06
          ctx.fill()
        }

        // ── Core particle ──
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = col
        ctx.globalAlpha = light ? 0.88 : (0.75 + dispAlpha * 0.25)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      state.raf = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(state.raf)
      window.removeEventListener('resize', buildParticles)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [particleCount])

  return (
    <canvas
      ref={canvasRef}
      id="loqit-particle-morph"
      className={className}
      aria-hidden="true"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        background: 'transparent',
        cursor: 'default',
        ...style,
      }}
    />
  )
}
