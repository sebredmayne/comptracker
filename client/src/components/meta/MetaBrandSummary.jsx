import { useState, useEffect } from 'react';

function Bar({ value, max }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function fmt(n) {
  if (!n) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return Math.round(n).toString();
}

export default function MetaBrandSummary() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/meta/brands')
      .then(r => r.json())
      .then(data => { setBrands(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const maxImpressions = Math.max(...brands.map(b => b.max_impressions || 0), 1);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Brand Overview</h2>
        <p className="text-sm text-gray-500">Ad activity per competitor, ordered by highest estimated impressions</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : brands.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No data yet — run the tracker first</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map(brand => (
            <div
              key={brand.brand_name}
              className={`rounded-xl border p-5 ${
                brand.brand_name === 'Little Joys'
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{brand.brand_name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Last updated: {brand.last_updated
                      ? new Date(brand.last_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : '—'}
                  </p>
                </div>
                {brand.new_this_week > 0 && (
                  <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    +{brand.new_this_week} new
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Active Ads</span>
                    <span className="font-semibold text-gray-800">{brand.total_ads}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                    <span>Peak Impressions</span>
                    <span className="font-semibold text-purple-700">{fmt(brand.max_impressions)}</span>
                  </div>
                  <Bar value={brand.max_impressions} max={maxImpressions} />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Avg Impressions/Ad</span>
                    <span className="font-semibold text-gray-700">{fmt(brand.avg_impressions)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        ⚠️ Meta impression data is an estimated range, not exact counts. Use for relative comparison only.
      </p>
    </div>
  );
}
