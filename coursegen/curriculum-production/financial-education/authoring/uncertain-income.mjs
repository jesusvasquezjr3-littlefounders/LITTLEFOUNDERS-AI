import { define, E, Q, numeric, input, subtract, add } from './factory.mjs';
const skill = 'finance.plan.uncertain-income';
export const uncertainIncome = define(8,
  ['When a receipt changes', 'Si cambia una entrada', 'Se uma entrada muda'],
  ['A changed payment changes what a plan can afford. Recheck the money actually received.', 'Si cambia un pago, cambia lo que tu plan permite. Revisa el dinero realmente recibido.', 'Se um pagamento muda, muda o que seu plano permite. Confira o dinheiro realmente recebido.'], [
    E('example-01', ['Rebuild from what arrived', 'Parte de lo recibido', 'Parta do que chegou'], [
      'A promised receipt is delayed. You have 60 and protect 40: 60 − 40 = 20 free without the missing receipt.',
      'Una entrada prometida se retrasa. Tienes 60 y proteges 40: 60 − 40 = 20 libres sin contar la entrada pendiente.',
      'Uma entrada prometida atrasa. Você tem 60 e protege 40: 60 − 40 = 20 livres sem contar a entrada pendente.',
    ]),
    numeric(Q('guided-01', 'guided', skill, 1, [
      ['How much is free now?', 'You have 25 and protect 20. Another 10 is promised but has not arrived.', ['15', '5', '35'], '25 − 20 = 5. The unreceived promise does not increase today’s money.', 'Use the amount actually held, then protect the commitment.'],
      ['¿Cuánto queda libre ahora?', 'Tienes 25 y proteges 20. Hay otros 10 prometidos que no han llegado.', ['15', '5', '35'], '25 − 20 = 5. La promesa pendiente no aumenta el dinero de hoy.', 'Usa el monto que realmente tienes y protege el compromiso.'],
      ['Quanto fica livre agora?', 'Você tem 25 e protege 20. Outros 10 foram prometidos, mas não chegaram.', ['15', '5', '35'], '25 − 20 = 5. A promessa pendente não aumenta o dinheiro de hoje.', 'Use o valor que realmente tem e proteja o compromisso.'],
    ]), [25, 20, 10], subtract(input(0), input(1))),
    Q('guided-02', 'guided', skill, 0, [
      ['What should the plan use?', 'A planned purchase depended on a receipt that is now canceled.', ['Current money and commitments', 'The original expected amount', 'The purchase price alone'], 'The canceled receipt no longer supports the purchase plan.', 'Update the information before repeating the earlier decision.'],
      ['¿Qué debe usar el plan?', 'Una compra planeada dependía de una entrada que ahora está cancelada.', ['Dinero actual y compromisos', 'El monto esperado originalmente', 'Solo el precio de compra'], 'La entrada cancelada ya no sostiene el plan de compra.', 'Actualiza la información antes de repetir la decisión anterior.'],
      ['O que o plano deve usar?', 'Uma compra planejada dependia de uma entrada agora cancelada.', ['Dinheiro atual e compromissos', 'O valor esperado originalmente', 'Só o preço da compra'], 'A entrada cancelada não sustenta mais o plano da compra.', 'Atualize a informação antes de repetir a decisão anterior.'],
    ]),
    numeric(Q('practice-01', 'practice', skill, 2, [
      ['What can you spend today?', 'You hold 30 and protect 20. An expected 50 will arrive next week.', ['60', '30', '10'], '30 − 20 = 10 is free today.', 'Next week’s receipt cannot increase today’s available money.'],
      ['¿Cuánto puedes gastar hoy?', 'Tienes 30 y proteges 20. Los 50 esperados llegarán la próxima semana.', ['60', '30', '10'], '30 − 20 = 10 libres hoy.', 'La entrada de la próxima semana no aumenta el dinero disponible hoy.'],
      ['Quanto pode gastar hoje?', 'Você tem 30 e protege 20. Os 50 esperados chegarão na próxima semana.', ['60', '30', '10'], '30 − 20 = 10 livres hoje.', 'A entrada da próxima semana não aumenta o dinheiro disponível hoje.'],
    ]), [30, 20, 50], subtract(input(0), input(1))),
    Q('practice-02', 'practice', skill, 0, [
      ['Does it fit now?', 'The receipt arrived: you have 40, protect 30; the purchase costs 8.', ['Yes, it fits the free 10', 'No, ignore the received money'], '40 − 30 = 10. The purchase of 8 now fits.', 'Update the plan for completed receipts as well as delays.'],
      ['¿La compra cabe ahora?', 'La entrada llegó. Ahora tienes 40, proteges 30 y consideras una compra de 8.', ['Sí, cabe en los 10 libres', 'No, ignora el dinero recibido'], '40 − 30 = 10. El precio de 8 cabe después de recibir el dinero.', 'Actualiza el plan por entradas realizadas, no solo por retrasos.'],
      ['A compra cabe agora?', 'A entrada chegou. Agora você tem 40, protege 30 e considera uma compra de 8.', ['Sim, cabe nos 10 livres', 'Não, ignore o dinheiro recebido'], '40 − 30 = 10. O preço de 8 cabe após receber o dinheiro.', 'Atualize o plano por entradas concluídas, não só por atrasos.'],
    ]),
    Q('practice-03', 'practice', skill, 1, [
      ['What still needs protection?', 'A promised receipt is delayed. An existing unpaid obligation has not changed.', ['Nothing; the delay canceled it', 'The existing obligation', 'Only the optional purchase'], 'The receipt changed, but the stated obligation did not disappear.', 'Check which fact changed and which commitment still applies.'],
      ['¿Qué sigue necesitando protección?', 'Una entrada prometida se retrasa. Una obligación pendiente no ha cambiado.', ['Nada; el retraso la canceló', 'La obligación existente', 'Solo la compra opcional'], 'Cambió la entrada, pero la obligación indicada no desapareció.', 'Revisa qué dato cambió y qué compromiso sigue vigente.'],
      ['O que ainda precisa de proteção?', 'Uma entrada prometida atrasa. Uma obrigação pendente não mudou.', ['Nada; o atraso a cancelou', 'A obrigação existente', 'Só a compra opcional'], 'A entrada mudou, mas a obrigação informada não desapareceu.', 'Confira qual fato mudou e qual compromisso continua valendo.'],
    ]),
    numeric(Q('transfer-01', 'transfer', skill, 0, [
      ['How much is free after this receipt?', 'You had 10; of a promised 30, only 15 arrived. Protect 20.', ['5', '20', '25'], '10 + 15 = 25 received; 25 − 20 = 5 free. Exclude the unreceived remainder.', 'Include only the part that arrived before protecting the commitment.'],
      ['¿Cuánto queda libre tras esta entrada?', 'Tenías 10; de los 30 prometidos, solo llegaron 15. Protege 20.', ['5', '20', '25'], '10 + 15 = 25 recibidos; 25 − 20 = 5 libres. No cuentas la parte pendiente.', 'Incluye solo lo que llegó antes de proteger el compromiso.'],
      ['Quanto fica livre após esta entrada?', 'Você tinha 10; dos 30 prometidos, só chegaram 15. Proteja 20.', ['5', '20', '25'], '10 + 15 = 25 recebidos; 25 − 20 = 5 livres. Não conte a parte pendente.', 'Inclua só o que chegou antes de proteger o compromisso.'],
    ]), [10, 30, 15, 20], subtract(add(input(0), input(2)), input(3))),
  ]);
