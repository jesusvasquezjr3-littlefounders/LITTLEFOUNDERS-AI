import { teach, ex, q, projectionChart, workedSteps, projectBalance } from './helpers.mjs';
const d = 'retirement-future';
export const retirementFuture = [
teach(d,1,'Future Spending|Saldo y necesidades de gasto|Saldo e necessidades de gasto',
  'Knowing a future account balance is different from knowing what future living costs require.|Conocer un saldo futuro es distinto de saber qué exigirán los gastos para vivir.|Saber um saldo futuro é diferente de saber o que os gastos para viver vão exigir.',
  'A large projected balance proves that retirement spending needs are covered without stating those needs or their duration.', [
  ex('example-01', 'Stock and ongoing needs|Saldo y necesidades continuas|Saldo e necessidades contínuas', 'An account balance is one pool of money. Food, housing and care need repeated payments over an uncertain future period.|Un saldo es una reserva de dinero. Comida, vivienda y cuidados requieren pagos repetidos durante un periodo futuro incierto.|Um saldo é uma reserva de dinheiro. Comida, moradia e cuidados exigem pagamentos repetidos por um período futuro incerto.'),
  q('guided-01', 'guided', [
    'What does this figure describe?|A projection states the account’s balance on a future retirement date.|A pool available at that date~The monthly spending need~Guaranteed lifelong income|A balance is not itself a schedule of living costs.|Separate the stored amount from repeated spending.',
    '¿Qué describe esta cifra?|Una proyección indica el saldo de cuenta en una fecha futura de retiro.|Una reserva en esa fecha~La necesidad de gasto mensual~Ingreso vitalicio garantizado|Un saldo no es un calendario de gastos para vivir.|Distingue monto acumulado de gastos repetidos.',
    'O que esse valor descreve?|Uma projeção dá o saldo da conta numa data futura de aposentadoria.|Uma reserva naquela data~A necessidade de gasto mensal~Renda vitalícia garantida|Um saldo não é um calendário de gastos para viver.|Separe valor guardado de gastos repetidos.',
  ]),
  q('guided-02', 'guided', [
    'What is still missing?|A person knows a projected balance but has not estimated housing or food needs.|The future spending plan~Only the target balance~Nothing, any balance is enough|The balance cannot be judged without the spending it must support.|Identify needs before judging whether resources cover them.',
    '¿Qué falta todavía?|Una persona conoce saldo proyectado, pero no estima necesidades de vivienda ni comida.|El plan de gastos futuros~Solo el saldo objetivo~Nada, cualquier saldo basta|No puedes evaluar el saldo sin los gastos que sostendrá.|Identifica necesidades antes de juzgar si los recursos alcanzan.',
    'O que ainda falta?|Uma pessoa sabe o saldo projetado, mas não estima moradia nem comida.|O plano de gastos futuros~Só o saldo desejado~Nada, qualquer saldo basta|Não pode avaliar o saldo sem os gastos que sustentará.|Identifique necessidades antes de julgar se os recursos bastam.',
  ]),
  q('practice-01', 'practice', [
    'Which is a spending need?|A plan lists an account balance and the expected recurring housing payment.|The recurring housing payment~The account balance itself|Housing payments describe an ongoing use of money.|Look for the amount spent over time.',
    '¿Cuál es una necesidad de gasto?|Un plan lista saldo de cuenta y el pago recurrente esperado de vivienda.|El pago recurrente de vivienda~El saldo de cuenta mismo|Los pagos de vivienda describen un uso continuo del dinero.|Busca el monto gastado a lo largo del tiempo.',
    'Qual é uma necessidade de gasto?|Um plano lista saldo da conta e o pagamento recorrente esperado de moradia.|O pagamento recorrente de moradia~O saldo da conta em si|Os pagamentos de moradia descrevem uso contínuo do dinheiro.|Busque o valor gasto ao longo do tempo.',
  ]),
  q('practice-02', 'practice', [
    'Does equal balance mean equal coverage?|Two households have equal balances but different necessary spending.|No, their needs differ~Yes, equal balances cover equal lifetimes|Different spending needs change how resources support the plan.|Compare the balance with each household’s actual needs.',
    '¿Igual saldo cubre lo mismo?|Dos hogares tienen saldos iguales, pero gastos necesarios distintos.|No, sus necesidades difieren~Sí, cubren igual tiempo de vida|Necesidades distintas cambian cómo sostienen el plan los recursos.|Compara saldo con necesidades reales de cada hogar.',
    'Saldo igual cobre o mesmo?|Duas casas têm saldos iguais, mas gastos necessários distintos.|Não, suas necessidades diferem~Sim, cobrem igual tempo de vida|Necessidades distintas mudam como os recursos sustentam o plano.|Compare saldo com necessidades reais de cada casa.',
  ]),
  q('practice-03', 'practice', [
    'What should be recorded separately?|A person expects recurring public benefits and holds personal savings.|Income streams, savings and spending needs~Only one combined unlabeled number|Different resources and needs have different timing and conditions.|Keep the components visible before combining the plan.',
    '¿Qué registras por separado?|Una persona espera apoyos públicos recurrentes y tiene ahorros personales.|Flujos de ingreso, ahorro y necesidades de gasto~Solo un número combinado sin etiqueta|Recursos y necesidades distintos tienen tiempos y condiciones diferentes.|Mantén visibles los componentes antes de combinar el plan.',
    'O que registrar à parte?|Uma pessoa espera benefícios públicos recorrentes e tem poupança pessoal.|Fluxos de renda, poupança e necessidades de gasto~Só um número misturado sem nome|Recursos e necessidades distintos têm prazos e condições diferentes.|Mantenha visíveis as partes antes de juntar o plano.',
  ]),
  q('transfer-01', 'transfer', [
    'What changes?|The future balance projection is unchanged, but recurring care costs increase.|Reassess the spending plan~The balance proves coverage~Care costs disappear|A changed need alters the plan even with unchanged savings.|Compare resources with the revised needs.',
    '¿Qué cambia al necesitar cuidados?|El saldo futuro proyectado no cambia, pero suben los costos recurrentes esperados de cuidado.|Debes reevaluar el plan de gastos~El saldo solo demuestra cobertura~Los cuidados desaparecen en la proyección|Cambiar necesidades altera el plan aunque el ahorro siga igual.|Compara recursos con las necesidades revisadas.',
    'O que muda ao precisar de cuidado?|O saldo futuro projetado não muda, mas sobem os custos recorrentes esperados de cuidado.|Precisa reavaliar o plano de gastos~O saldo sozinho prova cobertura~Os cuidados somem na projeção|Mudar necessidades altera o plano mesmo com poupança igual.|Compare recursos com as necessidades revistas.',
  ]),
]),
teach(d,2,'Retirement Sources|Fuentes distintas, condiciones distintas|Fontes distintas, condições distintas',
  'Public benefits, employer arrangements and personal savings do not follow one shared set of rules.|Apoyos públicos, planes del empleador y ahorro personal no siguen una sola regla común.|Benefícios públicos, planos do empregador e poupança pessoal não seguem uma única regra comum.',
  'Every retirement resource is the same kind of immediately owned and accessible money.', [
  ex('example-01', 'Name each source|Nombra cada fuente|Nomeie cada fonte', 'Public programs, employer plans and personal savings are distinct sources. Their eligibility, ownership and access rules must be checked separately.|Programas públicos, planes del empleador y ahorro personal son fuentes distintas. Sus requisitos, propiedad y acceso se verifican por separado.|Programas públicos, planos do empregador e poupança pessoal são fontes distintas. Requisitos, propriedade e acesso precisam ser conferidos à parte.'),
  q('guided-01', 'guided', [
    'Which source is described?|A government program pays eligible people under its stated rules.|Public benefit~Personal savings withdrawal~Employer bonus automatically|The source is the public program with eligibility conditions.|Identify who provides the resource.',
    '¿Qué fuente se describe?|Un programa gubernamental paga a personas elegibles según sus reglas.|Apoyo público~Retiro de ahorro personal~Bono patronal automático|La fuente es el programa público con requisitos.|Identifica quién proporciona el recurso.',
    'Qual fonte é descrita?|Um programa do governo paga a pessoas que cumprem suas regras.|Benefício público~Saque de poupança pessoal~Bônus patronal automático|A fonte é o programa público com requisitos.|Identifique quem fornece o recurso.',
  ]),
  q('guided-02', 'guided', [
    'Which source is described?|An employer offers a retirement arrangement tied to its own documented conditions.|Employer arrangement~Universal government entitlement~Unrestricted personal cash|The arrangement comes through the employer’s stated plan.|Read the plan instead of assuming universal rules.',
    '¿Qué fuente se describe?|Un empleador ofrece un plan de retiro sujeto a sus condiciones documentadas.|Plan del empleador~Derecho gubernamental universal~Efectivo personal sin restricciones|El recurso viene mediante el plan indicado del empleador.|Lee el plan sin suponer reglas universales.',
    'Qual fonte é descrita?|Um empregador oferece um plano de aposentadoria sujeito às suas condições documentadas.|Plano do empregador~Direito governamental universal~Dinheiro pessoal sem restrições|O recurso vem pelo plano dado do empregador.|Leia o plano sem supor regras universais.',
  ]),
  q('practice-01', 'practice', [
    'Which source is a stored resource?|A person has already set aside money they own for future use.|Personal savings~An unapproved benefit application~An employer promise with unmet conditions|The savings are an existing resource owned by the person.|Separate held money from possible future entitlements.',
    '¿Qué fuente es recurso acumulado?|Una persona ya apartó dinero propio para usar después.|Ahorro personal~Solicitud de apoyo sin aprobar~Promesa patronal con requisitos incumplidos|El ahorro es un recurso existente de la persona.|Distingue dinero guardado de posibles derechos futuros.',
    'Qual fonte é recurso guardado?|Uma pessoa já separou dinheiro próprio para usar depois.|Poupança pessoal~Pedido de benefício sem aprovação~Promessa patronal com requisitos não cumpridos|A poupança é um recurso existente da pessoa.|Separe dinheiro guardado de possíveis direitos futuros.',
  ]),
  q('practice-02', 'practice', [
    'Can one rule cover all sources?|The public benefit and employer plan have different eligibility dates.|No, check each source separately~Yes, one approval unlocks everything|The sources have distinct conditions and timelines.|Match each resource with its own rules.',
    '¿Una regla cubre todas las fuentes?|El apoyo público y el plan patronal tienen fechas distintas de elegibilidad.|No, revisa cada fuente por separado~Sí, una aprobación desbloquea todo|Las fuentes tienen condiciones y tiempos distintos.|Relaciona cada recurso con sus propias reglas.',
    'Uma regra cobre todas as fontes?|O benefício público e o plano patronal têm datas distintas de acesso.|Não, confira cada fonte à parte~Sim, uma aprovação libera tudo|As fontes têm condições e prazos distintos.|Relacione cada recurso com suas próprias regras.',
  ]),
  q('practice-03', 'practice', [
    'Which gap matters?|A plan assumes employer support, but the person has no employer arrangement.|That source is absent~Personal savings automatically create it~The label makes it available|A plan cannot rely on a resource that does not exist.|List actual sources before estimating coverage.',
    '¿Qué falta importa?|Un plan de gastos supone un plan patronal, pero la persona no tiene ninguno.|La fuente supuesta no existe~El ahorro personal lo crea automáticamente~La etiqueta lo vuelve disponible|No puedes depender de un recurso que no existe.|Lista fuentes reales antes de estimar cobertura.',
    'Qual falta importa?|Um plano de gastos supõe plano patronal, mas a pessoa não tem nenhum.|A fonte suposta não existe~A poupança pessoal o cria automaticamente~O nome o torna disponível|Não pode depender de recurso que não existe.|Liste fontes reais antes de estimar cobertura.',
  ]),
  q('transfer-01', 'transfer', [
    'What should the plan use?|A self-employed person has savings and potential public eligibility, but no employer plan.|Actual sources and conditions~Invented employer contributions~Assume everything guaranteed today|Planning starts from real sources and verified conditions.|Do not assume salaried employment or an employer plan.',
    '¿Qué debe usar este plan?|Una persona independiente tiene ahorro y posible elegibilidad pública, sin plan patronal.|Esas fuentes reales y sus condiciones~Una aportación patronal inventada~Tratar todo como garantizado hoy|Planear empieza con fuentes reales y condiciones verificadas.|No supongas empleo asalariado ni plan patronal.',
    'O que esse plano deve usar?|Uma pessoa autônoma tem poupança e possível direito público, sem plano patronal.|Essas fontes reais e suas condições~Uma contribuição patronal inventada~Tratar tudo como garantido hoje|Planejar começa com fontes reais e condições verificadas.|Não suponha emprego assalariado nem plano patronal.',
  ]),
]),
teach(d,3,'Contribution Rules|Lee reglas de aportación y propiedad|Leia regras de aporte e propriedade',
  'Money shown in a workplace plan may include contributions with different ownership conditions.|El dinero mostrado en un plan laboral puede incluir aportaciones con condiciones distintas de propiedad.|O dinheiro mostrado num plano do trabalho pode incluir aportes com condições distintas de propriedade.',
  'Every employer contribution shown on a statement is already unconditionally owned and withdrawable.', [
  ex('example-01', 'Use the fictional contract|Usa el contrato ficticio|Use o contrato fictício', 'This fictional plan makes employer contributions yours only after a service condition. A displayed total does not erase that condition.|Este plan ficticio entrega aportaciones patronales solo tras cumplir antigüedad. Un total mostrado no elimina esa condición.|Este plano fictício entrega aportes patronais só após cumprir tempo de serviço. Um total exibido não elimina essa condição.'),
  q('guided-01', 'guided', [
    'Is the employer portion owned yet?|The fictional plan requires a service condition for employer contributions. The worker has not met it.|Not under the stated condition~Yes, display equals ownership|The stated ownership condition has not yet been met.|Check conditions rather than only the displayed total.',
    '¿Ya posee la parte patronal?|El plan ficticio exige una condición de antigüedad para aportaciones patronales. Aún no la cumple.|No según la condición indicada~Sí, mostrar equivale a propiedad|Todavía no se cumple la condición de propiedad indicada.|Revisa condiciones, no solo el total mostrado.',
    'Já possui a parte patronal?|O plano fictício exige tempo de serviço para aportes patronais. A pessoa ainda não cumpriu.|Não pela condição dada~Sim, exibir equivale a possuir|A condição de propriedade dada ainda não foi cumprida.|Confira condições, não só o total exibido.',
  ]),
  q('guided-02', 'guided', [
    'Which contribution rule applies?|A fictional employer matches only when the worker contributes, within a stated limit.|The conditional matching rule~An unlimited automatic payment|The employer payment depends on the stated contribution and limit.|Read both the trigger and maximum.',
    '¿Qué regla de aportación aplica?|Un empleador ficticio iguala aportaciones solo si la persona aporta, dentro de un límite indicado.|La regla condicionada de igualación~Un pago automático ilimitado|El pago patronal depende de aportar y del límite indicado.|Lee la condición y el máximo.',
    'Qual regra de aporte vale?|Um empregador fictício iguala aportes só se a pessoa aportar, dentro de um limite dado.|A regra condicionada de contrapartida~Um pagamento automático sem limite|O pagamento patronal depende do aporte e do limite dado.|Leia a condição e o máximo.',
  ]),
  q('practice-01', 'practice', [
    'Check what before leaving?|A worker may leave before meeting the fictional plan’s employer-ownership condition.|Which employer portion stays theirs~Assume all displayed money stays theirs~Only the total displayed balance|Departure timing can affect the stated conditional employer portion.|Use the plan’s actual ownership terms.',
    '¿Qué revisar antes de irse?|Una persona podría irse antes de cumplir la condición de propiedad patronal del plan ficticio.|Qué parte patronal conservaría~Suponer suyo todo monto mostrado~Solo el saldo total mostrado|La fecha de salida puede afectar la parte patronal condicionada.|Usa los términos reales de propiedad del plan.',
    'O que conferir antes de sair?|Uma pessoa pode sair antes de cumprir a condição de propriedade patronal do plano fictício.|Qual parte patronal manteria~Supor seu todo valor exibido~Só o saldo total exibido|A data de saída pode afetar a parte patronal condicionada.|Use os termos reais de propriedade do plano.',
  ]),
  q('practice-02', 'practice', [
    'Does ownership imply immediate access?|The fictional plan grants ownership but restricts withdrawals until a later condition.|No, ownership and access differ~Yes, ownership removes all restrictions|Owned funds can still have stated access restrictions.|Check withdrawal rules separately from ownership.',
    '¿Poseer implica acceso inmediato?|El plan ficticio concede propiedad, pero restringe retiros hasta otra condición posterior.|No, propiedad y acceso difieren~Sí, poseer elimina restricciones|Fondos propios aún pueden tener restricciones indicadas de acceso.|Revisa retiros por separado de propiedad.',
    'Possuir implica acesso imediato?|O plano fictício concede propriedade, mas restringe saques até outra condição futura.|Não, propriedade e acesso diferem~Sim, possuir elimina restrições|Recursos próprios ainda podem ter restrições dadas de acesso.|Confira saques à parte da propriedade.',
  ]),
  q('practice-03', 'practice', [
    'How to resolve a mismatch?|A colleague’s description contradicts the current official plan terms.|Clarify using actual documents~Copy the colleague’s arrangement~Assume all employers use identical rules|Different arrangements can have different contribution and ownership rules.|Use the person’s own applicable plan terms.',
    '¿Qué documento aclara la diferencia?|Una amistad describe el plan distinto de sus términos oficiales actuales.|Aclarar con documentos reales del plan~Copiar el plan de la amistad~Suponer reglas iguales en toda empresa|Distintos planes pueden tener reglas de aportación y propiedad diferentes.|Usa los términos aplicables del plan propio.',
    'Qual documento esclarece a diferença?|Uma amizade descreve o plano de modo distinto dos termos oficiais atuais.|Esclarecer com documentos reais do plano~Copiar o plano da amizade~Supor regras iguais em toda empresa|Planos distintos podem ter regras de aporte e propriedade diferentes.|Use os termos aplicáveis do próprio plano.',
  ]),
  q('transfer-01', 'transfer', [
    'What should be compared?|An offer shows larger employer contributions, but ownership conditions may remain unmet.|Conditions and headline amount~Only the larger amount~Assume every promise already owned|A conditional contribution is not the same as unconditional money.|Read contribution, ownership and access as separate questions.',
    '¿Qué debes comparar?|Una oferta muestra mayor aportación patronal, pero adquirirla exige condiciones que quizá no se cumplan.|Condiciones además del monto anunciado~Solo el monto mostrado mayor~Suponer propia toda promesa|Una aportación condicionada no equivale a dinero incondicional.|Lee aportación, propiedad y acceso como preguntas distintas.',
    'O que comparar?|Uma oferta mostra maior aporte patronal, mas possuí-lo exige condições que talvez não sejam cumpridas.|Condições além do valor anunciado~Só o maior valor exibido~Supor sua toda promessa|Um aporte condicionado não equivale a dinheiro incondicional.|Leia aporte, propriedade e acesso como perguntas separadas.',
  ]),
]),
teach(d,4,'Contribution Time|Tiempo para aportar|Tempo para aportar',
  'Compare fictional projections in dollars with the same assumptions; starting later leaves fewer contribution periods.|Compara proyecciones ficticias en pesos con iguales supuestos; empezar después deja menos periodos para aportar.|Compare projeções fictícias em reais com iguais hipóteses; começar depois deixa menos períodos para aportar.',
  'Starting later produces the same projected result without changing contributions, timing or assumed growth.', [
  ex('example-01', 'Read the assumptions|Lee los supuestos|Leia as hipóteses', 'Earlier deposits add contribution periods and time for assumed growth. A projection illustrates assumptions; it does not guarantee future returns.|Depósitos anteriores agregan periodos de aportación y tiempo para crecimiento supuesto. Una proyección ilustra supuestos; no garantiza rendimientos futuros.|Depósitos anteriores somam períodos de aporte e tempo para crescimento suposto. Uma projeção ilustra hipóteses; não garante rendimentos futuros.'),
  projectionChart('guided-01', 'guided', [projectBalance(100, 0.1, 3), projectBalance(100, 0.1, 3, 1)], [
    'Fictional: 100 per period; then 10% growth; no fees. Three periods; later skips the first.|Projected|Earlier|Later|Which ends higher?|Earlier contributions have more periods in this stated model.|Compare the bars under the same assumptions.',
    'Ficticio: 100 por periodo; luego crecimiento 10%; sin comisiones. Tres periodos; después omite el primero.|Proyectado|Antes|Después|¿Cuál termina mayor?|Aportar antes agrega periodos en este modelo indicado.|Compara barras bajo los mismos supuestos.',
    'Fictício: 100 por período; depois crescimento 10%; sem tarifas. Três períodos; depois pula o primeiro.|Projetado|Antes|Depois|Qual termina maior?|Aportar antes soma períodos neste modelo dado.|Compare barras sob as mesmas hipóteses.',
  ]),
  q('guided-02', 'guided', [
    'What creates the difference?|Deposits and assumed growth match; the later starter misses early periods.|Fewer deposits and less growth time~A guaranteed age penalty~Different arithmetic rules|The start date changes deposits and time in the model.|Keep assumptions fixed when interpreting the difference.',
    '¿Qué crea la diferencia?|Usan igual depósito regular y crecimiento supuesto; empezar después omite periodos iniciales.|Menos depósitos y tiempo de crecimiento~Penalización garantizada por edad~Reglas aritméticas distintas|La fecha inicial cambia depósitos y tiempo del modelo.|Mantén supuestos fijos al interpretar la diferencia.',
    'O que cria a diferença?|Usam igual aporte regular e crescimento suposto; começar depois pula períodos iniciais.|Menos aportes e tempo de crescimento~Multa garantida pela idade~Regras aritméticas distintas|A data inicial muda aportes e tempo do modelo.|Mantenha hipóteses fixas ao interpretar a diferença.',
  ]),
  projectionChart('practice-01', 'practice', [projectBalance(50, 0.1, 2), projectBalance(50, 0.1, 2, 1)], [
    'Fictional: 50 per period; then 10% growth; no fees. Two periods; later skips the first.|Projected|Earlier|Later|Which ends higher?|Starting earlier adds a deposit and its assumed growth.|Use the displayed comparison, not a promised market result.',
    'Ficticio: 50 por periodo; luego crecimiento 10%; sin comisiones. Dos periodos; después omite el primero.|Proyectado|Antes|Después|¿Cuál termina mayor?|Empezar antes agrega un depósito y su crecimiento supuesto.|Usa la comparación mostrada, no un resultado de mercado prometido.',
    'Fictício: 50 por período; depois crescimento 10%; sem tarifas. Dois períodos; depois pula o primeiro.|Projetado|Antes|Depois|Qual termina maior?|Começar antes soma um aporte e seu crescimento suposto.|Use a comparação mostrada, não um resultado de mercado prometido.',
  ]),
  q('practice-02', 'practice', [
    'Does the projection guarantee income?|The model uses constant growth even though actual investments may lose value.|No, its growth is an assumption~Yes, every modeled return must occur|An illustration cannot guarantee the assumed future path.|Separate the model from uncertain real outcomes.',
    '¿La proyección garantiza ingresos?|El modelo usa crecimiento constante aunque inversiones reales puedan perder valor.|No, su crecimiento es un supuesto~Sí, todo rendimiento modelado debe ocurrir|Una ilustración no garantiza la trayectoria futura supuesta.|Distingue el modelo de resultados reales inciertos.',
    'A projeção garante renda?|O modelo usa crescimento constante mesmo que aplicações reais possam perder valor.|Não, seu crescimento é hipótese~Sim, todo ganho modelado deve ocorrer|Uma ilustração não garante o caminho futuro suposto.|Separe o modelo de resultados reais incertos.',
  ]),
  q('practice-03', 'practice', [
    'Is this comparison controlled?|The later-start model uses much larger contributions and a different return assumption.|No, several assumptions changed~Yes, only the start date matters|Different deposits and returns prevent isolating the start-date effect.|Hold relevant assumptions constant for the stated comparison.',
    '¿La comparación está controlada?|El modelo que empieza después usa aportaciones mucho mayores y otro rendimiento supuesto.|No, cambiaron varios supuestos~Sí, solo importa la fecha inicial|Depósitos y rendimientos distintos impiden aislar el efecto del inicio.|Mantén constantes supuestos relevantes para esa comparación.',
    'A comparação está controlada?|O modelo que começa depois usa aportes muito maiores e outro ganho suposto.|Não, mudaram várias hipóteses~Sim, só importa a data inicial|Aportes e ganhos distintos impedem isolar o efeito do início.|Mantenha constantes hipóteses relevantes para essa comparação.',
  ]),
  projectionChart('transfer-01', 'transfer', [projectBalance(20, 0, 4), projectBalance(20, 0, 4, 2)], [
    'Fictional: 20 per period; no growth or fees. Four periods; later skips the first two.|Projected|Earlier|Later|Which ends higher?|More contribution periods matter even without growth in this model.|Compare the number of deposits under these changed assumptions.',
    'Ficticio: 20 por periodo; sin crecimiento ni comisiones. Cuatro periodos; después omite los primeros dos.|Proyectado|Antes|Después|¿Cuál termina mayor?|Más periodos de aportación importan incluso sin crecimiento aquí.|Compara cuántos depósitos hay bajo estos supuestos distintos.',
    'Fictício: 20 por período; sem crescimento nem tarifas. Quatro períodos; depois pula os primeiros dois.|Projetado|Antes|Depois|Qual termina maior?|Mais períodos de aporte importam mesmo sem crescimento aqui.|Compare quantos aportes há sob essas hipóteses distintas.',
  ]),
]),
teach(d,5,'Projection Fees|Comisiones en una proyección larga|Tarifas numa projeção longa',
  'Compare fictional dollar projections after their costs, while keeping future growth uncertain.|Compara proyecciones ficticias en pesos después de costos, sin dar por seguro el crecimiento futuro.|Compare projeções fictícias em reais após custos, sem dar como certo o crescimento futuro.',
  'Small recurring fees have no effect on a long-term projection, or a lower-fee projection guarantees the outcome.', [
  ex('example-01', 'Costs change the path|Los costos cambian la trayectoria|Custos mudam o caminho', 'A recurring fee removes money each period. Under equal growth assumptions, less remains to carry into the next period.|Una comisión recurrente quita dinero cada periodo. Bajo igual crecimiento supuesto, queda menos para pasar al periodo siguiente.|Uma tarifa recorrente retira dinheiro a cada período. Sob igual crescimento suposto, sobra menos para o próximo período.'),
  projectionChart('guided-01', 'guided', [projectBalance(100, 0.1, 3), projectBalance(100, 0.1, 3, 0, 5)], [
    'Fictional: deposit 100, grow 10%, then fee 0 or 5; repeat three periods.|After fees|No fee|Fee 5|Which ends higher?|The recurring fee reduces the modeled ending balance.|Both cases use the same deposits and growth assumption.',
    'Ficticio: deposita 100, crece 10%, luego comisión 0 o 5; repite tres periodos.|Tras costos|Sin comisión|Comisión 5|¿Cuál termina mayor?|La comisión recurrente reduce el saldo final modelado.|Ambos casos usan depósitos y crecimiento supuesto iguales.',
    'Fictício: deposite 100, cresça 10%, depois tarifa 0 ou 5; repita três períodos.|Após custos|Sem tarifa|Tarifa 5|Qual termina maior?|A tarifa recorrente reduz o saldo final modelado.|Ambos os casos usam aportes e crescimento suposto iguais.',
  ]),
  q('guided-02', 'guided', [
    'What also changes next period?|A fee is deducted before the next period’s assumed growth.|The balance receiving future growth~Only the statement’s appearance~Nothing beyond the current fee|Less money remains for the next period’s modeled growth.|Track the balance carried forward after costs.',
    '¿Qué cambia también después?|Se descuenta comisión antes del crecimiento supuesto del siguiente periodo.|El saldo que recibirá crecimiento futuro~Solo la apariencia del estado~Nada aparte del cargo actual|Queda menos dinero para el crecimiento modelado siguiente.|Sigue el saldo que pasa al futuro tras costos.',
    'O que também muda depois?|Uma tarifa é descontada antes do crescimento suposto do próximo período.|O saldo que recebe crescimento futuro~Só a aparência do extrato~Nada além da cobrança atual|Sobra menos dinheiro para o crescimento modelado seguinte.|Siga o saldo que passa ao futuro após custos.',
  ]),
  projectionChart('practice-01', 'practice', [projectBalance(100, 0.1, 2, 0, 5), projectBalance(100, 0.1, 2, 0, 10)], [
    'Fictional: deposit 100, grow 10%, then fee 5 or 10; repeat two periods.|After fees|Fee 5|Fee 10|Which ends higher?|The lower fee leaves more under identical stated assumptions.|Compare costs without assuming either projected result is guaranteed.',
    'Ficticio: deposita 100, crece 10%, luego comisión 5 o 10; repite dos periodos.|Tras costos|Comisión 5|Comisión 10|¿Cuál termina mayor?|La comisión menor deja más bajo iguales supuestos indicados.|Compara costos sin suponer garantizado ningún resultado proyectado.',
    'Fictício: deposite 100, cresça 10%, depois tarifa 5 ou 10; repita dois períodos.|Após custos|Tarifa 5|Tarifa 10|Qual termina maior?|A tarifa menor deixa mais sob hipóteses dadas iguais.|Compare custos sem supor garantido nenhum resultado projetado.',
  ]),
  q('practice-02', 'practice', [
    'Does a lower fee guarantee profit?|The cheaper plan still invests in assets whose value can fall.|No, market risk remains~Yes, cheap means guaranteed gains|Lower costs do not eliminate underlying investment risk.|Separate fee comparison from uncertain market performance.',
    '¿Menor comisión garantiza utilidad?|El plan más barato aún invierte en activos cuyo valor puede caer.|No, sigue el riesgo de mercado~Sí, barato garantiza ganar|Costos menores no eliminan el riesgo subyacente de inversión.|Distingue comparar comisiones de resultados de mercado inciertos.',
    'Tarifa menor garante lucro?|O plano mais barato ainda aplica em ativos cujo valor pode cair.|Não, o risco de mercado continua~Sim, barato garante ganhar|Custos menores não eliminam o risco dos ativos.|Separe comparar tarifas de resultados de mercado incertos.',
  ]),
  q('practice-03', 'practice', [
    'Is this a fee-only comparison?|One projection assumes higher growth and lower fees; another assumes both differently.|No, growth assumptions also changed~Yes, fees explain every difference|Multiple changed assumptions prevent isolating the fee effect.|Hold growth and deposits equal to compare fee effects.',
    '¿Comparas solo comisiones?|Una proyección supone mayor crecimiento y menor comisión; otra cambia ambas cosas.|No, cambió también el crecimiento supuesto~Sí, comisiones explican toda diferencia|Cambiar varios supuestos impide aislar el efecto de comisiones.|Iguala crecimiento y depósitos para comparar efectos de comisiones.',
    'Compara só tarifas?|Uma projeção supõe mais crescimento e menos tarifa; outra muda ambas as coisas.|Não, mudou também o crescimento suposto~Sim, tarifas explicam toda diferença|Mudar várias hipóteses impede isolar o efeito das tarifas.|Iguale crescimento e aportes para comparar efeitos de tarifas.',
  ]),
  projectionChart('transfer-01', 'transfer', [projectBalance(200, 0, 2), projectBalance(200, 0, 2, 0, 10)], [
    'Fictional: deposit 200, no growth, then fee 0 or 10; repeat two periods.|After fees|No fee|Fee 10|Which ends higher?|Fees reduce resources even without assumed investment growth.|Use this zero-growth model’s actual fee conditions.',
    'Ficticio: deposita 200, sin crecimiento, luego comisión 0 o 10; repite dos periodos.|Tras costos|Sin comisión|Comisión 10|¿Cuál termina mayor?|Las comisiones reducen recursos incluso sin crecimiento de inversión supuesto.|Usa las condiciones reales de este modelo sin crecimiento.',
    'Fictício: deposite 200, sem crescimento, depois tarifa 0 ou 10; repita dois períodos.|Após custos|Sem tarifa|Tarifa 10|Qual termina maior?|Tarifas reduzem recursos mesmo sem crescimento suposto do investimento.|Use as condições reais deste modelo sem crescimento.',
  ]),
]),
teach(d,6,'Retirement Risks|Precios y años son riesgos distintos|Preços e anos são riscos distintos',
  'A retirement plan can be strained by higher prices or by needing support for more years.|Un plan de retiro puede tensarse por precios mayores o por necesitar sostener más años.|Um plano de aposentadoria pode apertar por preços maiores ou por precisar sustentar mais anos.',
  'Inflation and living longer describe the same risk, or a fixed balance automatically covers both.', [
  ex('example-01', 'Two different pressures|Dos presiones distintas|Duas pressões distintas', 'Rising prices increase the cost of each year. Living longer adds years needing support, even if prices stay unchanged.|Precios crecientes elevan el costo de cada año. Vivir más añade años que sostener, incluso si los precios no cambian.|Preços maiores elevam o custo de cada ano. Viver mais soma anos para sustentar, mesmo sem mudar os preços.'),
  q('guided-01', 'guided', [
    'Which risk is described?|The same food and housing needs now cost more, while the planned number of years stays unchanged.|Inflation risk~More years of life~No budget pressure|Higher prices raise the cost of the same needs.|Identify whether prices or duration changed.',
    '¿Qué riesgo se describe?|Las mismas necesidades de comida y vivienda cuestan más; los años planeados no cambian.|Riesgo de inflación~Más años de vida~Ninguna presión presupuestaria|Precios mayores elevan el costo de las mismas necesidades.|Identifica si cambiaron precios o duración.',
    'Qual risco é descrito?|As mesmas necessidades de comida e moradia custam mais; os anos planejados não mudam.|Risco de inflação~Mais anos de vida~Nenhuma pressão no orçamento|Preços maiores elevam o custo das mesmas necessidades.|Identifique se mudaram preços ou duração.',
  ]),
  q('guided-02', 'guided', [
    'Which risk is described?|Prices stay constant, but savings must support more years than originally planned.|Longevity risk~Price inflation~A guaranteed surplus|More years require resources for a longer period.|A longer duration can matter without higher prices.',
    '¿Qué riesgo se describe?|Los precios siguen iguales, pero el ahorro debe sostener más años de los planeados.|Riesgo de longevidad~Inflación de precios~Sobrante garantizado|Más años requieren recursos durante un periodo mayor.|La duración puede importar sin precios más altos.',
    'Qual risco é descrito?|Os preços ficam iguais, mas a poupança deve sustentar mais anos que o previsto.|Risco de longevidade~Inflação de preços~Sobra garantida|Mais anos exigem recursos por um período maior.|A duração pode importar sem preços mais altos.',
  ]),
  q('practice-01', 'practice', [
    'Can both pressures occur?|A person needs more years of support while essential prices also rise.|Yes, duration and prices can both change~No, only one risk can exist|The two pressures are distinct and can occur together.|Check both annual cost and years of support.',
    '¿Pueden ocurrir ambas presiones?|Una persona necesita más años de apoyo y también suben precios indispensables.|Sí, pueden cambiar duración y precios~No, solo puede existir un riesgo|Las dos presiones son distintas y pueden coexistir.|Revisa costo anual y años que sostener.',
    'Ambas as pressões podem ocorrer?|Uma pessoa precisa de mais anos de apoio e preços essenciais também sobem.|Sim, duração e preços podem mudar~Não, só pode existir um risco|As duas pressões são distintas e podem ocorrer juntas.|Confira custo anual e anos para sustentar.',
  ]),
  q('practice-02', 'practice', [
    'What assumption needs testing?|A plan projects unchanged prices for many future years.|Whether costs could rise~Only whether account names change~That the person must live fewer years|Fixed prices are an assumption that may understate future costs.|Test the price assumption separately from duration.',
    '¿Qué supuesto debes probar?|Un plan proyecta precios sin cambios durante muchos años futuros.|Si los costos podrían subir~Solo si cambian nombres de cuenta~Que la persona deba vivir menos|Precios fijos son un supuesto que puede subestimar costos futuros.|Prueba precios por separado de duración.',
    'Qual hipótese testar?|Um plano projeta preços sem mudança por muitos anos futuros.|Se os custos podem subir~Só se mudam nomes de contas~Que a pessoa deva viver menos|Preços fixos são hipótese que pode subestimar custos futuros.|Teste preços separados da duração.',
  ]),
  q('practice-03', 'practice', [
    'Does a longer life imply higher prices?|A scenario extends the support period but explicitly holds prices constant.|No, it isolates duration risk~Yes, years automatically prove inflation|The scenario changes years, not the price of each year.|Use the stated assumptions rather than merging the risks.',
    '¿Vivir más implica precios mayores?|Una situación extiende el periodo de apoyo, pero mantiene precios explícitamente iguales.|No, aísla el riesgo de duración~Sí, los años demuestran inflación|La situación cambia años, no el precio de cada año.|Usa supuestos indicados sin mezclar riesgos.',
    'Viver mais implica preços maiores?|Uma situação amplia o período de apoio, mas mantém preços explicitamente iguais.|Não, isola o risco de duração~Sim, anos provam inflação|A situação muda anos, não o preço de cada ano.|Use hipóteses dadas sem misturar riscos.',
  ]),
  q('transfer-01', 'transfer', [
    'What remains uncertain?|Fixed income covers today’s needs. Future prices and years of support are uncertain.|Changing costs and duration~Only the current balance~Today settles the future|Today’s coverage does not establish future cost or duration coverage.|Test both pressures against the resources available.',
    '¿Qué preguntas quedan?|Un ingreso fijo cubre necesidades actuales. Precios futuros y años de apoyo son inciertos.|Cómo cambiarían costos y duración~Solo el saldo actual~Ninguna, cubrir hoy resuelve el futuro|Cubrir hoy no establece cobertura de costo o duración futuros.|Prueba ambas presiones contra recursos disponibles.',
    'Quais perguntas restam?|Uma renda fixa cobre necessidades atuais. Preços futuros e anos de apoio são incertos.|Como custos e duração mudariam~Só o saldo atual~Nenhuma, cobrir hoje resolve o futuro|Cobrir hoje não estabelece cobertura de custo ou duração futuros.|Teste ambas as pressões contra recursos disponíveis.',
  ]),
]),
teach(d,7,'Withdrawal Rules|El dinero de retiro puede estar restringido|O dinheiro da aposentadoria pode estar restrito',
  'A retirement balance is not an emergency reserve unless its access conditions fit the emergency.|Un saldo de retiro no es reserva de emergencia si sus condiciones no permiten atenderla.|Um saldo de aposentadoria não é reserva de emergência se suas condições não permitem atendê-la.',
  'Owning retirement assets means they can cover any immediate emergency without delay, tax or penalty.', [
  ex('example-01', 'Access before the deadline|Acceso antes del plazo|Acesso antes do prazo', 'A fictional retirement plan blocks early withdrawals. Its balance cannot pay an urgent repair simply because the balance is large.|Un plan ficticio de retiro bloquea retiros anticipados. Su saldo no paga una reparación urgente solo por ser grande.|Um plano fictício de aposentadoria bloqueia saques antecipados. Seu saldo não paga conserto urgente só por ser grande.'),
  q('guided-01', 'guided', [
    'Can it cover tomorrow?|The fictional retirement balance is sufficient, but withdrawals are prohibited until a later condition.|No, access is blocked~Yes, balance alone is enough|A sufficient balance cannot help before permitted access.|Check availability by the payment deadline.',
    '¿Puede cubrir mañana?|El saldo ficticio de retiro alcanza, pero prohíben retirar hasta una condición posterior.|No, el acceso está bloqueado~Sí, basta que alcance el saldo|Un saldo suficiente no ayuda antes de poder acceder.|Revisa disponibilidad antes del plazo de pago.',
    'Pode cobrir amanhã?|O saldo fictício de aposentadoria basta, mas proíbem sacar até uma condição futura.|Não, o acesso está bloqueado~Sim, basta ter saldo suficiente|Saldo suficiente não ajuda antes do acesso permitido.|Confira disponibilidade antes do prazo da conta.',
  ]),
  q('guided-02', 'guided', [
    'What amount matters?|A fictional early withdrawal is allowed only after stated charges reduce the balance.|The net amount received~The full headline balance~Only the withdrawal charge|Charges can reduce the money usable for the emergency.|Check what actually arrives after required charges.',
    '¿Qué monto importa?|Permiten un retiro anticipado ficticio solo después de cargos que reducen el saldo.|El monto neto recibido~El saldo completo anunciado~Solo el cargo por retiro|Los cargos pueden reducir dinero utilizable para la emergencia.|Revisa qué llega realmente tras cargos obligatorios.',
    'Qual valor importa?|Permitem saque antecipado fictício só após cobranças que reduzem o saldo.|O valor líquido recebido~O saldo completo anunciado~Só o encargo do saque|Cobranças podem reduzir dinheiro utilizável na emergência.|Confira o que chega de fato após cobranças obrigatórias.',
  ]),
  q('practice-01', 'practice', [
    'What needs separate planning?|A long-term account cannot be accessed quickly. The household may face urgent expenses.|An accessible emergency resource~Pretending the account unlocks~Assuming emergencies wait|Urgent needs require resources with compatible access.|Match each resource to the timing of its purpose.',
    '¿Qué necesita plan aparte?|Una cuenta de largo plazo no se puede usar rápido. El hogar puede enfrentar gastos urgentes.|Un recurso de emergencia accesible~Fingir que se libera la cuenta~Suponer que emergencias esperan|Necesidades urgentes requieren recursos con acceso compatible.|Relaciona cada recurso con el tiempo de su propósito.',
    'O que precisa de plano separado?|Uma conta de longo prazo não pode ser usada rápido. A casa pode ter gastos urgentes.|Um recurso de emergência acessível~Fingir que a conta libera~Supor que emergências esperam|Necessidades urgentes exigem recursos com acesso compatível.|Relacione cada recurso com o prazo da sua finalidade.',
  ]),
  q('practice-02', 'practice', [
    'Can another person’s rule be assumed?|A friend can withdraw from their retirement product. This person has a different contract.|No, check this contract’s rules~Yes, every retirement product is identical|Different products can have different access conditions.|Use the applicable account terms.',
    '¿Puedes suponer la regla ajena?|Una amistad puede retirar de su producto de retiro. Esta persona tiene otro contrato.|No, revisa reglas de este contrato~Sí, todos los productos son idénticos|Productos distintos pueden tener condiciones de acceso diferentes.|Usa los términos de la cuenta aplicable.',
    'Pode supor a regra alheia?|Uma amizade pode sacar de seu produto de aposentadoria. Esta pessoa tem outro contrato.|Não, confira regras deste contrato~Sim, todos os produtos são iguais|Produtos distintos podem ter condições de acesso diferentes.|Use os termos da conta aplicável.',
  ]),
  q('practice-03', 'practice', [
    'What does ownership settle?|The person legally owns the balance, but withdrawal conditions are still unmet.|Ownership, not immediate access~Every withdrawal condition disappears|Owned assets can still have restrictions on use.|Separate owning money from accessing it now.',
    '¿Qué resuelve ser propietario?|La persona posee legalmente el saldo, pero no cumple condiciones de retiro.|Propiedad, no acceso inmediato~Desaparecen todas las condiciones|Activos propios aún pueden tener restricciones de uso.|Distingue poseer dinero de acceder ahora.',
    'O que possuir resolve?|A pessoa possui legalmente o saldo, mas não cumpre condições de saque.|Propriedade, não acesso imediato~Somem todas as condições|Ativos próprios ainda podem ter restrições de uso.|Separe possuir dinheiro de acessá-lo agora.',
  ]),
  q('transfer-01', 'transfer', [
    'Does access fit?|Care costs are due this week. The stated retirement withdrawal process takes months.|No, access comes late~The retirement label is enough~The need automatically changes terms|The resource’s release comes after the stated need.|Use actual access conditions rather than the account label.',
    '¿El recurso corresponde?|Una persona cuidadora necesita fondos esta semana. Según condiciones, retirar del plan de retiro toma meses.|No, el acceso llega tarde~Sí, se llama ahorro de retiro~La necesidad cambia términos automáticamente|La liberación del recurso llega después de la necesidad.|Usa acceso real, no la etiqueta de cuenta.',
    'O recurso serve?|Uma pessoa cuidadora precisa de recursos nesta semana. Pelos termos, sacar do plano de aposentadoria leva meses.|Não, o acesso chega tarde~Sim, chama poupança de aposentadoria~A necessidade muda termos automaticamente|A liberação do recurso chega após a necessidade.|Use acesso real, não o nome da conta.',
  ]),
]),
teach(d,8,'Return Order|Importa el orden de rendimientos|A ordem dos rendimentos importa',
  'Withdrawals during early losses can leave less money to participate in a later recovery.|Retirar durante pérdidas tempranas puede dejar menos dinero para participar en una recuperación posterior.|Sacar durante perdas iniciais pode deixar menos dinheiro para participar de uma recuperação posterior.',
  'The same set of returns always produces the same retirement result even when money is withdrawn between them.', [
  ex('example-01', 'Loss, withdrawal, recovery|Pérdida, retiro, recuperación|Perda, saque, recuperação', 'A loss shrinks the balance. A withdrawal shrinks it further, leaving less money for a later recovery to grow.|Una pérdida reduce el saldo. Un retiro lo reduce más, dejando menos dinero para crecer en una recuperación posterior.|Uma perda reduz o saldo. Um saque o reduz mais, deixando menos dinheiro para crescer numa recuperação posterior.'),
  workedSteps('guided-01', ['100 × 80 ÷ 100', '80 − 10', '70 × 125 ÷ 100', '87.5 − 10'], [80, 70, 87.5, 77.5], [
    'Fictional: start 100 dollars; lose 20%, withdraw 10; gain 25%, withdraw 10. No fees.|Withdrawals leave less balance for the later recovery.|Apply each return before its stated withdrawal.|Balance after early loss|First withdrawal|Later recovery on remaining money|Second withdrawal',
    'Ficticio: inicia 100 pesos; pierde 20%, retira 10; gana 25%, retira 10. Sin comisiones.|Los retiros dejan menos saldo para la recuperación posterior.|Aplica cada rendimiento antes de su retiro indicado.|Saldo tras pérdida inicial|Primer retiro|Recuperación sobre dinero restante|Segundo retiro',
    'Fictício: comece 100 reais; perca 20%, saque 10; ganhe 25%, saque 10. Sem tarifas.|Os saques deixam menos saldo para a recuperação posterior.|Aplique cada rendimento antes do saque dado.|Saldo após perda inicial|Primeiro saque|Recuperação sobre dinheiro restante|Segundo saque',
  ]),
  q('guided-02', 'guided', [
    'What receives the later recovery?|A loss is followed by a withdrawal before the next positive return.|The smaller remaining balance~The original untouched balance~The money already spent|Only money still invested participates in that later return.|Track the balance after both the loss and withdrawal.',
    '¿Qué recibe la recuperación posterior?|Una pérdida va seguida de un retiro antes del siguiente rendimiento positivo.|El saldo restante menor~El saldo original intacto~El dinero ya gastado|Solo el dinero aún invertido participa del rendimiento posterior.|Sigue saldo tras pérdida y retiro.',
    'O que recebe a recuperação depois?|Uma perda é seguida de saque antes do próximo rendimento positivo.|O saldo restante menor~O saldo original intacto~O dinheiro já gasto|Só o dinheiro ainda aplicado participa do rendimento posterior.|Siga o saldo após perda e saque.',
  ]),
  q('practice-01', 'practice', [
    'Can order matter with withdrawals?|Two models use the same returns in opposite order and withdraw between periods.|Yes, withdrawals change the balance path~No, ordering never matters|Withdrawals interact with the balance left by earlier returns.|Check when money leaves, not only the listed returns.',
    '¿Puede importar el orden con retiros?|Dos modelos usan iguales rendimientos en orden opuesto y retiran entre periodos.|Sí, los retiros cambian la trayectoria~No, ordenar nunca importa|Los retiros interactúan con el saldo dejado por rendimientos anteriores.|Revisa cuándo sale dinero, no solo rendimientos listados.',
    'A ordem pode importar com saques?|Dois modelos usam iguais rendimentos em ordem oposta e sacam entre períodos.|Sim, saques mudam o caminho do saldo~Não, a ordem nunca importa|Saques interagem com o saldo deixado pelos ganhos anteriores.|Confira quando sai dinheiro, não só rendimentos listados.',
  ]),
  q('practice-02', 'practice', [
    'What does an average omit?|A withdrawal plan uses only an average return, ignoring when losses occur.|The sequence around withdrawals~Only the account name~Nothing important can be omitted|An average hides the order affecting withdrawn portfolios.|Inspect the timing of returns and spending.',
    '¿Qué omite un promedio?|Un plan de retiros usa solo rendimiento promedio e ignora cuándo ocurren pérdidas.|La secuencia alrededor de retiros~Solo el nombre de cuenta~Nada importante puede faltar|Un promedio oculta el orden que afecta carteras con retiros.|Inspecciona tiempos de rendimientos y gastos.',
    'O que a média omite?|Um plano de saques usa só rendimento médio e ignora quando ocorrem perdas.|A sequência perto dos saques~Só o nome da conta~Nada importante pode faltar|Uma média esconde a ordem que afeta carteiras com saques.|Inspecione prazos de rendimentos e gastos.',
  ]),
  q('practice-03', 'practice', [
    'Does a later rebound erase withdrawals?|An investor spends withdrawn money after a loss. The remaining investment later rises.|No, spent money no longer participates~Yes, every rebound restores all spending|Recovery applies to the remaining investment, not money already spent.|Keep withdrawn money out of the later invested balance.',
    '¿Un repunte borra los retiros?|Se gasta dinero retirado después de perder. La inversión restante después sube.|No, el dinero gastado ya no participa~Sí, todo repunte restaura los gastos|Recuperar aplica a la inversión restante, no al dinero gastado.|Excluye dinero retirado del saldo invertido posterior.',
    'Uma recuperação apaga os saques?|Gastam dinheiro sacado depois de perder. A aplicação restante depois sobe.|Não, dinheiro gasto já não participa~Sim, toda recuperação repõe os gastos|Recuperar vale para a aplicação restante, não para dinheiro gasto.|Exclua dinheiro sacado do saldo aplicado depois.',
  ]),
  q('transfer-01', 'transfer', [
    'Which scenario deserves a stress test?|Essential withdrawals begin just as the portfolio falls sharply.|Early losses combined with required withdrawals~Only the long-run average~Assume recovery arrives before bills|Early losses and withdrawals can jointly strain the plan.|Test the sequence rather than relying only on averages.',
    '¿Qué situación debes probar?|Empiezan retiros indispensables justo cuando la cartera cae fuertemente.|Pérdidas iniciales junto con retiros necesarios~Solo el promedio a largo plazo~Suponer recuperación antes de las cuentas|Pérdidas iniciales y retiros pueden tensionar juntos el plan.|Prueba la secuencia sin depender solo de promedios.',
    'Qual situação deve testar?|Começam saques essenciais justo quando a carteira cai muito.|Perdas iniciais junto com saques necessários~Só a média de longo prazo~Supor recuperação antes das contas|Perdas iniciais e saques podem apertar juntos o plano.|Teste a sequência sem depender só de médias.',
  ]),
]),
teach(d,9,'Adjust Contributions|Ajusta aportaciones si cambia el ingreso|Ajuste aportes se a renda mudar',
  'A long-term contribution plan must still fit the essential payments due now.|Un plan de aportaciones a largo plazo debe seguir siendo compatible con los pagos indispensables actuales.|Um plano de aportes de longo prazo ainda precisa caber nos pagamentos essenciais de agora.',
  'Maintaining the original contribution at any cost is always preferable to reassessing changed income and essential obligations.', [
  ex('example-01', 'Recheck the available amount|Revisa el monto disponible|Confira o valor disponível', 'Income falls but essentials remain due. Recalculate available money before maintaining a contribution that would leave those payments uncovered.|Baja el ingreso, pero lo indispensable sigue pendiente. Recalcula dinero disponible antes de mantener una aportación que deje pagos descubiertos.|A renda cai, mas o essencial continua devido. Recalcule dinheiro disponível antes de manter um aporte que deixe contas descobertas.'),
  q('guided-01', 'guided', [
    'What comes first?|Income drops. The old retirement contribution leaves tomorrow’s necessary food payment uncovered.|Recalculate and revise contributions~Keep contributing despite the gap~Ignore food costs|The contribution must fit actual resources and essential obligations.|Protect the stated immediate need while reassessing the plan.',
    '¿Qué debe pasar primero?|Baja el ingreso. La aportación anterior dejaría sin cubrir comida necesaria de mañana.|Recalcular y revisar el plan de aportación~Seguir aportando pese al faltante~Ignorar el pago de comida|La aportación debe caber en recursos y obligaciones indispensables reales.|Protege la necesidad inmediata indicada al revisar el plan.',
    'O que fazer primeiro?|A renda cai. O aporte antigo deixaria sem cobertura a comida necessária de amanhã.|Recalcular e rever o plano de aporte~Seguir aportando apesar da falta~Ignorar o pagamento da comida|O aporte precisa caber nos recursos e deveres essenciais reais.|Proteja a necessidade imediata dada ao rever o plano.',
  ]),
  q('guided-02', 'guided', [
    'Which income belongs in the revision?|A lower payment has arrived; an extra contract payment is only hoped for.|Confirmed available income~Both as if already received~Last year’s larger income|An unconfirmed receipt cannot support a fixed current commitment.|Plan from received or reliably confirmed resources and timing.',
    '¿Qué ingreso entra en la revisión?|Llegó un pago menor; solo se espera conseguir un contrato extra.|Ingreso disponible confirmado~Ambos como si ya llegaran~El ingreso mayor del año pasado|Un cobro sin confirmar no sostiene un compromiso actual fijo.|Planea con recursos y fechas recibidos o confirmados confiablemente.',
    'Qual renda entra na revisão?|Chegou um pagamento menor; só se espera conseguir um contrato extra.|Renda disponível confirmada~Ambos como se já chegaram~A renda maior do ano passado|Recebimento não confirmado não sustenta compromisso atual fixo.|Planeje com recursos e prazos recebidos ou confirmados de modo confiável.',
  ]),
  q('practice-01', 'practice', [
    'Check what before changing?|Reducing contributions could affect a workplace plan’s conditions.|Its matching and access terms~Assume every change is free~Assume changes are forbidden everywhere|The plan’s terms can affect the consequences of an adjustment.|Review conditions while checking affordability.',
    '¿Qué revisas antes de cambiar?|Un plan patronal tiene condiciones que podrían cambiar al reducir la aportación.|Sus términos reales de aportación y acceso~Suponer que todo cambio es gratis~Suponer cambios prohibidos en todas partes|Los términos del plan pueden afectar consecuencias del ajuste.|Revisa condiciones mientras compruebas capacidad de pago.',
    'O que conferir antes de mudar?|Um plano patronal tem condições que podem mudar ao reduzir o aporte.|Seus termos reais de aporte e acesso~Supor que toda mudança é grátis~Supor mudanças proibidas em todo lugar|Os termos do plano podem afetar consequências do ajuste.|Confira condições enquanto verifica se cabe no orçamento.',
  ]),
  q('practice-02', 'practice', [
    'What follows when income recovers?|The temporary income reduction ends and current essentials are covered.|Review the contribution plan again~Never revisit the reduced amount~Automatically ignore new obligations|A changed income can justify another deliberate review.|Use the new resources and obligations together.',
    '¿Qué sigue si se recupera el ingreso?|Termina la reducción temporal y lo indispensable actual está cubierto.|Revisar otra vez el plan de aportación~Nunca revisar el monto reducido~Ignorar automáticamente obligaciones nuevas|Cambiar el ingreso puede justificar otra revisión deliberada.|Usa juntos los recursos y obligaciones nuevos.',
    'O que fazer se a renda se recuperar?|Termina a redução temporária e o essencial atual está coberto.|Rever de novo o plano de aporte~Nunca rever o valor reduzido~Ignorar automaticamente novos deveres|Mudar a renda pode justificar outra revisão com critério.|Use juntos os novos recursos e deveres.',
  ]),
  q('practice-03', 'practice', [
    'Does this fix the gap?|Someone borrows at high stated cost to maintain an unaffordable voluntary contribution.|It adds debt to assess~It creates free money~It erases affordability problems|Borrowing adds repayment obligations rather than removing the resource gap.|Compare debt consequences with the revised budget.',
    '¿Esto arregla el faltante?|Piden prestado a costo alto indicado solo para mantener una aportación voluntaria que ya no alcanza.|Agrega deuda que debe evaluarse~Crea dinero gratis~Elimina el problema de capacidad|Pedir prestado agrega pagos en vez de eliminar el faltante.|Compara consecuencias de deuda con el presupuesto revisado.',
    'Isso resolve a falta?|Pegam empréstimo com custo alto dado só para manter um aporte voluntário que já não cabe.|Soma dívida que deve ser avaliada~Cria dinheiro grátis~Elimina o problema de recursos|Pegar emprestado soma pagamentos em vez de eliminar a falta.|Compare consequências da dívida com o orçamento revisto.',
  ]),
  q('transfer-01', 'transfer', [
    'Which revision fits?|Caregiving reduces income. Care and housing remain essential; contributions are adjustable.|Protect essentials, then recalculate contributions~Use imaginary income~Automatically call care optional|The new plan must reflect reduced resources and actual needs.|Use the changed situation rather than the old income pattern.',
    '¿Qué revisión corresponde?|Cuidar a alguien reduce trabajo pagado. Siguen cuidado y vivienda indispensables; las aportaciones son ajustables.|Recalcular aportaciones tras proteger pagos indispensables~Mantener el monto con ingresos imaginarios~Tratar cuidado como opcional automáticamente|El nuevo plan debe reflejar menos recursos y necesidades reales.|Usa la situación cambiada, no el ingreso anterior.',
    'Qual revisão cabe?|Cuidar de alguém reduz trabalho pago. Cuidados e moradia seguem essenciais; os aportes podem ser ajustados.|Recalcular aportes após proteger pagamentos essenciais~Manter o valor com renda imaginária~Tratar cuidado como opcional automaticamente|O novo plano deve refletir menos recursos e necessidades reais.|Use a situação mudada, não a renda antiga.',
  ]),
]),
teach(d,10,'Review Beneficiaries|Revisa personas y registros|Confira pessoas e registros',
  'A major life change can make account contacts and beneficiary records outdated.|Un cambio importante de vida puede desactualizar contactos y registros de beneficiarios.|Uma grande mudança de vida pode deixar contatos e registros de beneficiários desatualizados.',
  'A marriage, separation or death automatically updates every financial account and beneficiary designation.', [
  ex('example-01', 'Change the record deliberately|Actualiza deliberadamente el registro|Atualize o registro com cuidado', 'After major life changes, check beneficiaries and contacts through the provider’s official process. Verify legal effects locally.|Tras un cambio importante, revisa beneficiarios y contactos mediante el proceso oficial del proveedor. Verifica localmente sus efectos legales.|Após grande mudança, confira beneficiários e contatos pelo processo oficial do prestador. Verifique localmente seus efeitos legais.'),
  q('guided-01', 'guided', [
    'What needs review?|A retirement account still lists an outdated contact after a household change.|The account’s contact record~Only its displayed investment gain~Nothing can be updated|Outdated contacts can impair account communication and administration.|Check the relevant personal records.',
    '¿Qué debes revisar?|Una cuenta de retiro sigue indicando contacto antiguo tras un cambio del hogar.|El registro de contacto de cuenta~Solo la ganancia de inversión mostrada~Nada puede actualizarse|Contactos antiguos pueden dificultar comunicación y administración de cuenta.|Revisa los registros personales pertinentes.',
    'O que conferir?|Uma conta para o futuro ainda mostra contato antigo após mudança na família.|O contato da conta~Só o ganho exibido~Nada pode ser mudado|Contatos antigos podem impedir avisos de chegar à pessoa certa.|Confira os dados de contato.',
  ]),
  q('guided-02', 'guided', [
    'Does separation update every form?|A person separates from a partner but has not checked any beneficiary records.|No, review the actual records and rules~Yes, all providers change automatically|A life event does not prove every designation was updated.|Check the provider’s process and applicable local rules.',
    '¿Un cambio actualiza todo formulario?|Una persona se separa, pero no revisa ningún registro de beneficiarios.|No, revisa registros y reglas reales~Sí, todo proveedor cambia automáticamente|Un evento de vida no prueba que toda designación se actualizara.|Consulta proceso del proveedor y reglas locales aplicables.',
    'Mudar de vida muda toda ficha?|Uma pessoa se separa, mas não confere quem consta para receber seus recursos.|Não, confira fichas e regras reais~Sim, tudo muda por si só|Mudar de vida não prova que os nomes nas fichas mudaram.|Confira o processo da conta e a regra local.',
  ]),
  q('practice-01', 'practice', [
    'How to confirm an update?|Someone requests a beneficiary change through the verified provider process.|Keep confirmation; check the record~An unsent note suffices~Send passwords to strangers|Confirmation connects the request with the account’s actual record.|Verify completion rather than merely intending the change.',
    '¿Qué ruta confirma actualizar?|Una persona solicita cambiar beneficiario por el proceso verificado del proveedor.|Guardar confirmación y revisar registro actualizado~Suponer que basta una nota sin enviar~Enviar contraseñas a un desconocido|La confirmación conecta la solicitud con el registro real.|Verifica que terminó, no solo la intención de cambiar.',
    'Como saber se mudou?|Uma pessoa pede mudar quem recebe os recursos pelo processo oficial da conta.|Guardar a prova e conferir a ficha~Basta anotar sem enviar~Enviar senhas a um estranho|A prova liga o pedido à ficha real da conta.|Confira se o pedido foi de fato concluído.',
  ]),
  q('practice-02', 'practice', [
    'Does one account update all others?|A beneficiary change is confirmed for one of several separate accounts.|No, check each relevant account~Yes, all accounts share the same record|Separate accounts can maintain separate designations.|Review the complete account list.',
    '¿Actualizar una cuenta cambia las otras?|Confirman cambio de beneficiario en una de varias cuentas separadas.|No, revisa cada cuenta pertinente~Sí, todas comparten el mismo registro|Cuentas separadas pueden mantener designaciones distintas.|Revisa la lista completa de cuentas.',
    'Mudar uma conta muda as outras?|Muda o nome de quem recebe numa de várias contas separadas.|Não, confira cada conta~Sim, todas têm a mesma ficha|Contas separadas podem ter nomes distintos.|Confira a lista toda de contas.',
  ]),
  q('practice-03', 'practice', [
    'Who clarifies legal effects?|A designation conflicts with an estate document; applicable law is unclear.|Qualified local guidance and official process~Random social-media claims~Assume equal legal effects|Conflicting legal effects require relevant local clarification.|Do not infer legal priority from a label alone.',
    '¿Quién aclara efectos legales?|Una designación contradice otro documento sucesorio y no está clara la ley aplicable.|Orientación local calificada y proceso oficial~Una afirmación al azar en redes~Suponer efecto igual de todos los documentos|Efectos legales contradictorios requieren aclaración local pertinente.|No infieras prioridad legal solo por una etiqueta.',
    'Quem esclarece a lei?|O nome na conta não bate com outro documento de herança. A lei não está clara.|Ajuda local qualificada e processo oficial~Uma postagem qualquer~Supor que tudo vale igual|Conflitos entre documentos pedem ajuda de quem conhece a lei local.|O nome da ficha não resolve sozinho a ordem legal.',
  ]),
  q('transfer-01', 'transfer', [
    'What follows this death?|A beneficiary died. Several long-term accounts still name that person.|Review each designation through verified procedures~Assume accounts update themselves~Share login secrets with strangers|The event calls for checking actual records and applicable procedures.|Use official channels and relevant local guidance.',
    '¿Qué sigue a una muerte familiar?|Murió una persona beneficiaria. Varias cuentas de largo plazo todavía la muestran.|Revisar cada designación por procesos verificados~Suponer actualizadas todas las cuentas~Compartir contraseñas con cualquiera que ayude|El evento exige revisar registros reales y procesos aplicables.|Usa canales oficiales y orientación local pertinente.',
    'O que fazer após essa morte?|A pessoa nomeada para receber morreu. Várias contas ainda mostram seu nome.|Rever cada ficha pelo processo oficial~Supor que tudo mudou sozinho~Dar senhas a qualquer ajudante|A morte pede conferir as fichas reais e as regras do caso.|Use canais oficiais e ajuda local qualificada.',
  ]),
]),
];
