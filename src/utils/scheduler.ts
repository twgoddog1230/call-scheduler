import type { Pair, Week, Person } from '../types'

function uuid() {
  return Math.random().toString(36).slice(2, 10)
}

/** Returns all Mondays between startDate and endDate (inclusive) */
export function getWeekStarts(startDate: string, endDate: string): Date[] {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Advance to next Monday if not already Monday
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

/** Round-robin schedule for N people.
 *  Returns an array of rounds; each round is an array of [id, id] pairs.
 *  For odd N, one group per round is a triple.
 */
export function roundRobin(personIds: string[]): string[][][] {
  const ids = [...personIds]
  const odd = ids.length % 2 !== 0
  if (odd) ids.push('__bye__')  // virtual bye slot

  const n = ids.length
  const rounds: string[][][] = []

  for (let r = 0; r < n - 1; r++) {
    const round: string[][] = []
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i]
      const b = ids[n - 1 - i]
      if (a !== '__bye__' && b !== '__bye__') {
        round.push([a, b])
      } else {
        // the real person gets a bye — skip adding a pair
      }
    }

    // If odd, the person who had bye joins the last real pair to form a triple
    if (odd) {
      const byeIndex = ids.indexOf('__bye__')
      let realPerson: string | null = null
      if (byeIndex < n / 2) {
        realPerson = ids[n - 1 - byeIndex]
      } else {
        realPerson = ids[n - 1 - byeIndex]
      }
      if (realPerson && round.length > 0) {
        round[round.length - 1].push(realPerson)
      }
    }

    rounds.push(round)

    // Rotate: keep ids[0] fixed, rotate the rest
    const last = ids.pop()!
    ids.splice(1, 0, last)
  }

  return rounds
}

/** Build a full schedule across all weeks with cycle tracking */
export function buildSchedule(
  persons: Person[],
  startDate: string,
  endDate: string,
): Week[] {
  if (persons.length < 2) return []

  const weekStarts = getWeekStarts(startDate, endDate)
  if (weekStarts.length === 0) return []

  const personIds = persons.map(p => p.id)

  // Shuffle once for randomness
  const shuffled = shuffle([...personIds])
  const rounds = roundRobin(shuffled)
  const cycleLength = rounds.length  // N-1 rounds per cycle

  const weeks: Week[] = weekStarts.map((monday, idx) => {
    const cycleIndex = Math.floor(idx / cycleLength)
    const roundIndex = idx % cycleLength

    // Re-shuffle at the start of each new cycle (but keep it deterministic per cycle)
    let roundOrder = rounds
    if (cycleIndex > 0) {
      const cycleShuffled = seededShuffle([...personIds], cycleIndex)
      roundOrder = roundRobin(cycleShuffled)
    }

    const round = roundOrder[roundIndex] ?? roundOrder[0]

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    return {
      id: uuid(),
      weekNumber: idx + 1,
      cycleNumber: cycleIndex + 1,
      startDate: toISO(monday),
      endDate: toISO(sunday),
      pairs: round.map(members => ({
        id: uuid(),
        members,
        locked: false,
        completed: false,
        note: '',
      })),
    }
  })

  return weeks
}

/**
 * When a pair is locked/changed in a week, recalculate unlocked pairs in that
 * week AND recalculate unlocked pairs in the same cycle so that no two people
 * are paired more than once per cycle (best-effort greedy).
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

  // Collect all locked pairs across cycle
  const lockedPairs: string[][] = []
  for (const w of cycleWeeks) {
    for (const p of w.pairs) {
      if (p.locked) lockedPairs.push(p.members)
    }
  }

  // Build used-pairs set for the cycle from locked pairs
  const usedPairs = new Set<string>(lockedPairs.map(m => pairKey(m)))

  // Reassign unlocked pairs week by week within the cycle
  const updatedCycleWeeks = cycleWeeks.map(week => {
    const lockedMembers = new Set(
      week.pairs.filter(p => p.locked).flatMap(p => p.members)
    )
    const unlocked = personIds.filter(id => !lockedMembers.has(id))

    if (unlocked.length === 0) return week

    const newPairs = greedyAssign(unlocked, usedPairs)

    // Mark these new pairs as used
    newPairs.forEach(m => usedPairs.add(pairKey(m)))

    const lockedPairsInWeek = week.pairs.filter(p => p.locked)
    const unlockedPairsInWeek = week.pairs.filter(p => !p.locked)

    const rebuiltUnlocked: Pair[] = newPairs.map((members, i) => ({
      id: unlockedPairsInWeek[i]?.id ?? uuid(),
      members,
      locked: false,
      completed: false,
      note: unlockedPairsInWeek[i]?.note ?? '',
    }))

    return { ...week, pairs: [...lockedPairsInWeek, ...rebuiltUnlocked] }
  })

  return weeks.map(w => {
    const updated = updatedCycleWeeks.find(uw => uw.id === w.id)
    return updated ?? w
  })
}

/** Greedy pair assignment: minimize repeated pairs */
function greedyAssign(ids: string[], usedPairs: Set<string>): string[][] {
  const remaining = [...ids]
  const result: string[][] = []

  while (remaining.length >= 2) {
    const a = remaining.shift()!
    let best = -1
    let bestScore = -Infinity

    for (let i = 0; i < remaining.length; i++) {
      const b = remaining[i]
      const score = usedPairs.has(pairKey([a, b])) ? -1 : 1
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }

    const b = remaining.splice(best, 1)[0]
    result.push([a, b])
  }

  // If one person left (odd), add to last pair
  if (remaining.length === 1) {
    if (result.length > 0) {
      result[result.length - 1].push(remaining[0])
    }
  }

  return result
}

function pairKey(members: string[]): string {
  return [...members].sort().join('|')
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const s = arr.slice()
  let h = seed
  for (let i = s.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(h) % (i + 1)
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  return s
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10)
}
