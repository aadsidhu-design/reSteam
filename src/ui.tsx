import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmt, priceOf, type Game } from './data'
import { Icon } from './icons'

export const hours = (mins = 0) => (mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} hrs`)

export const ago = (t?: number) => {
  if (!t) return 'Never'
  const d = Math.floor((Date.now() - t) / 86_400_000)
  if (d <= 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 14) return `${d} days ago`
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const nameHue = (name: string) => [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)

export const Logo = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <circle cx="16" cy="16" r="15" fill="#1b2838" stroke="#67c1f5" strokeWidth="2" />
    <path d="M22 11a8 8 0 1 0 1.5 6" fill="none" stroke="#67c1f5" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M23 6v6h-6" fill="none" stroke="#67c1f5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Avatar = ({ f, size = 36, ring = true }: { f: { name: string; status?: string }; size?: number; ring?: boolean }) => {
  const hue = nameHue(f.name)
  return (
    <div
      className={`avatar ${ring && f.status ? `st-${f.status}` : ''}`}
      style={{ width: size, height: size, fontSize: size * 0.46, background: `linear-gradient(135deg, hsl(${hue} 50% 48%), hsl(${hue + 40} 45% 28%))` }}
    >
      {f.name[0]?.toUpperCase()}
    </div>
  )
}

export const Price = ({ game, big = false }: { game: Game; big?: boolean }) => {
  const p = priceOf(game)
  return (
    <span className={`price ${big ? 'big' : ''}`}>
      {game.discount > 0 && <span className="badge-off">-{game.discount}%</span>}
      <span className="price-col">
        {game.discount > 0 && <s>{fmt(game.price)}</s>}
        <b>{fmt(p)}</b>
      </span>
    </span>
  )
}

/** Close popovers when clicking elsewhere or pressing Escape. */
export function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open, onClose])
  return ref
}

export function Modal({ title, onClose, children, width = 460 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ width }} role="dialog" aria-label={title}>
        <div className="modal-head"><b>{title}</b><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

/** Horizontally scrolling row with left/right arrows, like the library shelves. */
export function Shelf({ children, step = 600 }: { children: ReactNode; step?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ l: false, r: true })
  const update = () => {
    const el = ref.current
    if (el) setPos({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }
  useEffect(update, [children])
  const go = (dir: number) => ref.current?.scrollBy({ left: dir * step, behavior: 'smooth' })
  return (
    <div className="shelf-wrap">
      <div className="shelf-arrows">
        <button className="arrow" disabled={!pos.l} onClick={() => go(-1)} aria-label="Scroll left"><Icon name="chevronLeft" size={26} /></button>
        <button className="arrow" disabled={!pos.r} onClick={() => go(1)} aria-label="Scroll right"><Icon name="chevronRight" size={26} /></button>
      </div>
      <div className="shelf-row" ref={ref} onScroll={update}>{children}</div>
    </div>
  )
}

/** The real store's three-bar loading screen. */
export const Loading = ({ text = 'Loading' }: { text?: string }) => (
  <div className="loadwrap" role="status" aria-live="polite">
    <div className="throbber"><i /><i /><i /></div>
    <div className="loadtext">{text}</div>
  </div>
)
