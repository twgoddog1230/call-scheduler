import express from 'express'
import cors from 'cors'
import pg from 'pg'

const { Pool } = pg
const app = express()
const PORT = process.env.PORT || 3000

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  connectionTimeoutMillis: 10000,
})

app.use(cors())
app.use(express.json({ limit: '2mb' }))

console.log('VERSION: ssl-fix-v3')
console.log('DB URL prefix:', process.env.DATABASE_URL?.slice(0, 30))

let dbReady = false

async function initDB(retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sync_data (
          code       VARCHAR(20)  PRIMARY KEY,
          data       JSONB        NOT NULL,
          updated_at TIMESTAMPTZ  DEFAULT NOW()
        )
      `)
      dbReady = true
      console.log('DB ready')
      return
    } catch (err) {
      console.log(`DB not ready (attempt ${i + 1}/${retries}): ${err.message}`)
      if (i < retries - 1) await new Promise(r => setTimeout(r, delay))
    }
  }
  console.error('Could not connect to DB after retries, exiting')
  process.exit(1)
}

app.get('/health', (_req, res) => {
  res.json({ status: dbReady ? 'ok' : 'starting' })
})

app.get('/api/:code', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'starting' })
  const { code } = req.params
  const result = await pool.query('SELECT data FROM sync_data WHERE code = $1', [code.toUpperCase()])
  res.json(result.rows.length === 0 ? null : result.rows[0].data)
})

app.put('/api/:code', async (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'starting' })
  const { code } = req.params
  await pool.query(
    `INSERT INTO sync_data (code, data, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (code) DO UPDATE SET data = $2, updated_at = NOW()`,
    [code.toUpperCase(), JSON.stringify(req.body)]
  )
  res.json({ ok: true })
})

// 先啟動 HTTP server，背景重試連 DB
app.listen(PORT, () => console.log(`Server on port ${PORT}`))
initDB()
