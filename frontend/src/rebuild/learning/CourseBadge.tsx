import { resolveManifestAsset } from '../design/assets';
import { courseIdentity } from './learnHome';
import './courseBadge.css';

/*
 * The learner-side course badge. The legacy display was a metallic CSS disc around the course's
 * raster art with a stock icon as its fallback; the rebuilt badge is our own
 * rosette (`course.badge.frame`) holding the course's own identity icon, so a
 * badge reads as the course it was earned in. A course without an identity
 * slot keeps the plain rosette rather than a borrowed icon. Always decorative:
 * the words beside it ("Badge earned") carry the meaning.
 */
export function CourseBadge({ slug, size = 'md', className }: { slug: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const frame = resolveManifestAsset('course.badge.frame');
  const identity = slug ? courseIdentity(slug) : null;
  const icon = identity ? resolveManifestAsset(identity.iconAssetId) : null;
  if (!frame) return null;
  return <span className={`lf-learn-badge lf-learn-badge--${size}${className ? ` ${className}` : ''}`} aria-hidden="true" data-course-badge={slug ?? ''}>
    <img className="lf-learn-badge-frame" src={frame.path} alt="" data-asset-id={frame.id} />
    {icon ? <img className="lf-learn-badge-icon" src={icon.path} alt="" data-asset-id={icon.id} /> : null}
  </span>;
}
