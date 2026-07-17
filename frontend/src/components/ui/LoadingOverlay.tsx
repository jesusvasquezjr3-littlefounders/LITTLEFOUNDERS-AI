import { LottieIcon } from './LottieIcon';

interface LoadingOverlayProps {
  label?: string;
}

export function LoadingOverlay({ label }: LoadingOverlayProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-8 w-full h-full min-h-[400px]" aria-live="polite">
      <div className="w-[280px] h-[280px] scale-125">
        <LottieIcon name="loading" />
      </div>
      {label && (
        <p className="lf-title text-content-muted animate-pulse text-center">{label}</p>
      )}
    </div>
  );
}
