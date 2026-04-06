import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { Project, StoryPlan, BookPage, ArtStyle, Character } from '@/types'
import { useImageStore } from './imageStore'

function createDefaultStoryPlan(): StoryPlan {
  return {
    title: '',
    targetAgeRange: '3-5',
    themes: [],
    characters: [],
    synopsis: '',
    moral: '',
  }
}

function createDefaultArtStyle(): ArtStyle {
  return {
    presetStyle: null,
    customStyleDescription: '',
    colorPalette: [],
    characterVisuals: {},
    compositePrompt: '',
  }
}

function createNewProject(name: string): Project {
  const now = new Date().toISOString()
  return {
    id: uuidv4(),
    name,
    createdAt: now,
    updatedAt: now,
    storyPlan: createDefaultStoryPlan(),
    pages: [],
    artStyle: createDefaultArtStyle(),
    hasCoverImage: false,
  }
}

interface ProjectState {
  projects: Record<string, Project>;
  activeProjectId: string | null;
  activeStep: number;

  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  switchProject: (id: string) => void;
  setActiveStep: (step: number) => void;

  updateStoryPlan: (updates: Partial<StoryPlan>) => void;
  addCharacter: () => void;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;
  removeCharacter: (characterId: string) => void;

  addPage: () => void;
  removePage: (pageId: string) => void;
  updatePage: (pageId: string, updates: Partial<BookPage>) => void;
  setPages: (pages: BookPage[]) => void;
  reorderPages: (pageIds: string[]) => void;

  updateArtStyle: (updates: Partial<ArtStyle>) => void;
  setCoverImage: (imageBase64: string | null) => void;
  importProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: {},
      activeProjectId: null,
      activeStep: 0,

      createProject: (name: string) => {
        const project = createNewProject(name)
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          activeProjectId: project.id,
          activeStep: 0,
        }))
        return project.id
      },

      deleteProject: (id: string) => {
        const project = get().projects[id]
        // Clean up images from IndexedDB
        if (project?.pages) {
          const imgStore = useImageStore.getState()
          project.pages.forEach((p) => imgStore.removeImage(p.id))
        }
        set((state) => {
          const { [id]: _, ...rest } = state.projects
          const remainingIds = Object.keys(rest)
          return {
            projects: rest,
            activeProjectId: state.activeProjectId === id
              ? (remainingIds[0] ?? null)
              : state.activeProjectId,
          }
        })
      },

      switchProject: (id: string) => {
        set({ activeProjectId: id, activeStep: 0 })
      },

      setActiveStep: (step: number) => {
        set({ activeStep: step })
      },

      updateStoryPlan: (updates: Partial<StoryPlan>) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              storyPlan: { ...project.storyPlan, ...updates },
            },
          },
        })
      },

      addCharacter: () => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        const newChar: Character = {
          id: uuidv4(),
          name: '',
          description: '',
          role: 'supporting',
          visualDescription: '',
        }
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              storyPlan: {
                ...project.storyPlan,
                characters: [...project.storyPlan.characters, newChar],
              },
            },
          },
        })
      },

      updateCharacter: (characterId: string, updates: Partial<Character>) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              storyPlan: {
                ...project.storyPlan,
                characters: project.storyPlan.characters.map((c) =>
                  c.id === characterId ? { ...c, ...updates } : c
                ),
              },
            },
          },
        })
      },

      removeCharacter: (characterId: string) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              storyPlan: {
                ...project.storyPlan,
                characters: project.storyPlan.characters.filter((c) => c.id !== characterId),
              },
            },
          },
        })
      },

      addPage: () => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        const newPage: BookPage = {
          id: uuidv4(),
          pageNumber: project.pages.length + 1,
          text: '',
          imagePrompt: '',
          imageBase64: null,
          hasImage: false,
        }
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              pages: [...project.pages, newPage],
            },
          },
        })
      },

      removePage: (pageId: string) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        const filtered = project.pages
          .filter((p) => p.id !== pageId)
          .map((p, i) => ({ ...p, pageNumber: i + 1 }))
        // Clean up image from IndexedDB
        useImageStore.getState().removeImage(pageId)
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              pages: filtered,
            },
          },
        })
      },

      updatePage: (pageId: string, updates: Partial<BookPage>) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return

        // Intercept imageBase64 — store in IndexedDB, not localStorage
        const { imageBase64, ...restUpdates } = updates
        const storeUpdates: Partial<BookPage> = { ...restUpdates }
        if (imageBase64 !== undefined) {
          if (imageBase64) {
            storeUpdates.hasImage = true
            // Save to IndexedDB asynchronously (fire and forget)
            useImageStore.getState().saveImage(pageId, imageBase64)
          } else {
            storeUpdates.hasImage = false
            useImageStore.getState().removeImage(pageId)
          }
          // Don't persist base64 in localStorage
          storeUpdates.imageBase64 = null
        }

        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              pages: project.pages.map((p) =>
                p.id === pageId ? { ...p, ...storeUpdates } : p
              ),
            },
          },
        })
      },

      setPages: (pages: BookPage[]) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              pages,
            },
          },
        })
      },

      reorderPages: (pageIds: string[]) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        const pageMap = new Map(project.pages.map((p) => [p.id, p]))
        const reordered = pageIds
          .map((id) => pageMap.get(id))
          .filter((p): p is BookPage => p !== undefined)
          .map((p, i) => ({ ...p, pageNumber: i + 1 }))
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              pages: reordered,
            },
          },
        })
      },

      updateArtStyle: (updates: Partial<ArtStyle>) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              artStyle: { ...project.artStyle, ...updates },
            },
          },
        })
      },

      importProject: (project: Project) => {
        set((state) => ({
          projects: { ...state.projects, [project.id]: project },
          activeProjectId: project.id,
          activeStep: 0,
        }))
      },

      setCoverImage: (imageBase64: string | null) => {
        const { activeProjectId, projects } = get()
        if (!activeProjectId) return
        const project = projects[activeProjectId]
        if (!project) return
        const coverKey = `cover_${activeProjectId}`
        if (imageBase64) {
          useImageStore.getState().saveImage(coverKey, imageBase64)
        } else {
          useImageStore.getState().removeImage(coverKey)
        }
        set({
          projects: {
            ...projects,
            [activeProjectId]: {
              ...project,
              updatedAt: new Date().toISOString(),
              hasCoverImage: !!imageBase64,
            },
          },
        })
      },
    }),
    {
      name: 'storybook-projects',
      version: 2,
      migrate: (persisted: unknown) => {
        const state = persisted as ProjectState
        for (const project of Object.values(state.projects)) {
          // Add hasImage field to existing pages that don't have it
          for (const page of project.pages) {
            if (page.hasImage === undefined) {
              (page as BookPage).hasImage = !!page.imageBase64
              ;(page as BookPage).imageBase64 = null
            }
          }
          // Add hasCoverImage field to existing projects
          if ((project as Project).hasCoverImage === undefined) {
            (project as Project).hasCoverImage = false
          }
        }
        return state
      },
    }
  )
)

// Selector helpers
export const useActiveProject = () =>
  useProjectStore((s) => (s.activeProjectId ? s.projects[s.activeProjectId] : null))
