import { useState, useCallback, useEffect } from 'react'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { useImageStore } from '@/stores/imageStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { generateText, generateImage } from '@/services/openai'
import { IMAGE_SCENE_SYSTEM, buildImageScenePrompt, buildCharacterConsistencyBlock } from '@/lib/prompts'
import { Image, Loader2, Sparkles, RefreshCw, Wand2, ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StepNavButton } from '@/components/layout/StepNavButton'
import { toast } from '@/stores/toastStore'

export function PageArtworkPage() {
  const project = useActiveProject()
  const updatePage = useProjectStore((s) => s.updatePage)
  const images = useImageStore((s) => s.images)
  const loadImages = useImageStore((s) => s.loadImages)

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [error, setError] = useState('')
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [confirmRegenAll, setConfirmRegenAll] = useState(false)

  // Load images from IndexedDB when pages change
  const pageIds = project?.pages.filter((p) => p.hasImage).map((p) => p.id) ?? []
  useEffect(() => {
    if (pageIds.length > 0) loadImages(pageIds)
  }, [pageIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null
  const { pages, artStyle, storyPlan } = project
  const selectedPage = pages.find((p) => p.id === selectedPageId) || pages[0] || null
  const selectedImageSrc = selectedPage ? images[selectedPage.id] ?? null : null

  // Build a character consistency block that gets injected into every image prompt
  const characterBlock = buildCharacterConsistencyBlock(
    storyPlan.characters,
    artStyle.characterVisuals
  )

  // Assemble the full image prompt with style + character consistency + scene
  const assembleFullPrompt = useCallback((imagePrompt: string): string => {
    const parts: string[] = ['Full color illustration for a children\'s picture book']
    if (artStyle.compositePrompt) parts.push(artStyle.compositePrompt)
    if (characterBlock) parts.push(characterBlock)
    parts.push(`Scene: ${imagePrompt}`)
    return parts.join('. ')
  }, [artStyle.compositePrompt, characterBlock])

  const autoGeneratePrompt = useCallback(async (pageId: string, text: string) => {
    if (!text.trim()) return
    setGeneratingPrompt(true)
    try {
      const prompt = buildImageScenePrompt(text, storyPlan.characters)
      const scene = await generateText(IMAGE_SCENE_SYSTEM, prompt)
      updatePage(pageId, { imagePrompt: scene })
    } catch {
      toast('Failed to generate prompt', 'error')
    } finally {
      setGeneratingPrompt(false)
    }
  }, [updatePage, storyPlan.characters])

  const handleGenerateImage = useCallback(async (pageId: string, imagePrompt: string) => {
    if (!imagePrompt.trim()) return
    setGeneratingImage(true)
    setError('')
    try {
      const fullPrompt = assembleFullPrompt(imagePrompt)
      const base64 = await generateImage(fullPrompt)
      updatePage(pageId, { imageBase64: base64 })
      toast('Image generated', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate image'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setGeneratingImage(false)
    }
  }, [assembleFullPrompt, updatePage])

  /** One-click: auto-generate prompt if empty, then generate image */
  const handleOneClickGenerate = useCallback(async (pageId: string, text: string, existingPrompt: string) => {
    setGeneratingImage(true)
    setError('')
    try {
      let prompt = existingPrompt
      if (!prompt.trim() && text.trim()) {
        setGeneratingPrompt(true)
        const scenePrompt = buildImageScenePrompt(text, storyPlan.characters)
        prompt = await generateText(IMAGE_SCENE_SYSTEM, scenePrompt)
        updatePage(pageId, { imagePrompt: prompt })
        setGeneratingPrompt(false)
      }
      if (!prompt.trim()) {
        setError('No text or prompt available for this page.')
        return
      }
      const fullPrompt = assembleFullPrompt(prompt)
      const base64 = await generateImage(fullPrompt)
      updatePage(pageId, { imageBase64: base64 })
      toast('Artwork generated', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate artwork'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setGeneratingImage(false)
      setGeneratingPrompt(false)
    }
  }, [assembleFullPrompt, updatePage, storyPlan.characters])

  const handleGenerateAll = async (regenerate = false) => {
    setGeneratingAll(true)
    setError('')
    const toGenerate = regenerate
      ? pages
      : pages.filter((p) => !p.hasImage)
    setBatchProgress({ current: 0, total: toGenerate.length })
    try {
      for (let i = 0; i < toGenerate.length; i++) {
        const page = toGenerate[i]
        setBatchProgress({ current: i + 1, total: toGenerate.length })
        let prompt = page.imagePrompt
        if (!prompt.trim() && page.text.trim()) {
          const scenePrompt = buildImageScenePrompt(page.text, storyPlan.characters)
          prompt = await generateText(IMAGE_SCENE_SYSTEM, scenePrompt)
          updatePage(page.id, { imagePrompt: prompt })
        }
        if (prompt.trim()) {
          const fullPrompt = assembleFullPrompt(prompt)
          const base64 = await generateImage(fullPrompt)
          updatePage(page.id, { imageBase64: base64 })
        }
      }
      toast(`Generated ${toGenerate.length} image${toGenerate.length !== 1 ? 's' : ''}`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate images'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setGeneratingAll(false)
      setBatchProgress(null)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Page Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Pages</h3>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => handleGenerateAll(false)}
            disabled={generatingAll || pages.length === 0}
          >
            {generatingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Generate All Empty
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setConfirmRegenAll(true)}
            disabled={generatingAll || pages.length === 0}
          >
            <RefreshCw className="h-4 w-4" />
            Regenerate All
          </Button>

          {/* Progress bar */}
          {batchProgress && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Generating page {batchProgress.current} of {batchProgress.total}...
              </p>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
            {pages.map((page) => {
              const thumbSrc = images[page.id] ?? null
              return (
                <button
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  className={cn(
                    "rounded-lg border-2 overflow-hidden text-left transition-all cursor-pointer",
                    selectedPage?.id === page.id
                      ? "border-primary shadow-md"
                      : "border-border hover:border-primary/30"
                  )}
                >
                  {thumbSrc ? (
                    <img src={thumbSrc} alt={`Page ${page.pageNumber}`} className="w-full aspect-square object-cover" />
                  ) : (
                    <div className="w-full aspect-square bg-muted flex items-center justify-center">
                      <Image className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-xs font-medium px-2 py-1">Page {page.pageNumber}</p>
                </button>
              )
            })}
          </div>

          {pages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Add page text first in the Page Text section.
            </p>
          )}
        </div>

        {/* Right: Page Artwork Editor */}
        <div className="lg:col-span-3">
          {selectedPage ? (
            <div className="space-y-6">
              {/* Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Image className="h-5 w-5" />
                    Page {selectedPage.pageNumber} Artwork
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Image */}
                    <div>
                      {selectedImageSrc ? (
                        <div className="rounded-lg overflow-hidden border">
                          <img src={selectedImageSrc} alt={`Page ${selectedPage.pageNumber}`} className="w-full" />
                        </div>
                      ) : (
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                          <div className="text-center text-muted-foreground">
                            <Image className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">No image yet</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground">Page Text</Label>
                        <p className="mt-1 text-sm bg-muted rounded-lg p-3">
                          {selectedPage.text || 'No text for this page'}
                        </p>
                      </div>

                      {/* One-click generate button */}
                      <Button
                        onClick={() => handleOneClickGenerate(selectedPage.id, selectedPage.text, selectedPage.imagePrompt)}
                        disabled={generatingImage || generatingPrompt || !selectedPage.text.trim()}
                        className="w-full"
                        size="lg"
                      >
                        {(generatingImage || generatingPrompt) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {selectedPage.hasImage ? 'Regenerate Artwork' : 'Generate Artwork'}
                      </Button>

                      {/* Manual prompt controls */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Image Prompt (advanced)</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => autoGeneratePrompt(selectedPage.id, selectedPage.text)}
                            disabled={generatingPrompt || !selectedPage.text.trim()}
                          >
                            {generatingPrompt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                            Auto-generate
                          </Button>
                        </div>
                        <Textarea
                          value={selectedPage.imagePrompt}
                          onChange={(e) => updatePage(selectedPage.id, { imagePrompt: e.target.value })}
                          placeholder="Describe the illustration for this page..."
                          rows={3}
                          className="text-xs"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateImage(selectedPage.id, selectedPage.imagePrompt)}
                          disabled={generatingImage || !selectedPage.imagePrompt.trim()}
                          className="w-full"
                        >
                          {generatingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                          Generate from Prompt
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Book Page Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Book Page Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative rounded-lg shadow-inner border overflow-hidden max-w-2xl mx-auto bg-black" style={{ aspectRatio: '4/3' }}>
                    {selectedImageSrc ? (
                      <>
                        <img src={selectedImageSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        {selectedPage.text && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-6 py-3">
                            <p className="text-center text-sm leading-relaxed text-white font-serif">
                              {selectedPage.text}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full bg-white">
                        <p className="text-center text-sm font-serif px-6">
                          {selectedPage.text || 'Page text will appear here'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a page to edit its artwork
            </div>
          )}
        </div>
      </div>

      <StepNavButton />

      <ConfirmDialog
        open={confirmRegenAll}
        onOpenChange={setConfirmRegenAll}
        title="Regenerate All Images"
        description="This will regenerate all page images, replacing any existing artwork. This may take a while and use API credits. Continue?"
        confirmLabel="Regenerate All"
        variant="destructive"
        onConfirm={() => handleGenerateAll(true)}
      />
    </div>
  )
}
