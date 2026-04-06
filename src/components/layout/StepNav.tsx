import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { STEP_LABELS } from '@/lib/constants'
import { BookText, FileText, Palette, Image, Download, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEP_ICONS = [BookText, FileText, Palette, Image, Download]

function useStepCompletion(): boolean[] {
  const project = useActiveProject()
  if (!project) return [false, false, false, false, false]

  const { storyPlan, pages, artStyle } = project
  return [
    !!(storyPlan.title.trim() && storyPlan.synopsis.trim()),
    pages.length > 0 && pages.every((p) => p.text.trim()),
    !!artStyle.compositePrompt.trim(),
    pages.length > 0 && pages.every((p) => p.hasImage),
    false,
  ]
}

export function StepNav() {
  const activeStep = useProjectStore((s) => s.activeStep)
  const setActiveStep = useProjectStore((s) => s.setActiveStep)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const completed = useStepCompletion()

  if (!activeProjectId) return null

  return (
    <nav className="border-b bg-card">
      <div className="flex">
        {STEP_LABELS.map((label, i) => {
          const Icon = STEP_ICONS[i]
          const isActive = activeStep === i
          const isDone = completed[i]
          return (
            <button
              key={label}
              onClick={() => setActiveStep(i)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 cursor-pointer",
                isActive
                  ? "border-primary text-primary"
                  : isDone
                    ? "border-transparent text-green-600 hover:text-green-700 hover:border-green-300"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              {isDone && !isActive ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Icon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
