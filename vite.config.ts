import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // dev: encaminha /api para o backend local (uvicorn)
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
