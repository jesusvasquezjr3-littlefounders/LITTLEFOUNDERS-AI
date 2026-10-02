import type { Locale } from '../../design/copyBudget';

/*
 * Horizonte F1.0: the words of the model for the twelve reading charts. The chart
 * model (chartModel.generated.ts) names a computed column or a read part with a
 * `~` prefix ("~median", "~low 80%"); the author's own labels never start with
 * one (chartProblem refuses it). The browser says each word in the learner's
 * language here, so a table header and a read-out never show an English token.
 * This file is the small eager part of the reading charts; the drawing is lazy.
 */

type Words = Record<string, string>;

const WORDS: Record<Locale, Words & { low: string; high: string }> = {
  'en-US': { value: 'Value', change: 'Change', 'of first %': '% of first', 'of previous %': '% of previous', 'people %': '% of people', 'total %': '% of total', gini: 'Gini index',
    n: 'Count', min: 'Lowest', q1: 'Lower quarter', median: 'Median', q3: 'Upper quarter', max: 'Highest', date: 'Date', end: 'End', x: 'x', y: 'y', fit: 'Trend line',
    slope: 'Slope', r2: 'R squared', days: 'Days', low: 'Low', high: 'High' },
  'es-MX': { value: 'Valor', change: 'Cambio', 'of first %': '% del primero', 'of previous %': '% del anterior', 'people %': '% de las personas', 'total %': '% del total', gini: 'Índice de Gini',
    n: 'Cantidad', min: 'Mínimo', q1: 'Cuartil inferior', median: 'Mediana', q3: 'Cuartil superior', max: 'Máximo', date: 'Fecha', end: 'Fin', x: 'x', y: 'y', fit: 'Línea de tendencia',
    slope: 'Pendiente', r2: 'R cuadrada', days: 'Días', low: 'Bajo', high: 'Alto' },
  'pt-BR': { value: 'Valor', change: 'Mudança', 'of first %': '% do primeiro', 'of previous %': '% do anterior', 'people %': '% das pessoas', 'total %': '% do total', gini: 'Índice de Gini',
    n: 'Quantidade', min: 'Mínimo', q1: 'Quartil inferior', median: 'Mediana', q3: 'Quartil superior', max: 'Máximo', date: 'Data', end: 'Fim', x: 'x', y: 'y', fit: 'Linha de tendência',
    slope: 'Inclinação', r2: 'R quadrado', days: 'Dias', low: 'Baixo', high: 'Alto' },
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A model word in the learner's language; any other text is the author's label and comes back as it is. */
export function readingWord(locale: Locale, text: string): string {
  if (!text.startsWith('~')) return text;
  const token = text.slice(1);
  const band = /^(low|high) (\d{1,2})%$/.exec(token);
  if (band) return `${WORDS[locale][band[1]!]} ${band[2]}%`;
  return WORDS[locale][token] ?? token;
}

/** A calendar day (YYYY-MM-DD) in digits only, in the order the locale writes it (09/07/2026 or 07/09/2026): numerals can sit inside the drawing. */
export function readingDate(locale: Locale, day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, date)));
}

/** A table cell of a reading chart: a model word, a day, or the author's own text. */
export function readingCell(locale: Locale, text: string): string {
  return ISO_DAY.test(text) ? readingDate(locale, text) : readingWord(locale, text);
}

/** One read-out part: a share reads as "60% of first", everything else as "Name: value". */
export function readingPart(locale: Locale, name: string, value: number, format: (value: number) => string): string {
  const word = readingWord(locale, name);
  return name.startsWith('~') && word.startsWith('% ') ? `${format(value)}% ${word.slice(2)}` : `${word}: ${format(value)}`;
}

/** A read's dates ("2026-09-07" or "2026-09-07 – 2026-09-21") in the locale's digits. */
export function readingSpan(locale: Locale, text: string): string {
  return text.split(' – ').map((day) => readingDate(locale, day)).join(' – ');
}

export interface ReadingFact { label: string; text?: string; parts: ReadonlyArray<{ name: string; value: number }> }

/** What a screen reader hears for a reading chart: every mark with its dates and numbers, in reading order. */
export function readingDescription(locale: Locale, reads: readonly ReadingFact[], format: (value: number) => string): string {
  return reads.map((read) => {
    const span = read.text ? ` (${readingSpan(locale, read.text)})` : '';
    const parts = read.parts.map((part) => readingPart(locale, part.name, part.value, format)).join(', ');
    return `${read.label}${span}${parts ? `: ${parts}` : ''}`;
  }).join('; ');
}
