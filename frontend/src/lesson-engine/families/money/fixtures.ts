// `money` family — one demo segment per type for /dev/lesson-lab.
// Written per locale; see `../../lab/fixtureCopy.ts`. Structure and answer keys
// are written once and are identical in every locale by construction.
//
// The CURRENCY moves with the copy (`FIXTURE_CURRENCY`), because these
// renderers format with `Intl` from the payload's `currency` — a Brazilian
// fixture whose prose says "R$5" while its till prints "$5.00" is exactly the
// half-translated state this file exists to make impossible. The denomination
// LADDER is deliberately the same everywhere (1/2/5/10/20/50): all three
// currencies have coins at the low end and notes from 20 up, and holding the
// numbers still keeps every grader assertion locale-independent.

import type { Locale } from '@/i18n'
import type { SegmentBase } from '../../core/types'
import { FIXTURE_CURRENCY, copyPack, type Copy } from '../../lab/fixtureCopy'

const EN = {
  coinPrompt: 'Dina wants to buy a notebook. Pay the **exact** amount by tapping coins and notes.',
  coinHint: 'Start with the biggest note that does not go over.',
  coinExplain: 'Several combinations add up to **$37**: for example $20 + $10 + $5 + $2.',

  changePrompt: 'Liruf paid for his sandwich with a note. Give him the exact **change** from the till.',
  changeHint: 'The change is what he paid **minus** the price.',
  changeExplain: '$100 − $68 = **$32** in change: for example $20 + $10 + $2.',

  piggyPrompt: 'You earned **$100** selling lemonade. Share all of it out between the jars.',
  piggyHint: 'Keep a good part for your goal, but do not forget to share.',
  piggyExplain:
    'There is no single perfect answer: what matters is **saving plenty** while still enjoying and sharing.',
  piggySave: 'Save',
  piggySaveHint: 'For your big goal',
  piggySpend: 'Spend',
  piggySpendHint: 'To enjoy today',
  piggyShare: 'Share',
  piggyShareHint: 'To help others',
  piggyRationale: 'A good rule: **save 3 or more out of every 10**, spend with a plan, share a little.',

  needsPrompt: 'Zara is writing her list. Mark each one: is it a **need** or a **want**?',
  needsExplain:
    '**Needs** are for living well: water, school supplies, shoes. **Wants** are for enjoying… with a plan.',
  needsWater: 'Drinking water',
  needsGame: 'New video game',
  needsShoes: 'Shoes for school',
  needsCandy: 'Giant bag of sweets',
  needsBooks: 'School supplies',
  needsToy: 'Dinosaur plushie',

  pricePrompt: 'Three stalls sell the same juice. Which offer is **really** the best?',
  priceHint: 'Divide the price by the quantity to see what **each one** costs.',
  priceExplain: 'The bundle price misleads: compare the price **per unit** before deciding.',
  priceSmall: 'Small pack',
  priceBig: 'Big pack',
  priceDuo: 'Duo pack',
  priceUnit: 'juices',

  budgetPrompt: 'You have **$100** for the week. Fill your basket without going over… and without forgetting what matters!',
  budgetHint: 'Put the **needs** in first, then see whether a want still fits.',
  budgetExplain: 'Necessities first, then the wants that **actually fit** the budget.',
  budgetLunch: "The week's lunches",
  budgetPencils: 'Pencils for school',
  budgetGame: 'New game',
  budgetStickers: 'Shiny stickers',
  budgetIce: 'Double ice cream',
  budgetToy: 'Collector car',

  goalPrompt: 'You want a **$120** skateboard. How many weeks does each savings plan take?',
  goalHint: 'Divide the goal by what you save each week and **round up**.',
  goalExplain: 'Saving more per week reaches the goal **faster**: $120 ÷ $40 = 3 weeks.',

  tradePrompt: "Liruf offers his stickers for Zara's marbles. Using the exchange table, is the deal **fair**?",
  tradeHint: 'Convert the stickers into marbles with the rate, then compare.',
  tradeExplain: '5 stickers × 2 = **10 marbles**. Zara offers 10 marbles: the deal is **fair**.',
  tradeA: "Liruf's stickers",
  tradeB: "Zara's marbles",
  tradeRate: 'Playground rate: **1 sticker is worth 2 marbles**.',

  interestPrompt: 'You put away **$100** and it grows **10%** a year. How much is there after 5 years? Predict it!',
  interestHint: 'Each year the interest is worked out on the **new** total, not just on the $100.',
  interestExplain:
    'That is **compound interest**: the interest earns interest too. $100 → $161.05 in 5 years.',
} as const

