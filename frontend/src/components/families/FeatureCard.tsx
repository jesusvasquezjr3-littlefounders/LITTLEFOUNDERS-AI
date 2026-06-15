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
    <div className={cn(
      'group relative p-6 lg:p-8 rounded-2xl',
      'bg-white dark:bg-slate-900/50',
      'border border-gray-200/50 dark:border-slate-700/50',
      'hover:border-indigo-300/50 dark:hover:border-indigo-500/30',
      'shadow-sm hover:shadow-lg',
      'transition-all duration-300',
      'overflow-hidden',
      className
    )}>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 via-sky-50/0 to-blue-50/0 dark:from-indigo-900/5 dark:via-sky-900/5 dark:to-blue-900/5 group-hover:from-indigo-50/30 group-hover:via-sky-50/30 group-hover:to-blue-50/30 dark:group-hover:from-indigo-900/10 dark:group-hover:via-sky-900/10 dark:group-hover:to-blue-900/10 transition-all duration-500" />

      <div className="relative">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-900/30 dark:to-blue-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          {icon}
        </div>

        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {title}
        </h3>

        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          {description}
          {highlight && (
            <span className="block mt-2 text-indigo-600 dark:text-indigo-400 font-semibold">
              {highlight}
            </span>
          )}
        </p>
      </div>
    </div>
  );
};
