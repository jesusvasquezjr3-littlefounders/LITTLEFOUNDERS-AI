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
  fallbackClassName = 'w-full h-full bg-gradient-to-br from-indigo-500/15 via-blue-500/10 to-sky-400/15',
  badges,
}) => {
  return (
    <div className="w-full relative z-10">
      <div
        className="rounded-2xl overflow-hidden shadow-[0_4px_20px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_-6px_rgba(0,0,0,0.4)] transition-shadow duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.5)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-white dark:bg-slate-900/80 rounded-xl">
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
