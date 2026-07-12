/** Lista de conversas. */

import { useEffect, useState } from 'react'
import { messages as messagesApi, type Conversation, type PublicProfileLite } from '../../lib/social'
import type { SocialSocket } from '../../lib/ws'
import Avatar from './Avatar'
import { Card } from '../ui'

interface Props {
  socket: SocialSocket
  onOpen: (user: PublicProfileLite) => void
  onBack: () => void
}

export default function Conversations({ socket, onOpen, onBack }: Props) {
  const [convs, setConvs] = useState<Conversation[] | null>(null)

  const reload = () => messagesApi.conversations().then(setConvs).catch(() => setConvs([]))
  useEffect(() => {
    reload()
    return socket.subscribe((ev) => {
      if (ev.type === 'message') reload()
    })
  }, [socket])

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-bg">
      <header className="flex items-end justify-between px-5 pb-2 pt-[max(1.75rem,env(safe-area-inset-top))]">
        <div>
          <button onClick={onBack} className="text-sm font-medium text-accent">‹ Social</button>
          <h1 className="text-[2.125rem] font-bold leading-tight tracking-tight">Mensagens</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pb-10 pt-2">
        {convs === null && <p className="py-10 text-center text-muted">A carregar…</p>}
        {convs !== null && convs.length === 0 && (
          <div className="py-10 text-center">
            <div className="text-4xl" aria-hidden>💬</div>
            <p className="mt-3 font-semibold">Sem conversas</p>
            <p className="mt-1 text-sm text-ink-2">Abre o perfil de um amigo e envia a primeira mensagem.</p>
          </div>
        )}
        {convs !== null && convs.length > 0 && (
          <Card className="divide-y divide-line">
            {convs.map((c) => (
              <button key={c.user.userId} onClick={() => onOpen(c.user)} className="flex w-full items-center gap-3 p-4 text-left">
                <Avatar avatar={c.user.avatar} avatarPhoto={c.user.avatarPhoto} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">@{c.user.username}</div>
                  <div className="truncate text-sm text-muted">
                    {c.lastMessage ? c.lastMessage.body : 'Nova conversa'}
                  </div>
                </div>
                {c.unread > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-critical px-1.5 text-xs font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </button>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
