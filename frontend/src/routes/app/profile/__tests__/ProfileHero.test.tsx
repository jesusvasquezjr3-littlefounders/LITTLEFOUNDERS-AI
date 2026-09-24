import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileHero } from '../ProfileHero';

describe('profile cover accessibility', () => {
  it('exposes the cover editor to assistive technology', () => {
    render(<ProfileHero cover={{}} avatarOptions={{}} seed="audit"
      coverAction={<button>Edit cover</button>} />);
    const button = screen.getByRole('button', { name: 'Edit cover' });
    expect(button.closest('[aria-hidden="true"]')).toBeNull();
    expect(button.closest('[role="img"]')).toBeNull();
  });
});
