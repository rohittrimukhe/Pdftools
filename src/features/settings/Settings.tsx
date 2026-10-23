import { useState, type ReactNode } from 'react';
import { ChevronRight, FileLock2, Info, Moon, Palette, ScrollText, Sun, SunMoon } from 'lucide-react';
import { LargeTitle, Page } from '../../app/shell/AppShell';
import { Link } from '../../app/router';
import { Button, Chip, Switch } from '../../design/ui';
import { useToast } from '../../design/toast';
import { RETAIN_DAYS, clearRecent, keepRecent, setKeepRecent } from '../../files/recent';
import { useTheme, type ThemeChoice } from '../../app/theme';
import './settings.css';

const THEMES: Array<[ThemeChoice, string, typeof Sun]> = [['system', 'System', SunMoon], ['light', 'Light', Sun], ['dark', 'Dark', Moon]];

export function Settings() {
  const [theme, setTheme] = useTheme();
  const [keep, setKeep] = useState(keepRecent);
  const toast = useToast();
  return (
    <Page narrow>
      <LargeTitle title="Settings" />

      <h2 className="hp-group__title">Appearance</h2>
      <div className="hp-card settings__block">
        <p id="theme-label" className="settings__label">Theme</p>
        <div className="settings__chips" role="group" aria-labelledby="theme-label">
          {THEMES.map(([value, label, Icon]) => (
            <Chip key={value} selected={theme === value} onClick={() => setTheme(value)}>
              <Icon aria-hidden size={16} />{label}
            </Chip>
          ))}
        </div>
        <p className="settings__hint">Saved on this device only.</p>
      </div>

      <h2 className="hp-group__title">Privacy</h2>
      <div className="hp-card settings__block">
        <div className="settings__switch-row">
          <span>
            <span className="settings__label">Keep recent files on this device</span>
            <span className="settings__hint">Files you make stay in Recent for {RETAIN_DAYS} days, then are removed. Never uploaded.</span>
          </span>
          <Switch checked={keep} onChange={(next) => { setKeep(next); setKeepRecent(next); }} label="Keep recent files on this device" />
        </div>
        <Button variant="outlined" onClick={async () => { await clearRecent(); toast('Recent files cleared'); }}>Clear recent files now</Button>
      </div>
      <div className="hp-card settings__block">
        <p className="settings__statement">
          Happy PDF works on your device. Your files are never uploaded, and we keep no account, history or
          copy of your documents on any server.
        </p>
      </div>

      <h2 className="hp-group__title">About</h2>
      <ul className="hp-group settings__links">
        <NavRow to="/about" icon={<Info aria-hidden size={22} />} title="About Happy PDF" sub="Version and what we stand for" />
        <NavRow to="/privacy" icon={<FileLock2 aria-hidden size={22} />} title="Privacy policy" sub="What happens to your files" />
        <NavRow to="/licenses" icon={<ScrollText aria-hidden size={22} />} title="Open-source licenses" sub="Libraries Happy PDF is built with" />
        <NavRow to="/design" icon={<Palette aria-hidden size={22} />} title="Design system" sub="Colours, type and components" />
      </ul>
    </Page>
  );
}

function NavRow({ to, icon, title, sub }: { to: string; icon: ReactNode; title: string; sub: string }) {
  return (
    <li>
      <Link to={to} className="hp-row">
        <span className="hp-row__icon">{icon}</span>
        <span className="hp-row__body"><span className="hp-row__title">{title}</span><span className="hp-row__sub">{sub}</span></span>
        <ChevronRight aria-hidden className="hp-row__end" />
      </Link>
    </li>
  );
}
