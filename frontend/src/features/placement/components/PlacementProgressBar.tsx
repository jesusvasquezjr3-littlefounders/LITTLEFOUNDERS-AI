interface Props {
  current: number;
  max: number;
  isFinishing?: boolean;
}

export function PlacementProgressBar({ current, max, isFinishing }: Props) {
  const pct = isFinishing ? 100 : Math.min(Math.round((current / max) * 100), 95);

  return (
    <div className="relative z-10 w-full px-6 pt-6 pb-1 max-w-7xl mx-auto">
      <div className="relative w-full h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-[width] duration-500 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
