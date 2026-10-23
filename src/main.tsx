import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/figtree';
import './design/tokens.css';
import './design/base.css';
import './design/components.css';
import { installUploadMonitor } from './privacy/uploadMonitor';
import { App } from './app/App';
import { registerOffline } from './app/offline';

installUploadMonitor();
registerOffline();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
