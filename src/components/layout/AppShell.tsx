import { Header } from './Header'
import { StepNav } from './StepNav'
import { Toaster } from '@/components/ui/toast'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { StoryPlanningPage } from '@/components/story-planning/StoryPlanningPage'
import { PageTextPage } from '@/components/page-text/PageTextPage'
import { ArtStylePage } from '@/components/art-style/ArtStylePage'
import { PageArtworkPage } from '@/components/page-artwork/PageArtworkPage'
import { PDFExportPage } from '@/components/pdf-export/PDFExportPage'
import { BookOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Input } from '@/components/ui/input'

function WelcomeScreen() {
  const [name, setName] = useState('')
  const createProject = useProjectStore((s) => s.createProject)

  const handleCreate = () => {
    if (name.trim()) {
      createProject(name.trim())
      setName('')
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-6 max-w-md">
        <BookOpen className="h-16 w-16 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">Welcome to Storybook Creator</h2>
        <p className="text-muted-foreground">Create beautiful children's books with the help of AI. Start by creating a new project.</p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Amazing Story"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Create
          </Button>
        </div>
      </div>
    </div>
  )
}

const PAGES = [StoryPlanningPage, PageTextPage, ArtStylePage, PageArtworkPage, PDFExportPage]

export function AppShell() {
  const activeStep = useProjectStore((s) => s.activeStep)
  const project = useActiveProject()
  const ActivePage = PAGES[activeStep]

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <StepNav />
      {project ? (
        <main className="flex-1 overflow-auto">
          <ActivePage />
        </main>
      ) : (
        <WelcomeScreen />
      )}
      <Toaster />
    </div>
  )
}
