import { useState } from 'react'
import SettingsPage from './pages/SettingsPage'
import SchedulePage from './pages/SchedulePage'
import StatsPage from './pages/StatsPage'

type Tab = 'settings' | 'schedule' | 'stats'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'settings', label: '設定', icon: '⚙️' },
  { id: 'schedule', label: '排程', icon: '📅' },
  { id: 'stats', label: '統計', icon: '📊' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('settings')

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header：標題 + 頁籤各一行 */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="max-w-lg mx-auto px-4 pt-3">
          <h1 className="text-center text-base font-bold text-indigo-600 dark:text-indigo-400 tracking-tight mb-2">
            通話排序小幫手
          </h1>
          <nav className="flex">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium border-b-2 transition-all
                  ${tab === t.id
                    ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {tab === 'settings' && <SettingsPage />}
        {tab === 'schedule' && <SchedulePage />}
        {tab === 'stats' && <StatsPage />}
      </main>
    </div>
  )
}
