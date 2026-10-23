import { useEffect, useState, type ReactNode } from 'react';
import { Eye, EyeOff, KeyRound, RotateCcw } from 'lucide-react';
import { FileIcon, iconKindForType } from '../../files/FileIcon';
import { Button, IconButton, Note, Progress } from '../../design/ui';
import { formatBytes } from '../../lib/format';

export function FileHead({ file, detail, onReset }: { file: File; detail?: string; onReset: () => void }) {
  return (
    <div className="hp-group file-head">
      <span className="hp-row__icon"><FileIcon kind={iconKindForType(file.type, file.name)} /></span>
      <span className="file-head__body">
        <span className="file-head__name">{file.name}</span>
        <span className="file-head__meta">{formatBytes(file.size)}{detail ? ` · ${detail}` : ''}</span>
      </span>
      <IconButton label="Choose a different file" onClick={onReset}><RotateCcw aria-hidden size={20} /></IconButton>
    </div>
  );
}

export function PasswordField({ id, label, value, onChange, autoComplete = 'current-password' }: {
  id: string; label: string; value: string; onChange: (value: string) => void; autoComplete?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="hp-field">
      <label htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input id={id} className="hp-input" type={shown ? 'text' : 'password'} value={value} autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)} style={{ paddingInlineEnd: 52 }} spellCheck={false} />
        <span style={{ position: 'absolute', insetInlineEnd: 0, top: 0 }}>
          <IconButton label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown(!shown)}>
            {shown ? <EyeOff aria-hidden size={20} /> : <Eye aria-hidden size={20} />}
          </IconButton>
        </span>
      </div>
    </div>
  );
}

/** Asks for the password of a protected PDF. The password stays in memory on this device. */
export function UnlockPrompt({ error, onUnlock }: { error?: string; onUnlock: (password: string) => void }) {
  const [password, setPassword] = useState('');
  return (
    <form className="hp-card options" onSubmit={(e) => { e.preventDefault(); onUnlock(password); }}>
      <Note tone="warn" icon={<KeyRound size={18} />}>This PDF is protected. Enter its password to open it.</Note>
      <PasswordField id="pdf-password" label="Password" value={password} onChange={setPassword} />
      {error && <Note tone="danger">{error}</Note>}
      <Button type="submit" disabled={password.length === 0}>Open PDF</Button>
    </form>
  );
}

export function Loading({ label }: { label: string }) {
  return <div className="run"><Progress label={label} /><p className="run__status">{label}…</p></div>;
}

/** The main action, its progress while running, and any error. */
export function RunPanel({ label, busyLabel, disabled, busy, progress, error, onRun, children }: {
  label: string; busyLabel: string; disabled?: boolean; busy: boolean; progress?: number; error?: string; onRun: () => void; children?: ReactNode;
}) {
  return (
    <div className="run">
      {children}
      {busy ? (
        <>
          <Progress value={progress} label={busyLabel} />
          <p className="run__status" role="status">{busyLabel}{progress !== undefined ? ` ${Math.round(progress * 100)}%` : '…'}</p>
        </>
      ) : (
        <Button size="lg" block disabled={disabled} onClick={onRun}>{label}</Button>
      )}
      {error && <Note tone="danger">{error}</Note>}
    </div>
  );
}

export function RangeField({ id, label, min, max, step = 1, value, onChange, format = String }: {
  id: string; label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="range">
      <div className="range__top"><label htmlFor={id} className="options__label">{label}</label><span>{format(value)}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** Keeps object URLs alive while shown and releases them afterwards. */
export function useObjectUrls(urls: string[]) {
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
}
