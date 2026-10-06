import { q } from './helpers.mjs';
import { numeric,input,add,subtract } from '../factory.mjs';
const id=n=>`fe-production-shared-finances-${String(n).padStart(2,'0')}`;
const math='fe-production-financial-math-06';
const div=(a,b)=>({op:'divide',args:[a,b]});
const mul=(a,b)=>({op:'multiply',args:[a,b]});
export const sharedReviews=[{
 id:'fe-production-shared-finances-review-1',primary:id(1),
 title:'Shared Decisions|Acuerda, verifica y protege decisiones|Combine, confira e proteja escolhas',
 relevance:'Retrieve shared-cost rules, legal roles and safe support choices.|Recupera reglas de gastos compartidos, roles legales y opciones de apoyo seguro.|Retome regras de custos conjuntos, funções legais e escolhas de apoio seguro.',
 outcome:'Apply agreed contribution rules while distinguishing consent, documented responsibilities and safe support.',
 misconception:'A contribution rule, account access or family relationship automatically establishes fair consent and legal responsibility.',
 skills:[id(1),id(2),id(3),id(4),math,id(1)],segments:[
 numeric(q('practice-01','practice',[
 'What is Ari’s agreed contribution?|Income-proportional rule: Ari earns 1500, Bea 4500; shared bill 1200.|300~600~900|Ari pays the agreed share based on combined income.|Divide Ari’s income by combined income, then multiply cost.',
 '¿Cuál es aporte acordado de Ari?|Regla proporcional: Ari gana 1500, Bea 4500; cuenta compartida 1200.|300~600~900|Ari paga su parte acordada del ingreso conjunto.|Divide ingreso de Ari entre conjunto y multiplica costo.',
 'Qual é o aporte combinado de Ari?|Regra proporcional: Ari ganha 1500, Bea 4500; conta conjunta 1200.|300~600~900|Ari paga sua parte combinada da renda conjunta.|Divida renda de Ari pela conjunta e multiplique custo.']),[1500,4500,1200],mul(div(input(0),add(input(0),input(1))),input(2))),
 q('practice-02','practice',[
 'What does authorized viewing establish?|A helper can see statements; no ownership terms have been checked.|Viewing permission only~Ownership of all funds~No possible legal obligations|Viewing permission does not settle ownership or liability.|Check roles and legal terms separately.',
 '¿Qué establece consultar con permiso?|Ayudante puede ver estados; no se revisaron términos de propiedad.|Solo permiso de consulta~Propiedad de todo el dinero~Ninguna posible obligación legal|Consultar no resuelve propiedad ni responsabilidad.|Revisa roles y términos legales por separado.',
 'O que define consultar com permissão?|Ajudante pode ver extratos; termos de posse não foram conferidos.|Só permissão de consulta~Posse de todo o dinheiro~Nenhum possível dever legal|Consultar não resolve posse nem responsabilidade.|Confira funções e termos legais em separado.']),
 q('practice-03','practice',[
 'Which agreement is complete enough here?|They need amount, payment owner and review timing.|Lee pays 200; review Friday~Someone will help~Payments will sort themselves out|The first option identifies a commitment and review time.|Name the amount, responsible person and review date.',
 '¿Qué acuerdo está completo aquí?|Necesitan monto, responsable de pago y fecha de revisión.|Lee paga 200; revisión viernes~Alguien ayudará~Pagos se resolverán solos|Primera opción identifica compromiso y momento de revisión.|Nombra monto, responsable y fecha de revisión.',
 'Qual acordo está completo aqui?|Precisam de valor, responsável pelo pagamento e data de revisão.|Lee paga 200; revisão sexta~Alguém ajudará~Pagamentos se resolverão sozinhos|Primeira opção indica compromisso e momento de revisão.|Nomeie valor, responsável e data de revisão.']),
 q('practice-04','practice',[
 'Which response respects safety?|Threats force someone to borrow; a private trusted support channel is available.|Seek support through that channel~Require confrontation first~Blame the person pressured|Safe support does not require confrontation or blame.|Prioritize the person’s safety and ability to choose.',
 '¿Qué respuesta respeta seguridad?|Amenazas fuerzan a alguien a pedir prestado; hay canal privado confiable de apoyo.|Buscar apoyo por ese canal~Exigir confrontar primero~Culpar a quien recibió presión|Apoyo seguro no requiere confrontación ni culpa.|Prioriza seguridad y capacidad de decidir de la persona.',
 'Que resposta respeita segurança?|Ameaças forçam alguém a pegar empréstimo; há canal privado confiável de apoio.|Buscar apoio por esse canal~Exigir confronto antes~Culpar quem sofreu pressão|Apoio seguro não exige confronto nem culpa.|Priorize segurança e capacidade de escolha da pessoa.']),
 numeric(q('practice-05','practice',[
 'What does each person pay?|Shared expense: 840; Equal contributors: 4.|210~420~840|Equal sharing divides the expense by the number of contributors.|Use the explicitly agreed equal split.',
 '¿Cuánto paga cada persona?|Gasto compartido: 840; Aportes iguales entre: 4 personas.|210~420~840|Compartir igual divide gasto entre número de personas.|Usa la división igual explícitamente acordada.',
 'Quanto paga cada pessoa?|Gasto conjunto: 840; Aportes iguais entre: 4 pessoas.|210~420~840|Dividir igual reparte gasto pelo número de pessoas.|Use a divisão igual claramente combinada.']),[840,4],div(input(0),input(1))),
 q('transfer-01','transfer',[
 'What must be agreed before calculating?|New housemates have unequal incomes and different care duties.|The contribution rule~A universally correct equal split~A universally correct proportional split|Circumstances inform agreement; no split is universally right.|Compare methods and explicitly agree the rule.',
 '¿Qué acordar antes de calcular?|Nuevos compañeros tienen ingresos distintos y tareas de cuidado diferentes.|La regla de aportes~División igual universalmente correcta~División proporcional universalmente correcta|Circunstancias orientan acuerdo; ninguna división siempre es correcta.|Comparen métodos y acuerden explícitamente la regla.',
 'O que combinar antes de calcular?|Novos colegas têm rendas distintas e tarefas de cuidado diferentes.|A regra dos aportes~Divisão igual sempre correta~Divisão proporcional sempre correta|As situações orientam acordo; nenhuma divisão é sempre certa.|Comparem métodos e combinem claramente a regra.']),
 ]
},{
 id:'fe-production-shared-finances-review-2',primary:id(5),
 title:'Household Changes|Planea cambios del hogar|Planeje mudanças da família',
 relevance:'Retrieve care-period budgets, family transfers and records for major transitions.|Recupera presupuestos de cuidados, transferencias familiares y registros para grandes cambios.|Retome orçamentos de cuidados, transferências familiares e registros para grandes mudanças.',
 outcome:'Revise care-period resources and identify transfer expectations, records and local authority questions.',
 misconception:'Old income, family promises and account credentials alone establish a workable budget or legal authority.',
 skills:[id(5),id(6),id(7),id(8),math,id(5)],segments:[
 numeric(q('practice-01','practice',[
 'What remains during caregiving?|Reduced paid income: 1900; Essentials: 1500; Added care supplies: 500.|-100~400~100|The added supplies exceed the apparent remaining income.|Include both reduced income and added care costs.',
 '¿Qué queda durante cuidados?|Ingreso pagado reducido: 1900; Esenciales: 1500; Materiales nuevos de cuidado: 500.|-100~400~100|Los materiales nuevos superan el ingreso restante aparente.|Incluye ingreso reducido y costos nuevos de cuidado.',
 'Quanto sobra durante cuidados?|Renda paga reduzida: 1900; Essenciais: 1500; Novos materiais de cuidado: 500.|-100~400~100|Os materiais novos superam a renda restante aparente.|Inclua renda reduzida e novos custos de cuidado.']),[1900,1500,500],subtract(subtract(input(0),input(1)),input(2))),
 q('practice-02','practice',[
 'What needs clarification before transferring?|One relative expects repayment; the recipient believes it is a gift.|Gift or loan and repayment terms~Only the family surname~Only the transfer button|Different expectations need resolution before money changes hands.|Agree whether repayment is required and when.',
 '¿Qué aclarar antes de transferir?|Familiar espera devolución; quien recibe cree que es regalo.|Regalo o préstamo y condiciones~Solo apellido familiar~Solo botón de transferencia|Expectativas distintas deben aclararse antes de entregar dinero.|Acuerden si debe devolverse y cuándo.',
 'O que esclarecer antes de transferir?|Parente espera devolução; quem recebe pensa que é presente.|Presente ou empréstimo e termos~Só sobrenome familiar~Só botão da transferência|Expectativas distintas devem ser esclarecidas antes de entregar dinheiro.|Combinem se deve devolver e quando.']),
 q('practice-03','practice',[
 'What records matter after separating?|Shared borrowing, recurring bills and account access remain active.|Contracts, balances, dates and permissions~Only furniture receipts~Only the new housing budget|Active financial arrangements need records and verified updates.|Map obligations and access instead of assuming they disappeared.',
 '¿Qué registros importan al separarse?|Préstamo compartido, pagos recurrentes y acceso a cuentas siguen activos.|Contratos, saldos, fechas y permisos~Solo recibos de muebles~Solo el nuevo presupuesto de vivienda|Acuerdos activos necesitan registros y cambios verificados.|Ubica deudas y acceso sin suponer que desaparecieron.',
 'Que registros importam ao separar?|Empréstimo conjunto, contas regulares e acesso a contas seguem ativos.|Contratos, saldos, datas e acessos~Só recibos de móveis~Só o novo orçamento de moradia|Acordos ativos precisam de registros e mudanças conferidas.|Mapeie dívidas e acesso sem supor que sumiram.']),
 q('practice-04','practice',[
 'What needs qualified local verification?|After incapacity, someone knows the login but wants to make decisions for the owner.|Recognized decision authority~Only whether the login works~Only family closeness|Working credentials do not establish legal decision authority.|Check the applicable documents and local rules.',
 '¿Qué requiere verificación local experta?|Tras perder capacidad, alguien conoce acceso y quiere decidir por titular.|Poder reconocido para decidir~Solo si funciona acceso~Solo cercanía familiar|Datos de acceso no establecen poder legal de decisión.|Revisa documentos y reglas locales del caso.',
 'O que exige verificação local perita?|Após perda de capacidade, alguém sabe o acesso e quer decidir pelo titular.|Poder reconhecido para decidir~Só se funciona o acesso~Só proximidade familiar|Dados de acesso não definem poder legal de decisão.|Confira documentos e regras locais do caso.']),
 numeric(q('practice-05','practice',[
 'What is each agreed share?|Shared care transport cost: 360; Equal contributors: 3.|120~180~360|Divide the shared cost among the equal contributors.|Apply the stated equal-sharing rule.',
 '¿Cuál es cada parte acordada?|Transporte compartido de cuidados: 360; Aportes iguales entre: 3 personas.|120~180~360|Divide costo compartido entre quienes aportan igual.|Aplica la regla indicada de división igual.',
 'Qual é cada parte combinada?|Transporte conjunto de cuidados: 360; Aportes iguais entre: 3 pessoas.|120~180~360|Divida custo conjunto entre quem paga igual.|Aplique a regra dada de divisão igual.']),[360,3],div(input(0),input(1))),
 q('transfer-01','transfer',[
 'Which revision is needed?|Care lasts longer; paid hours stay reduced and supplies remain necessary.|Extend the budget and recalculate funding~Keep only the original end date~Assume supplies become free|Longer care extends the period needing reduced-income funding.|Update duration, costs and confirmed resources together.',
 '¿Qué revisión se necesita?|Cuidados duran más; horas pagadas siguen reducidas y materiales siguen necesarios.|Extender presupuesto y recalcular fondos~Conservar solo fecha final original~Suponer materiales se vuelven gratis|Más cuidados extienden el periodo con menos ingreso pagado.|Actualiza juntos duración, costos y recursos confirmados.',
 'Que revisão é necessária?|Cuidados duram mais; horas pagas seguem reduzidas e materiais seguem necessários.|Estender orçamento e recalcular verba~Manter só data final antiga~Supor materiais ficam grátis|Mais cuidados estendem o período com menos renda paga.|Atualize juntos duração, custos e recursos confirmados.']),
 ]
}];
