import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext.tsx';

// Suppress benign WebSocket errors in certain environments
const suppressWebsocketErrors = (event: any) => {
  const message = event.reason?.message || event.message || event.reason?.toString() || '';
  if (
    message.includes('WebSocket') || 
    message.includes('WebSocket closed without opened') ||
    message.includes('failed to connect to websocket')
  ) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
};

window.addEventListener('unhandledrejection', suppressWebsocketErrors);
window.addEventListener('error', suppressWebsocketErrors);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
