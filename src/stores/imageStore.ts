import { create } from 'zustand'

const DB_NAME = 'storybook-images'
const STORE_NAME = 'images'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function putImage(pageId: string, data: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(data, pageId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getImage(pageId: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(pageId)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

async function deleteImage(pageId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(pageId)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function getAllKeys(): Promise<string[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAllKeys()
    req.onsuccess = () => resolve(req.result as string[])
    req.onerror = () => reject(req.error)
  })
}

// Expose raw IndexedDB getters for the save/load service
export { getImage as getImageFromDB, putImage as putImageToDB }

// In-memory cache of loaded images, keyed by pageId
interface ImageStoreState {
  images: Record<string, string>
  loading: Record<string, boolean>
  saveImage: (pageId: string, data: string) => Promise<void>
  loadImage: (pageId: string) => Promise<void>
  loadImages: (pageIds: string[]) => Promise<void>
  removeImage: (pageId: string) => Promise<void>
  getImageData: (pageId: string) => string | null
}

export const useImageStore = create<ImageStoreState>()((set, get) => ({
  images: {},
  loading: {},

  saveImage: async (pageId: string, data: string) => {
    // Save to IndexedDB and update in-memory cache
    await putImage(pageId, data)
    set((s) => ({ images: { ...s.images, [pageId]: data } }))
  },

  loadImage: async (pageId: string) => {
    // Skip if already loaded or currently loading
    const state = get()
    if (state.images[pageId] || state.loading[pageId]) return
    set((s) => ({ loading: { ...s.loading, [pageId]: true } }))
    const data = await getImage(pageId)
    set((s) => ({
      images: data ? { ...s.images, [pageId]: data } : s.images,
      loading: { ...s.loading, [pageId]: false },
    }))
  },

  loadImages: async (pageIds: string[]) => {
    const state = get()
    const toLoad = pageIds.filter((id) => !state.images[id] && !state.loading[id])
    if (toLoad.length === 0) return
    set((s) => {
      const loading = { ...s.loading }
      toLoad.forEach((id) => { loading[id] = true })
      return { loading }
    })
    const results = await Promise.all(toLoad.map(async (id) => ({ id, data: await getImage(id) })))
    set((s) => {
      const images = { ...s.images }
      const loading = { ...s.loading }
      results.forEach(({ id, data }) => {
        if (data) images[id] = data
        loading[id] = false
      })
      return { images, loading }
    })
  },

  removeImage: async (pageId: string) => {
    await deleteImage(pageId)
    set((s) => {
      const { [pageId]: _, ...rest } = s.images
      return { images: rest }
    })
  },

  getImageData: (pageId: string) => {
    return get().images[pageId] ?? null
  },
}))

// Migrate existing base64 images from localStorage projects into IndexedDB
export async function migrateImagesToIndexedDB(): Promise<void> {
  const raw = localStorage.getItem('storybook-projects')
  if (!raw) return

  try {
    const parsed = JSON.parse(raw)
    const state = parsed.state ?? parsed
    const projects: Record<string, { pages?: Array<{ id: string; imageBase64?: string | null; hasImage?: boolean }> }> = state.projects ?? {}
    let changed = false

    for (const project of Object.values(projects)) {
      if (!project.pages) continue
      for (const page of project.pages) {
        if (page.imageBase64) {
          await putImage(page.id, page.imageBase64)
          page.hasImage = true
          page.imageBase64 = null
          changed = true
        }
      }
    }

    if (changed) {
      localStorage.setItem('storybook-projects', JSON.stringify(parsed))
    }
  } catch {
    // Migration failed silently — images will be regenerated
  }
}

// Clean up orphaned images (pages that no longer exist)
export async function cleanupOrphanedImages(validPageIds: Set<string>): Promise<void> {
  const keys = await getAllKeys()
  for (const key of keys) {
    if (!validPageIds.has(key)) {
      await deleteImage(key)
    }
  }
}
