import { useState, useEffect } from 'react';

function fmtV(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

function fmtDuration(secs) {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VideoCard({ video }) {
  const [expanded, setExpanded] = useState(false);
  const ytUrl = `https://www.youtube.com/watch?v=${video.video_id}`;

  return (
    <div className={`rounded-xl border p-4 ${
      video.brand_name === 'Little Joys' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex gap-4">
        {/* Thumbnail */}
        {video.thumbnail_url ? (
          <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-32 h-20 object-cover rounded-lg"
            />
          </a>
        ) : (
          <div className="w-32 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">▶</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title + brand */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <a
              href={ytUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-gray-900 hover:text-red-600 line-clamp-2 text-sm leading-snug"
            >
              {video.title}
            </a>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              video.brand_name === 'Little Joys' ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>
              {video.brand_name}
            </span>

            {/* Viral multiple badge */}
            <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              🔥 {video.viral_multiple}x avg
            </span>

            {/* Paid boost */}
            {video.is_paid_boost === 1 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium"
                title={video.boost_reason}>
                💰 Likely boosted
              </span>
            )}

            {/* Collab */}
            {video.is_collab === 1 && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                🤝 Collab
              </span>
            )}

            {video.duration_seconds > 0 && (
              <span className="text-xs text-gray-500">{fmtDuration(video.duration_seconds)}</span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <span>👁 <strong>{fmtV(video.view_count)}</strong> views</span>
            <span>👍 {fmtV(video.like_count)}</span>
            <span>💬 {fmtV(video.comment_count)}</span>
            <span className="text-gray-400">
              avg: {fmtV(video.channel_avg_views)}
            </span>
            <span className="text-gray-400">
              {video.published_at ? new Date(video.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </span>
          </div>

          {/* Collab signals */}
          {video.is_collab === 1 && video.collab_signals && (
            <p className="text-xs text-purple-600 mt-1">
              Signals: {video.collab_signals}
            </p>
          )}

          {/* Boost reason */}
          {video.is_paid_boost === 1 && video.boost_reason && (
            <p className="text-xs text-amber-600 mt-1">
              Why flagged: {video.boost_reason}
            </p>
          )}

          {/* Description toggle */}
          {video.description && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {expanded ? 'Hide description ▲' : 'Show description ▼'}
              </button>
              {expanded && (
                <p className="text-xs text-gray-600 mt-1 whitespace-pre-line leading-relaxed border-t border-gray-100 pt-2">
                  {video.description.slice(0, 600)}{video.description.length > 600 ? '...' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function YTViralFeed() {
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
    fetch(`/api/youtube/viral?${params}`)
      .then(r => r.json())
      .then(data => { setVideos(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Viral Videos</h2>
          <p className="text-sm text-gray-500">Videos with 3x+ the channel's average views</p>
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
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No viral videos detected yet — run the tracker first
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map(v => <VideoCard key={v.video_id} video={v} />)}
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
        <p>🔥 <strong>Viral</strong>: views ≥ 3× channel average → organic narrative win or paid push</p>
        <p>💰 <strong>Likely boosted</strong>: high views but unusually low like/comment ratios → proxy for paid promotion</p>
        <p>🤝 <strong>Collab</strong>: title/description contains collab/sponsored/ft./partner keywords</p>
      </div>
    </div>
  );
}
