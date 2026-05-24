import { useAppStore } from '../store/useAppStore'

export default function StatsPage() {
  const { persons, weeks } = useAppStore()

  if (persons.length === 0 || weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
        <p className="text-4xl mb-4">📊</p>
        <p className="text-base">尚無統計資料</p>
        <p className="text-sm mt-1">請先產生排程</p>
      </div>
    )
  }

  // Build pairing matrix: count how many times each pair appeared
  const pairCount: Record<string, Record<string, number>> = {}
  for (const p of persons) {
    pairCount[p.id] = {}
    for (const q of persons) {
      pairCount[p.id][q.id] = 0
    }
  }

  // Count appearances per person
  const appearances: Record<string, number> = {}
  const completed: Record<string, number> = {}
  for (const p of persons) {
    appearances[p.id] = 0
    completed[p.id] = 0
  }

  for (const week of weeks) {
    for (const pair of week.pairs) {
      for (const id of pair.members) {
        appearances[id] = (appearances[id] ?? 0) + 1
        if (pair.completed) completed[id] = (completed[id] ?? 0) + 1
      }
      // count each unique pair combination
      for (let i = 0; i < pair.members.length; i++) {
        for (let j = i + 1; j < pair.members.length; j++) {
          const a = pair.members[i]
          const b = pair.members[j]
          if (pairCount[a] && pairCount[b] !== undefined) {
            pairCount[a][b] = (pairCount[a][b] ?? 0) + 1
            pairCount[b][a] = (pairCount[b][a] ?? 0) + 1
          }
        }
      }
    }
  }

  const maxCount = Math.max(
    1,
    ...persons.flatMap(a =>
      persons.filter(b => b.id !== a.id).map(b => pairCount[a.id]?.[b.id] ?? 0)
    )
  )

  function cellColor(count: number, isSelf: boolean): string {
    if (isSelf) return 'bg-gray-100 dark:bg-gray-800'
    if (count === 0) return 'bg-white dark:bg-gray-900'
    const intensity = Math.round((count / maxCount) * 5)
    const shades = [
      'bg-indigo-50 dark:bg-indigo-950',
      'bg-indigo-100 dark:bg-indigo-900',
      'bg-indigo-200 dark:bg-indigo-800',
      'bg-indigo-300 dark:bg-indigo-700',
      'bg-indigo-400 dark:bg-indigo-600',
      'bg-indigo-500 dark:bg-indigo-500',
    ]
    return shades[Math.min(intensity, 5)]
  }

  function cellText(count: number, isSelf: boolean): string {
    if (isSelf) return '–'
    return count === 0 ? '' : String(count)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
      {/* Pairing matrix */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">配對矩陣</h2>
        <p className="text-xs text-gray-400 mb-4">數字代表兩人搭配的次數，顏色越深次數越多</p>

        <div className="overflow-x-auto">
          <table className="border-collapse text-center text-xs min-w-full">
            <thead>
              <tr>
                <th className="w-12 p-1" />
                {persons.map(p => (
                  <th
                    key={p.id}
                    className="p-1 font-medium text-gray-600 dark:text-gray-300 max-w-[48px]"
                  >
                    <span className="block truncate" title={p.name}>{p.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {persons.map(a => (
                <tr key={a.id}>
                  <td className="p-1 font-medium text-gray-600 dark:text-gray-300 text-right pr-2 truncate max-w-[48px]" title={a.name}>
                    {a.name}
                  </td>
                  {persons.map(b => {
                    const isSelf = a.id === b.id
                    const count = pairCount[a.id]?.[b.id] ?? 0
                    return (
                      <td
                        key={b.id}
                        className={`w-9 h-9 rounded text-gray-700 dark:text-gray-200 font-medium transition-colors
                          ${cellColor(count, isSelf)}
                        `}
                      >
                        {cellText(count, isSelf)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Per-person stats */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">個人統計</h2>
        <div className="space-y-2">
          {persons
            .slice()
            .sort((a, b) => (appearances[b.id] ?? 0) - (appearances[a.id] ?? 0))
            .map(p => {
              const total = appearances[p.id] ?? 0
              const done = completed[p.id] ?? 0
              const pct = total === 0 ? 0 : Math.round((done / total) * 100)
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-gray-700 dark:text-gray-200 truncate flex-shrink-0">{p.name}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">
                    {done}/{total} 次完成
                  </span>
                </div>
              )
            })}
        </div>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: '總週數', value: weeks.length },
          { label: '已完成週', value: weeks.filter(w => w.pairs.every(p => p.completed)).length },
          { label: '輪次', value: Math.max(...weeks.map(w => w.cycleNumber), 0) },
        ].map(item => (
          <div key={item.label} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-center">
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{item.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{item.label}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
