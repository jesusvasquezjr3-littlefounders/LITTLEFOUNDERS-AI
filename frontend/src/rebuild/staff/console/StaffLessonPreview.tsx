import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, useRebuildEnvironment } from '../../design/controls';
import { useFocusTrap, useLayer, useLayerHost, useScrollLock } from '../../design/layers';
import { lessonDocumentFrame, loadNarrationAudio } from '../../learning/AuthenticatedLessonDocument';
import { LessonDocumentView, type OnGradeAny, type OnGradeReasoning } from '../../learning/LessonDocumentView';
import { LessonLayer } from '../../learning/LessonLayer';
import { loadMentorStageProjection } from '../../learning/lessonDocument';
import type { JudgmentQuality } from '../../learning/DecisionReasonsBoard';
import type { LessonPreviewRequest } from './StaffContent';
import './staffLessonPreview.css';

/*
 * GAP-FIX-R6 (Bible 02 rule 23 and D13; 08 §0 item 2; OD-24; Appendix C Part 3
 * Stage 3; Product 10 G.2; inventory S2 "preview a lesson rendered in each
 * language"): the staff review of a v2 lesson plays it in the learner's OWN
 * rebuilt renderer, the LessonDocumentView the learner route mounts, in the
 * lesson layer the learner gets (its own language, age band and Copy Budget,
 * the compact Mentor stage Core projects), never in the legacy v1 player and
 * never inside the legacy global sheet.
 *
 * What differs from a learner's run, on purpose:
 *   - every answer is checked by Core against the real answer key with the
 *     learner's scorer (POST /admin/content/lessons/:id/preview-grade), and
 *     NOTHING is recorded: no run, no receipt, no view, no completion;
 *   - no `onView` and no `onComplete`, so no step is saved and the end of the
 *     lesson is the plain end screen;
 *   - an approach choice (B.24) stays local to the preview.
 *
 * It opens as a full-viewport modal layer over the console (the page behind
 * is hidden and inert, scroll is locked, focus is trapped, Escape closes),
 * under a staff bar in the console's language that says nothing is saved.
 */
export default function StaffLessonPreview({ request }: { request: LessonPreviewRequest }) {
  const environment = useRebuildEnvironment();
  const panel = useRef<HTMLDivElement>(null);
  const host = useLayerHost(true, { layer: 'scrim' });
  const ready = host !== null && host.isConnected;
  // Escape closes the preview through the shared layer stack (DP-03), like every other overlay.
  const onClose = request.onExit;
  useLayer(ready, host, true, onClose);
  // The layer is opaque and fills the viewport, so nothing of the console behind it can be seen: while it is open the
  // console is hidden, not only inert, and the page's one visible <h1> is the lesson's, as on the learner's own route
  // (03 §3.2). Declared before the focus trap, so the console is shown again before focus goes back to its opener.
  useLayoutEffect(() => {
    if (!ready) return;
    document.body.dataset.lfCovered = 'lesson-preview';
    return () => { delete document.body.dataset.lfCovered; };
  }, [ready]);
  useScrollLock(ready);
  useFocusTrap(ready, panel);
  // The lesson layer names the document after the lesson and in its language; the console gets both back on close.
  const [saved] = useState(() => ({ title: document.title, lang: document.documentElement.lang }));
  useEffect(() => () => {
    document.title = saved.title;
    document.documentElement.lang = saved.lang;
  }, [saved]);
  if (!host) return null;

  const frame = lessonDocumentFrame(request.document, request.locale);
  const verdict = async (answer: unknown, segmentId: string) => (await request.grade(segmentId, answer)).verdict;
  const gradeReasoning: OnGradeReasoning = async (answer, segmentId) => {
    const graded = await request.grade(segmentId, answer);
    const judgment = graded.judgment === 'sound' || graded.judgment === 'partial' || graded.judgment === 'unsupported' ? graded.judgment as JudgmentQuality : undefined;
    return { verdict: graded.verdict, ...(judgment ? { judgment } : {}) };
  };
  const gradeAny: OnGradeAny = async (answer, segmentId) => {
    const graded = await request.grade(segmentId, answer);
    return { verdict: graded.verdict, ...(graded.diagnostic ? { diagnostic: graded.diagnostic } : {}) };
  };

  return createPortal(<div className="lf-layer lf-layer--scrim lf-staff-lesson-preview" data-overlay="lesson-preview" data-schema="2">
    <div ref={panel} className="lf-staff-lesson-preview-frame" role="dialog" aria-modal="true" aria-label={request.labels.dialog}>
      <div className="lf-staff-lesson-preview-bar" lang={environment.locale}>
        <p data-copy-role="body">{request.labels.bar}</p>
        <Button size="sm" onClick={onClose}>{request.labels.close}</Button>
      </div>
      <LessonLayer theme={environment.theme} locale={frame.locale} ageBand={frame.ageBand} pageTitle={frame.title ?? request.labels.dialog} screen="lesson">
        <LessonDocumentView raw={request.document} locale={frame.locale} ageBand={frame.ageBand ?? '6-9'} theme={environment.theme} onBack={request.onExit}
          onGrade={verdict} onGradeNumberLine={verdict} onGradeFractionArea={verdict} onGradeBarModel={verdict} onGradeSchemaDiagram={verdict}
          onGradeWorkedExample={verdict} onGradeReasoning={gradeReasoning} onGradeAny={gradeAny}
          mentorStage={loadMentorStageProjection(request.mentorStage)} narrationAudio={loadNarrationAudio(request.narrationAudio)} previewSequence />
      </LessonLayer>
    </div>
  </div>, host);
}
