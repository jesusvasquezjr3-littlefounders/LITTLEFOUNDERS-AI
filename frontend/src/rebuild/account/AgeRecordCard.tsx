import { Card, Copy } from '../design/controls';

/*
 * P3, the age a self-managed account declared (S-04, OD-28; Product 10 E.4).
 *
 * Read-only by design: the age screen is asked once and the account it
 * governs can never edit the answer (E.4), so this card has no control. It
 * tells a 13-17-year-old what was kept and when the account moves to the adult
 * tier: with a birth month, after the month they turn 18; without one (an
 * older declaration), it stays 13 to 17. A teen who has moved says so. Shown
 * to nobody else: a child, an adult who declared as an adult and a guest have
 * nothing to read here. Copy-only, no transport: the route owns the data plane.
 */

export interface AgeRecordCopy { title: string; teenMonth: string; teenBand: string; adultByMonth: string; locked: string }

export type AgeRecordKind = 'teenMonth' | 'teenBand' | 'adultByMonth';

/** GET /auth/age-screen, reduced to what this card says; null = no card. */
export function ageRecordKind(state: unknown): AgeRecordKind | null {
  const value = state as { required?: unknown; ageBand?: unknown; protectedOrigin?: unknown; birthMonthRecorded?: unknown; adultByBirthMonth?: unknown } | null;
  if (!value || value.required !== false || value.protectedOrigin !== false) return null;
  if (value.ageBand === 'adult' && value.adultByBirthMonth === true) return 'adultByMonth';
  if (value.ageBand !== '13_to_17') return null;
  return value.birthMonthRecorded === true ? 'teenMonth' : 'teenBand';
}

export function AgeRecordCard({ copy, kind }: { copy: AgeRecordCopy; kind: AgeRecordKind }) {
  return <Card heading={copy.title}>
    <div className="lf-settings-form" data-setting="age-record" data-age-record={kind}>
      <Copy role="body">{copy[kind]}</Copy>
      <Copy role="body">{copy.locked}</Copy>
    </div>
  </Card>;
}
