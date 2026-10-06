import { locales } from './assemble.mjs';
// Every visible option receives a hint, so public hint membership never discloses the key.
const hints = {
  '24/guided-01': [
    ['This subtracts the payment but omits the added interest.', 'Update debt with the charge, then subtract the payment.', 'A minimum payment does not automatically clear all debt.'],
    ['Esto resta el pago, pero omite el interés añadido.', 'Actualiza la deuda con el cargo y resta el pago.', 'El pago mínimo no liquida automáticamente toda la deuda.'],
    ['Isso subtrai o pagamento, mas omite os juros adicionados.', 'Atualize a dívida com a cobrança e subtraia o pagamento.', 'O pagamento mínimo não quita automaticamente toda a dívida.'],
  ],
  '14/practice-01': [
    ['This is the discount amount, not the price after discount.', 'Subtract the percentage amount from the original price.', 'A percentage is a share, not a fixed money amount.'],
    ['Este es el descuento, no el precio después de descontar.', 'Resta el monto porcentual al precio original.', 'Un porcentaje es una proporción, no un monto fijo.'],
    ['Este é o desconto, não o preço depois de descontar.', 'Subtraia o valor percentual do preço original.', 'Um percentual é uma proporção, não um valor fixo.'],
  ],
};
export function attachFeedback(plans) {
  for (const plan of plans) for (const segment of plan.segments) {
    const values = hints[`${plan.lesson_id.split('-')[2]}/${segment.id}`];
    if (values) for (let i = 0; i < locales.length; i++) segment.copy[locales[i]].feedback.choice_hints = Object.fromEntries(values[i].map((text, j) => [`option-${j + 1}`, text]));
  }
}
