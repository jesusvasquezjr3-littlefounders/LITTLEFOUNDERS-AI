import { define, E, Q } from './factory.mjs';
const skill = 'finance.debt.obligation';
export const borrowing = define(6,
  ['Received, but owed', 'Dinero prestado', 'Dinheiro emprestado'],
  ['A loan gives you money now and leaves a repayment to make later.', 'Un préstamo te da dinero ahora y deja un pago pendiente para después.', 'Um empréstimo traz dinheiro agora e deixa um pagamento para depois.'], [
    E('example-01', ['Two separate facts', 'Dos datos distintos', 'Dois fatos diferentes'], [
      'You have 25 and borrow 15: 25 + 15 = 40 now. You must return 15 tomorrow.',
      'Tienes 25 y recibes 15 prestados: 25 + 15 = 40 ahora. Debes devolver 15 mañana.',
      'Você tem 25 e pega 15 emprestados: 25 + 15 = 40 agora. Deve devolver 15 amanhã.',
    ]),
    E('example-02', ['Cash and obligation', 'Efectivo y obligación', 'Dinheiro e obrigação'], [
      'The loan increases cash, but repayment remains separate. Receiving money does not automatically make it earnings.',
      'El préstamo aumenta el efectivo, pero la devolución sigue pendiente. Recibir dinero no lo convierte automáticamente en ingreso ganado.',
      'O empréstimo aumenta o dinheiro, mas a devolução continua pendente. Receber dinheiro não o transforma automaticamente em renda ganha.',
    ]),
    Q('guided-01', 'guided', skill, 1, [
      ['Which receipt must be repaid?', 'One receipt is earnings. Another is a loan requiring repayment.', ['The earnings', 'The loan', 'Neither receipt'], 'The loan agreement creates the repayment obligation.', 'Check whether the receipt includes a repayment requirement.'],
      ['¿Qué entrada debes devolver?', 'Una entrada es ingreso ganado. Otra es un préstamo que debes devolver.', ['El ingreso ganado', 'El préstamo', 'Ninguna entrada'], 'El acuerdo del préstamo crea la obligación de devolverlo.', 'Revisa si la entrada exige una devolución.'],
      ['Qual entrada precisa devolver?', 'Uma entrada é renda ganha. Outra é um empréstimo que deve devolver.', ['A renda ganha', 'O empréstimo', 'Nenhuma entrada'], 'O acordo do empréstimo cria a obrigação de devolver.', 'Confira se a entrada exige devolução.'],
    ]),
    Q('guided-02', 'guided', skill, 0, [
      ['What changed when it arrived?', 'You received a loan. None has been repaid.', ['Cash increased; debt remains', 'Cash increased; debt disappeared', 'Only earnings increased'], 'Receipt increases cash without settling the repayment obligation.', 'Receiving a loan is different from repaying it.'],
      ['¿Qué cambió al recibirlo?', 'Recibiste un préstamo. No has devuelto nada.', ['Aumentó el efectivo; debes devolverlo', 'Aumentó el efectivo; desapareció la deuda', 'Solo aumentó el ingreso ganado'], 'Recibirlo aumenta el efectivo sin saldar la obligación.', 'Recibir un préstamo es distinto de devolverlo.'],
      ['O que mudou ao recebê-lo?', 'Você recebeu um empréstimo. Não devolveu nada.', ['O dinheiro aumentou; a dívida permanece', 'O dinheiro aumentou; a dívida desapareceu', 'Só a renda ganha aumentou'], 'Receber aumenta o dinheiro sem quitar a obrigação.', 'Receber um empréstimo é diferente de devolvê-lo.'],
    ]),
    Q('practice-01', 'practice', skill, 2, [
      ['Did spending repay the loan?', 'You spent borrowed cash on transport. Nothing went back to the lender.', ['Yes, the cash is gone', 'Partly, transport was necessary', 'No, repayment remains'], 'Paying for transport did not pay the lender.', 'Follow who received the payment.'],
      ['¿Gastarlo devolvió el préstamo?', 'Gastaste el dinero prestado en transporte. No devolviste nada al prestamista.', ['Sí, el efectivo ya salió', 'En parte, era necesario', 'No, sigue la obligación'], 'Pagar transporte no fue pagarle al prestamista.', 'Observa quién recibió el pago.'],
      ['Gastar devolveu o empréstimo?', 'Você gastou o dinheiro emprestado em transporte. Nada foi devolvido ao credor.', ['Sim, o dinheiro saiu', 'Em parte, era necessário', 'Não, a obrigação continua'], 'Pagar transporte não foi pagar o credor.', 'Observe quem recebeu o pagamento.'],
    ]),
    Q('practice-02', 'practice', skill, 0, [
      ['Which record is complete?', 'A received loan remains entirely unpaid.', ['Record cash and repayment owed', 'Record only new earnings', 'Record only cash held'], 'Both current cash and the future repayment matter.', 'Do not erase the obligation when recording the receipt.'],
      ['¿Qué registro está completo?', 'Un préstamo recibido sigue sin devolverse.', ['Anotar efectivo y devolución pendiente', 'Anotar solo ingreso ganado', 'Anotar solo efectivo disponible'], 'Importan tanto el efectivo actual como la devolución pendiente.', 'No borres la obligación al registrar la entrada.'],
      ['Qual registro está completo?', 'Um empréstimo recebido ainda não foi devolvido.', ['Anotar dinheiro e devolução pendente', 'Anotar só renda ganha', 'Anotar só dinheiro disponível'], 'Importam tanto o dinheiro atual quanto a devolução pendente.', 'Não apague a obrigação ao registrar a entrada.'],
    ]),
    Q('practice-03', 'practice', skill, 1, [
      ['Which receipt creates this obligation?', 'A gift needs no repayment. A loan must be returned under its stated agreement.', ['The gift', 'The loan', 'Both because money arrived'], 'The stated repayment agreement distinguishes this loan from the gift.', 'Incoming money does not always have the same conditions.'],
      ['¿Qué entrada crea esta obligación?', 'Un regalo no exige devolución. Un préstamo debe devolverse según su acuerdo.', ['El regalo', 'El préstamo', 'Ambos porque llegó dinero'], 'El acuerdo de devolución distingue este préstamo del regalo.', 'El dinero recibido no siempre tiene las mismas condiciones.'],
      ['Qual entrada cria esta obrigação?', 'Um presente não exige devolução. Um empréstimo deve ser devolvido conforme o acordo.', ['O presente', 'O empréstimo', 'Ambos porque chegou dinheiro'], 'O acordo de devolução distingue este empréstimo do presente.', 'O dinheiro recebido nem sempre tem as mesmas condições.'],
    ]),
    Q('transfer-01', 'transfer', skill, 2, [
      ['What remains after the purchase?', 'You received money for a purchase and agreed to return it next week. Nothing has been repaid.', ['Only the purchase', 'New earnings', 'The repayment obligation'], 'Spending the borrowed money does not cancel its repayment.', 'A different name for borrowed money does not remove its conditions.'],
      ['¿Qué queda tras la compra?', 'Recibiste dinero para una compra y acordaste devolverlo la próxima semana. No has devuelto nada.', ['Solo la compra', 'Un ingreso ganado', 'La obligación de devolverlo'], 'Gastar el dinero prestado no cancela la devolución acordada.', 'Otro nombre para el dinero prestado no elimina sus condiciones.'],
      ['O que fica após a compra?', 'Você recebeu dinheiro para uma compra e combinou devolver na próxima semana. Nada foi devolvido.', ['Só a compra', 'Uma renda ganha', 'A obrigação de devolver'], 'Gastar o dinheiro emprestado não cancela a devolução combinada.', 'Outro nome para o dinheiro emprestado não elimina suas condições.'],
    ]),
  ]);
