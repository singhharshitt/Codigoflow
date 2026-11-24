import clsx from 'clsx';
import { CodigoMark } from './CodigoMark';

interface BrandMarkProps {
  collapsed?: boolean;
  className?: string;
}

export function BrandMark({ collapsed, className }: BrandMarkProps) {
  if (collapsed) {
    return (
      <div className={clsx('flex justify-center', className)} aria-label="CódigoFlow">
        <CodigoMark size={32} />
      </div>
    );
  }

  return (
    <div className={clsx('flex items-center gap-2.5 min-w-0', className)}>
      <CodigoMark size={32} />
      <div className="min-w-0">
        <div className="text-base font-medium leading-none text-cf-text">
          Código<span className="text-cf-red">Flow</span>
        </div>
        <div className="mt-1 text-xs leading-none text-cf-faint">Code to cloud</div>
      </div>
    </div>
  );
}
