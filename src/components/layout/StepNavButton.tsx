import { useProjectStore } from '@/stores/projectStore'
import { Button } from '@/components/ui/button'
import { STEP_LABELS } from '@/lib/constants'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export function StepNavButton() {
  const activeStep = useProjectStore((s) => s.activeStep)
  const setActiveStep = useProjectStore((s) => s.setActiveStep)

  const isFirst = activeStep === 0
  const isLast = activeStep >= STEP_LABELS.length - 1

  return (
    <div className="flex justify-between pt-6 mt-6 border-t">
      {!isFirst ? (
        <Button
          variant="outline"
          size="lg"
          onClick={() => setActiveStep(activeStep - 1)}
          className="gap-2"
        >
          <ArrowLeft className="h-5 w-5" />
          Back: {STEP_LABELS[activeStep - 1]}
        </Button>
      ) : (
        <div />
      )}

      {!isLast && (
        <Button
          size="lg"
          onClick={() => setActiveStep(activeStep + 1)}
          className="gap-2"
        >
          Next: {STEP_LABELS[activeStep + 1]}
          <ArrowRight className="h-5 w-5" />
        </Button>
      )}
    </div>
  )
}
