import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/figtree';
import './design/tokens.css';
import './design/base.css';
import './design/components.css';
import { installUploadMonitor } from './privacy/uploadMonitor';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { registerOffline } from './app/offline';
import { historyDepth } from './app/router';
import { isNative, runtime } from './platform/runtime';
import { installBackButton, installNativeSave } from './platform/native';

installUploadMonitor();
registerOffline({ native: isNative });
void installNativeSave(runtime);
void installBackButton(runtime, () => historyDepth() > 0);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
