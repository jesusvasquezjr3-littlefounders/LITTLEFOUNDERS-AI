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
    <div className={cn('grid gap-6', gridClass[columns], className)}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className="corp-card p-7 h-full"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mb-4">
            {item.icon}
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {item.title}
          </h3>

          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
};
