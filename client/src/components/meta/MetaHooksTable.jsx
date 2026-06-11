import { useState, useEffect } from 'react';

function ImpressionBadge({ lower, upper }) {
  if (!lower && !upper) return <span className="text-gray-400 text-xs">Unknown</span>;
  const fmt = n => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : n;
  return (
    <span className="text-xs font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
      {fmt(lower)}–{fmt(upper)}
    </span>
  );
}

function PlatformTag({ platforms }) {
  const list = (platforms || '').split(',').filter(Boolean);
  return (
    <div className="flex gap-1 flex-wrap">
      {list.map(p => (
        <span key={p} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          p === 'instagram' ? 'bg-pink-50 text-pink-700' :
          p === 'facebook'  ? 'bg-blue-50 text-blue-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {p === 'instagram' ? '📸 IG' : p === 'facebook' ? '👤 FB' : p}
        </span>
      ))}
    </div>
  );
}

export default function MetaHooksTable() {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meta/hooks?limit=${limit}`)
      .then(r => r.json())
      .then(data => { setHooks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [limit]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Top Ad Hooks</h2>
          <p className="text-sm text-gray-500">First line of ad copy, ranked by estimated impressions</p>
        </div>
        <select
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5"
        >
          <option value={10}>Top 10</option>
          <option value={20}>Top 20</option>
          <option value={50}>Top 50</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading hooks...</div>
      ) : hooks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No hooks yet — run the tracker first
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Hook</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Brand</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Impressions</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Days Running</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Platform</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {hooks.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="text-gray-900 font-medium leading-snug max-w-md">
                      "{row.hook}"
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      row.brand_name === 'Little Joys'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}>
                      {row.brand_name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ImpressionBadge lower={row.impression_lower} upper={row.impression_upper} />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${row.days_running > 14 ? 'text-green-600' : 'text-gray-500'}`}>
                      {row.days_running}d {row.days_running > 14 ? '🔥' : ''}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <PlatformTag platforms={row.platforms} />
                  </td>
                  <td className="px-4 py-3">
                    {row.snapshot_url && (
                      <a
                        href={row.snapshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 text-xs"
                      >
                        View →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        💡 Ads running 14+ days are likely top performers — Meta stops underperforming creatives fast.
      </p>
    </div>
  );
}
