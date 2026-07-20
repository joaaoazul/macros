/** Limites partilhados das métricas corporais.
 *
 * Antes estes intervalos estavam duplicados (Onboarding, Perfil, PesoDetail e o
 * backend) com valores diferentes — um perfil válido num sítio era rejeitado
 * noutro. Ficam aqui, alinhados com backend/app/data/schemas.py. */

export interface Range {
  min: number
  max: number
}

export const WEIGHT_KG: Range = { min: 25, max: 400 }
export const HEIGHT_CM: Range = { min: 80, max: 250 }
export const AGE: Range = { min: 10, max: 120 }
/** % de gordura corporal plausível (Katch-McArdle). */
export const BODY_FAT_PCT: Range = { min: 3, max: 70 }

export function inRange(value: number, range: Range): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max
}
