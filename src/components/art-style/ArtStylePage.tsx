import { useState, useEffect, useCallback } from 'react'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { useImageStore } from '@/stores/imageStore'
import { Button } from '@/components/ui/button'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { STYLE_PRESETS } from '@/lib/constants'
import { generateImage } from '@/services/openai'
import { Palette, Plus, X, Eye, Loader2, Sparkles, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepNavButton } from '@/components/layout/StepNavButton'
import { toast } from '@/stores/toastStore'
import type { StylePreset } from '@/types'

const STYLE_VISUALS: Record<StylePreset, { emoji: string; bg: string }> = {
  watercolor:          { emoji: '🎨', bg: 'bg-blue-50' },
  cartoon:             { emoji: '🖍️', bg: 'bg-yellow-50' },
  'flat-illustration': { emoji: '🔷', bg: 'bg-cyan-50' },
  'pencil-sketch':     { emoji: '✏️', bg: 'bg-stone-50' },
  'pixel-art':         { emoji: '👾', bg: 'bg-green-50' },
  collage:             { emoji: '✂️', bg: 'bg-amber-50' },
  'storybook-classic': { emoji: '📖', bg: 'bg-orange-50' },
  anime:               { emoji: '✨', bg: 'bg-pink-50' },
}

const STYLE_PREVIEW_SCENE = 'A friendly fox character sitting under a large tree in a meadow, reading a book, with butterflies and flowers around'

function stylePreviewKey(style: StylePreset): string {
  return `style-preview-${style}`
}

const ALL_STYLE_KEYS = Object.keys(STYLE_PRESETS) as StylePreset[]

function buildCompositePrompt(
  presetStyle: StylePreset | null,
  customDesc: string,
  colorPalette: string[],
  characterVisuals: Record<string, string>
): string {
  const parts: string[] = []
  if (presetStyle && STYLE_PRESETS[presetStyle]) {
    parts.push(STYLE_PRESETS[presetStyle].prompt)
  }
  if (customDesc.trim()) {
    parts.push(customDesc.trim())
  }
  if (colorPalette.length > 0) {
    parts.push(`Color palette: ${colorPalette.join(', ')}`)
  }
  const visuals = Object.entries(characterVisuals)
    .filter(([, v]) => v.trim())
    .map(([name, v]) => `${name}: ${v}`)
  if (visuals.length > 0) {
    parts.push(`Character appearances: ${visuals.join('; ')}`)
  }
  return parts.join('. ')
}

