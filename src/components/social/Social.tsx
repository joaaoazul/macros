/** Tab Social: segmented control (Feed / Classificação / Amigos) + mensagens. */

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import { social, type PublicProfileLite, type SocialMe } from '../../lib/social'
import type { SocialSocket } from '../../lib/ws'
import { LargeTitle } from '../ui'
import Chat from './Chat'
import Conversations from './Conversations'
import Feed from './Feed'
import Friends from './Friends'
import Leaderboard from './Leaderboard'
import UsernameSheet from './UsernameSheet'

type Segment = 'feed' | 'classificacao' | 'amigos'

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'classificacao', label: 'Classificação' },
  { id: 'amigos', label: 'Amigos' },
]

export default function Social({ socket }: { socket: SocialSocket }) {
  const { user } = useAuth()
  const [me, setMe] = useState<SocialMe | null | undefined>(undefined)
  const [segment, setSegment] = useState<Segment>('feed')
  const [showConversations, setShowConversations] = useState(false)
  const [chatWith, setChatWith] = useState<PublicProfileLite | null>(null)

  useEffect(() => {
    social.me().then(setMe).catch(() => setMe(null))
  }, [])

  if (me === undefined) {
    return (
      <div>
        <LargeTitle title="Social" />
        <p className="px-5 py-10 text-center text-muted">A carregar…</p>
      </div>
    )
  }

  if (me === null || !me.username) {
    return (
      <div>
        <LargeTitle title="Social" />
        <UsernameSheet onDone={setMe} />
      </div>
    )
  }

  const openChat = (userId: number, username: string, avatar: string, name: string) => {
    setChatWith({ userId, username, avatar, name })
  }

  return (
    <div>
      <LargeTitle
        title="Social"
        subtitle={`@${me.username}`}
        right={
          <button
            onClick={() => setShowConversations(true)}
            aria-label={`Mensagens${socket.unread > 0 ? ` (${socket.unread} por ler)` : ''}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 11.5c0 4.14-4.03 7.5-9 7.5-1.1 0-2.16-.17-3.14-.47L4 20l1.13-3.38C3.8 15.28 3 13.47 3 11.5 3 7.36 7.03 4 12 4s9 3.36 9 7.5z" />
            </svg>
            {socket.unread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
                {socket.unread > 99 ? '99+' : socket.unread}
              </span>
            )}
          </button>
        }
      />

      {/* segmented control iOS */}
      <div className="px-4 pb-3 pt-1">
        <div className="flex rounded-xl bg-surface p-1" role="tablist">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={segment === s.id}
              onClick={() => setSegment(s.id)}
              className={`flex-1 rounded-lg py-1.5 text-[13px] font-semibold transition-colors ${
                segment === s.id ? 'bg-accent-soft text-accent' : 'text-muted'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {segment === 'feed' && <Feed onOpenFriends={() => setSegment('amigos')} />}
      {segment === 'classificacao' && <Leaderboard />}
      {segment === 'amigos' && <Friends onMessage={openChat} />}

      {showConversations && !chatWith && (
        <Conversations
          socket={socket}
          onOpen={(u) => setChatWith(u)}
          onBack={() => setShowConversations(false)}
        />
      )}
      {chatWith && user && (
        <Chat
          me={user.id}
          other={chatWith}
          socket={socket}
          onBack={() => setChatWith(null)}
        />
      )}
    </div>
  )
}
