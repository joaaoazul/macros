/** Análise de refeições por IA (BYOK): a chave Anthropic fica só em localStorage neste dispositivo. */

import { api } from './api'

const KEY_STORAGE = 'macros.anthropicKey'

export function getAnthropicKey(): string | null {
  return localStorage.getItem(KEY_STORAGE)
}

export function setAnthropicKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key)
}

export function clearAnthropicKey() {
  localStorage.removeItem(KEY_STORAGE)
}

export interface AnalyzedFood {
  name: string
  emoji: string
  grams: number
  unit: 'g' | 'ml'
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface AnalyzeMealResult {
  foods: AnalyzedFood[]
  notes?: string | null
}

export async function analyzeMeal(input: { description?: string; imageBase64?: string }): Promise<AnalyzeMealResult> {
  const apiKey = getAnthropicKey()
  if (!apiKey) throw new Error('Configura a tua chave Anthropic no Perfil.')
  return api<AnalyzeMealResult>('/ai/analyze-meal', {
    method: 'POST',
    body: { ...input, apiKey },
  })
}

export interface FoodTips {
  summary: string
  uses: string[]
  pairs_with: string[]
}

export async function foodTips(input: {
  name: string
  brand?: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  unit: 'g' | 'ml'
}): Promise<FoodTips> {
  const apiKey = getAnthropicKey()
  if (!apiKey) throw new Error('Configura a tua chave Anthropic no Perfil para veres sugestões.')
  return api<FoodTips>('/ai/food-tips', { method: 'POST', body: { ...input, apiKey } })
}

/** Reduz a foto para ≤maxPx JPEG 0.8 (corrige orientação EXIF via createImageBitmap). */
export async function downscaleImage(file: File, maxPx = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível processar a imagem.')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  return dataUrl.split(',', 2)[1]
}
