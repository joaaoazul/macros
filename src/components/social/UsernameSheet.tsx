/** Primeira visita ao Social: escolher @username e avatar. */

import { useState } from 'react'
import { ApiError } from '../../lib/api'
import { social, type SocialMe } from '../../lib/social'

const AVATARS = ['🙂', '😎', '🦁', '🐯', '🦊', '🐼', '🐸', '🦄', '🏋️', '🏃', '🚴', '🧗', '🥑', '🍓', '⚡', '🔥', '🌊', '🌟']

export default function UsernameSheet({ onDone }: { onDone: (me: SocialMe) => void }) {
  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState('🙂')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const valid = /^[a-z0-9_]{3,20}$/.test(username)

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      onDone(await social.updateMe(username, avatar))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível guardar. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-5 pt-4">
      <div className="rounded-card bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <h2 className="text-2xl font-bold tracking-tight">Cria o teu perfil social</h2>
        <p className="mt-2 text-sm text-ink-2">
          Escolhe um nome de utilizador para os teus amigos te encontrarem. Só verão as tuas conquistas —
          nunca as tuas calorias, peso ou refeições.
        </p>

        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Nome de utilizador</span>
          <div className="flex items-center rounded-xl bg-bg px-4 py-3 focus-within:ring-2 focus-within:ring-accent">
            <span className="text-muted">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="ana_fit"
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full bg-transparent pl-1 text-ink placeholder:text-muted focus:outline-none"
            />
          </div>
        </label>
        {username.length > 0 && !valid && (
          <p className="mt-1.5 text-xs text-muted">3–20 caracteres: letras minúsculas, números e _</p>
        )}

        <div className="mt-5">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Avatar</span>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                aria-label={`Avatar ${a}`}
                className={`flex h-11 items-center justify-center rounded-xl text-2xl transition-colors ${
                  avatar === a ? 'bg-accent-soft ring-2 ring-accent' : 'bg-bg'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm font-medium text-critical">{error}</p>
        )}

        <button
          onClick={submit}
          disabled={!valid || busy}
          className="mt-6 w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
        >
          {busy ? 'A guardar…' : 'Continuar'}
        </button>
      </div>
    </div>
  )
}
