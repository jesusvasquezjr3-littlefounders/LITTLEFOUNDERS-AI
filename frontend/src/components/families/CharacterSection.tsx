import React from 'react';
import { cn } from '@/lib/utils';

interface CharacterSectionProps {
  character: React.ReactNode;
  title: string;
  subtitle?: string;
  description: string;
  features?: string[];
  characterPosition?: 'left' | 'right';
  className?: string;
}

export const CharacterSection: React.FC<CharacterSectionProps> = ({
  character,
  title,
  subtitle,
  description,
  features = [],
  characterPosition = 'right',
  className = '',
}) => {
  const isCharacterLeft = characterPosition === 'left';

  return (
    <div className={cn('py-12 lg:py-20', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
        {isCharacterLeft && (
          <div className="flex justify-center lg:justify-start order-2 lg:order-1">
            <div className="w-full max-w-sm">
              {character}
            </div>
          </div>
        )}

        <div className={cn(
          'space-y-4',
          isCharacterLeft ? 'lg:order-2' : 'lg:order-1'
        )}>
          <div className="space-y-3">
            {subtitle && (
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">
                {subtitle}
              </p>
            )}
            <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight">
              {title}
            </h2>
          </div>

          <p className="text-gray-700 dark:text-gray-300 text-base lg:text-lg leading-relaxed font-medium">
            {description}
          </p>

          {features.length > 0 && (
            <ul className="space-y-2 pt-4">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex-shrink-0 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-300" />
                  </span>
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isCharacterLeft && (
          <div className="flex justify-center lg:justify-end order-2 lg:order-2">
            <div className="w-full max-w-sm">
              {character}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
