/** Peças partilhadas das páginas públicas (auth, legais). */

import { Link } from 'react-router-dom'

export const inputCls =
  'w-full rounded-xl bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {children}
    </label>
  )
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg px-6 py-10">
      <Link to="/" className="mb-8 text-2xl font-bold tracking-tight">
        <span aria-hidden>🥗</span> Macros
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-2 text-ink-2">{subtitle}</p>}
      {children}
    </div>
  )
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-critical/10 px-4 py-3 text-sm font-medium text-critical">
      {message}
    </p>
  )
}

export function SubmitButton({ children, busy, disabled }: { children: React.ReactNode; busy?: boolean; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      className="rounded-full bg-accent px-6 py-3.5 font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
    >
      {busy ? 'Aguarda…' : children}
    </button>
  )
}

export function LegalFooter() {
  return (
    <footer className="mt-10 pb-4 text-center text-xs text-muted">
      <Link to="/termos" className="underline">Termos de Serviço</Link>
      {' · '}
      <Link to="/privacidade" className="underline">Política de Privacidade</Link>
    </footer>
  )
}
