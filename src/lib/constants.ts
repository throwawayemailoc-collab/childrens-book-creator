import type { StylePreset, AgeRange, PDFExportOptions } from '@/types'

export const STYLE_PRESETS: Record<StylePreset, { name: string; description: string; prompt: string }> = {
  watercolor: {
    name: 'Watercolor',
    description: 'Soft, flowing watercolor painting',
    prompt: "Children's book illustration in soft watercolor style, gentle color blending, visible brush texture, paper-like background, warm and inviting",
  },
  cartoon: {
    name: 'Cartoon',
    description: 'Bright, bold cartoon style',
    prompt: "Children's book illustration in bright cartoon style, bold outlines, vibrant saturated colors, expressive characters, fun and playful",
  },
  'flat-illustration': {
    name: 'Flat Illustration',
    description: 'Modern flat design with clean shapes',
    prompt: "Children's book illustration in modern flat design style, clean geometric shapes, limited color palette, minimalist, contemporary",
  },
  'pencil-sketch': {
    name: 'Pencil Sketch',
    description: 'Hand-drawn pencil illustration',
    prompt: "Children's book illustration in pencil sketch style, detailed line work, crosshatching, gentle shading, charming hand-drawn quality",
  },
  'pixel-art': {
    name: 'Pixel Art',
    description: 'Retro pixel art style',
    prompt: "Children's book illustration in pixel art style, retro video game aesthetic, blocky characters, bright colors, nostalgic 8-bit feel",
  },
  collage: {
    name: 'Collage',
    description: 'Mixed media paper collage',
    prompt: "Children's book illustration in paper collage style, cut-out paper textures, layered elements, mixed media, tactile and crafty",
  },
  'storybook-classic': {
    name: 'Classic Storybook',
    description: 'Traditional storybook illustration',
    prompt: "Classic children's storybook illustration, rich detailed oil painting style, golden age illustration, warm lighting, enchanting and timeless",
  },
  anime: {
    name: 'Anime',
    description: 'Japanese anime/manga style',
    prompt: "Children's book illustration in anime style, large expressive eyes, soft pastel colors, gentle shading, kawaii aesthetic, charming",
  },
}

export const AGE_RANGE_LABELS: Record<AgeRange, string> = {
  '0-2': 'Baby/Toddler (0-2)',
  '3-5': 'Preschool (3-5)',
  '6-8': 'Early Reader (6-8)',
  '9-12': 'Middle Grade (9-12)',
}

export const AGE_RANGE_PAGE_COUNTS: Record<AgeRange, number> = {
  '0-2': 8,
  '3-5': 12,
  '6-8': 16,
  '9-12': 20,
}

export const REFINE_ACTIONS = [
  { label: 'Simplify', instruction: 'Make this text simpler and easier for young children to understand. Use shorter words and simpler sentences.' },
  { label: 'Add Rhyming', instruction: 'Rewrite this text with a rhyming pattern while keeping the same meaning.' },
  { label: 'More Engaging', instruction: 'Make this text more vivid and engaging with action words and sensory details.' },
  { label: 'Shorten', instruction: 'Make this text shorter while keeping the key meaning. Aim for 1-2 sentences.' },
] as const

export const DEFAULT_PDF_OPTIONS: PDFExportOptions = {
  pageSize: 'landscape' as unknown as 'letter',
  orientation: 'landscape',
  fontSize: 18,
  margins: 0.75,
  includeTitle: true,
}

export const STEP_LABELS = [
  'Story Planning',
  'Page Text',
  'Art Style',
  'Page Artwork',
  'Export PDF',
] as const