const ES: Copy<typeof EN> = {
  coinPrompt: 'Dina quiere comprar un cuaderno. Paga la cantidad **exacta** tocando monedas y billetes.',
  coinHint: 'Empieza con el billete más grande que no se pase.',
  coinExplain: 'Hay varias combinaciones que suman **$37**: por ejemplo $20 + $10 + $5 + $2.',

  changePrompt: 'Liruf pagó su torta con un billete. Dale su **cambio** exacto de la caja.',
  changeHint: 'El cambio es lo que pagó **menos** el precio.',
  changeExplain: '$100 − $68 = **$32** de cambio: por ejemplo $20 + $10 + $2.',

  piggyPrompt: 'Ganaste **$100** vendiendo limonada. Reparte todo tu dinero entre los frascos.',
  piggyHint: 'Guarda una buena parte para tu meta, pero no olvides compartir.',
  piggyExplain:
    'No hay una única respuesta perfecta: lo importante es **ahorrar bastante** sin dejar de disfrutar y compartir.',
  piggySave: 'Ahorrar',
  piggySaveHint: 'Para tu meta grande',
  piggySpend: 'Gastar',
  piggySpendHint: 'Para disfrutar hoy',
  piggyShare: 'Compartir',
  piggyShareHint: 'Para ayudar a otros',
  piggyRationale:
    'Una buena regla: **ahorra 3 o más de cada 10 pesos**, gasta con plan y comparte un poco.',

  needsPrompt: 'Zara está armando su lista. Marca cada cosa: ¿es **necesidad** o **gusto**?',
  needsExplain:
    'Las **necesidades** son para vivir bien: agua, útiles, zapatos. Los **gustos** se disfrutan… con plan.',
  needsWater: 'Agua para beber',
  needsGame: 'Videojuego nuevo',
  needsShoes: 'Zapatos para la escuela',
  needsCandy: 'Bolsa gigante de dulces',
  needsBooks: 'Útiles escolares',
  needsToy: 'Peluche de dinosaurio',

  pricePrompt: 'Tres puestos venden el mismo jugo. ¿Cuál oferta es **la mejor** de verdad?',
  priceHint: 'Divide el precio entre la cantidad para saber cuánto cuesta **cada uno**.',
  priceExplain: 'El precio del paquete engaña: compara el precio **por unidad** antes de decidir.',
  priceSmall: 'Paquete chico',
  priceBig: 'Paquete grande',
  priceDuo: 'Paquete dúo',
  priceUnit: 'jugos',

  budgetPrompt:
    'Tienes **$100** para la semana. Llena tu carrito sin pasarte… ¡y sin olvidar lo importante!',
  budgetHint: 'Primero mete las **necesidades**, luego ve si alcanza para un gusto.',
  budgetExplain: 'Primero lo necesario, después los gustos que **sí caben** en el presupuesto.',
  budgetLunch: 'Lonche de la semana',
  budgetPencils: 'Lápices para la escuela',
  budgetGame: 'Juego nuevo',
  budgetStickers: 'Stickers brillantes',
  budgetIce: 'Helado doble',
  budgetToy: 'Carrito de colección',

  goalPrompt: 'Quieres una patineta de **$120**. ¿Cuántas semanas tardas con cada plan de ahorro?',
  goalHint: 'Divide la meta entre lo que ahorras por semana y **redondea hacia arriba**.',
  goalExplain: 'Ahorrar más por semana llega **más rápido** a la meta: $120 ÷ $40 = 3 semanas.',

  tradePrompt:
    'Liruf ofrece sus stickers por las canicas de Zara. Con la tabla de cambio, ¿el trato es **justo**?',
  tradeHint: 'Convierte los stickers a canicas con la tasa y compara.',
  tradeExplain: '5 stickers × 2 = **10 canicas**. Zara ofrece 10 canicas: el trato es **justo**.',
  tradeA: 'Stickers de Liruf',
  tradeB: 'Canicas de Zara',
  tradeRate: 'Tasa del patio: **1 sticker vale 2 canicas**.',

  interestPrompt:
    'Guardas **$100** y cada año crece **10%**. ¿Cuánto habrá al final de 5 años? ¡Predícelo!',
  interestHint: 'Cada año el interés se calcula sobre el total **nuevo**, no solo sobre los $100.',
  interestExplain:
    'Eso es el **interés compuesto**: el interés también gana interés. $100 → $161.05 en 5 años.',
}

