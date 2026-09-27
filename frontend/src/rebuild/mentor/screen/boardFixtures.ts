import type { Locale } from '../../design/copyBudget';
import type { TutorWhiteboardWire } from '../session/types';

/*
 * One example of every whiteboard shape Oracle can send, with the server's
 * computed fields filled in as Oracle fills them. Used by the board's unit
 * tests (every kind renders) and the development preview (`?board=<kind>`).
 * The words are what a model would write for a learner in that language.
 */

type Kind = TutorWhiteboardWire['kind'];
const w = (locale: Locale, en: string, es: string, pt: string) => (locale === 'es-MX' ? es : locale === 'pt-BR' ? pt : en);

export function boardFixtures(locale: Locale): { [K in Kind]: Extract<TutorWhiteboardWire, { kind: K }> } {
  const cur = locale === 'es-MX' ? 'MXN' as const : locale === 'pt-BR' ? 'BRL' as const : 'USD' as const;
  const save = w(locale, 'Saving each week', 'Ahorro cada semana', 'Poupança por semana');
  const bike = w(locale, 'Bike', 'Bici', 'Bicicleta');
  const snack = w(locale, 'Snack', 'Botana', 'Lanche');
  const toy = w(locale, 'Toy', 'Juguete', 'Brinquedo');
  const book = w(locale, 'Book', 'Libro', 'Livro');
  const needs = w(locale, 'Needs', 'Necesidades', 'Necessidades');
  const wants = w(locale, 'Wants', 'Deseos', 'Desejos');
  const water = w(locale, 'Water', 'Agua', 'Água');
  const game = w(locale, 'Game', 'Juego', 'Jogo');
  return {
    sequence: { kind: 'sequence', start: 10, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }, { op: 'add', value: 5 }], unit: 'week', values: [15, 20, 25], label: save, currency: cur },
    compare: { kind: 'compare', left: { label: snack, value: 12 }, right: { label: toy, value: 30 }, difference: 18, greater: 'right', label: w(locale, 'Which costs more?', '¿Cuál cuesta más?', 'Qual custa mais?'), currency: cur },
    marked_line: { kind: 'marked_line', min: 0, max: 100, marks: [{ value: 40, label: snack, position: 0.4 }, { value: 75, label: toy, position: 0.75 }], label: w(locale, 'Prices on a line', 'Precios en una recta', 'Preços na reta'), currency: cur },
    categories: { kind: 'categories', categories: [{ label: needs, value: 60 }, { label: wants, value: 40 }], values: [60, 40], label: w(locale, 'Where it went', 'A dónde fue', 'Para onde foi'), currency: cur },
    tokens: { kind: 'tokens', groups: [{ denomination: 10, count: 2 }, { denomination: 5, count: 3 }], subtotals: [20, 15], total: 35, label: w(locale, 'Counting coins', 'Contar monedas', 'Contar moedas'), currency: cur },
    bar_model: { kind: 'bar_model', whole: { label: bike, value: 100 }, parts: [{ label: w(locale, 'Saved', 'Ahorrado', 'Poupado'), value: 60 }, { label: w(locale, 'Still needed', 'Falta', 'Falta'), value: null }], widths: [0.6, 0.4], unknownIndex: 1, label: w(locale, 'Parts of the price', 'Partes del precio', 'Partes do preço'), currency: cur },
    part_whole: { kind: 'part_whole', whole: { label: w(locale, 'Allowance', 'Domingo', 'Mesada'), value: 50 }, left: { label: needs, value: 30 }, right: { label: wants, value: 20 }, label: w(locale, 'Splitting it', 'Repartirlo', 'Dividir'), currency: cur },
    flow: { kind: 'flow', income: { label: w(locale, 'Earned', 'Ganado', 'Ganho'), value: 80 }, spent: { label: w(locale, 'Spent', 'Gastado', 'Gasto'), value: 30 }, keptLabel: w(locale, 'Kept', 'Guardado', 'Guardado'), kept: 50, label: w(locale, 'In and out', 'Entra y sale', 'Entra e sai'), currency: cur },
    goal_bar: { kind: 'goal_bar', goal: { label: bike, value: 120 }, saved: { label: w(locale, 'Saved', 'Ahorrado', 'Poupado'), value: 45 }, remaining: 75, savedFraction: 0.375, label: w(locale, 'My goal', 'Mi meta', 'Minha meta'), currency: cur },
    worked: { kind: 'worked', start: 20, steps: [{ op: 'subtract', value: 8 }, { op: 'add', value: 5 }], values: [12, 17], checkValue: 17, label: w(locale, 'Step by step', 'Paso a paso', 'Passo a passo'), currency: cur },
    ten_frame: { kind: 'ten_frame', count: 13, frames: [10, 3], label: w(locale, 'Thirteen', 'Trece', 'Treze') },
    open_number_line: { kind: 'open_number_line', from: 27, to: 50, jumps: [{ value: 3 }, { value: 20 }], stops: [30, 50], positions: [0.13, 1], label: w(locale, 'Counting up', 'Contar hacia arriba', 'Contar para cima'), currency: null },
    array: { kind: 'array', rows: 3, columns: 4, unitValue: 2, total: 24, cells: 12, label: w(locale, 'Rows of stickers', 'Filas de stickers', 'Fileiras de adesivos'), currency: cur },
    fraction_strip: { kind: 'fraction_strip', rows: [{ denominator: 2, highlighted: 1 }, { denominator: 4, highlighted: 2 }], shares: [0.5, 0.5], label: w(locale, 'Same amount', 'La misma cantidad', 'A mesma quantidade') },
    partition: { kind: 'partition', whole: 40, splits: [{ label: w(locale, 'Halves', 'Mitades', 'Metades'), denominator: 2 }, { label: w(locale, 'Quarters', 'Cuartos', 'Quartos'), denominator: 4 }], pieceValues: [20, 10], label: w(locale, 'Sharing 40', 'Repartir 40', 'Dividir 40'), currency: cur },
    table: { kind: 'table', options: [{ label: w(locale, 'Small pack', 'Paquete chico', 'Pacote pequeno'), price: 6, units: 3 }, { label: w(locale, 'Big pack', 'Paquete grande', 'Pacote grande'), price: 10, units: 10 }], unitPrices: [2, 1], bestIndex: 1, label: w(locale, 'Best deal', 'La mejor compra', 'A melhor compra'), currency: cur },
    scale: { kind: 'scale', left: { label: book, value: 15 }, right: { label: game, value: 25 }, tilt: 'right', difference: 10, label: w(locale, 'Which is heavier?', '¿Cuál pesa más?', 'Qual pesa mais?'), currency: cur },
    two_bins: { kind: 'two_bins', binLabels: [needs, wants], items: [{ label: water, bin: 0 }, { label: game, bin: 1 }, { label: book, bin: 0 }], counts: [2, 1], label: w(locale, 'Sort them', 'Ordénalos', 'Separe') },
    venn: { kind: 'venn', leftLabel: needs, rightLabel: wants, items: [{ label: water, side: 'left' }, { label: book, side: 'both' }, { label: game, side: 'right' }], left: 1, right: 1, both: 1, label: w(locale, 'Both or one?', '¿Ambos o uno?', 'Ambos ou um?') },
    ranking: { kind: 'ranking', items: [{ label: snack, value: 3 }, { label: toy, value: 12 }, { label: book, value: 8 }], direction: 'desc', order: [1, 2, 0], label: w(locale, 'Most to least', 'De más a menos', 'Do maior ao menor'), currency: cur },
    outcomes: { kind: 'outcomes', good: { label: w(locale, 'Save it', 'Ahorrarlo', 'Poupar'), detail: w(locale, 'Bike in May', 'Bici en mayo', 'Bicicleta em maio') }, bad: { label: w(locale, 'Spend it', 'Gastarlo', 'Gastar'), detail: w(locale, 'No bike', 'Sin bici', 'Sem bicicleta') }, label: w(locale, 'Two choices', 'Dos opciones', 'Duas escolhas') },
    trade: { kind: 'trade', left: { who: 'Ana', gives: book, gets: game }, right: { who: 'Leo', gives: game, gets: book }, label: w(locale, 'A fair swap?', '¿Un cambio justo?', 'Uma troca justa?') },
    chance: { kind: 'chance', outcomes: [{ label: w(locale, 'Red', 'Rojo', 'Vermelho'), weight: 3 }, { label: w(locale, 'Blue', 'Azul', 'Azul'), weight: 1 }], shares: [0.75, 0.25], label: w(locale, 'Picking a marble', 'Sacar una canica', 'Tirar uma bolinha') },
    deal: { kind: 'deal', total: 14, bins: ['Ana', 'Leo', 'Sol'], perBin: 4, remainder: 2, label: w(locale, 'Sharing 14', 'Repartir 14', 'Dividir 14') },
    change: { kind: 'change', price: 35, paid: 50, change: 15, label: w(locale, 'Your change', 'Tu cambio', 'Seu troco'), currency: cur },
    regroup: { kind: 'regroup', fromDenomination: 10, fromCount: 1, intoDenomination: 1, intoCount: 10, label: w(locale, 'Break a ten', 'Cambiar un diez', 'Trocar um dez'), currency: cur },
    equation_bar: { kind: 'equation_bar', left: [{ label: snack, value: 5 }, { label: toy, value: 15 }], right: [{ label: w(locale, 'Paid', 'Pagado', 'Pago'), value: 20 }], total: 20, label: w(locale, 'Both sides match', 'Los dos lados', 'Os dois lados'), currency: cur },
    receipt: { kind: 'receipt', lines: [{ label: snack, value: 4 }, { label: water, value: 2 }], total: 6, label: w(locale, 'The receipt', 'El ticket', 'O recibo'), currency: cur },
    ledger: { kind: 'ledger', entries: [{ label: w(locale, 'Allowance', 'Domingo', 'Mesada'), amount: 20, direction: 'in' }, { label: snack, amount: 5, direction: 'out' }], balances: [20, 15], final: 15, label: w(locale, 'My notebook', 'Mi cuaderno', 'Meu caderno'), currency: cur },
    price_tag: { kind: 'price_tag', item: toy, price: 40, units: 1, discountPercent: 25, unitPrice: 40, finalPrice: 30, label: w(locale, 'On sale', 'En oferta', 'Em promoção'), currency: cur },
    inventory: { kind: 'inventory', item: w(locale, 'Lemonade', 'Limonada', 'Limonada'), start: 20, sold: 12, left: 8, label: w(locale, 'My stand', 'Mi puesto', 'Minha barraca') },
    budget_plate: { kind: 'budget_plate', budget: 50, items: [{ label: snack, value: 10 }, { label: book, value: 25 }], spent: 35, remaining: 15, overBy: 0, label: w(locale, 'My budget', 'Mi presupuesto', 'Meu orçamento'), currency: cur },
    pictograph: { kind: 'pictograph', rows: [{ label: 'Ana', count: 3 }, { label: 'Leo', count: 5 }], unitValue: 2, totals: [6, 10], label: w(locale, 'Coins saved', 'Monedas ahorradas', 'Moedas poupadas'), currency: null },
    bead_string: { kind: 'bead_string', count: 17, rows: [10, 7], label: w(locale, 'Seventeen', 'Diecisiete', 'Dezessete') },
    tally: { kind: 'tally', groups: [{ label: w(locale, 'Sunny', 'Soleado', 'Sol'), count: 7 }, { label: w(locale, 'Rainy', 'Lluvioso', 'Chuva'), count: 3 }], fives: [[1, 2], [0, 3]], label: w(locale, 'Our days', 'Nuestros días', 'Nossos dias') },
    fraction_circle: { kind: 'fraction_circle', denominator: 4, highlighted: 3, share: 0.75, label: w(locale, 'Pizza left', 'Pizza que queda', 'Pizza que sobrou') },
    stack: { kind: 'stack', columns: [{ label: 'Ana', parts: [{ label: needs, value: 10 }, { label: wants, value: 5 }] }, { label: 'Leo', parts: [{ label: needs, value: 8 }, { label: wants, value: 12 }] }], totals: [15, 20], max: 20, label: w(locale, 'How they spent', 'Cómo gastaron', 'Como gastaram'), currency: cur },
    sequence_compare: { kind: 'sequence_compare', unit: 'week', tracks: [{ label: 'Ana', start: 0, steps: [{ op: 'add', value: 5 }, { op: 'add', value: 5 }] }, { label: 'Leo', start: 10, steps: [{ op: 'add', value: 2 }, { op: 'add', value: 2 }] }], values: [[5, 10], [12, 14]], label: w(locale, 'Who saves faster?', '¿Quién ahorra más rápido?', 'Quem poupa mais rápido?'), currency: cur },
    timeline: { kind: 'timeline', unit: 'month', span: 6, events: [{ label: w(locale, 'Start saving', 'Empezar a ahorrar', 'Começar a poupar'), at: 1 }, { label: w(locale, 'Buy the bike', 'Comprar la bici', 'Comprar a bicicleta'), at: 6 }], positions: [0, 1], label: w(locale, 'My plan', 'Mi plan', 'Meu plano') },
    cycle: { kind: 'cycle', steps: [w(locale, 'Earn', 'Ganar', 'Ganhar'), w(locale, 'Save', 'Ahorrar', 'Poupar'), w(locale, 'Spend', 'Gastar', 'Gastar')], label: w(locale, 'Round and round', 'Una y otra vez', 'De novo e de novo') },
    before_after: { kind: 'before_after', what: w(locale, 'Price', 'Precio', 'Preço'), before: 20, after: 24, delta: 4, direction: 'up', label: w(locale, 'Prices went up', 'Los precios subieron', 'Os preços subiram'), currency: cur },
    grab: { kind: 'grab', binLabels: [needs, wants], items: [water, game], label: w(locale, 'Your turn to sort', 'Te toca ordenar', 'Sua vez de separar') },
    fill: { kind: 'fill', container: 'jar', capacity: 10, label: w(locale, 'Fill the jar', 'Llena el frasco', 'Encha o pote') },
    whatif: { kind: 'whatif', start: 10, unit: 'week', branches: [{ label: w(locale, 'Save 5', 'Ahorrar 5', 'Poupar 5'), steps: [{ op: 'add', value: 5 }] }, { label: w(locale, 'Save 2', 'Ahorrar 2', 'Poupar 2'), steps: [{ op: 'add', value: 2 }] }], values: [[15, 20], [12, 14]], label: w(locale, 'What if?', '¿Y si…?', 'E se…?'), currency: cur },
    your_turn: { kind: 'your_turn', start: 10, steps: [{ op: 'add', value: 5 }], givenCount: 2, unit: 'week', values: [15, 20, 25, 30], label: w(locale, 'Keep it going', 'Sigue tú', 'Continue você'), currency: cur },
  };
}
