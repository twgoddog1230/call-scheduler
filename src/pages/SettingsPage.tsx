import { useState, useRef } from 'react'
import { useAppStore } from '../store/useAppStore'

export default function SettingsPage() {
  const { settings, persons, updateSettings, addPerson, removePerson, reorderPersons, generateSchedule } = useAppStore()
  const [newName, setNewName] = useState('')
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAddPerson() {
    if (!newName.trim()) return
    addPerson(newName)
    setNewName('')
    inputRef.current?.focus()
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    setOverIdx(idx)
  }

  function handleDrop() {
    if (dragIdx === null || overIdx === null || dragIdx === overIdx) {
      setDragIdx(null)
      setOverIdx(null)
      return
    }
    const ids = persons.map(p => p.id)
    const [moved] = ids.splice(dragIdx, 1)
    ids.splice(overIdx, 0, moved)
    reorderPersons(ids)
    setDragIdx(null)
    setOverIdx(null)
  }

  const canGenerate = settings.startDate && settings.endDate && persons.length >= 2

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-8">
      {/* Date Range */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">日期區間</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">開始日期</span>
            <input
              type="date"
              value={settings.startDate}
              onChange={e => updateSettings({ startDate: e.target.value })}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-500 dark:text-gray-400">結束日期</span>
            <input
              type="date"
              value={settings.endDate}
              min={settings.startDate}
              onChange={e => updateSettings({ endDate: e.target.value })}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>

        {settings.startDate && settings.endDate && (
          <p className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
            每組人數：預設 2 人（奇數人數時最後一組自動補為 3 人）
          </p>
        )}
      </section>

      {/* Personnel */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
          人員名單
          <span className="ml-2 text-sm font-normal text-gray-400">（{persons.length} 人）</span>
        </h2>

        {/* Add person */}
        <div className="flex gap-2 mb-3">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="輸入姓名"
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
          />
          <button
            onClick={handleAddPerson}
            disabled={!newName.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            新增
          </button>
        </div>

        {/* Person list */}
        <ul className="space-y-2">
          {persons.map((person, idx) => (
            <li
              key={person.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={handleDrop}
              onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-grab active:cursor-grabbing
                ${overIdx === idx && dragIdx !== idx
                  ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }
                ${dragIdx === idx ? 'opacity-40' : ''}
              `}
            >
              <span className="text-gray-400 text-xs select-none">☰</span>
              <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">{person.name}</span>
              <button
                onClick={() => removePerson(person.id)}
                className="text-gray-400 hover:text-red-500 transition-colors text-base leading-none px-1"
                aria-label="刪除"
              >
                ✕
              </button>
            </li>
          ))}
          {persons.length === 0 && (
            <li className="text-center text-sm text-gray-400 py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              尚未新增人員
            </li>
          )}
        </ul>

        {persons.length >= 2 && (
          <p className="mt-2 text-xs text-gray-400">可拖拉調整排序</p>
        )}
      </section>

      {/* Generate button */}
      <section>
        <button
          onClick={generateSchedule}
          disabled={!canGenerate}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors text-base shadow"
        >
          產生排程
        </button>
        {!canGenerate && (
          <p className="mt-2 text-xs text-center text-gray-400">
            請設定日期區間並新增至少 2 位人員
          </p>
        )}
      </section>
    </div>
  )
}
