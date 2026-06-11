import { useState, useEffect } from 'react';

export default function MetaNewAds() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/meta/ads/new?limit=30')
      .then(r => r.json())
      .then(data => { setAds(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">New Ads This Week</h2>
        <p className="text-sm text-gray-500">
          Creatives spotted for the first time in the most recent tracker run
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : ads.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No new ads this run</p>
          <p className="text-gray-400 text-sm">All tracked ads were already in the database.</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-blue-700 mb-4">
            🆕 {ads.length} new ad{ads.length !== 1 ? 's' : ''} detected
          </p>
          <div className="space-y-3">
            {ads.map((ad, i) => (
              <div key={ad.ad_id || i} className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold">
                        NEW
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        ad.brand_name === 'Little Joys'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-50 text-orange-700'
                      }`}>
                        {ad.brand_name}
                      </span>
                      {(ad.platforms || '').split(',').filter(Boolean).map(p => (
                        <span key={p} className={`text-xs px-2 py-0.5 rounded-full ${
                          p === 'instagram' ? 'bg-pink-50 text-pink-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {p === 'instagram' ? '📸 IG' : '👤 FB'}
                        </span>
                      ))}
                    </div>

                    {ad.hook && (
                      <p className="font-semibold text-gray-900 mb-1">"{ad.hook}"</p>
                    )}
                    {ad.body && ad.body !== ad.hook && (
                      <p className="text-sm text-gray-600 line-clamp-2">{ad.body}</p>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      First seen: {new Date(ad.first_seen).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {ad.snapshot_url && (
                    <a
                      href={ad.snapshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"
                    >
                      View Ad →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
