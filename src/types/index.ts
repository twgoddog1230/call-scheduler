export interface Person {
  id: string
  name: string
}

export interface Pair {
  id: string
  members: string[]   // person IDs
  locked: boolean     // manually pinned by user
  completed: boolean  // call marked as done
  note: string
}

export interface Week {
  id: string
  weekNumber: number  // 1-based index within the full date range
  cycleNumber: number // which cycle this week belongs to (1-based)
  startDate: string   // ISO date string (Monday)
  endDate: string     // ISO date string (Sunday)
  pairs: Pair[]
}

export interface Settings {
  startDate: string   // ISO date string
  endDate: string     // ISO date string
  defaultGroupSize: 2 | 3
}

export interface AppState {
  settings: Settings
  persons: Person[]
  weeks: Week[]
  history: Week[][]   // undo stack

  // Settings actions
  updateSettings: (s: Partial<Settings>) => void

  // Person actions
  addPerson: (name: string) => void
  removePerson: (id: string) => void
  reorderPersons: (ids: string[]) => void

  // Schedule actions
  generateSchedule: () => void
  reshuffleWeek: (weekId: string) => void
  lockPair: (weekId: string, pairId: string, locked: boolean) => void
  updatePair: (weekId: string, pairId: string, members: string[]) => void
  toggleCompleted: (weekId: string, pairId: string) => void
  updateNote: (weekId: string, pairId: string, note: string) => void
  undo: () => void
}
