import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { goalBulletPilotDocument } from './GoalBulletBoard';
import { AuthenticatedLessonDocument } from './AuthenticatedLessonDocument';

describe('authenticated v2 lesson delivery', () => {
  it('renders from client-safe document metadata without receiving an age value', () => {
    render(<AuthenticatedLessonDocument raw={goalBulletPilotDocument('en-US', '6-9')} responseLocale="en-US" onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Reach a savings goal' })).toBeTruthy();
  });

  it('fails closed for a malformed delivered v2 document', () => {
    render(<AuthenticatedLessonDocument raw={{ schema_version: 2 }} responseLocale="es-MX" onBack={vi.fn()} />);
    expect(screen.getByText('Esta lección no se puede abrir.')).toBeTruthy();
  });
});
