import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LessonLayer } from './LessonLayer';

function Screen({ heading }: { heading: string }) {
  return <main className="lf-learning"><h1 data-copy-role="heading">{heading}</h1></main>;
}

describe('the lesson layer (W2L.3)', () => {
  it('carries the shell duties a full-screen lesson has no shell for', () => {
    render(<LessonLayer theme="dark" locale="pt-BR" ageBand="10-12" pageTitle="Lição" screen="opening"><Screen heading="Abrindo a lição" /></LessonLayer>);
    const layer = document.querySelector<HTMLElement>('[data-shell="lesson"]')!;
    expect(document.title).toBe('Lição · LittleFounders');
    expect(document.documentElement.lang).toBe('pt-BR');
    const root = layer.closest('.lf-rebuild')!;
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(root).toHaveAttribute('data-age-band', '10-12');
    // The skip link is the first stop, it is our own copy, and it targets the screen's one <main>.
    const skip = layer.firstElementChild as HTMLAnchorElement;
    expect(skip).toHaveClass('lf-skip-link');
    expect(skip.textContent).toBe('Ir para o conteúdo');
    expect(skip.getAttribute('href')).toBe(`#${layer.querySelector('main')!.id}`);
  });

  it('moves focus to the new screen heading when the lesson changes screens, never on arrival or an in-place render', () => {
    const view = render(<LessonLayer theme="light" locale="en-US" pageTitle="Lesson" screen="opening"><Screen heading="Opening lesson" /></LessonLayer>);
    expect(document.activeElement).toBe(document.body);
    view.rerender(<LessonLayer theme="light" locale="en-US" pageTitle="Lesson" screen="opening"><Screen heading="Opening lesson" /></LessonLayer>);
    expect(document.activeElement).toBe(document.body);
    view.rerender(<LessonLayer theme="light" locale="en-US" pageTitle="Your result" screen="result"><Screen heading="Lesson complete" /></LessonLayer>);
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Lesson complete' }));
    expect(document.title).toBe('Your result · LittleFounders');
  });
});
