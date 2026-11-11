import clsx from 'clsx';
import { SpiderEmblem } from './SpiderEmblem';

interface BrandMarkProps {
  collapsed?: boolean;
  className?: string;
}

export function BrandMark({ collapsed, className }: BrandMarkProps) {
  if (collapsed) {
    return (
      <div className={clsx('flex justify-center', className)}>
        <SpiderEmblem size={32} glowing />
      </div>
    );
  }

  return (
    <div className={clsx('flex items-center gap-2.5 min-w-0', className)}>
      <SpiderEmblem size={32} glowing />
      <div className="min-w-0">
        <div className="text-sm font-bold text-cf-text leading-tight tracking-tight">
          Código<span className="text-cf-red">Flow</span>
        </div>
        <div className="font-display text-[9px] text-cf-cyan tracking-wide leading-tight mt-0.5">
          CODE → CLOUD
        </div>
      </div>
    </div>
  );
}
