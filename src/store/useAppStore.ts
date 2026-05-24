import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppState, Person, Settings } from '../types'
import type { Pair } from '../types'
import { buildSchedule, recalculateAfterLock } from '../utils/scheduler'

function uuid() {
  return Math.random().toString(36).slice(2, 10)
}

const defaultSettings: Settings = {
  startDate: '',
  endDate: '',
  defaultGroupSize: 2,
}

const HISTORY_LIMIT = 20

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      persons: [],
      weeks: [],
      history: [],

      updateSettings: (s) => {
        set(state => ({ settings: { ...state.settings, ...s } }))
      },

      addPerson: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        set(state => ({
          persons: [...state.persons, { id: uuid(), name: trimmed }],
        }))
      },

      removePerson: (id) => {
        set(state => ({
          persons: state.persons.filter(p => p.id !== id),
          // Remove this person from all pairs; remove pair if it becomes empty
          weeks: state.weeks.map(w => ({
            ...w,
            pairs: w.pairs
              .map(p => ({ ...p, members: p.members.filter(m => m !== id) }))
              .filter(p => p.members.length >= 2),
          })),
        }))
      },

      reorderPersons: (ids) => {
        set(state => ({
          persons: ids.map(id => state.persons.find(p => p.id === id)!).filter(Boolean),
        }))
      },

      generateSchedule: () => {
        const { settings, persons } = get()
        if (!settings.startDate || !settings.endDate || persons.length < 2) return
        const weeks = buildSchedule(persons, settings.startDate, settings.endDate)
        set({ weeks, history: [] })
      },

      reshuffleWeek: (weekId) => {
        const { weeks, persons } = get()
        const week = weeks.find(w => w.id === weekId)
        if (!week) return

        const lockedMembers = new Set(
          week.pairs.filter(p => p.locked).flatMap(p => p.members)
        )
        const unlocked = persons.map(p => p.id).filter(id => !lockedMembers.has(id))

        // Simple reshuffle of unlocked members
        const shuffled = [...unlocked].sort(() => Math.random() - 0.5)
        const newPairs: Pair[] = []
        for (let i = 0; i < shuffled.length; i += 2) {
          const members = i + 1 < shuffled.length
            ? [shuffled[i], shuffled[i + 1]]
            : [shuffled[i]]

          if (members.length === 1 && newPairs.length > 0) {
            newPairs[newPairs.length - 1].members.push(members[0])
          } else {
            newPairs.push({ id: uuid(), members, locked: false, completed: false, note: '' })
          }
        }

        const lockedPairs = week.pairs.filter(p => p.locked)
        set(state => ({
          weeks: state.weeks.map(w =>
            w.id === weekId ? { ...w, pairs: [...lockedPairs, ...newPairs] } : w
          ),
        }))
      },

      lockPair: (weekId, pairId, locked) => {
        const { weeks } = get()
        const prevWeeks = weeks

        const updated = weeks.map(w =>
          w.id === weekId
            ? { ...w, pairs: w.pairs.map(p => p.id === pairId ? { ...p, locked } : p) }
            : w
        )

        const personIds = get().persons.map(p => p.id)
        const recalced = recalculateAfterLock(updated, weekId, personIds)

        set(state => ({
          weeks: recalced,
          history: [...state.history.slice(-HISTORY_LIMIT), prevWeeks],
        }))
      },

      updatePair: (weekId, pairId, members) => {
        const { weeks } = get()
        const prevWeeks = weeks

        const updated = weeks.map(w =>
          w.id === weekId
            ? { ...w, pairs: w.pairs.map(p => p.id === pairId ? { ...p, members, locked: true } : p) }
            : w
        )

        const personIds = get().persons.map(p => p.id)
        const recalced = recalculateAfterLock(updated, weekId, personIds)

        set(state => ({
          weeks: recalced,
          history: [...state.history.slice(-HISTORY_LIMIT), prevWeeks],
        }))
      },

      toggleCompleted: (weekId, pairId) => {
        set(state => ({
          weeks: state.weeks.map(w =>
            w.id === weekId
              ? { ...w, pairs: w.pairs.map(p => p.id === pairId ? { ...p, completed: !p.completed } : p) }
              : w
          ),
        }))
      },

      updateNote: (weekId, pairId, note) => {
        set(state => ({
          weeks: state.weeks.map(w =>
            w.id === weekId
              ? { ...w, pairs: w.pairs.map(p => p.id === pairId ? { ...p, note } : p) }
              : w
          ),
        }))
      },

      undo: () => {
        const { history } = get()
        if (history.length === 0) return
        const prev = history[history.length - 1]
        set(state => ({
          weeks: prev,
          history: state.history.slice(0, -1),
        }))
      },
    }),
    {
      name: 'call-scheduler-storage',
    }
  )
)

export function usePerson(id: string): Person | undefined {
  return useAppStore(s => s.persons.find(p => p.id === id))
}
