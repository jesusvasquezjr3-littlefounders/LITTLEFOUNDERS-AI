import React from 'react';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  highlight,
  className = '',
}) => {
  return (
    <div className={cn('corp-card p-7 h-full transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]', className)}>
      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mb-4">
        {icon}
      </div>

      <h3 className="corp-h4 mb-1.5">
        {title}
      </h3>

      <p className="corp-body">
        {description}
        {highlight && (
          <span className="block mt-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
            {highlight}
          </span>
        )}
      </p>
    </div>
  );
};
