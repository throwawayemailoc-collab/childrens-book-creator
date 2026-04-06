import { jsPDF } from 'jspdf'
import type { Project, PDFExportOptions } from '@/types'

function getPageFormat(options: PDFExportOptions): [number, number] {
  const formats: Record<string, [number, number]> = {
    letter: [11, 8.5],     // landscape
    a4: [11.69, 8.27],     // landscape
    square: [8.5, 8.5],
  }
  const [w, h] = formats[options.pageSize] || formats.letter
  return options.orientation === 'portrait' ? [h, w] : [w, h]
}

/**
 * Get image dimensions from a base64 data URL.
 * Returns { width, height } in pixels.
 */
function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}

/**
 * Fill the entire page with the image (cover-style), cropping if needed
 * to avoid any white gaps. Returns { x, y, w, h }.
 */
function coverImageOnPage(
  imgW: number, imgH: number,
  pageW: number, pageH: number
): { x: number; y: number; w: number; h: number } {
  const imgRatio = imgW / imgH
  const pageRatio = pageW / pageH

  let w: number, h: number
  if (imgRatio > pageRatio) {
    // Image is wider → match height, crop sides
    h = pageH
    w = pageH * imgRatio
  } else {
    // Image is taller → match width, crop top/bottom
    w = pageW
    h = pageW / imgRatio
  }

  // Center the overflow
  const x = (pageW - w) / 2
  const y = (pageH - h) / 2
  return { x, y, w, h }
}

/**
 * Draw multi-line text with a semi-transparent background band.
 * Text is placed at the bottom of the page, centred, with a dark
 * translucent strip behind it for readability over the image.
 */
function drawTextBand(
  doc: jsPDF,
  text: string,
  pageW: number,
  pageH: number,
  fontSize: number
) {
  if (!text.trim()) return

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(fontSize)

  const textPadding = 0.35   // inches – padding inside the band
  const maxTextWidth = pageW * 0.85
  const lines: string[] = doc.splitTextToSize(text, maxTextWidth)
  const lineHeight = fontSize / 72 * 1.35  // convert pt → inches with leading
  const blockHeight = lines.length * lineHeight

  // Band sits at the bottom with padding
  const bandHeight = blockHeight + textPadding * 2
  const bandY = pageH - bandHeight

  // Semi-transparent dark background
  doc.setGState(new (doc as any).GState({ opacity: 0.55 }))
  doc.setFillColor(0, 0, 0)
  doc.rect(0, bandY, pageW, bandHeight, 'F')

  // Reset opacity for text
  doc.setGState(new (doc as any).GState({ opacity: 1 }))
  doc.setTextColor(255, 255, 255)

  const textY = bandY + textPadding + lineHeight * 0.75 // baseline offset
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], pageW / 2, textY + i * lineHeight, { align: 'center' })
  }

  // Reset text colour for subsequent elements
  doc.setTextColor(0, 0, 0)
}

export async function generateBookPDF(
  project: Project,
  options: PDFExportOptions,
  imageMap: Record<string, string> = {}
): Promise<Blob> {
  const [width, height] = getPageFormat(options)
  const doc = new jsPDF({
    orientation: options.orientation,
    unit: 'in',
    format: [width, height],
  })

  // Cover page
  if (options.includeTitle) {
    const coverImage = imageMap['__cover__']

    if (coverImage) {
      // Full-bleed cover image
      try {
        const dims = await getImageDimensions(coverImage)
        const fitted = coverImageOnPage(dims.width, dims.height, width, height)
        doc.addImage(coverImage, 'PNG', fitted.x, fitted.y, fitted.w, fitted.h, undefined, 'FAST')
      } catch {
        // Skip cover image if it fails
      }
    }

    // Title band at the bottom of the cover
    const titleFontSize = 36
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(titleFontSize)

    const titleText = project.storyPlan.title || 'Untitled'
    const moralText = project.storyPlan.moral || ''
    const fullCoverText = moralText ? `${titleText}\n${moralText}` : titleText

    if (coverImage) {
      // Overlay title on image
      drawTextBand(doc, fullCoverText, width, height, titleFontSize)
    } else {
      // No image – centred title on white
      const titleLines = doc.splitTextToSize(titleText, width * 0.8)
      doc.text(titleLines, width / 2, height * 0.4, { align: 'center' })

      if (moralText) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(14)
        doc.text(moralText, width / 2, height * 0.6, { align: 'center' })
      }
    }
  }

  // Story pages
  for (const page of project.pages) {
    doc.addPage([width, height])

    const imageData = imageMap[page.id]
    let imageRendered = false

    if (imageData) {
      try {
        const dims = await getImageDimensions(imageData)
        const fitted = coverImageOnPage(dims.width, dims.height, width, height)
        doc.addImage(imageData, 'PNG', fitted.x, fitted.y, fitted.w, fitted.h, undefined, 'FAST')
        imageRendered = true
      } catch {
        // Skip image if it fails
      }
    }

    // Text overlay at the bottom
    if (page.text && imageRendered) {
      drawTextBand(doc, page.text, width, height, options.fontSize)
    } else if (page.text) {
      // No image – just centred text on white
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(options.fontSize)
      const splitText = doc.splitTextToSize(page.text, width * 0.85)
      doc.text(splitText, width / 2, height * 0.4, { align: 'center' })
    }

    // Page number (top-right corner, small, white if over image)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    if (imageRendered) {
      doc.setTextColor(255, 255, 255)
      // Small semi-transparent circle behind page number
      doc.setGState(new (doc as any).GState({ opacity: 0.4 }))
      doc.setFillColor(0, 0, 0)
      doc.circle(width - 0.4, 0.4, 0.18, 'F')
      doc.setGState(new (doc as any).GState({ opacity: 1 }))
    }
    doc.text(`${page.pageNumber}`, width - 0.4, 0.45, { align: 'center' })
    doc.setTextColor(0, 0, 0)
  }

  return doc.output('blob')
}
