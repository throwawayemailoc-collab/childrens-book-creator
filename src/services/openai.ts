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
  const { textModel } = useSettingsStore.getState()

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  const response = await fetch('/api/generate-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: textModel,
      messages,
      temperature: 0.8,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

export async function generateImage(
  prompt: string,
  signal?: AbortSignal
): Promise<string> {
  const { imageModel, imageSize, imageQuality } = useSettingsStore.getState()

  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: imageModel,
      size: imageSize,
      quality: imageQuality,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error: ${response.status}`)
  }

  const data = await response.json()
  return data.image
}
