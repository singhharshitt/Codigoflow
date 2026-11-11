import { AlertTriangle, Info, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

// ── LoadingSpinner ────────────────────────────────────────────────────────────
export function LoadingSpinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sz = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }[size];
  return (
    <Loader2 className={clsx(sz, 'animate-spin text-brand-400', className)} />
  );
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
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-surface-3 flex items-center justify-center">
          <Icon className="w-7 h-7 text-gray-500" />
        </div>
      )}
      <div>
        <div className="text-sm font-medium text-gray-300">{title}</div>
        {description && <div className="text-xs text-gray-500 mt-1 max-w-xs">{description}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const ALERT_STYLES: Record<AlertVariant, { cls: string; Icon: typeof Info }> = {
  info:    { cls: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300',    Icon: Info },
  success: { cls: 'bg-green-500/10 border-green-500/30 text-green-300', Icon: CheckCircle },
  warning: { cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300', Icon: AlertTriangle },
  error:   { cls: 'bg-red-500/10 border-red-500/30 text-red-300',       Icon: XCircle },
};

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
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
  color = 'brand',
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: number; label: string };
  color?: 'brand' | 'cyan' | 'violet' | 'green' | 'red';
}) {
  const colorMap = {
    brand:  'text-brand-400 bg-brand-500/10',
    cyan:   'text-cyan-400 bg-cyan-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    green:  'text-green-400 bg-green-500/10',
    red:    'text-red-400 bg-red-500/10',
  };

  return (
    <div className="card flex items-start justify-between">
      <div>
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {trend && (
          <div className={clsx('text-xs mt-1', trend.value >= 0 ? 'text-green-400' : 'text-red-400')}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)} {trend.label}
          </div>
        )}
      </div>
      {Icon && (
        <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', colorMap[color])}>
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
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
