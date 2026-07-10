import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/global.css';
import { App } from '@/app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(
        `${import.meta.env.BASE_URL}sw.js?v=${encodeURIComponent(__SIMPLE_CAD_BUILD_ID__)}`,
        { scope: import.meta.env.BASE_URL },
      )
      .catch((error) => console.warn('Service worker registration failed', error));
  });
}
