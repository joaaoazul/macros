/**
 * Análise de prato por IA — envia a foto à API da Claude (Anthropic) com a
 * chave do próprio utilizador, guardada apenas neste dispositivo. O SDK é
 * importado sob demanda para não pesar no bundle principal.
 */

export interface PlateItem {
  name: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface PlateAnalysis {
  items: PlateItem[]
  notes: string
}

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do alimento em português de Portugal' },
          grams: { type: 'number', description: 'Peso estimado da porção em gramas' },
          kcal: { type: 'number', description: 'Calorias da porção' },
          protein: { type: 'number', description: 'Proteína da porção em gramas' },
          carbs: { type: 'number', description: 'Hidratos de carbono da porção em gramas' },
          fat: { type: 'number', description: 'Gordura da porção em gramas' },
        },
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
        additionalProperties: false,
      },
    },
    notes: { type: 'string', description: 'Nota curta sobre a confiança da estimativa e o que assumiste' },
  },
  required: ['items', 'notes'],
  additionalProperties: false,
} as const

const PROMPT = `Analisa esta fotografia de comida. Identifica cada alimento visível, estima o peso da porção em gramas e calcula os valores nutricionais dessa porção (não por 100 g). Usa nomes em português de Portugal. Sê realista nas porções — pratos portugueses típicos. Se não houver comida na imagem, devolve uma lista vazia e explica nas notas.`

export function getApiKey(): string {
  try {
    return localStorage.getItem('macros.apiKey') ?? ''
  } catch {
    return ''
  }
}

export function setApiKey(key: string) {
  localStorage.setItem('macros.apiKey', key.trim())
}

export async function analyzePlate(imageBase64: string, mediaType: string, apiKey: string): Promise<PlateAnalysis> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({
    apiKey,
    // a chave é do utilizador e vive no dispositivo dele — é o caso de uso suportado
    dangerouslyAllowBrowser: true,
  })

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('A análise foi recusada pelo modelo. Tenta outra fotografia.')
  }

  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('Resposta inesperada do modelo.')
  return JSON.parse(block.text) as PlateAnalysis
}

/** Reduz a foto para ≤1024 px e devolve base64 JPEG (menos tokens, upload mais rápido). */
export function downscaleImage(file: File, maxDim = 1024): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve({ base64: dataUrl.split(',')[1], mediaType: 'image/jpeg' })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler a imagem.'))
    }
    img.src = url
  })
}
