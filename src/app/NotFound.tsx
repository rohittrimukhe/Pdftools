import { Page, TopBar } from './shell/AppShell';
import { Link } from './router';

export function NotFound() {
  return (
    <Page narrow>
      <TopBar title="Page not found" />
      <div className="hp-card empty-state">
        <p className="empty-state__title">This page doesn’t exist</p>
        <p className="empty-state__body">The link may be old or mistyped.</p>
        <Link to="/" className="hp-btn hp-btn--filled">Go to Home</Link>
      </div>
    </Page>
  );
}
