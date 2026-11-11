import clsx from 'clsx';

interface NeonGlowProps {
  color?: 'cyan' | 'red' | 'violet';
  className?: string;
}

/** Soft atmospheric radial glow behind sections. */
export function NeonGlow({ color = 'cyan', className }: NeonGlowProps) {
  const colorMap = {
    cyan: 'bg-cf-cyan/20',
    red: 'bg-cf-red/20',
    violet: 'bg-cf-violet/20',
  };

  return (
    <div
      aria-hidden="true"
      className={clsx(
        'pointer-events-none absolute rounded-full blur-3xl',
        colorMap[color],
        className,
      )}
    />
  );
}
