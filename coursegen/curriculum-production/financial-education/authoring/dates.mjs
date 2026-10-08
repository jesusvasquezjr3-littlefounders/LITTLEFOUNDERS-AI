import { define, E, Q } from './factory.mjs';
const skill = 'finance.cash.dates';
export const dates = define(5,
  ['In time to pay', 'A tiempo para pagar', 'A tempo de pagar'],
  ['Money arriving later cannot meet an earlier deadline. Check when it becomes usable.', 'El dinero que llega después no cubre un plazo anterior. Revisa cuándo puedes usarlo.', 'Dinheiro que chega depois não atende a um prazo anterior. Confira quando poderá usá-lo.'], [
    E('example-01', ['Check the order', 'Revisa el orden', 'Confira a ordem'], [
      'Thursday’s bill comes before Friday’s receipt. With no money available now, that receipt arrives too late.',
      'La cuenta del jueves vence antes del ingreso del viernes. Sin dinero disponible ahora, esa entrada llega tarde.',
      'A conta de quinta vence antes do recebimento de sexta. Sem dinheiro disponível agora, essa entrada chega tarde.',
    ]),
    Q('guided-01', 'guided', skill, 0, [
      ['Is the money available first?', 'Receive the full bill amount Tuesday. The bill is due Wednesday.', ['Yes, Tuesday is earlier', 'No, Wednesday is earlier', 'Only the amount matters'], 'Tuesday’s receipt occurs before Wednesday’s deadline.', 'Compare the order of the two dates.'],
      ['¿El dinero llega primero?', 'Recibes el monto completo el martes. La cuenta vence el miércoles.', ['Sí, el martes va antes', 'No, el miércoles va antes', 'Solo importa el monto'], 'El ingreso del martes llega antes del vencimiento del miércoles.', 'Compara el orden de las dos fechas.'],
      ['O dinheiro chega primeiro?', 'Você recebe o valor inteiro terça. A conta vence quarta.', ['Sim, terça vem antes', 'Não, quarta vem antes', 'Só o valor importa'], 'O recebimento de terça ocorre antes do vencimento de quarta.', 'Compare a ordem das duas datas.'],
    ]),
    Q('guided-02', 'guided', skill, 1, [
      ['Is it on time?', 'No money now; the bill is due day 3, enough money arrives day 5.', ['Yes, enough eventually', 'No, it arrives late', 'Yes, same week'], 'The payment is due before the money arrives.', 'Having enough later does not solve the earlier shortage.'],
      ['¿El ingreso posterior paga a tiempo?', 'Sin dinero inicial. La cuenta vence el día 3; el dinero llega el día 5.', ['Sí, después llega suficiente', 'No, el plazo llega antes', 'Sí, es la misma semana'], 'El pago vence antes de que llegue el dinero.', 'Tener suficiente después no resuelve la falta anterior.'],
      ['O recebimento posterior paga no prazo?', 'Sem dinheiro inicial. A conta vence no dia 3; o dinheiro chega no dia 5.', ['Sim, depois chega o suficiente', 'Não, o prazo vem antes', 'Sim, é na mesma semana'], 'O pagamento vence antes da chegada do dinheiro.', 'Ter o suficiente depois não resolve a falta anterior.'],
    ]),
    Q('practice-01', 'practice', skill, 1, [
      ['What blocks payment on time?', 'No money now. A receipt covers the bill but arrives after its deadline.', ['The amount', 'The arrival date'], 'The amount is sufficient; the timing is the problem.', 'Separate the size of the receipt from its arrival date.'],
      ['¿Qué impide pagar a tiempo?', 'Sin dinero ahora. El ingreso cubre la cuenta, pero llega después del vencimiento.', ['El monto', 'La fecha de llegada'], 'El monto alcanza; el problema es la fecha.', 'Distingue el tamaño del ingreso de cuándo llega.'],
      ['O que impede pagar no prazo?', 'Sem dinheiro agora. O recebimento cobre a conta, mas chega após o vencimento.', ['O valor', 'A data de chegada'], 'O valor basta; o problema é a data.', 'Separe o valor recebido da data em que ele chega.'],
    ]),
    Q('practice-02', 'practice', skill, 0, [
      ['Can today’s money cover it?', 'You already hold the full payment amount. The bill is due tomorrow.', ['Yes, protect this money', 'No, wait for new income'], 'Money already received can be protected for tomorrow’s payment.', 'Check what is already usable, not only future receipts.'],
      ['¿Lo cubre el dinero de hoy?', 'Ya tienes el monto completo. La cuenta vence mañana.', ['Sí, protege este dinero', 'No, espera otro ingreso'], 'El dinero recibido puede protegerse para el pago de mañana.', 'Revisa lo que ya puedes usar, no solo los ingresos futuros.'],
      ['O dinheiro de hoje cobre?', 'Você já tem o valor inteiro. A conta vence amanhã.', ['Sim, proteja este dinheiro', 'Não, espere nova renda'], 'O dinheiro recebido pode ficar protegido para o pagamento de amanhã.', 'Confira o que já pode usar, não só os recebimentos futuros.'],
    ]),
    Q('practice-03', 'practice', skill, 1, [
      ['Which detail must you check?', 'The receipt amount is enough. Its arrival date is unknown; the bill has a deadline.', ['Only the amount', 'The date money becomes usable'], 'You need the arrival date to compare it with the deadline.', 'An amount without a date cannot establish timely availability.'],
      ['¿Qué dato debes revisar?', 'El ingreso alcanza. No sabes cuándo llega; la cuenta sí tiene vencimiento.', ['Solo el monto', 'Cuándo podrás usar el dinero'], 'Necesitas la fecha del ingreso para compararla con el vencimiento.', 'Un monto sin fecha no demuestra disponibilidad a tiempo.'],
      ['Qual informação precisa conferir?', 'O valor basta. A data de chegada é desconhecida; a conta tem vencimento.', ['Só o valor', 'Quando poderá usar o dinheiro'], 'Você precisa da data de chegada para comparar com o vencimento.', 'Um valor sem data não demonstra disponibilidade no prazo.'],
    ]),
    Q('transfer-01', 'transfer', skill, 1, [
      ['Can these funds pay on time?', 'No other money. Withdrawal opens day 5; the payment is due day 3.', ['Yes, the funds exist', 'No, access opens too late'], 'The money exists but is not accessible by the deadline.', 'Compare access to the funds with the date payment is required.'],
      ['¿Estos fondos pagan a tiempo?', 'No hay otro dinero. Puedes retirar el día 5; debes pagar el día 3.', ['Sí, los fondos existen', 'No, el acceso llega tarde'], 'El dinero existe, pero no puedes usarlo antes del vencimiento.', 'Compara el acceso al dinero con la fecha del pago.'],
      ['Estes recursos pagam no prazo?', 'Não há outro dinheiro. O saque abre no dia 5; o pagamento vence no dia 3.', ['Sim, os recursos existem', 'Não, o acesso abre tarde'], 'O dinheiro existe, mas não está acessível até o vencimento.', 'Compare o acesso ao dinheiro com a data do pagamento.'],
    ]),
  ]);
