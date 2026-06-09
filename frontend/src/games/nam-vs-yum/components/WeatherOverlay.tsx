import { cn } from '@/lib/utils';
import type { WeatherType } from '../types';

interface WeatherOverlayProps {
  weather: WeatherType;
}

export function WeatherOverlay({ weather }: WeatherOverlayProps) {
  if (weather === 'sunny') return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 35 }}>
      {weather === 'rainy' && (
        <>
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-px bg-blue-300/40 animate-rain-fall"
              style={{
                left: `${Math.random() * 100}%`,
                height: `${15 + Math.random() * 20}px`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${0.5 + Math.random() * 0.5}s`,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-blue-900/10" />
        </>
      )}

      {weather === 'storm' && (
        <>
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-px bg-cyan-200/50 animate-rain-fall"
              style={{
                left: `${Math.random() * 100}%`,
                height: `${20 + Math.random() * 25}px`,
                animationDelay: `${Math.random() * 1.5}s`,
                animationDuration: `${0.3 + Math.random() * 0.4}s`,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-slate-900/20 animate-storm-flash" />
        </>
      )}

      {weather === 'night' && (
        <>
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 60}%`,
                animationDelay: `${Math.random() * 3}s`,
                opacity: 0.3 + Math.random() * 0.7,
              }}
            />
          ))}
          <div className="absolute inset-0 bg-indigo-950/30" />
        </>
      )}

      {weather === 'goldenHour' && (
        <div className="absolute inset-0 bg-violet-500/10" />
      )}
    </div>
  );
}
