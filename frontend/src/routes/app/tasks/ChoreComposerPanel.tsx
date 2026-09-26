import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { ChoreComposer } from '@/rebuild/family/ChoreComposer';
import type { CreatedChore } from '@/rebuild/family/familyMoneyApi';
import { hubSession } from '../family/familyHubSession';
import { familyMoneyCopy } from '../family/familyMoneyCopy';
import { familyGovernanceCopy } from '../family/familyGovernanceCopy';

/*
 * S07.3 (D.10) data plane: mounts the rebuilt chore composer on the Tutor's
 * Tasks screen in place of the legacy undifferentiated "paid chore" form.
 * The created chore is re-read by the caller's own list refresh.
 */
export function ChoreComposerPanel({ kids, token, onCreated }: {
  kids: { userId: string; displayName: string | null; username: string | null }[];
  token: string | null;
  onCreated: (chore: CreatedChore) => void;
}) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const locale = i18n.resolvedLanguage ?? 'en-US';
  const pricing = familyGovernanceCopy(locale).pricing;
  // S07.7 (D.23): pricing and contribution-versus-bonus guidance inside the composer.
  return <ChoreComposer copy={familyMoneyCopy(locale).choreComposer} locale={locale} dark={isDark} session={hubSession(token)}
    pricing={{ open: pricing.open, close: pricing.close, lines: [pricing.contribution, pricing.bonus, pricing.promise] }}
    kids={kids.map((kid) => ({ id: kid.userId, name: kid.displayName ?? kid.username ?? '?' }))} onCreated={onCreated} />;
}
