import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

let container = document.getElementById('transju-chatbot-root') || document.getElementById('root');
if (!container) {
  container = document.createElement('div');
  container.id = 'transju-chatbot-root';
  document.body.appendChild(container);
}

const discipline =
  (window as any).TRANSJU_EVENT ||
  container.getAttribute('data-discipline') ||
  'general';

createRoot(container).render(
  <StrictMode>
    <App discipline={discipline} />
  </StrictMode>,
);