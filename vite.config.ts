import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // caminhos relativos para funcionar no GitHub Pages (subcaminho /macros/)
  base: './',
  plugins: [react(), tailwindcss()],
})
