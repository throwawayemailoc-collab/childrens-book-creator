import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { migrateImagesToIndexedDB } from './stores/imageStore'

// Migrate any existing base64 images from localStorage to IndexedDB
migrateImagesToIndexedDB()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
