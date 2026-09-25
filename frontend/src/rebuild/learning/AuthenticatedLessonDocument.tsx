import type { Locale } from '../design/copyBudget';
import { RebuildRoot } from '../design/controls';
import { LessonDocumentView, type OnGrade, type OnGradeBarModel, type OnGradeFractionArea, type OnGradeNumberLine, type OnGradeSchemaDiagram, type OnGradeWorkedExample } from './LessonDocumentView';
import { loadLessonClientDocument, loadMentorStageProjection } from './lessonDocument';

const supportedLocales = new Set<Locale>(['en-US', 'es-MX', 'pt-BR']);

/**
 * Authenticated v2 delivery boundary. Core has already made the age decision;
 * this component uses only the public document pathway, never a birth date or
 * numeric learner age. The compact Mentor stage comes from the response's own
 * `mentor_stage` projection (learner's chosen character + document scene,
 * resolved server-side); a missing or malformed projection renders the lesson
 * without the stage — it is cosmetic and never blocks learning. It mounts
 * the design system's root itself (tokens, `app` container, theme, language),
 * because the route that renders it belongs to the legacy application.
 */
export function AuthenticatedLessonDocument({ raw, responseLocale, mentorStage, theme = 'light', onBack, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onComplete, metSegmentIds, attemptedSegmentIds }: {
  raw: unknown;
  responseLocale: string;
  mentorStage?: unknown;
  /** The application's current mode; the lesson follows it (02 §5). */
  theme?: 'light' | 'dark';
  onBack: () => void;
  onGrade?: OnGrade;
  onGradeNumberLine?: OnGradeNumberLine;
  onGradeFractionArea?: OnGradeFractionArea;
  onGradeBarModel?: OnGradeBarModel;
  onGradeSchemaDiagram?: OnGradeSchemaDiagram;
  onGradeWorkedExample?: OnGradeWorkedExample;
  onComplete?: () => Promise<boolean>;
  metSegmentIds?: string[];
  attemptedSegmentIds?: string[];
}) {
  const loaded = loadLessonClientDocument(raw);
  const stage = loadMentorStageProjection(mentorStage);
  const locale: Locale = loaded.status === 'ready' ? loaded.document.locale
    : supportedLocales.has(responseLocale as Locale) ? responseLocale as Locale : 'en-US';
  const ageBand = loaded.status === 'ready' ? loaded.document.age_band : '6-9';
  return <RebuildRoot theme={theme} locale={locale} ageBand={loaded.status === 'ready' ? ageBand : undefined}>
    <LessonDocumentView raw={raw} locale={locale} ageBand={ageBand} theme={theme} onBack={onBack} onGrade={onGrade}
      onGradeNumberLine={onGradeNumberLine} onGradeFractionArea={onGradeFractionArea} onGradeBarModel={onGradeBarModel} onGradeSchemaDiagram={onGradeSchemaDiagram} onGradeWorkedExample={onGradeWorkedExample} onComplete={onComplete} metSegmentIds={metSegmentIds} attemptedSegmentIds={attemptedSegmentIds} mentorStage={stage} />
  </RebuildRoot>;
}
