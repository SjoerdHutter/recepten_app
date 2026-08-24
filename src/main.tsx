import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Het element #root ontbreekt in index.html');

createRoot(root).render(
  <StrictMode>
    {/* Hash-routing: op GitHub Pages werkt een diepe link dan zonder omweg,
        ook als de app offline vanuit de service worker start. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
