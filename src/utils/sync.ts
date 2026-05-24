const API = 'https://api-production-4be9.up.railway.app'

export async function pushSync(code: string, data: unknown): Promise<void> {
  const res = await fetch(`${API}/api/${code}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('同步失敗')
}

export async function pullSync(code: string): Promise<unknown> {
  const res = await fetch(`${API}/api/${code}`)
  if (!res.ok) throw new Error('載入失敗')
  return res.json()
}
