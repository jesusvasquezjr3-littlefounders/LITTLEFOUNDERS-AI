import { q } from './helpers.mjs';
import { numeric, input, subtract, add } from '../factory.mjs';
const id = n => `fe-production-tax-public-systems-${String(n).padStart(2, '0')}`;
const income = 'fe-production-income-work-02';
const pct = (amount, rate) => ({ op: 'divide', args: [{ op: 'multiply', args: [amount, rate] }, { constant: 100 }] });
export const taxReviews = [{
  id: 'fe-production-tax-public-systems-review-1', primary: id(1),
  title:'Tax Calculations|Sigue el cálculo del pago público|Siga o cálculo do pagamento público',
  relevance: 'Separate the charge, the calculation and amounts already paid.|Distingue el cargo, el cálculo y los montos ya pagados.|Separe a cobrança, o cálculo e os valores já pagos.',
  outcome: 'Classify stated public charges and calculate simplified fictional brackets, credits and remaining tax.',
  misconception: 'All deductions are the same, the top rate applies to all income, and withholding always settles the final amount.',
  skills: [id(1), id(2), id(3), id(4), income, id(1)],
  segments: [
    q('practice-01', 'practice', [
      'Which charge is described?|A fictional notice labels a payment “social contribution” supporting its stated protection system.|Social contribution~Investment return~Account service fee|The label and purpose identify the stated social contribution.|Read the stated charge rather than guessing from its amount.',
      '¿Qué cargo se describe?|Un aviso ficticio llama «contribución social» al pago para su sistema de protección indicado.|Contribución social~Rendimiento de inversión~Servicio de cuenta|La etiqueta y propósito identifican la contribución social indicada.|Lee el cargo indicado sin adivinar por el monto.',
      'Qual cobrança é descrita?|Um aviso fictício chama de “contribuição social” o pagamento para seu sistema de proteção dado.|Contribuição social~Rendimento de aplicação~Serviço de conta|O nome e a finalidade identificam a contribuição social dada.|Leia a cobrança dada sem adivinhar pelo valor.',
    ]),
    numeric(q('practice-02', 'practice', [
      'What remains payable?|Fictional final tax: 120; Already withheld: 95; No other adjustments.|25~95~120|Withholding covers part of the final tax.|Subtract the amount already paid.',
      '¿Qué queda pendiente?|Impuesto final ficticio: 120; Ya retenido: 95; Sin otros ajustes.|25~95~120|La retención cubre parte del impuesto final.|Resta el monto ya pagado.',
      'Quanto falta pagar?|Imposto final fictício: 120; Já retido: 95; Sem outros ajustes.|25~95~120|A retenção cobre parte do imposto final.|Subtraia o valor já pago.',
    ]), [120, 95], subtract(input(0), input(1))),
    numeric(q('practice-03', 'practice', [
      'Calculate the fictional tax|Income: 180; First 100 at 10%; excess at 20%. No other rules.|26~36~18|Separate slice taxes add to the total.|The higher rate applies only above the threshold.',
      'Calcula el impuesto ficticio|Ingreso: 180; Primeros 100 al 10%; exceso al 20%. Sin otras reglas.|26~36~18|Los impuestos de tramos separados suman el total.|La tasa mayor solo aplica por encima del límite.',
      'Calcule o imposto fictício|Renda: 180; Primeiros 100 a 10%; excesso a 20%. Sem outras regras.|26~36~18|Os impostos de faixas separadas somam o total.|A taxa maior vale só acima do limite.',
    ]), [180, 100, 10, 20], add(pct(input(1), input(2)), pct(subtract(input(0), input(1)), input(3)))),
    numeric(q('practice-04', 'practice', [
      'What tax remains?|Fictional rule: income 200; deduction 40; rate 10%; then credit 6.|10~16~154|The deduction reduces income; the credit reduces calculated tax.|Follow the order rather than treating both reductions identically.',
      '¿Qué impuesto queda?|Regla ficticia: ingreso 200; deducción 40; tasa 10%; después crédito 6.|10~16~154|La deducción reduce ingreso; el crédito reduce impuesto calculado.|Sigue el orden sin tratar ambas reducciones igual.',
      'Qual imposto resta?|Regra fictícia: renda 200; dedução 40; taxa 10%; depois crédito 6.|10~16~154|A dedução reduz renda; o crédito reduz imposto calculado.|Siga a ordem sem tratar ambas as reduções igualmente.',
    ]), [200, 40, 10, 6], subtract(pct(subtract(input(0), input(1)), input(2)), input(3))),
    numeric(q('practice-05', 'practice', [
      'What pay is received?|Gross pay: 90; Stated deduction: 15; No other deductions.|75~90~15|The deduction reduces gross pay to money received.|Subtract the stated deduction from gross pay.',
      '¿Qué pago recibes?|Pago bruto: 90; Deducción indicada: 15; Sin otras deducciones.|75~90~15|La deducción reduce el pago bruto al dinero recibido.|Resta la deducción indicada del pago bruto.',
      'Qual pagamento recebe?|Pagamento bruto: 90; Desconto dado: 15; Sem outros descontos.|75~90~15|O desconto reduz o pagamento bruto ao dinheiro recebido.|Subtraia o desconto dado do pagamento bruto.',
    ]), [90, 15], subtract(input(0), input(1))),
    q('transfer-01', 'transfer', [
      'Which purpose belongs to the fee?|A fictional statement separates general tax from a fee specifically charged to process one permit.|The permit-processing service~Every public expense~Investment ownership|The fee is tied to the stated specific service.|Separate the labeled purposes on the same statement.',
      '¿Qué propósito tiene la cuota?|Un estado ficticio separa impuesto general de una cuota por tramitar un permiso.|El servicio de tramitar el permiso~Todo gasto público~Propiedad de inversión|La cuota corresponde al servicio específico indicado.|Distingue los propósitos etiquetados en el mismo estado.',
      'Qual finalidade tem a tarifa?|Um extrato fictício separa imposto geral de tarifa para emitir uma licença.|O serviço de emitir a licença~Todo gasto público~Propriedade de aplicação|A tarifa corresponde ao serviço específico dado.|Separe as finalidades nomeadas no mesmo extrato.',
    ]),
  ],
}, {
  id: 'fe-production-tax-public-systems-review-2', primary: id(5),
  title:'Reliable Records|Mantén confiable el registro|Mantenha o registro confiável',
  relevance: 'Use real evidence and the applicable current rule before relying on a declaration or benefit.|Usa pruebas reales y la regla vigente aplicable antes de confiar en una declaración o apoyo.|Use provas reais e a regra atual aplicável antes de confiar numa declaração ou benefício.',
  outcome: 'Choose truthful supporting records and relevant official guidance without assuming unconfirmed benefits are usable income.',
  misconception: 'Missing evidence can be replaced with invented facts or a convenient rule from another jurisdiction.',
  skills: [id(5), id(6), id(7), id(8), income, id(5)],
  segments: [
    q('practice-01', 'practice', [
      'Which record supports the claim?|A fictional expense rule needs evidence of both the charge and completed payment.|Matching dated invoice and payment record~An unrelated receipt~A remembered estimate only|Matching records connect the claimed expense to what happened.|Match the amount, date and event.',
      '¿Qué registro respalda el dato?|Una regla ficticia de gastos necesita evidencia del cargo y pago realizado.|Factura fechada y pago coincidentes~Un recibo sin relación~Solo un cálculo de memoria|Registros coincidentes conectan el gasto declarado con lo ocurrido.|Relaciona monto, fecha y hecho.',
      'Qual registro sustenta o dado?|Uma regra fictícia de despesas pede prova da cobrança e do pagamento feito.|Nota datada e pagamento correspondentes~Um recibo sem ligação~Só uma estimativa de memória|Registros correspondentes ligam a despesa declarada ao que ocorreu.|Relacione valor, data e fato.',
    ]),
    q('practice-02', 'practice', [
      'Which guidance applies?|A saved deadline is foreign and outdated. The current obligation is local.|Current relevant official guidance~The saved deadline automatically~Whichever date is latest|Jurisdiction and period must match the actual obligation.|Check who issued the rule and which period it covers.',
      '¿Qué orientación corresponde?|Un plazo guardado es extranjero y antiguo. La obligación actual es local.|Orientación oficial vigente pertinente~Automáticamente el plazo guardado~La fecha más tardía|Jurisdicción y periodo deben coincidir con la obligación real.|Revisa quién emitió la regla y qué periodo cubre.',
      'Qual orientação cabe?|Um prazo salvo é estrangeiro e antigo. O dever atual é local.|Orientação oficial atual pertinente~O prazo salvo automaticamente~A data mais tardia|Jurisdição e período devem combinar com o dever real.|Confira quem emitiu a regra e qual período cobre.',
    ]),
    q('practice-03', 'practice', [
      'Can it fund tomorrow?|An application is pending without a confirmed payment date. The bill is due tomorrow.|Not as confirmed money~Applying equals receiving~The advertised maximum is available|Pending eligibility and timing do not establish tomorrow’s cash.|Separate possible future support from confirmed usable money.',
      '¿El apoyo cubre esta cuenta?|Una solicitud está pendiente sin fecha confirmada de pago. La cuenta vence mañana.|No como dinero confirmado para mañana~Sí, solicitar equivale a recibir~Sí, está disponible el máximo anunciado|Elegibilidad y fecha pendientes no establecen efectivo para mañana.|Distingue apoyo posible de dinero utilizable confirmado.',
      'O benefício cobre esta conta?|Uma solicitação está pendente sem data confirmada de pagamento. A conta vence amanhã.|Não como dinheiro confirmado para amanhã~Sim, solicitar equivale a receber~Sim, o máximo anunciado está disponível|Direito e data pendentes não estabelecem dinheiro para amanhã.|Separe apoio possível de dinheiro utilizável confirmado.',
    ]),
    q('practice-04', 'practice', [
      'Which preserves truth?|A preparer suggests inventing an invoice to increase a deduction.|Refuse and use genuine records~Invent it if the amount is small~Assume the preparer authorizes false facts|Fabrication changes the facts rather than applying a lawful rule.|Use qualified guidance without falsifying evidence.',
      '¿Qué acción conserva la verdad?|Quien prepara propone inventar una factura para aumentar una deducción.|Rechazar y usar registros auténticos~Inventarla si el monto es pequeño~Suponer que preparar autoriza datos falsos|Fabricar cambia hechos en vez de aplicar una regla permitida.|Usa orientación calificada sin falsificar evidencia.',
      'Qual ação preserva a verdade?|Quem prepara propõe inventar uma nota para aumentar uma dedução.|Recusar e usar registros reais~Inventar se o valor for pequeno~Supor que preparar autoriza fatos falsos|Fabricar muda fatos em vez de aplicar uma regra permitida.|Use orientação qualificada sem falsificar provas.',
    ]),
    numeric(q('practice-05', 'practice', [
      'What amount is received?|Gross payment: 150; Explicit withholding: 25; No other deductions.|125~150~25|Withholding reduces the amount actually received.|Subtract the stated withholding from gross payment.',
      '¿Qué monto recibes?|Pago bruto: 150; Retención explícita: 25; Sin otras deducciones.|125~150~25|La retención reduce el monto realmente recibido.|Resta la retención indicada del pago bruto.',
      'Qual valor recebe?|Pagamento bruto: 150; Retenção explícita: 25; Sem outros descontos.|125~150~25|A retenção reduz o valor de fato recebido.|Subtraia a retenção dada do pagamento bruto.',
    ]), [150, 25], subtract(input(0), input(1))),
    q('transfer-01', 'transfer', [
      'What supports the correction?|A platform reverses a recorded client payment. The declaration total needs correction.|Keep original and reversal records~Delete every trace~Invent another expense|The reversal record explains why the income total changed.|Preserve evidence of both the original and its reversal.',
      '¿Cómo respaldas la corrección?|Una plataforma revierte un pago de cliente registrado. Debes corregir el total declarado.|Guardar registros original y de reversión~Borrar todo rastro en silencio~Inventar otro gasto|La reversión explica por qué cambió el total de ingresos.|Conserva pruebas del original y su reversión.',
      'Como sustentar a correção?|Uma plataforma reverte um pagamento de cliente registrado. Precisa corrigir o total declarado.|Guardar registros original e da reversão~Apagar todo rastro em silêncio~Inventar outra despesa|A reversão explica por que o total de renda mudou.|Guarde provas do original e da reversão.',
    ]),
  ],
}];
