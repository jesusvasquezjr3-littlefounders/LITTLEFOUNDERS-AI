import { fireEvent, screen, within } from '@testing-library/react';

/** Fill the visible date parts in their authored day/month/year order. */
export function enterDate(label: string, iso: string) {
  const fields = within(screen.getByRole('group', { name: label })).getAllByRole('textbox');
  const [year = '', month = '', day = ''] = iso.split('-');
  for (const [index, value] of [day, month, year].entries()) fireEvent.change(fields[index]!, { target: { value } });
}
export function readDate(label: string): string {
  const [day, month, year] = within(screen.getByRole('group', { name: label })).getAllByRole('textbox') as HTMLInputElement[];
  return `${year!.value}-${month!.value.padStart(2, '0')}-${day!.value.padStart(2, '0')}`;
}
