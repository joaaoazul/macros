import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { AuthShell, ErrorNote, Field, inputCls, LegalFooter, SubmitButton } from './shared'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar sessão. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Entrar" subtitle="Bem-vindo de volta.">
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
        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
            className={inputCls}
          />
        </Field>
        <ErrorNote message={error} />
        <div className="text-sm">
          <Link to="/recuperar-password" className="font-medium text-accent">Esqueceste-te da password?</Link>
        </div>
        <div className="mt-auto flex flex-col gap-3 pt-6">
          <SubmitButton busy={busy}>Entrar</SubmitButton>
          <p className="text-center text-sm text-ink-2">
            Ainda não tens conta?{' '}
            <Link to="/registo" className="font-semibold text-accent">Criar conta</Link>
          </p>
        </div>
      </form>
      <LegalFooter />
    </AuthShell>
  )
}
