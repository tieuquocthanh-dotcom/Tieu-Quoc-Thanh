console.log("main.tsx module loading...");
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Suppress errors from Chrome extensions to prevent Vite error overlay
window.addEventListener('error', (e) => {
  if (e.filename && e.filename.includes('chrome-extension://')) {
    e.preventDefault();
    console.warn('Suppressed extension error:', e.message);
  } else if (e.message && e.message.includes('chrome-extension://')) {
    e.preventDefault();
    console.warn('Suppressed extension error:', e.message);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.stack && e.reason.stack.includes('chrome-extension://')) {
    e.preventDefault();
    console.warn('Suppressed extension promise rejection:', e.reason);
  }
});

console.log("Imports in main.tsx complete.");
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element to mount to");
} else {
  try {
    console.log("Creating React root and rendering App...");
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    console.log("Initial render complete.");
  } catch (error) {
    console.error("Failed to render app:", error);
  }
}
