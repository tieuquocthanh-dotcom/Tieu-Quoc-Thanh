console.log("main.tsx module loading...");
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

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

// Register Service Worker for PWA
// Service Worker registration removed to prevent caching issues during development
/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
*/
