/** Editar perfil social: username, avatar (emoji ou foto) e bio. */

import { useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { downscaleImage } from '../../lib/ai'
import { AVATARS } from '../../lib/avatars'
import { social, type SocialMe } from '../../lib/social'
import Avatar from './Avatar'
import { Z } from '../ui'

interface Props {
  me: SocialMe
  onSaved: (me: SocialMe) => void
  onClose: () => void
}

export default function EditProfileSheet({ me, onSaved, onClose }: Props) {
  const [username, setUsername] = useState(me.username ?? '')
  const [avatar, setAvatar] = useState(me.avatar)
  const [photo, setPhoto] = useState<string | null>(me.avatarPhoto ?? null)
  const [bio, setBio] = useState(me.bio ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const valid = /^[a-z0-9_]{3,20}$/.test(username)

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    setError('')
    try {
      setPhoto(await downscaleImage(file, 256))
    } catch {
      setError('Não foi possível processar a foto.')
    }
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const updated = await social.updateMe({ username, avatar, avatarPhoto: photo, bio: bio.trim() || null })
      onSaved(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível guardar. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`sheet-panel scroll-contain fixed inset-0 ${Z.screen} overflow-y-auto bg-bg`}>
      <div className="mx-auto max-w-md px-5 pb-10">
        <header className="flex items-center justify-between pt-5">
          <button onClick={onClose} className="text-sm font-medium text-accent">‹ Perfil</button>
          <button
            onClick={save}
            disabled={!valid || busy}
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-40"
          >
            {busy ? 'A guardar…' : 'Guardar'}
          </button>
        </header>

        <h1 className="mt-2 text-2xl font-bold tracking-tight">Editar perfil</h1>

        {/* foto / avatar atual */}
        <div className="mt-5 flex flex-col items-center gap-3">
          <Avatar avatar={avatar} avatarPhoto={photo} size={96} />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            <button onClick={() => fileRef.current?.click()} className="rounded-full bg-surface px-4 py-2 text-sm font-medium text-accent transition active:scale-95">
              {photo ? 'Mudar foto' : 'Carregar foto'}
            </button>
            {photo && (
              <button onClick={() => setPhoto(null)} className="rounded-full bg-surface px-4 py-2 text-sm font-medium text-critical transition active:scale-95">
                Remover foto
              </button>
            )}
          </div>
        </div>

        {/* username */}
        <label className="mt-6 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Nome de utilizador</span>
          <div className="flex items-center rounded-xl bg-surface px-4 py-3 focus-within:ring-2 focus-within:ring-accent">
            <span className="text-muted">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="ana_fit"
              maxLength={20}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full bg-transparent pl-1 focus:outline-none"
            />
          </div>
        </label>
        {username.length > 0 && !valid && (
          <p className="mt-1.5 text-xs text-muted">3–20 caracteres: letras minúsculas, números e _</p>
        )}

        {/* bio */}
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 300))}
            placeholder="Diz algo sobre ti… (visível aos amigos)"
            rows={3}
            className="w-full rounded-xl bg-surface px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span className="mt-1 block text-right text-xs text-muted">{bio.length}/300</span>
        </label>

        {/* emoji (usado quando não há foto) */}
        <div className="mt-3">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">
            Emoji {photo && <span className="text-muted">(usado se removeres a foto)</span>}
          </span>
          <div className="grid grid-cols-6 gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                aria-label={`Avatar ${a}`}
                className={`flex h-11 items-center justify-center rounded-xl text-2xl transition ${
                  avatar === a ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="mt-4 text-sm font-medium text-critical">{error}</p>}
      </div>
    </div>
  )
}
