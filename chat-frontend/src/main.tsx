import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

let container = document.getElementById('root') || document.getElementById('transju-chatbot-root');
if (!container) {
  container = document.createElement('div');
  container.id = 'transju-chatbot-root';
  document.body.appendChild(container);
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
