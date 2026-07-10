/** Layout partilhado das páginas legais. */

import { Link } from 'react-router-dom'

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md bg-bg px-6 py-10">
      <Link to="/" className="text-sm font-medium text-accent">← Voltar</Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted">Última atualização: {updated}</p>
      <div className="mt-8 space-y-6 pb-10">{children}</div>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-1.5 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  )
}
