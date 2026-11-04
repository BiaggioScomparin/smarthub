import type { ChannelConfig, ChannelId, PriceCalculationResult } from "../types.ts";

export interface PricingParams {
  cost_price: number;
  packaging_cost: number;
  other_costs: number;
  tax_percent: number;
  target_profit_type: "percent" | "fixed";
  target_profit_value: number;
}

export function calculatePriceForChannel(
  channel: ChannelConfig,
  params: PricingParams
): PriceCalculationResult {
  const costPrice = Math.max(0, Number(params.cost_price) || 0);
  const packagingCost = Math.max(0, Number(params.packaging_cost) || 0);
  const otherCosts = Math.max(0, Number(params.other_costs) || 0);
  const taxPercent = Math.max(0, Number(params.tax_percent) || 0) / 100;
  const totalCost = costPrice + packagingCost + otherCosts;

  const feePercent = (Number(channel.fee_percent) || 16) / 100;
  const fixedFee = Number(channel.fixed_fee) || 0;

  let suggestedPrice = 0;
  let netProfitAmount = 0;

  if (params.target_profit_type === "fixed") {
    // Fixed profit in R$
    netProfitAmount = Math.max(0, Number(params.target_profit_value) || 0);
    const denominator = 1 - (feePercent + taxPercent);
    if (denominator <= 0.05) {
      suggestedPrice = (totalCost + fixedFee + netProfitAmount) / 0.5;
    } else {
      suggestedPrice = (totalCost + fixedFee + netProfitAmount) / denominator;
    }
  } else {
    // Percent margin on sale price (Margem Líquida)
    const profitMargin = Math.min(0.70, Math.max(0.01, (Number(params.target_profit_value) || 25) / 100));
    const denominator = 1 - (feePercent + taxPercent + profitMargin);
    if (denominator <= 0.05) {
      suggestedPrice = (totalCost + fixedFee) / 0.3;
    } else {
      suggestedPrice = (totalCost + fixedFee) / denominator;
    }
    netProfitAmount = suggestedPrice * profitMargin;
  }

  // Round price to .90 (common e-commerce psychological pricing) or 2 decimals
  suggestedPrice = Math.round(suggestedPrice * 100) / 100;

  const marketplaceFeeAmount = (suggestedPrice * feePercent) + fixedFee;
  const taxAmount = suggestedPrice * taxPercent;
  const actualProfit = suggestedPrice - totalCost - marketplaceFeeAmount - taxAmount;
  const actualMarginPercent = suggestedPrice > 0 ? (actualProfit / suggestedPrice) * 100 : 0;

  return {
    channel_id: channel.id,
    channel_name: channel.name,
    total_cost: Number(totalCost.toFixed(2)),
    fee_percent: Number((feePercent * 100).toFixed(1)),
    fixed_fee: Number(fixedFee.toFixed(2)),
    tax_percent: Number((taxPercent * 100).toFixed(1)),
    suggested_price: Number(suggestedPrice.toFixed(2)),
    marketplace_fee_amount: Number(marketplaceFeeAmount.toFixed(2)),
    tax_amount: Number(taxAmount.toFixed(2)),
    net_profit_amount: Number(actualProfit.toFixed(2)),
    net_profit_margin_percent: Number(actualMarginPercent.toFixed(1))
  };
}
