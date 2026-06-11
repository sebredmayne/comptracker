import { useState, useEffect } from 'react';

function fmtV(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

export default function YTAllVideos() {
  const [videos, setVideos] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ brand: '', sort: 'view_count', limit: 30 });

  useEffect(() => {
    fetch('/api/youtube/brands/list').then(r => r.json()).then(setBrands).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.brand) params.set('brand', filter.brand);
    params.set('sort', filter.sort);
    params.set('limit', filter.limit);
    fetch(`/api/youtube/videos?${params}`)
      .then(r => r.json())
      .then(data => { setVideos(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <select value={filter.brand} onChange={e => setFilter(f => ({ ...f, brand: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option value="">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filter.sort} onChange={e => setFilter(f => ({ ...f, sort: e.target.value }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option value="view_count">Sort: Most Views</option>
          <option value="published_at">Sort: Newest</option>
          <option value="viral_multiple">Sort: Viral Multiple</option>
          <option value="like_count">Sort: Most Likes</option>
        </select>
        <select value={filter.limit} onChange={e => setFilter(f => ({ ...f, limit: Number(e.target.value) }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option value={30}>Show 30</option>
          <option value={50}>Show 50</option>
          <option value={100}>Show 100</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading videos...</div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No videos found</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                <th className="text-left px-4 py-3">Video</th>
                <th className="text-left px-4 py-3">Brand</th>
                <th className="text-right px-4 py-3">Views</th>
                <th className="text-right px-4 py-3">vs Avg</th>
                <th className="text-right px-4 py-3">Likes</th>
                <th className="text-left px-4 py-3">Flags</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v, i) => {
                const ytUrl = `https://www.youtube.com/watch?v=${v.video_id}`;
                return (
                  <tr key={v.video_id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 max-w-xs">
                      <a href={ytUrl} target="_blank" rel="noopener noreferrer"
                        className="text-gray-900 hover:text-red-600 font-medium line-clamp-2 text-xs leading-snug">
                        {v.title}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        v.brand_name === 'Little Joys' ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-700'
                      }`}>
                        {v.brand_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{fmtV(v.view_count)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-medium ${v.viral_multiple >= 3 ? 'text-red-600' : 'text-gray-500'}`}>
                        {v.viral_multiple >= 3 ? '🔥 ' : ''}{v.viral_multiple}×
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmtV(v.like_count)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {v.is_paid_boost === 1 && <span title="Likely boosted">💰</span>}
                        {v.is_collab === 1 && <span title="Collab detected">🤝</span>}
                        {v.is_viral === 1 && <span title="3x+ viral">🔥</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {v.published_at ? new Date(v.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
