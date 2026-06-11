import { useState, useEffect } from 'react'
import MetaDashboard from './components/meta/MetaDashboard'
import YTDashboard from './components/youtube/YTDashboard'
import IGDashboard from './components/instagram/IGDashboard'
import DigestPage from './components/DigestPage'

const NAV = [
  { id: 'digest',    label: 'Digest',    icon: '📋' },
  { id: 'meta',      label: 'Meta Ads',  icon: '📣' },
  { id: 'youtube',   label: 'YouTube',   icon: '▶️'  },
  { id: 'instagram', label: 'Instagram', icon: '📸'  },
]

export default function App() {
  const [active, setActive] = useState('digest')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => {})
  }, [])

  const missingKeys = health && Object.values(health.env).some(v => !v)

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">🌟 Little Joys</span>
            <span className="text-sm text-gray-400">Competitor Tracker</span>
          </div>
          <div className="flex items-center gap-1">
            {NAV.map(tab => (
              <button key={tab.id} onClick={() => setActive(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active === tab.id ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                }`}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
          {health && (
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {[['meta','Meta'],['youtube','YT'],['instagram','IG']].map(([k,l]) => (
                <span key={k} className="flex items-center gap-1" title={`${l} API ${health.env[k] ? 'connected' : 'missing'}`}>
                  <span className={`w-2 h-2 rounded-full ${health.env[k] ? 'bg-green-400' : 'bg-red-400'}`} />{l}
                </span>
              ))}
            </div>
          )}
        </div>
      </nav>

      {missingKeys && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-800">
          ⚠️ Some API keys are missing. Copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to <code className="bg-amber-100 px-1 rounded">.env</code>, fill in your keys, then restart the server.
        </div>
      )}

      <main>
        {active === 'digest'    && <DigestPage />}
        {active === 'meta'      && <MetaDashboard />}
        {active === 'youtube'   && <YTDashboard />}
        {active === 'instagram' && <IGDashboard />}
      </main>
    </div>
  )
}
