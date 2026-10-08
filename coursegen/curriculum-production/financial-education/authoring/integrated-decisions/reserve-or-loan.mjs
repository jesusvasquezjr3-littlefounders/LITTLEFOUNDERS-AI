import { capstone, Q, numeric, input, add } from './factory.mjs';
export const reserveOrLoan = resolve => capstone(2, resolve,
  ['Reserve or loan?', '¿Reserva o préstamo?', 'Reserva ou empréstimo?'],
  ['A cheap-looking loan can conflict with the next bill.', 'Un préstamo aparentemente barato puede chocar con el próximo pago.', 'Um empréstimo aparentemente barato pode conflitar com a próxima conta.'],
  'Comparing only the amount received while ignoring access dates, total repayment and future essential payments.',
  skills => ({ evidence: [0, 1, 2, 0, 1, 0], segments: [
    Q('practice-01', 'practice', skills[0], 0, [
      ['Which reserve is usable today?', 'An urgent repair is due today. Both reserves cover it: A allows immediate withdrawal; B unlocks next month.', ['Reserve A', 'Reserve B'], 'A meets the stated deadline; B does not.', 'Having enough money and accessing it on time are different.'],
      ['¿Qué reserva sirve hoy?', 'La reparación urgente se paga hoy. Ambas reservas alcanzan: A permite retirar ahora; B se libera el próximo mes.', ['Reserva A', 'Reserva B'], 'A cumple el plazo indicado; B no.', 'Tener suficiente dinero y acceder a tiempo son cosas distintas.'],
      ['Qual reserva serve hoje?', 'O conserto urgente vence hoje. Ambas bastam: A permite saque imediato; B libera no próximo mês.', ['Reserva A', 'Reserva B'], 'A atende ao prazo informado; B não.', 'Ter dinheiro suficiente e acessar no prazo são coisas diferentes.'],
    ]),
    numeric(Q('practice-02', 'practice', skills[1], 2, [
      ['Total repayment?', 'A loan requires 3 payments of 40 and a separate final fee of 10.', ['120', '40', '130'], '3 × 40 + 10 = 130, including the separate fee.', 'Count every scheduled payment and the additional fee.'],
      ['¿Devolución total?', 'Un préstamo exige 3 pagos de 40 y una comisión final adicional de 10.', ['120', '40', '130'], '3 × 40 + 10 = 130, incluida la comisión adicional.', 'Cuenta cada pago programado y la comisión adicional.'],
      ['Total devolvido?', 'Um empréstimo exige 3 pagamentos de 40 e uma tarifa final adicional de 10.', ['120', '40', '130'], '3 × 40 + 10 = 130, incluindo a tarifa adicional.', 'Conte cada pagamento previsto e a tarifa adicional.'],
    ]), [3, 40, 10], add({ op: 'multiply', args: [input(0), input(1)] }, input(2))),
    Q('practice-03', 'practice', skills[2], 1, [
      ['Does the payment fit?', 'Next month: confirmed income 200; essentials 180; proposed loan payment 40. No other funds.', ['Yes, income exceeds payment', 'No, essentials leave only 20'], 'The payment exceeds what remains after essential spending.', 'Compare the payment with the remainder, not with total income.'],
      ['¿Cabe el pago?', 'Próximo mes: ingreso confirmado 200; necesidades 180; pago propuesto 40. No hay otros fondos.', ['Sí, el ingreso supera el pago', 'No, las necesidades dejan 20'], 'El pago supera lo que queda después del gasto esencial.', 'Compara el pago con el resto, no con el ingreso total.'],
      ['O pagamento cabe?', 'Próximo mês: renda confirmada 200; necessidades 180; parcela proposta 40. Sem outros recursos.', ['Sim, renda supera parcela', 'Não, necessidades deixam 20'], 'A parcela supera o que resta após os gastos essenciais.', 'Compare a parcela com a sobra, não com a renda total.'],
    ]),
    Q('practice-04', 'practice', skills[0], 1, [
      ['Which fact is missing?', 'Both reserves cover today’s repair with equal safety and same-day access; withdrawal fees are unknown.', ['Their opening balances', 'Their withdrawal fees', 'Only next year’s return'], 'Withdrawal fees can change the money available for the repair.', 'Compare a condition affecting usable money, not an unrelated detail.'],
      ['¿Qué dato falta?', 'Ambas reservas permiten retirar hoy y cubren la reparación. Igual seguridad; no indican comisiones de retiro.', ['Sus saldos de apertura', 'Las comisiones de retiro', 'Solo rendimiento del próximo año'], 'Las comisiones pueden cambiar el dinero disponible para reparar.', 'Compara una condición del dinero utilizable, no un detalle ajeno.'],
      ['Qual dado falta?', 'Ambas reservas permitem sacar hoje e cobrem o conserto. Mesma segurança; tarifas de saque não informadas.', ['Seus saldos de abertura', 'As tarifas de saque', 'Só retorno do próximo ano'], 'As tarifas podem mudar o dinheiro disponível para o conserto.', 'Compare uma condição do dinheiro utilizável, não um detalhe alheio.'],
    ]),
    numeric(Q('practice-05', 'practice', skills[1], 0, [
      ['Total scheduled repayment?', 'Another offer lists 2 payments of 55. Its fee is already included in each payment.', ['110', '55', '220'], '2 × 55 = 110; the included fee is not added again.', 'Do not count a charge twice when payments already include it.'],
      ['¿Total de pagos previstos?', 'Otra oferta indica 2 pagos de 55. La comisión ya está incluida en cada pago.', ['110', '55', '220'], '2 × 55 = 110; la comisión incluida no se suma otra vez.', 'No cuentes dos veces una comisión ya incluida en los pagos.'],
      ['Total dos pagamentos previstos?', 'Outra oferta indica 2 pagamentos de 55. A tarifa já está incluída em cada pagamento.', ['110', '55', '220'], '2 × 55 = 110; a tarifa incluída não entra novamente.', 'Não conte duas vezes uma tarifa já incluída nos pagamentos.'],
    ]), [2, 55], { op: 'multiply', args: [input(0), input(1)] }),
    Q('transfer-01', 'transfer', skills[0], 0, [
      ['Which meets both constraints?', 'Pay today; keep next month’s essentials funded; accessible savings suffice. Loan payments exceed next month’s spare funds.', ['Use accessible savings', 'Take the unaffordable loan'], 'Accessible savings meet both stated constraints without an unfunded repayment.', 'Check today’s access and next month’s payment capacity together.'],
      ['¿Qué cumple ambas condiciones?', 'Paga hoy y protege necesidades del próximo mes; el ahorro accesible alcanza. El préstamo supera el sobrante mensual.', ['Usar el ahorro accesible', 'Tomar el préstamo impagable'], 'El ahorro accesible cumple ambas condiciones sin crear pagos sin fondos.', 'Revisa juntos el acceso actual y la capacidad de pago posterior.'],
      ['Qual atende às duas condições?', 'Pague hoje e preserve necessidades do próximo mês; a reserva acessível basta. As parcelas superam a sobra mensal.', ['Usar a reserva acessível', 'Tomar o crédito impagável'], 'A reserva acessível atende às condições sem criar parcelas sem recursos.', 'Confira juntos o acesso atual e a capacidade de pagamento futura.'],
    ]),
  ] }));
