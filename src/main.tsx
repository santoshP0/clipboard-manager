import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Desktop app, not a web page: no Reload / Inspect Element menu. Text fields
// keep theirs, since that's where cut/paste/spelling actually belong.
document.addEventListener('contextmenu', (e) => {
  if (!(e.target as HTMLElement).closest('input,textarea')) e.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
