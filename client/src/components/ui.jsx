import { useEffect } from 'react';
import { createPortal } from 'react-dom';

const cx = (...c) => c.filter(Boolean).join(' ');

// ---- Buttons (prototype: .btn, .btn-primary, .btn-ghost, .btn-danger, .btn-sm) ----
const BTN = {
  primary: 'bg-pv-accent text-white hover:bg-pv-accent2',
  secondary: 'bg-white text-pv-text2 border-[1.5px] border-pv-border2 shadow-pv-sm hover:bg-pv-bg',
  ghost: 'text-pv-text3 hover:bg-pv-bg hover:text-pv-text',
  danger: 'bg-pv-red text-white hover:bg-red-700',
  dark: 'bg-pv-text text-white hover:bg-black',
};
export function Button({ variant = 'primary', size, className, ...p }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-bold tracking-[.02em] transition hover:-translate-y-px active:translate-y-0',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pv-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-[18px] py-[9px] text-[13px]',
        BTN[variant], className,
      )}
      {...p}
    />
  );
}

// ---- Form controls (prototype: input/select/textarea + .form-label) ----
const INPUT = 'block w-full rounded-[7px] border-[1.5px] border-pv-border2 bg-white px-3 py-2 text-[13px] text-pv-text outline-none transition placeholder:text-pv-text4 focus:border-pv-accent focus:ring-[3px] focus:ring-pv-accent/15 disabled:bg-pv-bg';

