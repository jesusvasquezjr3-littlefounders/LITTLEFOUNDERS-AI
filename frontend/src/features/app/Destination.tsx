import { AppIcon } from '@/components/AppIcon';
import type { Destination as Name } from '@/features/app/homeData';
import { useAppCopy } from '@/i18n/useCopy';

/*
 * A destination whose feature is not built yet: its name, its icon alive, and one line that says
 * there is nothing here yet. Each is replaced by the real page in the session that builds its
 * feature; nothing here describes or promises what that page will hold.
 */
export function Destination({ name }: { name: Exclude<Name, 'home'> }) {
  const copy = useAppCopy();

  return <div className="mx-auto grid max-w-[520px] justify-items-center gap-4 py-16 text-center">
    <AppIcon name={name} size={112} alive />
    <h1 className="m-0 text-[32px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[40px]">{copy.nav[name]}</h1>
    <p className="m-0 text-[color:var(--v-text-2)]">{copy.empty.text}</p>
  </div>;
}
