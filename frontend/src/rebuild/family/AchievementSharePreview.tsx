import en from '../../i18n/en-US/rebuild-family.json';
import es from '../../i18n/es-MX/rebuild-family.json';
import pt from '../../i18n/pt-BR/rebuild-family.json';
import type { Locale } from '../design/copyBudget';
import { AchievementShare, type AchievementShareStatus } from './AchievementShare';
import { BadgeShares } from './BadgeShares';

/*
 * Fixture-only preview of the S08.4 sharing surfaces for the real-Chrome
 * matrix (scripts/verify-rebuild-achievement-share.mjs): the share action in
 * its achievement and goal variants at a chosen state, and the legacy-link
 * panel open with one fixture link. No transport, no session, no spend.
 */

const STATES: AchievementShareStatus[] = ['idle', 'preparing', 'shared', 'downloaded', 'cancelled', 'failed'];

export function AchievementSharePreview({ locale, theme, state }: { locale: Locale; theme: 'light' | 'dark'; state: string | null }) {
  const t = locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en;
  const status = STATES.includes(state as AchievementShareStatus) ? state as AchievementShareStatus : 'idle';
  const dark = theme === 'dark';
  return <main className="lf-rebuild" data-screen="achievement-share-preview" data-theme={theme} lang={locale}>
    <AchievementShare copy={t.achievementShare} locale={locale} dark={dark} status={status} onShare={() => undefined} />
    <AchievementShare copy={t.achievementShare} locale={locale} dark={dark} variant="goal" status="idle" onShare={() => undefined} />
    <BadgeShares copy={t.badgeShares} locale={locale} dark={dark} open shares={[{
      token: 'a'.repeat(32), achievementLabel: locale === 'es-MX' ? 'Racha de 7 días' : locale === 'pt-BR' ? 'Sequência de 7 dias' : '7-day streak',
      createdAt: '2026-09-20T00:00:00.000Z', expiresAt: '2026-10-20T00:00:00.000Z',
    }]} loading={false} failed={false} revokingToken={null} notice={null} revokeFailed={false}
    onRevoke={() => undefined} onToggle={() => undefined} onRetry={() => undefined} />
  </main>;
}
