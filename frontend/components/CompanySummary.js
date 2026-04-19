export default function CompanySummary({ company }) {
  if (!company) {
    return (
      <div className="card mb-6 text-sm text-gray-600">
        Company data unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Description */}
      <div className="card">
        <h2 className="text-base font-medium text-white mb-3">About {company.name}</h2>
        {company.description ? (
          <p className="text-sm text-gray-400 leading-relaxed">{company.description}</p>
        ) : (
          <p className="text-sm text-gray-600">No description available.</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-800">
          {[
            ['Sector',    company.sector],
            ['Industry',  company.industry],
            ['Exchange',  company.exchange],
            ['Country',   company.country],
            ['Employees', company.employees?.toLocaleString()],
            ['Website',   company.website],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-600 mb-0.5">{label}</p>
              {label === 'Website' ? (
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-400 hover:underline truncate block"
                >
                  {value}
                </a>
              ) : (
                <p className="text-sm text-gray-300">{value}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* News placeholder — populated in Phase 3 */}
      <div className="card">
        <h2 className="text-base font-medium text-white mb-3">Latest News</h2>
        <p className="text-sm text-gray-600">News feed coming soon.</p>
      </div>
    </div>
  );
}
