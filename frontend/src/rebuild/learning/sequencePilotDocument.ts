import type { Locale } from '../design/copyBudget';
import { allocationPilotDocument } from './AllocationBoard';
import { growthPilotDocument } from './GrowthBoard';
import { loadLessonClientDocument } from './lessonDocument';

/** One controlled two-activity preview; no publication or saved progress. */
export function sequencePilotDocument(locale: Locale): unknown {
  const exploration = loadLessonClientDocument(growthPilotDocument(locale, '6-9'));
  const allocation = loadLessonClientDocument(allocationPilotDocument(locale, '6-9'));
  if (exploration.status !== 'ready' || allocation.status !== 'ready') throw new Error('Invalid pilot fixture');
  const titles: Record<Locale, string> = { 'en-US': 'Save for later', 'es-MX': 'Ahorra para después', 'pt-BR': 'Guarde para depois' };
  return {
    ...allocation.document,
    lesson_id: 'pilot-savings-sequence',
    title: titles[locale],
    knowledge_component_ids: ['kc-savings-growth', 'kc-saving-allocation'],
    required_capabilities: [...exploration.document.required_capabilities, ...allocation.document.required_capabilities],
    segments: [...exploration.document.segments, ...allocation.document.segments],
  };
}
