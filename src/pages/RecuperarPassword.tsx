import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { AuthShell, ErrorNote, Field, inputCls, SubmitButton } from './shared'

export default function RecuperarPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email }, skipRefresh: true })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o email. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Recuperar password" subtitle="Enviamos-te um link para repor a password.">
      {sent ? (
        <div className="mt-8 space-y-6">
          <p className="rounded-card bg-surface p-5 text-ink-2">
            Se o email existir, enviámos instruções para repor a password. Verifica a caixa de entrada (e o spam).
          </p>
          <Link to="/login" className="block text-center font-semibold text-accent">Voltar ao login</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 flex flex-1 flex-col gap-4">
          <Field label="Email">
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="o.teu@email.pt"
              className={inputCls}
              autoFocus
            />
          </Field>
          <ErrorNote message={error} />
          <div className="mt-auto flex flex-col gap-3 pt-6">
            <SubmitButton busy={busy}>Enviar link</SubmitButton>
            <Link to="/login" className="text-center text-sm font-medium text-accent">Voltar ao login</Link>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
