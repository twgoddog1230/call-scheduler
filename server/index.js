import express from 'express'
import cors from 'cors'
import pg from 'pg'

const { Pool } = pg
const app = express()
const PORT = process.env.PORT || 3000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
})

app.use(cors())
app.use(express.json({ limit: '2mb' }))

// 初始化資料表
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sync_data (
      code      VARCHAR(20) PRIMARY KEY,
      data      JSONB       NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  console.log('DB ready')
}

// 讀取同步碼資料
app.get('/api/:code', async (req, res) => {
  const { code } = req.params
  const result = await pool.query(
    'SELECT data FROM sync_data WHERE code = $1', [code.toUpperCase()]
  )
  if (result.rows.length === 0) return res.json(null)
  res.json(result.rows[0].data)
})

// 儲存同步碼資料
app.put('/api/:code', async (req, res) => {
  const { code } = req.params
  const data = req.body
  await pool.query(
    `INSERT INTO sync_data (code, data, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (code) DO UPDATE SET data = $2, updated_at = NOW()`,
    [code.toUpperCase(), JSON.stringify(data)]
  )
  res.json({ ok: true })
})

// 健康檢查
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

initDB().then(() => {
  app.listen(PORT, () => console.log(`Server on port ${PORT}`))
})
