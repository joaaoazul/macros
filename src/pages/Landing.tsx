import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LegalFooter } from './shared'

const FEATURES = [
  {
    emoji: '🎯',
    title: 'Metas à tua medida',
    text: 'Calorias e macros calculados com a equação de Mifflin-St Jeor, conforme o teu objetivo.',
  },
  {
    emoji: '📖',
    title: 'Diário alimentar',
    text: 'Regista refeições em segundos com a base de dados portuguesa do Open Food Facts.',
  },
  {
    emoji: '📈',
    title: 'Progresso semanal',
    text: 'Médias, dias no plano e gráficos que mostram como estás a ir.',
  },
  {
    emoji: '🔒',
    title: 'Sincronizado e seguro',
    text: 'A tua conta guarda tudo em segurança — troca de telemóvel sem perder nada.',
  },
]

export default function Landing() {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to="/app" replace />

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg px-6 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <header className="text-2xl font-bold tracking-tight">
        <span aria-hidden>🥗</span> Macros
      </header>

      {/* hero */}
      <section className="mt-10 text-center">
        <AnelHero />
        <h1 className="mt-8 text-4xl font-bold leading-tight tracking-tight">
          Os teus macros,
          <br />
          sem complicações.
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-ink-2">
          Acompanha calorias, proteína, hidratos e gordura com uma app rápida e bonita — feita para Portugal.
        </p>
      </section>

      <div className="mt-8 flex flex-col gap-3">
        <Link
          to="/registo"
          className="rounded-full bg-accent px-6 py-3.5 text-center font-semibold text-white transition-opacity active:opacity-80"
        >
          Criar conta grátis
        </Link>
        <Link
          to="/login"
          className="rounded-full bg-surface px-6 py-3.5 text-center font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
        >
          Já tenho conta
        </Link>
      </div>

      {/* features */}
      <section className="mt-12 space-y-3 pb-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex gap-4 rounded-card bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <span className="text-2xl" aria-hidden>{f.emoji}</span>
            <div>
              <h2 className="font-semibold">{f.title}</h2>
              <p className="mt-0.5 text-sm text-ink-2">{f.text}</p>
            </div>
          </div>
        ))}
      </section>

      <LegalFooter />
    </div>
  )
}

/** Anéis de atividade decorativos (hero), no estilo Apple Fitness. */
function AnelHero() {
  const rings = [
    { r: 84, color: 'var(--carbs)', pct: 0.78 },
    { r: 64, color: 'var(--protein)', pct: 0.62 },
    { r: 44, color: 'var(--fat)', pct: 0.9 },
  ]
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" className="mx-auto" aria-hidden>
      {rings.map(({ r, color, pct }) => {
        const c = 2 * Math.PI * r
        return (
          <g key={r}>
            <circle cx="100" cy="100" r={r} fill="none" stroke={color} strokeOpacity="0.15" strokeWidth="14" />
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${c * pct} ${c}`}
              transform="rotate(-90 100 100)"
            />
          </g>
        )
      })}
    </svg>
  )
}
