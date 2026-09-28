import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTROLLED_GLOSSARY, glossaryProblems, glossaryPromptLines, scanGlossary } from '../contentGates/glossary.js';
import { translationSystemPrompt } from '../pipeline/localize.js';
import { runV2DocumentGates } from '../v2/gates.js';

/* OD-11 (GAP-FIX-R1 learning): Forge's AI translator works from the owner log's controlled glossary. */

const here = path.dirname(fileURLToPath(import.meta.url));
const ownerLog = readFileSync(path.resolve(here, '../../../docs/littlefounders-spec/product/13-OWNER-DECISION-LOG.md'), 'utf8');

describe('the controlled glossary (owner log section 5)', () => {
  it('is the owner log table, row for row', () => {
    const section = ownerLog.slice(ownerLog.indexOf('## 5. Controlled glossary'), ownerLog.indexOf('## 6.'));
    const rows = section.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Concept') && !line.startsWith('|---'))
      .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
    // The retired section name in the owner log's concept cell is history, not a term the translator is handed (OD-28).
    const concept = (cell: string) => cell.replace(/formerly "[^"]+", /, '');
    expect(rows.map(([name, en, es, pt, never]) => ({ concept: concept(name!), term: { 'en-US': en, 'es-MX': es, 'pt-BR': pt }, neverUse: never })))
      .toEqual(CONTROLLED_GLOSSARY);
    expect(glossaryPromptLines('en-US')).not.toMatch(/digital banking/i);
  });

  it('is injected into the translator prompt for the target market', () => {
    const pt = translationSystemPrompt('pt-BR');
    expect(pt).toContain(glossaryPromptLines('pt-BR'));
    expect(pt).toContain('"Carteira"');
    expect(pt).toContain('"moedas"');
    expect(translationSystemPrompt('en-US')).toContain('never a Tutor, bot or assistant');
  });

  it('blocks never-use terms after translation, and sends negated or quoted uses to review', () => {
    expect(scanGlossary('Ask the chatbot for help.', 'en-US')[0]).toMatchObject({ misuse: 'bot-or-assistant', severity: 'block' });
    expect(scanGlossary('Buy a streak freeze today.', 'en-US')[0]).toMatchObject({ misuse: 'streak-freeze', severity: 'block' });
    expect(scanGlossary('Tu tutor virtual te ayuda.', 'es-MX')[0]).toMatchObject({ misuse: 'ai-as-tutor', severity: 'block' });
    expect(scanGlossary('Abra o banco digital.', 'pt-BR')[0]).toMatchObject({ misuse: 'wallet-as-bank', severity: 'block' });
    expect(scanGlossary('Your chore is a task, not a job.', 'en-US')[0]).toMatchObject({ misuse: 'chore-as-job', severity: 'review' });
    expect(scanGlossary('A bank keeps money safe.', 'en-US')).toEqual([]);
    expect(glossaryProblems({ title: 'Meet your Mentor', segments: [{ prompt: 'Finish the job for coins.' }] }, 'en-US')).toHaveLength(1);
  });

  it('runs on v2 learner-visible strings too', () => {
    const report = runV2DocumentGates({ locale: 'en-US', age_band: '10-12', title: 'Talk to the bot', segments: [] });
    expect(report.problems.some((problem) => problem.gate === 12 && /glossary term/.test(problem.message))).toBe(true);
  });
});
