import { useState, useEffect } from 'react'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { useImageStore } from '@/stores/imageStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { generateBookPDF } from '@/services/pdf'
import { generateImage } from '@/services/openai'
import { buildCoverImagePrompt } from '@/lib/prompts'
import { Download, Loader2, BookOpen, Image, FileText, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react'
import { StepNavButton } from '@/components/layout/StepNavButton'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/stores/toastStore'
import type { PDFExportOptions } from '@/types'

export function PDFExportPage() {
  const project = useActiveProject()
  const images = useImageStore((s) => s.images)
  const loadImages = useImageStore((s) => s.loadImages)
  const loadImage = useImageStore((s) => s.loadImage)
  const setCoverImage = useProjectStore((s) => s.setCoverImage)
  const [exporting, setExporting] = useState(false)
  const [generatingCover, setGeneratingCover] = useState(false)
  const [error, setError] = useState('')
  const [coverError, setCoverError] = useState('')
  const [options, setOptions] = useState<PDFExportOptions>({
    pageSize: 'letter',
    orientation: 'landscape',
    fontSize: 18,
    margins: 0.75,
    includeTitle: true,
  })

  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const coverKey = activeProjectId ? `cover_${activeProjectId}` : ''

  // Load page images from IndexedDB
  const pageIds = project?.pages.filter((p) => p.hasImage).map((p) => p.id) ?? []
  useEffect(() => {
    if (pageIds.length > 0) loadImages(pageIds)
  }, [pageIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load cover image
  useEffect(() => {
    if (project?.hasCoverImage && coverKey) loadImage(coverKey)
  }, [project?.hasCoverImage, coverKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null
  const { pages, storyPlan, artStyle } = project

  const pagesWithText = pages.filter((p) => p.text.trim())
  const pagesWithImages = pages.filter((p) => p.hasImage)
  const coverImageSrc = coverKey ? images[coverKey] ?? null : null

  const handleGenerateCover = async () => {
    setGeneratingCover(true)
    setCoverError('')
    try {
      const prompt = buildCoverImagePrompt(
        storyPlan.title,
        storyPlan.characters,
        artStyle.compositePrompt,
        storyPlan.synopsis
      )
      const base64 = await generateImage(prompt)
      setCoverImage(base64)
      toast('Cover image generated', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate cover'
      setCoverError(msg)
      toast(msg, 'error')
    } finally {
      setGeneratingCover(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    setError('')
    try {
      // Build image map including cover
      const exportImages = { ...images }
      if (coverImageSrc) {
        exportImages['__cover__'] = coverImageSrc
      }
      const blob = await generateBookPDF(project, options, exportImages)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${storyPlan.title || 'storybook'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('PDF exported successfully', 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export PDF'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Settings */}
        <div className="space-y-6">
          {/* Cover Image */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Front Cover
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {coverImageSrc ? (
                <div className="rounded-lg overflow-hidden border">
                  <img src={coverImageSrc} alt="Book cover" className="w-full" />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                  <div className="text-center text-muted-foreground">
                    <BookOpen className="h-10 w-10 mx-auto mb-2" />
                    <p className="text-sm">No cover image yet</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateCover}
                  disabled={generatingCover || !storyPlan.title.trim()}
                  className="flex-1"
                >
                  {generatingCover ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {coverImageSrc ? 'Regenerate Cover' : 'Generate Cover'}
                </Button>
                {coverImageSrc && (
                  <Button
                    variant="outline"
                    onClick={handleGenerateCover}
                    disabled={generatingCover}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {coverError && <p className="text-xs text-destructive">{coverError}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Export Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Page Size</Label>
                <Select
                  value={options.pageSize}
                  onChange={(e) => setOptions({ ...options, pageSize: e.target.value as PDFExportOptions['pageSize'] })}
                >
                  <option value="letter">Letter (11 x 8.5 in)</option>
                  <option value="a4">A4 (11.69 x 8.27 in)</option>
                  <option value="square">Square (8.5 x 8.5 in)</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Orientation</Label>
                <Select
                  value={options.orientation}
                  onChange={(e) => setOptions({ ...options, orientation: e.target.value as PDFExportOptions['orientation'] })}
                >
                  <option value="landscape">Landscape (Recommended)</option>
                  <option value="portrait">Portrait</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Font Size (pt)</Label>
                <Input
                  type="number"
                  value={options.fontSize}
                  onChange={(e) => setOptions({ ...options, fontSize: Number(e.target.value) })}
                  min={10}
                  max={36}
                />
              </div>

              <div className="space-y-2">
                <Label>Margins (inches)</Label>
                <Input
                  type="number"
                  value={options.margins}
                  onChange={(e) => setOptions({ ...options, margins: Number(e.target.value) })}
                  min={0.25}
                  max={2}
                  step={0.25}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeTitle"
                  checked={options.includeTitle}
                  onChange={(e) => setOptions({ ...options, includeTitle: e.target.checked })}
                  className="rounded border-input"
                />
                <Label htmlFor="includeTitle">Include cover page</Label>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Book Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="font-medium">Title:</span>
                <span className="text-muted-foreground">{storyPlan.title || 'Untitled'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">Pages with text:</span>
                <span className="text-muted-foreground">{pagesWithText.length} / {pages.length}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Image className="h-4 w-4 text-primary" />
                <span className="font-medium">Pages with art:</span>
                <span className="text-muted-foreground">{pagesWithImages.length} / {pages.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Missing content warnings */}
          {(pages.length - pagesWithText.length > 0 || pages.length - pagesWithImages.length > 0 || !artStyle.compositePrompt.trim()) && (
            <Card className="border-yellow-300 bg-yellow-50">
              <CardContent className="py-3 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-4 w-4" />
                  Missing Content
                </p>
                {pages.length - pagesWithText.length > 0 && (
                  <Badge variant="warning">{pages.length - pagesWithText.length} page{pages.length - pagesWithText.length > 1 ? 's' : ''} missing text</Badge>
                )}
                {pages.length - pagesWithImages.length > 0 && (
                  <Badge variant="warning">{pages.length - pagesWithImages.length} page{pages.length - pagesWithImages.length > 1 ? 's' : ''} missing artwork</Badge>
                )}
                {!artStyle.compositePrompt.trim() && (
                  <Badge variant="warning">No art style configured</Badge>
                )}
              </CardContent>
            </Card>
          )}

          <Button
            size="lg"
            className="w-full"
            onClick={handleExport}
            disabled={exporting || pages.length === 0}
          >
            {exporting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            Download PDF
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* Right: Book Preview */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Book Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Cover Page */}
                {options.includeTitle && (
                  <div
                    className="relative rounded-lg shadow-md border overflow-hidden bg-black"
                    style={{ aspectRatio: options.orientation === 'landscape' ? '4/3' : '3/4' }}
                  >
                    {coverImageSrc ? (
                      <>
                        <img src={coverImageSrc} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                        {/* Text overlay band at bottom */}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-6 py-4">
                          <h2 className="text-2xl font-bold text-center text-white">{storyPlan.title || 'Untitled'}</h2>
                          {storyPlan.moral && (
                            <p className="text-sm text-white/80 mt-1 italic text-center">{storyPlan.moral}</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full bg-white">
                        <h2 className="text-2xl font-bold text-center">{storyPlan.title || 'Untitled'}</h2>
                        {storyPlan.moral && (
                          <p className="text-sm text-muted-foreground mt-4 italic text-center">{storyPlan.moral}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Story Pages */}
                {pages.map((page) => {
                  const imgSrc = images[page.id] ?? null
                  return (
                    <div
                      key={page.id}
                      className="relative rounded-lg shadow-md border overflow-hidden bg-black"
                      style={{ aspectRatio: options.orientation === 'landscape' ? '4/3' : '3/4' }}
                    >
                      {imgSrc ? (
                        <>
                          <img src={imgSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          {/* Text overlay band at bottom */}
                          {page.text && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/55 px-6 py-3">
                              <p className="text-center text-sm leading-relaxed text-white font-serif">
                                {page.text}
                              </p>
                            </div>
                          )}
                          {/* Page number */}
                          <div className="absolute top-2 right-3 bg-black/40 rounded-full w-6 h-6 flex items-center justify-center">
                            <span className="text-[10px] text-white">{page.pageNumber}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full bg-white">
                          <p className="text-center text-sm leading-relaxed font-serif px-6">
                            {page.text || 'Empty page'}
                          </p>
                          <p className="text-center text-xs text-muted-foreground mt-2">{page.pageNumber}</p>
                        </div>
                      )}
                    </div>
                  )
                })}

                {pages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4" />
                    <p>No pages to preview. Add text and artwork first.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <StepNavButton />
    </div>
  )
}
