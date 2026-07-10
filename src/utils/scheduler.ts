import type { Pair, Week, Person } from '../types'

function uuid() {
  return Math.random().toString(36).slice(2, 10)
}

/** Returns all Mondays between startDate and endDate (inclusive) */
export function getWeekStarts(startDate: string, endDate: string): Date[] {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const day = start.getDay()
  if (day !== 1) {
    const diff = day === 0 ? 1 : 8 - day
    start.setDate(start.getDate() + diff)
  }

  const weeks: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    weeks.push(new Date(cur))
    cur.setDate(cur.getDate() + 7)
  }
  return weeks
}

/**
 * Build a full schedule across all weeks.
 *
 * Preserves completed weeks and uses their pairs as global history so
 * future weeks never repeat a pairing until all combinations are exhausted.
 */
export function buildSchedule(
  persons: Person[],
  startDate: string,
  endDate: string,
  existingWeeks: Week[] = [],
): Week[] {
  if (persons.length < 2) return []

  const weekStarts = getWeekStarts(startDate, endDate)
  if (weekStarts.length === 0) return []

  const personIds = persons.map(p => p.id)
  const totalUniquePairs = (personIds.length * (personIds.length - 1)) / 2

  // Map existing weeks by start date for quick lookup
  const existingByStart = new Map<string, Week>()
  for (const w of existingWeeks) {
    existingByStart.set(w.startDate, w)
  }

  // Global pair tracker — resets when all combinations are exhausted
  const globalUsedPairs = new Set<string>()
  let cycleNumber = 1

  return weekStarts.map((monday, idx) => {
    const startISO = toISO(monday)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const endISO = toISO(sunday)

    const existing = existingByStart.get(startISO)
    const hasCompleted = existing?.pairs.some(p => p.completed) ?? false

    // Preserve completed weeks as-is; track their pairs as used history
    if (hasCompleted && existing) {
      for (const pair of existing.pairs) {
        globalUsedPairs.add(pairKey(pair.members))
      }
      if (globalUsedPairs.size >= totalUniquePairs) {
        globalUsedPairs.clear()
        cycleNumber++
      }
      return { ...existing, weekNumber: idx + 1, cycleNumber }
    }

    // Start a new cycle when all pairs have been used
    if (globalUsedPairs.size >= totalUniquePairs) {
      globalUsedPairs.clear()
      cycleNumber++
    }

    // Greedy assign with randomised order for variety
    const newPairMembers = greedyAssign(shuffle([...personIds]), globalUsedPairs)
    newPairMembers.forEach(m => globalUsedPairs.add(pairKey(m)))

    const existingPairs = existing?.pairs ?? []

    return {
      id: existing?.id ?? uuid(),
      weekNumber: idx + 1,
      cycleNumber,
      startDate: startISO,
      endDate: endISO,
      pairs: newPairMembers.map((members, i) => ({
        id: existingPairs[i]?.id ?? uuid(),
        members,
        locked: false,
        completed: false,
        note: '',
      })),
    }
  })
}

/**
 * Reshuffle unlocked pairs in one week, respecting all completed/locked
 * pairs from every other week as global constraints.
 */
export function reshuffleWeekPairs(
  weeks: Week[],
  weekId: string,
  persons: Person[],
): Week[] {
  const target = weeks.find(w => w.id === weekId)
  if (!target) return weeks

  const personIds = persons.map(p => p.id)

  // All completed/locked pairs from every week (including this one's fixed pairs)
  const globalUsedPairs = new Set<string>()
  for (const w of weeks) {
    for (const p of w.pairs) {
      if (p.completed || p.locked) globalUsedPairs.add(pairKey(p.members))
    }
  }

  const fixedMembers = new Set(
    target.pairs.filter(p => p.locked || p.completed).flatMap(p => p.members)
  )
  const unlocked = personIds.filter(id => !fixedMembers.has(id))
  if (unlocked.length === 0) return weeks

  const newPairMembers = greedyAssign(shuffle([...unlocked]), globalUsedPairs)
  const fixedPairs = target.pairs.filter(p => p.locked || p.completed)
  const unlockedPairs = target.pairs.filter(p => !p.locked && !p.completed)

  const rebuiltPairs: Pair[] = [
    ...fixedPairs,
    ...newPairMembers.map((members, i) => ({
      id: unlockedPairs[i]?.id ?? uuid(),
      members,
      locked: false,
      completed: false,
      note: unlockedPairs[i]?.note ?? '',
    })),
  ]

  return weeks.map(w => w.id === weekId ? { ...w, pairs: rebuiltPairs } : w)
}

