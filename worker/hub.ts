import { DurableObject } from 'cloudflare:workers'
import type { Env } from './util'

interface Attachment { uid: string; username: string; typingAt: number }

/**
 * One Durable Object per user. It holds that user's open WebSockets and fans realtime events out to them.
 * The Worker is the only caller: it verifies the session first and sets the identity headers itself.
 */
export class UserHub extends DurableObject<Env> {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected a websocket', { status: 426 })
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      this.ctx.acceptWebSocket(server) // hibernation API: the object can sleep while sockets stay open
      server.serializeAttachment({ uid: req.headers.get('x-user-id') ?? '', username: req.headers.get('x-username') ?? '', typingAt: 0 } satisfies Attachment)
      return new Response(null, { status: 101, webSocket: client })
    }

    if (url.pathname === '/push' && req.method === 'POST') {
      const body = await req.text()
      for (const ws of this.ctx.getWebSockets()) { try { ws.send(body) } catch { /* socket already closing */ } }
      return new Response('ok')
    }
    return new Response('not found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message.length > 512) return
    let msg: { type?: string; to?: string }
    try { msg = JSON.parse(message) } catch { return }
    const att = ws.deserializeAttachment() as Attachment | null
    if (!att) return

    if (msg.type === 'ping') { ws.send('{"type":"pong"}'); return }

    if (msg.type === 'typing' && typeof msg.to === 'string') {
      const now = Date.now()
      if (now - att.typingAt < 1500) return // at most one typing signal per socket every 1.5s
      ws.serializeAttachment({ ...att, typingAt: now })
      // only friends can be signalled, and never anyone who blocked either side
      const target = await this.env.DB.prepare(
        `SELECT u.id FROM friendships f JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = ? AND f.status = 'accepted' AND u.username = ? COLLATE NOCASE
         AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.user_id = f.user_id AND b.blocked_id = f.friend_id) OR (b.user_id = f.friend_id AND b.blocked_id = f.user_id))`,
      ).bind(att.uid, msg.to.slice(0, 20)).first<{ id: string }>()
      if (!target) return
      await this.env.USER_HUB.get(this.env.USER_HUB.idFromName(target.id)).fetch('https://hub/push', { method: 'POST', body: JSON.stringify({ type: 'typing', from: att.username }) })
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try { ws.close(code, reason) } catch { /* already closed */ }
  }
}
