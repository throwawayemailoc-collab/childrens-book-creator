import { useState } from 'react'
import { BookOpen, Settings, Plus, Trash2, ChevronDown, Save, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { useProjectStore, useActiveProject } from '@/stores/projectStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { exportProject, importProject } from '@/services/saveLoad'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from '@/stores/toastStore'

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { apiKey, textModel, imageModel, imageSize, imageQuality, updateSettings } = useSettingsStore()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Settings</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>OpenAI API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => updateSettings({ apiKey: e.target.value })}
              placeholder="sk-..."
            />
            <p className="text-xs text-muted-foreground">Your key is stored locally and never sent to any server except OpenAI.</p>
          </div>
          <div className="space-y-2">
            <Label>Text Model</Label>
            <Select value={textModel} onChange={(e) => updateSettings({ textModel: e.target.value })}>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4.1">GPT-4.1</option>
              <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Image Model</Label>
            <Select value={imageModel} onChange={(e) => updateSettings({ imageModel: e.target.value })}>
              <option value="gpt-image-1">GPT Image 1</option>
              <option value="dall-e-3">DALL-E 3 (Legacy)</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Image Size</Label>
              <Select value={imageSize} onChange={(e) => updateSettings({ imageSize: e.target.value as typeof imageSize })}>
                <option value="1024x1024">Square (1024x1024)</option>
                <option value="1536x1024">Landscape (1536x1024)</option>
                <option value="1024x1536">Portrait (1024x1536)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Image Quality</Label>
              <Select value={imageQuality} onChange={(e) => updateSettings({ imageQuality: e.target.value as typeof imageQuality })}>
                <option value="low">Low (Fast)</option>
                <option value="medium">Medium</option>
                <option value="high">High (Slow)</option>
              </Select>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState('')
  const createProject = useProjectStore((s) => s.createProject)

  const handleCreate = () => {
    if (name.trim()) {
      createProject(name.trim())
      setName('')
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>New Project</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <div className="space-y-2">
          <Label>Project Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Amazing Story"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
        </div>
      </DialogContent>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
      </DialogFooter>
    </Dialog>
  )
}

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const projects = useProjectStore((s) => s.projects)
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const switchProject = useProjectStore((s) => s.switchProject)
  const deleteProject = useProjectStore((s) => s.deleteProject)
  const importProjectAction = useProjectStore((s) => s.importProject)
  const activeProject = useActiveProject()

  const projectList = Object.values(projects)

  const handleSave = async () => {
    if (!activeProject) return
    try {
      await exportProject(activeProject)
      toast('Project saved', 'success')
    } catch (err) {
      console.error('Export failed:', err)
      toast('Failed to save project', 'error')
    }
  }

  const handleLoad = async () => {
    setImporting(true)
    setImportError('')
    try {
      const project = await importProject()
      importProjectAction(project)
      toast('Project loaded', 'success')
    } catch (err) {
      // User cancelled the picker — not an error
      if (err instanceof DOMException && err.name === 'AbortError') return
      setImportError(err instanceof Error ? err.message : 'Failed to import project')
    } finally {
      setImporting(false)
    }
  }

  return (
    <header className="border-b bg-card px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-bold text-foreground">Storybook Creator</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Save / Load */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={!activeProject}
          title="Save project to file"
        >
          <Save className="h-4 w-4" />
          <span className="hidden sm:inline">Save</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLoad}
          disabled={importing}
          title="Load project from file"
        >
          <FolderOpen className="h-4 w-4" />
          <span className="hidden sm:inline">{importing ? 'Loading...' : 'Load'}</span>
        </Button>

        {importError && (
          <span className="text-xs text-destructive max-w-[200px] truncate" title={importError}>
            {importError}
          </span>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Project Switcher */}
        <div className="relative">
          <Button
            variant="outline"
            className="min-w-[200px] justify-between"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span className="truncate">{activeProject?.name || 'No Project'}</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </Button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-md border bg-popover shadow-lg">
                <div className="p-1">
                  {projectList.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-accent ${p.id === activeProjectId ? 'bg-accent' : ''}`}
                    >
                      <span className="truncate flex-1" onClick={() => { switchProject(p.id); setDropdownOpen(false) }}>
                        {p.name}
                      </span>
                      <button
                        className="ml-2 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.id); setDropdownOpen(false) }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {projectList.length === 0 && (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">No projects yet</p>
                  )}
                </div>
                <div className="border-t p-1">
                  <button
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                    onClick={() => { setNewProjectOpen(true); setDropdownOpen(false) }}
                  >
                    <Plus className="h-4 w-4" /> New Project
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete Project"
        description="Are you sure you want to delete this project? All pages, images, and settings will be permanently lost."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) deleteProject(deleteTarget) }}
      />
    </header>
  )
}
