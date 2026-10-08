import type { Locale } from '../design/copyBudget';
import { pluralUnit } from '../design/plural';

/*
 * GAP-FIX-R1 learning (B.7 part 2): the fixed UI words of the Appendix A
 * Part 3 concept boards (conceptBoards.tsx). Authored lesson text (prompts,
 * option and asset names, labels) comes from the document; these are only the
 * boards' own labels, budgeted in conceptBoards.test.tsx. "{n}" and "{x}" are
 * filled at render time.
 */
export interface ConceptCopy {
  less: string; more: string; month: string; monthN: string; startBalance: string; payment: string; interest: string; toLoan: string; balanceAfter: string; yourBalance: string; schedule: string;
  price: string; quantity: string; shift: string; shiftValue: string; priceNow: string; priceMoves: string; up: string; down: string; same: string; market: string;
  tokensLeft: string; costs: string; gaveUp: string; choose: string;
  rate: string; year: string; years: string; perYear: string; near: string; far: string; view: string; today: string; later: string; laterN: string; costsThen: string; sentence: [string, string, string, string]; predict: string; hidden: string;
  growthRate: string; doubleLine: string; doublesAt: string; notYet: string; ruleEstimate: string; guessYears: string; growth: string;
  strategy: string; snowball: string; avalanche: string; months: string; totalInterest: string; firstPaid: string; balanceTrace: string; ghost: string; thisRun: string; traceSummary: string;
  weight: string; risk: string; return: string; portfolioPoint: string; total: string;
  goal: string; cups: string; openStand: string; day: string; sold: string; revenue: string; cupCost: string; fixed: string; profit: string; ledger: string; running: string;
  cueLeftover: string; cueWaiting: string; cueLoss: string; waterfall: string;
}

