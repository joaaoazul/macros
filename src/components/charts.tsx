import { useState } from 'react'

export interface BarPoint {
  iso: string
  label: string
  value: number
  logged: boolean
}

interface BarChartProps {
  points: BarPoint[]
  target?: number
  targetLabel?: string
  ariaLabel: string
  barColor?: string
  formatValue?: (v: number) => string
  /** linha extra no tooltip (ex.: macros do dia) */
  tooltipExtra?: (p: BarPoint, index: number) => string | null
  /** segundo toque numa barra já selecionada */
  onBarClick?: (p: BarPoint) => void
}

/**
 * Barras genéricas com linha de referência opcional e tooltip por barra.
 * Primeiro toque seleciona/mostra o tooltip; segundo toque na mesma barra dispara onBarClick.
 */
export function BarChart({
  points,
  target,
  targetLabel,
  ariaLabel,
  barColor = 'var(--accent)',
  formatValue = (v) => Math.round(v).toLocaleString('pt-PT'),
  tooltipExtra,
  onBarClick,
}: BarChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const n = points.length
  const W = 320
  const H = 150
  const padTop = 18
  const padBottom = 22
  const plotH = H - padTop - padBottom
  const max = Math.max(target !== undefined ? target * 1.2 : 0, ...points.map((p) => p.value)) || 1
  const slot = W / n
  const barW = Math.min(22, slot * 0.55)

  const y = (v: number) => padTop + plotH * (1 - v / max)

  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        {target !== undefined && (
          <>
            <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="var(--muted)" strokeWidth={1} strokeDasharray="4 3" />
            <text x={W} y={y(target) - 4} textAnchor="end" fontSize={9} fill="var(--muted)">
              {targetLabel ?? `alvo ${formatValue(target)}`}
            </text>
          </>
        )}

        <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--line)" strokeWidth={1} />

        {points.map((p, i) => {
          const cx = slot * i + slot / 2
          const barH = p.logged ? Math.max(H - padBottom - y(p.value), 2) : 0
          const isHover = hover === i
          return (
            <g key={p.iso}>
              <rect
                x={slot * i}
                y={0}
                width={slot}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  if (isHover && p.logged && onBarClick) onBarClick(p)
                  else setHover(isHover ? null : i)
                }}
              />
              {p.logged ? (
                <rect
                  x={cx - barW / 2}
                  y={H - padBottom - barH}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={barColor}
                  opacity={hover === null || isHover ? 1 : 0.45}
                  pointerEvents="none"
                />
              ) : (
                <circle cx={cx} cy={H - padBottom - 4} r={2} fill="var(--line)" pointerEvents="none" />
              )}
              <text x={cx} y={H - 7} textAnchor="middle" fontSize={n > 8 ? 8 : 10} fill="var(--muted)" className="capitalize" pointerEvents="none">
                {p.label}
              </text>
              {isHover && p.logged && (
                <text x={cx} y={H - padBottom - barH - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--ink)" pointerEvents="none">
                  {formatValue(p.value)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hover !== null && points[hover].logged && (
        <div
          className="pointer-events-none absolute -top-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md"
          style={{ left: `${Math.min(Math.max((hover + 0.5) * (100 / n) - 18, 0), 62)}%` }}
        >
          <div className="font-semibold capitalize">{points[hover].label}</div>
          <div className="mt-0.5 tabular-nums text-ink-2">
            {formatValue(points[hover].value)}
            {tooltipExtra?.(points[hover], hover) && <> · {tooltipExtra(points[hover], hover)}</>}
          </div>
          {onBarClick && <div className="mt-0.5 text-[10px] text-muted">toca outra vez para ver o dia</div>}
        </div>
      )}
    </div>
  )
}

export interface LinePoint {
  iso: string
  label: string
  value: number
}

/** Linha simples de evolução (ex.: peso) com pontos e último valor destacado. */
export function LineChart({ points, ariaLabel, suffix = '' }: { points: LinePoint[]; ariaLabel: string; suffix?: string }) {
  const W = 320
  const H = 150
  const padTop = 20
  const padBottom = 22
  const padX = 14
  const plotH = H - padTop - padBottom
  const plotW = W - padX * 2

  if (points.length === 0) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const x = (i: number) => (points.length === 1 ? W / 2 : padX + (plotW * i) / (points.length - 1))
  const y = (v: number) => padTop + plotH * (1 - (v - min) / range)

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={ariaLabel}>
      <line x1={0} x2={W} y1={H - padBottom} y2={H - padBottom} stroke="var(--line)" strokeWidth={1} />
      {points.length > 1 && <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />}
      {points.map((p, i) => (
        <circle key={p.iso} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5} fill="var(--accent)" />
      ))}
      <text x={x(points.length - 1)} y={y(last.value) - 8} textAnchor={points.length === 1 ? 'middle' : 'end'} fontSize={11} fontWeight={700} fill="var(--ink)">
        {last.value.toLocaleString('pt-PT')}
        {suffix}
      </text>
      <text x={padX} y={H - 7} textAnchor="start" fontSize={9} fill="var(--muted)">
        {points[0].label}
      </text>
      <text x={W - padX} y={H - 7} textAnchor="end" fontSize={9} fill="var(--muted)">
        {last.label}
      </text>
    </svg>
  )
}
