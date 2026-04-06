export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const API_KEY = process.env.OPENAI_API_KEY
  if (!API_KEY) {
    return res.status(500).json({ error: { message: 'OPENAI_API_KEY not configured' } })
  }

  const { prompt, model, size, quality } = req.body

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ prompt, model, n: 1, size, quality }),
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
      const imgResponse = await fetch(imageData.url)
      const buffer = Buffer.from(await imgResponse.arrayBuffer())
      res.json({ image: `data:image/png;base64,${buffer.toString('base64')}` })
    } else {
      res.status(500).json({ error: { message: 'No image data returned from API' } })
    }
  } catch (err) {
    console.error('Image generation error:', err.message)
    res.status(500).json({ error: { message: err.message } })
  }
}
