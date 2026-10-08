import type { CopyRole, Locale } from '../design/copyBudget';

/*
 * GAP-FIX-R2 learning: the fixed UI words of the $6 unit-price comparator,
 * the L2 rule builder and the L6/$9 built flowchart (buildBoards.tsx).
 * Authored text (offers, conditions, actions, questions, outcomes, cards)
 * comes from the document. Rule keywords are the conventional words of each
 * locale's classroom logic (SI/ENTONCES, SE/ENTÃO).
 */
export interface BuildCopy {
  offers: string; items: string; price: string; per: string; better: string; coins: string;
  rule: string; ifWord: string; thenWord: string; elseWord: string; and: string; or: string; not: string; none: string;
  condition: string; link: string; action: string; otherwise: string; cards: string; run: string; outcome: string; notRun: string;
  chart: string; start: string; yesBranch: string; noBranch: string; putHere: string; test: string; yes: string; no: string; empty: string;
}

export const buildCopy: Record<Locale, BuildCopy> = {
  'en-US': {
    offers: 'Offers', items: 'Items', price: 'Price', per: 'per', better: 'Lower unit price', coins: 'coins',
    rule: 'Your rule', ifWord: 'IF', thenWord: 'THEN', elseWord: 'ELSE', and: 'AND', or: 'OR', not: 'NOT', none: 'Just this',
    condition: 'Condition', link: 'Link', action: 'Then do', otherwise: 'Else do', cards: 'Try it on cards', run: 'Run the rule', outcome: 'Rule says', notRun: 'Not run yet',
    chart: 'Your chart', start: 'First step', yesBranch: 'If yes', noBranch: 'If no', putHere: 'Put here', test: 'Test the chart', yes: 'Yes', no: 'No', empty: 'Empty',
  },
  'es-MX': {
    offers: 'Ofertas', items: 'Artículos', price: 'Precio', per: 'por', better: 'Menor precio unitario', coins: 'monedas',
    rule: 'Tu regla', ifWord: 'SI', thenWord: 'ENTONCES', elseWord: 'SI NO', and: 'Y', or: 'O', not: 'NO', none: 'Solo esta',
    condition: 'Condición', link: 'Unión', action: 'Entonces haz', otherwise: 'Si no, haz', cards: 'Pruébala con tarjetas', run: 'Aplica la regla', outcome: 'La regla dice', notRun: 'Sin aplicar',
    chart: 'Tu diagrama', start: 'Primer paso', yesBranch: 'Si es sí', noBranch: 'Si es no', putHere: 'Pon aquí', test: 'Prueba el diagrama', yes: 'Sí', no: 'No', empty: 'Vacío',
  },
  'pt-BR': {
    offers: 'Ofertas', items: 'Itens', price: 'Preço', per: 'por', better: 'Menor preço unitário', coins: 'moedas',
    rule: 'Sua regra', ifWord: 'SE', thenWord: 'ENTÃO', elseWord: 'SENÃO', and: 'E', or: 'OU', not: 'NÃO', none: 'Só esta',
    condition: 'Condição', link: 'Ligação', action: 'Então faça', otherwise: 'Senão, faça', cards: 'Teste com cartões', run: 'Aplicar a regra', outcome: 'A regra diz', notRun: 'Ainda não aplicada',
    chart: 'Seu diagrama', start: 'Primeiro passo', yesBranch: 'Se sim', noBranch: 'Se não', putHere: 'Coloque aqui', test: 'Testar o diagrama', yes: 'Sim', no: 'Não', empty: 'Vazio',
  },
};

export const buildCopyRoles: Record<keyof BuildCopy, CopyRole> = {
  offers: 'heading', items: 'data', price: 'data', per: 'data', better: 'body', coins: 'data',
  rule: 'heading', ifWord: 'data', thenWord: 'data', elseWord: 'data', and: 'option', or: 'option', not: 'option', none: 'option',
  condition: 'body', link: 'body', action: 'body', otherwise: 'body', cards: 'heading', run: 'action', outcome: 'body', notRun: 'data',
  chart: 'heading', start: 'body', yesBranch: 'body', noBranch: 'body', putHere: 'body', test: 'action', yes: 'data', no: 'data', empty: 'data',
};
