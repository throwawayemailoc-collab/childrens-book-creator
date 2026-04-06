import { useSettingsStore } from '@/stores/settingsStore'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const { apiKey, textModel } = useSettingsStore.getState()
  if (!apiKey) throw new Error('OpenAI API key not set. Please add it in Settings.')

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: textModel,
      messages,
      temperature: 0.8,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function generateImage(
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const { apiKey, imageModel, imageSize, imageQuality } = useSettingsStore.getState()
  if (!apiKey) throw new Error('OpenAI API key not set. Please add it in Settings.')

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: imageModel,
      prompt,
      n: 1,
      size: imageSize,
      quality: imageQuality,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`)
  }

  const data = await response.json()
  // gpt-image-1 returns base64 by default
  const imageData = data.data[0]
  if (imageData.b64_json) {
    return `data:image/png;base64,${imageData.b64_json}`
  }
  // Fall back to URL if available (DALL-E 3 compatibility)
  if (imageData.url) {
    const imgResponse = await fetch(imageData.url, { signal })
    const blob = await imgResponse.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  throw new Error('No image data returned from API')
}
