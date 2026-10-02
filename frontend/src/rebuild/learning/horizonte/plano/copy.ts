import type { Locale } from '../../../design/copyBudget';
import type { HorizonteCopy } from '../boardTypes';

/*
 * The few words the plane itself owns. Everything a lesson says (the figure's name, its takeaway, axis names, layer
 * and handle names) is the board's copy and arrives through props. Each line fits the Copy Budget of its role
 * (06 §3): the actions are three words or fewer, the hints are body copy of two short sentences.
 */
export const PLANO_COPY = {
  table: { role: 'action', 'en-US': 'Show as table', 'es-MX': 'Ver como tabla', 'pt-BR': 'Ver como tabela' },
  chart: { role: 'action', 'en-US': 'Show graph', 'es-MX': 'Ver gráfica', 'pt-BR': 'Ver gráfico' },
  name: { role: 'data', 'en-US': 'Name', 'es-MX': 'Nombre', 'pt-BR': 'Nome' },
  keys: { role: 'body', 'en-US': 'Arrow keys move the point. Shift moves farther.', 'es-MX': 'Las flechas mueven el punto. Shift mueve más lejos.', 'pt-BR': 'As setas movem o ponto. Shift move mais longe.' },
  switchKeys: { role: 'body', 'en-US': 'Page Up and Page Down pick another point.', 'es-MX': 'Re Pág y Av Pág eligen otro punto.', 'pt-BR': 'Page Up e Page Down escolhem outro ponto.' },
  tap: { role: 'body', 'en-US': 'Tap the graph to place the point.', 'es-MX': 'Toca la gráfica para colocar el punto.', 'pt-BR': 'Toque no gráfico para colocar o ponto.' },
  limit: { role: 'data', 'en-US': 'Limit reached', 'es-MX': 'Límite alcanzado', 'pt-BR': 'Limite atingido' },
} as const satisfies HorizonteCopy;

export type PlanoCopy = { [K in keyof typeof PLANO_COPY]: string };

export function planoWords(locale: Locale): PlanoCopy {
  const words = {} as Record<string, string>;
  for (const [key, entry] of Object.entries(PLANO_COPY)) words[key] = entry[locale];
  return words as PlanoCopy;
}
