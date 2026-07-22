/** Peças partilhadas do estilo iOS: large title, cartões e ícones da tab bar. */

import { useEffect, useRef, useState } from 'react'

/** Large title que colapsa como uma UINavigationBar: ao passar o título no
 * scroll, aparece uma barra de vidro fixa com o título centrado a 17px. */
export function LargeTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const sentinel = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting), {
      rootMargin: '-1px 0px 0px 0px',
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <>
      <header className="flex items-end justify-between px-5 pb-2 pt-[max(1.75rem,env(safe-area-inset-top))]">
        <div>
          {subtitle && <div className="text-[13px] font-semibold uppercase tracking-wide text-muted">{subtitle}</div>}
          <h1 className="text-[2.125rem] font-bold leading-tight tracking-tight">{title}</h1>
        </div>
        {right}
      </header>
      <div ref={sentinel} aria-hidden />
      {collapsed && (
        <div
          aria-hidden
          className={`bar-blur hairline-b animate-fade fixed inset-x-0 top-0 ${Z.bar} pt-[env(safe-area-inset-top)]`}
        >
          <div className="py-2.5 text-center text-[17px] font-semibold">{title}</div>
        </div>
      )}
    </>
  )
}

/** Barra de topo de um ecrã cheio: voltar à esquerda, título ao centro.
 *
 * Existiam quatro cópias à mão, uma delas alinhada à esquerda e as outras
 * centradas — dois ecrãs irmãos (lista de compras e despensa) não podiam ter
 * cabeçalhos diferentes. O `right` ocupa sempre espaço, mesmo vazio, para o
 * título ficar mesmo ao centro. */
export function ScreenHeader({
  backLabel,
  onBack,
  title,
  subtitle,
  right,
}: {
  backLabel: string
  onBack: () => void
  title: string
  subtitle?: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <header className="bar-blur hairline-b flex items-center gap-2 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
      <button onClick={onBack} className="press flex w-20 shrink-0 items-center text-accent">
        <Chevron dir="left" />
        <span className="truncate text-sm font-medium">{backLabel}</span>
      </button>
      <div className="min-w-0 flex-1 text-center">
        <div className="truncate font-semibold leading-tight">{title}</div>
        {subtitle && <div className="text-[11px] tabular-nums text-muted">{subtitle}</div>}
      </div>
      <div className="flex w-20 shrink-0 justify-end">{right}</div>
    </header>
  )
}

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-card bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>{children}</section>
}

/** Camadas de sobreposição, por nome.
 *
 * Antes andavam sete valores à solta (z-10 … z-[70]) escolhidos à mão, que foi
 * como o segmented control acabou por aparecer por cima de um overlay. Quem
 * precisar de uma camada nova mete-a aqui, na ordem certa.
 */
export const Z = {
  raised: 'z-10', // dentro de um cartão/lista
  bar: 'z-20', // barras fixas (tab bar)
  overlay: 'z-40', // ecrãs cheios (conversas)
  screen: 'z-50', // ecrã cheio por cima de outro (chat, perfil)
  sheet: 'z-[55]', // sheet por cima de um ecrã
  modal: 'z-[60]', // sheet por cima de um sheet
  top: 'z-[70]', // partilha, lightbox
  toast: 'z-[80]', // sempre visível
} as const

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white',
  secondary: 'bg-accent-soft text-accent',
  ghost: 'bg-surface text-ink-2',
  danger: 'bg-surface text-critical',
}
const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3.5',
}

/** Botão da app. Existia uma dúzia de variações escritas à mão; agora há estas. */
export function Button({
  variant = 'primary',
  size = 'md',
  full,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
}) {
  return (
    <button
      {...props}
      className={`press rounded-full font-semibold transition-opacity disabled:opacity-40 ${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''} ${className}`}
    />
  )
}

/** Estado vazio: emoji, uma frase que explica, e opcionalmente o que fazer. */
export function EmptyState({
  emoji,
  title,
  hint,
  action,
}: {
  emoji: string
  title: string
  hint?: string
  action?: React.ReactNode
}) {
  return (
    <div className="animate-in py-12 text-center">
      <div className="text-4xl" aria-hidden>{emoji}</div>
      <p className="mt-3 font-semibold">{title}</p>
      {hint && <p className="mx-auto mt-1 max-w-xs text-sm text-ink-2">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** Placeholder de carregamento com a forma do conteúdo que vem a seguir.
 *
 * Uma lista cinzenta a pulsar diz "está quase" melhor do que a palavra
 * "A carregar…", e não faz o conteúdo saltar quando chega. */
export function ListSkeleton({ rows = 3, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <Card className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          {avatar && <div className="skeleton h-10 w-10 shrink-0 rounded-full" />}
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-1/3 rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </Card>
  )
}

/** Controlo segmentado iOS com indicador deslizante. Partilhado por Social/Cozinha. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  const idx = Math.max(0, options.findIndex((o) => o.id === value))
  return (
    <div className={`relative flex rounded-[10px] bg-ink/[0.06] p-0.5 ${className}`} role="tablist">
      <div
        className="absolute inset-y-0.5 rounded-lg bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-[#636366]"
        style={{
          width: `calc((100% - 0.25rem) / ${options.length})`,
          transform: `translateX(${idx * 100}%)`,
        }}
        aria-hidden
      />
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          className={`relative z-10 flex-1 rounded-lg py-1.5 text-[13px] transition-colors ${
            value === o.id ? 'font-semibold text-ink' : 'font-medium text-ink-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Contador −/valor/＋. Estava escrito três vezes (doses, stock, foto da
 * despensa), com fundos diferentes em cada cópia. */
export function Stepper({
  value,
  onChange,
  label,
  min = 1,
  max = 99,
}: {
  value: number
  onChange: (delta: number) => void
  /** nome do que se está a contar, para os leitores de ecrã */
  label: string
  min?: number
  max?: number
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        onClick={() => onChange(-1)}
        disabled={value <= min}
        className="press flex h-7 w-7 items-center justify-center rounded-full bg-bg text-sm disabled:opacity-30"
        aria-label={`Menos ${label}`}
      >
        −
      </button>
      <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-label={`${value} ${label}`}>
        {value}
      </span>
      <button
        onClick={() => onChange(1)}
        disabled={value >= max}
        className="press flex h-7 w-7 items-center justify-center rounded-full bg-bg text-sm disabled:opacity-30"
        aria-label={`Mais ${label}`}
      >
        ＋
      </button>
    </div>
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

export const IconPeople = () => (
  <svg {...iconProps} aria-hidden>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19c.9-2.5 3-3.8 5.5-3.8s4.6 1.3 5.5 3.8" />
    <circle cx="16.5" cy="8" r="2.4" />
    <path d="M16.5 12.7c2.1.1 3.6 1.2 4.4 3.1" />
  </svg>
)

export const IconRecipe = () => (
  <svg {...iconProps} aria-hidden>
    <path d="M6 3v7a3 3 0 0 0 6 0V3" />
    <path d="M9 10v11" />
    <path d="M17 3c-1.5 1-2.5 3-2.5 5.5S15.5 13 17 14v7" />
  </svg>
)

export const IconPerson = () => (
  <svg {...iconProps} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="10" r="3" />
    <path d="M6.2 18.3c1.1-2.2 3.2-3.3 5.8-3.3s4.7 1.1 5.8 3.3" />
  </svg>
)
