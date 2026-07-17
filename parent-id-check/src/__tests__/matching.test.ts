import { describe, expect, it } from 'vitest';
import {
  birthDateFound,
  documentNotExpired,
  matchDocument,
  namesMatch,
  normalize,
} from '../services/matching.js';

// Synthetic INE-style OCR text — no real person.
const INE_TEXT = `
INSTITUTO NACIONAL ELECTORAL
CREDENCIAL PARA VOTAR
NOMBRE
GÓMEZ
HERNÁNDEZ
MARÍA FERNANDA
FECHA DE NACIMIENTO 14/02/1988
DOMICILIO AV SIEMPRE VIVA 742 COL CENTRO
CLAVE DE ELECTOR GMHRMF88021409M100
EMISIÓN 2022 VIGENCIA 2032
`;

const APPLICANT = { givenNames: 'María Fernanda', surnames: 'Gómez Hernández', birthDate: '1988-02-14' };
const TODAY = new Date('2026-07-12T12:00:00Z');

describe('normalize', () => {
  it('strips diacritics, uppercases, collapses whitespace', () => {
    expect(normalize('  María   Gómez\n')).toBe('MARIA GOMEZ');
  });
});

describe('namesMatch', () => {
  const text = normalize(INE_TEXT);
  it('matches all name tokens regardless of order', () => {
    expect(namesMatch(text, APPLICANT.givenNames, APPLICANT.surnames)).toBe(true);
  });
  it('tolerates one OCR edit on long tokens', () => {
    expect(namesMatch(normalize(INE_TEXT.replace('FERNANDA', 'FERNANDX')), APPLICANT.givenNames, APPLICANT.surnames)).toBe(true);
  });
  it('rejects a different person', () => {
    expect(namesMatch(text, 'Carlos', 'López Ramírez')).toBe(false);
  });
  it('rejects when only the surname matches', () => {
    expect(namesMatch(text, 'Alejandro', 'Gómez Hernández')).toBe(false);
  });
});

describe('birthDateFound', () => {
  const text = normalize(INE_TEXT);
  it('finds dd/mm/yyyy', () => {
    expect(birthDateFound(text, '1988-02-14')).toBe(true);
  });
  it('finds month-abbreviation formats', () => {
    expect(birthDateFound(normalize('NACIMIENTO 14 FEB 1988'), '1988-02-14')).toBe(true);
  });
  it('rejects a wrong date', () => {
    expect(birthDateFound(text, '1990-05-01')).toBe(false);
  });
});

describe('documentNotExpired', () => {
  it('accepts INE-style standalone VIGENCIA year in the future', () => {
    expect(documentNotExpired(normalize('VIGENCIA 2032'), '1988-02-14', TODAY)).toBe(true);
  });
  it('accepts the current year (valid through year end)', () => {
    expect(documentNotExpired(normalize('VIGENCIA 2026'), '1988-02-14', TODAY)).toBe(true);
  });
  it('rejects an expired document', () => {
    expect(documentNotExpired(normalize('EMISION 2015 VIGENCIA 2025'), '1988-02-14', TODAY)).toBe(false);
  });
  it('rejects when no validity signal exists (never fail open)', () => {
    expect(documentNotExpired(normalize('NO DATES HERE'), '1988-02-14', TODAY)).toBe(false);
  });
  it('does not count the birth year as validity', () => {
    expect(documentNotExpired(normalize('NACIMIENTO 14/02/2026'), '2026-02-14', TODAY)).toBe(false);
  });
  it('accepts a full future expiry date', () => {
    expect(documentNotExpired(normalize('EXPIRA 01/03/2030'), '1988-02-14', TODAY)).toBe(true);
  });
});

describe('matchDocument', () => {
  it('verifies the matching applicant', () => {
    const result = matchDocument(INE_TEXT, APPLICANT, TODAY);
    expect(result.checks).toEqual({
      documentReadable: true,
      nameMatch: true,
      birthDateMatch: true,
      notExpired: true,
    });
    expect(result.verified).toBe(true);
  });
  it('fails an unreadable scan', () => {
    const result = matchDocument('a1', APPLICANT, TODAY);
    expect(result.checks.documentReadable).toBe(false);
    expect(result.verified).toBe(false);
  });
  it('fails a name mismatch without leaking which field', () => {
    const result = matchDocument(INE_TEXT, { ...APPLICANT, surnames: 'López' }, TODAY);
    expect(result.verified).toBe(false);
    expect(result.checks.nameMatch).toBe(false);
  });
});
