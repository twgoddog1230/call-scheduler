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

  // "New week" = first week with no completed pairs (the just-arranged upcoming week)
  const newWeek = weeks.find(w => w.pairs.every(p => !p.completed))
  const newWeekMemberPairs = new Set<string>()
  if (newWeek) {
    for (const pair of newWeek.pairs) {
      for (let i = 0; i < pair.members.length; i++) {
        for (let j = 0; j < pair.members.length; j++) {
          if (i !== j) newWeekMemberPairs.add(`${pair.members[i]}|${pair.members[j]}`)
        }
      }
    }
  }

  // Scope pairing history to the current cycle only — once a cycle finishes,
  // everyone has "completed" with everyone, which would otherwise permanently
  // mask blue/green in later cycles and duplicate names across cycles.
  const currentCycle = newWeek?.cycleNumber ?? Math.max(...weeks.map(w => w.cycleNumber), 1)

  // Build per-person pairing history
  const pairingHistory: Record<string, { partnerId: string; weekNumber: number; completed: boolean }[]> = {}
  for (const p of persons) pairingHistory[p.id] = []

  for (const week of weeks) {
    if (week.cycleNumber !== currentCycle) continue
    for (const pair of week.pairs) {
      for (let i = 0; i < pair.members.length; i++) {
        const me = pair.members[i]
        for (let j = 0; j < pair.members.length; j++) {
          if (i === j) continue
          const partner = pair.members[j]
          if (!pairingHistory[me]) continue
          const already = pairingHistory[me].some(
            h => h.partnerId === partner && h.weekNumber === week.weekNumber
          )
          if (!already) {
            pairingHistory[me].push({
              partnerId: partner,
              weekNumber: week.weekNumber,
              completed: pair.completed,
            })
          }
        }
      }
    }
  }

  const personMap = Object.fromEntries(persons.map(p => [p.id, p.name]))

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
      {/* Pairing records */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">配對紀錄</h2>
        <p className="text-xs text-gray-400 mb-4 flex flex-wrap gap-x-3">
          <span><span className="text-red-500 font-medium">紅</span>＝已完成</span>
          <span><span className="text-blue-500 font-medium">藍</span>＝本週搭檔</span>
          <span><span className="text-green-500 font-medium">綠</span>＝尚未排到</span>
        </p>

        <div className="space-y-3">
          {persons.map(person => {
            const history = pairingHistory[person.id] ?? []

            // Red: completed, sorted by week
            const completed = history
              .filter(h => h.completed)
              .sort((a, b) => a.weekNumber - b.weekNumber)
            const completedIds = new Set(completed.map(h => h.partnerId))

            // Blue: in new week, not completed
            const blue = persons.filter(p =>
              p.id !== person.id &&
              !completedIds.has(p.id) &&
              newWeekMemberPairs.has(`${person.id}|${p.id}`)
            )
            const blueIds = new Set(blue.map(p => p.id))

            // Green: everyone else (not completed, not in new week)
            const green = persons.filter(p =>
              p.id !== person.id &&
              !completedIds.has(p.id) &&
              !blueIds.has(p.id)
            )

            return (
              <div key={person.id} className="flex items-start gap-2 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 w-14 flex-shrink-0 pt-0.5">
                  {person.name}
                </span>
                <div className="flex flex-wrap gap-x-2 gap-y-1">
                  {completed.map(h => (
                    <span key={h.partnerId} className="text-sm font-medium text-red-500 dark:text-red-400">
                      {personMap[h.partnerId] ?? h.partnerId}
                    </span>
                  ))}
                  {blue.map(p => (
                    <span key={p.id} className="text-sm font-medium text-blue-500 dark:text-blue-400">
                      {p.name}
                    </span>
                  ))}
                  {green.map(p => (
                    <span key={p.id} className="text-sm font-medium text-green-600 dark:text-green-400">
                      {p.name}
                    </span>
                  ))}
                </div>
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
