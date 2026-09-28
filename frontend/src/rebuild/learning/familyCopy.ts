import type { CopyRole, Locale } from '../design/copyBudget';

/*
 * GAP-FIX-R1 learning: the fixed UI words of the first-release logic, money,
 * story and Mentor boards (familyBoards.tsx). Authored lesson text (rules,
 * items, messages, scenes, lines) comes from the document; these are only the
 * board's own labels, budgeted in familyCopy.test.ts for the youngest band.
 */
export interface FamilyCopy {
  rule: string; cards: string; flip: string; flipped: string;
  onlyIn: string; both: string; neither: string; diagram: string;
  yes: string; no: string; startOver: string; result: string; caseLabel: string; chart: string; whole: string;
  bins: string; why: string; pickBin: string;
  messages: string; scam: string; notScam: string; from: string;
  tray: string; total: string; price: string; paid: string; change: string; fewer: string; more: string;
  next: string; whatHappened: string;
}

export const familyCopy: Record<Locale, FamilyCopy> = {
  'en-US': {
    rule: 'The rule', cards: 'Cards', flip: 'Turn over', flipped: 'Turned over',
    onlyIn: 'Only {set}', both: 'In both', neither: 'In neither', diagram: 'Circle diagram',
    yes: 'Yes', no: 'No', startOver: 'Start over', result: 'Result', caseLabel: 'Case', chart: 'Chart steps', whole: 'Show whole chart',
    bins: 'Groups', why: 'Why?', pickBin: 'Pick a group',
    messages: 'Messages', scam: 'Scam', notScam: 'Looks fine', from: 'From',
    tray: 'Money tray', total: 'Total', price: 'Price', paid: 'Paid', change: 'Change to give', fewer: 'Fewer', more: 'More',
    next: 'Next', whatHappened: 'What happened',
  },
  'es-MX': {
    rule: 'La regla', cards: 'Tarjetas', flip: 'Voltear', flipped: 'Volteada',
    onlyIn: 'Solo {set}', both: 'En ambos', neither: 'En ninguno', diagram: 'Diagrama de círculos',
    yes: 'Sí', no: 'No', startOver: 'Empezar de nuevo', result: 'Resultado', caseLabel: 'Caso', chart: 'Pasos del diagrama', whole: 'Ver todo el diagrama',
    bins: 'Grupos', why: '¿Por qué?', pickBin: 'Elige un grupo',
    messages: 'Mensajes', scam: 'Estafa', notScam: 'Se ve bien', from: 'De',
    tray: 'Bandeja de dinero', total: 'Total', price: 'Precio', paid: 'Pagado', change: 'Cambio a dar', fewer: 'Menos', more: 'Más',
    next: 'Siguiente', whatHappened: 'Qué pasó',
  },
  'pt-BR': {
    rule: 'A regra', cards: 'Cartas', flip: 'Virar', flipped: 'Virada',
    onlyIn: 'Só {set}', both: 'Nos dois', neither: 'Em nenhum', diagram: 'Diagrama de círculos',
    yes: 'Sim', no: 'Não', startOver: 'Começar de novo', result: 'Resultado', caseLabel: 'Caso', chart: 'Passos do diagrama', whole: 'Ver o diagrama todo',
    bins: 'Grupos', why: 'Por quê?', pickBin: 'Escolha um grupo',
    messages: 'Mensagens', scam: 'Golpe', notScam: 'Parece normal', from: 'De',
    tray: 'Bandeja de dinheiro', total: 'Total', price: 'Preço', paid: 'Pago', change: 'Troco a dar', fewer: 'Menos', more: 'Mais',
    next: 'Próximo', whatHappened: 'O que aconteceu',
  },
};

export const familyCopyRoles: Record<keyof FamilyCopy, CopyRole> = {
  rule: 'heading', cards: 'heading', flip: 'action', flipped: 'body',
  onlyIn: 'option', both: 'option', neither: 'option', diagram: 'body',
  yes: 'action', no: 'action', startOver: 'action', result: 'body', caseLabel: 'body', chart: 'heading', whole: 'action',
  bins: 'heading', why: 'body', pickBin: 'body',
  messages: 'heading', scam: 'option', notScam: 'option', from: 'data',
  tray: 'heading', total: 'body', price: 'body', paid: 'body', change: 'body', fewer: 'action', more: 'action',
  next: 'action', whatHappened: 'heading',
};
