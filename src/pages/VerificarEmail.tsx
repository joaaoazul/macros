import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { AuthShell } from './shared'

export default function VerificarEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<'busy' | 'ok' | 'error'>('busy')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('Link inválido.')
      return
    }
    api('/auth/verify-email', { method: 'POST', body: { token }, skipRefresh: true })
      .then(() => setState('ok'))
      .catch((err) => {
        setState('error')
        setMessage(err instanceof ApiError ? err.message : 'Não foi possível confirmar o email.')
      })
  }, [token])

  return (
    <AuthShell
      title={state === 'busy' ? 'A confirmar…' : state === 'ok' ? 'Email confirmado ✅' : 'Ups'}
      subtitle={state === 'ok' ? 'A tua conta está confirmada.' : message}
    >
      {state !== 'busy' && (
        <Link to="/app" className="mt-8 font-semibold text-accent">Ir para a app</Link>
      )}
    </AuthShell>
  )
}