const PT: Copy<typeof EN> = {
  coinPrompt: 'Dina quer comprar um caderno. Pague o valor **exato** tocando em moedas e notas.',
  coinHint: 'Comece pela maior nota que não passe do valor.',
  coinExplain: 'Várias combinações somam **R$37**: por exemplo R$20 + R$10 + R$5 + R$2.',

  changePrompt: 'Liruf pagou o lanche com uma nota. Dê o **troco** exato do caixa.',
  changeHint: 'O troco é o que ele pagou **menos** o preço.',
  changeExplain: 'R$100 − R$68 = **R$32** de troco: por exemplo R$20 + R$10 + R$2.',

  piggyPrompt: 'Você ganhou **R$100** vendendo limonada. Divida todo o dinheiro entre os potes.',
  piggyHint: 'Guarde uma boa parte para a sua meta, mas não esqueça de compartilhar.',
  piggyExplain:
    'Não existe uma única resposta perfeita: o importante é **poupar bastante** sem deixar de aproveitar e compartilhar.',
  piggySave: 'Poupar',
  piggySaveHint: 'Para a sua meta grande',
  piggySpend: 'Gastar',
  piggySpendHint: 'Para aproveitar hoje',
  piggyShare: 'Compartilhar',
  piggyShareHint: 'Para ajudar os outros',
  piggyRationale:
    'Uma boa regra: **poupe 3 ou mais a cada 10 reais**, gaste com plano e compartilhe um pouco.',

  needsPrompt: 'Zara está montando a lista. Marque cada coisa: é **necessidade** ou **vontade**?',
  needsExplain:
    'As **necessidades** são para viver bem: água, material escolar, sapatos. As **vontades** a gente aproveita… com plano.',
  needsWater: 'Água para beber',
  needsGame: 'Videogame novo',
  needsShoes: 'Sapatos para a escola',
  needsCandy: 'Saco gigante de doces',
  needsBooks: 'Material escolar',
  needsToy: 'Pelúcia de dinossauro',

  pricePrompt: 'Três barracas vendem o mesmo suco. Qual oferta é **de verdade** a melhor?',
  priceHint: 'Divida o preço pela quantidade para saber quanto custa **cada um**.',
  priceExplain: 'O preço do pacote engana: compare o preço **por unidade** antes de decidir.',
  priceSmall: 'Pacote pequeno',
  priceBig: 'Pacote grande',
  priceDuo: 'Pacote duplo',
  priceUnit: 'sucos',

  budgetPrompt:
    'Você tem **R$100** para a semana. Encha o carrinho sem estourar… e sem esquecer o que importa!',
  budgetHint: 'Coloque primeiro as **necessidades**, depois veja se ainda cabe uma vontade.',
  budgetExplain: 'Primeiro o necessário, depois as vontades que **realmente cabem** no orçamento.',
  budgetLunch: 'Lanche da semana',
  budgetPencils: 'Lápis para a escola',
  budgetGame: 'Jogo novo',
  budgetStickers: 'Adesivos brilhantes',
  budgetIce: 'Sorvete duplo',
  budgetToy: 'Carrinho de coleção',

  goalPrompt: 'Você quer um skate de **R$120**. Quantas semanas demora com cada plano de poupança?',
  goalHint: 'Divida a meta pelo que você guarda por semana e **arredonde para cima**.',
  goalExplain: 'Guardar mais por semana chega **mais rápido** à meta: R$120 ÷ R$40 = 3 semanas.',

  tradePrompt:
    'Liruf oferece os adesivos dele pelas bolinhas da Zara. Com a tabela de troca, o negócio é **justo**?',
  tradeHint: 'Converta os adesivos em bolinhas com a taxa e compare.',
  tradeExplain: '5 adesivos × 2 = **10 bolinhas**. Zara oferece 10 bolinhas: o negócio é **justo**.',
  tradeA: 'Adesivos do Liruf',
  tradeB: 'Bolinhas da Zara',
  tradeRate: 'Taxa do pátio: **1 adesivo vale 2 bolinhas**.',

  interestPrompt:
    'Você guarda **R$100** e a cada ano cresce **10%**. Quanto haverá no fim de 5 anos? Preveja!',
  interestHint: 'Todo ano os juros são calculados sobre o total **novo**, não só sobre os R$100.',
  interestExplain:
    'Isso são os **juros compostos**: os juros também rendem juros. R$100 → R$161,05 em 5 anos.',
}

