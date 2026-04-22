import { useState } from 'react';
import { runDCF } from '../lib/api';

const DEFAULT_INPUTS = {
  growthRate:     10,
  discountRate:   10,
  terminalGrowth: 3,
  forecastYears:  10,
};

function fmtVal(n) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

function SliderInput({ label, value, min, max, step, unit, onChange, hint }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-400">{label}</label>
        <span className="text-xs font-mono text-brand-400 font-medium">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full accent-brand-500 cursor-pointer"
      />
      {hint && <p className="text-xs text-gray-700 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function DCFTool({ ticker, currentPrice }) {
  const [inputs, setInputs] = useState(DEFAULT_INPUTS);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const set = (key) => (val) => setInputs((prev) => ({ ...prev, [key]: val }));

  async function handleRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await runDCF(ticker, {
        growthRate:     inputs.growthRate / 100,
        discountRate:   inputs.discountRate / 100,
        terminalGrowth: inputs.terminalGrowth / 100,
        forecastYears:  inputs.forecastYears,
      });
      setResult(data);
    } catch (err) {
      setError(
        err.isRateLimit
          ? 'API rate limit reached. Please wait a few minutes and try again.'
          : (err.response?.data?.error || 'DCF calculation failed. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }

  const iv = result?.results?.intrinsicValuePerShare;
  const margin = iv != null && currentPrice > 0
    ? ((iv - currentPrice) / currentPrice * 100)
    : null;

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-medium text-white">DCF Valuation</h2>
          <p className="text-xs text-gray-600 mt-0.5">
            Discounted Free Cash Flow model
          </p>
        </div>
        <span className="text-xs text-gray-600 bg-gray-800 px-2 py-1 rounded">
          {ticker}
        </span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <SliderInput
          label="Revenue / FCF Growth Rate"
          value={inputs.growthRate}
          min={-5} max={40} step={0.5} unit="%"
          onChange={set('growthRate')}
          hint="Expected annual growth for forecast period"
        />
        <SliderInput
          label="Discount Rate (WACC)"
          value={inputs.discountRate}
          min={5} max={20} step={0.5} unit="%"
          onChange={set('discountRate')}
          hint="Required rate of return / cost of capital"
        />
        <SliderInput
          label="Terminal Growth Rate"
          value={inputs.terminalGrowth}
          min={0} max={5} step={0.5} unit="%"
          onChange={set('terminalGrowth')}
          hint="Perpetual growth rate after forecast period"
        />
        <SliderInput
          label="Forecast Period"
          value={inputs.forecastYears}
          min={5} max={20} step={1} unit=" yrs"
          onChange={set('forecastYears')}
          hint="Number of years to project cash flows"
        />
      </div>

      <button
        onClick={handleRun}
        disabled={loading}
        className="btn-primary w-full mb-5"
      >
        {loading ? 'Calculating...' : 'Run DCF Valuation →'}
      </button>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 mb-4">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-5 border-t border-gray-800 pt-5">

          {/* Intrinsic value banner */}
          <div className="bg-gray-800/60 rounded-xl p-5 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Intrinsic Value per Share
            </p>
            <p className="text-4xl font-mono font-semibold text-white">
              ${iv?.toFixed(2) ?? '—'}
            </p>
            {margin != null && currentPrice && (
              <div className="mt-2 flex items-center justify-center gap-3 text-sm">
                <span className="text-gray-500">Current price: ${currentPrice?.toFixed(2)}</span>
                <span className={`font-mono font-medium ${margin >= 0 ? 'up' : 'down'}`}>
                  {margin >= 0 ? '▲ Trading below model value' : '▼ Trading above model value'} by {Math.abs(margin).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['PV of FCFs',       fmtVal(result.steps.pvOfFCFs)],
              ['Terminal Value PV',fmtVal(result.steps.terminalValuePV)],
              ['Enterprise Value', fmtVal(result.results.enterpriseValue)],
              ['Equity Value',     fmtVal(result.results.equityValue)],
            ].map(([label, val]) => (
              <div key={label} className="stat-card">
                <p className="text-xs text-gray-600 mb-1">{label}</p>
                <p className="font-mono text-sm text-gray-200">{val}</p>
              </div>
            ))}
          </div>

          {/* Step-by-step projected flows */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Step-by-Step Cash Flow Projections
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    {['Year', 'Projected FCF', 'Present Value', 'Cumulative PV'].map((h) => (
                      <th key={h} className={`pb-2 font-normal text-gray-600 ${h === 'Year' ? 'text-left' : 'text-right'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.steps.projectedFlows || []).map((f, i) => {
                    const cumPV = result.steps.projectedFlows
                      .slice(0, i + 1)
                      .reduce((s, x) => s + x.presentValue, 0);
                    return (
                      <tr key={f.year} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="py-2 text-gray-400">Year {f.year}</td>
                        <td className="py-2 text-right font-mono text-gray-300">{fmtVal(f.projectedFCF)}</td>
                        <td className="py-2 text-right font-mono text-gray-300">{fmtVal(f.presentValue)}</td>
                        <td className="py-2 text-right font-mono text-gray-400">{fmtVal(cumPV)}</td>
                      </tr>
                    );
                  })}
                  {/* Terminal value row */}
                  <tr className="border-t border-gray-700 bg-gray-800/30">
                    <td className="py-2 text-gray-300 font-medium">Terminal Value</td>
                    <td className="py-2 text-right font-mono text-gray-300">{fmtVal(result.steps.terminalValue)}</td>
                    <td className="py-2 text-right font-mono text-brand-400">{fmtVal(result.steps.terminalValuePV)}</td>
                    <td className="py-2 text-right text-xs text-gray-600">
                      {result.steps.tvAsPercentOfEV} of EV
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Inputs used */}
          <div className="bg-gray-800/30 rounded-lg p-4">
            <p className="text-xs text-gray-600 mb-2 uppercase tracking-wider">Inputs used</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 font-mono">
              <span>Base FCF: {fmtVal(result.inputs.freeCashFlow)}</span>
              <span>Growth: {result.inputs.growthRate}</span>
              <span>WACC: {result.inputs.discountRate}</span>
              <span>Terminal: {result.inputs.terminalGrowth}</span>
              <span>Period: {result.inputs.forecastYears}y</span>
              <span>Net Debt: {fmtVal(result.inputs.netDebt)}</span>
              <span>Shares: {result.inputs.sharesOutstanding?.toLocaleString()}M</span>
            </div>
          </div>

          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg px-4 py-3">
            <p className="text-xs text-yellow-600/80 leading-relaxed">
              <span className="font-semibold text-yellow-500/90">Educational Tool.</span>{' '}
              This DCF model is based on the most recent reported Free Cash Flow and your custom
              assumptions. Model outputs are for educational and research purposes only and do
              not constitute financial advice, investment recommendations, or an offer to buy
              or sell any security. All assumptions are user-defined; results will vary
              materially with different inputs. Consult a qualified financial professional
              before making any investment decision.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
