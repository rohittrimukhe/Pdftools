import { ShieldCheck, WifiOff, Infinity as InfinityIcon, BadgeIndianRupee } from 'lucide-react';
import { Page, TopBar } from '../../app/shell/AppShell';
import { Logo } from '../../design/Logo';
import { Link } from '../../app/router';
import { FEEDBACK_URL } from '../../app/links';
import './about.css';

const PROMISES = [
  { icon: ShieldCheck, title: 'Nothing uploaded', body: 'Every tool runs on your device. Your files never reach a server.' },
  { icon: BadgeIndianRupee, title: 'Free', body: 'No sign-up, no subscription, no watermark.' },
  { icon: InfinityIcon, title: 'No limits', body: 'No daily caps and no file-count limits. Large files depend only on your device.' },
  { icon: WifiOff, title: 'Works offline', body: 'Once the app has loaded, the tools keep working without internet.' },
];

export function About() {
  return (
    <Page narrow>
      <TopBar title="About" back="/settings" backLabel="Settings" />
      <div className="about__hero hp-card">
        <Logo size={72} />
        <div>
          <p className="about__name">Happy PDF</p>
          <p className="about__tag">Every document tool. Free. Private. Nothing uploaded.</p>
          <p className="about__version">Version {__APP_VERSION__} · Public preview</p>
        </div>
      </div>
      <ul className="about__promises">
        {PROMISES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="hp-card">
            <Icon aria-hidden size={24} className="about__icon" />
            <p className="about__ptitle">{title}</p>
            <p className="about__pbody">{body}</p>
          </li>
        ))}
      </ul>
      <nav className="about__links" aria-label="More about Happy PDF">
        <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">Report a problem or suggest a tool</a>
        <Link to="/privacy">Privacy policy</Link>
        <Link to="/terms">Terms of use</Link>
        <Link to="/licenses">Open-source licenses</Link>
      </nav>
      <p className="about__legal">© 2026 Rohit Trimukhe. All rights reserved.</p>
    </Page>
  );
}
