import React from 'react';
import { createRoot } from 'react-dom/client';  // ✅ named import
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const container = document.getElementById('root');
const root = createRoot(container); // ✅ correct API usage

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();
