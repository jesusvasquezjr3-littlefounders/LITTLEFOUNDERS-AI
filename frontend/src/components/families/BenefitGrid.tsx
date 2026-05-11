import React from 'react';
import { cn } from '@/lib/utils';

interface BenefitItem {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface BenefitGridProps {
  items: BenefitItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}

export const BenefitGrid: React.FC<BenefitGridProps> = ({
  items,
  columns = 3,
  className = '',
}) => {
  const gridClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-6 lg:gap-8', gridClass[columns], className)}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className={cn(
            'group relative p-6 lg:p-7 rounded-2xl',
            'bg-white dark:bg-slate-900/50',
            'border border-gray-200/50 dark:border-slate-700/50',
            'hover:border-pink-300/50 dark:hover:border-pink-500/30',
            'shadow-sm hover:shadow-xl',
            'transition-all duration-300 overflow-hidden'
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-pink-50/0 via-purple-50/0 to-blue-50/0 dark:from-pink-900/5 dark:via-purple-900/5 dark:to-blue-900/5 group-hover:from-pink-50/30 group-hover:via-purple-50/30 group-hover:to-blue-50/30 dark:group-hover:from-pink-900/10 dark:group-hover:via-purple-900/10 dark:group-hover:to-blue-900/10 transition-all duration-500" />

          <div className="relative space-y-3">
            <div className="w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform">
              {item.icon}
            </div>

            <h3 className="text-base lg:text-lg font-bold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
              {item.title}
            </h3>

            <p className="text-sm lg:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
              {item.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
