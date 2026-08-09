import { useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { Week, Pair } from '../types'
import { buildWeekText, copyTextToClipboard, drawWeekScreenshot, formatWeekLabel } from '../utils/export'
import { getPartnerHistory } from '../utils/scheduler'

function PairCard({ week, pair }: { week: Week; pair: Pair }) {
  const { persons, weeks, toggleCompleted, lockPair, updatePair, updateNote } = useAppStore()
  const [editMode, setEditMode] = useState(false)
  const [noteMode, setNoteMode] = useState(false)
  const [noteDraft, setNoteDraft] = useState(pair.note)
  const [selectedIds, setSelectedIds] = useState<string[]>(pair.members)

  const { sameCycleBlocked, everCompleted } = useMemo(
    () => getPartnerHistory(weeks, week.cycleNumber, pair.id),
    [weeks, week.cycleNumber, pair.id]
  )

  const sameWeekLockedTaken = useMemo(() => {
    const taken = new Set<string>()
    for (const p of week.pairs) {
      if (p.id === pair.id) continue
      if (!p.locked && !p.completed) continue
      for (const m of p.members) taken.add(m)
    }
    return taken
  }, [week.pairs, pair.id])

  const memberNames = pair.members
    .map(id => persons.find(p => p.id === id)?.name ?? id)
    .join(' & ')

  function handleSaveEdit() {
    if (selectedIds.length >= 2) updatePair(week.id, pair.id, selectedIds)
    setEditMode(false)
  }

  function handleSaveNote() {
    updateNote(week.id, pair.id, noteDraft)
    setNoteMode(false)
  }

  function toggleMember(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  return (
    <div className={`rounded-lg border px-3 py-2.5 transition-all
      ${pair.locked
        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }
    `}>
      {/* Main row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Completion circle */}
        <button
          onClick={() => toggleCompleted(week.id, pair.id)}
          className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
            ${pair.completed
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
            }
          `}
          aria-label="標記完成"
        >
          {pair.completed && <span className="text-[10px] leading-none font-bold">✓</span>}
        </button>

        {/* Names */}
        <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 min-w-0">
          {memberNames}
        </span>

        {/* 已完成 text button */}
        <button
          onClick={() => toggleCompleted(week.id, pair.id)}
          className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 transition-all
            ${pair.completed
              ? 'bg-green-50 border-green-400 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-500'
            }
          `}
        >
          {pair.completed ? '✓ 已完成' : '已完成'}
        </button>

        {/* Lock */}
        <button
          onClick={() => lockPair(week.id, pair.id, !pair.locked)}
          className={`text-sm px-1 transition-colors flex-shrink-0
            ${pair.locked
              ? 'text-indigo-500 dark:text-indigo-400'
              : 'text-gray-300 dark:text-gray-600 hover:text-indigo-400'
            }
          `}
          title={pair.locked ? '解除鎖定' : '鎖定此組合'}
        >
          {pair.locked ? '🔒' : '🔓'}
        </button>

        {/* Edit */}
        <button
          onClick={() => { setSelectedIds(pair.members); setEditMode(!editMode) }}
          className="text-sm text-gray-300 dark:text-gray-600 hover:text-indigo-500 transition-colors flex-shrink-0"
          title="修改配對"
        >
          ✏️
        </button>

        {/* Note */}
        <button
          onClick={() => { setNoteDraft(pair.note); setNoteMode(!noteMode) }}
          className={`text-sm flex-shrink-0 transition-colors
            ${pair.note ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'}
          `}
          title="備忘"
        >
          📝
        </button>
      </div>

      {/* Note display */}
      {pair.note && !noteMode && (
        <p className="mt-1.5 ml-7 text-xs text-amber-600 dark:text-amber-400 italic">{pair.note}</p>
      )}

      {/* Edit panel */}
      {editMode && (
        <div className="mt-2 ml-7 space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">選擇成員（至少 2 人）：</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 flex flex-wrap gap-x-3">
            <span className="text-amber-500 dark:text-amber-400">橘框＝本輪已配對（提醒，仍可選）</span>
            <span className="text-red-400 dark:text-red-500">紅框＝過去輪次已完成</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {persons.map(p => {
              const isSelected = selectedIds.includes(p.id)
              const repeated = !isSelected && (
                sameWeekLockedTaken.has(p.id) ||
                selectedIds.some(id => sameCycleBlocked.get(id)?.has(p.id))
              )
              const flagged = !isSelected && !repeated && selectedIds.some(id => everCompleted.get(id)?.has(p.id))

              return (
                <button
                  key={p.id}
                  onClick={() => toggleMember(p.id)}
                  title={repeated ? '本輪已配對過（僅提醒，仍可選）' : flagged ? '過去輪次已完成配對' : undefined}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all
                    ${isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : repeated
                        ? 'border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:border-amber-400'
                        : flagged
                          ? 'border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:border-red-400'
                          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
                    }
                  `}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={selectedIds.length < 2}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-3 py-1 rounded-lg transition-colors"
            >
              確定
            </button>
            <button onClick={() => setEditMode(false)} className="text-xs text-gray-400 px-2 py-1">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Note input */}
      {noteMode && (
        <div className="mt-2 ml-7 flex gap-2">
          <input
            autoFocus
            value={noteDraft}
            onChange={e => setNoteDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveNote() }}
            placeholder="輸入備忘…"
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button onClick={handleSaveNote} className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg">存</button>
          <button onClick={() => setNoteMode(false)} className="text-xs text-gray-400 px-1">取消</button>
        </div>
      )}
    </div>
  )
}

function WeekCard({ week }: { week: Week }) {
  const { reshuffleWeek, persons, settings } = useAppStore()
  const allDone = week.pairs.every(p => p.completed)
  const someDone = week.pairs.some(p => p.completed)
  const [copySuccess, setCopySuccess] = useState(false)
  const [screenshotLoading, setScreenshotLoading] = useState(false)

  async function handleCopy() {
    await copyTextToClipboard(buildWeekText(week, persons, settings))
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)
  }

  async function handleScreenshot() {
    setScreenshotLoading(true)
    try {
      await drawWeekScreenshot(week, persons)
    } finally {
      setScreenshotLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      {/* Week header */}
      <div className={`flex items-center justify-between px-4 py-2.5
        ${allDone ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800'}
      `}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {formatWeekLabel(week)}
          </span>
          <span className="text-xs text-indigo-400 dark:text-indigo-500">
            第 {week.cycleNumber} 輪
          </span>
          {allDone && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">✓ 本週完成</span>
          )}
          {someDone && !allDone && (
            <span className="text-xs text-amber-500">
              {week.pairs.filter(p => p.completed).length}/{week.pairs.length} 完成
            </span>
          )}
        </div>
        <button
          onClick={() => reshuffleWeek(week.id)}
          className="text-xs text-gray-400 hover:text-indigo-500 transition-colors px-2 py-1 rounded"
          title="重新隨機排列本週（保留鎖定組合）"
        >
          重排
        </button>
      </div>

      {/* Pairs */}
      <div className="px-3 py-2.5 space-y-2">
        {week.pairs.map(pair => (
          <PairCard key={pair.id} week={week} pair={pair} />
        ))}
      </div>

      {/* Per-week export buttons */}
      <div className="flex items-center gap-2 px-3 pb-3 pt-1 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={handleCopy}
          className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-all
            ${copySuccess
              ? 'bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600'
            }
          `}
        >
          {copySuccess ? '✓ 已複製' : '📋 複製本週'}
        </button>
        <button
          onClick={handleScreenshot}
          disabled={screenshotLoading}
          className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 font-medium transition-all disabled:opacity-50"
        >
          {screenshotLoading ? '截圖中…' : '🖼 截圖本週'}
        </button>
      </div>
    </div>
  )
}

export default function SchedulePage() {
  const { weeks, history, undo } = useAppStore()
  const cycles = Array.from(new Set(weeks.map(w => w.cycleNumber)))

  if (weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
        <p className="text-4xl mb-4">📅</p>
        <p className="text-base">尚未產生排程</p>
        <p className="text-sm mt-1">請至「設定」頁面輸入人員與日期後按「產生排程」</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Minimal global toolbar */}
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs text-gray-400">共 {weeks.length} 週 / {cycles.length} 輪</span>
        {history.length > 0 && (
          <button
            onClick={undo}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-indigo-600 transition-all"
          >
            ↩ 復原
          </button>
        )}
      </div>

      {/* Schedule by cycle */}
      <div className="space-y-6">
        {cycles.map(cycle => (
          <div key={cycle}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                第 {cycle} 輪
              </span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="space-y-3">
              {weeks
                .filter(w => w.cycleNumber === cycle)
                .map(week => <WeekCard key={week.id} week={week} />)
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
