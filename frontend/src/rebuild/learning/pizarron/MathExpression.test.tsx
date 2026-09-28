import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { loadLessonClientDocument, LESSON_CLIENT_CAPABILITIES } from '../lessonDocument';
import { notationPilotDocument } from '../WorkedExampleBoard';
import { texProblem } from '../v2SegmentFamilies.generated';
import { localizeTex, MathExpression } from './MathExpression';

/* Bible 05 §5 and Appendix P Parts 5-6 (GAP-FIX-R2): KaTeX notation, loaded only where declared. */

describe('math notation', () => {
  it('renders KaTeX behind the author-written spoken name, with the plain expression first', async () => {
    const { container } = render(<MathExpression tex="\frac{10}{100}" spokenText="Ten over one hundred" fallback="10 / 100" locale="en-US" />);
    const math = screen.getByRole('img', { name: 'Ten over one hundred' });
    expect(math.textContent).toContain('10 / 100');
    await waitFor(() => expect(container.querySelector('.katex')).not.toBeNull());
    expect(container.querySelector('.lf-math-katex')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('writes pt-BR decimals with a comma KaTeX will not space', () => {
    expect(localizeTex('100 \\times 1.1^{2}', 'pt-BR')).toBe('100 \\times 1{,}1^{2}');
    expect(localizeTex('100 \\times 1.1^{2}', 'en-US')).toBe('100 \\times 1.1^{2}');
    expect(localizeTex('0.1', 'es-MX')).toBe('0.1');
  });

  it('accepts only the whitelisted notation commands', () => {
    expect(texProblem('\\frac{10}{100} \\times 1.1^{2}')).toBeNull();
    expect(texProblem('\\href{https://example.com}{x}')).toMatch(/not an allowed/);
    expect(texProblem('\\text{hello}')).toMatch(/not an allowed/);
    expect(texProblem('\\frac{1}{2')).toMatch(/Unbalanced/);
    expect(texProblem('<script>')).toMatch(/digits, letters/);
  });

  it('a document that declares notation needs the KaTeX capability; the fraction-and-exponent state loads in every locale', () => {
    expect(LESSON_CLIENT_CAPABILITIES).toContain('visual.math-notation.v1');
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as const) expect(loadLessonClientDocument(notationPilotDocument(locale)).status).toBe('ready');
    const document = notationPilotDocument('en-US') as { required_capabilities: string[] };
    expect(loadLessonClientDocument({ ...document, required_capabilities: document.required_capabilities.filter((capability) => capability !== 'visual.math-notation.v1') }).status).toBe('invalid');
    expect(loadLessonClientDocument(notationPilotDocument('en-US'), LESSON_CLIENT_CAPABILITIES.filter((capability) => capability !== 'visual.math-notation.v1')).status).toBe('upgrade-required');
  });
});
