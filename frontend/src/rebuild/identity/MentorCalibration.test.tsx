import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { MentorCalibration } from './MentorCalibration';
import en from '@/i18n/en-US/rebuild-mentor.json';

it('offers coarse groups and disables all choices while saving', () => {
  const onChoose = vi.fn();
  const props = { copy: en.mentorCalibration, locale: 'en-US', dark: false, error: false, onChoose, onRetry: vi.fn() };
  const rendered = render(<MentorCalibration {...props} state="form" />);
  fireEvent.click(screen.getByRole('button', { name: '8–9' }));
  expect(onChoose).toHaveBeenCalledWith(2);
  rendered.rerender(<MentorCalibration {...props} state="saving" />);
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  expect(screen.getByRole('status')).toBeInTheDocument();
});
it('keeps choices available after a save failure and offers reload on read failure', () => {
  const retry = vi.fn();
  const props = { copy: en.mentorCalibration, locale: 'en-US', dark: false, error: true, onChoose: vi.fn(), onRetry: retry };
  const rendered = render(<MentorCalibration {...props} state="form" />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '6–7' })).toBeEnabled();
  rendered.rerender(<MentorCalibration {...props} state="error" />);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalled();
});
