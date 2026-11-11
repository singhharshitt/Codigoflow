import { WebPattern } from './WebPattern';
import { NeonGlow } from './NeonGlow';

interface PageBackgroundProps {
  showWeb?: boolean;
  showGlow?: boolean;
}

/** Page-level atmospheric layer. Keep out of dense editors/tables. */
export function PageBackground({ showWeb = true, showGlow = true }: PageBackgroundProps) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {showGlow && (
        <>
          <NeonGlow color="red" className="w-64 h-64 -top-20 -left-16" />
          <NeonGlow color="cyan" className="w-72 h-72 -top-10 right-0" />
          <NeonGlow color="violet" className="w-56 h-56 bottom-0 left-1/3" />
        </>
      )}
      {showWeb && (
        <>
          <WebPattern className="w-40 h-40 top-0 right-0" opacity={0.14} />
          <WebPattern className="w-32 h-32 bottom-8 left-0 rotate-180" opacity={0.1} />
        </>
      )}
    </div>
  );
}
