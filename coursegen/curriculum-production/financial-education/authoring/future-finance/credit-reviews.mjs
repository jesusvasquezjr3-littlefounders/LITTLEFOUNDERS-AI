import {q} from './helpers.mjs';
import {numeric,input,add,subtract} from '../factory.mjs';
const id=n=>`fe-production-credit-products-${String(n).padStart(2,'0')}`;
const entry='fe-production-accounts-records-04';
export const creditReviews=[{
 id:'fe-production-credit-products-review-1',primary:id(1),
 title:'Card Decisions|Lee tarjeta antes de pagar|Leia cartão antes de pagar',
 relevance:'Retrieve statement labels, dates, interest conditions and costs using the supplied fictional terms.|Recupera etiquetas del estado, fechas, condiciones de interés y costos con términos ficticios dados.|Retome nomes do extrato, datas, condições de juros e custos com termos fictícios dados.',
 outcome:'Read card statement fields and transaction entries, apply stated grace terms and calculate a supplied balance change.',
 misconception:'The minimum is the whole balance, closing is the due date, or purchase grace covers every transaction.',
 skills:[id(1),id(2),id(3),id(4),id(5),entry,id(1)],segments:[
 q('practice-01','practice',[
 'Which field is the required minimum?|Fictional statement: balance 800; minimum 40; due May 16.|Minimum 40~Balance 800~May 16|The minimum field states the required payment floor.|Keep the minimum separate from the full cycle balance.',
 '¿Qué dato es mínimo exigido?|Estado ficticio: saldo 800; mínimo 40; vence 16 de mayo.|Mínimo 40~Saldo 800~16 de mayo|Dato de mínimo indica piso exigido de pago.|Separa mínimo del saldo completo del periodo.',
 'Que dado é mínimo exigido?|Extrato fictício: saldo 800; mínimo 40; vence 16 de maio.|Mínimo 40~Saldo 800~16 de maio|Dado de mínimo indica piso exigido de pagamento.|Separe mínimo do saldo completo do período.']),
 q('practice-02','practice',[
 'Which date sets payment arrival?|Fictional statement closes May 2; payment must arrive by May 21.|May 21~May 2~The next closing date|The payment deadline is distinct from the cycle’s closing date.|Read the field describing when payment must arrive.',
 '¿Qué fecha fija llegada del pago?|Estado ficticio corta 2 de mayo; pago debe llegar hasta 21 de mayo.|21 de mayo~2 de mayo~Siguiente corte|Límite de pago difiere de fecha de corte del periodo.|Lee dato que dice cuándo debe llegar pago.',
 'Que data fixa chegada do pagamento?|Extrato fictício fecha 2 de maio; pagamento deve chegar até 21 de maio.|21 de maio~2 de maio~Próximo fechamento|Prazo de pagamento difere da data de fechamento do período.|Leia dado que diz quando pagamento deve chegar.']),
 q('practice-03','practice',[
 'Does this case avoid interest under the rule?|Fictional purchases require full timely payment for grace; only the minimum arrives on time.|No~Yes, timely always suffices~Yes, minimum means full|The full-payment condition fails despite the payment being timely.|Check amount and timing together under the supplied rule.',
 '¿Caso evita intereses bajo regla?|Compras ficticias requieren pago total puntual para evitar intereses; llega solo mínimo a tiempo.|No~Sí, puntual siempre basta~Sí, mínimo significa total|Condición de pago total falla aunque pago sea puntual.|Revisa monto y fecha juntos bajo regla dada.',
 'Caso evita juros sob regra?|Compras fictícias exigem pagamento total pontual para evitar juros; chega só mínimo no prazo.|Não~Sim, pontual sempre basta~Sim, mínimo significa total|Condição de pagamento total falha mesmo com pagamento pontual.|Veja valor e data juntos sob regra dada.']),
 numeric(q('practice-04','practice',[
 'What debt remains after the minimum?|Fictional schedule: debt 240; add interest 8; minimum payment 20; no other changes.|228~220~0|Interest increases the balance before the minimum reduces it.|Add the supplied charge, then subtract the payment.',
 '¿Qué deuda queda tras mínimo?|Calendario ficticio: deuda 240; sumar interés 8; pago mínimo 20; sin otros cambios.|228~220~0|Interés aumenta saldo antes de que mínimo lo reduzca.|Suma cargo dado y luego resta pago.',
 'Que dívida resta após mínimo?|Calendário fictício: dívida 240; somar juros 8; pagamento mínimo 20; sem outras mudanças.|228~220~0|Juros aumentam saldo antes de mínimo reduzi-lo.|Some encargo dado e depois subtraia pagamento.']),[240,8,20],subtract(add(input(0),input(1)),input(2))),
 q('practice-05','practice',[
 'Which advance costs are stated?|Fictional agreement charges a cash fee plus interest from the advance date; purchase grace excludes advances.|Fee and immediate interest~Fee only~Purchase grace for everything|The advance clause separately states both costs.|Use the advance terms rather than purchase assumptions.',
 '¿Qué costos de adelanto se indican?|Contrato ficticio cobra cargo de efectivo e interés desde adelanto; regla de compras excluye adelantos.|Cargo e interés inmediato~Solo cargo~Regla de compras para todo|Cláusula de adelanto indica ambos costos por separado.|Usa términos de adelanto, no supuestos de compras.',
 'Que custos do saque são dados?|Contrato fictício cobra taxa e juros desde saque; regra de compras exclui saques.|Taxa e juros imediatos~Só taxa~Regra de compras para tudo|Cláusula do saque indica ambos custos em separado.|Use termos do saque, não suposições de compras.']),
 q('practice-06','practice',[
 'Which reading matches this entry?|Fictional deposit statement entry: June 4, transit ticket, debit 18.|June 4; transit expense; outflow 18~June 4; income 18~June 18; fee 4|The date, description and debit identify the recorded outflow.|Read all entry fields before classifying the transaction.',
 '¿Qué lectura coincide con registro?|Registro de cuenta ficticia: 4 de junio, boleto de transporte, débito 18.|4 junio; transporte; salida 18~4 junio; ingreso 18~18 junio; cargo 4|Fecha, descripción y débito identifican salida registrada.|Lee todos datos antes de clasificar transacción.',
 'Que leitura coincide com lançamento?|Lançamento de conta fictícia: 4 de junho, passagem, débito 18.|4 junho; transporte; saída 18~4 junho; renda 18~18 junho; taxa 4|Data, descrição e débito identificam saída lançada.|Leia todos dados antes de classificar transação.']),
 q('transfer-01','transfer',[
 'Which statement summary is accurate?|Fictional balance 500; minimum 25; payment due September 7.|Debt 500; floor 25; due September 7~Debt 25; due anytime~Owned cash 500; no debt|The summary preserves balance, minimum and deadline without swapping them.|Use each labeled field for its stated purpose.',
 '¿Qué resumen del estado es correcto?|Saldo ficticio 500; mínimo 25; pago vence 7 de septiembre.|Deuda 500; piso 25; vence 7 septiembre~Deuda 25; vence cuando sea~Efectivo propio 500; sin deuda|Resumen conserva saldo, mínimo y fecha sin intercambiarlos.|Usa cada dato etiquetado según su propósito.',
 'Que resumo do extrato está certo?|Saldo fictício 500; mínimo 25; pagamento vence 7 de setembro.|Dívida 500; piso 25; vence 7 setembro~Dívida 25; vence quando quiser~Dinheiro próprio 500; sem dívida|Resumo preserva saldo, mínimo e data sem trocá-los.|Use cada dado nomeado conforme sua finalidade.']),
 ]
},{
 id:'fe-production-credit-products-review-2',primary:id(6),
 title:'Credit Commitments|Combina compromisos y consecuencias|Junte compromissos e consequências',
 relevance:'Retrieve combined instalments, owned funds, collateral, guarantees and renewal costs.|Recupera cuotas juntas, fondos propios, bienes en garantía, compromisos de garante y costos de renovar.|Retome parcelas juntas, fundos próprios, bens em garantia, deveres do garantidor e custos de renovar.',
 outcome:'Build a combined payment schedule and distinguish borrowed funds, collateral consequences, guarantee scope and renewal-only costs.',
 misconception:'Small separate payments never collide, credit is owned money, and fees or promises erase repayment obligations.',
 skills:[id(6),id(7),id(8),id(9),id(10),entry,id(6)],segments:[
 q('practice-01','practice',[
 'Which calendar keeps every instalment?|Fictional plans: A owes 20 Tuesday and Friday; B owes 30 Tuesday.|Tuesday 50; Friday 20~Tuesday 20; Friday 20~Friday 50 only|Tuesday combines both plans and Friday retains A’s remaining instalment.|Place every payment on its actual date before adding.',
 '¿Qué calendario conserva toda cuota?|Planes ficticios: A debe 20 martes y viernes; B debe 30 martes.|Martes 50; viernes 20~Martes 20; viernes 20~Solo viernes 50|Martes combina ambos planes; viernes conserva cuota restante de A.|Coloca cada pago en fecha real antes de sumar.',
 'Que calendário mantém toda parcela?|Planos fictícios: A deve 20 terça e sexta; B deve 30 terça.|Terça 50; sexta 20~Terça 20; sexta 20~Só sexta 50|Terça junta ambos planos; sexta mantém parcela restante de A.|Coloque cada pagamento na data real antes de somar.']),
 q('practice-02','practice',[
 'Which portion is money already owned?|Fictional account display combines own balance 70 with unused overdraft 150.|Own balance 70~Overdraft 150~Combined 220|The overdraft portion is unused borrowing capacity, not owned funds.|Separate owned balance from credit availability.',
 '¿Qué parte es dinero ya propio?|Pantalla ficticia combina saldo propio 70 y sobregiro sin usar 150.|Saldo propio 70~Sobregiro 150~Total 220|Parte de sobregiro es capacidad de préstamo, no fondos propios.|Separa saldo propio de crédito disponible.',
 'Que parte é dinheiro já próprio?|Tela fictícia junta saldo próprio 70 e cheque especial sem uso 150.|Saldo próprio 70~Cheque especial 150~Total 220|Parte do cheque especial é capacidade de empréstimo, não fundos próprios.|Separe saldo próprio de crédito disponível.']),
 q('practice-03','practice',[
 'Which respects both?|Fictional A costs less but pledges essential equipment; B costs more without pledged collateral.|Cost plus collateral consequences~Only the smallest instalment~Assume B has no repayment duty|A’s lower cost does not erase its stated collateral consequence.|Compare total cost and what missed payments can affect.',
 '¿Qué comparación respeta ambas ofertas?|A ficticia cuesta menos pero compromete equipo esencial; B cuesta más sin bien comprometido.|Costo y consecuencias de garantía~Solo cuota más pequeña~Suponer que B no exige pago|Costo menor de A no borra consecuencia indicada de garantía.|Compara costo total y qué puede afectar impago.',
 'Que comparação respeita ambas ofertas?|A fictícia custa menos mas dá equipamento essencial; B custa mais sem bem em garantia.|Custo e consequências da garantia~Só menor parcela~Supor que B não exige pagamento|Custo menor de A não apaga consequência dada da garantia.|Compare custo total e o que atrasos podem afetar.']),
 q('practice-04','practice',[
 'What duty does this guarantee create?|Fictional guarantor pays missed loan A instalments; loan B is excluded.|Pay covered missed A instalments~Pay every future loan~Only offer a reference|The agreement defines a payment duty limited to its stated scope.|Apply both the trigger and the scope of the guarantee.',
 '¿Qué deber crea esta garantía?|Términos ficticios exigen al garante pagar cuotas omitidas del préstamo A; B queda excluido.|Pagar cuotas cubiertas omitidas de A~Pagar todo préstamo futuro~Solo dar referencia|Acuerdo define deber de pago limitado a alcance indicado.|Aplica condición y alcance de garantía.',
 'Que dever cria esta garantia?|Termos fictícios exigem ao garantidor pagar parcelas omitidas do empréstimo A; B fica excluído.|Pagar parcelas cobertas omitidas de A~Pagar todo empréstimo futuro~Só dar referência|Acordo define dever de pagamento limitado ao alcance dado.|Aplique condição e alcance da garantia.']),
 q('practice-05','practice',[
 'What did this renewal payment achieve?|Fictional fee buys extra time only; none goes toward the loan principal.|Extended time; principal unchanged~Reduced principal by the fee~Cleared all debt|The stated allocation pays for time without reducing principal.|Distinguish renewal cost from debt repayment.',
 '¿Qué logró este pago de renovación?|Cargo ficticio compra solo tiempo extra; nada va al capital del préstamo.|Más tiempo; capital sin cambio~Capital reducido por cargo~Toda deuda liquidada|Aplicación indicada paga tiempo sin reducir capital.|Distingue costo de renovación de pago de deuda.',
 'O que fez este pagamento de renovação?|Taxa fictícia compra só tempo extra; nada vai ao principal do empréstimo.|Mais tempo; principal sem mudança~Principal reduzido pela taxa~Toda dívida quitada|Aplicação dada paga tempo sem reduzir principal.|Separe custo de renovação de pagamento da dívida.']),
 q('practice-06','practice',[
 'Which classification follows the entry?|Fictional deposit statement: August 3; returned purchase; credit 24.|August 3; refund inflow 24~August 24; fee 3~August 3; new borrowing 24|The description identifies the credited amount as a purchase refund.|Use date, description and amount together before classifying.',
 '¿Qué clasificación sigue al registro?|Estado ficticio de depósito: 3 de agosto; compra devuelta; abono 24.|3 agosto; entrada por devolución 24~24 agosto; cargo 3~3 agosto; préstamo nuevo 24|Descripción identifica abono como devolución de compra.|Usa fecha, descripción y monto juntos antes de clasificar.',
 'Que classificação segue ao lançamento?|Extrato fictício de depósito: 3 de agosto; compra devolvida; crédito 24.|3 agosto; entrada por devolução 24~24 agosto; taxa 3~3 agosto; empréstimo novo 24|Descrição identifica crédito como devolução de compra.|Use data, descrição e valor juntos antes de classificar.']),
 q('transfer-01','transfer',[
 'Which schedule combines the obligations correctly?|Fictional plans: transport 15 Wednesday; equipment 25 Wednesday and Saturday.|Wednesday 40; Saturday 25~Wednesday 15; Saturday 25~Saturday 65 only|Wednesday combines transport and equipment while Saturday keeps its own payment.|Preserve each due date and add only payments sharing it.',
 '¿Qué calendario combina obligaciones correctamente?|Planes ficticios: transporte 15 miércoles; equipo 25 miércoles y sábado.|Miércoles 40; sábado 25~Miércoles 15; sábado 25~Solo sábado 65|Miércoles combina transporte y equipo; sábado conserva pago propio.|Conserva cada fecha y suma solo pagos que la comparten.',
 'Que calendário junta deveres corretamente?|Planos fictícios: transporte 15 quarta; equipamento 25 quarta e sábado.|Quarta 40; sábado 25~Quarta 15; sábado 25~Só sábado 65|Quarta junta transporte e equipamento; sábado mantém pagamento próprio.|Preserve cada data e some só pagamentos que a dividem.']),
 ]
}];
