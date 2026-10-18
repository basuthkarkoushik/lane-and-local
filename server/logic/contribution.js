const REQUIRED = [
  'basket_inr',
  'merchant_fee_pct',
  'customer_fee_inr',
  'rider_cost_inr',
  'support_inr',
  'payment_inr',
];

const round2 = (n) => Math.round(n * 100) / 100;

function calculateContribution(order) {
  // null / missing means unknown, never zero
  const missing = REQUIRED.filter(
    (k) => order[k] === null || order[k] === undefined || Number.isNaN(Number(order[k]))
  );
  if (missing.length > 0) {
    return { valid: false, missing, explanation: `Missing values: ${missing.join(', ')}` };
  }

  const negative = REQUIRED.filter((k) => Number(order[k]) < 0);
  if (negative.length > 0) {
    return { valid: false, missing: [], explanation: `Negative values not allowed: ${negative.join(', ')}` };
  }
  if (Number(order.merchant_fee_pct) > 100) {
    return { valid: false, missing: [], explanation: 'Merchant fee % cannot be above 100' };
  }

  const basket = Number(order.basket_inr);
  const merchantFee = round2((basket * Number(order.merchant_fee_pct)) / 100);
  const customerFee = Number(order.customer_fee_inr);
  const riderCost = Number(order.rider_cost_inr);
  const supportCost = Number(order.support_inr);
  const paymentCost = Number(order.payment_inr);

  const revenue = round2(merchantFee + customerFee);
  const costs = round2(riderCost + supportCost + paymentCost);
  const contribution = round2(revenue - costs);
  const isLoss = contribution < 0;

  const explanation =
    `Merchant fee ₹${merchantFee} (${order.merchant_fee_pct}% of ₹${basket}) + customer fee ₹${customerFee} ` +
    `= ₹${revenue} income. Less rider ₹${riderCost}, support ₹${supportCost}, payment ₹${paymentCost} ` +
    `= ₹${costs} costs. Contribution = ${isLoss ? '-' : ''}₹${Math.abs(contribution)}.` +
    (isLoss ? ' LOSS: this order loses money before any other overhead.' : '') +
    ' (Contribution is not final net profit.)';

  return {
    valid: true,
    merchant_fee_inr: merchantFee,
    customer_fee_inr: customerFee,
    rider_cost_inr: riderCost,
    support_inr: supportCost,
    payment_inr: paymentCost,
    revenue_inr: revenue,
    costs_inr: costs,
    contribution_inr: contribution,
    is_loss: isLoss,
    explanation,
  };
}

module.exports = { calculateContribution };