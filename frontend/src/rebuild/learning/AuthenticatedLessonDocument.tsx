import type { AgeBand, Locale } from '../design/copyBudget';
import { LessonDocumentView, type OnGrade, type OnGradeAny, type OnGradeBarModel, type OnGradeFractionArea, type OnGradeNumberLine, type OnGradeSchemaDiagram, type OnGradeReasoning, type OnGradeWorkedExample, type OnView, type OnChooseApproach } from './LessonDocumentView';
import { loadAdventureThemeProjection, loadLessonClientDocument, loadMentorStageProjection } from './lessonDocument';

const supportedLocales = new Set<Locale>(['en-US', 'es-MX', 'pt-BR']);

/**
 * The lesson layer's frame for a delivered v2 document (W2L.3): the document's
 * own language and audience band when it parses, otherwise the response's
 * language and no band (the refusal screen reads in the youngest budget).
 */
export function lessonDocumentFrame(raw: unknown, responseLocale: string): { locale: Locale; ageBand?: AgeBand; title: string | null } {
  const loaded = loadLessonClientDocument(raw);
  if (loaded.status === 'ready') return { locale: loaded.document.locale, ageBand: loaded.document.age_band, title: loaded.document.title };
  return { locale: supportedLocales.has(responseLocale as Locale) ? responseLocale as Locale : 'en-US', title: null };
}

/**
 * Authenticated v2 delivery boundary. Core has already made the age decision;
 * this component uses only the public document pathway, never a birth date or
 * numeric learner age. The compact Mentor stage comes from the response's own
 * `mentor_stage` projection (learner's chosen character + document scene,
 * resolved server-side); a missing or malformed projection renders the lesson
 * without the stage — it is cosmetic and never blocks learning. The host
 * mounts it inside the lesson layer (`LessonLayer`, W2L.3), which carries the
 * design system's root, the document title, the skip link and route focus.
 */
export function AuthenticatedLessonDocument({ raw, responseLocale, mentorStage, adventureTheme, narrationAudio, theme = 'light', onBack, onGrade, onGradeNumberLine, onGradeFractionArea, onGradeBarModel, onGradeSchemaDiagram, onGradeWorkedExample, onGradeReasoning, onGradeAny, onView, onHelpUsed, onComplete, metSegmentIds, attemptedSegmentIds, viewedSegmentIds, approachId, onChooseApproach }: {
  raw: unknown;
  responseLocale: string;
  mentorStage?: unknown;
  /** B.8 (GAP-FIX-R1): Core's closed-enum adventure theme; malformed means no scene band. */
  adventureTheme?: unknown;
  /** B.18 (GAP-FIX-R3): Core's narration map; anything malformed is dropped (text-only plates). */
  narrationAudio?: unknown;
  /** The application's current mode; the lesson follows it (02 §5). */
  theme?: 'light' | 'dark';
  onBack: () => void;
  onGrade?: OnGrade;
  onGradeNumberLine?: OnGradeNumberLine;
  onGradeFractionArea?: OnGradeFractionArea;
  onGradeBarModel?: OnGradeBarModel;
  onGradeSchemaDiagram?: OnGradeSchemaDiagram;
  onGradeWorkedExample?: OnGradeWorkedExample;
  onGradeReasoning?: OnGradeReasoning;
  onGradeAny?: OnGradeAny;
  onView?: OnView;
  onHelpUsed?: (segmentId: string, steps: number) => void;
  onComplete?: () => Promise<boolean>;
  metSegmentIds?: string[];
  attemptedSegmentIds?: string[];
  viewedSegmentIds?: string[];
  /** GAP-FIX-R5 (B.24): the run's pinned approach (null before choosing) and Core's pin. */
  approachId?: string | null;
  onChooseApproach?: OnChooseApproach;
}) {
  const frame = lessonDocumentFrame(raw, responseLocale);
  const stage = loadMentorStageProjection(mentorStage);
  return <LessonDocumentView raw={raw} locale={frame.locale} ageBand={frame.ageBand ?? '6-9'} theme={theme} onBack={onBack} onGrade={onGrade}
    onGradeNumberLine={onGradeNumberLine} onGradeFractionArea={onGradeFractionArea} onGradeBarModel={onGradeBarModel} onGradeSchemaDiagram={onGradeSchemaDiagram} onGradeWorkedExample={onGradeWorkedExample} onGradeReasoning={onGradeReasoning}
    onGradeAny={onGradeAny} onView={onView} onHelpUsed={onHelpUsed} onComplete={onComplete} metSegmentIds={metSegmentIds} attemptedSegmentIds={attemptedSegmentIds}
    viewedSegmentIds={viewedSegmentIds} mentorStage={stage} adventureTheme={loadAdventureThemeProjection(adventureTheme)} narrationAudio={loadNarrationAudio(narrationAudio)}
    approachId={approachId ?? null} onChooseApproach={onChooseApproach} />;
}

/** Only segment ids mapped to an https or same-origin audio path survive; everything else plays nothing. */
export function loadNarrationAudio(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>)
    .filter((entry): entry is [string, string] => /^[a-z0-9][a-z0-9._:-]{2,100}$/.test(entry[0]) && typeof entry[1] === 'string' && /^(https:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/.test(entry[1])));
}
