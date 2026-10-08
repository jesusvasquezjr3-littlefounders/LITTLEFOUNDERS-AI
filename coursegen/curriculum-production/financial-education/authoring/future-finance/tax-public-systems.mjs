import { teach, ex, q, workedSteps } from './helpers.mjs';
import { numeric, input, subtract, add } from '../factory.mjs';
const d = 'tax-public-systems';
const multiply = (a, b) => ({ op: 'multiply', args: [a, b] });
const percent = (amount, rate) => ({ op: 'divide', args: [multiply(amount, rate), { constant: 100 }] });
const bracketProof = add(percent(input(1), input(2)), percent(subtract(input(0), input(1)), input(3)));
export const taxPublicSystems = [
teach(d,1,'Public Payments|Pagos públicos distintos|Pagamentos públicos distintos',
  'A label and purpose help you understand what a public charge is funding.|La etiqueta y el propósito ayudan a entender qué financia un cargo público.|O nome e a finalidade ajudam a entender o que uma cobrança pública financia.',
  'Every deduction or public payment is interchangeable regardless of its stated purpose.', [
  ex('example-01', 'Read the stated purpose|Lee el propósito indicado|Leia a finalidade dada', 'Here, tax funds public spending; a fee pays a specific service; a social contribution funds a named protection system.|Aquí, un impuesto financia gasto público; una cuota paga un servicio específico; una contribución social financia un sistema de protección indicado.|Aqui, imposto financia gasto público; tarifa paga um serviço específico; contribuição social financia um sistema de proteção indicado.'),
  q('guided-01', 'guided', [
    'Which label fits this example?|A fictional notice labels a required payment “tax for general public spending.”|Tax~Specific service fee~Social contribution|The notice explicitly identifies tax and its general purpose.|Use the stated label and purpose.',
    '¿Qué etiqueta corresponde?|Un aviso ficticio identifica un pago obligatorio como «impuesto para gasto público general».|Impuesto~Cuota por servicio específico~Contribución social|El aviso identifica expresamente impuesto y propósito general.|Usa la etiqueta y el propósito indicados.',
    'Qual nome corresponde?|Um aviso fictício identifica um pagamento obrigatório como “imposto para gasto público geral”.|Imposto~Tarifa por serviço específico~Contribuição social|O aviso identifica imposto e sua finalidade geral.|Use o nome e a finalidade dados.',
  ]),
  q('guided-02', 'guided', [
    'Which label fits here?|This fictional system calls payment for processing one document a “service fee.”|Service fee~General tax~Investment return|The charge is labeled for a specific document service.|Do not replace the stated purpose with another category.',
    '¿Qué etiqueta corresponde aquí?|Este sistema ficticio llama «cuota por servicio» al pago por tramitar un documento.|Cuota por servicio~Impuesto general~Rendimiento de inversión|El cargo está identificado para un servicio documental específico.|No sustituyas el propósito indicado por otra categoría.',
    'Qual nome corresponde aqui?|Este sistema fictício chama de “tarifa de serviço” o pagamento para emitir um documento.|Tarifa de serviço~Imposto geral~Rendimento de aplicação|A cobrança é identificada para um serviço específico de documento.|Não troque a finalidade dada por outra categoria.',
  ]),
  q('practice-01', 'practice', [
    'What is this payment?|A fictional statement labels a deduction “social contribution” funding its stated protection system.|Social contribution~Account maintenance fee~Investment deposit|The stated contribution funds the named social protection system.|Read the statement’s purpose, not merely the deduction amount.',
    '¿Qué pago es este?|Un estado ficticio llama «contribución social» a una deducción para su sistema de protección indicado.|Contribución social~Mantenimiento de cuenta~Depósito de inversión|La contribución indicada financia el sistema de protección nombrado.|Lee el propósito, no solo el monto deducido.',
    'Que pagamento é este?|Um extrato fictício chama de “contribuição social” um desconto para seu sistema de proteção indicado.|Contribuição social~Manutenção de conta~Depósito de aplicação|A contribuição dada financia o sistema de proteção nomeado.|Leia a finalidade, não só o valor descontado.',
  ]),
  q('practice-02', 'practice', [
    'Can the category be known?|A statement says only “deduction,” without a label or purpose.|No, request the charge description~Yes, every deduction is tax~Yes, every deduction buys insurance|A deduction alone does not identify its legal or financial purpose.|Ask what the charge actually represents.',
    '¿Puedes conocer la categoría?|Un estado solo dice «deducción», sin etiqueta ni propósito.|No, pide describir el cargo~Sí, toda deducción es impuesto~Sí, toda deducción compra seguro|Una deducción sola no identifica su propósito jurídico o financiero.|Pregunta qué representa realmente el cargo.',
    'Pode saber a categoria?|Um extrato diz só “desconto”, sem nome nem finalidade.|Não, peça a descrição da cobrança~Sim, todo desconto é imposto~Sim, todo desconto compra seguro|Um desconto sozinho não identifica sua finalidade jurídica ou financeira.|Pergunte o que a cobrança de fato representa.',
  ]),
  q('practice-03', 'practice', [
    'What should not be assumed?|A contribution funds a protection system, but eligibility conditions are not provided.|That this person automatically receives every benefit~That the payment has a stated purpose|A contribution label does not establish every benefit entitlement.|Check the applicable eligibility rules separately.',
    '¿Qué no debes suponer?|Una contribución financia protección, pero no dan condiciones de elegibilidad.|Que esa persona recibe automáticamente todo beneficio~Que el pago tiene propósito indicado|La etiqueta no establece derecho a todos los beneficios.|Verifica por separado las reglas de elegibilidad aplicables.',
    'O que não deve supor?|Uma contribuição financia proteção, mas não dão regras de acesso.|Que a pessoa recebe todo benefício automaticamente~Que o pagamento tem finalidade dada|O nome não estabelece direito a todos os benefícios.|Confira à parte as regras de acesso aplicáveis.',
  ]),
  q('transfer-01', 'transfer', [
    'Which distinction is correct?|A fictional bill lists general tax and a separate fee for issuing a permit.|Different stated purposes~Both are investment income~The fee cancels the tax|The labels identify two different purposes on the same bill.|A shared bill does not make all charges identical.',
    '¿Qué distinción es correcta?|Una cuenta ficticia lista impuesto general y una cuota aparte por emitir un permiso.|Propósitos indicados distintos~Ambos son ingresos de inversión~La cuota cancela el impuesto|Las etiquetas distinguen dos propósitos en una misma cuenta.|Compartir cuenta no vuelve iguales todos los cargos.',
    'Qual distinção é correta?|Uma conta fictícia lista imposto geral e uma tarifa separada para emitir uma licença.|Finalidades dadas distintas~Ambos são renda de aplicação~A tarifa cancela o imposto|Os nomes distinguem duas finalidades na mesma conta.|Estar na mesma conta não torna cobranças iguais.',
  ]),
]),
teach(d,2,'Withheld Tax|Retenido no es el total final|Retido não é o total final',
  'Amounts paid ahead during the year must be compared with the final calculation.|Lo pagado por adelantado durante el año debe compararse con el cálculo final.|Valores pagos por antecipação durante o ano precisam ser comparados com o cálculo final.',
  'Any tax withholding guarantees that the final tax bill is exactly settled.', [
  ex('example-01', 'Compare two totals|Compara dos totales|Compare dois totais', 'In this fictional system, withholding prepays tax. Compare that prepayment with final tax to identify a remaining amount or excess.|En este sistema ficticio, la retención adelanta impuesto. Compara el anticipo con el impuesto final para hallar faltante o exceso.|Neste sistema fictício, a retenção antecipa imposto. Compare o adiantamento com o imposto final para achar falta ou excesso.'),
  numeric(q('guided-01', 'guided', [
    'What remains payable?|Fictional final tax: 100; Already withheld: 70; No other adjustments.|30~70~100|Prepaid tax reduces the amount still payable.|Subtract withholding from the final tax.',
    '¿Qué falta pagar?|Impuesto final ficticio: 100; Ya retenido: 70; Sin otros ajustes.|30~70~100|El impuesto adelantado reduce lo pendiente de pagar.|Resta la retención del impuesto final.',
    'Quanto falta pagar?|Imposto final fictício: 100; Já retido: 70; Sem outros ajustes.|30~70~100|O imposto antecipado reduz o valor ainda a pagar.|Subtraia a retenção do imposto final.',
  ]), [100, 70], subtract(input(0), input(1))),
  q('guided-02', 'guided', [
    'What does withholding show?|A statement records tax withheld; the final calculation is incomplete.|A prepayment here~Proof nothing else is owed~Proof a refund arrived|Withholding records money paid ahead, not a completed final assessment.|Compare it with the final calculation when available.',
    '¿Qué muestra la retención?|Un comprobante registra impuesto retenido, pero falta terminar el cálculo final.|Un anticipo en este ejemplo~Prueba de que nada puede faltar~Prueba de devolución recibida|Retener registra dinero adelantado, no un cálculo final terminado.|Compáralo con el cálculo final cuando esté disponible.',
    'O que a retenção mostra?|Um comprovante registra imposto retido, mas falta concluir o cálculo final.|Um adiantamento neste exemplo~Prova de que nada pode faltar~Prova de restituição recebida|Reter registra dinheiro antecipado, não um cálculo final concluído.|Compare com o cálculo final quando estiver disponível.',
  ]),
  numeric(q('practice-01', 'practice', [
    'How much was overpaid?|Fictional withholding: 90; Final tax: 65; No other adjustments.|25~65~90|The prepayment exceeds the final tax by this amount.|Subtract final tax from the amount already paid.',
    '¿Cuánto se pagó de más?|Retención ficticia: 90; Impuesto final: 65; Sin otros ajustes.|25~65~90|El anticipo supera el impuesto final por ese monto.|Resta el impuesto final del monto ya pagado.',
    'Quanto foi pago a mais?|Retenção fictícia: 90; Imposto final: 65; Sem outros ajustes.|25~65~90|O adiantamento supera o imposto final por esse valor.|Subtraia o imposto final do valor já pago.',
  ]), [90, 65], subtract(input(0), input(1))),
  q('practice-02', 'practice', [
    'Is an expected refund spendable?|The calculation indicates excess withholding, but no refund has arrived.|Not yet, it has not been received~Yes, calculation equals cash|An expected refund is not money already available.|Separate the calculation from the actual receipt.',
    '¿Puedes gastar la devolución esperada?|El cálculo señala retención en exceso, pero no llega ninguna devolución.|Todavía no, no se recibió~Sí, calcular equivale a efectivo|Una devolución esperada no es dinero ya disponible.|Distingue el cálculo de recibir realmente el dinero.',
    'Pode gastar a restituição esperada?|O cálculo aponta retenção em excesso, mas nenhuma restituição chegou.|Ainda não, não foi recebida~Sim, calcular equivale a dinheiro|Uma restituição esperada não é dinheiro já disponível.|Separe o cálculo do recebimento real.',
  ]),
  q('practice-03', 'practice', [
    'Which record is needed?|The final tax is known, but withholding records are incomplete.|The amounts already paid or withheld~Only the income headline~Last year’s tax calculation|You need prepayments to identify the remaining balance.|Compare current tax with documented current prepayments.',
    '¿Qué registro necesitas?|Conoces el impuesto final, pero las retenciones están incompletas.|Los montos ya pagados o retenidos~Solo el ingreso anunciado~El cálculo fiscal del año pasado|Necesitas anticipos para identificar el saldo restante.|Compara impuesto actual con anticipos actuales documentados.',
    'Qual registro precisa?|Sabe o imposto final, mas os registros de retenção estão incompletos.|Os valores já pagos ou retidos~Só a renda anunciada~O cálculo fiscal do ano passado|Precisa dos adiantamentos para achar o saldo restante.|Compare imposto atual com adiantamentos atuais documentados.',
  ]),
  numeric(q('transfer-01', 'transfer', [
    'What remains after reconciliation?|Fictional final tax across all income: 140; Documented prepayments: 110; No other adjustments.|30~110~140|Documented prepayments reduce the final remaining balance.|Use total final tax, then subtract all recorded prepayments.',
    '¿Qué queda tras conciliar?|Impuesto final ficticio de todo ingreso: 140; Anticipos documentados: 110; Sin otros ajustes.|30~110~140|Los anticipos documentados reducen el saldo final restante.|Usa el impuesto final total y resta los anticipos registrados.',
    'O que resta após conferir?|Imposto final fictício de toda renda: 140; Adiantamentos documentados: 110; Sem outros ajustes.|30~110~140|Os adiantamentos documentados reduzem o saldo final restante.|Use o imposto final total e subtraia os adiantamentos registrados.',
  ]), [140, 110], subtract(input(0), input(1))),
]),
teach(d,3,'Tax Brackets|Calcula cada tramo|Calcule cada faixa',
  'A higher bracket can apply only to the next slice, not every earlier unit of income.|Una tasa superior puede aplicar solo al siguiente tramo, no a todo ingreso anterior.|Uma taxa maior pode valer só para a próxima faixa, não para toda a renda anterior.',
  'Crossing a progressive bracket applies the highest rate to all income.', [
  ex('example-01', 'Split before calculating|Divide antes de calcular|Divida antes de calcular', 'In this fictional system, each income slice has its own rate. Calculate each slice, then add the tax amounts.|En este sistema ficticio, cada tramo tiene su tasa. Calcula cada tramo y suma los impuestos resultantes.|Neste sistema fictício, cada faixa tem sua taxa. Calcule cada faixa e some os impostos resultantes.'),
  ex('example-02', 'See both slices|Mira ambos tramos|Veja ambas as faixas', 'Fictional example: first 100 at 10% owes 10; next 50 at 20% owes 10; Total tax is 20.|Ejemplo ficticio: primeros 100 al 10% deben 10; siguientes 50 al 20% deben 10; Impuesto total: 20.|Exemplo fictício: primeiros 100 a 10% devem 10; próximos 50 a 20% devem 10; Imposto total: 20.'),
  workedSteps('guided-01', ['100 × 10 ÷ 100', '40 × 20 ÷ 100', '10 + 8'], [10, 8, 18], [
    'Fictional income: 140 dollars. First 100 taxed at 10%; remaining 40 at 20%. Finish both slices.|You added the taxes on separate income slices.|The higher rate applies only above the first slice.|Tax on first slice|Tax on remaining slice|Add both taxes',
    'Ingreso ficticio: 140 pesos. Primeros 100 al 10%; restantes 40 al 20%. Completa ambos tramos.|Sumaste los impuestos de tramos separados de ingreso.|La tasa mayor solo aplica al exceso del primer tramo.|Impuesto del primer tramo|Impuesto del tramo restante|Suma ambos impuestos',
    'Renda fictícia: 140 reais. Primeiros 100 a 10%; outros 40 a 20%. Complete ambas as faixas.|Somou os impostos de faixas separadas de renda.|A taxa maior vale só acima da primeira faixa.|Imposto da primeira faixa|Imposto da faixa restante|Some ambos os impostos',
  ]),
  q('guided-02', 'guided', [
    'What receives higher rates?|A fictional rule taxes only income above its threshold at the higher rate.|Only the excess above the threshold~All earlier income too~No income at all|The stated rule assigns the higher rate only to excess.|Keep earlier and later slices separate.',
    '¿Qué recibe la tasa mayor?|Una regla ficticia grava con tasa mayor solo el ingreso que supera el límite.|Solo el exceso sobre el límite~También todo ingreso anterior~Ningún ingreso|La regla asigna tasa mayor solo al exceso.|Mantén separados los tramos anteriores y posteriores.',
    'O que recebe a taxa maior?|Uma regra fictícia taxa mais só a renda que supera o limite.|Só o excesso acima do limite~Toda a renda anterior também~Nenhuma renda|A regra atribui a taxa maior só ao excesso.|Mantenha separadas as faixas anteriores e posteriores.',
  ]),
  numeric(q('practice-01', 'practice', [
    'What is total tax?|Fictional income: 160; First 100 at 10%; excess at 20%. No other rules.|22~32~16|Each slice uses its own rate before adding taxes.|Tax the first slice and excess separately.',
    '¿Cuál es el impuesto total?|Ingreso ficticio: 160; Primeros 100 al 10%; exceso al 20%. Sin otras reglas.|22~32~16|Cada tramo usa su tasa antes de sumar impuestos.|Grava por separado el primer tramo y el exceso.',
    'Qual é o imposto total?|Renda fictícia: 160; Primeiros 100 a 10%; excesso a 20%. Sem outras regras.|22~32~16|Cada faixa usa sua taxa antes de somar impostos.|Taxe à parte a primeira faixa e o excesso.',
  ]), [160, 100, 10, 20], bracketProof),
  q('practice-02', 'practice', [
    'Which calculation breaks the rule?|The rule uses separate bracket slices. A calculator applies the top rate to the entire income.|The entire-income top-rate calculation~Calculating each slice separately|The calculator taxes earlier slices at the wrong rate.|A higher marginal rate is not a whole-income rate.',
    '¿Qué cálculo rompe la regla?|La regla usa tramos separados. Una calculadora aplica la tasa máxima a todo el ingreso.|El cálculo máximo sobre todo~Calcular cada tramo por separado|La calculadora grava tramos anteriores con tasa equivocada.|La tasa marginal mayor no grava todo el ingreso.',
    'Qual cálculo quebra a regra?|A regra usa faixas separadas. Uma calculadora aplica a maior taxa à renda inteira.|A maior taxa sobre tudo~Calcular cada faixa à parte|A calculadora taxa faixas anteriores pela taxa errada.|A maior taxa marginal não taxa toda a renda.',
  ]),
  q('practice-03', 'practice', [
    'Does the top rate describe everything?|Only one slice faces the top rate; earlier slices have lower rates.|No, all slices matter~Yes, every unit pays the top rate|The total combines different rates on different slices.|Distinguish the last slice’s rate from the overall burden.',
    '¿La tasa máxima describe todo?|Solo un tramo recibe tasa máxima; los anteriores reciben tasas menores.|No, el impuesto refleja todos los tramos~Sí, toda unidad paga la máxima|El total combina distintas tasas sobre distintos tramos.|Distingue la tasa del último tramo de la carga total.',
    'A taxa maior descreve tudo?|Só uma faixa recebe a maior taxa; as anteriores recebem taxas menores.|Não, o imposto reflete todas as faixas~Sim, toda unidade paga a maior|O total combina taxas distintas sobre faixas distintas.|Separe a taxa da última faixa da carga total.',
  ]),
  numeric(q('transfer-01', 'transfer', [
    'Compute this fictional rule|Project income: 250; First 200 at 5%; excess at 10%. No other rules.|15~25~12.5|The new thresholds still require separate slice calculations.|Use this scenario’s thresholds and rates, not earlier values.',
    'Calcula esta regla ficticia|Ingreso de proyecto: 250; Primeros 200 al 5%; exceso al 10%. Sin otras reglas.|15~25~12.5|Los nuevos límites todavía requieren calcular tramos separados.|Usa límites y tasas de esta situación, no los anteriores.',
    'Calcule esta regra fictícia|Renda de projeto: 250; Primeiros 200 a 5%; excesso a 10%. Sem outras regras.|15~25~12,5|Os novos limites ainda exigem calcular faixas separadas.|Use limites e taxas desta situação, não os anteriores.',
  ]), [250, 200, 5, 10], bracketProof),
]),
teach(d,4,'Tax Reductions|¿Reducir ingreso o impuesto?|Reduzir renda ou imposto?',
  'A deduction and a tax credit change different steps in a calculation.|Una deducción y un crédito fiscal cambian pasos distintos de un cálculo.|Uma dedução e um crédito fiscal mudam etapas distintas de um cálculo.',
  'A deduction reduces tax by its full face amount in the same way as a credit.', [
  ex('example-01', 'Keep the steps distinct|Distingue los pasos|Separe as etapas', 'In this fictional rule, a deduction reduces taxable income first. A credit reduces the calculated tax afterward.|En esta regla ficticia, una deducción reduce primero el ingreso gravable. Un crédito reduce después el impuesto calculado.|Nesta regra fictícia, uma dedução reduz primeiro a renda tributável. Um crédito reduz depois o imposto calculado.'),
  workedSteps('guided-01', ['100 − 20', '80 × 10 ÷ 100', '8 − 3'], [80, 8, 5], [
    'Fictional rule: income 100 dollars; deduction 20; tax rate 10%; credit 3; Follow the order.|The deduction changes income; the credit changes calculated tax.|Deduct from income first, then calculate tax and subtract credit.|Taxable income after deduction|Tax on reduced income|Tax after credit',
    'Regla ficticia: ingreso 100 pesos; deducción 20; tasa 10%; crédito 3; Sigue el orden.|La deducción cambia ingreso; el crédito cambia impuesto calculado.|Deduce del ingreso, calcula impuesto y resta el crédito.|Ingreso gravable tras deducción|Impuesto sobre ingreso reducido|Impuesto después del crédito',
    'Regra fictícia: renda 100 reais; dedução 20; taxa 10%; crédito 3; Siga a ordem.|A dedução muda a renda; o crédito muda o imposto.|Deduza da renda, calcule imposto e subtraia o crédito.|Renda tributável após dedução|Imposto sobre renda reduzida|Imposto após crédito',
  ]),
  q('guided-02', 'guided', [
    'Which base changes first?|The fictional rule says a deduction reduces income before tax is calculated.|Taxable income~The already-calculated tax directly|The deduction belongs before the rate calculation.|Follow the rule’s stated calculation order.',
    '¿Qué base cambia primero?|La regla ficticia dice que la deducción reduce ingreso antes de calcular impuesto.|El ingreso gravable~Directamente el impuesto ya calculado|La deducción corresponde antes del cálculo con tasa.|Sigue el orden indicado por la regla.',
    'Qual base muda primeiro?|A regra fictícia diz que a dedução reduz renda antes de calcular imposto.|A renda tributável~Diretamente o imposto já calculado|A dedução entra antes do cálculo com a taxa.|Siga a ordem dada pela regra.',
  ]),
  numeric(q('practice-01', 'practice', [
    'Tax after the deduction?|Fictional income: 200; Deduction: 50; Tax rate: 10%. No credits.|15~150~20|Tax applies to income remaining after the deduction.|Subtract the deduction, then apply the rate.',
    '¿Impuesto tras deducir?|Ingreso ficticio: 200; Deducción: 50; Tasa: 10%. Sin créditos.|15~150~20|El impuesto aplica al ingreso restante tras deducir.|Resta la deducción y aplica la tasa.',
    'Imposto após deduzir?|Renda fictícia: 200; Dedução: 50; Taxa: 10%. Sem créditos.|15~150~20|O imposto vale sobre a renda restante após deduzir.|Subtraia a dedução e aplique a taxa.',
  ]), [200, 50, 10], percent(subtract(input(0), input(1)), input(2))),
  numeric(q('practice-02', 'practice', [
    'Tax after the credit?|Fictional tax already calculated: 25; Allowed credit: 5; Subtract it directly under this rule.|20~25~5|The credit reduces the calculated tax directly here.|Subtract the credit from the tax already calculated.',
    '¿Impuesto tras el crédito?|Impuesto ficticio ya calculado: 25; Crédito permitido: 5; Esta regla lo resta directamente.|20~25~5|Aquí el crédito reduce directamente el impuesto calculado.|Resta el crédito del impuesto ya calculado.',
    'Imposto após o crédito?|Imposto fictício já calculado: 25; Crédito permitido: 5; Esta regra o subtrai diretamente.|20~25~5|Aqui o crédito reduz diretamente o imposto calculado.|Subtraia o crédito do imposto já calculado.',
  ]), [25, 5], subtract(input(0), input(1))),
  q('practice-03', 'practice', [
    'Which shortcut fails?|In this example, a deduction reduces income, but someone subtracts it directly from the final tax.|Subtracting the deduction from final tax~Reducing income before applying the rate|The shortcut puts the deduction at the credit’s step.|Identify which amount the rule says to reduce.',
    '¿Qué atajo es incorrecto?|Aquí la deducción reduce ingreso, pero alguien la resta directamente del impuesto final.|Restarla del impuesto final~Reducir ingreso antes de aplicar tasa|El atajo coloca la deducción donde corresponde el crédito.|Identifica qué monto dice reducir la regla.',
    'Qual atalho está errado?|Aqui a dedução reduz renda, mas alguém a subtrai diretamente do imposto final.|Subtraí-la do imposto final~Reduzir renda antes de aplicar taxa|O atalho coloca a dedução na etapa do crédito.|Identifique qual valor a regra manda reduzir.',
  ]),
  numeric(q('transfer-01', 'transfer', [
    'What tax remains?|Fictional rule: income 300; deduction 100; rate 10%; then credit 4; No other adjustments.|16~20~196|Apply the deduction before the rate and the credit afterward.|Reduce income, calculate tax, then reduce that tax.',
    '¿Qué impuesto queda?|Regla ficticia: ingreso 300; deducción 100; tasa 10%; luego crédito 4; Sin otros ajustes.|16~20~196|Aplica deducción antes de tasa y crédito después.|Reduce ingreso, calcula impuesto y luego reduce ese impuesto.',
    'Qual imposto resta?|Regra fictícia: renda 300; dedução 100; taxa 10%; depois crédito 4; Sem outros ajustes.|16~20~196|Aplique dedução antes da taxa e crédito depois.|Reduza renda, calcule imposto e depois reduza esse imposto.',
  ]), [300, 100, 10, 4], subtract(percent(subtract(input(0), input(1)), input(2)), input(3))),
]),
teach(d,5,'Tax Evidence|Conserva pruebas del dato|Guarde provas do dado',
  'A clear record helps explain where a declared amount came from.|Un registro claro ayuda a explicar de dónde salió un monto declarado.|Um registro claro ajuda a explicar de onde veio um valor declarado.',
  'A remembered estimate or invented receipt is equivalent to evidence supporting a declaration.', [
  ex('example-01', 'Connect amount and event|Conecta monto y hecho|Ligue valor e fato', 'Keep the dated receipt and payment proof for this fictional declaration. Together they connect the expense to the event.|Para declarar un gasto ficticio, guarda el recibo fechado y el comprobante de pago. Juntos conectan el monto con el hecho.|Para declarar uma despesa fictícia, guarde o recibo datado e a prova de pagamento. Juntos ligam o valor ao fato.'),
  q('guided-01', 'guided', [
    'Which record supports the amount?|A fictional rule requires evidence of an expense actually paid.|Dated invoice and payment record~A guessed total~An unrelated old receipt|The documents connect the expense and completed payment.|Match the record to the actual event.',
    '¿Qué registro respalda el monto?|Una regla ficticia exige pruebas de un gasto realmente pagado.|Factura fechada y registro de pago~Un total adivinado~Un recibo viejo sin relación|Los documentos conectan gasto y pago realizado.|Relaciona el registro con el hecho real.',
    'Qual registro sustenta o valor?|Uma regra fictícia exige prova de uma despesa de fato paga.|Nota datada e registro do pagamento~Um total chutado~Um recibo antigo sem ligação|Os documentos ligam despesa e pagamento feito.|Relacione o registro com o fato real.',
  ]),
  q('guided-02', 'guided', [
    'Which income record helps?|A person receives payments from several clients during the stated period.|A dated record of each receipt~Only the largest client’s message~An imagined average|A complete receipt record supports the period’s income total.|Include the relevant receipts, not a selected subset.',
    '¿Qué registro de ingreso ayuda?|Una persona recibe pagos de varios clientes durante el periodo indicado.|Un registro fechado de cada cobro~Solo el mensaje del cliente mayor~Un promedio imaginado|Un registro completo respalda el ingreso total del periodo.|Incluye los cobros pertinentes, no una selección.',
    'Qual registro de renda ajuda?|Uma pessoa recebe de vários clientes no período dado.|Um registro datado de cada recebimento~Só a mensagem do maior cliente~Uma média imaginada|Um registro completo sustenta a renda total do período.|Inclua os recebimentos pertinentes, não uma seleção.',
  ]),
  q('practice-01', 'practice', [
    'What should be checked?|A receipt belongs to a different period from the declaration being prepared.|Whether the record fits the required period~Use it because its amount is convenient|Correct amounts still need the relevant dates and context.|Match evidence to the claim’s period.',
    '¿Qué debes revisar?|Un recibo corresponde a otro periodo distinto del que se prepara para declarar.|Si el registro coincide con el periodo requerido~Usarlo porque conviene su monto|Montos correctos también necesitan fechas y contexto pertinentes.|Relaciona la prueba con el periodo declarado.',
    'O que conferir?|Um recibo pertence a outro período que não o da declaração preparada.|Se o registro cabe no período exigido~Usá-lo porque seu valor convém|Valores corretos também precisam de datas e contexto pertinentes.|Relacione a prova com o período declarado.',
  ]),
  q('practice-02', 'practice', [
    'What if records are missing?|A required invoice cannot be found, and the amount is uncertain.|Seek a genuine replacement or official guidance~Invent a matching invoice~Copy someone else’s receipt|Missing evidence calls for recovery or clarification, not fabrication.|Preserve the difference between documented and uncertain amounts.',
    '¿Y si falta un registro?|No aparece una factura requerida y el monto es incierto.|Buscar reposición auténtica u orientación oficial~Inventar una factura coincidente~Copiar un recibo ajeno|Faltar evidencia exige recuperarla o aclarar, no fabricarla.|Distingue montos documentados de montos inciertos.',
    'E se faltar registro?|Uma nota exigida sumiu e o valor é incerto.|Buscar segunda via real ou orientação oficial~Inventar uma nota igual~Copiar recibo alheio|Faltar prova pede recuperação ou esclarecimento, não fabricação.|Separe valores documentados de valores incertos.',
  ]),
  q('practice-03', 'practice', [
    'Does a receipt alone prove eligibility?|An expense was paid, but the applicable rule’s eligibility conditions are unknown.|No, evidence and eligibility differ~Yes, every receipt creates a deduction|Proof of payment does not establish every tax treatment.|Check the rule as well as the transaction evidence.',
    '¿El recibo solo prueba elegibilidad?|Un gasto se pagó, pero no se conocen condiciones de la regla aplicable.|No, prueba y elegibilidad difieren~Sí, todo recibo crea deducción|Comprobar pago no establece todo tratamiento fiscal.|Revisa la regla además de la evidencia del pago.',
    'O recibo sozinho prova direito?|Uma despesa foi paga, mas não se conhecem condições da regra aplicável.|Não, prova e direito diferem~Sim, todo recibo cria dedução|Provar pagamento não estabelece todo tratamento fiscal.|Confira a regra além da prova do pagamento.',
  ]),
  q('transfer-01', 'transfer', [
    'What supports correction?|A client payment was recorded twice. The declaration needs the true received total.|Original evidence and correction trail~An unsupported changed total~An invented receipt|The evidence explains both the receipt and why it was corrected.|Keep the correction traceable to real transactions.',
    '¿Qué archivo respalda corregir?|Registraron dos veces un pago de cliente. La declaración necesita el total realmente recibido.|Prueba original y rastro de corrección~Cambiar el total sin respaldo~Inventar un recibo nuevo|La prueba explica el cobro y por qué se corrigió.|Conserva la corrección ligada a operaciones reales.',
    'Qual arquivo sustenta corrigir?|Registraram duas vezes um pagamento de cliente. A declaração precisa do total realmente recebido.|Prova original e rastro da correção~Mudar o total sem respaldo~Inventar recibo novo|A prova explica o recebimento e por que foi corrigido.|Mantenha a correção ligada a operações reais.',
  ]),
]),
teach(d,6,'Official Rules|Usa la regla oficial pertinente|Use a regra oficial pertinente',
  'A deadline from another country or year can lead you to the wrong action.|Un plazo de otro país o año puede llevarte a una acción equivocada.|Um prazo de outro país ou ano pode levar você à ação errada.',
  'A familiar foreign deadline or a popular post establishes the current local filing obligation.', [
  ex('example-01', 'Check place, period and case|Revisa lugar, periodo y caso|Confira lugar, período e caso', 'Tax obligations depend on jurisdiction and circumstances. Consult the relevant official authority for the current period and your case.|Las obligaciones fiscales dependen del lugar y las circunstancias. Consulta su autoridad oficial para el periodo actual y tu caso.|Os deveres fiscais dependem do lugar e do caso. Consulte sua autoridade oficial para o período atual e seu caso.'),
  q('guided-01', 'guided', [
    'Which source fits?|A US federal filing question needs the current official tax guidance.|The IRS’s official current guidance~A foreign deadline repost~An undated private message|The relevant authority and period match the question.|Use the authority responsible for that tax.',
    '¿Qué fuente corresponde?|Una pregunta fiscal federal mexicana necesita orientación oficial vigente.|La orientación oficial actual del SAT~Un plazo extranjero reenviado~Un mensaje privado sin fecha|La autoridad y el periodo pertinentes coinciden con la pregunta.|Usa la autoridad responsable de ese impuesto.',
    'Qual fonte corresponde?|Uma dúvida fiscal federal brasileira precisa de orientação oficial atual.|A orientação atual da Receita Federal~Um prazo estrangeiro reenviado~Uma mensagem privada sem data|A autoridade e o período pertinentes combinam com a pergunta.|Use a autoridade responsável por esse imposto.',
  ]),
  q('guided-02', 'guided', [
    'Can this deadline be imported?|A video gives another country’s tax deadline. The learner’s obligation is local.|No, check the relevant local authority~Yes, taxes share one global deadline|Another country’s deadline does not establish the local one.|Match the jurisdiction before using a date.',
    '¿Puedes importar este plazo?|Un video da el plazo fiscal de otro país. La obligación del usuario es local.|No, consulta la autoridad local pertinente~Sí, hay un plazo mundial único|El plazo de otro país no establece el local.|Relaciona la jurisdicción antes de usar la fecha.',
    'Pode importar esse prazo?|Um vídeo dá o prazo fiscal de outro país. A obrigação da pessoa é local.|Não, consulte a autoridade local pertinente~Sim, há um prazo mundial único|O prazo de outro país não define o local.|Relacione a jurisdição antes de usar a data.',
  ]),
  q('practice-01', 'practice', [
    'What needs updating?|A saved official page concerns an earlier tax year. The current filing period is different.|The rules for the current period~Only the saved filing date|An official source can still refer to the wrong period.|Check both authority and publication scope.',
    '¿Qué debes actualizar?|Una página oficial guardada trata de un año fiscal anterior. El periodo actual es distinto.|Las reglas del periodo actual~Solo la fecha guardada|Una fuente oficial puede referirse al periodo equivocado.|Revisa autoridad y alcance temporal.',
    'O que atualizar?|Uma página oficial salva trata de um ano fiscal anterior. O período atual é outro.|As regras do período atual~Só a data salva|Uma fonte oficial pode tratar do período errado.|Confira autoridade e período abrangido.',
  ]),
  q('practice-02', 'practice', [
    'Does this page apply?|An official instruction concerns businesses. The learner is checking a different personal obligation.|Not necessarily, verify the applicable category~Yes, every official rule applies to everyone|Official rules can apply only to specified categories.|Match the person’s case to the rule’s scope.',
    '¿La página cubre este caso?|Una instrucción oficial trata de empresas. La persona revisa una obligación personal distinta.|No necesariamente, verifica la categoría aplicable~Sí, toda regla oficial aplica a todos|Las reglas oficiales pueden limitarse a categorías específicas.|Relaciona el caso con el alcance de la regla.',
    'A página cobre este caso?|Uma instrução oficial trata de empresas. A pessoa confere outro dever pessoal.|Não necessariamente, confira a categoria aplicável~Sim, toda regra oficial vale para todos|Regras oficiais podem se limitar a categorias específicas.|Relacione o caso com o alcance da regra.',
  ]),
  q('practice-03', 'practice', [
    'Which independent path?|A message claims a tax deadline and demands login through an attached link.|Reach the official site independently~Use only the attached link~Send passwords to the sender|Independent access avoids relying on a possibly false message.|Verify the notice through the authority’s own known route.',
    '¿Qué ruta es independiente?|Un mensaje afirma un plazo fiscal y exige iniciar sesión mediante un enlace adjunto.|Entrar por una ruta oficial independiente~Usar solo el enlace adjunto~Enviar contraseñas al remitente|El acceso independiente evita depender de un mensaje posiblemente falso.|Verifica el aviso por la ruta conocida de la autoridad.',
    'Qual caminho é independente?|Uma mensagem anuncia prazo fiscal e exige entrar por um link anexo.|Entrar por caminho oficial independente~Usar só o link anexo~Enviar senhas ao remetente|O acesso independente evita depender de mensagem possivelmente falsa.|Confira o aviso pelo caminho conhecido da autoridade.',
  ]),
  q('transfer-01', 'transfer', [
    'What comes first?|After moving countries, someone receives conflicting filing advice from friends.|Identify applicable jurisdictions and rules~Choose the later date~Use the easier advice|A cross-border case needs relevant official or qualified local guidance.|Do not settle jurisdiction by convenience or popularity.',
    '¿Qué resuelves primero?|Tras mudarse de país, alguien recibe consejos fiscales contradictorios de amistades de ambos lugares.|Qué jurisdicciones y reglas aplican al caso~Elegir automáticamente la fecha posterior~Usar el consejo más cómodo|Un caso transfronterizo requiere orientación oficial o local calificada pertinente.|No elijas jurisdicción por comodidad o popularidad.',
    'O que resolver primeiro?|Após mudar de país, alguém recebe conselhos fiscais opostos de amigos dos dois lugares.|Quais jurisdições e regras valem para o caso~Escolher sempre a data mais tarde~Usar o conselho mais fácil|Um caso entre países pede orientação oficial ou local qualificada.|Não escolha jurisdição por comodidade ou popularidade.',
  ]),
]),
teach(d,7,'Benefit Conditions|Revisa primero las condiciones del apoyo|Confira antes as condições do benefício',
  'A benefit mentioned in an announcement is not yet money available in your plan.|Un apoyo mencionado en un anuncio todavía no es dinero disponible en tu plan.|Um benefício citado num anúncio ainda não é dinheiro disponível no seu plano.',
  'Hearing about a benefit establishes eligibility, amount, payment date and unrestricted access.', [
  ex('example-01', 'Approval and access differ|Aprobación y acceso difieren|Aprovação e acesso diferem', 'A benefit requires eligibility checks and pays later. Do not fund tomorrow’s bill with an unconfirmed future payment.|Un apoyo exige comprobar requisitos y paga después. No cubras la cuenta de mañana con un pago futuro sin confirmar.|Um benefício exige conferir requisitos e paga depois. Não cubra a conta de amanhã com um pagamento futuro não confirmado.'),
  q('guided-01', 'guided', [
    'What must be checked?|A benefit announcement states that only eligible applicants receive it.|Whether the person meets the conditions~Only the advertised maximum~Whether friends like the program|Eligibility must be established before assuming the payment.|Read the actual access conditions.',
    '¿Qué debes verificar?|Un anuncio de apoyo dice que solo lo reciben solicitantes que cumplen requisitos.|Si la persona cumple condiciones~Solo el máximo anunciado~Si gusta el programa a amistades|Hay que establecer elegibilidad antes de suponer el pago.|Lee las condiciones reales de acceso.',
    'O que conferir?|Um anúncio de benefício diz que só recebem as pessoas que cumprem requisitos.|Se a pessoa cumpre as condições~Só o máximo anunciado~Se amigos gostam do programa|É preciso verificar o direito antes de supor o pagamento.|Leia as condições reais de acesso.',
  ]),
  q('guided-02', 'guided', [
    'Can it pay tomorrow’s bill?|A fictional benefit is approved but scheduled for next month. The bill is due tomorrow.|Not from that future payment~Yes, approval equals immediate cash|The payment date arrives after the bill deadline.|Separate approval from when money is received.',
    '¿Paga la cuenta de mañana?|Un apoyo ficticio está aprobado para el próximo mes. La cuenta vence mañana.|No con ese pago futuro~Sí, aprobar equivale a efectivo inmediato|La fecha de pago llega después del vencimiento.|Distingue aprobar de cuándo recibes dinero.',
    'Paga a conta de amanhã?|Um benefício fictício foi aprovado para o próximo mês. A conta vence amanhã.|Não com esse pagamento futuro~Sim, aprovar equivale a dinheiro imediato|A data do pagamento chega após o vencimento.|Separe aprovar de quando recebe dinheiro.',
  ]),
  q('practice-01', 'practice', [
    'Which amount belongs in the plan?|An ad states a maximum benefit, but this person’s assessed amount is lower.|The confirmed personal amount~The advertised maximum for everyone|A maximum is not each applicant’s entitlement.|Use the amount confirmed for the stated case.',
    '¿Qué monto va en el plan?|Un anuncio indica apoyo máximo, pero el monto evaluado para esta persona es menor.|El monto personal confirmado~El máximo anunciado para todos|Un máximo no es lo que corresponde a cada solicitante.|Usa el monto confirmado para el caso indicado.',
    'Qual valor entra no plano?|Um anúncio dá benefício máximo, mas o valor avaliado para esta pessoa é menor.|O valor pessoal confirmado~O máximo anunciado para todos|Um máximo não é o valor de cada pessoa.|Use o valor confirmado para o caso dado.',
  ]),
  q('practice-02', 'practice', [
    'Can this payment cover any expense?|The fictional benefit’s terms restrict it to a named service.|No, use must follow those terms~Yes, every benefit is unrestricted cash|The stated use restriction affects what the benefit can fund.|Check access and permitted use.',
    '¿Puede cubrir cualquier gasto?|Las condiciones del apoyo ficticio lo limitan a un servicio indicado.|No, el uso debe seguir condiciones~Sí, todo apoyo es efectivo sin restricción|La restricción indicada determina qué puede financiar el apoyo.|Revisa acceso y uso permitido.',
    'Pode cobrir qualquer gasto?|As regras do benefício fictício o limitam a um serviço dado.|Não, o uso deve seguir as regras~Sim, todo benefício é dinheiro livre|A restrição dada define o que o benefício pode financiar.|Confira acesso e uso permitido.',
  ]),
  q('practice-03', 'practice', [
    'What needs review after change?|A benefit depends on household circumstances that have now changed.|Whether eligibility or reporting duties change~Assume last year’s amount forever|Changed circumstances may alter the applicable conditions.|Check the official rule for the current situation.',
    '¿Qué revisas tras un cambio?|Un apoyo depende de circunstancias del hogar que ahora cambiaron.|Si cambian elegibilidad o deberes de informar~Suponer para siempre el monto anterior|Cambiar circunstancias puede alterar las condiciones aplicables.|Consulta la regla oficial para la situación actual.',
    'O que rever após mudar?|Um benefício depende de condições da casa que agora mudaram.|Se mudam o direito ou deveres de informar~Supor para sempre o valor anterior|Mudar as condições pode alterar as regras aplicáveis.|Consulte a regra oficial para a situação atual.',
  ]),
  q('transfer-01', 'transfer', [
    'Can it fund today?|A caregiver sees a program. Eligibility, timing and payment amount are unconfirmed.|Those conditions remain unresolved~The announcement is enough~Hope equals received money|Unconfirmed conditions do not establish usable money.|Verify eligibility, amount and timing before funding a commitment.',
    '¿Qué impide contar con él hoy?|Una persona cuidadora ve un programa. No confirma requisitos, tiempo de trámite ni monto.|Esas condiciones siguen sin resolver~El anuncio solo basta~El pago esperado ya se recibió|Condiciones sin confirmar no establecen dinero utilizable.|Verifica elegibilidad, monto y fecha antes de cubrir compromisos.',
    'O que impede contar com ele hoje?|Uma pessoa cuidadora vê um programa. Não confirma requisitos, prazo nem valor.|Essas condições seguem sem resolver~O anúncio sozinho basta~O pagamento esperado já chegou|Condições não confirmadas não estabelecem dinheiro utilizável.|Confira direito, valor e prazo antes de cobrir compromissos.',
  ]),
]),
teach(d,8,'Truthful Reporting|Usa reglas sin alterar hechos|Use regras sem mudar fatos',
  'Choosing a permitted treatment is different from inventing the facts needed to qualify.|Elegir un tratamiento permitido es distinto de inventar los hechos para cumplir requisitos.|Escolher um tratamento permitido é diferente de inventar os fatos para cumprir requisitos.',
  'Reducing tax justifies hiding income or fabricating an expense when a lawful benefit is unavailable.', [
  ex('example-01', 'Keep the facts true|Mantén verdaderos los hechos|Mantenha os fatos verdadeiros', 'A permitted deduction uses true qualifying expenses. Inventing a receipt changes the facts rather than choosing a lawful treatment.|Una deducción permitida usa gastos reales que cumplen requisitos. Inventar un recibo altera hechos, no elige un tratamiento permitido.|Uma dedução permitida usa gastos reais que cumprem requisitos. Inventar recibo muda fatos, não escolhe um tratamento permitido.'),
  q('guided-01', 'guided', [
    'Which follows the rule?|A fictional rule allows a documented qualifying expense to reduce taxable income.|Claim the real expense~Invent extra expenses~Hide income evidence|The claim follows the rule using genuine evidence.|Keep the facts and the permitted treatment aligned.',
    '¿Qué acción usa honestamente la regla?|Una regla ficticia permite reducir ingreso gravable por un gasto documentado que cumple requisitos.|Usar el gasto real que cumple~Inventar gasto para aumentar total~Ocultar un recibo de ingreso|La solicitud sigue la regla con evidencia auténtica.|Mantén alineados hechos y tratamiento permitido.',
    'Qual ação usa a regra honestamente?|Uma regra fictícia permite reduzir renda tributável por gasto comprovado que cumpre requisitos.|Usar o gasto real que cumpre~Inventar gasto para aumentar total~Esconder recibo de renda|O pedido segue a regra com prova real.|Mantenha fatos e tratamento permitido alinhados.',
  ]),
  q('guided-02', 'guided', [
    'Which action falsifies evidence?|Someone changes a receipt’s amount to claim more than was actually paid.|Changing the receipt’s amount~Keeping the original receipt~Asking for official clarification|The changed amount no longer represents the real transaction.|Do not alter evidence to create eligibility or expense.',
    '¿Qué acción falsifica evidencia?|Alguien cambia el monto de un recibo para declarar más de lo realmente pagado.|Cambiar el monto del recibo~Guardar el recibo original~Pedir aclaración oficial|El monto cambiado ya no representa la operación real.|No alteres evidencia para crear elegibilidad o gasto.',
    'Qual ação falsifica prova?|Alguém muda o valor de um recibo para declarar mais do que pagou.|Mudar o valor do recibo~Guardar o recibo original~Pedir esclarecimento oficial|O valor mudado já não representa a operação real.|Não altere prova para criar direito ou gasto.',
  ]),
  q('practice-01', 'practice', [
    'What should happen to an error?|A declaration draft accidentally counts the same expense twice.|Correct it using the records~Keep it because it lowers tax~Invent a second payment|Correcting the duplicate restores the true expense total.|Use evidence to repair mistakes rather than preserve advantages.',
    '¿Qué haces con el error?|Un borrador cuenta por accidente el mismo gasto dos veces.|Corregirlo con los registros~Dejarlo porque baja impuesto~Inventar un segundo pago|Corregir el duplicado recupera el total real de gastos.|Usa pruebas para reparar errores, no conservar ventajas.',
    'O que fazer com o erro?|Um rascunho conta por engano a mesma despesa duas vezes.|Corrigir com os registros~Deixar porque reduz imposto~Inventar um segundo pagamento|Corrigir a duplicação retoma o total real das despesas.|Use provas para reparar erros, não manter vantagens.',
  ]),
  q('practice-02', 'practice', [
    'Which question fits?|A person has two lawfully available treatments and truthful records.|Which permitted treatment applies best to these facts?~Which facts should I hide?~Which receipt can I fabricate?|Comparing lawful treatments does not require falsifying facts.|Ask about the rules while preserving the real records.',
    '¿Qué pregunta es legítima?|Una persona tiene dos tratamientos permitidos y registros verdaderos.|¿Qué tratamiento permitido corresponde mejor a estos hechos?~¿Qué hechos debo ocultar?~¿Qué recibo puedo fabricar?|Comparar tratamientos permitidos no exige falsificar hechos.|Pregunta por reglas conservando los registros reales.',
    'Qual pergunta é legítima?|Uma pessoa tem dois tratamentos permitidos e registros verdadeiros.|Qual tratamento permitido cabe melhor nesses fatos?~Quais fatos devo esconder?~Qual recibo posso fabricar?|Comparar tratamentos permitidos não exige falsificar fatos.|Pergunte sobre regras preservando os registros reais.',
  ]),
  q('practice-03', 'practice', [
    'Does cash erase receipt?|Income was received in cash. Someone suggests omitting it solely because no bank recorded it.|No, payment method does not erase receipt~Yes, unbanked income never happened|Cash receipt remains a fact to assess under applicable rules.|Check the rule without hiding the transaction.',
    '¿El efectivo cambia el registro?|Se recibió ingreso en efectivo. Sugieren omitirlo solo porque ningún banco lo registró.|No, cobrar así no borra el hecho~Sí, fuera del banco nunca ocurrió|Recibir efectivo sigue siendo un hecho sujeto a reglas aplicables.|Revisa la regla sin ocultar la operación.',
    'Dinheiro em espécie muda o registro?|Receberam renda em espécie. Sugerem omitir só porque nenhum banco registrou.|Não, receber assim não apaga o fato~Sim, fora do banco nunca ocorreu|Receber em espécie é um fato sujeito às regras aplicáveis.|Confira a regra sem esconder a operação.',
  ]),
  q('transfer-01', 'transfer', [
    'Which preserves true facts?|An adviser proposes a false document date to make an ineligible expense appear eligible.|Reject falsification; seek lawful guidance~Follow the suggestion~Advice permits false records|A proposed false date changes evidence rather than applying rules.|Qualified guidance should work with the actual facts.',
    '¿Qué respuesta conserva hechos verdaderos?|Un asesor propone cambiar la fecha de un documento para aparentar que un gasto cumple requisitos.|Rechazar la fecha falsa y buscar orientación legal~Cambiarla porque lo sugirieron~Suponer que asesorar permite falsificar|Una fecha falsa altera evidencia en vez de aplicar reglas.|La orientación calificada debe trabajar con hechos reales.',
    'Qual resposta preserva fatos verdadeiros?|Um assessor propõe mudar a data de um documento para fazer parecer que um gasto cumpre requisitos.|Rejeitar a data falsa e buscar orientação legal~Mudar porque sugeriram~Supor que assessorar permite falsificar|Uma data falsa altera a prova em vez de aplicar regras.|A orientação qualificada deve trabalhar com fatos reais.',
  ]),
]),
];
