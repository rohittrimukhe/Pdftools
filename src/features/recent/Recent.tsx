import { Clock3 } from 'lucide-react';
import { LargeTitle, Page } from '../../app/shell/AppShell';
import { Link } from '../../app/router';

export function Recent() {
  return (
    <Page narrow>
      <LargeTitle title="Recent" />
      <div className="hp-card empty-state">
        <span className="empty-state__icon"><Clock3 aria-hidden size={28} /></span>
        <p className="empty-state__title">Nothing here yet</p>
        <p className="empty-state__body">Files you make with Happy PDF will be listed here, kept only on this device.</p>
        <Link to="/" className="hp-btn hp-btn--tonal">Browse tools</Link>
      </div>
    </Page>
  );
}
