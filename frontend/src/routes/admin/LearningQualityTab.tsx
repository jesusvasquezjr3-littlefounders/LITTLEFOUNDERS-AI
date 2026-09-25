import { useTranslation } from 'react-i18next';
import { useTheme } from '@/theme/useTheme';
import { LearningQualityPanel, type DecisionOutcome } from '@/rebuild/learning/LearningQualityPanel';
import type { ReviewDecisionBody } from '@/rebuild/learning/learningQualityReport';
import type { Locale } from '@/rebuild/design/copyBudget';
import { useAdminData, useAdminMutation } from './adminShared';

/**
 * S05.3d host for the staff learning-quality panel (B.19, B.12, B.5) on the
 * Content page. Core gates every route behind `manage_content` and the SQL
 * functions re-check the actor; this host only moves data.
 */
export function LearningQualityTab() {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const data = useAdminData<unknown>('/admin/content/learning-quality');
  const mutate = useAdminMutation();
  const locale: Locale = i18n.resolvedLanguage === 'es-MX' || i18n.resolvedLanguage === 'pt-BR' ? i18n.resolvedLanguage : 'en-US';
  const resolve = async (reviewId: string, body: ReviewDecisionBody): Promise<DecisionOutcome> => {
    const result = await mutate(`/admin/content/learning-quality/reviews/${reviewId}/resolve`, body);
    return !result.error ? 'resolved' : result.error.code === 'REVIEW_RESOLVED' ? 'conflict' : 'error';
  };
  return <LearningQualityPanel locale={locale} dark={isDark}
    state={data.data.state === 'ready' ? { status: 'ready', report: data.data.data } : data.data.state === 'error' ? { status: 'error' } : { status: 'loading' }}
    onRetry={() => void data.reload()}
    onSync={async () => !(await mutate('/admin/content/learning-quality/reviews/sync')).error}
    onResolve={resolve} />;
}
