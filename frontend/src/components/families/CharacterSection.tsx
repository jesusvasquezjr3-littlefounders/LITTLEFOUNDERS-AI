import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

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
    <div className={cn('py-16 lg:py-24', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {isCharacterLeft && (
          <div className="flex justify-center lg:justify-start order-2 lg:order-1">
            <div className="w-full max-w-sm">
              {character}
            </div>
          </div>
        )}

        <div className={cn(
          'space-y-5',
          isCharacterLeft ? 'lg:order-2' : 'lg:order-1'
        )}>
          <div className="space-y-2.5">
            {subtitle && (
              <span className="corp-eyebrow">{subtitle}</span>
            )}
            <h2 className="corp-h2">
              {title}
            </h2>
          </div>

          <p className="corp-body-lg">
            {description}
          </p>

          {features.length > 0 && (
            <ul className="space-y-3 pt-2">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" />
                  <span className="corp-body">
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
