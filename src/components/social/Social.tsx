/** Tab Social: segmented control (Feed / Classificação / Amigos) + mensagens. */

import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/auth'
import {
  messages as messagesApi,
  social,
  type Conversation,
  type PublicProfileLite,
  type SocialMe,
} from '../../lib/social'
import type { Food, Recipe } from '../../types'
import type { SocialSocket } from '../../lib/ws'
import { LargeTitle, SegmentedControl } from '../ui'
import Chat from './Chat'
import Conversations from './Conversations'
import Feed from './Feed'
import Friends from './Friends'
import Leaderboard from './Leaderboard'
import NotificationCenter from './NotificationCenter'
import UsernameSheet from './UsernameSheet'

type Segment = 'feed' | 'classificacao' | 'amigos'

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'classificacao', label: 'Classificação' },
  { id: 'amigos', label: 'Amigos' },
]

interface SocialProps {
  socket: SocialSocket
  customFoods: Food[]
  setCustomFoods: React.Dispatch<React.SetStateAction<Food[]>>
  recipes: Recipe[]
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>
}

export default function Social({ socket, customFoods, setCustomFoods, recipes, setRecipes }: SocialProps) {
  const { user } = useAuth()
  const [me, setMe] = useState<SocialMe | null | undefined>(undefined)
  const [segment, setSegment] = useState<Segment>('feed')
  const [showConversations, setShowConversations] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)

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

  const openChat = async (u: PublicProfileLite) => {
    setShowConversations(false)
    try {
      const conv = await messagesApi.openDm(u.userId)
      setActiveConv(conv)
    } catch {
      /* ignora — provavelmente já não são amigos */
    }
  }

  const refreshActiveConv = async () => {
    if (!activeConv) return
    try {
      const list = await messagesApi.conversations()
      const updated = list.find((c) => c.id === activeConv.id)
      if (updated) setActiveConv(updated)
      else setActiveConv(null) // saíste / grupo apagado
    } catch {
      /* ignora */
    }
  }

  return (
    <div>
      <LargeTitle
        title="Social"
        subtitle={`@${me.username}`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotifications(true)}
              aria-label={`Notificações${socket.notifUnread > 0 ? ` (${socket.notifUnread} por ler)` : ''}`}
              className="press relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
              {socket.notifUnread > 0 && (
                <span className="animate-pop absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
                  {socket.notifUnread > 99 ? '99+' : socket.notifUnread}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowConversations(true)}
              aria-label={`Mensagens${socket.unread > 0 ? ` (${socket.unread} por ler)` : ''}`}
              className="press relative flex h-10 w-10 items-center justify-center rounded-full bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 11.5c0 4.14-4.03 7.5-9 7.5-1.1 0-2.16-.17-3.14-.47L4 20l1.13-3.38C3.8 15.28 3 13.47 3 11.5 3 7.36 7.03 4 12 4s9 3.36 9 7.5z" />
              </svg>
              {socket.unread > 0 && (
                <span className="animate-pop absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-bold text-white">
                  {socket.unread > 99 ? '99+' : socket.unread}
                </span>
              )}
            </button>
          </div>
        }
      />

      {/* segmented control iOS com indicador deslizante */}
      <div className="px-4 pb-3 pt-1">
        <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
      </div>

      {/* sem wrapper com opacity animada: criaria um stacking context que prendia
          os overlays fixed (ex.: sheet de perfil dos Amigos) por baixo do segmented */}
      <div key={segment}>
        {segment === 'feed' && <Feed onOpenFriends={() => setSegment('amigos')} />}
        {segment === 'classificacao' && <Leaderboard />}
        {segment === 'amigos' && <Friends onMessage={(u) => void openChat(u)} />}
      </div>

      {showNotifications && (
        <NotificationCenter socket={socket} onBack={() => setShowNotifications(false)} />
      )}

      {showConversations && !activeConv && (
        <Conversations
          socket={socket}
          onOpen={(c) => setActiveConv(c)}
          onBack={() => setShowConversations(false)}
        />
      )}
      {activeConv && user && (
        <Chat
          me={user.id}
          conversation={activeConv}
          socket={socket}
          onBack={() => setActiveConv(null)}
          onConversationChanged={() => void refreshActiveConv()}
          customFoods={customFoods}
          setCustomFoods={setCustomFoods}
          recipes={recipes}
          setRecipes={setRecipes}
        />
      )}
    </div>
  )
}
