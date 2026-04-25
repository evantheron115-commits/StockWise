import { useState, useEffect, useRef } from 'react';

// Generates a one-sentence contextual insight from DCF output.
// Rule-based — no LLM call. Produces genuinely useful analysis from the numbers.
function buildInsight(iv, currentPrice, inputs, result) {
  if (iv == null || !currentPrice || !result) return null;

  const margin      = ((iv - currentPrice) / currentPrice) * 100;
  const absMargin   = Math.abs(margin).toFixed(1);
  const isUnder     = margin > 0;

  const growthLabel = inputs.growthRate <= 5  ? 'conservative'
                    : inputs.growthRate <= 12 ? 'moderate'
                    : inputs.growthRate <= 20 ? 'aggressive'
                    : 'highly aggressive';

  const tvPctStr  = result.steps?.tvAsPercentOfEV ?? '0%';
  const tvPct     = parseFloat(tvPctStr);
  const termHeavy = tvPct > 68;
  const termLight = tvPct < 45;

  const discountHigh = inputs.discountRate >= 14;
  const discountLow  = inputs.discountRate <= 7;

  if (isUnder && !termHeavy && !discountHigh) {
    return `Model implies a ${absMargin}% margin of safety using ${growthLabel} assumptions — value is grounded in near-term cash flows rather than terminal estimates.`;
  }
  if (isUnder && termHeavy) {
    return `${absMargin}% upside indicated, though ${tvPct.toFixed(0)}% of enterprise value stems from the terminal year — results are sensitive to long-run growth and discount assumptions.`;
  }
  if (isUnder && discountHigh) {
    return `Model shows ${absMargin}% upside even at a ${inputs.discountRate}% discount rate, suggesting the margin of safety holds under demanding return assumptions.`;
  }
  if (!isUnder && Math.abs(margin) < 12) {
    return `Market price is ${absMargin}% above model value at ${growthLabel} growth — a modest premium that could be explained by intangibles or near-term expectations not captured in historical FCF.`;
  }
  if (!isUnder && discountLow) {
    return `Trading ${absMargin}% above intrinsic value at a ${inputs.discountRate}% discount rate — raising WACC to reflect a higher required return would widen the gap further.`;
  }
  if (!isUnder && termLight) {
    return `Model prices ${absMargin}% below market, with only ${tvPct.toFixed(0)}% of value in the terminal period — the market may be pricing in materially higher FCF growth than the ${inputs.growthRate}% modelled here.`;
  }
  return `At ${growthLabel} FCF growth (${inputs.growthRate}%) and ${inputs.discountRate}% WACC, the model prices the stock ${absMargin}% ${isUnder ? 'below' : 'above'} current market price.`;
}

// JS typewriter — reveals text one character at a time, consistent for any string length
function useTypewriter(text, charDelay = 18) {
  const [displayed, setDisplayed] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timerRef.current);
    }, charDelay);
    return () => clearInterval(timerRef.current);
  }, [text, charDelay]);

  return displayed;
}

export default function NeuralSummary({ iv, currentPrice, inputs, result }) {
  const insight  = buildInsight(iv, currentPrice, inputs, result);
  const revealed = useTypewriter(insight ?? '');

  if (!insight) return null;

  return (
    <div
      className="rounded-xl px-4 py-3.5 mb-5"
      style={{
        background: 'rgba(99, 102, 241, 0.06)',
        border:     '1px solid rgba(99, 102, 241, 0.18)',
        boxShadow:  '0 0 20px rgba(99, 102, 241, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[10px] font-mono font-medium tracking-widest uppercase"
          style={{ color: 'rgba(129, 140, 248, 0.70)' }}
        >
          Model Insight
        </span>
        {/* Pulsing dot — indicates "live" computation */}
        <span
          className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"
          style={{ boxShadow: '0 0 6px rgba(99,102,241,0.8)' }}
        />
      </div>

      <p className="text-sm leading-relaxed neural-text font-mono">
        {revealed}
        {/* Blinking cursor while text is still typing */}
        {revealed.length < (insight?.length ?? 0) && (
          <span
            className="inline-block w-0.5 h-3.5 ml-0.5 bg-brand-400 align-middle"
            style={{ animation: 'cursor-blink 0.7s step-end infinite' }}
          />
        )}
      </p>
    </div>
  );
}