export function Field({ label, error, required, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold tracking-[.07em] text-pv-text3 uppercase">
        {label}{required && <span className="text-pv-red"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-pv-text4">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-semibold text-pv-red">{error}</span>}
    </label>
  );
}
export const Input = ({ className, ...p }) => <input className={cx(INPUT, className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea rows={3} className={cx(INPUT, 'min-h-[72px] resize-y', className)} {...p} />;
export function Select({ options = [], placeholder, className, ...p }) {
  return (
    <select className={cx(INPUT, 'pr-8', className)} {...p}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full transition', checked ? 'bg-pv-accent' : 'bg-pv-bg5')}>
      <span className={cx('absolute top-[3px] size-4 rounded-full bg-white shadow transition', checked ? 'left-[19px]' : 'left-[3px]')} />
    </button>
  );
}

// ---- Surfaces ----
export function Card({ className, ...p }) {
  return <div className={cx('rounded-xl border-[1.5px] border-pv-border bg-white shadow-pv-sm', className)} {...p} />;
}

// Tone palette for badges/status (prototype badge colours)
export const TONE = {
  blue: { badge: 'bg-pv-sky text-pv-accent border-[#a8d0f0]', bar: 'fill-pv-accent', dot: 'bg-pv-accent', text: 'text-pv-accent', border: 'border-l-pv-accent' },
  green: { badge: 'bg-[#f0fdf4] text-pv-green border-[#bbf7d0]', bar: 'fill-pv-green', dot: 'bg-pv-green', text: 'text-pv-green', border: 'border-l-pv-green' },
  purple: { badge: 'bg-[#f4f0ff] text-[#5f40b2] border-[#d0c8f8]', bar: 'fill-pv-purple', dot: 'bg-pv-purple', text: 'text-pv-purple', border: 'border-l-pv-purple' },
  orange: { badge: 'bg-[#fffbeb] text-pv-orange border-[#fde68a]', bar: 'fill-pv-orange', dot: 'bg-pv-orange', text: 'text-pv-orange', border: 'border-l-pv-orange' },
  gold: { badge: 'bg-[#fffbeb] text-pv-gold border-[#fde68a]', bar: 'fill-pv-sand', dot: 'bg-pv-sand', text: 'text-pv-gold', border: 'border-l-pv-sand' },
  red: { badge: 'bg-[#fef2f2] text-pv-red border-[#fecaca]', bar: 'fill-pv-red', dot: 'bg-pv-red', text: 'text-pv-red', border: 'border-l-pv-red' },
  gray: { badge: 'bg-pv-bg text-pv-text3 border-pv-border', bar: 'fill-pv-text4', dot: 'bg-pv-text4', text: 'text-pv-text3', border: 'border-l-pv-text4' },
};

const STATUS_TONE = {
  available: 'blue', vacant: 'blue', 'under negotiation': 'purple', negotiation: 'purple', reserved: 'orange', pending: 'orange',
  leased: 'green', occupied: 'green', active: 'green', won: 'green', confirmed: 'green', resolved: 'green', completed: 'green',
  'under renewal': 'orange', 'under termination': 'red', 'under maintenance': 'red', urgent: 'red', high: 'red', lost: 'red',
  churned: 'red', cancelled: 'red', offline: 'gray', expired: 'gray', draft: 'gray', past: 'gray', closed: 'gray',
  trial: 'purple', paused: 'orange', open: 'orange', 'in progress': 'blue', medium: 'orange', low: 'gray', upcoming: 'blue',
};
export const toneOf = (status) => TONE[STATUS_TONE[String(status || '').toLowerCase()] || 'gray'];

export function Badge({ tone, status, className, children }) {
  const t = tone ? TONE[tone] : toneOf(status ?? children);
  return <span className={cx('inline-flex items-center rounded-[5px] border-[1.5px] px-[9px] py-[3px] text-[11px] font-bold tracking-[.02em] whitespace-nowrap', className || t.badge)}>{children}</span>;
}

/** Progress bar drawn with SVG attributes (no inline styles). */
export function Bar({ pct = 0, tone = 'blue', className = 'h-[5px]', fillClass }) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  return (
    <svg className={cx('w-full', className)} preserveAspectRatio="none" viewBox="0 0 100 10" aria-hidden="true">
      <rect width="100" height="10" rx="5" className="fill-pv-bg5" />
      {p > 0 && <rect width={p} height="10" rx="5" className={fillClass || TONE[tone]?.bar || TONE.blue.bar} />}
    </svg>
  );
}

export function Kpi({ label, value, sub, tone = 'blue', className }) {
  return (
    <div className={cx('rounded-xl border-[1.5px] border-pv-border bg-white p-5 shadow-pv-sm', className)}>
      <p className="text-[10.5px] font-bold tracking-[.1em] text-pv-text3 uppercase">{label}</p>
      <p className={cx('mt-2 mb-1 font-serif text-[22px] leading-tight font-extrabold lining-nums sm:text-[28px]', TONE[tone]?.text || 'text-pv-text')}>{value}</p>
      {sub && <p className="text-[11px] font-medium text-pv-text4">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, className }) {
  return <p className={cx('mb-3 text-[11px] font-bold tracking-[.1em] text-pv-text3 uppercase', className)}>{children}</p>;
}

export function Spinner({ className }) {
  return <span className={cx('inline-block size-5 animate-spin rounded-full border-2 border-pv-border border-t-pv-accent', className)} aria-label="Loading" />;
}

export function Empty({ title, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-pv-border2 bg-white px-6 py-14 text-center">
      <p className="text-sm font-bold text-pv-text2">{title}</p>
      {children && <div className="mt-1 text-[13px] text-pv-text3">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="truncate text-xl font-extrabold text-pv-navy">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-pv-text3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Full-width segmented tabs (prototype: status filter bar on Office Units). */
export function SegTabs({ items, value, onChange }) {
  return (
    <div className="mb-4 flex overflow-x-auto rounded-[10px] border-[1.5px] border-pv-border bg-white shadow-pv-sm" role="tablist">
      {items.map((it) => (
        <button key={it.value} type="button" role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)}
          className={cx('min-w-[110px] flex-1 border-b-[3px] px-3 py-2.5 text-xs font-semibold whitespace-nowrap transition',
            value === it.value ? 'border-pv-navy bg-pv-sky text-pv-navy' : 'border-transparent text-pv-text3 hover:bg-pv-bg hover:text-pv-text')}>
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  // Rendered on <body> so page animations/transforms can never trap or clip the dialog.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[rgba(10,20,40,.35)] backdrop-blur-[3px]" onClick={onClose} />
      <div className={cx('relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border-[1.5px] border-pv-border bg-white shadow-pv-lg sm:rounded-2xl', wide ? 'sm:max-w-[720px]' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between border-b border-pv-border bg-pv-bg px-[22px] py-4">
          <h2 className="text-base font-bold text-pv-text">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xl leading-none text-pv-text3 transition hover:bg-pv-bg5 hover:text-pv-text" aria-label="Close">×</button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t-[1.5px] border-pv-border bg-pv-bg px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export { cx };