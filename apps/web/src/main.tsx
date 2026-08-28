/**
 * GTX Rush Entry Point
 *
 * Telegram initialization is handled by the TelegramProvider.
 * This file just mounts the React app.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
