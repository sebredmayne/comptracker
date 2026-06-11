import { useState, useEffect } from 'react'

export default function DigestPage() {
  const [companies, setCompanies] = useState([])
  const [selected, setSelected]   = useState('')
  const [days, setDays]           = useState(7)
  const [digest, setDigest]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [copied, setCopied]       = useState(false)

  useEffect(() => {
    fetch('/api/companies')
      .then(r => r.json())
      .then(data => {
        const list = data.companies || []
        setCompanies(list)
        if (list.length > 0) setSelected(list[0].name)
      })
      .catch(() => {})
  }, [])

  async function generateDigest() {
    if (!selected) return
    setLoading(true)
    setError(null)
    setDigest(null)
    try {
      const res = await fetch(`/api/digest/${encodeURIComponent(selected)}?days=${days}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate digest')
      setDigest(data.digest)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function copyText() {
    if (!digest?.summary) return
    try {
      await navigator.clipboard.writeText(digest.summary)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (_) {}
  }

  function fmt(n) {
    if (!n && n !== 0) return '—'
    return Number(n).toLocaleString()
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Weekly Digest</h1>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Company</label>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 min-w-[180px]"
          >
            {companies.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Days Back</label>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
        </div>

        <button
          onClick={generateDigest}
          disabled={loading || !selected}
          className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Generating…' : 'Generate Digest'}
        </button>

        {digest && (
          <button
            onClick={copyText}
            className="px-5 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy as text'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-100 rounded-xl h-36" />
          ))}
        </div>
      )}

      {/* Digest output */}
      {digest && !loading && (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">{digest.company}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {digest.period?.from} → {digest.period?.to} &nbsp;·&nbsp; {digest.period?.days} days
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Generated {new Date(digest.generated_at).toLocaleString()}</p>
          </div>

          {/* Meta Ads card */}
          <SectionCard
            title="Meta Ads"
            icon="📣"
            error={digest.meta?.error}
            data={digest.meta}
            renderStats={d => [
              { label: 'Total active ads', value: fmt(d.total_ads) },
              { label: 'New this week',    value: fmt(d.new_this_week) },
              { label: 'Max impressions',  value: fmt(d.max_impressions) },
              { label: 'Avg impressions',  value: fmt(d.avg_impressions) },
            ]}
            renderItems={d => d.top_ads?.length ? (
              <>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Top Ads by Impressions</h4>
                <ul className="space-y-1.5">
                  {d.top_ads.map((a, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 shrink-0">{i + 1}.</span>
                      <span>
                        <span className="font-medium">"{a.hook || '(no hook)'}"</span>
                        {' '}— ~{fmt(a.impressions)} impressions, {a.days_running}d running
                        {a.snapshot_url && (
                          <a href={a.snapshot_url} target="_blank" rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:underline text-xs">view</a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          />

          {/* YouTube card */}
          <SectionCard
            title="YouTube"
            icon="▶️"
            error={digest.youtube?.error}
            data={digest.youtube}
            renderStats={d => [
              { label: 'Total videos tracked', value: fmt(d.total_videos) },
              { label: 'Viral total',          value: fmt(d.viral_count) },
              { label: 'Viral this period',    value: fmt(d.viral_this_period) },
              { label: 'Collab videos',        value: fmt(d.collab_count) },
              { label: 'Max views',            value: fmt(d.max_views) },
            ]}
            renderItems={d => d.recent_videos?.length ? (
              <>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Recent Videos</h4>
                <ul className="space-y-1.5">
                  {d.recent_videos.map((v, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 shrink-0">{i + 1}.</span>
                      <span>
                        <span className="font-medium">"{v.title}"</span>
                        {' '}— {fmt(v.views)} views
                        {v.is_viral && <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">viral</span>}
                        {v.is_collab && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">collab</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          />

          {/* Instagram card */}
          <SectionCard
            title="Instagram"
            icon="📸"
            error={digest.instagram?.error}
            data={digest.instagram}
            renderStats={d => [
              { label: 'Total reels tracked', value: fmt(d.total_reels) },
              { label: 'Viral total',         value: fmt(d.viral_count) },
              { label: 'Viral this period',   value: fmt(d.viral_this_period) },
              { label: 'Sponsored reels',     value: fmt(d.sponsored_count) },
              { label: 'Max views',           value: fmt(d.max_views) },
            ]}
            renderItems={d => d.recent_reels?.length ? (
              <>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-4 mb-2">Recent Reels</h4>
                <ul className="space-y-1.5">
                  {d.recent_reels.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-400 shrink-0">{i + 1}.</span>
                      <span>
                        <span className="font-medium">"{r.caption || '(no caption)'}"</span>
                        {' '}— {fmt(r.views)} views
                        {r.is_viral && <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">viral</span>}
                        {r.is_collab && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">collab</span>}
                        {r.reel_url && (
                          <a href={r.reel_url} target="_blank" rel="noopener noreferrer"
                            className="ml-2 text-blue-500 hover:underline text-xs">view</a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          />
        </div>
      )}
    </div>
  )
}

function SectionCard({ title, icon, error, data, renderStats, renderItems }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
        <span>{icon}</span>{title}
      </h3>

      {error ? (
        <p className="text-sm text-red-500 italic">Error: {error}</p>
      ) : !data ? (
        <p className="text-sm text-gray-400 italic">No data available</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {renderStats(data).map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>
          {renderItems && renderItems(data)}
        </>
      )}
    </div>
  )
}
