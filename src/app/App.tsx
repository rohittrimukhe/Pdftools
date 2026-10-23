import { lazy, Suspense } from 'react';
import { ToastProvider } from '../design/toast';
import { AppShell } from './shell/AppShell';
import { usePath } from './router';
import { Home } from '../features/home/Home';
import { NotFound } from './NotFound';

const Settings = lazy(() => import('../features/settings/Settings').then((m) => ({ default: m.Settings })));
const Recent = lazy(() => import('../features/recent/Recent').then((m) => ({ default: m.Recent })));
const About = lazy(() => import('../features/about/About').then((m) => ({ default: m.About })));
const Privacy = lazy(() => import('../features/about/Privacy').then((m) => ({ default: m.Privacy })));
const Licenses = lazy(() => import('../features/about/Licenses').then((m) => ({ default: m.Licenses })));
const DesignGallery = lazy(() => import('../features/gallery/DesignGallery').then((m) => ({ default: m.DesignGallery })));
const ToolPage = lazy(() => import('../features/tools/ToolPage').then((m) => ({ default: m.ToolPage })));

function Screen({ path }: { path: string }) {
  if (path === '/') return <Home />;
  if (path === '/recent') return <Recent />;
  if (path === '/settings') return <Settings />;
  if (path === '/about') return <About />;
  if (path === '/privacy') return <Privacy />;
  if (path === '/licenses') return <Licenses />;
  if (path === '/design') return <DesignGallery />;
  const tool = /^\/tools\/([a-z0-9-]+)\/?$/.exec(path);
  if (tool?.[1]) return <ToolPage id={tool[1]} />;
  return <NotFound />;
}

export function App() {
  const path = usePath();
  return (
    <ToastProvider>
      <AppShell>
        <Suspense fallback={null}>
          <Screen path={path} />
        </Suspense>
      </AppShell>
    </ToastProvider>
  );
}
