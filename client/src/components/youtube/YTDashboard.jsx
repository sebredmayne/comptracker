import { useState, useEffect } from 'react';
import YTStatsBar from './YTStatsBar';
import YTBrandSummary from './YTBrandSummary';
import YTViralFeed from './YTViralFeed';
import YTCollabFeed from './YTCollabFeed';
import YTAllVideos from './YTAllVideos';

const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'viral',    label: '🔥 Viral (3x+)' },
  { id: 'collabs',  label: '🤝 Collabs' },
  { id: 'all',      label: '🎬 All Videos' },
];

export default function YouTubeDashboard() {
  const [activeTab, setActiveTab] = useState('viral');
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch('/api/youtube/stats');
      setStats(await res.json());
    } catch {}
  }

  async function fetchStatus() {
    try {
      const res = await fetch('/api/youtube/status');
      const data = await res.json();
      setRunning(data.running);
      if (!data.running) fetchStats();
    } catch {}
  }

  async function triggerRun() {
    setRunning(true);
    setRunMessage('');
    try {
      const res = await fetch('/api/youtube/run', { method: 'POST' });
      const data = await res.json();
      setRunMessage(data.message || 'Run started');
    } catch {
      setRunMessage('Failed to start');
      setRunning(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">YouTube Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">
            Viral videos (3x avg views), paid boost signals, and influencer collabs
          </p>
        </div>
        <div className="flex items-center gap-3">
          {runMessage && <span className="text-sm text-green-600">{runMessage}</span>}
          <button
            onClick={triggerRun}
            disabled={running}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              running
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {running ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Running...
              </span>
            ) : '▶ Run Now'}
          </button>
        </div>
      </div>

      {stats && <YTStatsBar stats={stats} />}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 mt-6">
        <nav className="flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-white border border-b-white border-gray-200 text-red-600 -mb-px'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'overview' && <YTBrandSummary />}
      {activeTab === 'viral'    && <YTViralFeed />}
      {activeTab === 'collabs'  && <YTCollabFeed />}
      {activeTab === 'all'      && <YTAllVideos />}
    </div>
  );
}
