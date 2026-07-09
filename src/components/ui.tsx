/** Peças partilhadas do estilo iOS: large title, cartões e ícones da tab bar. */

export function LargeTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="flex items-end justify-between px-5 pb-3 pt-[max(1.75rem,env(safe-area-inset-top))]">
      <div className="min-w-0">
        {subtitle && <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{subtitle}</div>}
        <h1 className="mt-0.5 truncate text-[2rem] font-extrabold leading-tight">{title}</h1>
      </div>
      {right}
    </header>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-card bg-surface shadow-card ring-1 ring-ring-soft ${className}`}>{children}</section>
}

/** Etiqueta de secção à iOS (por cima de um grupo de cartões). */
export function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="px-2 pt-3 pb-0.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted">{children}</h3>
}

/** Círculo com emoji/ícone, com a tinta suave por trás (à iOS Definições). */
export function IconCircle({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg"
      style={{ background: tint ?? 'var(--accent-soft)' }}
      aria-hidden
    >
      {children}
    </span>
  )
}

/** Botão circular "ghost" (ex.: setas de navegação de dias). */
export function CircleButton({ onClick, disabled, label, children }: { onClick: () => void; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-accent shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-opacity disabled:opacity-30"
    >
      {children}
    </button>
  )
}

export const Chevron = ({ dir }: { dir: 'left' | 'right' }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {dir === 'left' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
  </svg>
)

/* Ícones da tab bar (traço, ao estilo SF Symbols) */
const iconProps = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const IconHome = () => (
  <svg {...iconProps} aria-hidden>
    <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" />
  </svg>
)

export const IconTrend = () => (
  <svg {...iconProps} aria-hidden>
    <path d="M4 17l5-5 3.5 3.5L20 9" />
    <path d="M15 9h5v5" />
  </svg>
)

export const IconBook = () => (
  <svg {...iconProps} aria-hidden>
    <path d="M12 6c-1.5-1.4-3.6-2-6-2H4v14h2c2.4 0 4.5.6 6 2 1.5-1.4 3.6-2 6-2h2V4h-2c-2.4 0-4.5.6-6 2z" />
    <path d="M12 6v14" />
  </svg>
)

export const IconTarget = () => (
  <svg {...iconProps} aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </svg>
)

export const IconChart = () => (
  <svg {...iconProps} aria-hidden>
    <path d="M4 20h16" />
    <path d="M7 20v-7" />
    <path d="M12 20V6" />
    <path d="M17 20v-10" />
  </svg>
)

export const IconPerson = () => (
  <svg {...iconProps} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3" />
    <path d="M6.2 18.3c1.1-2.2 3.2-3.3 5.8-3.3s4.7 1.1 5.8 3.3" />
  </svg>
)