export function ArtStylePage() {
  const project = useActiveProject()
  const updateArtStyle = useProjectStore((s) => s.updateArtStyle)
  const images = useImageStore((s) => s.images)
  const loadImages = useImageStore((s) => s.loadImages)
  const saveImage = useImageStore((s) => s.saveImage)

  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [generatingStylePreview, setGeneratingStylePreview] = useState<string | null>(null)
  const [generatingAllPreviews, setGeneratingAllPreviews] = useState(false)
  const [allPreviewsProgress, setAllPreviewsProgress] = useState<{ current: number; total: number } | null>(null)

  // Load cached style preview images from IndexedDB
  useEffect(() => {
    const keys = ALL_STYLE_KEYS.map(stylePreviewKey)
    loadImages(keys)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null
  const { artStyle, storyPlan } = project

  // Auto-update composite prompt whenever inputs change
  const updateComposite = useCallback(() => {
    const composite = buildCompositePrompt(
      artStyle.presetStyle,
      artStyle.customStyleDescription,
      artStyle.colorPalette,
      artStyle.characterVisuals
    )
    if (composite !== artStyle.compositePrompt) {
      updateArtStyle({ compositePrompt: composite })
    }
  }, [artStyle, updateArtStyle])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { updateComposite() }, [artStyle.presetStyle, artStyle.customStyleDescription, artStyle.colorPalette, artStyle.characterVisuals])

  const handleSelectPreset = (preset: StylePreset) => {
    updateArtStyle({
      presetStyle: artStyle.presetStyle === preset ? null : preset,
    })
  }

  const handleGenerateStylePreview = async (style: StylePreset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (generatingStylePreview || generatingAllPreviews) return
    setGeneratingStylePreview(style)
    try {
      const prompt = `${STYLE_PRESETS[style].prompt}. Scene: ${STYLE_PREVIEW_SCENE}`
      const result = await generateImage(prompt)
      await saveImage(stylePreviewKey(style), result)
      toast(`${STYLE_PRESETS[style].name} preview generated`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate preview'
      toast(msg, 'error')
    } finally {
      setGeneratingStylePreview(null)
    }
  }

  const handleGenerateAllPreviews = async () => {
    setGeneratingAllPreviews(true)
    const toGenerate = ALL_STYLE_KEYS.filter((k) => !images[stylePreviewKey(k)])
    if (toGenerate.length === 0) {
      // Regenerate all
      toGenerate.push(...ALL_STYLE_KEYS)
    }
    setAllPreviewsProgress({ current: 0, total: toGenerate.length })
    try {
      for (let i = 0; i < toGenerate.length; i++) {
        const style = toGenerate[i]
        setAllPreviewsProgress({ current: i + 1, total: toGenerate.length })
        const prompt = `${STYLE_PRESETS[style].prompt}. Scene: ${STYLE_PREVIEW_SCENE}`
        const result = await generateImage(prompt)
        await saveImage(stylePreviewKey(style), result)
      }
      toast(`Generated ${toGenerate.length} style preview${toGenerate.length !== 1 ? 's' : ''}`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate previews'
      toast(msg, 'error')
    } finally {
      setGeneratingAllPreviews(false)
      setAllPreviewsProgress(null)
    }
  }

  const handleAddColor = () => {
    if (artStyle.colorPalette.length < 8) {
      updateArtStyle({
        colorPalette: [...artStyle.colorPalette, '#6366f1'],
      })
    }
  }

  const handleColorChange = (index: number, color: string) => {
    const newPalette = [...artStyle.colorPalette]
    newPalette[index] = color
    updateArtStyle({ colorPalette: newPalette })
  }

  const handleRemoveColor = (index: number) => {
    updateArtStyle({
      colorPalette: artStyle.colorPalette.filter((_, i) => i !== index),
    })
  }

  const handleCharacterVisualChange = (charName: string, visual: string) => {
    updateArtStyle({
      characterVisuals: { ...artStyle.characterVisuals, [charName]: visual },
    })
  }

  const handlePreview = async () => {
    if (!artStyle.compositePrompt.trim()) return
    setPreviewLoading(true)
    setPreviewError('')
    try {
      const testPrompt = `${artStyle.compositePrompt}. Scene: ${STYLE_PREVIEW_SCENE}`
      const result = await generateImage(testPrompt)
      setPreviewImage(result)
      toast('Test image generated', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate preview'
      setPreviewError(msg)
      toast(msg, 'error')
    } finally {
      setPreviewLoading(false)
    }
  }

  const previewCount = ALL_STYLE_KEYS.filter((k) => images[stylePreviewKey(k)]).length

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Style Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Style Presets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Art Style
                  </CardTitle>
                  <CardDescription className="mt-1">Choose a base style for your illustrations</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAllPreviews}
                  disabled={generatingAllPreviews || generatingStylePreview !== null}
                >
                  {generatingAllPreviews ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {previewCount === 0 ? 'Generate All Previews' : previewCount < ALL_STYLE_KEYS.length ? `Generate Remaining (${ALL_STYLE_KEYS.length - previewCount})` : 'Regenerate All Previews'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress bar for batch generation */}
              {allPreviewsProgress && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Generating style {allPreviewsProgress.current} of {allPreviewsProgress.total}...
                  </p>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${(allPreviewsProgress.current / allPreviewsProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.entries(STYLE_PRESETS) as [StylePreset, typeof STYLE_PRESETS[StylePreset]][]).map(
                  ([key, preset]) => {
                    const visual = STYLE_VISUALS[key]
                    const previewSrc = images[stylePreviewKey(key)] ?? null
                    const isGenerating = generatingStylePreview === key
                    return (
                      <button
                        key={key}
                        onClick={() => handleSelectPreset(key)}
                        className={cn(
                          "rounded-lg border-2 text-left transition-all cursor-pointer hover:shadow-md overflow-hidden",
                          artStyle.presetStyle === key
                            ? "border-primary shadow-md ring-2 ring-primary/20"
                            : "border-border hover:border-primary/30"
                        )}
                      >
                        {/* Image preview area */}
                        <div className={cn("relative aspect-square", visual.bg)}>
                          {previewSrc ? (
                            <img
                              src={previewSrc}
                              alt={`${preset.name} style`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-1">
                              <span className="text-3xl">{visual.emoji}</span>
                              {!isGenerating && !generatingAllPreviews && (
                                <span
                                  className="text-[10px] text-muted-foreground hover:text-primary underline"
                                  onClick={(e) => handleGenerateStylePreview(key, e)}
                                >
                                  Generate preview
                                </span>
                              )}
                            </div>
                          )}
                          {isGenerating && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-white" />
                            </div>
                          )}
                          {previewSrc && (
                            <span
                              className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 rounded-full p-0.5 text-white cursor-pointer"
                              onClick={(e) => handleGenerateStylePreview(key, e)}
                              title="Regenerate preview"
                            >
                              <Sparkles className="h-3 w-3" />
                            </span>
                          )}
                        </div>

                        {/* Text label area */}
                        <div className={cn("p-2", visual.bg)}>
                          <p className="font-medium text-sm">{preset.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{preset.description}</p>
                        </div>
                      </button>
                    )
                  }
                )}
              </div>
            </CardContent>
          </Card>

          {/* Custom Style */}
          <Card>
            <CardHeader>
              <CardTitle>Custom Style Description</CardTitle>
              <CardDescription>Add additional style details or override the preset</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={artStyle.customStyleDescription}
                onChange={(e) => updateArtStyle({ customStyleDescription: e.target.value })}
                placeholder="e.g., Soft edges, slightly textured paper background, warm golden lighting, whimsical feel..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Color Palette */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Color Palette</CardTitle>
                <Button variant="outline" size="sm" onClick={handleAddColor} disabled={artStyle.colorPalette.length >= 8}>
                  <Plus className="h-4 w-4" /> Add Color
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {artStyle.colorPalette.length === 0 ? (
                <p className="text-sm text-muted-foreground">No colors added. The AI will choose its own palette.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {artStyle.colorPalette.map((color, i) => (
                    <div key={i} className="flex items-center gap-2 border rounded-lg p-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => handleColorChange(i, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border-0"
                      />
                      <span className="text-xs font-mono">{color}</span>
                      <button
                        onClick={() => handleRemoveColor(i)}
                        className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Character Visuals */}
          {storyPlan.characters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Character Visuals</CardTitle>
                <CardDescription>Describe how each character looks for consistent artwork</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {storyPlan.characters.map((char) => (
                  <div key={char.id} className="space-y-1">
                    <Label>{char.name || 'Unnamed Character'}</Label>
                    <Textarea
                      value={artStyle.characterVisuals[char.name] || char.visualDescription || ''}
                      onChange={(e) => handleCharacterVisualChange(char.name, e.target.value)}
                      placeholder={`Describe ${char.name || 'this character'}'s appearance...`}
                      rows={2}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Preview */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Style Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Composite Prompt:</p>
                <p className="text-xs">{artStyle.compositePrompt || 'Select a style to build the prompt'}</p>
              </div>

              <Button
                onClick={handlePreview}
                disabled={previewLoading || !artStyle.compositePrompt.trim()}
                className="w-full"
              >
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Generate Test Image
              </Button>

              {previewError && <p className="text-sm text-destructive">{previewError}</p>}

              {previewImage && (
                <div className="rounded-lg overflow-hidden border">
                  <img src={previewImage} alt="Style preview" className="w-full" />
                </div>
              )}

              {!previewImage && !previewLoading && (
                <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Preview will appear here</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <StepNavButton />
    </div>
  )
}
