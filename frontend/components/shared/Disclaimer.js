export default function Disclaimer({ className = '' }) {
  return (
    <p className={`text-xs text-gray-600 leading-relaxed text-center ${className}`}>
      ValuBull is an educational tool for financial analysis and is not a registered
      investment adviser. All data is provided for informational purposes only and does
      not constitute investment, legal, or tax advice. Financial data is sourced from
      SEC EDGAR, Financial Modeling Prep, and Polygon.io and may be delayed or
      inaccurate. Past performance is not indicative of future results. Always consult
      a qualified financial professional before making any investment decision.
    </p>
  );
}
