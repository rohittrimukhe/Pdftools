import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowLeft, Clock3, House, Settings2 } from 'lucide-react';
import { Link, goBack, usePath } from '../router';
import { Logo } from '../../design/Logo';
import { GlobalDrop } from '../../files/SmartDrop';
import './shell.css';

const TABS = [
  { to: '/', label: 'Home', icon: House, match: (p: string) => p === '/' || p.startsWith('/tools/') },
  { to: '/recent', label: 'Recent', icon: Clock3, match: (p: string) => p === '/recent' },
  { to: '/settings', label: 'Settings', icon: Settings2, match: (p: string) => p === '/settings' || ['/about', '/licenses', '/privacy', '/design'].includes(p) },
] as const;

export const isTabRoot = (path: string) => TABS.some((tab) => tab.to === path);

/**
 * Phones get a bottom navigation bar (Material 3 / One UI), wider screens a
 * navigation rail. The same three destinations in the same order on both.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePath();
  const main = useRef<HTMLElement>(null);

  // A new screen starts at the top, and focus moves to it for keyboard and screen-reader users.
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [path]);

  return (
    <div className="shell">
      <a className="shell__skip" href="#main">Skip to content</a>
      <nav className="shell__rail" aria-label="Main">
        <Link to="/" className="shell__rail-logo" aria-label="Happy PDF home"><Logo size={44} /></Link>
        <TabLinks path={path} variant="rail" />
      </nav>
      <main id="main" ref={main} tabIndex={-1} className="shell__main">{children}</main>
      <GlobalDrop />
      <nav className="shell__bar" aria-label="Main">
        <TabLinks path={path} variant="bar" />
      </nav>
    </div>
  );
}

function TabLinks({ path, variant }: { path: string; variant: 'bar' | 'rail' }) {
  return (
    <ul className={`tabs tabs--${variant}`}>
      {TABS.map(({ to, label, icon: Icon, match }) => {
        const active = match(path);
        return (
          <li key={to}>
            <Link to={to} replace className="tabs__link" aria-current={active ? 'page' : undefined}>
              <span className="tabs__pill"><Icon aria-hidden size={22} strokeWidth={active ? 2.4 : 1.9} /></span>
              <span className="tabs__label">{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** One UI large title for tab roots: the screen's name with breathing room above it. */
export function LargeTitle({ title, subtitle, trailing }: { title: string; subtitle?: ReactNode; trailing?: ReactNode }) {
  return (
    <header className="large-title">
      <div className="large-title__text">
        <h1>{title}</h1>
        {subtitle && <p className="large-title__sub">{subtitle}</p>}
      </div>
      {trailing}
    </header>
  );
}

/** Inner screens: a back control that names where it goes, and the screen title. */
export function TopBar({ title, back = '/', backLabel = 'Home' }: { title: string; back?: string; backLabel?: string }) {
  return (
    <header className="top-bar">
      <button type="button" className="top-bar__back" onClick={() => goBack(back)}>
        <ArrowLeft aria-hidden size={22} className="top-bar__arrow" />
        <span>{backLabel}</span>
      </button>
      <h1 className="top-bar__title">{title}</h1>
    </header>
  );
}

/** Page width and gutters shared by every screen. */
export function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className={narrow ? 'page page--narrow' : 'page'}>{children}</div>;
}
