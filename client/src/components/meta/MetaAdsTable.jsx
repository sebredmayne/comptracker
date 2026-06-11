import { useState, useEffect } from 'react';

export default function MetaAdsTable() {
  const [ads, setAds] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ brand: '', platform: '', limit: 30 });

  useEffect(() => {
    fetch('/api/meta/brands/list')
      .then(r => r.json())
      .then(setBrands)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.platform) params.set('platform', filters.platform);
    params.set('limit', filters.limit);

    fetch(`/api/meta/ads?${params}`)
      .then(r => r.json())
      .then(data => { setAds(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filters]);

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }));
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={filters.brand}
          onChange={e => setFilter('brand', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select
          value={filters.platform}
          onChange={e => setFilter('platform', e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="">All Platforms</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
        </select>

        <select
          value={filters.limit}
          onChange={e => setFilter('limit', Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value={20}>Show 20</option>
          <option value={50}>Show 50</option>
          <option value={100}>Show 100</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading ads...</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No ads match these filters</div>
      ) : (
        <div className="space-y-3">
          {ads.map((ad, i) => (
            <div
              key={ad.ad_id || i}
              className={`rounded-xl border p-4 ${
                ad.is_new ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Hook */}
                  {ad.hook && (
                    <p className="font-semibold text-gray-900 mb-1">"{ad.hook}"</p>
                  )}
                  {/* Full body preview */}
                  {ad.body && ad.body !== ad.hook && (
                    <p className="text-sm text-gray-600 line-clamp-2">{ad.body}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {/* Brand */}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      ad.brand_name === 'Little Joys'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}>
                      {ad.brand_name}
                    </span>

                    {/* Platform */}
                    {(ad.platforms || '').split(',').filter(Boolean).map(p => (
                      <span key={p} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p === 'instagram' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {p === 'instagram' ? '📸 IG' : '👤 FB'}
                      </span>
                    ))}

                    {/* Days running */}
                    <span className="text-xs text-gray-500">
                      Running {ad.days_running}d {ad.days_running > 14 ? '🔥' : ''}
                    </span>

                    {/* New badge */}
                    {ad.is_new === 1 && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-medium">
                        NEW
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side: impressions + link */}
                <div className="text-right flex-shrink-0">
                  <div className="text-xs text-gray-500 mb-0.5">Est. Impressions</div>
                  <div className="text-sm font-bold text-purple-700">
                    {ad.impression_lower
                      ? `${fmtN(ad.impression_lower)}–${fmtN(ad.impression_upper)}`
                      : '—'
                    }
                  </div>
                  {ad.snapshot_url && (
                    <a
                      href={ad.snapshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline mt-1 block"
                    >
                      View creative →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtN(n) {
  if (!n) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n;
}
