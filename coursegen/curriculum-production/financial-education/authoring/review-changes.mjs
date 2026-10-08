import { defineReview, Q, numeric, input, subtract } from './factory.mjs';
const S = 'finance.plan.uncertain-income';
export const reviewChanges = defineReview(2,
  ['Update the decision', 'Actualiza la decisión', 'Atualize a decisão'],
  ['Check timing, borrowing and transfers before changing a spending decision.', 'Revisa fechas, préstamos y transferencias antes de cambiar una decisión de gasto.', 'Confira datas, empréstimos e transferências antes de mudar uma decisão de gasto.'],
  'Revise a spending decision using current accessible money, repayment commitments and the actual status of expected receipts.', 8, [
    Q('practice-01', 'practice', S, 0, [
      ['What prevents timely payment?', 'No money now. A bill is due Thursday; a sufficient receipt arrives Friday.', ['The arrival date', 'The receipt amount'], 'The receipt is large enough but arrives after the deadline.', 'Compare the dates separately from the amounts.'],
      ['¿Qué impide pagar a tiempo?', 'Sin dinero ahora. La cuenta vence el jueves; una entrada suficiente llega el viernes.', ['La fecha de llegada', 'El monto de la entrada'], 'La entrada alcanza, pero llega después del vencimiento.', 'Compara las fechas por separado de los montos.'],
      ['O que impede pagar no prazo?', 'Sem dinheiro agora. A conta vence quinta; uma entrada suficiente chega sexta.', ['A data de chegada', 'O valor da entrada'], 'A entrada basta, mas chega depois do vencimento.', 'Compare as datas separadamente dos valores.'],
    ]),
    numeric(Q('practice-02', 'practice', S, 2, [
      ['How much remains owed?', 'The agreement requires returning 25. You spent 15 but repaid nothing.', ['10', '15', '25'], 'Spending the cash did not make a repayment.', 'Track the amount returned to the lender, not the amount spent elsewhere.'],
      ['¿Cuánto sigues debiendo?', 'El acuerdo exige devolver 25. Gastaste 15, pero no devolviste nada.', ['10', '15', '25'], 'Gastar el efectivo no fue una devolución.', 'Sigue lo devuelto al prestamista, no lo gastado en otro lugar.'],
      ['Quanto continua devendo?', 'O acordo exige devolver 25. Você gastou 15, mas não devolveu nada.', ['10', '15', '25'], 'Gastar o dinheiro não foi uma devolução.', 'Acompanhe o valor devolvido ao credor, não o gasto em outro lugar.'],
    ]), [25, 15], input(0)),
    Q('practice-03', 'practice', S, 1, [
      ['Did your total grow?', 'You moved cash into your own savings envelope. Nothing else entered or left.', ['Yes, the envelope grew', 'No, the location changed'], 'The same money moved between places where you keep it.', 'Include the place the money came from as well as its destination.'],
      ['¿Creció tu total?', 'Moviste efectivo a tu propio sobre de ahorro. No hubo otras entradas ni salidas.', ['Sí, aumentó el sobre', 'No, cambió de lugar'], 'El mismo dinero pasó entre lugares donde lo guardas.', 'Incluye tanto el lugar de origen como el destino del dinero.'],
      ['Seu total cresceu?', 'Você moveu dinheiro para seu próprio envelope de poupança. Não houve outras entradas nem saídas.', ['Sim, o envelope cresceu', 'Não, mudou de lugar'], 'O mesmo dinheiro passou entre lugares onde você o guarda.', 'Inclua tanto a origem quanto o destino do dinheiro.'],
    ]),
    numeric(Q('practice-04', 'practice', S, 0, [
      ['What is free now?', 'You have 50 and protect 35. An expected 20 is delayed.', ['15', '35', '70'], '50 − 35 = 15. The delayed receipt is still excluded.', 'Use money already received and preserve the commitment.'],
      ['¿Cuánto está libre ahora?', 'Tienes 50 y proteges 35. Una entrada esperada de 20 se retrasa.', ['15', '35', '70'], '50 − 35 = 15. La entrada retrasada sigue fuera del cálculo.', 'Usa dinero recibido y conserva el compromiso.',],
      ['Quanto está livre agora?', 'Você tem 50 e protege 35. Uma entrada esperada de 20 atrasa.', ['15', '35', '70'], '50 − 35 = 15. A entrada atrasada continua fora do cálculo.', 'Use dinheiro recebido e preserve o compromisso.'],
    ]), [50, 35, 20], subtract(input(0), input(1))),
    Q('practice-05', 'practice', S, 1, [
      ['Which money can pay on time?', 'Cash: 30 now; bill: 20 due Thursday. Separate funds stay locked until Friday.', ['Friday’s locked funds', 'Cash already available', 'Wait for all funds'], 'The available cash covers this bill before its deadline.', 'Delayed access elsewhere does not prevent using sufficient cash already held.'],
      ['¿Qué dinero paga a tiempo?', 'Efectivo: 30 ahora; cuenta: 20 para el jueves. Otros fondos se desbloquean el viernes.', ['Los fondos del viernes', 'El efectivo disponible', 'Esperar todos los fondos'], 'El efectivo disponible cubre esta cuenta antes del vencimiento.', 'El acceso posterior a otros fondos no impide usar el efectivo suficiente.'],
      ['Qual dinheiro paga no prazo?', 'Dinheiro: 30 agora; conta: 20 até quinta. Outros recursos ficam bloqueados até sexta.', ['Os recursos de sexta', 'O dinheiro disponível', 'Esperar todos os recursos'], 'O dinheiro disponível cobre esta conta antes do vencimento.', 'O acesso posterior a outros recursos não impede usar o dinheiro suficiente.'],
    ]),
    numeric(Q('transfer-01', 'transfer', S, 2, [
      ['How much is free?', 'You have 30 total after moving 10 between your accounts. A promised 40 is canceled; protect 20.', ['20', '50', '10'], '30 − 20 = 10. Neither the transfer nor the canceled promise adds money.', 'Start from the stated total; do not add existing or canceled money.'],
      ['¿Cuánto queda libre?', 'Tienes 30 en total tras mover 10 entre tus cuentas. Se cancelaron 40 prometidos; protege 20.', ['20', '50', '10'], '30 − 20 = 10. Ni la transferencia ni la promesa cancelada agregan dinero.', 'Parte del total indicado; no agregues dinero existente ni cancelado.'],
      ['Quanto fica livre?', 'Você tem 30 no total após mover 10 entre suas contas. Foram cancelados 40 prometidos; proteja 20.', ['20', '50', '10'], '30 − 20 = 10. Nem a transferência nem a promessa cancelada acrescentam dinheiro.', 'Parta do total informado; não acrescente dinheiro existente nem cancelado.'],
    ]), [30, 10, 40, 20], subtract(input(0), input(3))),
  ], { 'practice-01': 'cash.dates', 'practice-02': 'debt.obligation', 'practice-03': 'cash.transfer', 'practice-04': 'plan.uncertain-income', 'practice-05': 'cash.dates', 'transfer-01': 'plan.uncertain-income' });
