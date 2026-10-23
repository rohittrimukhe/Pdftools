import { useMemo, useState } from 'react';
import { ResultCard } from '../../files/ResultCard';
import { uploadSnapshot } from '../../privacy/uploadMonitor';
import { ChevronRight, FileStack, Minimize2, Moon, ShieldCheck, Sun, SunMoon } from 'lucide-react';
import { Button, Chip, IconButton, Note, Progress, Sheet, Switch } from '../../design/ui';
import { Logo } from '../../design/Logo';
import { useToast } from '../../design/toast';
import { useTheme, type ThemeChoice } from '../../app/theme';
import './gallery.css';

const SWATCHES = [
  ['Canvas', '--hp-canvas'], ['Card', '--hp-card'], ['Sunken', '--hp-sunken'],
  ['Text', '--hp-text'], ['Text 2', '--hp-text-2'], ['Text 3', '--hp-text-3'],
  ['Honey (primary)', '--hp-primary'], ['Sunny (container)', '--hp-primary-container'], ['Sun', '--hp-sun'],
  ['Outline', '--hp-outline'], ['Success', '--hp-success'], ['Danger', '--hp-danger'],
] as const;

const THEMES: Array<[ThemeChoice, string, typeof Sun]> = [['system', 'System', SunMoon], ['light', 'Light', Sun], ['dark', 'Dark', Moon]];

/** Every building block on one page: the reference for step 1 and its evidence screenshots. */
export function DesignGallery() {
  const toast = useToast();
  const [theme, setTheme] = useTheme();
  const [chip, setChip] = useState('All');
  const [on, setOn] = useState(true);
  const [sheet, setSheet] = useState(false);
  const sample = useMemo(() => new Blob(['%PDF-1.4\n% Happy PDF sample\n'], { type: 'application/pdf' }), []);
  const [since] = useState(uploadSnapshot);

  return (
    <div className="gal">
      <header className="gal__head">
        <Logo size={56} />
        <div>
          <h1>Happy PDF design system</h1>
          <p className="gal__lead">Sunny amber, Material 3 roles, One UI proportions.</p>
        </div>
      </header>

      <section aria-labelledby="g-theme">
        <h2 id="g-theme">Theme</h2>
        <div className="gal__row">
          {THEMES.map(([value, label, Icon]) => (
            <Chip key={value} selected={theme === value} onClick={() => setTheme(value)}>
              <Icon aria-hidden size={16} /> {label}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-labelledby="g-color">
        <h2 id="g-color">Colour</h2>
        <ul className="gal__swatches">
          {SWATCHES.map(([name, token]) => (
            <li key={token}>
              <span className="gal__swatch" style={{ background: `var(${token})` }} />
              <span className="gal__swatch-name">{name}</span>
              <code>{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="g-type">
        <h2 id="g-type">Type</h2>
        <div className="hp-card gal__type">
          <p style={{ fontSize: 'var(--hp-text-display)', fontWeight: 800, lineHeight: 1.15 }}>Every document tool.</p>
          <p style={{ fontSize: 'var(--hp-text-2xl)', fontWeight: 750 }}>Free. Private. Nothing uploaded.</p>
          <p style={{ fontSize: 'var(--hp-text-lg)', fontWeight: 600 }}>Merge, split and compress on your device</p>
          <p>Body text is Figtree at 16px, bundled with the app so no font is fetched from the web.</p>
          <p style={{ fontSize: 'var(--hp-text-sm)', color: 'var(--hp-text-3)' }}>Caption · 14px · secondary text</p>
        </div>
      </section>

      <section aria-labelledby="g-buttons">
        <h2 id="g-buttons">Buttons</h2>
        <div className="gal__row">
          <Button onClick={() => toast('Saved to Downloads')}>Save PDF</Button>
          <Button variant="tonal">Add files</Button>
          <Button variant="outlined">Cancel</Button>
          <Button variant="text">Learn more</Button>
          <Button variant="danger">Delete</Button>
          <Button disabled>Disabled</Button>
          <IconButton label="Privacy"><ShieldCheck aria-hidden /></IconButton>
        </div>
        <Button size="lg" block onClick={() => setSheet(true)}>Open a sheet</Button>
      </section>

      <section aria-labelledby="g-chips">
        <h2 id="g-chips">Filter chips and switch</h2>
        <div className="gal__row">
          {['All', 'Organise', 'Convert', 'Optimise', 'Secure'].map((name) => (
            <Chip key={name} selected={chip === name} onClick={() => setChip(name)}>{name}</Chip>
          ))}
        </div>
        <label className="gal__switch-row">
          <span>Keep finished files on this device</span>
          <Switch checked={on} onChange={setOn} label="Keep finished files on this device" />
        </label>
      </section>

      <section aria-labelledby="g-list">
        <h2 id="g-list">Grouped list</h2>
        <div className="hp-group">
          <button type="button" className="hp-row">
            <span className="hp-row__icon"><FileStack aria-hidden size={22} /></span>
            <span className="hp-row__body"><span className="hp-row__title">Merge PDF</span><span className="hp-row__sub">Several files in, one out</span></span>
            <ChevronRight aria-hidden className="hp-row__end" />
          </button>
          <button type="button" className="hp-row">
            <span className="hp-row__icon"><Minimize2 aria-hidden size={22} /></span>
            <span className="hp-row__body"><span className="hp-row__title">Compress PDF</span><span className="hp-row__sub">Smaller file, same pages</span></span>
            <ChevronRight aria-hidden className="hp-row__end" />
          </button>
        </div>
      </section>

      <section aria-labelledby="g-status">
        <h2 id="g-status">Status</h2>
        <div className="gal__stack">
          <div className="gal__row">
            <span className="hp-badge hp-badge--privacy"><ShieldCheck aria-hidden size={14} /> 0 bytes uploaded</span>
            <span className="hp-badge hp-badge--beta">Beta</span>
          </div>
          <Progress value={0.62} label="Compressing" />
          <Progress label="Reading file" />
          <Note tone="success">Done. report.pdf is 48 KB, under your 50 KB limit.</Note>
          <Note tone="warn">This file is large. It may take a minute on older phones.</Note>
          <Note tone="danger">This PDF needs its password before it can be opened.</Note>
          <div className="hp-field">
            <label htmlFor="g-target">Target size (KB)</label>
            <input id="g-target" className="hp-input" inputMode="numeric" defaultValue="50" />
          </div>
        </div>
      </section>

      <section aria-labelledby="g-result">
        <h2 id="g-result">Result card</h2>
        <ResultCard blob={sample} name="sample-merged.pdf" since={since} summary="Sample only. Not added to Recent." />
      </section>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Remove 3 files?"
        actions={<><Button variant="text" onClick={() => setSheet(false)}>Cancel</Button><Button onClick={() => { setSheet(false); toast('Removed 3 files'); }}>Remove</Button></>}
      >
        <p style={{ color: 'var(--hp-text-2)' }}>They are only removed from this list. Files you already saved stay where they are.</p>
      </Sheet>
    </div>
  );
}
