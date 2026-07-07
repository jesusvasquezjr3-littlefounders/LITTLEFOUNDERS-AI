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
          className="corp-card p-6 h-full transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center mb-3.5">
            {item.icon}
          </div>

          <h3 className="corp-h4">
            {item.title}
          </h3>

          <p className="corp-body mt-1.5">
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
};