const COPY = copyPack(EN, ES, PT)

export function moneyFixtures(locale: Locale): SegmentBase[] {
  const c = COPY[locale]
  const currency = FIXTURE_CURRENCY[locale]
  return [
    {
      id: 'fx-coin-count',
      type: 'coin_count',
      prompt_md: c.coinPrompt,
      difficulty: 1,
      xp: 10,
      hints: [c.coinHint],
      explanation_md: c.coinExplain,
      narrator: { character: 'dina', emotion: 'happy' },
      payload: { currency, denominations: [1, 2, 5, 10, 20, 50], target: 37 },
      answer: {},
    },
    {
      id: 'fx-make-change',
      type: 'make_change',
      prompt_md: c.changePrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.changeHint],
      explanation_md: c.changeExplain,
      narrator: { character: 'liruf', emotion: 'thinking' },
      payload: { currency, denominations: [1, 2, 5, 10, 20, 50], price: 68, paid_with: 100 },
      answer: {},
    },
    {
      id: 'fx-piggy-split',
      type: 'piggy_split',
      prompt_md: c.piggyPrompt,
      difficulty: 2,
      xp: 15,
      hints: [c.piggyHint],
      explanation_md: c.piggyExplain,
      narrator: { character: 'rho', emotion: 'encouraging' },
      payload: {
        income: 100,
        unit: currency,
        jars: [
          { id: 'save', label: c.piggySave, icon: 'savings', hint_md: c.piggySaveHint },
          { id: 'spend', label: c.piggySpend, icon: 'shopping_cart', hint_md: c.piggySpendHint },
          { id: 'share', label: c.piggyShare, icon: 'redeem', hint_md: c.piggyShareHint },
        ],
        step: 10,
      },
      answer: {
        targets: {
          save: { min: 30, max: 60 },
          spend: { min: 20, max: 50 },
          share: { min: 10, max: 30 },
        },
        rationale_md: c.piggyRationale,
      },
    },
    {
      id: 'fx-needs-wants',
      type: 'needs_wants',
      prompt_md: c.needsPrompt,
      difficulty: 1,
      xp: 10,
      explanation_md: c.needsExplain,
      narrator: { character: 'zara', emotion: 'thinking' },
      payload: {
        items: [
          { id: 'water', text_md: c.needsWater, icon: 'water_drop' },
          { id: 'game', text_md: c.needsGame, icon: 'sports_esports' },
          { id: 'shoes', text_md: c.needsShoes, icon: 'checkroom' },
          { id: 'candy', text_md: c.needsCandy, icon: 'icecream' },
          { id: 'books', text_md: c.needsBooks, icon: 'school' },
          { id: 'toy', text_md: c.needsToy, icon: 'toys' },
        ],
      },
      answer: { needs_ids: ['water', 'shoes', 'books'] },
    },
    {
      id: 'fx-price-compare',
      type: 'price_compare',
      prompt_md: c.pricePrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.priceHint],
      explanation_md: c.priceExplain,
      narrator: { character: 'zara', emotion: 'happy' },
      payload: {
        offers: [
          { id: 'small', label: c.priceSmall, qty: 3, unit: c.priceUnit, price: 30 },
          { id: 'big', label: c.priceBig, qty: 6, unit: c.priceUnit, price: 51 },
          { id: 'duo', label: c.priceDuo, qty: 2, unit: c.priceUnit, price: 22 },
        ],
        currency,
      },
      answer: { best_offer_id: 'big' },
    },
    {
      id: 'fx-budget-fit',
      type: 'budget_fit',
      prompt_md: c.budgetPrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.budgetHint],
      explanation_md: c.budgetExplain,
      narrator: { character: 'rho', emotion: 'thinking' },
      payload: {
        budget: 100,
        currency,
        items: [
          { id: 'lunch', label: c.budgetLunch, icon: 'lunch_dining', price: 30, need: true },
          { id: 'pencils', label: c.budgetPencils, icon: 'school', price: 25, need: true },
          { id: 'game', label: c.budgetGame, icon: 'sports_esports', price: 40 },
          { id: 'stickers', label: c.budgetStickers, icon: 'sell', price: 15 },
          { id: 'ice', label: c.budgetIce, icon: 'icecream', price: 50 },
          { id: 'toy', label: c.budgetToy, icon: 'toys', price: 35 },
        ],
        must_buy_needs: true,
      },
      answer: {},
    },
    {
      id: 'fx-savings-goal',
      type: 'savings_goal',
      prompt_md: c.goalPrompt,
      difficulty: 3,
      xp: 20,
      hints: [c.goalHint],
      explanation_md: c.goalExplain,
      narrator: { character: 'dina', emotion: 'encouraging' },
      payload: { goal: 120, currency, weekly_options: [10, 20, 40] },
      answer: { correct: { '10': 12, '20': 6, '40': 3 } },
    },
    {
      id: 'fx-fair-trade',
      type: 'fair_trade',
      prompt_md: c.tradePrompt,
      difficulty: 4,
      xp: 20,
      hints: [c.tradeHint],
      explanation_md: c.tradeExplain,
      narrator: { character: 'liruf', emotion: 'excited' },
      payload: {
        offer_a: { label: c.tradeA, icon: 'sell', qty: 5 },
        offer_b: { label: c.tradeB, icon: 'toys', qty: 10 },
        rate_md: c.tradeRate,
      },
      answer: { verdict: 'fair' },
    },
    {
      id: 'fx-interest-peek',
      type: 'interest_peek',
      prompt_md: c.interestPrompt,
      difficulty: 4,
      xp: 25,
      hints: [c.interestHint],
      explanation_md: c.interestExplain,
      narrator: { character: 'rho', emotion: 'excited' },
      payload: {
        principal: 100,
        rate_pct: 10,
        periods: 5,
        currency,
        prediction: { kind: 'slider', min: 100, max: 220 },
      },
      answer: { value: 161.05, tolerance: 10 },
    },
  ]
}
