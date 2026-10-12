import { Link } from 'react-router-dom';
import { AppIcon } from '@/components/AppIcon';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { useCoreCopy } from '@/i18n/useCopy';

/*
 * The trail on every page below the home page: Home, the sections in between as links, and the
 * current page last, as plain text marked `aria-current`. The home page has none. `trail` holds
 * what comes after Home; labels are translated strings, passed in by the page. The separators are
 * Lucide chevrons through Morphicons (Cojeev's own icon set would pull a 354 KB chunk for one arrow).
 * Text wraps, never cuts (rule 3 in docs/engineering/FRONTEND-GUIDE.md).
 */
export interface Crumb {
  label: string;
  /** Where it goes; leave it out for the current page. */
  to?: string;
}

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  const copy = useCoreCopy().siteShell;
  const items = [{ label: copy.home, to: '/' }, ...trail];

  return <Breadcrumb aria-label={copy.breadcrumb} className="min-h-12">
    <BreadcrumbList>
      {items.map((crumb, index) => {
        const last = index === items.length - 1;

        return <BreadcrumbItem key={`${crumb.to ?? 'page'}-${crumb.label}`}>
          {last || !crumb.to
            ? <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
            : <BreadcrumbLink asChild><Link to={crumb.to} className="inline-flex min-h-12 min-w-12 items-center justify-center">{crumb.label}</Link></BreadcrumbLink>}
          {last ? null : <BreadcrumbSeparator><AppIcon name="chevron" size={16} className="rotate-180" /></BreadcrumbSeparator>}
        </BreadcrumbItem>;
      })}
    </BreadcrumbList>
  </Breadcrumb>;
}
