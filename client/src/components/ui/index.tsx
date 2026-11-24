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
    sm: 'h-8 px-3 py-0 text-xs',
    md: 'h-9 py-0',
    lg: 'h-11 px-5 py-0 text-sm',
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
          {title && <h2 className="text-sm font-medium text-cf-text">{title}</h2>}
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
        className="absolute inset-0 bg-black/60"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cf-modal-title"
        className={clsx(
          'relative w-full bg-cf-card border border-cf-border rounded-2xl p-6 shadow-[0_24px_48px_rgba(0,0,0,0.4)] animate-fade-in',
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 id="cf-modal-title" className="text-base font-medium text-cf-text">
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          className={clsx(
            'absolute z-40 mt-2 min-w-[12rem] rounded-xl border border-cf-border bg-cf-elevated p-1 shadow-[0_12px_32px_rgba(0,0,0,0.4)] animate-fade-in',
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
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap rounded-md bg-cf-navy border border-cf-border px-2 py-1 text-xs text-cf-muted opacity-0 group-hover:opacity-100 transition-opacity z-30">
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
    <div role="tablist" className="flex w-fit gap-1 rounded-lg border border-cf-border bg-cf-navy p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            'h-7 rounded-md border px-3 text-xs font-medium transition-colors duration-150',
            value === tab.id
              ? 'border-white/[0.06] bg-cf-elevated text-cf-text shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
              : 'border-transparent text-cf-faint hover:text-cf-text',
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
  return <Loader2 className={clsx(sz, 'animate-spin text-cf-faint', className)} />;
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
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cf-border bg-cf-elevated">
          <Icon className="h-5 w-5 text-cf-faint" />
        </div>
      )}
      <div>
        <div className="text-sm font-medium text-cf-text">{title}</div>
        {description && <div className="mx-auto mt-1 max-w-sm text-sm text-cf-faint">{description}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
type AlertVariant = 'info' | 'success' | 'warning' | 'error';

// Neutral surface; the variant color lives in the icon and a thin leading rule only.
const ALERT_STYLES: Record<AlertVariant, { cls: string; tone: string; Icon: typeof Info }> = {
  info: { cls: 'border-l-cf-cyan/70', tone: 'text-cf-cyan', Icon: Info },
  success: { cls: 'border-l-cf-success/70', tone: 'text-cf-success', Icon: CheckCircle },
  warning: { cls: 'border-l-cf-warning/70', tone: 'text-cf-warning', Icon: AlertTriangle },
  error: { cls: 'border-l-cf-error/70', tone: 'text-cf-error', Icon: XCircle },
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
  const { cls, tone, Icon } = ALERT_STYLES[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={clsx('flex gap-3 rounded-lg border border-cf-border border-l-2 bg-cf-card p-4 text-sm', cls, className)}
    >
      <Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', tone)} />
      <div className="min-w-0">
        {title && <div className="mb-0.5 font-medium text-cf-text">{title}</div>}
        <div className="break-words text-cf-muted">{children}</div>
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
  // `color` is kept for API compatibility; stat cards stay neutral by design.
  void color;
  return (
    <div className="card flex flex-col justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-cf-faint">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="text-[28px] font-medium leading-none tabular-nums text-cf-text">{value}</div>
      {trend && (
        <div className={clsx('text-xs', trend.value >= 0 ? 'text-cf-success' : 'text-cf-error')}>
          {trend.value >= 0 ? '+' : '−'}
          {Math.abs(trend.value)} {trend.label}
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
        <h1 className="text-2xl font-medium text-cf-text">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-cf-muted">{description}</p>}
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
