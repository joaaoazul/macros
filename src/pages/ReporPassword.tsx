import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { AuthShell, ErrorNote, Field, inputCls, SubmitButton } from './shared'

export default function ReporPassword() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const passwordOk = password.length >= 10 && !/^\d+$/.test(password)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: password },
        skipRefresh: true,
      })
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível repor a password.')
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <AuthShell title="Link inválido" subtitle="Este link de reposição não é válido.">
        <Link to="/recuperar-password" className="mt-8 font-semibold text-accent">Pedir novo link</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Nova password" subtitle="Escolhe a tua nova password.">
      <form onSubmit={submit} className="mt-8 flex flex-1 flex-col gap-4">
        <Field label="Nova password">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 10 caracteres"
            className={inputCls}
            autoFocus
          />
        </Field>
        {password.length > 0 && !passwordOk && (
          <p className="text-sm text-muted">A password deve ter pelo menos 10 caracteres e não pode ser só números.</p>
        )}
        <ErrorNote message={error} />
        <div className="mt-auto pt-6">
          <SubmitButton busy={busy} disabled={!passwordOk}>Guardar password</SubmitButton>
        </div>
      </form>
    </AuthShell>
  )
}
