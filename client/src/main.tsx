import { createRoot } from 'react-dom/client'
import { installDevKnownThreeWarningFilters } from './devKnownThreeWarnings'
import './index.css'
import App from './App.tsx'

installDevKnownThreeWarningFilters()

createRoot(document.getElementById('root')!).render(<App />)
