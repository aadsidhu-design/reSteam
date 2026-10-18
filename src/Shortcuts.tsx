import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { store } from './store'
import { Modal } from './ui'

const LIST: [string, string][] = [['/', 'Focus the store search'], ['?', 'Show this list'], ['g then s', 'Go to the store'], ['g then l', 'Go to your library'], ['g then c', 'Go to the community'], ['g then n', 'Go to the news hub'], ['g then w', 'Go to your wishlist'], ['f', 'Open or close Friends & Chat'], ['Esc', 'Close menus and dialogs']]

/** Global keyboard shortcuts. They never fire while you are typing in a field. */
export function Shortcuts() {
  const nav = useNavigate()
  const [help, setHelp] = useState(false)
  useEffect(() => {
    let g = 0
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || el.closest('input, textarea, select, [contenteditable]')) return
      if (g && Date.now() - g < 1200) {
        const to: Record<string, string> = { s: '/store', l: '/library', c: '/community', n: '/news', w: '/wishlist' }
        g = 0
        if (to[e.key]) { e.preventDefault(); nav(to[e.key]); return }
      }
      if (e.key === '/') { e.preventDefault(); document.querySelector<HTMLInputElement>('.ssearch input')?.focus() }
      else if (e.key === '?') { e.preventDefault(); setHelp(h => !h) }
      else if (e.key === 'g') g = Date.now()
      else if (e.key === 'f' && store.signedIn) store.friendsOpen = !store.friendsOpen
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [nav])
  if (!help) return null
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setHelp(false)} width={420}>
      <dl className="kv">{LIST.map(([k, d]) => <><dt key={k}><kbd>{k}</kbd></dt><dd key={d}>{d}</dd></>)}</dl>
    </Modal>
  )
}
