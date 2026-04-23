interface Props {
  current: number;
  max: number;
  isFinishing?: boolean;
}

export function PlacementProgressBar({ current, max, isFinishing }: Props) {
  const pct = isFinishing ? 100 : Math.min(Math.round((current / max) * 100), 95);

  return (
    <div className="w-full px-6 pt-6 pb-1 max-w-lg mx-auto">
      <div className="relative w-full h-2 bg-black/8 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full blur-sm opacity-60 bg-gradient-to-r from-violet-400 to-indigo-400 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
