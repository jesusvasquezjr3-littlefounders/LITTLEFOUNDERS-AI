import { q } from './helpers.mjs';
import { numeric,input,subtract } from '../factory.mjs';
const id=n=>`fe-production-saving-resilience-${String(n).padStart(2,'0')}`;
const spending='fe-production-spending-patterns-05';
const mul=(a,b)=>({op:'multiply',args:[a,b]});
const div=(a,b)=>({op:'divide',args:[a,b]});
export const savingReviews=[{
 id:'fe-production-saving-resilience-review-1',primary:id(1),
 title:'Savings Planning|Da propósito claro al ahorro|Dê finalidade clara à poupança',
 relevance:'Retrieve planned bills, disruption estimates and reachable reserve choices.|Recupera cuentas previstas, cálculos de imprevistos y opciones de reserva accesible.|Retome contas previstas, contas de imprevistos e opções de reserva acessível.',
 outcome:'Separate saving purposes, estimate the essential bridge and choose feasible targets and reserve access.',
 misconception:'Every infrequent payment is unforeseen and a universal target or highest return always fits the household.',
 skills:[id(1),id(2),id(3),id(4),id(5),spending,id(1)],segments:[
 q('practice-01','practice',[
 'Which allocation fits the known expense?|A dated annual renewal is known now; emergency money is for unexpected disruptions.|Planned-bill allocation~Automatically the emergency allocation~No allocation because annual|The known renewal belongs in advance planned-bill saving.|Separate predictable payments from unforeseen disruptions.',
 '¿Qué apartado corresponde al gasto conocido?|Renovación anual fechada ya se conoce; reserva atiende imprevistos.|Apartado de cuenta prevista~Siempre apartado de emergencia~Ninguno porque es anual|Renovación conocida corresponde a ahorro previo de cuentas previstas.|Separa pagos previsibles de contratiempos inesperados.',
 'Que verba cabe no gasto conhecido?|Renovação anual datada já se conhece; reserva atende imprevistos.|Verba de conta prevista~Sempre verba de emergência~Nenhuma pois é anual|Renovação conhecida cabe em poupança prévia de contas previstas.|Separe pagamentos previsíveis de contratempos inesperados.']),
 numeric(q('practice-02','practice',[
 'What essential bridge is needed?|Monthly essentials: 800; Interruption: 3 months; Confirmed total support: 400; No other resources.|2000~2400~400|The bridge covers repeated essentials after confirmed support.|Multiply duration and monthly costs, then subtract total support.',
 '¿Qué puente esencial se necesita?|Esenciales mensuales: 800; Pausa: 3 meses; Apoyo total confirmado: 400; Sin otros recursos.|2000~2400~400|Puente cubre esenciales repetidos tras apoyo confirmado.|Multiplica duración y costos mensuales, resta apoyo total.',
 'Que ponte essencial precisa?|Essenciais mensais: 800; Pausa: 3 meses; Apoio total confirmado: 400; Sem outros recursos.|2000~2400~400|Ponte cobre essenciais repetidos após apoio confirmado.|Multiplique duração e custos mensais, subtraia apoio total.']),[800,3,400],subtract(mul(input(0),input(1)),input(2))),
 q('practice-03','practice',[
 'Which plan fits?|A disruption estimate guides the target; small contributions fit after essentials.|Use that target with feasible contributions~Copy someone’s large payment~Skip essentials to match an arbitrary rule|A useful starter plan respects actual risks and capacity.|Choose feasible progress and review changing circumstances.',
 '¿Qué plan inicial cabe?|Estimación de contratiempo guía meta; solo pequeño aporte cabe tras esenciales.|Usar meta con aportes viables~Copiar pago grande de otro hogar~Omitir esenciales por regla arbitraria|Plan inicial útil respeta riesgos y capacidad reales.|Elige avance viable y revisa circunstancias cambiantes.',
 'Que plano inicial cabe?|Estimativa de contratempo guia meta; só pequeno aporte cabe após essenciais.|Usar meta com aportes viáveis~Copiar pagamento grande de outra família~Pular essenciais por regra arbitrária|Plano inicial útil respeita riscos e capacidade reais.|Escolha avanço viável e reveja situações que mudam.']),
 q('practice-04','practice',[
 'Which option fits tomorrow’s reserve need?|A has confirmed immediate access and no fee; B locks money beyond tomorrow. Both state stable balances.|A~B~Either regardless of timing|A meets the stated access requirement when money is needed.|Match access, balance conditions and fees to the reserve’s purpose.',
 '¿Qué opción cubre necesidad de mañana?|A tiene acceso inmediato confirmado sin cargo; B bloquea más allá de mañana. Ambos indican saldo estable.|A~B~Cualquiera sin mirar tiempo|A cumple acceso indicado cuando se requiere dinero.|Relaciona acceso, saldo y cargos con propósito de reserva.',
 'Que opção cobre necessidade de amanhã?|A tem acesso imediato confirmado sem taxa; B bloqueia além de amanhã. Ambos indicam saldo estável.|A~B~Qualquer um sem ver prazo|A atende acesso dado quando se precisa do dinheiro.|Ligue acesso, saldo e taxas ao uso da reserva.']),
 numeric(q('practice-05','practice',[
 'How many contributions reach the goal?|Target: 450; Already saved: 150; Feasible contribution: 50; No return or withdrawals.|6~9~3|Existing savings reduce the number of new contributions needed.|Divide the remaining gap by each contribution.',
 '¿Cuántos aportes completan meta?|Meta: 450; Ya ahorrado: 150; Aporte viable: 50; Sin rendimiento ni retiros.|6~9~3|Ahorro existente reduce cantidad de aportes nuevos necesarios.|Divide faltante restante entre cada aporte.',
 'Quantos aportes completam meta?|Meta: 450; Já poupado: 150; Aporte viável: 50; Sem rendimento ou saques.|6~9~3|Poupança existente reduz quantidade de aportes novos necessários.|Divida falta restante por cada aporte.']),[450,150,50],div(subtract(input(0),input(1)),input(2))),
 q('practice-06','practice',[
 'Which expense is predictable but irregular?|A license renews annually on a known date; an unrelated pipe suddenly bursts.|The dated license renewal~The sudden burst~Neither because both cost money|A known annual date makes the renewal predictable, though nonmonthly.|Distinguish irregular timing from unforeseen events.',
 '¿Qué gasto es previsible pero irregular?|Licencia se renueva anual en fecha conocida; tubería ajena revienta de repente.|Renovación fechada de licencia~Rotura repentina~Ninguno porque ambos cuestan|Fecha anual conocida hace previsible renovación aunque no mensual.|Distingue frecuencia irregular de eventos imprevistos.',
 'Que gasto é previsível mas irregular?|Licença renova anual em data conhecida; cano alheio estoura de repente.|Renovação datada da licença~Ruptura repentina~Nenhum pois ambos custam|Data anual conhecida torna previsível renovação embora não mensal.|Separe frequência irregular de eventos imprevistos.']),
 q('transfer-01','transfer',[
 'What prevents double-counting?|One balance must cover a known school fee and an unexpected-disruption reserve.|Earmark each purpose separately~Count the whole balance for both~Treat the known fee as impossible|Separate allocations prevent promising the same money twice.|Assign actual money to each distinct purpose.',
 '¿Qué separación evita contar doble?|Un saldo debe cubrir cuota escolar conocida y reserva de imprevistos.|Apartar cada propósito por separado~Contar saldo completo para ambos~Tratar cuota conocida como imposible|Apartados separados evitan prometer mismo dinero dos veces.|Asigna dinero real a cada propósito distinto.',
 'Que separação evita contar dobrado?|Um saldo deve cobrir taxa escolar conhecida e reserva de imprevistos.|Separar cada uso em sua verba~Contar saldo inteiro para ambos~Tratar taxa conhecida como impossível|Verbas separadas evitam prometer mesmo dinheiro duas vezes.|Atribua dinheiro real a cada uso distinto.']),
 ]
},{
 id:'fe-production-saving-resilience-review-2',primary:id(6),
 title:'Reserve Decisions|Mantén real el plan de reserva|Mantenha real o plano da reserva',
 relevance:'Retrieve missed-contribution adjustments, transfer timing and reserve replenishment.|Recupera ajustes por aportes faltantes, fechas de transferencia y reposición de reserva.|Retome ajustes por aportes perdidos, datas de transferência e reposição da reserva.',
 outcome:'Update actual savings, avoid payment shortfalls and allocate or replenish reserves using stated priorities.',
 misconception:'Planned deposits count as actual savings and protecting a saving schedule overrides essential payment timing.',
 skills:[id(6),id(7),id(8),id(9),id(10),spending,id(6)],segments:[
 numeric(q('practice-01','practice',[
 'How much remains after the missed deposit?|Target: 900; Actual saved: 500; No return or new deposits.|400~500~900|Only actual savings reduce the remaining gap.|Subtract the real balance from the target.',
 '¿Qué falta tras depósito omitido?|Meta: 900; Ahorrado real: 500; Sin rendimiento ni depósitos nuevos.|400~500~900|Solo ahorro real reduce faltante restante.|Resta saldo real a meta.',
 'Quanto falta após depósito perdido?|Meta: 900; Poupado real: 500; Sem rendimento ou depósitos novos.|400~500~900|Só poupança real reduz falta restante.|Subtraia saldo real da meta.']),[900,500],subtract(input(0),input(1))),
 q('practice-02','practice',[
 'Adjust what?|Automatic saving would leave less cash than rent due before the next confirmed income.|That transfer’s amount or timing~Only the savings label~Nothing because automation is always safe|The transfer conflicts with an earlier essential obligation.|Check post-transfer cash against bills before new income.',
 '¿Qué transferencia necesita ajuste?|Ahorro automático deja menos efectivo que renta previa al próximo ingreso confirmado.|Monto o fecha de esa transferencia~Solo etiqueta de ahorro~Nada porque automatizar siempre es seguro|Transferencia entra en conflicto con obligación esencial anterior.|Revisa efectivo tras transferencia contra cuentas antes de ingreso.',
 'Que transferência precisa de ajuste?|Poupança automática deixa menos dinheiro que aluguel antes da próxima renda confirmada.|Valor ou data dessa transferência~Só nome da poupança~Nada pois automação sempre é segura|Transferência entra em conflito com dever essencial anterior.|Confira dinheiro após transferência contra contas antes de renda.']),
 numeric(q('practice-03','practice',[
 'What remains for the chosen goal?|Received windfall: 700; Urgent bill first: 250; Chosen reserve addition: 200; No other allocations.|250~450~500|Both prior allocations reduce the money left for the goal.|Subtract the urgent payment and reserve addition.',
 '¿Qué queda para meta elegida?|Dinero inesperado recibido: 700; Cuenta urgente primero: 250; Aporte elegido a reserva: 200; Sin otros apartados.|250~450~500|Ambos apartados anteriores reducen dinero para meta.|Resta pago urgente y aporte de reserva.',
 'Quanto sobra para meta escolhida?|Dinheiro extra recebido: 700; Conta urgente primeiro: 250; Aporte escolhido à reserva: 200; Sem outros usos.|250~450~500|Ambas as verbas anteriores reduzem dinheiro para meta.|Subtraia pagamento urgente e aporte à reserva.']),[700,250,200],subtract(subtract(input(0),input(1)),input(2))),
 q('practice-04','practice',[
 'Which use fits?|Reserve covers unforeseen essential repairs; necessary refrigeration suddenly fails, while a new television is optional.|The essential refrigeration repair~The optional television~Neither; reserves must never be used|The repair matches the unexpected essential purpose.|Use the defined reserve purpose, not purchase excitement.',
 '¿Qué uso cabe en reserva indicada?|Reserva cubre arreglos esenciales imprevistos; refrigeración necesaria falla de repente, televisor nuevo es opcional.|Arreglo esencial de refrigeración~Televisor opcional~Ninguno porque reserva nunca se usa|El arreglo cumple propósito esencial inesperado.|Usa propósito definido de reserva, no emoción de compra.',
 'Que uso cabe na reserva dada?|Reserva cobre consertos essenciais imprevistos; geladeira necessária falha de repente, televisão nova é opcional.|Conserto essencial da geladeira~Televisão opcional~Nenhum pois reserva nunca se usa|O conserto cumpre uso essencial imprevisto.|Use fim definido da reserva, não emoção da compra.']),
 numeric(q('practice-05','practice',[
 'How many feasible refills restore the target?|Target: 1000; Remaining reserve: 400; Monthly refill: 150; No return or withdrawals.|4~6~10|The refills cover the current target-minus-balance gap.|Subtract remaining reserve, then divide by each feasible refill.',
 '¿Cuántos aportes viables restauran meta?|Meta: 1000; Reserva restante: 400; Reposición mensual: 150; Sin rendimiento ni retiros.|4~6~10|Aportes cubren faltante actual entre meta y saldo.|Resta reserva restante y divide entre cada reposición viable.',
 'Quantos aportes viáveis restauram meta?|Meta: 1000; Reserva restante: 400; Reposição mensal: 150; Sem rendimento ou saques.|4~6~10|Aportes cobrem falta atual entre meta e saldo.|Subtraia reserva restante e divida por cada reposição viável.']),[1000,400,150],div(subtract(input(0),input(1)),input(2))),
 q('practice-06','practice',[
 'Which is predictable despite not being monthly?|A known annual permit fee sits beside a sudden essential breakdown.|The annual permit fee~The sudden breakdown~Both are unpredictable|A known annual fee has an advance planning opportunity.|Irregular frequency does not necessarily mean unforeseen.',
 '¿Qué es previsible aunque no mensual?|Cuota anual conocida de permiso aparece junto a avería esencial repentina.|Cuota anual del permiso~Avería repentina~Ambos son imprevisibles|Cuota anual conocida ofrece ocasión de planear antes.|Frecuencia irregular no significa necesariamente imprevisto.',
 'O que é previsível embora não mensal?|Taxa anual conhecida de licença aparece junto a pane essencial repentina.|Taxa anual da licença~Pane repentina~Ambos são imprevisíveis|Taxa anual conhecida permite planejar antes.|Frequência irregular não significa sempre imprevisto.']),
 q('transfer-01','transfer',[
 'Which revision fits another missed contribution?|The date is flexible; essentials prevent increasing contributions.|Extend timing using the actual balance~Invent the missed deposit~Skip essentials to preserve the date|A flexible date can absorb a real gap without hiding it.|Recalculate completion using actual savings and feasible future payments.',
 '¿Qué revisión cabe tras otro aporte faltante?|Fecha es flexible, pero esenciales no permiten aumentar aportes.|Ampliar plazo usando saldo real~Inventar depósito faltante~Omitir esenciales para conservar fecha|Fecha flexible absorbe faltante real sin ocultarlo.|Recalcula final con ahorro real y pagos futuros viables.',
 'Que revisão cabe após outro aporte perdido?|Data é flexível, mas essenciais não permitem aumentar aportes.|Ampliar prazo usando saldo real~Inventar depósito perdido~Pular essenciais para manter data|Data flexível absorve falta real sem ocultar.|Recalcule final com poupança real e pagamentos futuros viáveis.']),
 ]
}];
