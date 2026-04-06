import type { Project } from '@/types'
import { getImageFromDB, putImageToDB } from '@/stores/imageStore'
import { useImageStore } from '@/stores/imageStore'

/**
 * Saved project file format — project data + all images bundled together.
 */
interface SavedProject {
  version: 1
  project: Project
  images: Record<string, string> // pageId/coverKey → base64 data URL
}

/**
 * We keep a reference to the last directory handle so that "Load" opens
 * in the same folder where the user last saved (or vice-versa).
 */
let lastDirectoryHandle: FileSystemDirectoryHandle | undefined

/**
 * Export the active project as a downloadable .storybook.json file
 * that contains all project data + images from IndexedDB.
 *
 * Uses the File System Access API (showSaveFilePicker) when available
 * so the user picks the save location and we remember it for Load.
 */
export async function exportProject(project: Project): Promise<void> {
  // Gather all image keys for this project
  const imageKeys: string[] = []
  for (const page of project.pages) {
    if (page.hasImage) imageKeys.push(page.id)
  }
  if (project.hasCoverImage) {
    imageKeys.push(`cover_${project.id}`)
  }

  // Load all images from IndexedDB
  const images: Record<string, string> = {}
  for (const key of imageKeys) {
    const data = await getImageFromDB(key)
    if (data) images[key] = data
  }

  const saved: SavedProject = {
    version: 1,
    project,
    images,
  }

  const json = JSON.stringify(saved)
  const suggestedName = `${project.storyPlan.title || project.name || 'storybook-project'}.storybook.json`

  // Try the modern File System Access API first
  if ('showSaveFilePicker' in window) {
    try {
      const opts: SaveFilePickerOptions = {
        suggestedName,
        types: [
          {
            description: 'Storybook Project',
            accept: { 'application/json': ['.json'] },
          },
        ],
      }
      // If we have a remembered directory, start there
      if (lastDirectoryHandle) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (opts as any).startIn = lastDirectoryHandle
      }
      const handle = await window.showSaveFilePicker(opts)
      // Remember the directory for next time (Load will use it)
      lastDirectoryHandle = await handle.getParent?.() ?? lastDirectoryHandle
      const writable = await handle.createWritable()
      await writable.write(json)
      await writable.close()
      return
    } catch (err: unknown) {
      // User cancelled the picker — just bail out
      if (err instanceof DOMException && err.name === 'AbortError') return
      // If the API is unavailable or fails, fall through to legacy approach
      console.warn('showSaveFilePicker failed, falling back:', err)
    }
  }

  // Fallback: classic <a> download
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Import a project from a .json file.
 *
 * Uses the File System Access API (showOpenFilePicker) when available
 * so it opens in the same directory where the user last saved.
 * Returns the project data; images are saved directly to IndexedDB.
 */
export async function importProject(fileOrNull?: File): Promise<Project> {
  let file: File

  if (fileOrNull) {
    // Called with a File already (legacy <input> path)
    file = fileOrNull
  } else if ('showOpenFilePicker' in window) {
    // Modern File System Access API
    const opts: OpenFilePickerOptions = {
      multiple: false,
      types: [
        {
          description: 'Storybook Project',
          accept: { 'application/json': ['.json'] },
        },
      ],
    }
    if (lastDirectoryHandle) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (opts as any).startIn = lastDirectoryHandle
    }
    const [handle] = await window.showOpenFilePicker(opts)
    lastDirectoryHandle = await handle.getParent?.() ?? lastDirectoryHandle
    file = await handle.getFile()
  } else {
    throw new Error('No file provided and File System Access API not available')
  }

  const text = await file.text()
  const saved: SavedProject = JSON.parse(text)

  if (!saved.project || !saved.version) {
    throw new Error('Invalid project file format')
  }

  const project = saved.project

  // Ensure all pages have the hasImage flag set correctly
  for (const page of project.pages) {
    if (page.hasImage === undefined) {
      page.hasImage = false
    }
    // Clear any inline base64 (shouldn't be there, but just in case)
    page.imageBase64 = null
  }
  if (project.hasCoverImage === undefined) {
    project.hasCoverImage = false
  }

  // Save all images to IndexedDB and update in-memory cache
  const imgStore = useImageStore.getState()
  if (saved.images) {
    for (const [key, data] of Object.entries(saved.images)) {
      await putImageToDB(key, data)
      // Also update in-memory cache so they show immediately
      imgStore.images[key] = data
    }
    // Trigger a re-render by setting the images state
    useImageStore.setState({ images: { ...imgStore.images } })
  }

  // Update hasImage flags based on what we actually imported
  for (const page of project.pages) {
    if (saved.images?.[page.id]) {
      page.hasImage = true
    }
  }
  if (saved.images?.[`cover_${project.id}`]) {
    project.hasCoverImage = true
  }

  return project
}
