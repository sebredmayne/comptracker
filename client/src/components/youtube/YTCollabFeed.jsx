import { useState, useEffect } from 'react';

function fmtV(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

export default function YTCollabFeed() {
  const [videos, setVideos] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ brand: '', limit: 20 });

  useEffect(() => {
    fetch('/api/youtube/brands/list').then(r => r.json()).then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.brand) params.set('brand', filter.brand);
    params.set('limit', filter.limit);
    fetch(`/api/youtube/collabs?${params}`)
      .then(r => r.json())
      .then(data => { setVideos(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Influencer Collaborations</h2>
          <p className="text-sm text-gray-500">
            Videos flagged for collab/sponsorship signals in title, description, or tags
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter.brand}
            onChange={e => setFilter(f => ({ ...f, brand: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select
            value={filter.limit}
            onChange={e => setFilter(f => ({ ...f, limit: Number(e.target.value) }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value={20}>Show 20</option>
            <option value={50}>Show 50</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No collabs detected yet</div>
      ) : (
        <div className="space-y-3">
          {videos.map(video => {
            const ytUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
            return (
              <div key={video.video_id} className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                <div className="flex gap-4">
                  {video.thumbnail_url && (
                    <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                      <img src={video.thumbnail_url} alt={video.title}
                        className="w-28 h-18 object-cover rounded-lg" />
                    </a>
                  )}
                  <div className="flex-1 min-w-0">
                    <a href={ytUrl} target="_blank" rel="noopener noreferrer"
                      className="font-semibold text-gray-900 hover:text-purple-700 text-sm line-clamp-2">
                      {video.title}
                    </a>

                    <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        video.brand_name === 'Little Joys' ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-700'
                      }`}>
                        {video.brand_name}
                      </span>
                      <span className="text-xs bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full font-medium">
                        🤝 Collab
                      </span>
                      {video.is_viral === 1 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                          🔥 {video.viral_multiple}x viral
                        </span>
                      )}
                      {video.is_paid_boost === 1 && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                          💰 Boosted
                        </span>
                      )}
                    </div>

                    {/* Collab signals */}
                    <p className="text-xs text-purple-700 font-medium mb-1">
                      Signals found: {video.collab_signals}
                    </p>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                      <span>👁 <strong>{fmtV(video.view_count)}</strong></span>
                      <span>👍 {fmtV(video.like_count)}</span>
                      <span className="text-gray-400">
                        {video.published_at
                          ? new Date(video.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        💡 Detection is keyword-based. Review each flagged video — some may be false positives.
        Add more keywords in <code>COLLAB_KEYWORDS</code> in youtubeTracker.js for better coverage.
      </p>
    </div>
  );
}
