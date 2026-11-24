import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/dm-sans/opsz.css'
import './styles/tokens.css'
import './styles/base.css'
import { App } from './App'

// Development only: ?trace=1 records anything that flickers while the page arrives (see dev/flickerTrace.ts).
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('trace')) {
  void import('./dev/flickerTrace').then((m) => m.startFlickerTrace())
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
