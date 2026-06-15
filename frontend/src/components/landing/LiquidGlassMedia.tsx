import React from 'react';
import { StockImage } from './StockImage';

interface LiquidGlassMediaProps {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  fallbackClassName?: string;
  delay?: string;
  badges?: React.ReactNode;
}

export const LiquidGlassMedia: React.FC<LiquidGlassMediaProps> = ({
  type,
  src,
  alt = '',
  fallbackClassName = 'w-full h-full bg-gradient-to-br from-indigo-500/20 via-blue-500/15 to-sky-400/20',
  delay = '0s',
  badges,
}) => {
  return (
    <div className="w-full relative z-10">
      <div className="relative animate-float" style={{ animationDelay: delay }}>
        
        {/* Liquid Glass Frame */}
        <div className="relative rounded-3xl morphing-rect-frame bg-gradient-to-tr from-indigo-500/60 via-white/20 to-blue-500/60 dark:from-indigo-500/45 dark:via-white/5 dark:to-blue-500/45 p-[8px] backdrop-blur-md shadow-[0_25px_60px_-15px_rgba(79,70,229,0.45)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-white/40 dark:border-white/15">
          
          {/* Inner masking container */}
          <div className="group relative aspect-[4/3] overflow-hidden bg-white/70 dark:bg-slate-900/70" style={{ borderRadius: 'inherit' }}>
            
            {type === 'video' ? (
              <video
                src={src}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <StockImage
                src={src}
                alt={alt}
                className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                fallbackClassName={fallbackClassName}
              />
            )}
            
            {/* Glossy liquid glass reflections overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent pointer-events-none mix-blend-overlay" />
            <div className="absolute -inset-full bg-gradient-to-b from-white/10 via-transparent to-transparent rotate-45 pointer-events-none" />
          </div>
        </div>

        {/* Optional floating badges positioned perfectly relative to the frame */}
        {badges}

        {/* Magical Sparkles/Glitter around the frame */}
        <svg className="absolute -top-4 -left-2 sm:-top-6 sm:-left-4 z-20 w-8 h-8 text-yellow-300 pointer-events-none animate-sparkle-1" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
        </svg>
        <svg className="absolute top-1/2 -right-6 sm:-right-8 z-20 w-7 h-7 text-yellow-200 pointer-events-none animate-sparkle-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
        </svg>
        <svg className="absolute -bottom-4 right-12 sm:-bottom-6 sm:right-24 z-20 w-8 h-8 text-amber-200 pointer-events-none animate-sparkle-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
        </svg>
        <svg className="absolute top-1/3 -left-6 sm:-left-8 z-20 w-6 h-6 text-indigo-300 pointer-events-none animate-sparkle-2" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
        </svg>
      </div>
    </div>
  );
};
