import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Disclosure } from './controls';

/* The shared disclosure (W2 Lane 1, the public FAQ): a heading whose button reports and controls its region. */
function Harness({ initial = false }: { initial?: boolean }) {
  const [open, setOpen] = useState(initial);
  return <Disclosure summary="Can I delete our account?" open={open} onToggle={() => setOpen((value) => !value)}>
    <p data-copy-role="body">Yes, in Settings.</p>
  </Disclosure>;
}

describe('Disclosure', () => {
  it('names its region, reports its state and shows the panel only when open', () => {
    render(<Harness />);
    const button = screen.getByRole('button', { name: 'Can I delete our account?' });
    expect(button.closest('h2')).not.toBeNull();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).toHaveAttribute('data-copy-role', 'heading');
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
    expect(panel).not.toBeVisible();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toBeVisible();
    fireEvent.click(button);
    expect(panel).not.toBeVisible();
  });

  it('can start open (an answer linked by its address)', () => {
    render(<Harness initial />);
    expect(screen.getByText('Yes, in Settings.')).toBeVisible();
  });
});
