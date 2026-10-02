import type { Locale } from '../../../design/copyBudget';

/*
 * The few words the plane itself owns. Everything a lesson says (the figure's name, its takeaway, axis names, layer
 * and handle names) is the board's copy and arrives through props. Each line fits the Copy Budget of its role
 * (06 §3): the actions are three words or fewer, the hints are body copy of two short sentences.
 */
export interface PlanoCopy {
  /** Action: switch to the table equivalent, and back. */
  table: string; chart: string;
  /** Data: the table's first column header. */
  name: string;
  /** Body: how the keyboard moves a handle. */
  keys: string;
  /** Body: how the keyboard picks another handle, said only when there is more than one. */
  switchKeys: string;
  /** Body: tapping the plane places the selected handle. */
  tap: string;
  /** Data: appended to the announcement when a key cannot move the handle any further. */
  limit: string;
}

export const planoCopy: Record<Locale, PlanoCopy> = {
  'en-US': {
    table: 'Show as table', chart: 'Show graph', name: 'Name',
    keys: 'Arrow keys move the point. Shift moves farther.',
    switchKeys: 'Page Up and Page Down pick another point.',
    tap: 'Tap the graph to place the point.',
    limit: 'Limit reached',
  },
  'es-MX': {
    table: 'Ver como tabla', chart: 'Ver gráfica', name: 'Nombre',
    keys: 'Las flechas mueven el punto. Shift mueve más lejos.',
    switchKeys: 'Re Pág y Av Pág eligen otro punto.',
    tap: 'Toca la gráfica para colocar el punto.',
    limit: 'Límite alcanzado',
  },
  'pt-BR': {
    table: 'Ver como tabela', chart: 'Ver gráfico', name: 'Nome',
    keys: 'As setas movem o ponto. Shift move mais longe.',
    switchKeys: 'Page Up e Page Down escolhem outro ponto.',
    tap: 'Toque no gráfico para colocar o ponto.',
    limit: 'Limite atingido',
  },
};
