import clsx from 'clsx';

interface WebPatternProps {
  className?: string;
  opacity?: number;
  variant?: 'corner' | 'mesh' | 'radial';
}

/** Lightweight SVG spider-web decoration. pointer-events none; low opacity. */
export function WebPattern({
  className,
  opacity = 0.12,
  variant = 'corner',
}: WebPatternProps) {
  if (variant === 'mesh') {
    return (
      <svg
        className={clsx('pointer-events-none absolute inset-0 w-full h-full', className)}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ opacity }}
      >
        <defs>
          <pattern id="cf-web-mesh" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M0 24 H48 M24 0 V48" stroke="#263968" strokeWidth="0.6" />
            <path d="M0 0 L48 48 M48 0 L0 48" stroke="#E62429" strokeWidth="0.35" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cf-web-mesh)" />
      </svg>
    );
  }

  if (variant === 'radial') {
    return (
      <svg
        className={clsx('pointer-events-none absolute', className)}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ opacity }}
      >
        {[20, 40, 60, 80].map((r) => (
          <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="#38DFFF" strokeWidth="0.6" />
        ))}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1="100"
              y1="100"
              x2={100 + Math.cos(a) * 90}
              y2={100 + Math.sin(a) * 90}
              stroke="#E62429"
              strokeWidth="0.5"
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      className={clsx('pointer-events-none absolute', className)}
      viewBox="0 0 160 160"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ opacity }}
    >
      <path
        d="M0 0 L160 0 L160 20 Q80 40 20 160 L0 160 Z"
        fill="none"
        stroke="#263968"
        strokeWidth="0.8"
      />
      {[30, 60, 90, 120].map((r) => (
        <path
          key={r}
          d={`M0 0 Q${r * 0.4} ${r * 0.15} ${r} ${r}`}
          fill="none"
          stroke="#E62429"
          strokeWidth="0.5"
        />
      ))}
      <path d="M0 40 L40 0 M0 80 L80 0 M0 120 L120 0" stroke="#1476D4" strokeWidth="0.45" />
    </svg>
  );
}
