/**
 * Gera a arte-fonte para os ícones e splash do Android (pasta `assets/`).
 *
 * O ícone da PWA (`public/icon-512.png`) é um PNG achatado, sem camadas — não
 * dá para separar os anéis do fundo, e um ícone adaptativo precisa de fundo e
 * primeiro plano em ficheiros distintos. Por isso redesenhamos aqui a mesma
 * arte em SVG: as medidas e as cores foram tiradas do PNG original, para o
 * ícone da app instalada ficar igual ao da PWA.
 *
 *   node scripts/generate-android-assets.mjs
 *   npx capacitor-assets generate --android
 */

import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

// Gradiente do fundo, amostrado nos cantos do PNG original.
const BG_FROM = '#0a83fe'
const BG_TO = '#0055d4'

// Anéis, em coordenadas do PNG de 512px: raio do centro do traço, espessura 32.
// Todos arrancam às 12h e correm no sentido dos ponteiros.
const STROKE = 32
const RINGS = [
  { radius: 151, sweep: 251, color: '#5ef2b8' }, // exterior
  { radius: 104.5, sweep: 232.5, color: '#ffffff' }, // meio
  { radius: 57.5, sweep: 196, color: '#ffd60a' }, // interior
]

/** O anel mais exterior ocupa este raio na arte de origem (512px, centro 256). */
const ART_RADIUS = RINGS[0].radius + STROKE / 2

/**
 * Desenha os anéis num SVG quadrado de `size`px.
 * `coverage` = fracção da largura ocupada pelo diâmetro exterior dos anéis.
 */
function ringsSvg(size, { coverage, background }) {
  const c = size / 2
  const scale = (coverage * size) / (2 * ART_RADIUS)
  const stroke = STROKE * scale

  const arcs = RINGS.map(({ radius, sweep, color }) => {
    const r = radius * scale
    const circumference = 2 * Math.PI * r
    // O traço tem pontas redondas, que acrescentam meia espessura em cada topo;
    // encurtamos o tracejado outro tanto para o arco ficar do tamanho medido.
    const capDeg = ((stroke / 2 / r) * 180) / Math.PI
    const dash = (circumference * Math.max(sweep - 2 * capDeg, 0)) / 360
    return `
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}"
            stroke-opacity="0.18" stroke-width="${stroke}" />
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}"
            stroke-width="${stroke}" stroke-linecap="round"
            stroke-dasharray="${dash} ${circumference - dash}"
            transform="rotate(-90 ${c} ${c})" />`
  }).join('')

  const bg = background
    ? `<rect width="${size}" height="${size}" fill="url(#bg)" />`
    : ''

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG_FROM}" />
      <stop offset="1" stop-color="${BG_TO}" />
    </linearGradient>
  </defs>
  ${bg}${arcs}
</svg>`)
}

function gradientSvg(size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG_FROM}" />
      <stop offset="1" stop-color="${BG_TO}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" />
</svg>`)
}

const png = (svg) => sharp(svg).png().toBuffer()

await mkdir('assets', { recursive: true })

// Ícone clássico: a arte toda, como no PNG da PWA (65% de cobertura).
await writeFile('assets/icon.png', await png(ringsSvg(1024, { coverage: 0.65, background: true })))

// Ícone adaptativo: fundo e primeiro plano em ficheiros separados. O gerador
// aplica a ambos um inset de 16.7%, que é exactamente o que encolhe a tela de
// 108dp para o círculo visível de 72dp — ou seja, o `coverage` abaixo acaba
// por ser a fracção desse círculo ocupada pelos anéis. 0.72 deixa-os
// folgados dentro da zona segura, sem a máscara os cortar.
await writeFile('assets/icon-background.png', await png(gradientSvg(1024)))
await writeFile(
  'assets/icon-foreground.png',
  await png(ringsSvg(1024, { coverage: 0.72, background: false })),
)

// Splash: fundo preto (igual ao `backgroundColor` do capacitor.config.ts) com
// os anéis ao centro. É recortada ao centro, daí a arte ficar bem no meio.
const splash = await sharp(ringsSvg(2732, { coverage: 0.16, background: false }))
  .flatten({ background: '#000000' })
  .png()
  .toBuffer()
await writeFile('assets/splash.png', splash)
await writeFile('assets/splash-dark.png', splash)

console.log('assets/ gerado: icon, icon-background, icon-foreground, splash, splash-dark')
