// Rasterises / repackages a composed SVG into the formats a designer wants.
import { Resvg } from '@resvg/resvg-js'
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'

export const FORMATS = ['png', 'svg', 'pdf']

export const MAX_PIXELS = 8000

/** PNG, transparent unless the composition painted a background. */
export function toPNG(svg, { width }) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: Math.round(width) },
    background: 'rgba(0,0,0,0)',
    // The artwork is outlines — there is not a single <text> node in it. Left to
    // its own devices resvg builds a system font database on every instance,
    // which costs ~1.8 s and cannot affect a single pixel here. Output is
    // byte-identical with this off, and renders land in ~30 ms.
    font: { loadSystemFonts: false },
  })
  return Buffer.from(resvg.render().asPng())
}

/** PDF with the artwork still as vectors, for print and for Illustrator. */
export function toPDF(svg, { width, height }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [width, height], margin: 0 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    try {
      SVGtoPDF(doc, svg, 0, 0, { width, height, assumePt: true })
      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
