import clsx from 'clsx';

interface CodigoMarkProps {
  size?: number;
  className?: string;
  /** Draw the dark tile behind the glyph (default). Off for inline use on cards. */
  tile?: boolean;
}

/**
 * CódigoFlow mark: a pipeline that bends into a "C".
 * A hollow source node (code) flows around the arc into a solid red node (cloud).
 * Keep in sync with public/favicon.svg and public/logo.svg.
 */
export function CodigoMark({ size = 32, className, tile = true }: CodigoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={clsx('shrink-0', className)}
      aria-hidden="true"
    >
      {tile && <rect width="64" height="64" rx="14" fill="#151922" />}
      <path
        d="M43.3 20.7A16 16 0 1 0 43.3 43.3"
        stroke="#ECEEF3"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="43.3" cy="20.7" r="4.5" fill={tile ? '#151922' : '#11151F'} stroke="#ECEEF3" strokeWidth="3" />
      <circle cx="45.5" cy="45.5" r="6" fill="#E62429" />
    </svg>
  );
}
