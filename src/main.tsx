import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { installTheme } from './gantt/theme.ts'
import { localDraftStorage } from './gantt/draft.ts'

// Before the first render: the attribute it sets is what dhtmlx reads for its
// own palette, and nothing about it belongs to a component's lifecycle.
installTheme(localDraftStorage())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
