import type { Locale } from '../design/copyBudget';
import { LessonDocumentView, type OnGrade, type OnGradeBarModel, type OnGradeFractionArea, type OnGradeNumberLine, type OnGradeSchemaDiagram, type OnGradeWorkedExample } from './LessonDocumentView';
import { loadLessonClientDocument } from './lessonDocument';

const supportedLocales = new Set<Locale>(['en-US', 'es-MX', 'pt-BR']);

/**
 * Authenticated v2 delivery boundary. Core has already made the age decision;
 * this component uses only the public document pathway, never a birth date or
 * numeric learner age.
 */
export function AuthenticatedLessonDocument({ raw, responseLocale, onBack, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onComplete, metSegmentIds, attemptedSegmentIds }: {
  raw: unknown;
  responseLocale: string;
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
  const locale: Locale = loaded.status === 'ready' ? loaded.document.locale
    : supportedLocales.has(responseLocale as Locale) ? responseLocale as Locale : 'en-US';
  const ageBand = loaded.status === 'ready' ? loaded.document.age_band : '6-9';
  return <LessonDocumentView raw={raw} locale={locale} ageBand={ageBand} onBack={onBack} onGrade={onGrade}
    onGradeNumberLine={onGradeNumberLine} onGradeFractionArea={onGradeFractionArea} onGradeBarModel={onGradeBarModel} onGradeSchemaDiagram={onGradeSchemaDiagram} onGradeWorkedExample={onGradeWorkedExample} onComplete={onComplete} metSegmentIds={metSegmentIds} attemptedSegmentIds={attemptedSegmentIds} />;
}
