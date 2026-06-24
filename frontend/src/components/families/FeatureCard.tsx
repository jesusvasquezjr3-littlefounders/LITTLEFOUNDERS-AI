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
    <div className={cn('corp-card p-7 h-full', className)}>
      <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mb-4">
        {icon}
      </div>

      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {description}
        {highlight && (
          <span className="block mt-2 text-indigo-600 dark:text-indigo-400 font-semibold">
            {highlight}
          </span>
        )}
      </p>
    </div>
  );
};
