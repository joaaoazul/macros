import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startSync } from './lib/sync'

/** Quando a sincronização traz dados novos, remonta a App para reler o estado. */
function Root() {
  const [epoch, setEpoch] = useState(0)
  useEffect(() => startSync(() => setEpoch((n) => n + 1)), [])
  return <App key={epoch} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
