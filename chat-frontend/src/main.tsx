import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

let host = document.getElementById('transju-chatbot-root');
if (!host) {
  host = document.createElement('div');
  host.id = 'transju-chatbot-root';
  document.body.appendChild(host);
}

const discipline =
  (window as any).TRANSJU_EVENT ||
  host.getAttribute('data-discipline') ||
  'general';

// Création du Shadow DOM pour isoler complètement le CSS
const shadowRoot = host.shadowRoot || host.attachShadow({ mode: 'open' });

// Injection de widget.css uniquement à l'intérieur du Shadow DOM
const cssUrl = new URL('./widget.css', import.meta.url).href;
if (!shadowRoot.querySelector(`link[href="${cssUrl}"]`)) {
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = cssUrl;
  shadowRoot.appendChild(styleLink);
}

// Conteneur interne React dans le Shadow DOM
let shadowContainer = shadowRoot.getElementById('shadow-app-root');
if (!shadowContainer) {
  shadowContainer = document.createElement('div');
  shadowContainer.id = 'shadow-app-root';
  shadowRoot.appendChild(shadowContainer);
}

createRoot(shadowContainer).render(
  <StrictMode>
    <App discipline={discipline} />
  </StrictMode>,
);