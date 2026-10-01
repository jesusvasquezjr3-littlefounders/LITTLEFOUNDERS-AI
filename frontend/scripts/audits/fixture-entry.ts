// Audit-only build entry: the exact product pilot functions, without a dev module graph.
import { goalBulletPilotDocument } from '../../src/rebuild/learning/GoalBulletBoard';
import { allocationPilotDocument } from '../../src/rebuild/learning/AllocationBoard';
import { functionMachinePilotDocument } from '../../src/rebuild/learning/FunctionMachineBoard';

const target = window as unknown as { __lfAuditLessonFixtures: (locales: string[]) => unknown };
target.__lfAuditLessonFixtures = (locales) => {
  const out: Record<string, unknown> = {};
  for (const locale of locales) out[locale] = {
    goal: goalBulletPilotDocument(locale as 'en-US' | 'es-MX' | 'pt-BR', '6-9'),
    allocation: allocationPilotDocument(locale as 'en-US' | 'es-MX' | 'pt-BR', 'adult'),
    functionMachine: functionMachinePilotDocument(locale as 'en-US' | 'es-MX' | 'pt-BR'),
  };
  return JSON.parse(JSON.stringify(out));
};
