/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origem absoluta da API (ex.: `https://macros.joaoazul.dev`).
   * Vazio na web — aí a API é same-origin e o nginx faz proxy de `/api`.
   * Obrigatório na build nativa, onde os assets vivem em `https://localhost`.
   */
  readonly VITE_API_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
