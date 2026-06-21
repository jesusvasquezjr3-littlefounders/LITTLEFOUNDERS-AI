import React from 'react';
import { StockImage } from './StockImage';

interface LiquidGlassMediaProps {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  fallbackClassName?: string;
  badges?: React.ReactNode;
}

export const LiquidGlassMedia: React.FC<LiquidGlassMediaProps> = ({
  type,
  src,
  alt = '',
  fallbackClassName = 'w-full h-full bg-gradient-to-br from-indigo-500/20 via-blue-500/15 to-sky-400/20',
  badges,
}) => {
  return (
    <div className="w-full relative z-10">
      <div
        className="rounded-2xl overflow-hidden bg-gradient-to-tr from-indigo-500/60 via-white/20 to-blue-500/60 dark:from-indigo-500/45 dark:via-white/5 dark:to-blue-500/45 p-[8px] shadow-[0_25px_60px_-15px_rgba(79,70,229,0.3)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-slate-200 dark:border-white/10"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-white/70 dark:bg-slate-900/70 rounded-xl">
          {type === 'video' ? (
            <video
              src={src}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <StockImage
              src={src}
              alt={alt}
              className="w-full h-full object-cover"
              fallbackClassName={fallbackClassName}
            />
          )}
        </div>
      </div>

      {badges}
    </div>
  );
};
