export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const API_KEY = process.env.OPENAI_API_KEY
  if (!API_KEY) {
    return res.status(500).json({ error: { message: 'OPENAI_API_KEY not configured' } })
  }

  const { model, messages, temperature } = req.body

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model, messages, temperature }),
    })

    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json(data)
    }
    res.json(data)
  } catch (err) {
    console.error('Text generation error:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
}
