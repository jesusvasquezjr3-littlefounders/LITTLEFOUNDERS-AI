import { defineReview, Q, ledger, numeric, input, subtract } from './factory.mjs';
const S = 'finance.cash.reserved';
export const reviewPayments = defineReview(1,
  ['Follow the payments', 'Sigue los pagos', 'Acompanhe os pagamentos'],
  ['Track payments in dollars, received money and commitments to check what remains usable.', 'Revisa pagos en pesos, dinero recibido y compromisos para saber qué puedes usar.', 'Confira pagamentos em reais, dinheiro recebido e compromissos para saber o que pode usar.'],
  'Use completed payments, receipt status and protected commitments to calculate free-to-spend money in a new situation.', 4, [
    Q('practice-01', 'practice', S, 1, [
      ['What happens to the shop’s cash?', 'The shop gives Ana a cash refund.', ['It increases', 'It decreases', 'It stays unchanged'], 'The refund moves cash away from the shop.', 'Track the named person or business, not only the word refund.'],
      ['¿Qué pasa con el efectivo de la tienda?', 'La tienda entrega una devolución en efectivo a Ana.', ['Aumenta', 'Disminuye', 'Sigue igual'], 'La devolución saca efectivo de la tienda.', 'Sigue a la persona o negocio indicado, no solo la palabra devolución.'],
      ['O que acontece com o dinheiro da loja?', 'A loja entrega um reembolso em dinheiro para Ana.', ['Aumenta', 'Diminui', 'Fica igual'], 'O reembolso tira dinheiro da loja.', 'Acompanhe a pessoa ou o negócio indicado, não só a palavra reembolso.'],
    ]),
    numeric(Q('practice-02', 'practice', S, 0, [
      ['How much is available now?', 'You hold 50. An approved refund of 30 has not arrived.', ['50', '80', '30'], 'Only the money already received is available now.', 'Approval is not the same as receipt.'],
      ['¿Cuánto está disponible ahora?', 'Tienes 50. Una devolución aprobada de 30 no ha llegado.', ['50', '80', '30'], 'Solo el dinero recibido está disponible ahora.', 'Aprobación no significa recepción.'],
      ['Quanto está disponível agora?', 'Você tem 50. Um reembolso aprovado de 30 ainda não chegou.', ['50', '80', '30'], 'Só o dinheiro recebido está disponível agora.', 'Aprovação não significa recebimento.'],
    ]), [50, 30], input(0)),
    ledger('practice-03', 'practice', S, 60, 20, 15, ['sale', 'cost'], [
      ['Start with 60, receive 20 and pay 15. Record the movements and enter the final balance.', 'The balance includes the starting money and both completed changes.', 'Add the receipt to the start, then subtract the payment.'],
      ['Empieza con 60, recibe 20 y paga 15. Registra los movimientos y escribe el saldo final.', 'El saldo incluye el dinero inicial y ambos cambios realizados.', 'Suma la entrada al inicio y luego resta el pago.'],
      ['Comece com 60, receba 20 e pague 15. Registre os movimentos e digite o saldo final.', 'O saldo inclui o dinheiro inicial e as duas mudanças concluídas.', 'Some a entrada ao início e depois subtraia o pagamento.'],
    ]),
    Q('practice-04', 'practice', S, 2, [
      ['Which payment remains pending?', 'The appointment is paid. The required medicine bill is unpaid; an optional trip can wait.', ['The appointment', 'The optional trip', 'The medicine bill'], 'The stated unpaid bill still needs protected money.', 'Separate a completed payment from an unpaid obligation.'],
      ['¿Qué pago sigue pendiente?', 'La cita está pagada. La cuenta necesaria de medicinas sigue pendiente; el viaje opcional puede esperar.', ['La cita', 'El viaje opcional', 'La cuenta de medicinas'], 'La cuenta pendiente indicada todavía necesita dinero protegido.', 'Distingue un pago realizado de una obligación pendiente.'],
      ['Qual pagamento continua pendente?', 'A consulta está paga. A conta necessária de remédios está pendente; a viagem opcional pode esperar.', ['A consulta', 'A viagem opcional', 'A conta de remédios'], 'A conta pendente informada ainda precisa de dinheiro protegido.', 'Separe um pagamento concluído de uma obrigação pendente.'],
    ]),
    numeric(Q('practice-05', 'practice', S, 1, [
      ['How much is free?', 'You hold 90. Protect 40 for one bill and 20 for another.', ['50', '30', '60'], '90 − 40 = 50; 50 − 20 = 30 remains free.', 'Protect both unpaid bills before using the remainder.'],
      ['¿Cuánto queda libre?', 'Tienes 90. Protege 40 para una cuenta y 20 para otra.', ['50', '30', '60'], '90 − 40 = 50; 50 − 20 = 30 libres.', 'Protege ambas cuentas pendientes antes de usar el resto.'],
      ['Quanto fica livre?', 'Você tem 90. Proteja 40 para uma conta e 20 para outra.', ['50', '30', '60'], '90 − 40 = 50; 50 − 20 = 30 livres.', 'Proteja as duas contas pendentes antes de usar o restante.'],
    ]), [90, 40, 20], subtract(subtract(input(0), input(1)), input(2))),
    numeric(Q('transfer-01', 'transfer', S, 1, [
      ['How much can you use?', 'After paying 20, your balance is 80. Protect 50 for an unpaid bill.', ['10', '30', '50'], '80 − 50 = 30. The completed payment is already reflected in the balance.', 'Do not subtract a past payment again from the updated balance.'],
      ['¿Cuánto puedes usar?', 'Después de pagar 20, tu saldo es 80. Protege 50 para una cuenta pendiente.', ['10', '30', '50'], '80 − 50 = 30. El pago realizado ya está reflejado en el saldo.', 'No vuelvas a restar un pago anterior del saldo actualizado.'],
      ['Quanto pode usar?', 'Depois de pagar 20, seu saldo é 80. Proteja 50 para uma conta pendente.', ['10', '30', '50'], '80 − 50 = 30. O pagamento concluído já está refletido no saldo.', 'Não subtraia de novo um pagamento anterior do saldo atualizado.'],
    ]), [20, 80, 50], subtract(input(1), input(2))),
  ], { 'practice-01': 'cash.direction', 'practice-02': 'cash.received', 'practice-03': 'cash.balance', 'practice-04': 'cash.commitment', 'practice-05': 'cash.reserved', 'transfer-01': 'cash.reserved' });
