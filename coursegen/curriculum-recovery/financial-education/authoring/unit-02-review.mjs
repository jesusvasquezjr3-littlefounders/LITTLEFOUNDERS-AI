import { makeLesson, examples as E, choice as Q } from './assemble.mjs';
const unit = 'fe-solid-02-a-plan-that-fits';
const k = 'life.review-and-adjust-plan';
export const plans = [makeLesson({ number: 10, slug: 'revise-a-plan', unit, title: ['Revise a plan', 'Ajusta un plan', 'Ajuste um plano'], skill: 'plan.revise', kc: k, prerequisites: ['cash.balance', 'cash.reserved', 'plan.priority', 'plan.uncertain-income', 'plan.periodic'],
  outcome: 'Compare planned and actual spending, locate the change, and revise a controllable future amount without hiding a shortfall.',
  misconception: 'Treating a budget as a moral score or changing the record to make the plan appear successful.', numeracy: 'Subtract visible whole amounts; distinguish a completed expense from an optional future payment.',
  relevance: ['A plan is a forecast, not a promise. Actual payments show what needs changing next.', 'Un plan es una previsión, no una promesa. Los pagos reales muestran qué ajustar después.', 'Um plano é uma previsão, não uma promessa. Os pagamentos reais mostram o que ajustar depois.'],
  segments: [
    E('example-01', ['Plan and actual payment', 'Plan y pago real', 'Plano e pagamento real'], ['Transport was planned at 40 but cost 50. The extra 10 reduces money available for other spending.', 'El transporte estaba previsto en 40, pero costó 50. Los 10 extra reducen el dinero para otros gastos.', 'O transporte estava previsto em 40, mas custou 50. Os 10 extras reduzem o dinheiro para outros gastos.']),
    E('example-02', ['Change what is still possible', 'Cambia lo que aún puedes', 'Mude o que ainda pode'], ['An optional purchase can be reduced or delayed. Record the real transport payment to keep the balance accurate.', 'Una compra opcional puede reducirse o aplazarse. Conserva el pago real de transporte para que el saldo sea correcto.', 'Uma compra opcional pode ser reduzida ou adiada. Mantenha o pagamento real de transporte para que o saldo fique correto.']),
    Q('guided-01', 'guided', k, 1, [
      ['How much more was paid?', 'Transport was planned at 40 and actually cost 50.', ['40', '10', '50'], 'The difference measures the extra spending.', 'Compare actual cost with planned cost, not with zero.'],
      ['¿Cuánto más se pagó?', 'El transporte estaba previsto en 40 y realmente costó 50.', ['40', '10', '50'], 'La diferencia mide el gasto adicional.', 'Compara el costo real con el previsto, no con cero.'],
      ['Quanto mais foi pago?', 'O transporte estava previsto em 40 e realmente custou 50.', ['40', '10', '50'], 'A diferença mede o gasto adicional.', 'Compare o custo real com o previsto, não com zero.'],
    ]),
    Q('guided-02', 'guided', k, 0, [
      ['Which record is useful?', 'The real transport payment was higher than planned.', ['Keep the real payment and revise', 'Replace it with the planned amount', 'Remove the payment from the record'], 'A reliable record preserves what actually happened.', 'Changing a record does not return spent money.'],
      ['¿Qué registro sirve?', 'El pago real de transporte fue mayor que el previsto.', ['Conservar el pago real y ajustar', 'Cambiarlo por el monto previsto', 'Borrar el pago del registro'], 'Un registro fiable conserva lo que realmente ocurrió.', 'Cambiar un registro no devuelve el dinero gastado.'],
      ['Qual registro é útil?', 'O pagamento real de transporte foi maior que o previsto.', ['Manter o pagamento real e ajustar', 'Trocá-lo pelo valor previsto', 'Apagar o pagamento do registro'], 'Um registro confiável mantém o que realmente aconteceu.', 'Mudar um registro não devolve o dinheiro gasto.'],
    ]),
    Q('practice-01', 'practice', k, 2, [
      ['What can still change?', 'A necessary repair is already paid. An optional decoration order has not been placed.', ['The completed repair amount', 'The old starting balance', 'The optional future order'], 'The unplaced order is still a controllable future decision.', 'Separate completed events from choices still open.'],
      ['¿Qué todavía puede cambiar?', 'Una reparación necesaria ya está pagada. Un pedido decorativo opcional aún no se hace.', ['El monto de la reparación pagada', 'El saldo inicial anterior', 'El pedido opcional futuro'], 'El pedido no realizado sigue siendo una decisión controlable.', 'Separa los hechos realizados de las decisiones aún abiertas.'],
      ['O que ainda pode mudar?', 'Um conserto necessário já foi pago. Um pedido decorativo opcional ainda não foi feito.', ['O valor do conserto pago', 'O saldo inicial anterior', 'O pedido opcional futuro'], 'O pedido não feito ainda é uma decisão controlável.', 'Separe os fatos realizados das decisões ainda abertas.'],
    ]),
    Q('practice-02', 'practice', k, 1, [
      ['What does this shortfall mean?', 'Necessary payments exceed the money available.', ['The record should hide a payment', 'The plan needs another feasible change', 'A perfect chart creates more money'], 'A real shortfall needs action beyond rearranging labels.', 'A plan reveals constraints; it cannot create resources.'],
      ['¿Qué significa este faltante?', 'Todos los pagos restantes son necesarios y superan el dinero disponible.', ['El registro debe ocultar un pago', 'El plan necesita otro cambio viable', 'Una gráfica perfecta crea dinero'], 'Un faltante real necesita algo más que cambiar etiquetas.', 'Un plan muestra límites; no puede crear recursos.'],
      ['O que significa essa falta?', 'Todos os pagamentos restantes são necessários e superam o dinheiro disponível.', ['O registro deve ocultar um pagamento', 'O plano precisa de outra mudança viável', 'Um gráfico perfeito cria dinheiro'], 'Uma falta real precisa de mais do que mudar rótulos.', 'Um plano mostra limites; não pode criar recursos.'],
    ]),
    Q('practice-03', 'practice', k, 0, [
      ['What is the useful lesson?', 'A usual bill has exceeded the estimate repeatedly.', ['Update the estimate using the evidence', 'Repeat the same estimate forever', 'Stop recording that bill'], 'Repeated actual costs give evidence for a better forecast.', 'Use the pattern to improve the next plan.'],
      ['¿Qué aprendizaje sirve?', 'Un recibo habitual ha superado lo estimado repetidamente.', ['Actualizar la estimación con los datos', 'Repetir siempre la misma estimación', 'Dejar de registrar ese recibo'], 'Los costos reales repetidos ayudan a mejorar la previsión.', 'Usa el patrón para mejorar el próximo plan.'],
      ['Qual aprendizado é útil?', 'Uma conta habitual superou a estimativa repetidamente.', ['Atualizar a estimativa com os dados', 'Repetir sempre a mesma estimativa', 'Parar de registrar essa conta'], 'Os custos reais repetidos ajudam a melhorar a previsão.', 'Use o padrão para melhorar o próximo plano.'],
    ]),
    Q('transfer-01', 'transfer', k, 2, [
      ['What is the new optional spending limit?', 'You had 50 for optional plans. An essential cost used an extra 20; no extra income arrived.', ['50', '70', '30'], 'The revised optional amount reflects the real extra cost.', 'Protect the essential payment and recalculate what remains.'],
      ['¿Cuál es el nuevo límite de gasto opcional?', 'Tenías 50 para planes opcionales. Un gasto necesario usó 20 extra; no llegó más ingreso.', ['50', '70', '30'], 'El monto opcional ajustado refleja el costo adicional real.', 'Protege el pago necesario y vuelve a calcular lo que queda.'],
      ['Qual é o novo limite de gasto opcional?', 'Você tinha 50 para planos opcionais. Um gasto necessário usou 20 extras; não chegou mais renda.', ['50', '70', '30'], 'O valor opcional ajustado reflete o custo adicional real.', 'Proteja o pagamento necessário e recalcule o que resta.'],
    ]),
  ] }), makeLesson({ number: 11, slug: 'choose-a-workable-plan', unit, kind: 'consolidate', title: ['Choose a workable plan', 'Elige un plan viable', 'Escolha um plano viável'], skill: 'plan.priority', kc: 'biz.needs-vs-wants', prerequisites: ['cash.reserved', 'cash.dates'], retrieve: ['plan.priority', 'plan.uncertain-income', 'plan.periodic'],
  outcome: 'Use consequences, uncertain receipts and known future costs together to identify a plan that works under the stated constraints.',
  misconception: 'Selecting a plan by optimistic totals while ignoring why money is reserved.', numeracy: 'Recall equal contributions and small sums taught earlier.',
  relevance: ['A useful plan respects both real limits and what matters to the person. Test several new situations.', 'Un plan útil respeta los límites reales y lo que importa a la persona. Compruébalo en situaciones nuevas.', 'Um plano útil respeita limites reais e o que importa para a pessoa. Confira em situações novas.'],
  evidenceSkills: { 'practice-02': 'plan.uncertain-income', 'practice-03': 'plan.periodic', 'practice-04': 'plan.uncertain-income', 'practice-05': 'plan.periodic' },
  segments: [
    Q('practice-01', 'practice', 'biz.needs-vs-wants', 1, [
      ['Which use matters here?', 'You cycle to work. The brake is broken; a decorative bell is optional.', ['A matching bell', 'Repairing the brake', 'Neither affects the trip'], 'The brake repair protects the stated necessary trip.', 'Judge by the consequence of delaying the payment.'],
      ['¿Qué uso importa aquí?', 'Una bicicleta es la única forma de llegar al trabajo. El freno está roto; una campana decorativa es opcional.', ['Una campana del mismo color', 'Reparar el freno', 'Nada afecta el viaje'], 'Reparar el freno protege el viaje necesario indicado.', 'Decide por la consecuencia de aplazar el pago.'],
      ['Qual uso importa aqui?', 'Uma bicicleta é a única forma de chegar ao trabalho. O freio está quebrado; uma campainha decorativa é opcional.', ['Uma campainha da mesma cor', 'Consertar o freio', 'Nada afeta a viagem'], 'Consertar o freio protege a viagem necessária informada.', 'Decida pela consequência de adiar o pagamento.'],
    ]),
    Q('practice-02', 'practice', 'life.review-and-adjust-plan', 2, [
      ['Which amount can the plan rely on today?', 'You have 80 usable now. A contest might award 100 next month, but no result is known.', ['100', '180', '80'], 'A possible prize is not available money.', 'Separate confirmed resources from uncertain outcomes.'],
      ['¿Con qué monto cuenta el plan hoy?', 'Tienes 80 disponibles. Un concurso podría dar 100 el próximo mes, pero no se sabe el resultado.', ['100', '180', '80'], 'Un posible premio no es dinero disponible.', 'Separa los recursos confirmados de los resultados inciertos.'],
      ['Com qual valor o plano conta hoje?', 'Você tem 80 disponíveis. Um concurso pode dar 100 no próximo mês, mas o resultado não é conhecido.', ['100', '180', '80'], 'Um possível prêmio não é dinheiro disponível.', 'Separe recursos confirmados de resultados incertos.'],
    ]),
    Q('practice-03', 'practice', 'life.recurring-costs', 0, [
      ['Which plan covers the known cost?', 'A replacement filter costs 90. There are three contribution dates before replacement.', ['30 + 30 + 30', '20 + 20 + 20', '10 + 10 + 10'], 'The equal contributions prepare the full known expense.', 'Add the parts before comparing with the future cost.'],
      ['¿Qué plan cubre el costo conocido?', 'Un filtro de reemplazo cuesta 90. Hay tres fechas de aportación antes de cambiarlo.', ['30 + 30 + 30', '20 + 20 + 20', '10 + 10 + 10'], 'Las aportaciones iguales preparan el gasto conocido completo.', 'Suma las partes antes de compararlas con el costo futuro.'],
      ['Qual plano cobre o custo conhecido?', 'Um filtro de reposição custa 90. Há três datas de contribuição antes da troca.', ['30 + 30 + 30', '20 + 20 + 20', '10 + 10 + 10'], 'As contribuições iguais preparam todo o gasto conhecido.', 'Some as partes antes de comparar com o custo futuro.'],
    ]),
    Q('practice-04', 'practice', 'life.review-and-adjust-plan', 1, [
      ['What should change after cancellation?', 'An optional trip needed earnings from a canceled, unpaid shift.', ['Count the shift as received', 'Recheck the trip budget', 'Erase necessary expenses instead'], 'The trip depended on resources that are no longer expected.', 'Revisit the decision tied to the canceled receipt.'],
      ['¿Qué cambia tras la cancelación?', 'Un viaje opcional dependía de un turno extra pagado. El turno se cancela antes de pagar.', ['Contar el turno como recibido', 'Revisar si el viaje todavía cabe', 'Borrar gastos necesarios'], 'El viaje dependía de recursos que ya no se esperan.', 'Revisa la decisión ligada a la entrada cancelada.'],
      ['O que muda após o cancelamento?', 'Uma viagem opcional dependia de um turno extra pago. O turno é cancelado antes do pagamento.', ['Contar o turno como recebido', 'Rever se a viagem ainda cabe', 'Apagar gastos necessários'], 'A viagem dependia de recursos que não são mais esperados.', 'Reveja a decisão ligada à entrada cancelada.'],
    ]),
    Q('practice-05', 'practice', 'life.recurring-costs', 2, [
      ['What should stay in the plan?', 'An annual bill has a known amount and future deadline.', ['Nothing until it arrives', 'Only expenses paid today', 'Saving for that bill'], 'An infrequent bill can still be a predictable expense.', 'The date is later, but the obligation is already known.'],
      ['¿Qué debe permanecer en el plan?', 'Un recibo anual no llegará este mes, pero ya se conocen su monto y vencimiento futuro.', ['Nada, porque no es mensual', 'Solo los gastos pagados hoy', 'Una forma de preparar ese recibo'], 'Un recibo poco frecuente puede ser un gasto previsible.', 'La fecha es posterior, pero la obligación ya se conoce.'],
      ['O que deve continuar no plano?', 'Uma conta anual não chega neste mês, mas seu valor e vencimento futuro são conhecidos.', ['Nada, porque não é mensal', 'Só os gastos pagos hoje', 'Uma forma de preparar essa conta'], 'Uma conta pouco frequente pode ser um gasto previsível.', 'A data é futura, mas a obrigação já é conhecida.'],
    ]),
    Q('transfer-01', 'transfer', 'biz.needs-vs-wants', 0, [
      ['Which repair takes priority?', 'Only one repair fits: restore cooking or remove a scratch.', ['Restore the needed cooking function', 'Remove the scratch first', 'Assume both can be paid today'], 'The stated essential function determines the priority.', 'Compare consequences within the actual resource limit.'],
      ['¿Qué decisión respeta el límite indicado?', 'Solo puedes pagar una reparación hoy. La estufa no cocina; la otra reparación solo quita un rayón.', ['Recuperar la función de cocinar', 'Quitar primero el rayón', 'Suponer que ambas se pagan hoy'], 'La función necesaria indicada determina la prioridad.', 'Compara consecuencias dentro del límite real de recursos.'],
      ['Qual decisão respeita o limite informado?', 'Só pode pagar um conserto hoje. O fogão não cozinha; o outro conserto só remove um risco.', ['Recuperar a função de cozinhar', 'Remover o risco primeiro', 'Supor que ambos cabem hoje'], 'A função necessária informada define a prioridade.', 'Compare consequências dentro do limite real de recursos.'],
    ]),
  ] })];
