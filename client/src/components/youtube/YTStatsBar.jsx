// ─── YTStatsBar ───────────────────────────────────────────────────────────────
export function YTStatsBar({ stats }) {
  const cards = [
    { label: 'Videos Tracked',   value: stats.totalVideos?.toLocaleString() || '0',  icon: '🎬' },
    { label: 'Viral (3x+)',       value: stats.viralVideos  || '0', icon: '🔥', highlight: stats.viralVideos > 0 },
    { label: 'Collabs Detected',  value: stats.collabVideos || '0', icon: '🤝', highlight: stats.collabVideos > 0 },
    { label: 'Likely Boosted',    value: stats.boostedVideos || '0', icon: '💰' },
    {
      label: 'Last Run',
      value: stats.lastRun
        ? new Date(stats.lastRun).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'Never',
      icon: '🕐',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map(card => (
        <div key={card.label} className={`rounded-xl border p-4 ${card.highlight ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
          <div className="text-2xl mb-1">{card.icon}</div>
          <div className={`text-2xl font-bold ${card.highlight ? 'text-red-600' : 'text-gray-900'}`}>{card.value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
        </div>
      ))}
    </div>
  );
}

export default YTStatsBar;
