import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './design-system/tokens.css'
import './design-system/themes.css'
import './design-system/motion.css'
import './design-system/components.css'
import './styles.css'
import { initializeAppearanceStore } from './store/useAppearanceStore'

async function bootstrapRenderer() {
  await initializeAppearanceStore()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrapRenderer()
