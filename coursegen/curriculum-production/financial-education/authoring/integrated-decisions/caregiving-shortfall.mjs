import { capstone, Q, numeric, input, subtract } from './factory.mjs';
export const caregivingShortfall = resolve => capstone(3, resolve,
  ['Care and a shortfall', 'Cuidados y faltante', 'Cuidados e falta'],
  ['Care needs belong in the plan even when income falls.', 'Las necesidades de cuidado cuentan aunque baje el ingreso.', 'As necessidades de cuidado contam mesmo quando a renda cai.'],
  'Calling a budget balanced by omitting a dependent’s necessary care or assuming every shortfall reflects optional spending.',
  skills => ({ evidence: [0, 1, 2, 1, 2, 0], segments: [
    Q('practice-01', 'practice', skills[0], 0, [
      ['What must be reserved?', 'Available funds cannot cover everything: rent, a dependent’s essential medicine, and an optional streaming renewal.', ['Rent and essential medicine', 'Rent and streaming renewal'], 'The dependent’s medicine remains an essential obligation in this scenario.', 'Optional entertainment does not replace the stated essential care.'],
      ['¿Qué debes reservar?', 'Los fondos no cubren todo: renta, medicina esencial de una persona dependiente y renovación opcional de entretenimiento.', ['Renta y medicina esencial', 'Renta y entretenimiento'], 'La medicina de la persona dependiente sigue siendo esencial aquí.', 'El entretenimiento opcional no reemplaza el cuidado esencial indicado.'],
      ['O que deve ser reservado?', 'Os recursos não cobrem tudo: aluguel, remédio essencial de um dependente e renovação opcional de entretenimento.', ['Aluguel e remédio essencial', 'Aluguel e entretenimento'], 'O remédio do dependente continua sendo essencial neste caso.', 'Entretenimento opcional não substitui o cuidado essencial informado.'],
    ]),
    numeric(Q('practice-02', 'practice', skills[1], 1, [
      ['Remaining shortfall?', 'Income is 300; essential expenses alone total 340. Optional purchases are already removed.', ['0', '40', '300'], '340 − 300 = 40 is still unfunded.', 'Removing optional purchases does not make essential expenses disappear.'],
      ['¿Faltante pendiente?', 'El ingreso es 300; solo los gastos esenciales suman 340. Ya eliminaste compras opcionales.', ['0', '40', '300'], '340 − 300 = 40 siguen sin fondos.', 'Quitar compras opcionales no hace desaparecer los gastos esenciales.'],
      ['Quanto ainda falta?', 'A renda é 300; só as despesas essenciais somam 340. Compras opcionais já foram retiradas.', ['0', '40', '300'], '340 − 300 = 40 continuam sem recursos.', 'Retirar compras opcionais não faz as despesas essenciais desaparecerem.'],
    ]), [300, 340], subtract(input(1), input(0))),
    Q('practice-03', 'practice', skills[2], 2, [
      ['What changes here?', 'During two months of care, paid hours fall and care costs rise; everything else stays unchanged.', ['Only the care costs', 'Only the paid hours', 'Both income and expenses'], 'The plan must reflect reduced earnings and increased care costs.', 'Changing just one side hides part of the caregiving impact.'],
      ['¿Qué cambia al cuidar?', 'Durante dos meses bajan las horas pagadas y suben los cuidados necesarios. Lo demás sigue igual.', ['Solo costos de cuidado', 'Solo horas pagadas', 'Ingresos y gastos'], 'El plan debe reflejar menos ingresos y más costos de cuidado.', 'Cambiar solo un lado oculta parte del efecto del cuidado.'],
      ['O que muda ao cuidar?', 'Por dois meses, caem as horas pagas e sobem os cuidados necessários. O restante fica igual.', ['Só custos de cuidado', 'Só horas pagas', 'Renda e despesas'], 'O plano deve refletir menos renda e mais custos de cuidado.', 'Mudar só um lado esconde parte do efeito dos cuidados.'],
    ]),
    Q('practice-04', 'practice', skills[1], 0, [
      ['What explains the deficit?', 'Verified essential expenses exceed confirmed income.', ['Income cannot cover essentials', 'The household bought luxuries', 'Essential costs are fully covered'], 'A verified essential-cost gap does not establish wasteful spending.', 'Use the stated costs and income; do not invent blame.'],
      ['¿Qué explica el déficit?', 'Todos los gastos restantes son necesarios y están verificados. Su total supera el ingreso confirmado del hogar.', ['El ingreso no cubre necesidades', 'El hogar compró lujos', 'Las necesidades están cubiertas'], 'Un faltante de gastos esenciales no demuestra despilfarro.', 'Usa los costos e ingresos indicados; no inventes culpas.'],
      ['O que explica o déficit?', 'Todas as despesas restantes são necessárias e verificadas. O total supera a renda confirmada da família.', ['A renda não cobre necessidades', 'A família comprou luxos', 'As necessidades estão cobertas'], 'Uma falta para despesas essenciais não comprova desperdício.', 'Use os custos e a renda informados; não invente culpa.'],
    ]),
    Q('practice-05', 'practice', skills[2], 1, [
      ['Which update is complete?', 'Care continues another month, extending reduced earnings and care costs.', ['Extend expenses only', 'Extend both changed amounts', 'Restore old income immediately'], 'Both changes continue until the stated circumstances change.', 'An earlier end date does not override the updated caregiving period.'],
      ['¿Qué ajuste está completo?', 'El cuidado termina después de lo previsto. Los ingresos reducidos y costos de cuidado continúan otro mes.', ['Extender solo los gastos', 'Extender ambos cambios', 'Restaurar ya el ingreso anterior'], 'Ambos cambios continúan hasta que cambien las circunstancias indicadas.', 'La fecha anterior no reemplaza el periodo de cuidado actualizado.'],
      ['Qual ajuste está completo?', 'Os cuidados terminam depois do previsto. A renda reduzida e os custos continuam por mais um mês.', ['Estender só as despesas', 'Estender as duas mudanças', 'Restaurar já a renda anterior'], 'As duas mudanças continuam até as circunstâncias informadas mudarem.', 'A data anterior não substitui o período de cuidado atualizado.'],
    ]),
    Q('transfer-01', 'transfer', skills[0], 2, [
      ['Which plan shows the truth?', 'A dependent’s essential transport exceeds funds; optional spending is zero and support unconfirmed.', ['Delete the transport expense', 'Count unconfirmed support', 'Keep the expense and gap'], 'Keeping the expense exposes the unresolved need for resources or arrangements.', 'A balanced-looking total cannot erase an essential unmet need.'],
      ['¿Qué plan refleja la realidad?', 'El transporte esencial de una persona dependiente supera los fondos. Sin gastos opcionales; apoyo aún sin confirmar.', ['Borrar el gasto de transporte', 'Contar apoyo sin confirmar', 'Mantener el gasto y el faltante'], 'Mantener el gasto muestra la necesidad pendiente de recursos o acuerdos.', 'Un total aparentemente equilibrado no borra una necesidad esencial pendiente.'],
      ['Qual plano mostra a realidade?', 'O transporte essencial de um dependente supera os recursos. Sem gastos opcionais; apoio ainda não confirmado.', ['Apagar o gasto de transporte', 'Contar apoio não confirmado', 'Manter o gasto e a falta'], 'Manter o gasto mostra a necessidade pendente de recursos ou acordos.', 'Um total aparentemente equilibrado não apaga uma necessidade essencial pendente.'],
    ]),
  ] }));
