import { capstone, Q, numeric, input, subtract } from './factory.mjs';

export const interruptedIncome = resolve => capstone(1, resolve,
  ['Income interruption', 'Ingreso interrumpido', 'Renda interrompida'],
  ['An interrupted payment changes what a household can safely commit.', 'Un pago interrumpido cambia lo que un hogar puede comprometer.', 'Um pagamento interrompido muda o que uma família pode comprometer.'],
  'Keeping the old spending plan after income stops, or treating a possible receipt as guaranteed.',
  skills => ({ evidence: [2, 0, 1, 2, 1, 0], segments: [
    numeric(Q('practice-01', 'practice', skills[2], 1, [
      ['Which planning baseline?', 'Recent monthly receipts: 600, 400, 500. Next month is unconfirmed; use the lowest observed amount.', ['600', '400', '500'], '400 is the lowest observed receipt, not a guaranteed future payment.', 'The stated rule uses the lowest receipt, not the best month.'],
      ['¿Qué base usar?', 'Entradas mensuales recientes: 600, 400, 500. El próximo mes no está confirmado; usa el menor monto observado.', ['600', '400', '500'], '400 es la menor entrada observada, no un pago futuro garantizado.', 'La regla indicada usa la menor entrada, no el mejor mes.'],
      ['Qual base usar?', 'Recebimentos mensais recentes: 600, 400, 500. Próximo mês não confirmado; use o menor valor observado.', ['600', '400', '500'], '400 é o menor recebimento observado, não um pagamento futuro garantido.', 'A regra informada usa o menor recebimento, não o melhor mês.'],
    ]), [600, 400, 500], { op: 'min', args: [{ op: 'min', args: [input(0), input(1)] }, input(2)] }),
    numeric(Q('practice-02', 'practice', skills[0], 0, [
      ['What remains unallocated?', 'Confirmed money: 400; essential bills: 300. An unavoidable repair adds 70.', ['30', '100', '170'], '400 − 300 − 70 = 30 remains for other allocations.', 'Subtract the repair as well as the original bills.'],
      ['¿Cuánto queda sin asignar?', 'Dinero confirmado: 400; cuentas esenciales: 300. Una reparación inevitable agrega 70.', ['30', '100', '170'], '400 − 300 − 70 = 30 para otras asignaciones.', 'Resta la reparación además de las cuentas originales.'],
      ['Quanto fica sem destino?', 'Dinheiro confirmado: 400; contas essenciais: 300. Um conserto inevitável acrescenta 70.', ['30', '100', '170'], '400 − 300 − 70 = 30 para outras destinações.', 'Subtraia o conserto além das contas originais.'],
    ]), [400, 300, 70], subtract(subtract(input(0), input(1)), input(2))),
    Q('practice-03', 'practice', skills[1], 0, [
      ['Which response is feasible?', 'Only 30 remains; a 50 outing is optional. No affordable credit or confirmed receipt is available.', ['Postpone the outing', 'Assume another receipt', 'Borrow without checking'], 'Postponing the optional outing avoids an unfunded commitment.', 'A possible receipt or unchecked loan does not close this gap.'],
      ['¿Qué respuesta es viable?', 'Solo quedan 30; una salida de 50 es opcional. No hay crédito asequible ni entrada confirmada.', ['Posponer la salida', 'Suponer otra entrada', 'Pedir prestado sin revisar'], 'Posponer la salida opcional evita un compromiso sin fondos.', 'Una entrada posible o préstamo sin revisar no cubre este faltante.'],
      ['Qual resposta é viável?', 'Restam apenas 30; um passeio de 50 é opcional. Não há crédito acessível nem recebimento confirmado.', ['Adiar o passeio', 'Supor outro recebimento', 'Pegar crédito sem conferir'], 'Adiar o passeio opcional evita um compromisso sem recursos.', 'Um recebimento possível ou crédito não conferido não cobre esta falta.'],
    ]),
    Q('practice-04', 'practice', skills[2], 2, [
      ['What changes the forecast?', 'The payer confirms next month’s work is canceled. Earlier months had receipts.', ['Keep the historical minimum', 'Use the historical average', 'Remove the canceled receipt'], 'Confirmed cancellation overrides the estimate based on earlier months.', 'Past receipts cannot fund a payment that is now canceled.'],
      ['¿Qué cambia la previsión?', 'Quien paga confirma que canceló el trabajo del próximo mes. Hubo entradas en meses anteriores.', ['Mantener el mínimo histórico', 'Usar el promedio histórico', 'Quitar la entrada cancelada'], 'La cancelación confirmada reemplaza la estimación basada en meses anteriores.', 'Las entradas pasadas no financian un pago ahora cancelado.'],
      ['O que muda a previsão?', 'Quem paga confirma o cancelamento do trabalho do próximo mês. Houve recebimentos em meses anteriores.', ['Manter o mínimo histórico', 'Usar a média histórica', 'Retirar o recebimento cancelado'], 'O cancelamento confirmado substitui a estimativa baseada nos meses anteriores.', 'Recebimentos passados não financiam um pagamento agora cancelado.'],
    ]),
    Q('practice-05', 'practice', skills[1], 1, [
      ['What addresses the gap?', 'Confirmed funds cannot cover essential bills. Optional spending is already zero.', ['Call the budget balanced', 'Seek support and negotiate dates', 'Invent a new receipt'], 'Support and negotiation address a real gap without inventing income.', 'Removing optional spending cannot solve every income shortfall.'],
      ['¿Qué atiende el faltante?', 'Los fondos confirmados no cubren cuentas esenciales. El gasto opcional ya es cero.', ['Dar el presupuesto por cerrado', 'Buscar apoyo y negociar fechas', 'Inventar otra entrada'], 'Apoyo y negociación atienden un faltante real sin inventar ingresos.', 'Eliminar gastos opcionales no resuelve todo faltante de ingresos.'],
      ['O que enfrenta a falta?', 'Recursos confirmados não cobrem contas essenciais. Os gastos opcionais já estão zerados.', ['Considerar o orçamento fechado', 'Buscar apoio e negociar datas', 'Inventar outro recebimento'], 'Apoio e negociação enfrentam uma falta real sem inventar renda.', 'Eliminar gastos opcionais não resolve toda falta de renda.'],
    ]),
    Q('transfer-01', 'transfer', skills[0], 1, [
      ['Which revised plan fits?', 'Funds: 240; food: 100; rent: 100; new medicine: 40. A planned outing was 30.', ['Keep all four allocations', 'Remove the outing allocation', 'Count the medicine twice'], 'Removing the outing leaves exactly 240 allocated to the stated essentials.', 'The new medicine must replace an allocation, not disappear from totals.'],
      ['¿Qué plan ajustado cabe?', 'Fondos: 240; comida: 100; renta: 100; medicina nueva: 40. La salida planeada costaba 30.', ['Conservar las cuatro asignaciones', 'Quitar la asignación de salida', 'Contar dos veces la medicina'], 'Quitar la salida deja exactamente 240 para las necesidades indicadas.', 'La medicina nueva debe reemplazar una asignación, no desaparecer del total.'],
      ['Qual plano revisto cabe?', 'Recursos: 240; comida: 100; aluguel: 100; remédio novo: 40. Um passeio previsto custava 30.', ['Manter as quatro destinações', 'Retirar a destinação do passeio', 'Contar o remédio duas vezes'], 'Retirar o passeio deixa exatamente 240 para as necessidades informadas.', 'O novo remédio deve substituir uma destinação, não desaparecer do total.'],
    ]),
  ] }));
