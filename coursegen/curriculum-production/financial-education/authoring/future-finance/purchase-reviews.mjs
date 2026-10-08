import { q } from './helpers.mjs';
import { purchaseChart } from './purchase-decisions.mjs';
import { numeric,input,add,subtract } from '../factory.mjs';
const id=n=>`fe-production-purchase-decisions-${String(n).padStart(2,'0')}`;
const math='fe-production-financial-math-06';
const mul=(a,b)=>({op:'multiply',args:[a,b]});
const div=(a,b)=>({op:'divide',args:[a,b]});
const pct=(a,b)=>div(mul(a,b),{constant:100});
export const purchaseReviews=[{
 id:'fe-production-purchase-decisions-review-1',primary:id(1),
 title:'Purchase Calculations|Encuentra costo real de compra|Ache o custo real da compra',
 relevance:'Retrieve unit prices, discount order and complete costs before trusting a promotion.|Recupera precios unitarios, orden de descuentos y costos completos antes de confiar en promoción.|Retome preços unitários, ordem dos descontos e custos completos antes de confiar numa promoção.',
 outcome:'Compare normalized unit costs and calculate mandatory charges, discounts and complete ownership cost.',
 misconception:'Headline numbers compare directly, successive percentages add, and promotion labels guarantee less spending.',
 skills:[id(1),id(2),id(3),id(4),id(5),id(6),math,id(1)],segments:[
 numeric(q('practice-01','practice',[
 'What is the price per kilogram?|Package: 400 grams; Grams per kilogram: 1000; Price: 8.|20~8~12|The common kilogram basis makes unit costs comparable.|Scale price using the stated grams-per-kilogram conversion.',
 '¿Cuál es precio por kilogramo?|Paquete: 400 gramos; Gramos por kilogramo: 1000; Precio: 8.|20~8~12|Base común de kilogramo permite comparar costos unitarios.|Lleva precio a kilogramo con conversión indicada.',
 'Qual é preço por quilograma?|Pacote: 400 gramas; Gramas por quilograma: 1000; Preço: 8.|20~8~12|Base comum de quilograma permite comparar custos unitários.|Leve preço a quilograma com conversão dada.']),[400,1000,8],div(mul(input(2),input(1)),input(0))),
 numeric(q('practice-02','practice',[
 'What is the final required price?|Base: 120; Mandatory shipping: 15; Mandatory setup: 5; No other charges.|140~120~135|Both mandatory extras belong in the complete price.|Add base price and every required charge.',
 '¿Cuál es precio final requerido?|Base: 120; Envío obligatorio: 15; Preparación obligatoria: 5; Sin otros cargos.|140~120~135|Ambos extras obligatorios pertenecen al precio completo.|Suma base y cada cargo requerido.',
 'Qual é preço final exigido?|Base: 120; Envio obrigatório: 15; Preparo obrigatório: 5; Sem outros custos.|140~120~135|Ambos os extras obrigatórios pertencem ao preço completo.|Some base e cada custo exigido.']),[120,15,5],add(add(input(0),input(1)),input(2))),
 numeric(q('practice-03','practice',[
 'What remains after the discount?|Original: 160; Discount: 25%; No other charges.|120~40~135|The discount amount must be subtracted from the original price.|Calculate the percentage reduction, then the amount payable.',
 '¿Qué queda tras descuento?|Original: 160; Descuento: 25%; Sin otros cargos.|120~40~135|Monto descontado debe restarse al precio original.|Calcula reducción porcentual y luego monto pagadero.',
 'Quanto sobra após desconto?|Original: 160; Desconto: 25%; Sem outros custos.|120~40~135|Valor descontado deve ser subtraído do preço original.|Calcule redução percentual e depois valor devido.']),[160,25],subtract(input(0),pct(input(0),input(1)))),
 numeric(q('practice-04','practice',[
 'What remains after both discounts?|Original: 80; First discount: 25%; Second on reduced price: 10%; No fees.|54~52~60|The second percentage uses the price after the first discount.|Apply each reduction to the current remaining price.',
 '¿Qué queda tras ambos descuentos?|Original: 80; Primero: 25%; Segundo sobre precio reducido: 10%; Sin cargos.|54~52~60|Segundo porcentaje usa precio tras primer descuento.|Aplica cada reducción al precio restante actual.',
 'Quanto sobra após ambos os descontos?|Original: 80; Primeiro: 25%; Segundo sobre preço reduzido: 10%; Sem taxas.|54~52~60|Segundo percentual usa preço após primeiro desconto.|Aplique cada redução ao preço restante atual.']),[80,25,10],subtract(subtract(input(0),pct(input(0),input(1))),pct(subtract(input(0),pct(input(0),input(1))),input(2)))),
 q('practice-05','practice',[
 'Does qualifying save?|The discounted qualifying basket costs more than the planned basket; every extra item is unwanted.|No, it raises actual spending~Yes, any discount saves~Yes, extras are free|A discount label does not beat the original lower spending plan.|Compare complete spending with the original intended purchase.',
 '¿Cumplir mínimo ahorra aquí?|Canasta mínima descontada cuesta más que prevista; todo extra no se desea.|No, aumenta gasto real~Sí, todo descuento ahorra~Sí, extras no deseados son gratis|Etiqueta de descuento no supera plan original de menor gasto.|Compara gasto completo con compra original prevista.',
 'Atingir mínimo poupa aqui?|Cesta mínima com desconto custa mais que prevista; todo extra é indesejado.|Não, aumenta gasto real~Sim, todo desconto poupa~Sim, extras indesejados são grátis|Rótulo de desconto não supera plano original de menor gasto.|Compare gasto completo com compra original prevista.']),
 purchaseChart(['Total cost','Costo total','Custo total'],'practice-06','practice',[250+150,300+60],[
 'Same ownership period; A purchase 250, total use 150; B purchase 300, total use 60; no other costs or resale.|Ownership total|A|B|Which costs less?|B costs less after including the stated use costs.|Compare purchase plus operation for the same period.',
 'Mismo periodo; A compra 250, uso total 150; B compra 300, uso total 60; sin otros costos ni reventa.|Total de propiedad|A|B|¿Qué cuesta menos?|B cuesta menos incluyendo costos de uso indicados.|Compara compra más uso del mismo periodo.',
 'Mesmo período; A compra 250, uso total 150; B compra 300, uso total 60; sem outros custos ou revenda.|Total de posse|A|B|Qual custa menos?|B custa menos incluindo custos de uso dados.|Compare compra mais uso do mesmo período.'],'lower'),
 numeric(q('practice-07','practice',[
 'What is each equal contribution?|Shared purchase cost: 240; Equal contributors: 4.|60~120~240|Equal contributions divide the total among the stated people.|Use the agreed equal split.',
 '¿Cuál es cada aporte igual?|Compra compartida: 240; Aportes iguales entre: 4 personas.|60~120~240|Aportes iguales dividen total entre personas indicadas.|Usa división igual acordada.',
 'Qual é cada aporte igual?|Compra conjunta: 240; Aportes iguais entre: 4 pessoas.|60~120~240|Aportes iguais dividem total entre pessoas dadas.|Use divisão igual combinada.']),[240,4],div(input(0),input(1))),
 numeric(q('transfer-01','transfer',[
 'What is the price per liter?|Container: 2000 milliliters; Milliliters per liter: 1000; Price: 14.|7~14~28|The container contains more than one common unit.|Divide price by the converted volume in liters.',
 '¿Cuál es precio por litro?|Envase: 2000 mililitros; Mililitros por litro: 1000; Precio: 14.|7~14~28|Envase contiene más de una unidad común.|Divide precio entre volumen convertido a litros.',
 'Qual é preço por litro?|Recipiente: 2000 mililitros; Mililitros por litro: 1000; Preço: 14.|7~14~28|Recipiente contém mais de uma unidade comum.|Divida preço pelo volume convertido em litros.']),[2000,1000,14],div(mul(input(2),input(1)),input(0))),
 ]
},{
 id:'fe-production-purchase-decisions-review-2',primary:id(7),
 title:'Purchase Choices|Lee condiciones antes de elegir|Leia termos antes de escolher',
 relevance:'Retrieve contract terms, payment totals and practical repair choices.|Recupera condiciones, totales de pago y opciones prácticas de arreglo.|Retome termos, totais de pagamento e opções práticas de conserto.',
 outcome:'Distinguish protection terms and compare complete feasible purchase options while obtaining missing information.',
 misconception:'Every protection promise is identical and the lowest displayed payment always identifies the best feasible choice.',
 skills:[id(7),id(8),id(9),id(10),id(11),id(12),math,id(7)],segments:[
 q('practice-01','practice',[
 'Which terms address changing your mind?|An item works correctly, but the buyer no longer wants it.|Applicable return policy~Defect warranty automatically~Any paid accident plan|Returning a working item depends on applicable return terms.|Do not confuse defect coverage with a change-of-mind return.',
 '¿Qué reglas atienden cambiar de opinión?|Artículo funciona bien, pero comprador ya no lo quiere.|Reglas para devolver~Garantía de defectos sin revisar~Cualquier plan pagado de accidentes|Devolver un artículo útil depende de reglas del caso.|No confundas defectos con devolver por cambiar de opinión.',
 'Que regras tratam mudar de ideia?|Item funciona bem, mas comprador não o quer mais.|Regras para devolver~Garantia de defeitos sem conferir~Qualquer plano pago de acidentes|Devolver item útil depende das regras do caso.|Não confunda defeitos com devolver por mudar de ideia.']),
 q('practice-02','practice',[
 'What must be checked before the trial?|It renews into a paid subscription after the free period.|Renewal, cancellation and exit terms~Only the word “free”~Only the first payment|The free start does not explain future payment commitments.|Read when charges begin and how the contract ends.',
 '¿Qué revisar antes de prueba?|Se renueva como suscripción pagada tras periodo gratis.|Renovación, cancelación y salida~Solo palabra «gratis»~Solo el primer pago|Inicio gratis no explica compromisos de pago futuros.|Lee cuándo comienzan cargos y cómo termina contrato.',
 'O que conferir antes do teste?|Renova como assinatura paga após período grátis.|Renovação, cancelamento e saída~Só palavra “grátis”~Só o primeiro pagamento|Início grátis não explica compromissos de pagamento futuros.|Leia quando começam cobranças e como termina contrato.']),
 numeric(q('practice-03','practice',[
 'What is the complete instalment total?|Deposit: 60; Instalments: 6 of 30; Fee: 10; No other payments.|250~180~240|The deposit and fee add to all scheduled instalments.|Multiply instalments, then add the other required payments.',
 '¿Cuál es total completo a cuotas?|Enganche: 60; Cuotas: 6 de 30; Cargo: 10; Sin otros pagos.|250~180~240|Enganche y cargo se suman a todas las cuotas.|Multiplica cuotas y suma otros pagos requeridos.',
 'Qual é total completo em parcelas?|Entrada: 60; Parcelas: 6 de 30; Taxa: 10; Sem outros pagamentos.|250~180~240|Entrada e taxa somam a todas as parcelas.|Multiplique parcelas e some outros pagamentos exigidos.']),[60,6,30,10],add(add(input(0),mul(input(1),input(2))),input(3))),
 q('practice-04','practice',[
 'Which mismatch prevents direct comparison?|A weekly service price is placed beside another service’s annual price.|Different time periods~Different printed amounts~Different payment methods|The totals cover different spans of service.|Convert to the same period before comparing costs.',
 '¿Qué diferencia impide comparar directamente?|Precio semanal de servicio aparece junto a precio anual de otro.|Periodos distintos~Montos impresos distintos~Métodos de pago distintos|Totales cubren duraciones distintas del servicio.|Convierte al mismo periodo antes de comparar costos.',
 'Que diferença impede comparar direto?|Preço semanal de serviço aparece junto ao anual de outro.|Períodos distintos~Valores impressos diferentes~Formas de pagamento diferentes|Totais cobrem durações distintas do serviço.|Converta ao mesmo período antes de comparar custos.']),
 q('practice-05','practice',[
 'Which missing fact matters for this choice?|The cheaper device requires a paid adapter with unknown price.|Required adapter cost~Only the base-price gap~Only the advertised discount|The missing required cost may change the final comparison.|Obtain it rather than treating it as zero.',
 '¿Qué dato falta para elegir?|Aparato barato requiere adaptador pagado de precio desconocido.|Costo requerido del adaptador~Solo diferencia de precios base~Solo el descuento anunciado|Costo obligatorio faltante puede cambiar comparación final.|Obtén dato en vez de tratarlo como cero.',
 'Que dado falta para escolher?|Aparelho barato exige adaptador pago de preço desconhecido.|Custo exigido do adaptador~Só diferença dos preços base~Só o desconto anunciado|Custo obrigatório ausente pode mudar comparação final.|Obtenha dado em vez de tratar como zero.']),
 q('practice-06','practice',[
 'Which option fits the stated need?|Repair safely restores every required function for less; replacement adds no needed benefit.|Repair~Replace for novelty alone~Use an unsafe alternative|The stated repair meets the need at lower cost.|Compare safe function, timing and total cost together.',
 '¿Qué opción cumple lo necesario?|Arreglo seguro devuelve toda función necesaria por menos; cambio no añade beneficio necesario.|Reparar~Cambiar solo por novedad~Usar alternativa insegura|El arreglo indicado sirve y cuesta menos.|Compara uso seguro, tiempo y costo total juntos.',
 'Que opção atende ao necessário?|Conserto seguro devolve toda função útil por menos; troca não acrescenta benefício necessário.|Consertar~Trocar só por novidade~Usar alternativa insegura|O conserto dado serve e custa menos.|Compare uso seguro, prazo e custo total juntos.']),
 numeric(q('practice-07','practice',[
 'What does each equal contributor pay?|Shared repair: 180; Equal contributors: 3.|60~90~180|The shared repair is divided equally among the stated contributors.|Divide the total by the agreed contributor count.',
 '¿Cuánto paga cada aporte igual?|Arreglo compartido: 180; Aportes iguales entre: 3 personas.|60~90~180|Arreglo se divide igual entre personas indicadas.|Divide total entre cantidad acordada de personas.',
 'Quanto paga cada pessoa igualmente?|Conserto conjunto: 180; Aportes iguais entre: 3 pessoas.|60~90~180|Conserto é dividido igual entre pessoas dadas.|Divida total pela quantidade combinada de pessoas.']),[180,3],div(input(0),input(1))),
 q('transfer-01','transfer',[
 'Which promise addresses this fault?|Fictional warranty covers manufacturing defects; paid plan covers accidental damage. The fault is confirmed manufacturing-related.|The defect warranty’s terms~Accident plan automatically~Any return rule|The stated defect category matches the warranty, not accidental damage.|Match the actual event to the relevant terms.',
 '¿Qué promesa revisar para falla?|Garantía ficticia cubre defectos de fábrica; plan pagado cubre accidentes. Se confirmó falla de fábrica.|Reglas de garantía por defectos~Plan de accidentes sin revisar~Cualquier devolución sin condiciones|Tipo de falla coincide con garantía, no daño accidental.|Relaciona evento real con reglas pertinentes.',
 'Que promessa conferir para falha?|Garantia fictícia cobre defeitos de fábrica; plano pago cobre acidentes. Falha de fábrica confirmada.|Regras da garantia por defeitos~Plano de acidentes sem conferir~Qualquer devolução sem condições|Tipo de falha coincide com garantia, não dano acidental.|Ligue evento real às regras relevantes.']),
 ]
}];
