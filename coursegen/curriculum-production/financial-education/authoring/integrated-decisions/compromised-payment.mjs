import { capstone, Q } from './factory.mjs';
export const compromisedPayment = resolve => capstone(9, resolve,
 ['Payment compromised', 'Pago comprometido', 'Pagamento comprometido'],
 ['Protect access, document what happened, and keep essential deadlines visible.', 'Protege el acceso, documenta lo sucedido y conserva visibles los plazos esenciales.', 'Proteja o acesso, documente o ocorrido e mantenha os prazos essenciais visíveis.'],
 'Following attacker instructions or treating a disputed payment as immediately recovered money.',
 s=>({evidence:[0,1,2,0,1,0],segments:[
 Q('practice-01','practice',s[0],0,[
 ['Which immediate response protects access?','Your payment password leaked; an unsolicited message offers recovery through its link.',['Use the known official channel','Enter your password in the link'],'An independently verified channel avoids extending the credential exposure.','Do not rely on contact details supplied by the suspicious message.'],
 ['¿Qué respuesta protege el acceso?','Se expusieron credenciales de pago; un mensaje no solicitado ofrece recuperarlas mediante su enlace.',['Contactar al proveedor por un canal oficial conocido','Escribir credenciales en el enlace recibido'],'Un canal verificado por separado evita ampliar la exposición.','No confíes en los contactos del mensaje sospechoso.'],
 ['Qual resposta protege o acesso?','Sua senha vazou; uma mensagem estranha oferece ajuda por um link.',['Buscar o canal oficial conhecido','Digitar a senha no link'],'Busque o canal por conta própria para não expor mais dados.','Não use os contatos da mensagem suspeita.'],
 ]),
 Q('practice-02','practice',s[1],1,[
 ['How should this payment be described?','You authorized a transfer but entered the wrong recipient; nobody else accessed your account.',['A payment you never authorized','A mistaken authorized transfer'],'You authorized the payment; the recipient information was mistaken.','Report what happened accurately instead of changing the authorization facts.'],
 ['¿Cómo describir este pago?','Autorizaste una transferencia, pero pusiste destinatario equivocado; nadie más accedió a tu cuenta.',['Un pago que nunca autorizaste','Una transferencia autorizada por error'],'Autorizaste el pago; el error estaba en el destinatario.','Reporta lo ocurrido sin cambiar los hechos de autorización.'],
 ['Como descrever este pagamento?','Você autorizou a transferência, mas digitou o destinatário errado; ninguém mais acessou sua conta.',['Um pagamento nunca autorizado','Uma transferência autorizada por engano'],'Você autorizou o pagamento; o destinatário estava errado.','Relate o ocorrido sem mudar os fatos da autorização.'],
 ]),
 Q('practice-03','practice',s[2],2,[
 ['What does the calendar reveal?','Bill due Tuesday; pay Thursday, no earlier funds. Monthly income covers expenses.',['No problem: totals match','An optional-spending problem','A shortfall before payday'],'The money arrives after the essential bill’s deadline.','Monthly totals do not prove funds exist on every due date.'],
 ['¿Qué muestra el calendario?','Cuenta esencial: martes; pago confirmado: jueves; sin fondos utilizables antes. El total mensual alcanzaría.',['Nada; el total mensual alcanza','Un problema de gasto opcional','Un faltante antes del pago'],'El dinero llega después del vencimiento de la cuenta esencial.','Los totales mensuales no prueban fondos en cada fecha.'],
 ['O que o calendário mostra?','Conta essencial: terça; pagamento confirmado: quinta; sem recursos utilizáveis antes. O total mensal bastaria.',['Nada; o total mensal basta','Um problema de gasto opcional','Uma falta antes do pagamento'],'O dinheiro chega depois do vencimento da conta essencial.','Totais mensais não comprovam recursos em cada vencimento.'],
 ]),
 Q('practice-04','practice',s[0],1,[
 ['Which evidence should be preserved?','Access secured; report the suspicious payment and preceding message.',['Only a guess about the sender','Payment details and original message','Your password in a public post'],'Details and the original message support an accurate report.','Preserve relevant records without exposing access secrets.'],
 ['¿Qué evidencia conservar?','Tras proteger el acceso, debes reportar un pago sospechoso y el mensaje que lo precedió.',['Solo tu sospecha sobre el remitente','Detalles del movimiento y mensaje original','Tu contraseña en una publicación'],'Los detalles y el mensaje original respaldan un reporte preciso.','Conserva registros relevantes sin exponer secretos de acceso.'],
 ['Qual evidência preservar?','O acesso está seguro; relate o pagamento suspeito e guarde a mensagem.',['Só sua suspeita sobre o remetente','Detalhes da transação e mensagem original','Sua senha em uma publicação'],'Guarde os fatos e a mensagem para relatar o que houve.','Guarde os dados do caso, sem expor sua senha.'],
 ]),
 Q('practice-05','practice',s[1],0,[
 ['Which description matches the facts?','You did not initiate or approve this payment; you recognize the others.',['A payment you did not authorize','Your own recipient error'],'Report the unapproved payment separately from transactions you recognize.','Do not describe an unapproved payment as your own typing error.'],
 ['¿Qué descripción coincide?','Aparece un pago que no iniciaste ni aprobaste; reconoces tus demás movimientos.',['Un pago que no autorizaste','Un error de destinatario que introdujiste'],'Reporta el pago no aprobado separado de los movimientos reconocidos.','No describas un pago no aprobado como error propio al escribir.'],
 ['Qual descrição corresponde?','Você não fez nem aprovou este pagamento; reconhece os demais.',['Um pagamento que não autorizou','Um erro de destinatário que digitou'],'Relate este pagamento à parte dos que você fez.','Um pagamento sem sua ordem não é seu erro ao digitar.'],
 ]),
 Q('transfer-01','transfer',s[0],2,[
 ['Which protects access?','A stolen phone accesses payments; a stranger charges to unlock it. Essential bills remain due.',['Pay the stranger immediately','Share the account password','Secure access through verified support'],'Verified support addresses exposed access without trusting the stranger.','Handle essential deadlines separately; do not buy the attacker’s promise.'],
 ['¿Qué respuesta es más segura?','Un teléfono robado accede a pagos; un desconocido cobra por desbloquearlo. Aún debes planear cuentas esenciales.',['Pagar al desconocido de inmediato','Compartir la contraseña','Proteger el acceso con soporte verificado'],'El soporte verificado atiende el acceso expuesto sin confiar en desconocidos.','Atiende aparte los plazos esenciales; no compres la promesa del atacante.'],
 ['Qual resposta é mais segura?','Um celular roubado acessa pagamentos; um estranho cobra para desbloquear. Contas essenciais ainda precisam de planejamento.',['Pagar ao estranho imediatamente','Compartilhar a senha','Proteger o acesso com suporte verificado'],'Use o canal oficial, sem confiar no estranho.','Cuide dos prazos das contas; não pague pela promessa do ladrão.'],
 ]),
 ]}));
