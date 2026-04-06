import { useState } from 'react'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { generateText } from '@/services/openai'
import { GENERATE_ALL_PAGES_SYSTEM, REFINE_PAGE_TEXT_SYSTEM, buildGenerateAllPagesPrompt, buildRefinePrompt } from '@/lib/prompts'
import { AGE_RANGE_PAGE_COUNTS, REFINE_ACTIONS } from '@/lib/constants'
import { Plus, Trash2, Loader2, Sparkles, Wand2, FileText, GripVertical } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import type { BookPage } from '@/types'
import { cn } from '@/lib/utils'
import { StepNavButton } from '@/components/layout/StepNavButton'
import { toast } from '@/stores/toastStore'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortablePageItem({
  page,
  isSelected,
  onSelect,
  onRemove,
}: {
  page: BookPage
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm border transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-accent"
      )}
    >
      <GripVertical
        className="h-3 w-3 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      />
      <div className="flex-1 min-w-0">
        <span className="font-medium">Page {page.pageNumber}</span>
        <p className="text-xs text-muted-foreground truncate">
          {page.text || 'Empty'}
        </p>
      </div>
      <button
        className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

export function PageTextPage() {
  const project = useActiveProject()
  const addPage = useProjectStore((s) => s.addPage)
  const removePage = useProjectStore((s) => s.removePage)
  const updatePage = useProjectStore((s) => s.updatePage)
  const setPages = useProjectStore((s) => s.setPages)
  const reorderPages = useProjectStore((s) => s.reorderPages)

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [refining, setRefining] = useState<string | null>(null)
  const [customInstruction, setCustomInstruction] = useState('')
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  if (!project) return null
  const { pages, storyPlan } = project

  const selectedPage = pages.find((p) => p.id === selectedPageId) || pages[0] || null

  const handleGenerateAll = async () => {
    if (!storyPlan.synopsis.trim()) {
      setError('Please write a synopsis in Story Planning first.')
      return
    }
    setGenerating(true)
    setError('')
    try {
      const pageCount = AGE_RANGE_PAGE_COUNTS[storyPlan.targetAgeRange]
      const prompt = buildGenerateAllPagesPrompt(storyPlan, pageCount)
      const result = await generateText(GENERATE_ALL_PAGES_SYSTEM, prompt)

      // Parse JSON array from response
      const cleaned = result.replace(/```json\n?|\n?```/g, '').trim()
      const texts: string[] = JSON.parse(cleaned)

      const newPages: BookPage[] = texts.map((text, i) => ({
        id: uuidv4(),
        pageNumber: i + 1,
        text,
        imagePrompt: '',
        imageBase64: null,
        hasImage: false,
      }))
      setPages(newPages)
      if (newPages.length > 0) setSelectedPageId(newPages[0].id)
      toast(`Generated ${newPages.length} pages`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate pages'
      setError(msg)
      toast(msg, 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleRefine = async (instruction: string) => {
    if (!selectedPage) return
    setRefining(instruction)
    try {
      const prompt = buildRefinePrompt(selectedPage.text, instruction)
      const result = await generateText(REFINE_PAGE_TEXT_SYSTEM, prompt)
      updatePage(selectedPage.id, { text: result })
      toast('Text refined', 'success')
    } catch {
      toast('Failed to refine text', 'error')
    } finally {
      setRefining(null)
    }
  }

  const handleCustomRefine = () => {
    if (customInstruction.trim()) {
      handleRefine(customInstruction.trim())
      setCustomInstruction('')
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pages.findIndex((p) => p.id === active.id)
    const newIndex = pages.findIndex((p) => p.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(pages.map((p) => p.id), oldIndex, newIndex)
    reorderPages(newOrder)
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Page List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Pages ({pages.length})</h3>
            <Button size="sm" variant="outline" onClick={addPage}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={handleGenerateAll}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate All Pages
          </Button>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {pages.map((page) => (
                  <SortablePageItem
                    key={page.id}
                    page={page}
                    isSelected={selectedPage?.id === page.id}
                    onSelect={() => setSelectedPageId(page.id)}
                    onRemove={() => setDeleteTarget(page.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {pages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No pages yet. Click + or Generate All.
              </p>
            )}
          </div>
        </div>

        {/* Right: Page Editor */}
        <div className="lg:col-span-3">
          {selectedPage ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Page {selectedPage.pageNumber}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={selectedPage.text}
                  onChange={(e) => updatePage(selectedPage.id, { text: e.target.value })}
                  placeholder="Write this page's story text..."
                  rows={8}
                  className="text-base"
                />

                {/* AI Refine Toolbar */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-secondary" />
                    <span className="text-sm font-medium">AI Refine</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REFINE_ACTIONS.map((action) => (
                      <Button
                        key={action.label}
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefine(action.instruction)}
                        disabled={refining !== null || !selectedPage.text.trim()}
                      >
                        {refining === action.instruction ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : null}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      value={customInstruction}
                      onChange={(e) => setCustomInstruction(e.target.value)}
                      placeholder="Custom instruction: e.g., 'Make it spooky' or 'Add dialogue'"
                      rows={2}
                    />
                    <Button
                      variant="secondary"
                      onClick={handleCustomRefine}
                      disabled={refining !== null || !customInstruction.trim() || !selectedPage.text.trim()}
                      className="shrink-0"
                    >
                      {refining === customInstruction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Select a page or generate pages to start editing
            </div>
          )}
        </div>
      </div>

      <StepNavButton />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete Page"
        description="Are you sure you want to delete this page? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            removePage(deleteTarget)
            if (selectedPageId === deleteTarget) setSelectedPageId(null)
          }
        }}
      />
    </div>
  )
}
