import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import { OverlayApp } from './App'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <OverlayApp />
    </StrictMode>
  )
}
