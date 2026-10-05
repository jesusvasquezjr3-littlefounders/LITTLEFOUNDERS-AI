# Round 2 review: regional adaptation and language

Reviewer angle: native-level reader of es-MX, en-US and pt-BR who writes for children.
Scope: the 8 round-2 plans in `coursegen/curriculum-v2/financial-education/plans/`, all three locales, plus payloads and rubrics where a string depends on them. Round 1 (`plans-round1/`) was used for the nouns-only comparison. Read-only; nothing in the repo was touched.

Totals: 0 blockers, 2 major, 23 minor (25 findings). A separate backlog list at the end holds what the boards and the shared payload own.

## Verdict per lesson

- fe-69-01-count-coins (universal, Dina, 6-9): examples-first in practice (hook, 5 ungraded Dina turns, then two graded steps), and the copy is clean of market things; only one pt-BR stiffness (finding 9).
- fe-69-02-change-counting-up (universal, Rho, 6-9): examples-first (three ungraded Ari turns before the first graded step); the "feria LittleFounders" stall is a generic in-app setting, so the `universal` declaration holds; only wording polish (findings 7, 8).
- fe-69-03-needs-and-wants (universal, Liruf, 6-9): examples-first (episode plus two "ask" turns before any sorting); one graded pt-BR reason label is wrong for candy (finding 2) and the "market day" opener is a calque in en-US and pt-BR (finding 11).
- fe-69-04-market-stall (scenarios, Zara, 6-9): examples-first (goal, moves, check before the guided step); the three markets really differ in setting and custom (tianguis with a $10 coin, driveway yard sale with a $10 bill and a cash box, feira livre with Pix and a pochete), but the pt-BR Pix reason is logically inverted (finding 1) and the price scale is one shared set of numbers (backlog B2).
- fe-1012-01-unit-price (scenarios, Liruf, 10-12): examples-first (episode plus three examples); the adaptation is real where the copy owns the numbers (es-MX bolillos 4 for 12 or 10 for 25, pt-BR pão de hot dog 4 for 8 or 10 for 18, en-US notebooks that flip the answer), and nouns-only inside the graded ratio boards, whose payload numbers are shared (backlog B2); polish only (findings 18-21).
- fe-1012-02-plan-the-budget (universal, Rho, 10-12): examples-first (goal, round, exact, over, drop shown before the graded steps); coins only, nothing market-specific; the pt-BR "passa" calque and "some exato" are the only language issues (findings 22-24).
- fe-1012-03-saving-plan (scenarios, Zara, 10-12): examples-first (hook plus four Zara examples before the first graded step) and the best regional adaptation of the round: Nico helps at his grandmother's tiendita and keeps an alcancía, Max walks neighbors' dogs for a weekly allowance and saves for a telescope at a yard sale, Davi keeps his mesada in a cofrinho and spends on figurinhas; a robot kit at a feira livre is the one weak spot (finding 4).
- fe-1012-04-suspicious-messages (scenarios, Dina, 10-12): examples-first (Dina's near-miss episode, then look-who, look-ask and tell-adult turns before any marking); the scams are realistic per market (es-MX rifa, paquetería $20 envío, game-account code, "soy tu tío" new number; pt-BR sorteio do grupo, cobrança Pix, "novo número" mãe asking R$ 100 by Pix; en-US package delivery fee $3, game prize, new-number family text), nothing teaches a technique, and all three markets end on stop and tell an adult; only the pt-BR reply labels mix moods (finding 6).

Round 1 comparison on "nouns only": fixed for fe-1012-03 (round 1 changed only alcancía/piggy bank/cofrinho; round 2 changes who earns, who pays and where), fe-1012-01 (second anchor per market and different offers per locale in the examples and the decision), fe-1012-04 (per-market scam families) and fe-69-04 (setting, payment custom and money object per market). Not fixed, and not fixable in plan copy: the graded boards of fe-69-04 and fe-1012-01 still take their numbers from the shared `payload` (see B2).

Checked and clean (no finding):
- Money words: in-app money is monedas / coins / moedas everywhere; "$N" in es-MX and en-US, "R$ N" in pt-BR for real market money; no "pesos", "reais" or "dólares" in any learner copy (the one "dollars" is inside the en-US scenario declaration of fe-69-04). The pt-BR decimal comma ("2,5") and es-MX/en-US dot ("2.5") are right in the only decimal help line (fe-1012-01).
- Gendered address: no "Bienvenido", "listo/a", "contento/a" and no "Bem-vindo"; pt-BR uses the neutral "Boas-vindas"; "Obrigado" in fe-1012-01 pre feedback is Liruf (male Mentor), which is fine.
- Register: es-MX is tú throughout (no usted, no voseo); pt-BR is você-imperative throughout (Marque, Faça, Pense), no tu-forms; Rho/Zara/Liruf/Dina voices are consistent with their gender in pt-BR articles ("o Liruf", "a Dina").
- Names, days, holidays: Nico, Max, Davi, Lia, Nia, Leo, Dana, doña Lupe, dona Marta, seu Zé are plausible; Saturday yard sale, Sunday tianguis, Saturday feira livre are credible; pt-BR times are written "10h", "17h".
- Readability metrics (`metrics-round2.json`) were read as context only; no line passes the gate but reads too heavy for its age band beyond what the findings below cover.

## Findings (ranked)

### Major

1. [major] fe-69-04-market-stall / zara-hook, ex-check, guided-stall / pt-BR — The Pix logic is inverted. The narration says "no Pix o valor sai certinho, sem troco. Por isso a cesta da dona Marta precisa custar exatamente o que ela quer pagar", and the prompts say Marta "paga R$ 10 no Pix". Pix transfers any amount and never needs change, so the stated reason for an exact basket is false, and a Brazilian child or parent will notice. The reason the basket must hit the number is the goal ("quer gastar tudo"), not the payment method. The declared scenario text repeats the same logic ("o valor tem de bater certinho, sem troco"). FIX:
   - zara-hook line: "Dona Marta vai pagar R$ 10 no Pix. Veja como encho a cesta." -> "Dona Marta quer gastar R$ 10 certinho. Veja como encho a cesta."
   - zara-hook narration script: "Eu grito os preços pela feira inteira, e no Pix o valor sai certinho, sem troco. Por isso a cesta da dona Marta precisa custar exatamente o que ela quer pagar." -> "Eu grito os preços pela feira inteira. A dona Marta separou R$ 10 para a feira e quer gastar tudo, nem a mais nem a menos. Por isso a cesta precisa custar exatamente R$ 10."
   - ex-check prompt: "Passo 3: dona Marta paga R$ 10 no Pix." -> "Passo 3: dona Marta confere o total e paga no Pix."
   - guided-stall prompt: "Outro freguês paga R$ 8 no Pix. Encha a cesta no valor exato." -> "Outro freguês quer gastar R$ 8 certinho. Encha a cesta no valor exato."
   - `regional.scenarios.pt-BR.scenario`: replace "dona Marta paga no Pix e o valor tem de bater certinho, sem troco" with "dona Marta separou R$ 10 e quer gastar certinho, e paga no Pix". The anchors "feira livre" and "Pix" stay.

2. [major] fe-69-03-needs-and-wants / guided-01 (same label in pre-01, practice-01, transfer-01) / pt-BR first, es-MX and en-US milder — The graded want reason is "É só para brincar" (pt-BR), "Es solo para divertirnos" (es-MX), "It is just for fun" (en-US). guided-01 sorts Doce / Dulce / Candy; nobody plays with a doce, so the only "want" reason offered is literally false for the item, and the reason is the point of the step. pt-BR is the clear case (brincar = play); es-MX and en-US are stretched but survivable. The other wants (balão, robô de brinquedo, câmera de brinquedo, figurinhas) fit all three labels. Use one label that fits candy and toys alike (≤ 5 words, so it also holds for ages 6-9 at x1.25). FIX, replace the second reason label in all four segments (it is the same label in each; `transfer-01` keeps its third reason unchanged):
   - pt-BR: "É só para brincar" -> "É só vontade"
   - es-MX: "Es solo para divertirnos" -> "Es solo un antojo"
   - en-US: "It is just for fun" -> "It's just a treat"
   - and the en-US help in practice-01 "A need keeps us well. A want is just fun." -> "A need keeps us healthy. A want is just a treat." (also see finding 12).

### Minor

3. [minor] fe-69-04-market-stall / practice-sort / es-MX — Two basket items have prices a Mexican child would laugh at in pesos: "1 balón de $12" and "2 tamales de $6 cada uno" (a ball is $80 or more; a tamal about $20). The rubric depends only on the totals (item order: less, more, more, less), so swapping the nouns keeps it valid. FIX: "1 balón de $12" -> "1 bolsa de papitas de $12"; "2 tamales de $6 cada uno" -> "2 conchas de $6 cada una". Leave "6 dulces de $1 cada uno" and "4 paletas de $2 cada una". (pt-BR "1 abacaxi, R$ 12", "2 melões, R$ 4 cada", "4 mangas, R$ 3 cada" are fine.)

4. [minor, taste-leaning] fe-1012-03-saving-plan / hook-01 / pt-BR — A R$ 90-scale "kit de robô" reads odd at a feira livre ("Hoje, na feira livre, ele vê um kit de robô"). A toy stall inside the feira is believable and keeps the declared anchor "feira livre". Also adds the article (finding 5). FIX: "Davi guarda a mesada no cofrinho. Hoje, na feira livre, ele vê um kit de robô e sonha em comprar." -> "O Davi guarda a mesada no cofrinho. Na barraca de brinquedos da feira livre, ele vê um kit de robô." (20 words, inside the x1.25 line limit.) Keep the declared scenario as is.

5. [minor] pt-BR / all lessons — Character names take the article inconsistently. "o Liruf", "a Dina", "a Nia", "a Lia" and "com o Davi" (a help line) have it; prompts and lines with Rho, Ari, Zara and Davi drop it. A Brazilian reader sees two registers in one lesson. Rule: always "o/a" before a character name, including after prepositions (do Rho, com o Ari). FIX, exact strings:
   - fe-69-02 example prompt: "A lojinha de Rho na feira." -> "A lojinha do Rho na feira."
   - fe-69-02 example prompt: "Ari compra um caderno de 35 e paga 50." -> "O Ari compra um caderno de 35 e paga 50."
   - fe-1012-02 hook prompt: "Ouça Rho." -> "Ouça o Rho."
   - fe-1012-02 (practice-over-01 and transfer F-): "Veja a lista que passou com Rho" -> "Veja a lista que ultrapassou o dinheiro com o Rho" (wording per finding 23).
   - fe-69-04 zara-hook prompt: "Sábado: Zara abre a barraca na feira livre." -> "Sábado: a Zara abre a barraca na feira livre."
   - fe-1012-03 example-02 line: "Davi tem 30 de 90, então faltam 90 − 30 = 60." -> "O Davi tem 30 de 90, então faltam 90 − 30 = 60."
   - fe-1012-03 guided-01 prompt: "Davi quer um kit de robô de 90 moedas." -> "O Davi quer um kit de robô de 90 moedas."
   Authors: grep the pt-BR copy for bare "Rho", "Ari", "Zara", "Davi" and apply the same rule to any other hit.

6. [minor] fe-1012-04-suspicious-messages / reply-01 / pt-BR — The three reply labels mix moods: "Pague agora e acabe logo." (imperative to Leo), "Respondo e pergunto quem é." (first person), "Não pague, vamos chamar um adulto." (imperative). The es-MX replies are all imperative and consistent. FIX: "Respondo e pergunto quem é." -> "Responda e pergunte quem é."

7. [minor] fe-69-02-change-counting-up / hook-01 / es-MX — The narration opens with a plural "Te damos la bienvenida a mi puesto" right before "Hoy atiendo" (singular Rho). FIX: "Te damos la bienvenida a mi puesto de la feria LittleFounders." -> "Te doy la bienvenida a mi puesto de la feria LittleFounders."

8. [minor] fe-69-02-change-counting-up / practice-01, transfer-01 / es-MX and pt-BR — "Párate en 17" and "Fique no 17" are not what a child says for "start at 17" (párate = stand up; "fique no 17" = stay at 17, which loses the movement). FIX:
   - practice-01 es-MX: "Párate en 17, suma una moneda y di el total nuevo." -> "Empieza en 17, suma una moneda y di el total nuevo."
   - practice-01 pt-BR: "Fique no 17, some uma moeda e diga o novo total." -> "Comece no 17, some uma moeda e diga o novo total."
   - transfer-01 es-MX: "El mismo movimiento que con Ari: párate en el precio y sube." -> "El mismo movimiento que con Ari: empieza en el precio y sube."
   - transfer-01 pt-BR: "O mesmo movimento de Ari: fique no preço e suba." -> "O mesmo movimento do Ari: comece no preço e suba."

9. [minor] fe-69-01-count-coins / guided-01 / pt-BR — "Monte-a" (enclitic) is stiff for a child's instruction. FIX: "A segunda pilha da Dina vale 24. Monte-a, das maiores às menores." -> "A segunda pilha da Dina vale 24. Monte essa pilha, das maiores às menores."

10. [minor, taste-leaning] fe-69-03-needs-and-wants and fe-69-04-market-stall / es-MX — "ordena" for "sort into two bins" can read as "tidy up". "Separa" is the plain word for ages 6-9. FIX:
   - 69-03 pre-01: "Mercado de Liruf: ordena cada cosa y elige por qué." -> "Mercado de Liruf: separa cada cosa y elige por qué."
   - 69-03 ask-bread-01: "Liruf ordena el pan." -> "Liruf decide dónde va el pan."
   - 69-03 ask-toy-01: "Liruf ordena el juguete." -> "Liruf decide dónde va el juguete."
   - 69-03 guided-01: "Tu turno: ordena con la pregunta de Liruf y elige por qué." -> "Tu turno: separa con la pregunta de Liruf y elige por qué."
   - 69-03 practice-01: "Liruf compra otra vez. Ordena cada cosa y elige por qué." -> "Liruf compra otra vez. Separa cada cosa y elige por qué."
   - 69-03 transfer-01: "Paseo escolar: el pronóstico dice lluvia. Ordena y elige por qué." -> "Paseo escolar: el pronóstico dice lluvia. Separa y elige por qué."
   - 69-04 practice-sort: "Ordena las canastas del tianguis y elige por qué." -> "Separa las canastas del tianguis y elige por qué."

11. [minor] fe-69-03-needs-and-wants / hook-01 and pre-01 / en-US and pt-BR — "market day" is not what an American child says for an errand and "dia de mercado" is a calque of the es-MX line; the lesson is declared `universal`, so a plain "store" works in every market. FIX:
   - hook-01 en-US prompt: "Liruf is at the market." -> "Liruf is at the store."
   - hook-01 en-US line: "Stomp, stomp, market day. I have a few coins, and dinner waits." -> "Stomp, stomp, shopping time. I only have a few coins, and dinner is waiting."
   - hook-01 pt-BR line: "Tum, tum, dia de mercado. Tenho poucas moedas e o jantar espera." -> "Tum, tum, hora de comprar. Tenho poucas moedas e o jantar espera."
   - pre-01 en-US prompt: "Liruf's market: sort each thing, then pick why." -> "Liruf's shopping trip: sort each thing, then pick why."
   - es-MX stays ("Mercado de Liruf", "día de mercado" are acceptable in Mexico). pt-BR "Mercado do Liruf" stays (mercado = supermarket in Brazil).

12. [minor] en-US / fe-69-02, fe-69-03, fe-69-04, fe-1012-01, fe-1012-02, fe-1012-04 — Child-directed copy is uncontracted in places, which reads translated, and one phrase is odd. FIX, exact:
   - 69-03 reasons (pre-01, guided-01, practice-01, transfer-01): "We cannot go without it" -> "We can't go without it"
   - 69-03 practice-01 help: "A need keeps us well. A want is just fun." -> "A need keeps us healthy. A want is just a treat."
   - 69-04 pre-stall feedback (both strings): "Noted. Now let us see it step by step." -> "Noted. Now let's see it step by step."
   - 69-02 hook-01 narration: "Watch closely, because I will measure exactly how much." -> "Watch closely, because I'll measure exactly how much."
   - 1012-01 help: "If it is not exact, use decimals: 5 divided by 2 is 2.5." -> "If it isn't exact, use decimals: 5 divided by 2 is 2.5."
   - 1012-02 transfer reasons: "It is the cheapest thing on the list" -> "It's the cheapest thing on the list"; "It is what I like least" -> "It's what I like least"
   - 1012-04 guided-01 help: "is not suspicious" -> "isn't suspicious" (full line: "A message from someone you know, with a normal request, isn't suspicious.")

13. [minor] fe-69-04-market-stall / ex-goal, ex-check / es-MX — "Doña" is capitalised mid-sentence. FIX: ex-goal "Jugo $5, pan $3, manzana $2. La meta de Doña Lupe es $10." -> "Jugo $5, pan $3, manzana $2. La meta de doña Lupe es $10."; ex-check "Paso 3: Doña Lupe paga con su moneda de $10." -> "Paso 3: doña Lupe paga sus $10 en monedas."

14. [minor] fe-69-04-market-stall / pre-stall / es-MX and pt-BR — "una" and "uma" point at nothing ("Prueba una primero", "Tente uma primeiro"). FIX: es-MX "Prueba una primero: llena la canasta para que cueste justo $7." -> "Inténtalo tú primero: llena la canasta para que cueste justo $7."; pt-BR "Tente uma primeiro: encha a cesta para custar exatamente R$ 7." -> "Tente você primeiro: encha a cesta para custar exatamente R$ 7."

15. [minor] fe-69-04-market-stall / zara-hook / en-US — "Dana will hand over one bill, so her basket has to come out to exactly that much" leaves the amount to the reader. FIX: narration "Every snack has a price sticker, and the cash box sits by the apples. Dana will hand over one bill, so her basket has to come out to exactly that much." -> "Every snack has a price sticker, and the cash box sits by the apples. Dana wants to spend her whole bill, no more and no less, so her basket has to come out to exactly $10."

16. [minor] fe-69-04-market-stall / practice-coins / es-MX, en-US, pt-BR — "added its money" is not how any of the three says it, and "alto da pilha" and "cash-box coins" read as translations. FIX:
   - es-MX F+: "La pila llegó al celular. Cada moneda sumó su dinero." -> "La pila llegó al celular. Cada moneda sumó lo que vale."
   - en-US F+: "The stack reached the phone. Every coin added its money." -> "The stack reached the phone. Every coin added what it is worth."
   - pt-BR F+: "A pilha chegou ao celular. Cada moeda somou seu dinheiro." -> "A pilha chegou ao celular. Cada moeda somou o que vale."
   - pt-BR F-: "Ainda não. Iguale o alto da pilha com o celular." -> "Ainda não. Iguale o topo da pilha com o celular."
   - en-US prompt: "Stack cash-box coins up to the phone. See the money add up." -> "Stack coins from the cash box up to the phone. See the money add up."

17. [minor] fe-69-04-market-stall / transfer-stall / es-MX and pt-BR — "Llena una canasta de justo $11" and "Encha uma cesta de exatos R$ 11" fill a basket "of" a price; the earlier steps say the basket should cost it. FIX: es-MX "Otro puesto vende juguetes. Llena una canasta de justo $11." -> "Otro puesto vende juguetes. Llena una canasta que cueste justo $11."; pt-BR "Outra barraca vende brinquedos. Encha uma cesta de exatos R$ 11." -> "Outra barraca vende brinquedos. Encha uma cesta que custe exatamente R$ 11."

18. [minor] fe-1012-01-unit-price / episode-01 / en-US — The recovery line drops the unit ("5, 4") and "the 6 win" is ungrammatical for a child. FIX: "I divide: 20 ÷ 4 is 5, 24 ÷ 6 is 4. Compare the price of one, and the 6 win." -> "I divide: 20 ÷ 4 is 5 coins a juice, 24 ÷ 6 is 4. Now I compare the price of one: I keep the 6."

19. [minor] fe-1012-01-unit-price / example-03 / en-US — "2 coins beats 3" compares bare numbers and "if I eat 3" hides the point that the other two spoil. FIX: "Compare: 2 coins beats 3, so the 5-pack wins. But if I eat 3, two yogurts spoil." -> "Compare: 2 coins each beats 3 coins each, so the 5-pack wins. But if I eat only 3, two yogurts spoil."

20. [minor] fe-1012-01-unit-price / practice-02 / es-MX and pt-BR — "cenan 4" and "comem 4" leave the unit out. FIX: es-MX "Hoy cenan 4 y mañana el pan ya está duro." -> "Hoy cenan 4 personas y mañana el pan ya está duro."; pt-BR "Hoje comem 4 e amanhã o pão já endureceu." -> "Hoje comem 4 pessoas e amanhã o pão já endureceu."

21. [minor] fe-1012-01-unit-price / transfer-01 / en-US — The prompt is a fragment string ("Price of one: which is the better buy?"). FIX: "Trading cards, pack of 5 or box of 12. Price of one: which is the better buy?" -> "Trading cards: a pack of 5 or a box of 12. Find the price of one and pick the better buy."

22. [minor] fe-1012-02-plan-the-budget / example-over-01 / en-US — "it passes by 4" is a translation of the es-MX "se pasa por 4". FIX: "Another list: bread 16, juice 9, grapes 19 add to 44. The club has 40, so it passes by 4." -> "Another list: bread 16, juice 9, grapes 19 add to 44. The club has 40, so the list is over by 4." Check the en-US spoken text of practice-over-01 ("the list passes by 4") the same way and use "the list is over by 4".

23. [minor] fe-1012-02-plan-the-budget / example-over-01, practice-over-01, transfer F- / pt-BR — "passa", "passa por 4", "veja quanto passa" use "passar" for "exceed" as a bare verb, which is es-MX "pasarse" carried over; the natural pt-BR verb is "ultrapassar". FIX:
   - example-over-01 prompt: "Uma lista que passa." -> "Uma lista que ultrapassa o dinheiro."
   - example-over-01 line: "O clube tem 40, então passa por 4." -> "O clube tem 40, então a lista ultrapassa em 4 moedas."
   - practice-over-01 prompt: "Nia tem 50 moedas: pão 17, suco 13, uvas 24. Some exato, veja quanto passa e depois tire o suco." -> "A Nia tem 50 moedas: pão 17, suco 13, uvas 24. Some os valores exatos, veja quanto ultrapassa e depois tire o suco."
   - practice-over-01 feedback.met: "Você somou exato, viu quanto passa e somou de novo sem o suco." -> "Você somou os valores exatos, viu quanto ultrapassa e somou de novo sem o suco."
   - practice-over-01 step 3 spokenText: "Cinquenta e quatro menos 50 são 4, então a lista passa por 4" -> "Cinquenta e quatro menos 50 são 4, então a lista ultrapassa em 4"
   - practice-over-01 and transfer-kites-01 feedback.not_yet: "Veja a lista que passou com Rho: ..." -> "Veja a lista que ultrapassou o dinheiro com o Rho: ..." (keep the text after the colon).

24. [minor] fe-1012-02-plan-the-budget / example-exact-01 / pt-BR — "some exato" and "Somamos exato" use an adjective as an adverb, which is es-MX "suma exacto" carried over. FIX: prompt "Caminho 2: some exato e veja quanto sobra." -> "Caminho 2: some os valores exatos e veja quanto sobra."; line "Somamos exato: 18 mais 23 são 41, e 41 mais 6 são 47. Depois 70 menos 47 sobra 23 moedas." -> "Somamos os valores exatos: 18 mais 23 são 41, e 41 mais 6 são 47. Depois 70 menos 47 sobram 23 moedas." (also fixes "sobra 23" to "sobram 23").

25. [minor] fe-1012-03-saving-plan / example-01, example-02, example-04 (and the hook) / es-MX, en-US, pt-BR — The prompt of all four Zara turns is the same "Escucha a Zara." / "Listen to Zara." / "Ouça a Zara."; a child on screen cannot tell which step they are on. Keep the hook as is and make the three example prompts name the step. FIX:
   - example-01: "Escucha a Zara." -> "Primero: lo que falta" / "Listen to Zara." -> "First: what is missing" / "Ouça a Zara." -> "Primeiro: o que falta"
   - example-02: "Escucha a Zara." -> "Ahora: las semanas" / "Listen to Zara." -> "Now: the weeks" / "Ouça a Zara." -> "Agora: as semanas"
   - example-04: "Escucha a Zara." -> "¿De dónde salen las 10 monedas?" / "Listen to Zara." -> "Where do the 10 coins come from?" / "Ouça a Zara." -> "De onde saem as 10 moedas?"

## Taste only (not counted)

- "Observa:" / "Observe:" openers in fe-69-02 and fe-1012-02 are stiff for Rho, who is warm; "Mira:" / "Look:" / "Olha:" would sound more like him. Also "Camino/Way/Caminho 1" in fe-1012-02 could be "Primera forma / First way / Primeira forma".
- fe-1012-01 Liruf lines are accurate but not playful (no "pum, pum" energy as in fe-69-03); one stomp or one food joke per episode would restore the voice.
- es-MX "¿puedo pasar sin eso?" and "No podemos pasar sin eso" in fe-69-03 are bookish; "¿Me hace falta?" and "Nos hace falta" are what a Mexican child says. A judgment call because the question is the lesson's named move.
- pt-BR "Lembre da Dina" (fe-69-01 transfer-01 F-) is common speech; "Lembre-se da Dina" is the formal form. Leave.

## Backlog: board-owned or payload-owned (not plan defects)

- B1. Board labels not reviewed with the plans (documented in `docs/content/FORGE-V2-PILOT-ROUNDS.md`, "Engine limits found by the pilot", row "Board-owned labels"). Exact places: `frontend/src/rebuild/learning/RunningLedgerBoard.tsx` line 35 (`supplies: 'Insumos'`, es-MX) and line 42 (`supplies: 'Insumos'`, pt-BR). "Insumos" is business jargon neither a Mexican nor a Brazilian child uses. Suggested: es-MX `Materiales`, pt-BR `Materiais`. The ledger board is not used by the 8 pilot plans, so no plan copy is affected. The `mm` unit on the coin-stack board comes from `frontend/src/rebuild/learning/horizonte/space1/space1Text.ts` (`lengthText`, "metric symbols are the same in every locale"). It is fine for es-MX and pt-BR; for en-US readers aged 6-9 millimeters are less familiar than inches. Keep mm (it is a coin thickness) and let the lesson name the unit once, or hide the unit on that board. Owner decision.
- B2. The price scale is not market-specific because `payload` is shared by all locales. In fe-69-04 the stall boards (tags apple $2, bread $3, juice $5, goal $10; toy stall goal $11; coin tray) are the same numbers for tianguis, driveway yard sale and feira livre. They read plausible in en-US and pt-BR and low but not absurd in es-MX (bolillo $3 is real, juice $5 is low). In fe-1012-01 the graded ratio boards (pre-01, guided-01, practice-01, practice-02 boards, transfer-01) also share numbers across the three markets, with only the noun changing. A per-locale payload override (or a price table by market) is an engine change; until then only the copy can adapt, as findings 3 and 20 do.
- B3. The goal-bullet and savings-line boards in fe-1012-03 print ISO codes (`MXN`, `USD`, `BRL`) next to the lesson's "monedas / coins / moedas" (already documented as an engine limit, row 80). The lesson text names its goal in coins (90 monedas, 90 coins, 90 moedas), so the board and the copy disagree about the unit until the board prints "coins" for in-app money.
- B4. The fe-69-04 stall board shows its item names and visuals (apple, bread, juice; kite, toy, book) as fixed assets for all three markets; the es-MX board will show "manzana, pan, jugo" where a tianguis would show "plátano, bolillo, agua fresca", and pt-BR "maçã, pão, suco" where a feira would show "banana, pastel, caldo de cana". Per-market item sets are a board and asset change.
