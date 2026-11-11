import { useEffect, useId, useRef, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle, Loader2, X } from 'lucide-react';
import clsx from 'clsx';

// ── Button ────────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'cyan' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    cyan: 'btn-cyan',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
  };
  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: '',
    lg: 'px-5 py-2.5 text-base',
  };

  return (
    <button
      className={clsx(variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({
  label,
  error,
  className,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs text-cf-muted">
          {label}
        </label>
      )}
      <input id={inputId} className={clsx('input', error && 'border-cf-error focus:ring-cf-error', className)} {...props} />
      {error && <p className="text-xs text-cf-error">{error}</p>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({
  label,
  className,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-xs text-cf-muted">
          {label}
        </label>
      )}
      <select id={selectId} className={clsx('input', className)} {...props}>
        {children}
      </select>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({
  className,
  children,
  title,
  action,
}: {
  className?: string;
  children: ReactNode;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className={clsx('card', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <div className="text-sm font-semibold text-cf-text">{title}</div>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-cf-navy/70 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cf-modal-title"
        className={clsx(
          'relative w-full bg-cf-card border border-cf-border rounded-xl shadow-panel p-5 animate-fade-in',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="cf-modal-title" className="text-base font-semibold text-cf-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-cf-faint hover:text-cf-text hover:bg-cf-elevated"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
export function Dropdown({
  trigger,
  children,
  align = 'right',
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={clsx(
            'absolute z-40 mt-2 min-w-[12rem] rounded-lg border border-cf-border bg-cf-card shadow-panel p-1 animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  return (
    <span className="relative group inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-cf-navy border border-cf-border px-2 py-1 text-[10px] text-cf-muted opacity-0 group-hover:opacity-100 transition-opacity z-30">
        {content}
      </span>
    </span>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-cf-navy/60 border border-cf-border w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
            value === tab.id
              ? 'bg-cf-elevated text-cf-cyan border border-cf-cyan/30 shadow-glow-cyan'
              : 'text-cf-faint hover:text-cf-text',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({
  children,
  variant = 'muted',
}: {
  children: ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'muted' | 'violet';
}) {
  const map = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    muted: 'badge-muted',
    violet: 'badge-violet',
  };
  return <span className={map[variant]}>{children}</span>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-cf-elevated/80', className)} />;
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ── LoadingSpinner ────────────────────────────────────────────────────────────
export function LoadingSpinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size];
  return <Loader2 className={clsx(sz, 'animate-spin text-cf-cyan', className)} />;
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-cf-elevated border border-cf-border flex items-center justify-center">
          <Icon className="w-7 h-7 text-cf-faint" />
        </div>
      )}
      <div>
        <div className="text-sm font-medium text-cf-text">{title}</div>
        {description && <div className="text-xs text-cf-faint mt-1 max-w-xs mx-auto">{description}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const ALERT_STYLES: Record<AlertVariant, { cls: string; Icon: typeof Info }> = {
  info: { cls: 'bg-cf-cyan/10 border-cf-cyan/30 text-cf-ice', Icon: Info },
  success: { cls: 'bg-cf-success/10 border-cf-success/30 text-cf-success', Icon: CheckCircle },
  warning: { cls: 'bg-cf-warning/10 border-cf-warning/30 text-cf-warning', Icon: AlertTriangle },
  error: { cls: 'bg-cf-error/10 border-cf-error/30 text-cf-error', Icon: XCircle },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { cls, Icon } = ALERT_STYLES[variant];
  return (
    <div className={clsx('flex gap-3 p-4 rounded-lg border text-sm', cls, className)}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div>
        {title && <div className="font-medium mb-0.5">{title}</div>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color = 'red',
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  color?: 'red' | 'cyan' | 'violet' | 'green' | 'royal' | 'brand';
}) {
  const colorMap = {
    red: 'text-cf-red bg-cf-red/10 border-cf-red/20',
    brand: 'text-cf-red bg-cf-red/10 border-cf-red/20',
    cyan: 'text-cf-cyan bg-cf-cyan/10 border-cf-cyan/20',
    violet: 'text-cf-violet bg-cf-violet/10 border-cf-violet/20',
    green: 'text-cf-success bg-cf-success/10 border-cf-success/20',
    royal: 'text-cf-royal bg-cf-royal/10 border-cf-royal/20',
  };

  return (
    <div className="card flex items-start justify-between">
      <div>
        <div className="text-xs text-cf-faint mb-1">{label}</div>
        <div className="text-2xl font-bold text-cf-text">{value}</div>
        {trend && (
          <div className={clsx('text-xs mt-1', trend.value >= 0 ? 'text-cf-success' : 'text-cf-error')}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)} {trend.label}
          </div>
        )}
      </div>
      {Icon && (
        <div className={clsx('w-10 h-10 rounded-xl border flex items-center justify-center', colorMap[color])}>
          <Icon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2 relative z-10">
      <div>
        <h1 className="text-xl font-bold text-cf-text tracking-tight">{title}</h1>
        {description && <p className="text-sm text-cf-muted mt-1">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="table-wrap">
      <table className="data-table">{children}</table>
    </div>
  );
}
