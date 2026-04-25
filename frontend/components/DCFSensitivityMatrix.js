import { useMemo } from 'react';

// Mirrors backend utils/dcf.js exactly — same iteration, same terminal value formula.
// All monetary values in millions (matching backend convention).
function calcIV(baseFCF, growthRate, discountRate, terminalGrowth, forecastYears, netDebt, shares) {
  if (discountRate <= terminalGrowth || baseFCF <= 0 || shares <= 0) return null;
  let cashFlow = baseFCF;
  let pvSum    = 0;
  for (let y = 1; y <= forecastYears; y++) {
    cashFlow *= (1 + growthRate);
    pvSum    += cashFlow / Math.pow(1 + discountRate, y);
  }
  const tv   = (cashFlow * (1 + terminalGrowth)) / Math.max(discountRate - terminalGrowth, 0.0001);
  const tvPV = tv / Math.pow(1 + discountRate, forecastYears);
  const equity = (pvSum + tvPV) - netDebt;
  return equity / shares;
}

function fmt(iv) {
  if (iv == null) return '—';
  return `$${Math.max(0, iv).toFixed(0)}`;
}

function pctVsPrice(iv, price) {
  if (iv == null || !price) return null;
  return ((iv - price) / price) * 100;
}

export default function DCFSensitivityMatrix({ inputs, result, currentPrice }) {
  if (!result?.inputs) return null;

  const baseFCF  = result.inputs.freeCashFlow;
  const netDebt  = result.inputs.netDebt  ?? 0;
  const shares   = result.inputs.sharesOutstanding;
  const termGrow = inputs.terminalGrowth / 100;
  const years    = inputs.forecastYears;

  // Columns: growth rate ± 2 percentage points
  const gSteps = [inputs.growthRate - 2, inputs.growthRate, inputs.growthRate + 2];
  // Rows: discount rate ± 1 percentage point, high→low top-to-bottom
  const dSteps = [inputs.discountRate + 1, inputs.discountRate, inputs.discountRate - 1];

  const matrix = useMemo(() =>
    dSteps.map(d =>
      gSteps.map(g =>
        calcIV(baseFCF, g / 100, d / 100, termGrow, years, netDebt, shares)
      )
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inputs.growthRate, inputs.discountRate, inputs.terminalGrowth, inputs.forecastYears,
     baseFCF, netDebt, shares]
  );

  return (
    <div className="border-t border-gray-800 pt-5 mt-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Sensitivity Matrix</h3>
        <p className="text-[10px] text-gray-600 font-mono">WACC ↓ / Growth →</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="pb-2 w-12" />
              {gSteps.map(g => (
                <th key={g} className="pb-2 text-center font-mono text-gray-500 font-normal">
                  {g < 0 ? g : `+${g}`}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dSteps.map((d, ri) => (
              <tr key={d}>
                <td className="py-1 pr-2 font-mono text-gray-600 text-[10px] text-right whitespace-nowrap">
                  {d}%
                </td>
                {gSteps.map((g, ci) => {
                  const iv        = matrix[ri][ci];
                  const isCenter  = ri === 1 && ci === 1;
                  const delta     = pctVsPrice(iv, currentPrice);
                  const isUp      = delta != null && delta >= 0;

                  const bgStyle = isCenter
                    ? { background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.30)' }
                    : iv == null
                      ? { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }
                      : delta >= 20
                        ? { background: 'rgba(52,211,153,0.14)', border: '1px solid rgba(52,211,153,0.25)' }
                        : delta >= 0
                          ? { background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.12)' }
                          : delta >= -20
                            ? { background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.12)' }
                            : { background: 'rgba(248,113,113,0.14)', border: '1px solid rgba(248,113,113,0.25)' };

                  const glow = isCenter
                    ? { boxShadow: '0 0 12px rgba(99,102,241,0.18)' }
                    : {};

                  return (
                    <td key={g} className="py-1 px-0.5">
                      <div
                        className="rounded-lg px-1.5 py-2 text-center transition-colors"
                        style={{ ...bgStyle, ...glow }}
                      >
                        <p className={`font-mono font-semibold text-xs leading-none ${
                          iv == null ? 'text-gray-700' :
                          isCenter   ? 'text-indigo-300' :
                          isUp       ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {fmt(iv)}
                        </p>
                        {delta != null && currentPrice && (
                          <p className="text-[9px] font-mono mt-0.5 text-gray-600">
                            {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%
                          </p>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-gray-700 mt-2.5 text-center leading-relaxed">
        Center = current inputs · Updates live with sliders ·
        Base FCF: ${(baseFCF / 1000).toFixed(1)}B
      </p>
    </div>
  );
}
