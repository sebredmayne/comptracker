export default function MetaStatsBar({ stats }) {
  const cards = [
    { label: 'Total Ads Tracked', value: stats.totalAds?.toLocaleString() || '0', icon: '📣' },
    { label: 'Brands Monitored', value: stats.brandsTracked || '0', icon: '🏷️' },
    { label: 'New This Week', value: stats.newThisWeek || '0', icon: '🆕', highlight: stats.newThisWeek > 0 },
    {
      label: 'Last Run',
      value: stats.lastRun
        ? new Date(stats.lastRun).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        : 'Never',
      icon: '🕐'
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <div
          key={card.label}
          className={`rounded-xl border p-4 ${card.highlight ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
        >
          <div className="text-2xl mb-1">{card.icon}</div>
          <div className={`text-2xl font-bold ${card.highlight ? 'text-blue-600' : 'text-gray-900'}`}>
            {card.value}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
