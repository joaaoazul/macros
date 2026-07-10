import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../lib/api'
import { useAuth } from '../lib/auth'
import { AuthShell, ErrorNote, Field, inputCls, SubmitButton } from './shared'

export default function Registo() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const passwordOk = password.length >= 10 && !/^\d+$/.test(password)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(email, password, name.trim())
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta. Tenta novamente.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Os teus dados ficam guardados em segurança e sincronizados entre dispositivos.">
      <form onSubmit={submit} className="mt-8 flex flex-1 flex-col gap-4">
        <Field label="Nome">
          <input
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="O teu nome"
            className={inputCls}
            autoFocus
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="o.teu@email.pt"
            className={inputCls}
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 10 caracteres"
            className={inputCls}
          />
        </Field>
        {password.length > 0 && !passwordOk && (
          <p className="text-sm text-muted">A password deve ter pelo menos 10 caracteres e não pode ser só números.</p>
        )}
        <ErrorNote message={error} />
        <div className="mt-auto flex flex-col gap-3 pt-6">
          <p className="text-center text-xs text-muted">
            Ao criar conta aceitas os{' '}
            <Link to="/termos" className="underline">Termos de Serviço</Link> e a{' '}
            <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
          </p>
          <SubmitButton busy={busy} disabled={!passwordOk || !name.trim()}>Criar conta</SubmitButton>
          <p className="text-center text-sm text-ink-2">
            Já tens conta?{' '}
            <Link to="/login" className="font-semibold text-accent">Entrar</Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}
