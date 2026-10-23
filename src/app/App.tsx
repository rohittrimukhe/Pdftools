import { ToastProvider } from '../design/toast';
import { DesignGallery } from '../features/gallery/DesignGallery';
import { usePath } from './router';

export function App() {
  const path = usePath();
  return (
    <ToastProvider>
      {path === '/design' ? (
        <DesignGallery />
      ) : (
        <main className="hp-placeholder">
          <h1>Happy PDF</h1>
          <p>Every document tool. Free. Private. Nothing uploaded.</p>
        </main>
      )}
    </ToastProvider>
  );
}
