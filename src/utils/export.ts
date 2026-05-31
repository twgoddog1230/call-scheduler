import type { Week, Person } from '../types'

function personName(id: string, persons: Person[]): string {
  return persons.find(p => p.id === id)?.name ?? id
}

export function formatWeekLabel(week: Week): string {
  const s = new Date(week.startDate)
  const e = new Date(week.endDate)
  return `第${week.weekNumber}週（${s.getMonth() + 1}/${s.getDate()}~${e.getMonth() + 1}/${e.getDate()}）`
}

/** 單週文字（複製用，套用固定模板） */
export function buildWeekText(week: Week, persons: Person[]): string {
  const s = new Date(week.startDate)
  const e = new Date(week.endDate)
  const dateRange = `${s.getMonth() + 1}/${s.getDate()}–${e.getMonth() + 1}/${e.getDate()}`
  const pairLines = week.pairs
    .map(pair => ` ▸ ${pair.members.map(id => personName(id, persons)).join(' + ')}`)
    .join('\n')
  return `❤️第 ${week.weekNumber} 週（${dateRange}）
小天使通話分配
(筆記本有夥伴方便通話時間，自行跟對方約時間)❤️

👍通話內容方向：主要傾聽對方生活困擾，關心最近5運親證，給予讚美肯定、陪伴、鼓勵持續親證或是跟上級求救

${pairLines}

請大家通話完成後並完成打卡就打勾✅`
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

/** 單週截圖：用 Canvas API 直接繪製，不依賴 html2canvas */
export async function drawWeekScreenshot(week: Week, persons: Person[]): Promise<void> {
  const DPR = 2
  const W = 480
  const PADDING = 40
  const LINE_H = 34
  const FONT = `"PingFang TC", "Microsoft JhengHei", system-ui, sans-serif`

  const dateLabel = formatWeekLabel(week)
  const names = week.pairs.map(p =>
    p.members.map(id => personName(id, persons)).join(' & ')
  )

  const contentH = 22 + 12 + 18 + 20 + names.length * LINE_H
  const H = PADDING * 2 + contentH

  const canvas = document.createElement('canvas')
  canvas.width = W * DPR
  canvas.height = H * DPR

  const ctx = canvas.getContext('2d')!
  ctx.scale(DPR, DPR)

  // white background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)

  // top accent bar
  ctx.fillStyle = '#6366f1'
  ctx.fillRect(0, 0, W, 4)

  let y = PADDING

  // title
  ctx.fillStyle = '#4f46e5'
  ctx.font = `bold 22px ${FONT}`
  ctx.textAlign = 'center'
  ctx.fillText('通話排程', W / 2, y + 20)
  y += 22 + 12

  // week label
  ctx.fillStyle = '#374151'
  ctx.font = `500 16px ${FONT}`
  ctx.fillText(dateLabel, W / 2, y + 16)
  y += 16 + 20

  // divider
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING, y)
  ctx.lineTo(W - PADDING, y)
  ctx.stroke()
  y += 16

  // pair names
  ctx.textAlign = 'left'
  ctx.fillStyle = '#111827'
  ctx.font = `16px ${FONT}`
  for (const name of names) {
    ctx.fillText(name, PADDING, y + 16)
    y += LINE_H
  }

  await new Promise<void>(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { resolve(); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `通話排程_第${week.weekNumber}週.png`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        resolve()
      }, 100)
    }, 'image/png')
  })
}
