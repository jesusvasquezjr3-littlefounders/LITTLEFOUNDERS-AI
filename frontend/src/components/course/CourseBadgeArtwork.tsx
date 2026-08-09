import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';
import { courseBadgeAsset } from '@/lib/courseBadges';
import { cn } from '@/lib/utils';

type CourseBadgeSize = 'compact' | 'orientation' | 'featured';

const SIZE_CLASSES: Record<CourseBadgeSize, string> = {
  compact: 'h-14 w-14',
  orientation: 'h-16 w-16',
  featured: 'h-40 w-40 md:h-48 md:w-48',
};

const FALLBACK_ICON_CLASSES: Record<CourseBadgeSize, string> = {
  compact: 'text-[28px]',
  orientation: 'text-[32px]',
  featured: 'text-[64px]',
};

interface CourseBadgeArtworkProps {
  asset: string | null | undefined;
  slug: string;
  size: CourseBadgeSize;
  className?: string;
}

/** Shared metallic course badge treatment for Learn and public profiles. */
export function CourseBadgeArtwork({ asset, slug, size, className }: CourseBadgeArtworkProps) {
  const source = courseBadgeAsset(asset, slug);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [source]);

  return (
    <div aria-hidden="true" className={cn('lf-course-badge', SIZE_CLASSES[size], className)}>
      <span className="lf-course-badge__metal">
        <span className="lf-course-badge__shine" />
      </span>
      {source && !failed ? (
        <img
          src={source}
          alt=""
          className="relative z-10 h-4/5 w-4/5 object-contain drop-shadow-md"
          draggable="false"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon name="workspace_premium" className={cn('relative z-10 text-delight', FALLBACK_ICON_CLASSES[size])} />
      )}
    </div>
  );
}
