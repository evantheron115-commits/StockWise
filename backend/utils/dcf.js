/**
 * DCF Calculation Engine
 * Transparent, step-by-step Discounted Cash Flow valuation.
 * All values in millions USD unless noted.
 */

function calculateDCF({
  freeCashFlow,   // Base FCF in millions
  growthRate,     // Annual growth rate (e.g. 0.10 for 10%)
  discountRate,   // WACC / required return (e.g. 0.10 for 10%)
  terminalGrowth, // Perpetual growth after forecast (e.g. 0.03)
  forecastYears,  // Number of years to project (5, 10, 20)
  netDebt,        // Total debt minus cash in millions
  sharesOutstanding, // Shares in millions
}) {
  // Validation
  if (discountRate <= terminalGrowth) {
    throw new Error('Discount rate must be greater than terminal growth rate.');
  }
  if (!freeCashFlow || freeCashFlow <= 0) {
    throw new Error('Free cash flow must be a positive number.');
  }

  // Step 1 — Project free cash flows
  const projectedFlows = [];
  let cashFlow = freeCashFlow;

  for (let year = 1; year <= forecastYears; year++) {
    cashFlow = cashFlow * (1 + growthRate);
    const presentValue = cashFlow / Math.pow(1 + discountRate, year);
    projectedFlows.push({
      year,
      projectedFCF: Math.round(cashFlow),
      presentValue: Math.round(presentValue),
    });
  }

  // Step 2 — Terminal value (Gordon Growth Model)
  const lastFCF = projectedFlows[projectedFlows.length - 1].projectedFCF;
  const terminalValue = (lastFCF * (1 + terminalGrowth)) / (discountRate - terminalGrowth);
  const terminalValuePV = terminalValue / Math.pow(1 + discountRate, forecastYears);

  // Step 3 — Enterprise value
  const pvOfFCFs = projectedFlows.reduce((sum, f) => sum + f.presentValue, 0);
  const enterpriseValue = pvOfFCFs + terminalValuePV;

  // Step 4 — Equity value and intrinsic value per share
  const equityValue = enterpriseValue - (netDebt || 0);
  const intrinsicValuePerShare = sharesOutstanding > 0
    ? equityValue / sharesOutstanding
    : null;

  return {
    inputs: {
      freeCashFlow,
      growthRate: `${(growthRate * 100).toFixed(1)}%`,
      discountRate: `${(discountRate * 100).toFixed(1)}%`,
      terminalGrowth: `${(terminalGrowth * 100).toFixed(1)}%`,
      forecastYears,
      netDebt: netDebt || 0,
      sharesOutstanding,
    },
    steps: {
      projectedFlows,
      pvOfFCFs: Math.round(pvOfFCFs),
      terminalValue: Math.round(terminalValue),
      terminalValuePV: Math.round(terminalValuePV),
      tvAsPercentOfEV: terminalValuePV > 0
        ? `${((terminalValuePV / enterpriseValue) * 100).toFixed(1)}%`
        : '0%',
    },
    results: {
      enterpriseValue: Math.round(enterpriseValue),
      equityValue: Math.round(equityValue),
      intrinsicValuePerShare: intrinsicValuePerShare
        ? parseFloat(intrinsicValuePerShare.toFixed(2))
        : null,
    },
  };
}

module.exports = { calculateDCF };