export const conceptCopy: Record<Locale, ConceptCopy> = {
  'en-US': {
    less: 'Less', more: 'More', month: 'Month', monthN: 'Month {n}', startBalance: 'Owed at start', payment: 'Payment', interest: 'Interest', toLoan: 'Paid off the loan', balanceAfter: 'Owed after', yourBalance: 'What is still owed?', schedule: 'Loan steps',
    price: 'Price', quantity: 'Amount sold', shift: 'Move {x}', shiftValue: '{n} steps', priceNow: 'Price now', priceMoves: 'What does the price do?', up: 'Goes up', down: 'Goes down', same: 'Stays the same', market: 'Market chart',
    tokensLeft: '{n} tokens left', costs: '{n} tokens', gaveUp: 'What you gave up', choose: 'Your choices',
    rate: 'Price rise per year', year: 'year', years: 'Years', perYear: '{n} a year', near: 'Near', far: 'Far', view: 'Time view', today: 'Today', later: 'Later', laterN: 'In {n} {years}', costsThen: 'It costs {x}', sentence: ['If prices rise', 'yearly for', '{years}, it costs', ''], predict: 'Your guess', hidden: '?',
    growthRate: 'Growth per year', doubleLine: 'Double', doublesAt: 'Doubles in year {n}', notYet: 'Not doubled yet', ruleEstimate: '72 ÷ rate ≈ {n} years', guessYears: 'Years to double', growth: 'Money growing',
    strategy: 'Pay-off plan', snowball: 'Smallest first', avalanche: 'Highest rate first', months: 'Months', totalInterest: 'Total interest', firstPaid: 'First debt paid', balanceTrace: 'Debt over time', ghost: 'Last plan', thisRun: 'This plan', traceSummary: 'Debt-free in {n} months',
    weight: '{x} share', risk: 'Risk', return: 'Return', portfolioPoint: 'Risk and return', total: 'Total {n}%',
    goal: 'Goal:', cups: 'Cups made', openStand: 'Open the stand', day: 'Day {n}', sold: 'Sold', revenue: 'Sales', cupCost: 'Cups cost', fixed: 'Stand cost', profit: 'Profit', ledger: 'Stand ledger', running: 'Running total',
    cueLeftover: 'Some cups were left over.', cueWaiting: 'People still wanted cups.', cueLoss: 'Costs were more than sales.', waterfall: 'From sales to profit',
  },
  'es-MX': {
    less: 'Menos', more: 'Más', month: 'Mes', monthN: 'Mes {n}', startBalance: 'Deuda al inicio', payment: 'Pago', interest: 'Interés', toLoan: 'Abono a la deuda', balanceAfter: 'Deuda después', yourBalance: '¿Cuánto se debe aún?', schedule: 'Pasos del préstamo',
    price: 'Precio', quantity: 'Cantidad vendida', shift: 'Mover {x}', shiftValue: '{n} pasos', priceNow: 'Precio ahora', priceMoves: '¿Qué pasa con el precio?', up: 'Sube', down: 'Baja', same: 'Se queda igual', market: 'Gráfica del mercado',
    tokensLeft: 'Quedan {n} fichas', costs: '{n} fichas', gaveUp: 'Lo que dejaste', choose: 'Tus elecciones',
    rate: 'Alza de precios al año', year: 'año', years: 'Años', perYear: '{n} al año', near: 'Cerca', far: 'Lejos', view: 'Vista del tiempo', today: 'Hoy', later: 'Después', laterN: 'En {n} {years}', costsThen: 'Cuesta {x}', sentence: ['Si los precios suben', 'al año por', '{years}, cuesta', ''], predict: 'Tu cálculo', hidden: '?',
    growthRate: 'Crecimiento al año', doubleLine: 'Doble', doublesAt: 'Se duplica en el año {n}', notYet: 'Aún no se duplica', ruleEstimate: '72 ÷ tasa ≈ {n} años', guessYears: 'Años para duplicar', growth: 'Dinero que crece',
    strategy: 'Plan de pago', snowball: 'La menor primero', avalanche: 'La tasa más alta primero', months: 'Meses', totalInterest: 'Interés total', firstPaid: 'Primera deuda pagada', balanceTrace: 'Deuda en el tiempo', ghost: 'Plan anterior', thisRun: 'Este plan', traceSummary: 'Sin deudas en {n} meses',
    weight: 'Parte de {x}', risk: 'Riesgo', return: 'Rendimiento', portfolioPoint: 'Riesgo y rendimiento', total: 'Total {n}%',
    goal: 'Meta:', cups: 'Vasos hechos', openStand: 'Abrir el puesto', day: 'Día {n}', sold: 'Vendidos', revenue: 'Ventas', cupCost: 'Costo de vasos', fixed: 'Costo del puesto', profit: 'Ganancia', ledger: 'Registro del puesto', running: 'Total acumulado',
    cueLeftover: 'Sobraron algunos vasos.', cueWaiting: 'Aún querían vasos.', cueLoss: 'Los costos superaron las ventas.', waterfall: 'De ventas a ganancia',
  },
  'pt-BR': {
    less: 'Menos', more: 'Mais', month: 'Mês', monthN: 'Mês {n}', startBalance: 'Dívida no início', payment: 'Pagamento', interest: 'Juros', toLoan: 'Abatido da dívida', balanceAfter: 'Dívida depois', yourBalance: 'Quanto ainda se deve?', schedule: 'Passos do empréstimo',
    price: 'Preço', quantity: 'Quantidade vendida', shift: 'Mover {x}', shiftValue: '{n} passos', priceNow: 'Preço agora', priceMoves: 'O que acontece com o preço?', up: 'Sobe', down: 'Desce', same: 'Fica igual', market: 'Gráfico do mercado',
    tokensLeft: 'Restam {n} fichas', costs: '{n} fichas', gaveUp: 'O que você deixou', choose: 'Suas escolhas',
    rate: 'Alta de preços por ano', year: 'ano', years: 'Anos', perYear: '{n} por ano', near: 'Perto', far: 'Longe', view: 'Visão do tempo', today: 'Hoje', later: 'Depois', laterN: 'Em {n} {years}', costsThen: 'Custa {x}', sentence: ['Se os preços sobem', 'por ano durante', '{years}, custa', ''], predict: 'Seu palpite', hidden: '?',
    growthRate: 'Crescimento por ano', doubleLine: 'Dobro', doublesAt: 'Dobra no ano {n}', notYet: 'Ainda não dobrou', ruleEstimate: '72 ÷ taxa ≈ {n} anos', guessYears: 'Anos para dobrar', growth: 'Dinheiro crescendo',
    strategy: 'Plano de pagamento', snowball: 'A menor primeiro', avalanche: 'A taxa mais alta primeiro', months: 'Meses', totalInterest: 'Juros totais', firstPaid: 'Primeira dívida paga', balanceTrace: 'Dívida no tempo', ghost: 'Plano anterior', thisRun: 'Este plano', traceSummary: 'Sem dívidas em {n} meses',
    weight: 'Parte de {x}', risk: 'Risco', return: 'Retorno', portfolioPoint: 'Risco e retorno', total: 'Total {n}%',
    goal: 'Meta:', cups: 'Copos feitos', openStand: 'Abrir a barraca', day: 'Dia {n}', sold: 'Vendidos', revenue: 'Vendas', cupCost: 'Custo dos copos', fixed: 'Custo da barraca', profit: 'Lucro', ledger: 'Registro da barraca', running: 'Total acumulado',
    cueLeftover: 'Sobraram alguns copos.', cueWaiting: 'Ainda queriam copos.', cueLoss: 'Os custos passaram das vendas.', waterfall: 'Das vendas ao lucro',
  },
};

const localCurrency: Record<Locale, string> = { 'en-US': 'USD', 'es-MX': 'MXN', 'pt-BR': 'BRL' };
const coinWord: Record<Locale, [string, string]> = { 'en-US': ['coin', 'coins'], 'es-MX': ['moneda', 'monedas'], 'pt-BR': ['moeda', 'moedas'] };

/** Money for a concept board: whole coins, or the market's currency from minor units. */
export function conceptMoney(locale: Locale, currency: 'coins' | 'local'): (minor: number) => string {
  if (currency === 'local') {
    const format = new Intl.NumberFormat(locale, { style: 'currency', currency: localCurrency[locale], currencyDisplay: 'code' });
    return (minor) => format.format(minor / 100);
  }
  const format = new Intl.NumberFormat(locale);
  return (minor) => `${format.format(minor)} ${pluralUnit(locale, minor, { one: coinWord[locale][0], other: coinWord[locale][1] })}`;
}
export function conceptPercent(locale: Locale): (bps: number) => string {
  const format = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 });
  return (bps) => format.format(bps / 10_000);
}
export const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
