import { useState, useEffect } from 'react';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function fmtV(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

function useBrands() {
  const [brands, setBrands] = useState([]);
  useEffect(() => {
    fetch('/api/instagram/brands/list').then(r => r.json()).then(setBrands).catch(() => {});
  }, []);
  return brands;
}

function ReelCard({ reel, accentColor = 'pink' }) {
  const [expanded, setExpanded] = useState(false);
  const accent = {
    pink:   { badge: 'bg-pink-50 text-pink-700',   border: 'border-pink-200 bg-pink-50' },
    purple: { badge: 'bg-purple-50 text-purple-700', border: 'border-purple-200 bg-purple-50' },
  }[accentColor] || {};

  return (
    <div className={`rounded-xl border p-4 ${
      reel.brand_name === 'Little Joys' ? 'border-green-200 bg-green-50' : `${accent.border}`
    }`}>
      <div className="flex gap-3">
        {/* Thumbnail */}
        {reel.thumbnail_url ? (
          <a href={reel.reel_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <img src={reel.thumbnail_url} alt="" className="w-24 h-32 object-cover rounded-lg" />
          </a>
        ) : (
          <a href={reel.reel_url} target="_blank" rel="noopener noreferrer"
            className="w-24 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-2xl">
            📸
          </a>
        )}

        <div className="flex-1 min-w-0">
          {/* Caption */}
          <p className="text-sm text-gray-900 font-medium line-clamp-2 mb-2 leading-snug">
            {reel.caption ? `"${reel.caption.slice(0, 120)}${reel.caption.length > 120 ? '...' : ''}"` : '(no caption)'}
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              reel.brand_name === 'Little Joys' ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-700'
            }`}>@{reel.username}</span>

            {reel.is_viral === 1 && (
              <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                🔥 {reel.viral_multiple}x
              </span>
            )}
            {reel.is_sponsored === 1 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                💰 Sponsored
              </span>
            )}
            {reel.is_paid_boost === 1 && reel.is_sponsored !== 1 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full" title={reel.boost_reason}>
                📈 Likely boosted
              </span>
            )}
            {reel.is_collab === 1 && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                🤝 Collab
              </span>
            )}
            {reel.music_name && (
              <span className="text-xs text-gray-500">🎵 {reel.music_name.slice(0, 30)}</span>
            )}
          </div>

          {/* Collab signals */}
          {reel.is_collab === 1 && (
            <div className="text-xs text-purple-700 mb-1 space-y-0.5">
              {reel.coauthors && <p>👥 Coauthor: <strong>{reel.coauthors}</strong></p>}
              {reel.mentioned_accounts && <p>@mentions: {reel.mentioned_accounts.slice(0, 80)}</p>}
              {reel.collab_signals && <p>Signals: {reel.collab_signals.slice(0, 100)}</p>}
            </div>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
            <span>👁 <strong>{fmtV(reel.view_count)}</strong></span>
            <span>❤️ {fmtV(reel.like_count)}</span>
            <span>💬 {fmtV(reel.comment_count)}</span>
            {reel.share_count > 0 && <span>↗ {fmtV(reel.share_count)} shares</span>}
            <span className="text-gray-400">avg: {fmtV(reel.account_avg_views)}</span>
            {reel.posted_at && (
              <span className="text-gray-400">
                {new Date(reel.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          {/* Caption expand */}
          {reel.caption && reel.caption.length > 120 && (
            <button onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-500 mt-1 hover:text-blue-700">
              {expanded ? 'Less ▲' : 'Full caption ▼'}
            </button>
          )}
          {expanded && (
            <p className="text-xs text-gray-600 mt-1 whitespace-pre-line border-t border-gray-100 pt-2">
              {reel.caption}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── IGBrandSummary ───────────────────────────────────────────────────────────

export function IGBrandSummary() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/instagram/brands').then(r => r.json())
      .then(d => { setBrands(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const maxViews = Math.max(...brands.map(b => b.max_views || 0), 1);

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Account Overview</h2>
      <p className="text-sm text-gray-500 mb-4">Instagram organic performance per competitor</p>

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div>
      : brands.length === 0 ? <div className="text-center py-12 text-gray-400">No data yet — run the tracker first</div>
      : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map(b => (
            <div key={b.brand_name} className={`rounded-xl border p-5 ${
              b.brand_name === 'Little Joys' ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'
            }`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{b.brand_name}</h3>
                  {b.latest_post && (
                    <p className="text-xs text-gray-500">
                      Last post: {new Date(b.latest_post).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {b.viral_count > 0    && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">🔥 {b.viral_count}</span>}
                  {b.collab_count > 0   && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">🤝 {b.collab_count}</span>}
                  {b.sponsored_count > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">💰 {b.sponsored_count}</span>}
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Reels tracked</span><span className="font-medium">{b.total_reels}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Peak views</span><span className="font-medium text-pink-600">{fmtV(b.max_views)}</span></div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-purple-400 to-pink-400 h-1.5 rounded-full" style={{ width: `${(b.max_views / maxViews) * 100}%` }} />
                </div>
                <div className="flex justify-between"><span className="text-gray-500">Avg views</span><span className="font-medium">{fmtV(b.avg_views)}</span></div>
                {b.total_shares > 0 && <div className="flex justify-between"><span className="text-gray-500">Total shares</span><span className="font-medium text-purple-600">↗ {fmtV(b.total_shares)}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── IGViralFeed ──────────────────────────────────────────────────────────────

export function IGViralFeed() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ brand: '', limit: 20 });
  const brands = useBrands();

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filter.brand) p.set('brand', filter.brand);
    p.set('limit', filter.limit);
    fetch(`/api/instagram/viral?${p}`).then(r => r.json())
      .then(d => { setReels(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Viral Reels</h2>
          <p className="text-sm text-gray-500">3x+ the account's average views</p>
        </div>
        <div className="flex gap-2">
          <select value={filter.brand} onChange={e => setFilter(f => ({ ...f, brand: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={filter.limit} onChange={e => setFilter(f => ({ ...f, limit: Number(e.target.value) }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            <option value={10}>Top 10</option>
            <option value={20}>Top 20</option>
            <option value={50}>Top 50</option>
          </select>
        </div>
      </div>
      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div>
      : reels.length === 0 ? <div className="text-center py-12 text-gray-400">No viral reels yet — run the tracker first</div>
      : <div className="space-y-3">{reels.map(r => <ReelCard key={r.reel_id} reel={r} accentColor="pink" />)}</div>}

      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500 space-y-1">
        <p>🔥 <strong>Viral</strong>: views ≥ 3× account average</p>
        <p>💰 <strong>Sponsored</strong>: Meta's native paid tag on the post (reliable)</p>
        <p>📈 <strong>Likely boosted</strong>: high views, low engagement ratio (proxy signal)</p>
      </div>
    </div>
  );
}

// ─── IGCollabFeed ─────────────────────────────────────────────────────────────

export function IGCollabFeed() {
  const [reels, setReels] = useState([]);
  const [collabAccounts, setCollabAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ brand: '', limit: 20 });
  const [showAccounts, setShowAccounts] = useState(false);
  const brands = useBrands();

  useEffect(() => {
    fetch('/api/instagram/collab-accounts?limit=15').then(r => r.json()).then(setCollabAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filter.brand) p.set('brand', filter.brand);
    p.set('limit', filter.limit);
    fetch(`/api/instagram/collabs?${p}`).then(r => r.json())
      .then(d => { setReels(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Influencer Collaborations</h2>
          <p className="text-sm text-gray-500">Coauthor posts, #ad tags, @mentions, sponsored signals</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAccounts(!showAccounts)}
            className="text-sm border border-purple-300 text-purple-600 rounded-lg px-3 py-1.5 hover:bg-purple-50">
            {showAccounts ? 'Hide' : 'Top'} collab accounts
          </button>
          <select value={filter.brand} onChange={e => setFilter(f => ({ ...f, brand: e.target.value }))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
            <option value="">All Brands</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Top collab accounts panel */}
      {showAccounts && collabAccounts.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-purple-800 mb-2">
            🔍 Most-mentioned external accounts across all competitors
          </h3>
          <div className="flex flex-wrap gap-2">
            {collabAccounts.map((acc, i) => (
              <span key={i} className="text-xs bg-white border border-purple-200 text-purple-700 px-2 py-1 rounded-lg">
                {acc.coauthors || acc.mentioned_accounts?.split(',')[0] || '?'} — {acc.brand_name} ({acc.appearances}x)
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div>
      : reels.length === 0 ? <div className="text-center py-12 text-gray-400">No collabs detected yet</div>
      : <div className="space-y-3">{reels.map(r => <ReelCard key={r.reel_id} reel={r} accentColor="purple" />)}</div>}
    </div>
  );
}

// ─── IGAllReels ───────────────────────────────────────────────────────────────

export function IGAllReels() {
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ brand: '', sort: 'view_count', limit: 30 });
  const brands = useBrands();

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filter.brand) p.set('brand', filter.brand);
    p.set('sort', filter.sort);
    p.set('limit', filter.limit);
    fetch(`/api/instagram/reels?${p}`).then(r => r.json())
      .then(d => { setReels(d); setLoading(false); })
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
          <option value="view_count">Most Views</option>
          <option value="posted_at">Newest</option>
          <option value="viral_multiple">Viral Multiple</option>
          <option value="share_count">Most Shares</option>
          <option value="like_count">Most Likes</option>
        </select>
        <select value={filter.limit} onChange={e => setFilter(f => ({ ...f, limit: Number(e.target.value) }))}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white">
          <option value={30}>Show 30</option>
          <option value={50}>Show 50</option>
          <option value={100}>Show 100</option>
        </select>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div>
      : reels.length === 0 ? <div className="text-center py-12 text-gray-400">No reels found</div>
      : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium">
                <th className="text-left px-4 py-3">Caption</th>
                <th className="text-left px-4 py-3">Brand</th>
                <th className="text-right px-4 py-3">Views</th>
                <th className="text-right px-4 py-3">vs Avg</th>
                <th className="text-right px-4 py-3">Shares</th>
                <th className="text-left px-4 py-3">Flags</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {reels.map((r, i) => (
                <tr key={r.reel_id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                  <td className="px-4 py-3 max-w-xs">
                    <a href={r.reel_url} target="_blank" rel="noopener noreferrer"
                      className="text-gray-900 hover:text-pink-600 text-xs line-clamp-2 leading-snug">
                      {r.caption ? r.caption.slice(0, 80) : '(no caption)'}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      r.brand_name === 'Little Joys' ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-700'
                    }`}>@{r.username}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{fmtV(r.view_count)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-medium ${r.viral_multiple >= 3 ? 'text-red-600' : 'text-gray-500'}`}>
                      {r.viral_multiple >= 3 ? '🔥 ' : ''}{r.viral_multiple}×
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500">{fmtV(r.share_count)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {r.is_sponsored === 1 && <span title="Sponsored">💰</span>}
                      {r.is_paid_boost === 1 && <span title="Likely boosted">📈</span>}
                      {r.is_collab === 1     && <span title="Collab">🤝</span>}
                      {r.is_viral === 1      && <span title="3x+ viral">🔥</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {r.posted_at ? new Date(r.posted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
