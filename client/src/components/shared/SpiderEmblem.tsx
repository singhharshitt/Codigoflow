import clsx from 'clsx';

interface SpiderEmblemProps {
  size?: number;
  className?: string;
  glowing?: boolean;
}

/** Compact original spider emblem for brand marks and AI accents. */
export function SpiderEmblem({ size = 28, className, glowing }: SpiderEmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx(glowing && 'drop-shadow-[0_0_8px_rgba(230,36,41,0.55)]', className)}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="22" fill="#0C173D" stroke="#E62429" strokeWidth="1.5" />
      <path
        d="M24 10 L27.5 20.5 L38 24 L27.5 27.5 L24 38 L20.5 27.5 L10 24 L20.5 20.5 Z"
        fill="#E62429"
      />
      <circle cx="24" cy="24" r="3.2" fill="#38DFFF" />
      <path d="M14 14 Q24 19 34 14" stroke="#1476D4" strokeWidth="1" opacity="0.85" />
      <path d="M14 34 Q24 29 34 34" stroke="#1476D4" strokeWidth="1" opacity="0.85" />
      <path d="M12 24 H16 M32 24 H36 M24 12 V16 M24 32 V36" stroke="#B8F5FF" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
