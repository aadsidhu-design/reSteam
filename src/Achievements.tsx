import { useEffect, useState } from 'react'
import { api } from './store'
import { Modal } from './ui'
import { t } from './i18n'

export interface Ach { idx: number; name: string; description: string }

export function useAchievements(gameId: number): Ach[] | null {
  const [list, setList] = useState<Ach[] | null>(null)
  useEffect(() => { let live = true; void api<{ achievements: Ach[] }>('GET', `/games/${gameId}/achievements`).then(r => { if (live) setList(r?.achievements ?? []) }); return () => { live = false } }, [gameId])
  return list
}

/** Achievement list; `unlocked` is how many of the first achievements the player has earned (null for visitors). */
export const AchievementList = ({ gameId, unlocked }: { gameId: number; unlocked: number | null }) => {
  const list = useAchievements(gameId)
  if (list === null) return <p className="muted small">Loading…</p>
  if (list.length === 0) return <p className="muted small">The developer has not named any achievements yet.</p>
  return (
    <div className="ach-list">
      {list.map(a => {
        const got = unlocked !== null && a.idx < unlocked
        return <div key={a.idx} className={`ach-row ${got ? 'got' : ''}`}><span className="ach-mark">{got ? '★' : '☆'}</span><div><b>{a.name}</b><div className="muted small">{a.description || ' '}</div></div></div>
      })}
    </div>
  )
}

export const AchievementsModal = ({ gameId, title, unlocked, onClose }: { gameId: number; title: string; unlocked: number | null; onClose: () => void }) => (
  <Modal title={`${t('sg.achievements')}: ${title}`} onClose={onClose} width={520}><AchievementList gameId={gameId} unlocked={unlocked} /></Modal>
)
