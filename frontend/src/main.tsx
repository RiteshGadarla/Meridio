/**
 * FILE: frontend/src/main.tsx
 * PURPOSE: Browser entry point. Mounts <App /> into #root.
 * LAYER: Entry
 * USED BY: index.html
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { wakeBackend } from './lib/wake-backend';
import './styles/globals.css';

// Wake the sleeping API in the background before anything else loads.
void wakeBackend();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
