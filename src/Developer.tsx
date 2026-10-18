import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { observer } from 'mobx-react-lite'
import { api, call, store } from './store'
import { fmt, type Game } from './data'
import { Art } from './art'
import { Loading, Modal } from './ui'
import './developer.css'

type Mine = Game & { status: string }

const MB = 1024 * 1024
const LIMITS = { cover: 2 * MB, web: 15 * MB, build: 50 * MB }

/** XHR rather than fetch so the progress bar can show real upload progress. */
function upload(path: string, file: File, onProgress: (pct: number) => void): Promise<string | null> {
  return new Promise(resolve => {
    const x = new XMLHttpRequest()
    x.open('PUT', `/api${path}`)
    x.setRequestHeader('x-requested-with', 'fetch')
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress((e.loaded / e.total) * 100) }
    x.onload = () => resolve(x.status < 300 ? null : (() => { try { return JSON.parse(x.responseText).error } catch { return 'Upload failed' } })())
    x.onerror = () => resolve('Could not reach the server')
    x.send(file)
  })
}

const Meta = ({ initial, genres, onSave, onCancel, label }: {
  initial?: Mine; genres: string[]; label: string; onCancel: () => void
  onSave: (m: { title: string; blurb: string; genre: string[]; tags: string[]; price: number }) => Promise<string | null>
}) => {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [blurb, setBlurb] = useState(initial?.blurb ?? '')
  const [genre, setGenre] = useState<string[]>(initial?.genre ?? [])
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '))
  const [price, setPrice] = useState(initial ? (initial.price / 100).toFixed(2) : '0.00')
  const [err, setErr] = useState('')
  return (
    <form className="dv-form" onSubmit={async e => {
      e.preventDefault()
      const e2 = await onSave({ title, blurb, genre, tags: tags.split(',').map(t => t.trim()).filter(Boolean), price: Math.round(Number(price) * 100) })
      if (e2) setErr(e2)
    }}>
      <label>Title<input className="input" value={title} maxLength={60} onChange={e => setTitle(e.target.value)} autoFocus /></label>
      <label>Short description<textarea className="input" rows={4} maxLength={600} value={blurb} onChange={e => setBlurb(e.target.value)} /></label>
      <div className="dv-genres"><span className="muted small">Genres (up to 3)</span>
        {genres.map(g => <label key={g} className="dv-chk"><input type="checkbox" checked={genre.includes(g)} disabled={!genre.includes(g) && genre.length >= 3} onChange={() => setGenre(genre.includes(g) ? genre.filter(x => x !== g) : [...genre, g])} />{g}</label>)}
      </div>
      <label>Tags <span className="muted small">comma separated, up to 10</span><input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="Relaxing, Pixel Graphics, Singleplayer" /></label>
      <label>Price (USD) <span className="muted small">0 makes it free to claim. Wallet funds are play money.</span><input className="input" type="number" min="0" max="100" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label>
      {err && <div className="err">{err}</div>}
      <div className="modal-actions"><button type="button" className="btn" onClick={onCancel}>Cancel</button><button className="btn blue">{label}</button></div>
    </form>
  )
}

const FileSlot = ({ title, hint, have, accept, limit, onFile, onClear }: {
  title: string; hint: string; have: string | null; accept: string; limit: number; onFile: (f: File, progress: (p: number) => void) => Promise<string | null>; onClear?: () => void
}) => {
  const [pct, setPct] = useState<number | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  return (
    <div className="dv-slot">
      <div className="grow"><b>{title}</b><div className="muted small">{hint}</div>
        {have && <div className="small pos">{have}</div>}
        {pct !== null && <div className="dv-bar"><span style={{ width: `${pct}%` }} /></div>}
        {msg && <div className={`small ${msg.ok ? 'pos' : 'err'}`}>{msg.t}</div>}</div>
      <label className="btn small">{have ? 'Replace' : 'Choose file'}
        <input type="file" hidden accept={accept} onChange={async e => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          if (f.size > limit) { setMsg({ ok: false, t: `That file is ${(f.size / MB).toFixed(1)} MB; the limit is ${limit / MB} MB.` }); return }
          setMsg(null); setPct(0)
          const err = await onFile(f, setPct)
          setPct(null); setMsg(err ? { ok: false, t: err } : { ok: true, t: 'Uploaded' })
        }} /></label>
      {have && onClear && <button className="btn small" onClick={onClear}>Remove</button>}
    </div>
  )
}

