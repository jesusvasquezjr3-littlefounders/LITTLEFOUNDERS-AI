import { q, projectionChart, projectBalance } from './helpers.mjs';
const id = n => `fe-production-retirement-future-${String(n).padStart(2, '0')}`;
const goal = 'fe-production-goals-tradeoffs-01';
export const retirementReviews = [{
  id: 'fe-production-retirement-future-review-1', primary: id(1),
  title:'Retirement Planning|Lee un plan para el futuro|Leia um plano para o futuro',
  relevance: 'Use fictional dollars to distinguish projected resources, spending needs and plan conditions.|Usa pesos ficticios para distinguir recursos proyectados, gastos necesarios y condiciones del plan.|Use reais fictícios para distinguir recursos projetados, gastos necessários e condições do plano.',
  outcome: 'Interpret future resources separately from spending needs and inspect contribution, ownership and projection assumptions.',
  misconception: 'A large projected balance proves coverage regardless of spending, eligibility, fees or ownership conditions.',
  skills: [id(1), id(2), id(3), id(4), id(5), goal, id(1)],
  segments: [
    q('practice-01', 'practice', [
      'What is still needed?|A projection gives a future balance, but ongoing living costs are unknown.|A spending-needs plan~Only a higher return estimate~The balance proves coverage|The balance must be compared with the needs it supports.|Separate stored resources from recurring expenses.',
      '¿Qué falta todavía?|Una proyección da saldo futuro, pero no se estiman gastos continuos para vivir.|Un plan de necesidades de gasto~Solo estimar mayor rendimiento~Nada, el saldo demuestra cobertura|El saldo debe compararse con necesidades que sostendrá.|Distingue recursos guardados de gastos recurrentes.',
      'O que ainda falta?|Uma projeção dá saldo futuro, mas não estimam gastos contínuos para viver.|Um plano de necessidades de gasto~Só estimar maior retorno~Nada, o saldo prova cobertura|O saldo deve ser comparado às necessidades que sustentará.|Separe recursos guardados de gastos recorrentes.',
    ]),
    q('practice-02', 'practice', [
      'Which source needs its own conditions?|A plan lists public benefits, employer arrangements and personal savings.|Each source separately~Only the largest number~None, one rule covers all|The sources can differ in eligibility, ownership and access.|Identify actual conditions for each source.',
      '¿Qué fuente requiere condiciones propias?|Un plan lista apoyos públicos, planes patronales y ahorro personal.|Cada fuente por separado~Solo el número mayor~Ninguna, una regla cubre todo|Las fuentes pueden diferir en requisitos, propiedad y acceso.|Identifica condiciones reales de cada fuente.',
      'Qual fonte exige condições próprias?|Um plano lista benefícios públicos, planos patronais e poupança pessoal.|Cada fonte à parte~Só o número maior~Nenhuma, uma regra cobre tudo|As fontes podem diferir em requisitos, propriedade e acesso.|Identifique condições reais de cada fonte.',
    ]),
    q('practice-03', 'practice', [
      'Is this amount fully owned?|A fictional employer contribution requires a service condition not yet satisfied.|Not under the stated condition~Yes, displaying it grants ownership|The unmet condition limits the stated employer ownership.|Read the actual plan terms.',
      '¿Este monto ya es propio?|Una aportación patronal ficticia exige antigüedad todavía no cumplida.|No según la condición indicada~Sí, mostrarla da propiedad|La condición incumplida limita la propiedad patronal indicada.|Lee los términos reales del plan.',
      'Esse valor já é próprio?|Um aporte patronal fictício exige tempo de serviço ainda não cumprido.|Não pela condição dada~Sim, exibir dá propriedade|A condição não cumprida limita a propriedade patronal dada.|Leia os termos reais do plano.',
    ]),
    projectionChart('practice-04', 'practice', [projectBalance(30, 0, 3), projectBalance(30, 0, 3, 1)], [
      'Fictional: 30 each period; no growth or fees. Three periods; later skips the first.|Projected|Earlier|Later|Which ends higher?|Earlier participation includes an additional contribution period.|Compare under the same stated assumptions.',
      'Ficticio: 30 cada periodo; sin crecimiento ni comisiones. Tres periodos; después omite el primero.|Proyectado|Antes|Después|¿Cuál termina mayor?|Participar antes incluye otro periodo de aportación.|Compara bajo los mismos supuestos indicados.',
      'Fictício: 30 por período; sem crescimento nem tarifas. Três períodos; depois pula o primeiro.|Projetado|Antes|Depois|Qual termina maior?|Participar antes inclui outro período de aporte.|Compare sob as mesmas hipóteses dadas.',
    ]),
    q('practice-05', 'practice', [
      'What changes with fees?|Two projections share deposits and growth; one deducts fees each period.|Less carries forward~Fees guarantee better growth~No balance is affected|Recurring costs reduce the money carried into later periods.|Follow the balance after costs, not just gross growth.',
      '¿Qué cambia con comisión recurrente?|Dos proyecciones comparten depósitos y crecimiento; una descuenta comisión cada periodo.|Pasa menos dinero tras esa comisión~La comisión garantiza mejor crecimiento~No puede cambiar ningún saldo|Los costos recurrentes reducen dinero que pasa a periodos posteriores.|Sigue saldo tras costos, no solo crecimiento bruto.',
      'O que muda com tarifa recorrente?|Duas projeções têm aportes e crescimento iguais; uma desconta tarifa por período.|Passa menos dinheiro após a tarifa~A tarifa garante mais crescimento~Nenhum saldo pode mudar|Custos recorrentes reduzem dinheiro levado aos períodos seguintes.|Siga saldo após custos, não só crescimento bruto.',
    ]),
    q('practice-06', 'practice', [
      'Which goal is actionable?|A person wants to prepare a future care reserve.|A named care purpose, target amount and date~Just “be richer someday”~Only a target investment return|Purpose, amount and date make the goal specific.|Translate the wish into a measurable target.',
      '¿Qué meta es concreta?|Una persona quiere preparar una reserva para cuidados futuros.|Propósito de cuidado, monto meta y fecha~Solo «ser más rico algún día»~Solo un rendimiento objetivo|Propósito, monto y fecha vuelven específica la meta.|Convierte el deseo en una meta medible.',
      'Qual meta é concreta?|Uma pessoa quer preparar reserva para cuidados futuros.|Finalidade de cuidado, valor-alvo e data~Só “ser mais rico algum dia”~Só um retorno desejado|Finalidade, valor e data tornam a meta específica.|Transforme o desejo numa meta mensurável.',
    ]),
    q('transfer-01', 'transfer', [
      'What changes after moving?|The savings projection stays unchanged, but future housing costs rise after relocation.|The resources-to-needs comparison~Nothing, equal savings settle the plan~Only the account name|Changed spending needs can alter coverage with the same balance.|Recompare resources with the actual revised needs.',
      '¿Qué cambia tras mudarse?|La proyección de ahorro sigue igual, pero suben gastos futuros de vivienda tras mudarse.|La comparación entre recursos y necesidades~Nada, igual ahorro resuelve el plan~Solo el nombre de cuenta|Cambiar gastos puede alterar cobertura con igual saldo.|Vuelve a comparar recursos con necesidades reales revisadas.',
      'O que muda após mudar de casa?|A projeção de poupança fica igual, mas os gastos futuros de moradia sobem.|A comparação entre recursos e necessidades~Nada, poupança igual resolve o plano~Só o nome da conta|Mudar gastos pode alterar cobertura com saldo igual.|Compare de novo recursos e necessidades reais revistas.',
    ]),
  ],
}, {
  id: 'fe-production-retirement-future-review-2', primary: id(6),
  title:'Future Resilience|Pon a prueba el plan futuro|Teste o plano futuro',
  relevance: 'Check how changing needs, prices and access conditions affect a future spending plan.|Revisa cómo necesidades, precios y acceso cambiantes afectan un plan de gastos futuros.|Confira como necessidades, preços e acesso mudam um plano de gastos futuros.',
  outcome: 'Distinguish retirement plan pressures and revise resources, contribution decisions and records using current conditions.',
  misconception: 'One current balance or average return settles future spending, emergency access and personal records indefinitely.',
  skills: [id(6), id(7), id(8), id(9), id(10), goal, id(6)],
  segments: [
    q('practice-01', 'practice', [
      'Which pressure is described?|Prices stay fixed, but resources must support more years than the plan assumed.|Longevity risk~Price inflation~Neither can affect the plan|More years extend the period needing support.|Distinguish duration from each year’s cost.',
      '¿Qué presión se describe?|Los precios siguen fijos, pero los recursos deben sostener más años de los supuestos.|Riesgo de longevidad~Inflación de precios~Ninguno afecta el plan|Más años extienden el periodo que requiere apoyo.|Distingue duración de costo de cada año.',
      'Qual pressão é descrita?|Os preços ficam fixos, mas os recursos devem sustentar mais anos que o previsto.|Risco de longevidade~Inflação de preços~Nenhum afeta o plano|Mais anos ampliam o período que exige apoio.|Separe duração do custo de cada ano.',
    ]),
    q('practice-02', 'practice', [
      'Can it serve as emergency cash?|A retirement account prohibits access until after the urgent bill deadline.|No, the access condition conflicts~Yes, any owned balance is immediate cash|The balance is not accessible when the payment is needed.|Check timing rather than ownership alone.',
      '¿Sirve como efectivo de emergencia?|Una cuenta de retiro prohíbe acceso hasta después del vencimiento urgente.|No, la condición de acceso contradice el plazo~Sí, todo saldo propio es efectivo inmediato|El saldo no está accesible cuando se necesita pagar.|Revisa fecha además de propiedad.',
      'Serve como dinheiro de emergência?|Uma conta de aposentadoria proíbe acesso até depois do vencimento urgente.|Não, a condição de acesso conflita com o prazo~Sim, todo saldo próprio é dinheiro imediato|O saldo não está acessível quando precisa pagar.|Confira data além da propriedade.',
    ]),
    q('practice-03', 'practice', [
      'Why do early losses matter?|Withdrawals occur after an early decline and before recovery.|Less invested money reaches recovery~Spent money also earns later returns~Averages fix every path|Withdrawals reduce the balance participating in later recovery.|Track the order of returns and withdrawals.',
      '¿Por qué importan pérdidas tempranas?|Retiran después de una caída inicial y antes de una recuperación posterior.|Llega menos dinero invertido a recuperarse~Lo gastado también gana después~El promedio fija toda trayectoria|Los retiros reducen saldo que participa en recuperación posterior.|Sigue el orden de rendimientos y retiros.',
      'Por que perdas iniciais importam?|Sacam após uma queda inicial e antes de uma recuperação futura.|Chega menos dinheiro aplicado à recuperação~O gasto também rende depois~A média fixa todo caminho|Saques reduzem saldo que participa da recuperação futura.|Siga a ordem dos rendimentos e saques.',
    ]),
    q('practice-04', 'practice', [
      'Which revision fits?|Income falls; essentials remain due and voluntary contributions can be adjusted.|Protect essentials and reassess contributions~Keep the old contribution with imaginary income~Ignore the new shortfall|The plan must reflect current resources and obligations.|Recalculate before committing money the plan no longer has.',
      '¿Qué revisión corresponde a menor ingreso?|Baja el ingreso; lo indispensable vence y las aportaciones voluntarias son ajustables.|Proteger lo esencial y reevaluar aportaciones~Mantener aportación con ingreso imaginario~Ignorar el faltante nuevo|El plan debe reflejar recursos y obligaciones actuales.|Recalcula antes de comprometer dinero que ya no tienes.',
      'Qual revisão cabe à renda menor?|A renda cai; o essencial vence e aportes voluntários podem ser ajustados.|Proteger o essencial e reavaliar aportes~Manter aporte com renda imaginária~Ignorar a nova falta|O plano deve refletir recursos e deveres atuais.|Recalcule antes de comprometer dinheiro que já não tem.',
    ]),
    q('practice-05', 'practice', [
      'What follows a household change?|Several accounts still contain old contacts and beneficiary designations.|Review each through verified procedures~Assume every account updates automatically~Give strangers the account passwords|Personal changes call for checking actual account records.|Use official processes and qualified local advice where needed.',
      '¿Qué sigue a un cambio del hogar?|Varias cuentas todavía tienen contactos y beneficiarios anteriores.|Revisar cada una por procesos verificados~Suponer cambios automáticos en todas~Dar contraseñas a desconocidos|Cambios personales requieren revisar registros reales de cuenta.|Usa procesos oficiales y orientación local calificada cuando haga falta.',
      'O que segue a mudança da família?|Várias contas ainda têm contatos e nomes antigos de quem recebe recursos.|Rever cada uma pelo processo oficial~Supor mudanças automáticas em todas~Dar senhas a estranhos|Mudanças pessoais pedem conferir fichas reais das contas.|Use processos oficiais e ajuda local qualificada quando precisar.',
    ]),
    q('practice-06', 'practice', [
      'What makes it measurable?|Someone wants a future transport reserve but has stated no amount or date.|Specify purpose, amount and target date~Keep only “someday”~Choose a higher return target|The missing amount and date prevent checking progress.|Give the goal concrete boundaries.',
      '¿Qué vuelve medible este deseo?|Quieren reserva futura de transporte, pero no indican monto ni fecha.|Precisar propósito, monto y fecha meta~Dejar solo «algún día»~Elegir mayor rendimiento objetivo|Sin monto ni fecha no puedes comprobar avance.|Da límites concretos a la meta.',
      'O que torna esse desejo mensurável?|Querem reserva futura de transporte, mas não dão valor nem data.|Definir finalidade, valor e data-alvo~Deixar só “algum dia”~Escolher maior retorno desejado|Sem valor nem data não pode conferir o avanço.|Dê limites concretos à meta.',
    ]),
    q('transfer-01', 'transfer', [
      'Which two pressures need testing?|A fixed income must fund both a longer life and rising essential prices.|Duration and inflation together~Only price changes~Only the starting balance|More years and higher annual costs can both strain resources.|Test both changes rather than treating them as one risk.',
      '¿Qué dos presiones debes probar?|Un ingreso fijo debe cubrir vida más larga y precios indispensables crecientes.|Duración e inflación juntas~Solo cambios de precio~Solo el saldo inicial|Más años y costos anuales mayores pueden tensionar recursos.|Prueba ambos cambios sin tratarlos como un solo riesgo.',
      'Quais duas pressões testar?|Uma renda fixa deve cobrir vida mais longa e preços essenciais crescentes.|Duração e inflação juntas~Só mudanças de preço~Só o saldo inicial|Mais anos e custos anuais maiores podem apertar recursos.|Teste ambas as mudanças sem tratá-las como um só risco.',
    ]),
  ],
}];
