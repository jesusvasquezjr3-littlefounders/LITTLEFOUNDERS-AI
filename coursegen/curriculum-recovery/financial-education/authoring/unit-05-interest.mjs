import { makeLesson, examples as E, choice as Q, modelExample } from './assemble.mjs';
const unit = 'fe-solid-05-understand-borrowing';
const k = 'life.banks-and-accounts';
export const plans = [makeLesson({ number: 22, slug: 'interest-changes-the-debt', unit, title: ['Interest changes the debt', 'El interés cambia la deuda', 'Os juros mudam a dívida'], skill: 'debt.interest', kc: k, prerequisites: ['debt.total-cost', 'price.percent', 'cash.balance'],
  outcome: 'Calculate a stated period interest charge from the amount owed, then update the debt after that charge and a payment.',
  misconception: 'Subtracting a payment from the old debt while ignoring interest, or applying a rate without its stated period and balance.',
  numeracy: 'Use the previously taught percent-of-a-whole calculation and addition/subtraction; the optional schedule illustrates cents without requiring an annuity formula.',
  relevance: ['Interest is a charge for borrowing. These fictional dollar examples state the period and rules; real agreements can work differently.', 'El interés es un cargo por pedir prestado. Estos ejemplos ficticios en pesos indican sus reglas; un contrato real puede ser distinto.', 'Juros são uma cobrança pelo empréstimo. Estes exemplos fictícios em reais indicam as regras; um contrato real pode ser diferente.'],
  segments: [
    E('example-01', ['A charge on what is owed', 'Un cargo sobre lo que debes', 'Uma cobrança sobre o que deve'], ['This toy period charges 10% interest on debt of 100: 10. With no other changes, debt becomes 110.', 'En este periodo ficticio, una deuda de 100 genera 10% de interés: 10. Sin otros cambios, se deben 110.', 'Neste período fictício, uma dívida de 100 gera 10% de juros: 10. Sem outras mudanças, deve-se 110.']),
    E('example-02', ['Then apply the payment', 'Luego aplica el pago', 'Depois aplique o pagamento'], ['If 30 is paid after that charge, 110 − 30 = 80 remains owed. Ignoring interest would understate the debt.', 'Si se pagan 30 después del cargo, quedan 110 − 30 = 80 de deuda. Ignorar el interés reduciría falsamente el saldo.', 'Se forem pagos 30 após a cobrança, restam 110 − 30 = 80 de dívida. Ignorar os juros reduziria falsamente o saldo.']),
    Q('guided-01', 'guided', k, 2, [
      ['What is owed after this period charge?', 'A debt of 100 is charged 10% for this fictional period. No payments, fees or new borrowing occur.', ['100', '10', '110'], 'The interest charge is added to the amount already owed.', 'Find the stated percentage, then add the charge to the debt.'],
      ['¿Cuánto se debe tras el cargo del periodo?', 'Una deuda de 100 genera 10% en este periodo ficticio. No hay pagos, comisiones ni nuevos préstamos.', ['100', '10', '110'], 'El cargo de interés se suma al monto que ya se debía.', 'Halla el porcentaje indicado y suma el cargo a la deuda.'],
      ['Quanto se deve após a cobrança do período?', 'Uma dívida de 100 gera 10% neste período fictício. Não há pagamentos, taxas ou novos empréstimos.', ['100', '10', '110'], 'A cobrança de juros é somada ao valor que já era devido.', 'Ache o percentual informado e some a cobrança à dívida.'],
    ]),
    E('example-cents', ['Read the payment split', 'Lee las partes del pago', 'Leia as partes do pagamento'], ['Part of each payment covers interest; the rest reduces debt. Decimals show cents: 1.00 is one dollar.', 'En el modelo siguiente, parte del pago cubre interés; el resto reduce deuda. Los decimales muestran centavos: 1.00 es un peso.', 'No próximo modelo, parte do pagamento cobre juros; o resto reduz dívida. Decimais mostram centavos: 1,00 é um real.']),
    modelExample('example-schedule', 'money.amortization.v2', 'amortization', { currency: 'local', principal_minor: 10000, rate_bps: 1200, months: 12 }, [
      ['Model: 100 dollars, 12% yearly, 12 monthly payments, no fees. Move through months; compare interest and debt reduction.'].join(''),
      'Modelo: 100 pesos, tasa anual de 12%, 12 pagos mensuales, sin comisiones. Avanza por los meses y compara interés y reducción en la tabla.',
      'Modelo: 100 reais, taxa anual de 12%, 12 pagamentos mensais, sem taxas. Avance pelos meses e compare juros e redução na tabela.',
    ]),
    Q('guided-02', 'guided', k, 0, [
      ['How much remains owed?', 'This period started with debt of 100, added interest of 10, then received a payment of 30. No other changes occurred.', ['80', '70', '110'], 'The update includes both the interest charge and the payment.', 'Apply the changes in the stated order.'],
      ['¿Cuánto queda por pagar?', 'El periodo empezó con deuda de 100, añadió 10 de interés y después recibió un pago de 30. No hubo otros cambios.', ['80', '70', '110'], 'La actualización incluye el cargo de interés y el pago.', 'Aplica los cambios en el orden indicado.'],
      ['Quanto resta a pagar?', 'O período começou com dívida de 100, somou 10 de juros e depois recebeu um pagamento de 30. Não houve outras mudanças.', ['80', '70', '110'], 'A atualização inclui a cobrança de juros e o pagamento.', 'Aplique as mudanças na ordem informada.'],
    ]),
    Q('practice-01', 'practice', k, 1, [
      ['What is this period interest charge?', 'A fictional contract charges 10% on a starting debt of 80 for the stated period.', ['10', '8', '80'], 'The charge uses the debt amount that the stated rule applies to.', 'A fixed percentage does not mean a fixed currency amount.'],
      ['¿Cuál es el interés de este periodo?', 'Un contrato ficticio cobra 10% sobre una deuda inicial de 80 para el periodo indicado.', ['10', '8', '80'], 'El cargo usa el monto de deuda al que se aplica la regla.', 'Un porcentaje fijo no significa un monto fijo en dinero.'],
      ['Qual é o juro deste período?', 'Um contrato fictício cobra 10% sobre uma dívida inicial de 80 no período informado.', ['10', '8', '80'], 'A cobrança usa o valor da dívida ao qual a regra se aplica.', 'Um percentual fixo não significa um valor fixo em dinheiro.'],
    ]),
    Q('practice-02', 'practice', k, 2, [
      ['Can these rates be compared directly?', 'Offers quote 10% monthly and 10% yearly.', ['Yes, both show 10%', 'Yes, periods do not affect interest', 'No, they refer to different periods'], 'The time period is part of the rate meaning.', 'Compare rates on the same time basis and with their conditions.'],
      ['¿Puedes comparar directamente estas tasas?', 'Una oferta dice 10% mensual. Otra dice 10% anual.', ['Sí, ambas muestran 10%', 'Sí, el periodo no afecta el interés', 'No, se refieren a periodos distintos'], 'El periodo forma parte del significado de la tasa.', 'Compara tasas con la misma base de tiempo y sus condiciones.'],
      ['Pode comparar diretamente estas taxas?', 'Uma oferta diz 10% ao mês. Outra diz 10% ao ano.', ['Sim, ambas mostram 10%', 'Sim, o período não afeta os juros', 'Não, referem-se a períodos diferentes'], 'O período faz parte do significado da taxa.', 'Compare taxas na mesma base de tempo e com suas condições.'],
    ]),
    Q('practice-03', 'practice', k, 0, [
      ['What must the debt update include?', 'Interest and a payment occur this period.', ['Both the charge and the payment', 'Only the payment', 'Only the old starting debt'], 'Both completed changes affect what remains owed.', 'A payment does not erase a separately stated interest charge.'],
      ['¿Qué debe incluir la actualización de deuda?', 'El estado muestra un cargo de interés y un pago durante el mismo periodo.', ['El cargo y el pago', 'Solo el pago', 'Solo la deuda inicial anterior'], 'Ambos cambios realizados afectan lo que queda por pagar.', 'Un pago no elimina un cargo de interés indicado por separado.'],
      ['O que a atualização da dívida deve incluir?', 'O extrato mostra uma cobrança de juros e um pagamento no mesmo período.', ['A cobrança e o pagamento', 'Só o pagamento', 'Só a dívida inicial anterior'], 'As duas mudanças realizadas afetam o que resta a pagar.', 'Um pagamento não elimina uma cobrança de juros informada separadamente.'],
    ]),
    Q('transfer-01', 'transfer', k, 1, [
      ['What remains owed in this new example?', 'Debt is 200; this period adds 5% interest, then a payment of 60. There are no other changes.', ['140', '150', '210'], 'You calculated the charge on the new debt and applied the payment.', 'Use the stated debt, rate, period and order of changes.'],
      ['¿Cuánto se debe en este nuevo ejemplo?', 'La deuda es 200; este periodo añade 5% de interés y después un pago de 60. No hay otros cambios.', ['140', '150', '210'], 'Calculaste el cargo sobre la nueva deuda y aplicaste el pago.', 'Usa la deuda, tasa, periodo y orden de cambios indicados.'],
      ['Quanto se deve neste novo exemplo?', 'A dívida é 200; este período soma 5% de juros e depois um pagamento de 60. Não há outras mudanças.', ['140', '150', '210'], 'Você calculou a cobrança sobre a nova dívida e aplicou o pagamento.', 'Use a dívida, taxa, período e ordem de mudanças informados.'],
    ]),
  ] })];
