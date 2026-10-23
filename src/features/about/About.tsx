import { ShieldCheck, WifiOff, Infinity as InfinityIcon, BadgeIndianRupee } from 'lucide-react';
import { Page, TopBar } from '../../app/shell/AppShell';
import { Logo } from '../../design/Logo';
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
          <p className="about__version">Version {__APP_VERSION__}</p>
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
      <p className="about__legal">© 2026 Rohit Trimukhe. All rights reserved.</p>
    </Page>
  );
}
