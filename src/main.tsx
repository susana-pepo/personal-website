import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/base.css'
import { App } from './App'

// Development only: ?trace=1 records anything that flickers while the page arrives (see dev/flickerTrace.ts).
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('trace')) {
  void import('./dev/flickerTrace').then((m) => m.startFlickerTrace())
}

const root = document.getElementById('root')
if (!root) throw new Error('Missing #root element')

// Development only: /?notes opens the book notes page instead of the room (see dev/bookNotes).
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('notes')) {
  void import('./dev/bookNotes/BookNotes').then(({ BookNotes }) => {
    document.title = 'Book notes'
    createRoot(root).render(
      <StrictMode>
        <BookNotes />
      </StrictMode>,
    )
  })
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
