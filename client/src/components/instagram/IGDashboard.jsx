import { useState, useEffect } from 'react';
import IGStatsBar from './IGStatsBar';
import IGBrandSummary from './IGBrandSummary';
import IGViralFeed from './IGViralFeed';
import IGCollabFeed from './IGCollabFeed';
import IGAllReels from './IGAllReels';

const TABS = [
  { id: 'overview',  label: '📊 Overview' },
  { id: 'viral',     label: '🔥 Viral (3x+)' },
  { id: 'collabs',   label: '🤝 Collabs & Influencers' },
  { id: 'all',       label: '🎞 All Reels' },
];

export default function InstagramDashboard() {
  const [activeTab, setActiveTab] = useState('viral');
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try { setStats(await fetch('/api/instagram/stats').then(r => r.json())); }
    catch {}
  }

  async function fetchStatus() {
    try {
      const data = await fetch('/api/instagram/status').then(r => r.json());
      setRunning(data.running);
      if (!data.running) fetchStats();
    } catch {}
  }

  async function triggerRun() {
    setRunning(true); setRunMessage('');
    try {
      const data = await fetch('/api/instagram/run', { method: 'POST' }).then(r => r.json());
      setRunMessage(data.message || 'Run started (~5-10 min)');
    } catch { setRunning(false); setRunMessage('Failed to start'); }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instagram Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Organic reels — viral signals, influencer collabs, paid boost detection via Apify
          </p>
        </div>
        <div className="flex items-center gap-3">
          {runMessage && (
            <span className="text-sm text-pink-600 max-w-xs">{runMessage}</span>
          )}
          <button
            onClick={triggerRun}
            disabled={running}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              running
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90'
            }`}
          >
            {running ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Running (~5-10 min)
              </span>
            ) : '▶ Run Now'}
          </button>
        </div>
      </div>

      {stats && <IGStatsBar stats={stats} />}

      <div className="border-b border-gray-200 mb-6 mt-6">
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-white border border-b-white border-gray-200 text-pink-600 -mb-px'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <IGBrandSummary />}
      {activeTab === 'viral'    && <IGViralFeed />}
      {activeTab === 'collabs'  && <IGCollabFeed />}
      {activeTab === 'all'      && <IGAllReels />}
    </div>
  );
}
