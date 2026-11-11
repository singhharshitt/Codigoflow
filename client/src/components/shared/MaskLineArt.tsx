import clsx from 'clsx';

/** Subtle Spider-Man mask-inspired line art for welcome / empty states. */
export function MaskLineArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={clsx('pointer-events-none', className)}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <ellipse cx="60" cy="62" rx="38" ry="44" fill="none" stroke="#E62429" strokeWidth="1.6" />
      <path
        d="M30 48 Q45 40 60 48 Q75 40 90 48"
        fill="none"
        stroke="#1476D4"
        strokeWidth="1.2"
      />
      <path d="M38 58 Q48 70 60 58 Q72 70 82 58" fill="none" stroke="#38DFFF" strokeWidth="1.1" />
      <path d="M60 18 V42 M42 28 L60 42 L78 28" stroke="#E62429" strokeWidth="1" opacity="0.7" />
      <path
        d="M34 78 Q60 95 86 78"
        fill="none"
        stroke="#8247E5"
        strokeWidth="1"
        opacity="0.55"
      />
      <circle cx="46" cy="54" r="2" fill="#38DFFF" opacity="0.8" />
      <circle cx="74" cy="54" r="2" fill="#38DFFF" opacity="0.8" />
    </svg>
  );
}
