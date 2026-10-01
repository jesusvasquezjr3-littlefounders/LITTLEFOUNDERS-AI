import { fireEvent, screen } from '@testing-library/react';

/** Choose an app-rendered option through the same popup a pointer user sees. */
export function selectOption(trigger: HTMLElement, label: string) {
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('option', { name: label }));
}

/** Inspect offered labels without relying on native select internals. */
export function optionLabels(trigger: HTMLElement): string[] {
  fireEvent.click(trigger);
  const labels = screen.getAllByRole('option').map(option => option.textContent ?? '');
  fireEvent.keyDown(trigger, { key: 'Escape' });
  return labels;
}
