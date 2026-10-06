import { define, E, Q } from './factory.mjs';
const skill = 'finance.cash.commitment';
export const commitment = define(3,
  ['Already committed', 'Ya está comprometido', 'Já está comprometido'],
  ['Money can still be with you while it is needed for an upcoming payment.', 'El dinero puede seguir contigo aunque lo necesites para un pago próximo.', 'O dinheiro pode continuar com você mesmo sendo necessário para um pagamento próximo.'], [
    E('example-01', ['Mark the commitment', 'Señala el compromiso', 'Marque o compromisso'], [
      'You hold 70; tomorrow’s bill needs 40. Reserving that 40 protects the payment without spending the money yet.',
      'Tienes 70; la cuenta de mañana requiere 40. Apartar esos 40 protege el pago sin gastar todavía el dinero.',
      'Você tem 70; a conta de amanhã exige 40. Reservar esses 40 protege o pagamento sem gastar o dinheiro ainda.',
    ]),
    Q('guided-01', 'guided', skill, 1, [
      ['What is committed?', 'You hold 35. Protect 20 for tomorrow’s required transport payment.', ['All 35', 'The transport money', 'Nothing until tomorrow'], 'The transport payment is still unpaid and must be protected.', 'Money can be committed before it leaves your hands.'],
      ['¿Qué está comprometido?', 'Tienes 35. Protege 20 para el transporte necesario de mañana.', ['Los 35 completos', 'El dinero del transporte', 'Nada hasta mañana'], 'El transporte sigue pendiente y debes proteger ese dinero.', 'El dinero puede estar comprometido antes de pagarlo.'],
      ['O que está comprometido?', 'Você tem 35. Proteja 20 para o transporte necessário de amanhã.', ['Os 35 inteiros', 'O dinheiro do transporte', 'Nada até amanhã'], 'O transporte ainda não foi pago e esse dinheiro precisa ficar protegido.', 'O dinheiro pode estar comprometido antes de ser pago.'],
    ]),
    Q('guided-02', 'guided', skill, 0, [
      ['Has the money left?', 'You set aside cash for an unpaid bill. You still hold it.', ['Not yet', 'Yes, setting aside pays it'], 'Setting money aside is different from paying the bill.', 'Check whether a payment actually happened.'],
      ['¿Ya salió el dinero?', 'Apartaste efectivo para una cuenta pendiente. Todavía lo tienes.', ['Todavía no', 'Sí, apartarlo la paga'], 'Apartar dinero es distinto de pagar la cuenta.', 'Revisa si realmente se hizo el pago.'],
      ['O dinheiro já saiu?', 'Você separou dinheiro para uma conta pendente. Ainda está com ele.', ['Ainda não', 'Sim, separar já paga'], 'Separar dinheiro é diferente de pagar a conta.', 'Confira se o pagamento realmente aconteceu.'],
    ]),
    Q('practice-01', 'practice', skill, 2, [
      ['Which amount needs protection?', 'A bill is still unpaid. An optional purchase can wait.', ['Only the optional purchase', 'Neither amount', 'The unpaid bill'], 'The scenario identifies the unpaid bill as the commitment.', 'Follow the stated obligation, not the purchase you prefer.'],
      ['¿Qué dinero debes proteger?', 'Una cuenta sigue pendiente. Una compra opcional puede esperar.', ['Solo la compra opcional', 'Ningún monto', 'El de la cuenta pendiente'], 'La situación señala la cuenta pendiente como el compromiso.', 'Sigue la obligación indicada, no la compra que prefieras.'],
      ['Qual dinheiro precisa de proteção?', 'Uma conta continua pendente. Uma compra opcional pode esperar.', ['Só o da compra opcional', 'Nenhum valor', 'O da conta pendente'], 'A situação aponta a conta pendente como o compromisso.', 'Siga a obrigação informada, não a compra que você prefere.'],
    ]),
    Q('practice-02', 'practice', skill, 1, [
      ['Reserve it again?', 'A bill was paid in full yesterday. No amount remains due.', ['Yes, it was a bill', 'No, it is already paid'], 'A completed payment is not an unpaid commitment.', 'Look at whether anything is still owed.'],
      ['¿Apartarlo otra vez?', 'La cuenta se pagó completa ayer. No queda nada pendiente.', ['Sí, era una cuenta', 'No, ya está pagada'], 'Un pago terminado no es un compromiso pendiente.', 'Revisa si todavía se debe algo.'],
      ['Reservar de novo?', 'A conta foi paga integralmente ontem. Não resta nada a pagar.', ['Sim, era uma conta', 'Não, já está paga'], 'Um pagamento concluído não é um compromisso pendente.', 'Veja se ainda existe algo a pagar.'],
    ]),
    Q('practice-03', 'practice', skill, 0, [
      ['What does the label mean?', 'An envelope says “tomorrow’s bill.” The bill remains unpaid.', ['Money reserved for that bill', 'A bill already paid', 'New income tomorrow'], 'The label identifies the intended use of money still held.', 'A label neither pays a bill nor creates income.'],
      ['¿Qué significa la etiqueta?', 'Un sobre dice «cuenta de mañana». La cuenta sigue pendiente.', ['Dinero apartado para esa cuenta', 'Una cuenta ya pagada', 'Ingreso nuevo mañana'], 'La etiqueta indica el destino del dinero que aún tienes.', 'Una etiqueta no paga una cuenta ni crea ingresos.'],
      ['O que significa a etiqueta?', 'Um envelope diz “conta de amanhã”. A conta continua pendente.', ['Dinheiro reservado para essa conta', 'Uma conta já paga', 'Renda nova amanhã'], 'A etiqueta indica o destino do dinheiro que você ainda tem.', 'Uma etiqueta não paga uma conta nem cria renda.'],
    ]),
    Q('transfer-01', 'transfer', skill, 2, [
      ['Which commitment remains?', 'The appointment is prepaid. Tomorrow’s required transport is still unpaid.', ['The appointment only', 'Both were already paid', 'Tomorrow’s transport'], 'Only the transport still requires a payment in this scenario.', 'Separate a prepaid service from an unpaid obligation.'],
      ['¿Qué compromiso queda?', 'La cita ya está pagada. El transporte necesario de mañana sigue pendiente.', ['Solo la cita', 'Ambos ya están pagados', 'El transporte de mañana'], 'Solo el transporte todavía requiere un pago en esta situación.', 'Distingue el servicio pagado de la obligación pendiente.'],
      ['Qual compromisso permanece?', 'A consulta já está paga. O transporte necessário de amanhã continua pendente.', ['Só a consulta', 'Ambos já estão pagos', 'O transporte de amanhã'], 'Só o transporte ainda exige um pagamento nesta situação.', 'Separe o serviço já pago da obrigação pendente.'],
    ]),
  ]);