const GameCard = observer(({ g, genres, reload }: { g: Mine; genres: string[]; reload: () => Promise<void> }) => {
  const [edit, setEdit] = useState(false)
  const published = g.status === 'published'
  const done = async (r: { error?: string }) => { if (r.error) store.toast(r.error); await reload(); await store.loadCatalog() }
  return (
    <div className="dv-card">
      <div className="dv-art"><Art game={g} kind="header" /></div>
      <div className="dv-main">
        <div className="dv-head"><h3>{g.title}</h3><span className={`dv-badge ${published ? 'live' : ''}`}>{published ? 'Published' : 'Draft'}</span><span className="muted">{fmt(g.price)}</span></div>
        <p className="muted small">{g.blurb}</p>
        <FileSlot title="Cover image" hint="PNG, JPEG or WebP up to 2 MB. Shown on the store, library and community." accept="image/png,image/jpeg,image/webp" limit={LIMITS.cover}
          have={g.hasCover ? 'Cover uploaded' : null}
          onFile={async (f, p) => { const e = await upload(`/dev/games/${g.id}/cover`, f, p); await reload(); await store.loadCatalog(); return e }} />
        <FileSlot title="Play in the browser" hint="A .zip with index.html at the top level (HTML5 / JavaScript / WebAssembly). Up to 15 MB zipped. Runs in a sandbox." accept=".zip,application/zip" limit={LIMITS.web}
          have={g.playable ? 'Web build uploaded. Owners can play it right on reSteam.' : null}
          onFile={async (f, p) => { const e = await upload(`/dev/games/${g.id}/web`, f, p); await reload(); return e }}
          onClear={async () => done(await call('DELETE', `/dev/games/${g.id}/web`))} />
        <FileSlot title="Downloadable build" hint="Any file or archive up to 50 MB (installer, .zip, .dmg, .exe, ...). Owners download it from their library." accept="*/*" limit={LIMITS.build}
          have={g.build ? `${g.build.name} (${(g.build.size / MB).toFixed(1)} MB)` : null}
          onFile={async (f, p) => { const e = await upload(`/dev/games/${g.id}/build?name=${encodeURIComponent(f.name)}`, f, p); await reload(); return e }}
          onClear={async () => done(await call('DELETE', `/dev/games/${g.id}/build`))} />
        <div className="dv-actions">
          {published
            ? <><Link className="btn small blue" to={`/store/${g.id}`}>View store page</Link><button className="btn small" onClick={async () => done(await call('POST', `/dev/games/${g.id}/unpublish`))}>Unpublish</button></>
            : <button className="btn small green" disabled={!g.playable && !g.build} title={!g.playable && !g.build ? 'Upload a web build or a downloadable build first' : undefined} onClick={async () => { const r = await call('POST', `/dev/games/${g.id}/publish`); await done(r); if (!r.error) store.toast(`${g.title} is live on the store`) }}>Publish to the store</button>}
          <button className="btn small" onClick={() => setEdit(true)}>Edit details</button>
          <button className="btn small red" onClick={async () => { if (confirm(`Delete ${g.title}? This removes it from every library, with its reviews and files.`)) done(await call('DELETE', `/dev/games/${g.id}`)) }}>Delete</button>
        </div>
      </div>
      {edit && <Modal title={`Edit ${g.title}`} onClose={() => setEdit(false)} width={560}><Meta initial={g} genres={genres} label="Save" onCancel={() => setEdit(false)} onSave={async m => { const r = await call('PUT', `/dev/games/${g.id}`, m); if (r.error) return r.error; setEdit(false); await done({}); return null }} /></Modal>}
    </div>
  )
})

export const Developer = observer(() => {
  const [games, setGames] = useState<Mine[] | null>(null)
  const [genres, setGenres] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const reload = useCallback(async () => { const r = await api<{ games: Mine[] }>('GET', '/dev/games'); setGames(r?.games ?? []) }, [])
  useEffect(() => { void reload(); void api<{ genres: string[] }>('GET', '/dev/genres').then(r => setGenres(r?.genres ?? [])) }, [reload])
  return (
    <div className="container dev-page">
      <div className="dv-top"><div><h1>Upload your games</h1><p className="muted">Anyone with an account can publish here. Web builds run inside reSteam; downloadable builds are delivered from storage. Everything you upload is public once published.</p></div>
        <button className="btn blue big" onClick={() => setCreating(true)}>New game</button></div>
      {games === null ? <Loading /> : games.length === 0 ? <div className="dv-empty">You have not created a game yet. Choose <b>New game</b>, fill in the details, upload a build and publish.</div>
        : games.map(g => <GameCard key={g.id} g={g} genres={genres} reload={reload} />)}
      {creating && <Modal title="New game" onClose={() => setCreating(false)} width={560}>
        <Meta genres={genres} label="Create draft" onCancel={() => setCreating(false)} onSave={async m => { const r = await call('POST', '/dev/games', m); if (r.error) return r.error; setCreating(false); await reload(); return null }} /></Modal>}
    </div>
  )
})
