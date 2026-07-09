interface Props {
  value: number
  target: number
  size?: number
  stroke?: number
  color: string
  children?: React.ReactNode
  label: string
}

/** Anel de progresso em SVG — a cor identifica o macro, o texto fica em tinta. */
export default function MacroRing({ value, target, size = 72, stroke = 7, color, children, label }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(value / target, 1) : 0

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={`${label}: ${Math.round(value)} de ${Math.round(target)}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 500ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