/**
 * When a pair is locked/changed in a week, recalculate unlocked pairs in that
 * cycle so no two people are paired more than once per cycle.
 * Completed pairs are also treated as fixed constraints.
 */
export function recalculateAfterLock(
  weeks: Week[],
  changedWeekId: string,
  personIds: string[],
): Week[] {
  const changed = weeks.find(w => w.id === changedWeekId)
  if (!changed) return weeks

  const cycle = changed.cycleNumber
  const cycleWeeks = weeks.filter(w => w.cycleNumber === cycle)

  // Treat locked and completed pairs as immovable constraints for this cycle
  const usedPairs = new Set<string>()
  for (const w of cycleWeeks) {
    for (const p of w.pairs) {
      if (p.locked || p.completed) usedPairs.add(pairKey(p.members))
    }
  }

  const updatedCycleWeeks = cycleWeeks.map(week => {
    const fixedMembers = new Set(
      week.pairs.filter(p => p.locked || p.completed).flatMap(p => p.members)
    )
    const unlocked = personIds.filter(id => !fixedMembers.has(id))

    if (unlocked.length === 0) return week

    const newPairs = greedyAssign(shuffle([...unlocked]), usedPairs)
    newPairs.forEach(m => usedPairs.add(pairKey(m)))

    const fixedPairsInWeek = week.pairs.filter(p => p.locked || p.completed)
    const unlockedPairsInWeek = week.pairs.filter(p => !p.locked && !p.completed)

    const rebuiltUnlocked: Pair[] = newPairs.map((members, i) => ({
      id: unlockedPairsInWeek[i]?.id ?? uuid(),
      members,
      locked: false,
      completed: false,
      note: unlockedPairsInWeek[i]?.note ?? '',
    }))

    return { ...week, pairs: [...fixedPairsInWeek, ...rebuiltUnlocked] }
  })

  return weeks.map(w => {
    const updated = updatedCycleWeeks.find(uw => uw.id === w.id)
    return updated ?? w
  })
}

/**
 * Greedy pair assignment — avoids pairs already in usedPairs.
 * Among equally-scored candidates, picks randomly for variety.
 */
function greedyAssign(ids: string[], usedPairs: Set<string>): string[][] {
  const remaining = [...ids]
  const result: string[][] = []

  while (remaining.length >= 2) {
    const a = remaining.shift()!
    let bestScore = -Infinity
    const bestCandidates: number[] = []

    for (let i = 0; i < remaining.length; i++) {
      const score = usedPairs.has(pairKey([a, remaining[i]])) ? -1 : 1
      if (score > bestScore) {
        bestScore = score
        bestCandidates.length = 0
        bestCandidates.push(i)
      } else if (score === bestScore) {
        bestCandidates.push(i)
      }
    }

    const chosen = bestCandidates[Math.floor(Math.random() * bestCandidates.length)]
    result.push([a, remaining.splice(chosen, 1)[0]])
  }

  // Odd person out joins the last pair as a triple
  if (remaining.length === 1 && result.length > 0) {
    result[result.length - 1].push(remaining[0])
  }

  return result
}

function pairKey(members: string[]): string {
  return [...members].sort().join('|')
}

/**
 * Builds per-person partner history used to warn against re-picking someone
 * during manual edit: pairs locked/completed within the same cycle (a real
 * duplicate) vs. pairs completed in any past cycle (informational only).
 */
export function getPartnerHistory(
  weeks: Week[],
  cycleNumber: number,
  excludePairId: string,
): { sameCycleBlocked: Map<string, Set<string>>; everCompleted: Map<string, Set<string>> } {
  const sameCycleBlocked = new Map<string, Set<string>>()
  const everCompleted = new Map<string, Set<string>>()

  const link = (map: Map<string, Set<string>>, a: string, b: string) => {
    if (!map.has(a)) map.set(a, new Set())
    map.get(a)!.add(b)
  }

  for (const w of weeks) {
    for (const p of w.pairs) {
      if (p.id === excludePairId) continue
      for (let i = 0; i < p.members.length; i++) {
        for (let j = i + 1; j < p.members.length; j++) {
          const [x, y] = [p.members[i], p.members[j]]
          if (p.completed) {
            link(everCompleted, x, y)
            link(everCompleted, y, x)
          }
          if (w.cycleNumber === cycleNumber && (p.locked || p.completed)) {
            link(sameCycleBlocked, x, y)
            link(sameCycleBlocked, y, x)
          }
        }
      }
    }
  }

  return { sameCycleBlocked, everCompleted }
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}
