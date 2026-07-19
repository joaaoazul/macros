/** Partilhar um alimento ou receita para uma conversa (DM ou grupo). */

import { useEffect, useState } from 'react'
import {
  messages as messagesApi,
  social,
  type Conversation,
  type FriendshipOut,
  type Share,
} from '../../lib/social'
import { haptic } from '../../lib/store'
import type { Food, Recipe } from '../../types'
import Avatar from './Avatar'
import { Z } from '../ui'

export function foodShare(food: Food): Share {
  return {
    kind: 'food',
    payload: {
      name: food.name,
      emoji: food.emoji,
      kcal: food.kcal,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      unit: food.unit,
      brand: food.brand ?? undefined,
      fiber: food.fiber ?? undefined,
      sugar: food.sugar ?? undefined,
      saturates: food.saturates ?? undefined,
      salt: food.salt ?? undefined,
      portions: food.portions ?? undefined,
    },
  }
}

export function recipeShare(recipe: Recipe): Share {
  return {
    kind: 'recipe',
    payload: {
      name: recipe.name || 'Receita',
      emoji: recipe.emoji,
      items: recipe.items,
    },
  }
}

interface Props {
  share: Share
  onClose: () => void
}

type Target =
  | { kind: 'conv'; conv: Conversation }
  | { kind: 'friend'; friend: FriendshipOut }

export default function ShareSheet({ share, onClose }: Props) {
  const [convs, setConvs] = useState<Conversation[] | null>(null)
  const [friends, setFriends] = useState<FriendshipOut[]>([])
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    messagesApi.conversations().then(setConvs).catch(() => setConvs([]))
    social.friends().then((f) => setFriends(f.friends)).catch(() => {})
  }, [])

  // amigos sem conversa aberta (para começar uma DM)
  const dmUserIds = new Set((convs ?? []).filter((c) => c.type === 'dm').map((c) => c.user?.userId))
  const freshFriends = friends.filter((f) => !dmUserIds.has(f.user.userId))

  const targets: Target[] = [
    ...(convs ?? []).map((conv) => ({ kind: 'conv', conv }) as Target),
    ...freshFriends.map((friend) => ({ kind: 'friend', friend }) as Target),
  ]

  const send = async (t: Target) => {
    setBusy(true)
    try {
      let convId: number
      let label: string
      if (t.kind === 'conv') {
        convId = t.conv.id
        label = t.conv.type === 'group' ? (t.conv.title || 'grupo') : `@${t.conv.user?.username}`
      } else {
        const conv = await messagesApi.openDm(t.friend.user.userId)
        convId = conv.id
        label = `@${t.friend.user.username}`
      }
      await messagesApi.send(convId, { share })
      haptic(20)
      setSentTo(label)
      setTimeout(onClose, 900)
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className={`fixed inset-0 ${Z.top} flex items-end bg-black/40 sheet-backdrop`} onClick={onClose}>
      <div className="sheet-panel max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-bg p-5 scroll-contain" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
        <h2 className="mb-4 text-xl font-bold">Partilhar {share.kind === 'recipe' ? 'receita' : 'alimento'}</h2>

        {sentTo ? (
          <p className="animate-pop py-8 text-center font-semibold text-good">Enviado para {sentTo} ✓</p>
        ) : convs === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <div className="skeleton h-10 w-10 rounded-full" />
                <div className="skeleton h-3.5 w-1/3 rounded" />
              </div>
            ))}
          </div>
        ) : targets.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Adiciona amigos para poderes partilhar.</p>
        ) : (
          <div className="space-y-1">
            {targets.map((t) => {
              const key = t.kind === 'conv' ? `c${t.conv.id}` : `f${t.friend.user.userId}`
              const title = t.kind === 'conv'
                ? (t.conv.type === 'group' ? t.conv.title : `@${t.conv.user?.username}`)
                : `@${t.friend.user.username}`
              return (
                <button
                  key={key}
                  onClick={() => void send(t)}
                  disabled={busy}
                  className="press flex w-full items-center gap-3 rounded-xl p-2 text-left disabled:opacity-50"
                >
                  {t.kind === 'conv' && t.conv.type === 'group' ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-xl">{t.conv.emoji}</div>
                  ) : (
                    <Avatar
                      avatar={t.kind === 'conv' ? (t.conv.user?.avatar ?? '🙂') : t.friend.user.avatar}
                      avatarPhoto={t.kind === 'conv' ? t.conv.user?.avatarPhoto : t.friend.user.avatarPhoto}
                      size={40}
                    />
                  )}
                  <span className="flex-1 truncate text-sm font-medium">{title}</span>
                  <span className="text-accent">Enviar ›</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
