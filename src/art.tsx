import type { ReactElement } from 'react'
import type { Game } from './data'

export type ArtKind = 'hero' | 'wide' | 'header' | 'capsule' | 'icon' | 'shot'

/** Deterministic PRNG so every game always renders the same art. */
const rng = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const hsl = (h: number, s: number, l: number, a = 1) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`

function Scene({ game, w, h, variant }: { game: Game; w: number; h: number; variant: number }) {
  const r = rng(game.id * 977 + variant * 131)
  const hu = game.hue + variant * 18
  const els: ReactElement[] = []
  let k = 0
  const add = (e: ReactElement) => els.push(<g key={k++}>{e}</g>)

  switch (game.motif) {
    case 'space': {
      for (let i = 0; i < 90; i++) add(<circle cx={r() * w} cy={r() * h} r={r() * 1.8 + 0.4} fill="#fff" opacity={r() * 0.8 + 0.2} />)
      const cx = w * (0.55 + r() * 0.3), cy = h * (0.35 + r() * 0.25), pr = h * (0.22 + r() * 0.12)
      add(<circle cx={cx} cy={cy} r={pr} fill={hsl(hu + 30, 70, 55)} />)
      add(<circle cx={cx - pr * 0.25} cy={cy - pr * 0.25} r={pr * 0.85} fill={hsl(hu + 30, 60, 62, 0.5)} />)
      add(<ellipse cx={cx} cy={cy} rx={pr * 1.9} ry={pr * 0.38} fill="none" stroke={hsl(hu + 60, 80, 78, 0.8)} strokeWidth={h * 0.015} transform={`rotate(-18 ${cx} ${cy})`} />)
      break
    }
    case 'mountain': case 'desert': {
      const base = game.motif === 'desert'
      add(<circle cx={w * (0.2 + r() * 0.6)} cy={h * 0.32} r={h * 0.12} fill={hsl(hu + 25, 90, 78, 0.9)} />)
      for (let layer = 0; layer < 4; layer++) {
        const pts = [`0,${h}`]
        const steps = base ? 7 : 9
        for (let i = 0; i <= steps; i++) {
          const x = (i / steps) * w
          const y = h * (0.45 + layer * 0.12) - (base ? Math.sin(i * 1.3 + layer) * h * 0.06 : r() * h * 0.28)
          pts.push(`${x},${y}`)
        }
        pts.push(`${w},${h}`)
        add(<polygon points={pts.join(' ')} fill={hsl(hu + layer * 12, 45 - layer * 4, 38 - layer * 8)} />)
      }
      break
    }
    case 'ocean': {
      add(<circle cx={w * (0.65 + r() * 0.2)} cy={h * 0.36} r={h * 0.13} fill={hsl(hu + 40, 90, 80, 0.85)} />)
      for (let layer = 0; layer < 5; layer++) {
        const y0 = h * (0.5 + layer * 0.1)
        let d = `M0 ${h} L0 ${y0}`
        for (let x = 0; x <= w; x += w / 12) d += ` Q ${x + w / 24} ${y0 - h * 0.05 - r() * h * 0.03} ${x + w / 12} ${y0}`
        d += ` L${w} ${h} Z`
        add(<path d={d} fill={hsl(hu, 55, 42 - layer * 7)} opacity={0.92} />)
      }
      break
    }
    case 'city': {
      let x = 0
      while (x < w) {
        const bw = w * (0.04 + r() * 0.06), bh = h * (0.25 + r() * 0.5)
        add(<rect x={x} y={h - bh} width={bw} height={bh} fill={hsl(hu, 40, 12 + r() * 10)} />)
        for (let wy = h - bh + 8; wy < h - 10; wy += 14) for (let wx = x + 5; wx < x + bw - 6; wx += 10)
          if (r() > 0.55) add(<rect x={wx} y={wy} width={5} height={7} fill={hsl(hu + 160, 90, 70, 0.9)} />)
        x += bw + 2
      }
      break
    }
    case 'forest': {
      add(<circle cx={w * 0.7} cy={h * 0.3} r={h * 0.14} fill={hsl(hu + 30, 80, 80, 0.7)} />)
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < 14; i++) {
          const x = r() * w, th = h * (0.25 + r() * 0.3), tw = th * 0.45, y = h * (0.75 + layer * 0.1)
          add(<polygon points={`${x},${y - th} ${x - tw / 2},${y} ${x + tw / 2},${y}`} fill={hsl(hu + layer * 8, 45, 20 - layer * 4)} />)
        }
      }
      break
    }
    case 'circuit': {
      for (let i = 0; i < 26; i++) {
        const x = r() * w, y = r() * h, l = w * (0.08 + r() * 0.2)
        add(<polyline points={`${x},${y} ${x + l},${y} ${x + l},${y + l * 0.5}`} fill="none" stroke={hsl(hu + 120, 90, 65, 0.7)} strokeWidth={2} />)
        add(<circle cx={x + l} cy={y + l * 0.5} r={4} fill={hsl(hu + 120, 95, 75)} />)
      }
      break
    }
    case 'dungeon': {
      const cx = w * 0.5
      add(<path d={`M${cx - w * 0.16} ${h} V${h * 0.5} A${w * 0.16} ${w * 0.16} 0 0 1 ${cx + w * 0.16} ${h * 0.5} V${h} Z`} fill={hsl(hu, 40, 6)} />)
      add(<ellipse cx={cx} cy={h * 0.78} rx={w * 0.12} ry={h * 0.12} fill={hsl(hu + 25, 100, 60, 0.45)} />)
      for (const sx of [0.18, 0.82]) {
        add(<circle cx={w * sx} cy={h * 0.5} r={h * 0.1} fill={hsl(hu + 20, 100, 60, 0.35)} />)
        add(<rect x={w * sx - 3} y={h * 0.5} width={6} height={h * 0.25} fill={hsl(hu, 30, 10)} />)
      }
      break
    }
    case 'sun': {
      const cx = w * 0.5, cy = h * 0.62
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2
        add(<polygon points={`${cx},${cy} ${cx + Math.cos(a) * w},${cy + Math.sin(a) * w} ${cx + Math.cos(a + 0.12) * w},${cy + Math.sin(a + 0.12) * w}`} fill={hsl(hu + 25, 90, 70, 0.12)} />)
      }
      add(<circle cx={cx} cy={cy} r={h * 0.2} fill={hsl(hu + 25, 95, 72)} />)
      add(<ellipse cx={cx} cy={h * 1.02} rx={w * 0.7} ry={h * 0.22} fill={hsl(hu, 45, 22)} />)
      break
    }
  }
  return <>{els}</>
}

const splitTitle = (title: string, max: number) => {
  const words = title.split(' '), lines: string[] = []
  let cur = ''
  for (const wd of words) {
    if ((cur + ' ' + wd).trim().length > max && cur) { lines.push(cur); cur = wd } else cur = (cur + ' ' + wd).trim()
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 3)
}

const DIMS: Record<ArtKind, [number, number]> = {
  hero: [1920, 620], wide: [1200, 600], header: [460, 215], capsule: [600, 900], icon: [64, 64], shot: [1280, 720],
}

/** Procedural stand-in for key art. Everything is generated in-browser, no external assets. */
export function Art({ game, kind = 'header', variant = 0, className = '', showTitle = true }: {
  game: Game; kind?: ArtKind; variant?: number; className?: string; showTitle?: boolean
}) {
  const [w, h] = DIMS[kind]
  const hu = game.hue + variant * 18
  const id = `g${game.id}-${kind}-${variant}`
  const portrait = kind === 'capsule'
  const lines = splitTitle(game.title.toUpperCase(), portrait ? 11 : 20)
  const fs = kind === 'icon' ? 0 : portrait ? w * 0.14 : kind === 'hero' ? h * 0.16 : kind === 'wide' ? h * 0.13 : h * 0.17

  return (
    <svg className={`art-svg ${className}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={game.title}>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={hsl(hu, 70, 55)} />
          <stop offset="0.6" stopColor={hsl(hu + 30, 55, 28)} />
          <stop offset="1" stopColor={hsl(hu + 50, 55, 11)} />
        </linearGradient>
        <linearGradient id={`${id}-vig`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={`url(#${id}-bg)`} />
      {kind !== 'icon' && <Scene game={game} w={w} h={h} variant={variant} />}
      <rect width={w} height={h} fill={`url(#${id}-vig)`} />
      {kind === 'icon' && (
        <text x={w / 2} y={h * 0.7} textAnchor="middle" fontSize={h * 0.58} fontWeight={800} fill="#fff" opacity={0.95}>{game.title[0]}</text>
      )}
      {kind !== 'icon' && kind !== 'shot' && showTitle && (
        <g fontWeight={800} textAnchor={portrait ? 'middle' : 'start'} style={{ letterSpacing: '0.02em' }}>
          {lines.map((ln, i) => {
            const x = portrait ? w / 2 : kind === 'hero' ? w * 0.08 : w * 0.06
            const y = portrait ? h * 0.72 + i * fs * 1.1 : h * 0.5 - ((lines.length - 1) / 2 - i) * fs * 1.12
            return (
              <g key={i}>
                <text x={x + 3} y={y + 4} fontSize={fs} fill="#000" opacity={0.45}>{ln}</text>
                <text x={x} y={y} fontSize={fs} fill="#fff" stroke={hsl(hu, 60, 10)} strokeWidth={fs * 0.04} paintOrder="stroke">{ln}</text>
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}
