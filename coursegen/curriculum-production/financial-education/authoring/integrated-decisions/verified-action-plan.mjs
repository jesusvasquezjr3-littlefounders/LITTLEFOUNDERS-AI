import { capstone, Q } from './factory.mjs';
export const verifiedActionPlan = resolve => capstone(12, resolve,
 ['An actionable plan', 'Un plan realizable', 'Um plano realizável'],
 ['Separate a useful action today from questions needing qualified local help.', 'Separa una acción útil hoy de preguntas que requieren ayuda local calificada.', 'Veja o que fazer hoje e quando buscar ajuda de quem sabe.'],
 'Treating every unresolved question as a reason to stop, or inventing legal answers to make a plan look complete.',
 s=>({evidence:[0,1,2,3,1,0],segments:[
 Q('practice-01','practice',s[0],1,[
 ['Which action can be checked today?','No spare money; goal: identify next week’s unpaid obligations.',['Promise financial security','List each bill and its due date','Commit an unaffordable deposit'],'A dated bill list is concrete and needs no spare money.','Choose an observable next action within current resources.'],
 ['¿Qué acción puedes comprobar hoy?','No sobra dinero; la meta es entender las obligaciones pendientes de la próxima semana.',['Prometer seguridad financiera','Anotar cada cuenta y vencimiento','Comprometer un depósito impagable'],'Una lista con fechas es concreta y no exige dinero sobrante.','Elige una acción observable con los recursos actuales.'],
 ['O que pode conferir hoje?','Não sobra dinheiro; você quer saber quais contas vencem na próxima semana.',['Prometer segurança financeira','Listar cada conta e vencimento','Assumir um depósito impagável'],'Você pode fazer a lista com datas sem gastar dinheiro.','Escolha algo que pode fazer e conferir hoje.'],
 ]),
 Q('practice-02','practice',s[1],0,[
 ['Which help should be checked?','No feasible plan covers essentials; an ad promises debt erasure for upfront payment.',['Qualified local debt-support services','The unchecked guarantee','An invented repayment schedule'],'Verify qualified local support before trusting a sweeping promise.','A guarantee in an advertisement does not establish legitimate help.'],
 ['¿Qué ayuda debes verificar?','Ningún plan viable cubre necesidades; un anuncio garantiza borrar deudas cobrando por adelantado.',['Servicios locales calificados de apoyo','La garantía sin comprobar','Un calendario de pagos inventado'],'Verifica apoyo local calificado antes de confiar en una promesa absoluta.','Una garantía publicitaria no demuestra ayuda legítima.'],
 ['Qual ajuda deve verificar?','Não há como pagar dívidas e contas básicas; um anúncio promete apagar dívidas se pagar antes.',['Ajuda local com qualificação','A garantia sem conferir','Um calendário de pagamentos inventado'],'Confira quem pode ajudar; não confie só numa promessa.','Prometer num anúncio não prova que a ajuda é real.'],
 ]),
 Q('practice-03','practice',s[2],2,[
 ['Where should the deadline be verified?','A foreign video gives a filing date; your local rule is unknown.',['Use the video’s date','Use the most repeated comment','The relevant local authority'],'The applicable local source establishes the relevant filing rule.','A foreign deadline cannot establish your local obligation.'],
 ['¿Dónde verificar el plazo?','Un video extranjero indica una fecha para declarar; desconoces la regla de tu localidad.',['Usar la fecha del video','Usar el comentario más repetido','La fuente oficial local pertinente'],'La fuente local aplicable establece la regla pertinente.','Un plazo extranjero no establece tu obligación local.'],
 ['Onde verificar o prazo?','Um vídeo de outro país dá um prazo; você não sabe a regra onde mora.',['Usar a data do vídeo','Usar o comentário mais repetido','A fonte oficial de onde mora'],'A fonte oficial local informa a regra que vale ali.','O prazo de outro país não define o seu.'],
 ]),
 Q('practice-04','practice',s[3],1,[
 ['Which question needs qualified advice?','A relative dies; you have their password but lack verified estate authority.',['Which documents you have','Your legal authority over funds','Where your questions are written'],'Knowing a password does not establish legal authority over an estate.','Verify authority through qualified local advice before acting on funds.'],
 ['¿Qué pregunta requiere asesoría calificada?','Fallece un familiar; tienes su contraseña bancaria, pero ninguna autoridad verificada sobre la herencia.',['Qué documentos ya tienes','Si puedes usar legalmente esos fondos','Dónde anotaste tus preguntas'],'Conocer una contraseña no establece autoridad legal sobre una herencia.','Verifica autoridad con asesoría local calificada antes de usar fondos.'],
 ['O que exige ajuda de quem sabe?','Um parente morre; você tem sua senha, mas não sabe se pode gerir a herança.',['Quais documentos já possui','Se pode usar legalmente esses recursos','Onde anotou suas perguntas'],'Ter a senha não dá poder legal sobre a herança.','Confira seu poder legal com ajuda local antes de usar fundos.'],
 ]),
 Q('practice-05','practice',s[1],0,[
 ['What strengthens a support request?','Funds cannot cover essentials and debt payments; you will contact verified local help.',['Accurate income, cost and debt records','An invented surplus','The smallest debt balance'],'Accurate records let support assess the real constraints.','Do not invent repayment capacity to make the plan look complete.'],
 ['¿Qué mejora la solicitud de ayuda?','Necesidades y deudas superan fondos disponibles; vas a contactar apoyo local verificado.',['Registros reales de ingresos, costos y deudas','Un sobrante prometido que no existe','El saldo de deuda menor'],'Registros precisos permiten evaluar las restricciones reales.','No inventes capacidad de pago para aparentar un plan completo.'],
 ['O que melhora o pedido de ajuda?','Falta dinheiro para dívidas e contas básicas; você vai pedir ajuda local já verificada.',['Dados reais de renda, gastos e dívidas','Uma sobra inventada','O saldo da menor dívida'],'Dados certos mostram o que cabe no seu caso.','Não invente uma sobra para fingir que o plano fecha.'],
 ]),
 Q('transfer-01','transfer',s[0],2,[
 ['Which step is actionable?', 'Deadline uncertain, no spare funds; the relevant official contact is accessible today.',['Promise to solve everything','Pay an unknown fee immediately','Ask the deadline and record it'],'A recorded official answer resolves a specific uncertainty without spare money.','Choose a verifiable action rather than an unsupported commitment.'],
 ['¿Qué siguiente paso es realizable?','El plazo es incierto y no sobra dinero. Hoy puedes acceder al contacto oficial pertinente.',['Prometer resolver todo','Pagar ya una comisión desconocida','Consultar el plazo y registrar la respuesta'],'Una respuesta oficial registrada aclara una duda concreta sin dinero sobrante.','Elige una acción verificable, no un compromiso sin respaldo.'],
 ['O que pode fazer agora?','Você não sabe o prazo e não sobra dinheiro; hoje pode falar com o canal oficial.',['Prometer resolver tudo','Pagar já uma tarifa desconhecida','Consultar o prazo e registrar a resposta'],'Anotar a resposta oficial resolve uma dúvida sem exigir sobra.','Escolha algo que pode conferir, não uma promessa sem base.'],
 ]),
 ]}));
