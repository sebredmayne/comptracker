import { useState, useEffect } from 'react';

function fmtV(n) {
  if (!n) return '—';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return Math.round(n).toString();
}

export default function YTBrandSummary() {
  const [brands, setBrands] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/youtube/brands').then(r => r.json()),
      fetch('/api/youtube/channels').then(r => r.json()),
    ]).then(([b, c]) => {
      setBrands(b);
      setChannels(c);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const channelMap = Object.fromEntries(channels.map(c => [c.brand_name, c]));
  const maxViews = Math.max(...brands.map(b => b.max_views || 0), 1);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Channel Overview</h2>
        <p className="text-sm text-gray-500">Performance summary per competitor channel</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : brands.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No data yet — run the tracker first</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map(brand => {
            const ch = channelMap[brand.brand_name];
            return (
              <div key={brand.brand_name} className={`rounded-xl border p-5 ${
                brand.brand_name === 'Little Joys' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{brand.brand_name}</h3>
                    {ch && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtV(ch.subscriber_count)} subscribers
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {brand.viral_count > 0 && (
                      <span className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                        🔥 {brand.viral_count} viral
                      </span>
                    )}
                    {brand.collab_count > 0 && (
                      <span className="text-xs bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
                        🤝 {brand.collab_count} collab
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Videos tracked</span>
                    <span className="font-medium">{brand.total_videos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Peak views</span>
                    <span className="font-medium text-red-600">{fmtV(brand.max_views)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-red-400 h-1.5 rounded-full"
                      style={{ width: `${(brand.max_views / maxViews) * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg views</span>
                    <span className="font-medium">{fmtV(brand.avg_views)}</span>
                  </div>
                  {brand.boost_count > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Likely boosted</span>
                      <span className="font-medium text-amber-600">💰 {brand.boost_count}</span>
                    </div>
                  )}
                  {brand.latest_video && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Latest video</span>
                      <span className="text-xs text-gray-500">
                        {new Date(brand.latest_video).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
