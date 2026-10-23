import { forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Check } from 'lucide-react';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

type ButtonVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'filled', size = 'md', block = false, icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx('hp-btn', `hp-btn--${variant}`, size === 'lg' && 'hp-btn--lg', block && 'hp-btn--block', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({ label, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className="hp-icon-btn" aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="hp-chip" aria-pressed={selected} onClick={onClick}>
      {selected && <Check aria-hidden size={16} strokeWidth={2.6} />}
      {children}
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <span className="hp-switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="hp-switch__track" aria-hidden />
      <span className="hp-switch__thumb" aria-hidden />
    </span>
  );
}

/** `value` is 0..1, or undefined while the length of the job is unknown. */
export function Progress({ value, label }: { value?: number; label: string }) {
  const known = value !== undefined;
  return (
    <div
      className={cx('hp-progress', !known && 'hp-progress--indeterminate')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? Math.round(value * 100) : undefined}
    >
      <div className="hp-progress__bar" style={known ? { width: `${Math.max(0, Math.min(1, value)) * 100}%` } : undefined} />
    </div>
  );
}

export function Note({ tone = 'info', icon, children }: { tone?: 'info' | 'warn' | 'danger' | 'success'; icon?: ReactNode; children: ReactNode }) {
  return (
    <p className={`hp-note hp-note--${tone}`}>
      {icon && <span aria-hidden>{icon}</span>}
      <span>{children}</span>
    </p>
  );
}

/** A modal sheet: slides up from the bottom on phones, centred on wider screens. */
export function Sheet({ open, onClose, title, children, actions }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="hp-sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => { if (event.target === ref.current) onClose(); }}
    >
      <div className="hp-sheet__inner">
        <span className="hp-sheet__handle" aria-hidden />
        <h2 id={titleId}>{title}</h2>
        {children}
        {actions && <div className="hp-sheet__actions">{actions}</div>}
      </div>
    </dialog>
  );
}
