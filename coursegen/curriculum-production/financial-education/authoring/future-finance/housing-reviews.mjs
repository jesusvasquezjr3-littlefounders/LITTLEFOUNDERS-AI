import { q, projectionChart } from './helpers.mjs';
import { numeric, input, subtract, add } from '../factory.mjs';
const id = n => `fe-production-housing-transport-${String(n).padStart(2, '0')}`;
const purchase = 'fe-production-purchase-decisions-02';
export const housingReviews = [{
 id:'fe-production-housing-transport-review-1', primary:id(1),
 title:'Housing Planning|Revisa todo el plan de vivienda|Confira todo o plano de moradia',
 relevance:'Retrieve cash, contract and affordability checks before choosing housing.|Recupera revisiones de efectivo, contrato y capacidad de pago antes de elegir vivienda.|Retome cuidados com dinheiro, contrato e capacidade de pagar antes de escolher moradia.',
 outcome:'Separate housing costs, read stated obligations and test affordability under changed conditions.',
 misconception:'An affordable advertised price or upfront payment proves the entire housing arrangement is affordable.',
 skills:[id(1),id(2),id(3),id(4),id(5),id(6),purchase,id(1)],
 segments:[
 numeric(q('practice-01','practice',[
 'What cash is needed to enter?|First rent: 750; Deposit: 500; Moving: 120; All due before entry.|1370~750~1250|Every stated upfront amount needs funding before entry.|Add rent, deposit and moving costs.',
 '¿Qué efectivo necesitas para entrar?|Primera renta: 750; Depósito: 500; Mudanza: 120; Todo vence antes de entrar.|1370~750~1250|Todo monto inicial indicado necesita fondos antes de entrar.|Suma renta, depósito y mudanza.',
 'Quanto dinheiro precisa para entrar?|Primeiro aluguel: 750; Depósito: 500; Mudança: 120; Tudo vence antes de entrar.|1370~750~1250|Todo valor inicial dado precisa de dinheiro antes de entrar.|Some aluguel, depósito e mudança.']),[750,500,120],add(add(input(0),input(1)),input(2))),
 projectionChart('practice-02','practice',[500+120+100,570+60+30],[
 'Monthly: A rent 500, utilities 120, travel 100; B rent 570, utilities 60, travel 30.|Full monthly cost|A|B|Which costs less?|B costs less once services and travel are included.|Include the same cost categories in both options.',
 'Mensual: A renta 500, servicios 120, viaje 100; B renta 570, servicios 60, viaje 30.|Costo mensual completo|A|B|¿Qué cuesta menos?|B cuesta menos al incluir servicios y viaje.|Incluye las mismas categorías de costos en ambas opciones.',
 'Mensal: A aluguel 500, serviços 120, viagem 100; B aluguel 570, serviços 60, viagem 30.|Custo mensal completo|A|B|Qual custa menos?|B custa menos ao incluir serviços e viagem.|Inclua as mesmas categorias de custos nas duas opções.'],'lower', ["Total cost","Costo total","Custo total"]),
 q('practice-03','practice',[
 'What follows this fictional clause?|Tenant must report leaks; owner arranges repairs. A pipe starts leaking.|Report the leak~Assume deposit cancels rent~Replace all plumbing without notice|Reporting initiates the stated repair process.|Use the responsibilities assigned by this contract.',
 '¿Qué sigue esta cláusula ficticia?|Inquilino debe reportar fugas; propietario organiza arreglos. Una tubería fuga.|Reportar la fuga~Suponer depósito cancela renta~Cambiar tuberías sin aviso|Reportar inicia el proceso de arreglo indicado.|Usa las responsabilidades asignadas por este contrato.',
 'O que segue esta cláusula fictícia?|Morador deve avisar vazamentos; dono organiza consertos. Um cano vaza.|Avisar o vazamento~Supor depósito cancela aluguel~Trocar canos sem aviso|Avisar inicia o processo de conserto dado.|Use os deveres atribuídos por este contrato.']),
 q('practice-04','practice',[
 'Which cost is ongoing ownership?|After closing, the owner regularly pays for upkeep.|Maintenance~Only the sale price~Only the registration charge|Maintenance continues after the purchase transaction ends.|Distinguish running costs from purchase and closing costs.',
 '¿Qué costo continúa al ser dueño?|Tras cerrar compra, dueño paga cuidado habitual.|Mantenimiento~Solo precio de venta~Solo cargo de registro|El mantenimiento sigue después de terminar la compra.|Distingue costos de uso de compra y cierre.',
 'Qual custo segue ao ser dono?|Após fechar compra, dono paga cuidados regulares.|Manutenção~Só preço de venda~Só cobrança de registro|A manutenção segue depois do fim da compra.|Separe custos de uso dos de compra e fechamento.']),
 q('practice-05','practice',[
 'What remains unresolved?|A bigger down payment lowers borrowing but leaves no cash for stated urgent repairs.|Cash for repairs~Whether borrowing fell~Whether the price exists|Lower borrowing does not fund the unfunded repair need.|Check remaining cash alongside the reduced debt.',
 '¿Qué sigue sin resolver?|Enganche mayor reduce préstamo pero no deja efectivo para arreglos urgentes indicados.|Efectivo para arreglos~Si bajó el préstamo~Si existe el precio|Menor préstamo no financia los arreglos sin fondos.|Revisa efectivo restante junto con deuda reducida.',
 'O que segue sem solução?|Entrada maior reduz dívida mas não deixa dinheiro para consertos urgentes dados.|Dinheiro para consertos~Se a dívida caiu~Se existe o preço|Menor dívida não financia consertos sem verba.|Confira dinheiro restante junto com dívida reduzida.']),
 numeric(q('practice-06','practice',[
 'What remains in this setback?|Reduced income: 1700; New housing payment: 1000; Other essentials: 800.|-100~100~700|The stressed costs exceed reduced income.|Use all changed amounts in the same budget.',
 '¿Qué queda en este contratiempo?|Ingreso reducido: 1700; Nuevo pago de vivienda: 1000; Otros esenciales: 800.|-100~100~700|Los costos adversos superan el ingreso reducido.|Usa todos los montos cambiados en el mismo presupuesto.',
 'Quanto sobra neste revés?|Renda reduzida: 1700; Nova prestação: 1000; Outros essenciais: 800.|-100~100~700|Os custos adversos superam a renda reduzida.|Use todos os valores mudados no mesmo orçamento.']),[1700,1000,800],subtract(subtract(input(0),input(1)),input(2))),
 numeric(q('practice-07','practice',[
 'What is the complete price?|Product: 300; Mandatory delivery: 25; Mandatory installation: 40; No other charges.|365~300~325|Every mandatory charge belongs in the final price.|Add product, delivery and installation.',
 '¿Cuál es el precio completo?|Producto: 300; Entrega obligatoria: 25; Instalación obligatoria: 40; Sin otros cargos.|365~300~325|Todo cargo obligatorio pertenece al precio final.|Suma producto, entrega e instalación.',
 'Qual é o preço completo?|Produto: 300; Entrega obrigatória: 25; Instalação obrigatória: 40; Sem outros custos.|365~300~325|Todo custo obrigatório pertence ao preço final.|Some produto, entrega e instalação.']),[300,25,40],add(add(input(0),input(1)),input(2))),
 q('transfer-01','transfer',[
 'Which amount belongs upfront?|A new lease requires a refundable key deposit before entry, besides recurring rent.|The key deposit~Only next year’s utilities~No deposit because refundable|Refundability does not remove the initial cash requirement.|Separate money needed now from possible later refunds.',
 '¿Qué monto corresponde al inicio?|Nueva renta exige depósito reembolsable de llaves antes de entrar, además de renta recurrente.|El depósito de llaves~Solo servicios del próximo año~Ningún depósito porque se devuelve|Ser reembolsable no elimina la necesidad inicial de efectivo.|Separa dinero requerido ahora de posibles devoluciones posteriores.',
 'Qual valor é inicial?|Novo aluguel exige depósito reembolsável de chaves antes de entrar, além do aluguel regular.|O depósito das chaves~Só serviços do próximo ano~Nenhum depósito pois será devolvido|Ser reembolsável não elimina a necessidade inicial de dinheiro.|Separe dinheiro exigido agora de possíveis devoluções futuras.']),
 ]
},{
 id:'fe-production-housing-transport-review-2',primary:id(7),
 title:'Housing Mobility|Compara vivienda y movilidad|Compare moradia e mobilidade',
 relevance:'Combine time horizons, vehicle costs and practical access before choosing.|Combina horizontes, costos de vehículo y acceso práctico antes de elegir.|Combine prazos, custos de veículo e acesso prático antes de escolher.',
 outcome:'Compare housing and vehicle arrangements using full costs, contract endings and essential constraints.',
 misconception:'Lowest monthly advertised price implies the cheapest feasible arrangement and ownership outcome.',
 skills:[id(7),id(8),id(9),id(10),id(11),id(12),purchase,id(7)],
 segments:[
 q('practice-01','practice',[
 'What must be corrected first?|Rent is totaled for a short stay; buying for a much longer stay.|Match the stay length~Assume home prices rise~Ignore sale costs|Different horizons do not answer the same housing question.|Compare the same period with complete relevant costs.',
 '¿Qué corregir primero?|Renta se suma para estancia corta; compra para estancia mucho mayor.|Igualar duración de estancia~Suponer vivienda sube de precio~Ignorar costos de venta|Horizontes distintos no responden la misma pregunta de vivienda.|Compara el mismo periodo con costos pertinentes completos.',
 'O que corrigir primeiro?|Aluguel é somado para estadia curta; compra para estadia muito maior.|Igualar duração da estadia~Supor alta no preço da casa~Ignorar custos de venda|Prazos distintos não respondem à mesma questão de moradia.|Compare o mesmo período com custos relevantes completos.']),
 numeric(q('practice-02','practice',[
 'What is the period’s ownership cost?|Vehicle value lost: 1500; Complete running costs: 1100; No financing costs.|2600~1500~400|Value lost and running costs both belong in the total.|Add the costs for the same ownership period.',
 '¿Cuál es costo del periodo?|Valor perdido del vehículo: 1500; Costos completos de uso: 1100; Sin costos financieros.|2600~1500~400|Valor perdido y uso pertenecen al total.|Suma costos del mismo periodo de propiedad.',
 'Qual é o custo do período?|Valor perdido do veículo: 1500; Custos completos de uso: 1100; Sem custos financeiros.|2600~1500~400|Valor perdido e uso pertencem ao total.|Some custos do mesmo período de posse.']),[1500,1100],add(input(0),input(1))),
 q('practice-03','practice',[
 'Which omitted amount changes financing cost?|The advertised total includes deposit and instalments but excludes a required balloon.|Required final balloon~Unrelated groceries~The driver’s preferred route|A required final payment belongs in total contract payments.|Count every payment required by the financing offer.',
 '¿Qué monto omitido cambia el costo?|Total anunciado incluye enganche y cuotas pero excluye pago final obligatorio.|Pago final obligatorio~Despensa sin relación~Ruta preferida del conductor|Un pago final obligatorio pertenece al total del contrato.|Cuenta cada pago exigido por la oferta de financiamiento.',
 'Que valor omitido muda o custo?|Total anunciado inclui entrada e parcelas mas exclui pagamento final obrigatório.|Pagamento final obrigatório~Compras sem relação~Rota favorita do motorista|Pagamento final obrigatório pertence ao total do contrato.|Conte cada pagamento exigido pela oferta de financiamento.']),
 q('practice-04','practice',[
 'What could increase this lease cost?|The fictional lease charges for travel above its included distance; planned use exceeds that limit.|Excess-distance charge~Automatic free ownership~Guaranteed zero return costs|Planned excess use triggers the stated additional charge.|Compare expected distance with the included allowance.',
 '¿Qué podría aumentar este costo?|Arrendamiento ficticio cobra por superar distancia incluida; uso previsto supera el límite.|Cargo por distancia excedida~Propiedad gratis automática~Cero costos de devolución seguros|Uso excedente previsto activa el cargo adicional indicado.|Compara distancia prevista con la incluida.',
 'O que pode aumentar esse custo?|Arrendamento fictício cobra por superar distância incluída; uso previsto supera o limite.|Cobrança por distância excedida~Posse grátis automática~Zero custos certos na devolução|Uso excedente previsto ativa a cobrança adicional dada.|Compare distância prevista com a incluída.']),
 q('practice-05','practice',[
 'Which plan covers ongoing needs?|Purchase cash is ready; scheduled servicing still requires future payment.|Reserve for servicing separately~Assume purchase cash covers everything~Ignore the known due date|Purchase funding and later servicing are distinct needs.|Plan money for the known future service.',
 '¿Qué plan cubre necesidades continuas?|Efectivo de compra listo; servicio programado aún requiere pago futuro.|Reservar aparte para servicio~Suponer compra cubre todo~Ignorar fecha conocida|Fondos de compra y servicio posterior son necesidades distintas.|Planea dinero para el servicio futuro conocido.',
 'Qual plano cobre necessidades contínuas?|Dinheiro da compra pronto; serviço marcado ainda exige pagamento futuro.|Reservar separado para serviço~Supor compra cobre tudo~Ignorar data conhecida|Dinheiro da compra e serviço posterior são necessidades distintas.|Planeje dinheiro para o serviço futuro conhecido.']),
 q('practice-06','practice',[
 'Which location is feasible?|Both fit the combined budget; A cannot meet required arrival time, B can.|B~A~Neither because prices differ|B meets the stated budget and timing requirements.|Check non-price constraints alongside combined cost.',
 '¿Qué ubicación es viable?|Ambas caben en presupuesto combinado; A no cumple hora requerida de llegada, B sí.|B~A~Ninguna porque precios difieren|B cumple presupuesto y horario indicados.|Revisa restricciones no monetarias junto con costo combinado.',
 'Qual local é viável?|Ambos cabem no orçamento conjunto; A não cumpre horário exigido de chegada, B sim.|B~A~Nenhum pois preços diferem|B atende ao orçamento e horário dados.|Confira limites além do preço junto com custo conjunto.']),
 numeric(q('practice-07','practice',[
 'What must be paid to use it?|Appliance: 180; Required adapter: 20; No other charges.|200~180~160|The required adapter is part of the usable purchase cost.|Add the required adapter to the appliance price.',
 '¿Qué debe pagarse para usarlo?|Aparato: 180; Adaptador requerido: 20; Sin otros cargos.|200~180~160|El adaptador requerido forma parte del costo utilizable.|Suma adaptador requerido al precio del aparato.',
 'Quanto deve pagar para usar?|Aparelho: 180; Adaptador exigido: 20; Sem outros custos.|200~180~160|O adaptador exigido faz parte do custo de uso.|Some adaptador exigido ao preço do aparelho.']),[180,20],add(input(0),input(1))),
 q('transfer-01','transfer',[
 'What makes buying look cheaper?|The model assumes a high resale price after a brief stay, despite uncertain future prices.|An uncertain resale assumption~Certain future appreciation~Rent being automatically wasted|The comparison depends on an uncertain future sale value.|Test other resale outcomes over the same stay.',
 '¿Qué hace parecer barata la compra?|Modelo supone reventa alta tras breve estancia, pese a precios futuros inciertos.|Un supuesto incierto de reventa~Aumento futuro seguro~Renta desperdiciada automáticamente|La comparación depende de un valor futuro de venta incierto.|Prueba otros resultados de reventa durante la misma estancia.',
 'O que faz a compra parecer barata?|Modelo supõe revenda alta após breve estadia, apesar de preços futuros incertos.|Uma hipótese incerta de revenda~Alta futura certa~Aluguel desperdiçado automaticamente|A comparação depende de um valor futuro de venda incerto.|Teste outros resultados de revenda na mesma estadia.']),
 ]
}];
