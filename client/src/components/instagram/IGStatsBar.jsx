// ─── IGStatsBar ───────────────────────────────────────────────────────────────
export function IGStatsBar({ stats }) {
  const cards = [
    { label: 'Reels Tracked',    value: stats.totalReels?.toLocaleString() || '0',  icon: '🎞' },
    { label: 'Viral (3x+)',      value: stats.viralReels    || '0', icon: '🔥', hl: stats.viralReels > 0 },
    { label: 'Collabs Detected', value: stats.collabReels   || '0', icon: '🤝', hl: stats.collabReels > 0 },
    { label: 'Meta Sponsored',   value: stats.sponsoredReels|| '0', icon: '💰', hl: stats.sponsoredReels > 0 },
    { label: 'Likely Boosted',   value: stats.boostedReels  || '0', icon: '📈' },
    {
      label: 'Last Run',
      value: stats.lastRun
        ? new Date(stats.lastRun).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'Never',
      icon: '🕐',
    },
  ];
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {cards.map(c => (
        <div key={c.label} className={`rounded-xl border p-3 ${c.hl ? 'border-pink-200 bg-pink-50' : 'border-gray-200 bg-white'}`}>
          <div className="text-xl mb-1">{c.icon}</div>
          <div className={`text-xl font-bold ${c.hl ? 'text-pink-600' : 'text-gray-900'}`}>{c.value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
export default IGStatsBar;
