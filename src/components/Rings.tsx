interface Ring {
  value: number
  target: number
  colorVar: string
  label: string
}

/** Anéis concêntricos à Apple Fitness: exterior hidratos, meio proteína, interior gordura. */
export default function Rings({ rings, size = 150, children }: { rings: Ring[]; size?: number; children?: React.ReactNode }) {
  const stroke = 13
  const gap = 4
  const cx = size / 2

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="img"
      aria-label={rings.map((r) => `${r.label}: ${Math.round(r.value)} de ${Math.round(r.target)}`).join(', ')}
    >
      <svg width={size} height={size} className="-rotate-90">
        {rings.map((r, i) => {
          const radius = cx - stroke / 2 - i * (stroke + gap)
          const c = 2 * Math.PI * radius
          const pct = r.target > 0 ? Math.min(r.value / r.target, 1) : 0
          return (
            <g key={r.label}>
              <circle cx={cx} cy={cx} r={radius} fill="none" stroke={`var(${r.colorVar})`} strokeOpacity={0.18} strokeWidth={stroke} />
              {pct > 0 && (
                <circle
                  cx={cx}
                  cy={cx}
                  r={radius}
                  fill="none"
                  stroke={`var(${r.colorVar})`}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - pct)}
                  style={{ transition: 'stroke-dashoffset 600ms ease' }}
                />
              )}
            </g>
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
