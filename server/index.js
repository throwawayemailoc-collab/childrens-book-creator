import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
const PORT = process.env.PORT || 3001
const API_KEY = process.env.OPENAI_API_KEY

if (!API_KEY) {
  console.error('ERROR: OPENAI_API_KEY is not set in .env file')
  process.exit(1)
}

app.use(express.json({ limit: '50mb' }))

// --- POST /api/generate-text ---
app.post('/api/generate-text', async (req, res) => {
  const { model, messages, temperature } = req.body
  const controller = new AbortController()
  req.on('close', () => controller.abort())

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model, messages, temperature }),
      signal: controller.signal,
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json(data)
    }
    res.json(data)
  } catch (err) {
    if (err.name === 'AbortError') return
    console.error('Text generation error:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

// --- POST /api/generate-image ---
app.post('/api/generate-image', async (req, res) => {
  const { prompt, model, size, quality } = req.body
  const controller = new AbortController()
  req.on('close', () => controller.abort())

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ prompt, model, n: 1, size, quality }),
      signal: controller.signal,
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    // Normalize response: always return base64
    const imageData = data.data[0]
    if (imageData.b64_json) {
      res.json({ image: `data:image/png;base64,${imageData.b64_json}` })
    } else if (imageData.url) {
      const imgResponse = await fetch(imageData.url, { signal: controller.signal })
      const buffer = Buffer.from(await imgResponse.arrayBuffer())
      res.json({ image: `data:image/png;base64,${buffer.toString('base64')}` })
    } else {
      res.status(500).json({ error: { message: 'No image data returned from API' } })
    }
  } catch (err) {
    if (err.name === 'AbortError') return
    console.error('Image generation error:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
})

// --- Production: serve static files ---
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.join(__dirname, '..', 'dist')

app.use(express.static(distPath))
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
