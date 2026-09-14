import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GamificationCelebration } from '../GamificationCelebration';

describe('GamificationCelebration — a stage pill, never a takeover', () => {
  it('names the streak in its own visible text, not just an icon', () => {
    render(<GamificationCelebration streakDays={12} onDismiss={vi.fn()} />);
    expect(screen.getByRole('button')).toHaveTextContent('12');
  });

  it('dismisses on tap, the same gesture as SoundBlockedNotice', () => {
    const onDismiss = vi.fn();
    render(<GamificationCelebration streakDays={5} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('carries role="status" so a fresh mount is announced, never a scrim or dialog role', () => {
    render(<GamificationCelebration streakDays={1} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
