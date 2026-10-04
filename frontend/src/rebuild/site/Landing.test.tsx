import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RebuildRoot } from '../design/controls';
import { Landing } from './Landing';
import { rebuildNamespaceCopy } from '../../i18n/rebuild';
import type { Locale } from '../design/copyBudget';

describe('parent-first landing demonstrations', () => {
  for (const locale of ['en-US', 'es-MX', 'pt-BR'] as Locale[]) it(`explores challenges without starting a session in ${locale}`, () => {
    const onStart = vi.fn(), l = rebuildNamespaceCopy[locale].site.landingV2;
    const { container } = render(<RebuildRoot locale={locale} theme="light"><Landing locale={locale} start={{ kind: 'guest', pending: null, failed: null, onStart }} /></RebuildRoot>);
    const stepper = container.querySelector('.lf-landing-stepper')!;
    fireEvent.click(within(stepper as HTMLElement).getByRole('button', { name: l.addCoin }));
    expect(stepper.querySelector('output')).toHaveTextContent('3 / 10');
    for (let i = 0; i < 20; i++) fireEvent.click(within(stepper as HTMLElement).getByRole('button', { name: l.addCoin }));
    expect(stepper.querySelector('output')).toHaveTextContent('10 / 10');
    expect(within(stepper as HTMLElement).getByRole('button', { name: l.addCoin })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(l.topics[1]!.title) }));
    fireEvent.click(screen.getByRole('button', { name: '8' }));
    expect(container.querySelector('[data-demo="1"] [role="status"]')).toHaveTextContent(l.topics[1]!.feedback[1]!);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(l.topics[2]!.title) }));
    expect(container.querySelector('[data-demo="2"] [role="status"]')).toHaveTextContent(l.tryHint);
    fireEvent.click(screen.getByRole('button', { name: l.topics[2]!.options[0]! }));
    expect(container.querySelector('[data-demo="2"] [role="status"]')).toHaveTextContent(l.topics[2]!.feedback[0]!);
    fireEvent.click(screen.getByRole('button', { name: l.reasons[2]!.label }));
    expect(container.querySelector('.lf-landing-reasoning [role="status"]')).toHaveTextContent(l.reasons[2]!.feedback);
    fireEvent.click(screen.getByRole('button', { name: l.approve }));
    expect(screen.getByRole('button', { name: l.approved })).toBeDisabled();
    expect(container.querySelector('.lf-landing-family-preview [role="status"]')).toHaveTextContent(l.approvalDemo);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(l.ages[2]!.title) }));
    expect(container.querySelector('.lf-landing-path [role="status"]')).toHaveTextContent(l.ages[2]!.body);
    expect(onStart).not.toHaveBeenCalled();
    expect(container.querySelector('select')).toBeNull();
  });
});
