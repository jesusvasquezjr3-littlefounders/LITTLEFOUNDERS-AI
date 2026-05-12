import { cn } from '@/lib/utils';

interface BombTimerProps {
  timer: number;
  x: number;
  y: number;
}

export function BombTimer({ timer, x, y }: BombTimerProps) {
  const isUrgent = timer <= 2;

  return (
    <div
      className={cn(
        'absolute pointer-events-none pixel-font text-xs font-bold',
        isUrgent ? 'text-red-500 animate-pulse-scale' : 'text-orange-400'
      )}
      style={{
        left: x,
        top: y - 20,
        zIndex: 55,
        textShadow: isUrgent ? '0 0 8px #ef4444' : '0 0 4px #f97316',
      }}
    >
      {timer.toFixed(1)}
    </div>
  );
}
