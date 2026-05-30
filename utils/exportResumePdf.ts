import {
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFPage,
  type PDFFont
} from "pdf-lib"
import {
  getAlignment,
  parseFormattedLine,
  type TextSegment
} from "./textFormatting"
import { DEFAULT_MARGINS, type DocumentMargins } from "./documentLayout"

export async function exportResumePdf(
  text: string,
  margins: DocumentMargins = DEFAULT_MARGINS
) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const serifFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const monoFont = await pdfDoc.embedFont(StandardFonts.Courier)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const boldItalicFont = await pdfDoc.embedFont(
    StandardFonts.HelveticaBoldOblique
  )
  const serifBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)
  const serifItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
  const serifBoldItalicFont = await pdfDoc.embedFont(
    StandardFonts.TimesRomanBoldItalic
  )
  const monoBoldFont = await pdfDoc.embedFont(StandardFonts.CourierBold)
  const monoItalicFont = await pdfDoc.embedFont(StandardFonts.CourierOblique)
  const monoBoldItalicFont = await pdfDoc.embedFont(
    StandardFonts.CourierBoldOblique
  )

  const pageWidth = 612
  const pageHeight = 792
  const { top, right, bottom, left } = margins
  const maxWidth = pageWidth - left - right

  const pages = text.split("---PAGE BREAK---").filter((page) => page.trim())

  const normalizeUrl = (url: string) => {
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(url)) return url
    if (url.startsWith("www.")) return `https://${url}`
    return `https://${url}`
  }

  const addLinkAnnotation = (
    page: PDFPage,
    x: number,
    y: number,
    width: number,
    height: number,
    url: string
  ) => {
    const context = pdfDoc.context
    const annotation = context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y - 2, x + width, y + height],
      Border: [0, 0, 0],
      A: {
        Type: "Action",
        S: "URI",
        URI: normalizeUrl(url)
      }
    })

    const annotationRef = context.register(annotation)
    page.node.addAnnot(annotationRef)
  }

  for (const pageContent of pages) {
    let page = pdfDoc.addPage([pageWidth, pageHeight])
    let yPosition = pageHeight - top
    const lines = pageContent.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim()

      if (!trimmedLine) {
        yPosition -= 4
        continue
      }

      const { alignment, cleanedLine, spacing } = getAlignment(trimmedLine)
      const customLineSpacing = spacing || 1.2
      const segments = parseFormattedLine(cleanedLine)
      const urlRegex =
        /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.(com|org|net|edu|io|co|dev|ai|us|uk|ca)[^\s,]*)/gi

      const isName = i === 0 && cleanedLine.length < 40 && !cleanedLine.includes("@")
      const isHeader =
        cleanedLine === cleanedLine.toUpperCase() &&
        cleanedLine.length < 50 &&
        cleanedLine.length > 3
      const isBullet = cleanedLine.startsWith("•") || cleanedLine.startsWith("-")
      const isJobTitle =
        !isBullet &&
        cleanedLine.length < 80 &&
        !cleanedLine.includes("@") &&
        /(Engineer|Developer|Manager|Analyst|Intern|Designer|Specialist)/.test(
          cleanedLine
        )

      let baseFontSize = 10.5
      let defaultBold = false

      if (isName) {
        defaultBold = true
        baseFontSize = 14
      } else if (isHeader) {
        defaultBold = true
        baseFontSize = 11
      } else if (isJobTitle) {
        defaultBold = true
      }

      if (isHeader && i > 0) {
        yPosition -= 5
      }

      if (yPosition < bottom + baseFontSize) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        yPosition = pageHeight - top
      }

      const getFont = (segment: TextSegment): PDFFont => {
        const isBold = segment.bold || defaultBold
        const isItalic = segment.italic
        const fontFamily = segment.fontFamily || "sans"

        if (fontFamily === "serif") {
          if (isBold && isItalic) return serifBoldItalicFont
          if (isBold) return serifBoldFont
          if (isItalic) return serifItalicFont
          return serifFont
        }

        if (fontFamily === "mono") {
          if (isBold && isItalic) return monoBoldItalicFont
          if (isBold) return monoBoldFont
          if (isItalic) return monoItalicFont
          return monoFont
        }

        if (isBold && isItalic) return boldItalicFont
        if (isBold) return boldFont
        if (isItalic) return italicFont
        return font
      }

      const getColor = (segment: TextSegment) => {
        switch (segment.color) {
          case "blue":
            return rgb(0.15, 0.35, 0.75)
          case "green":
            return rgb(0.1, 0.5, 0.2)
          case "red":
            return rgb(0.75, 0.2, 0.2)
          case "slate":
            return rgb(0.28, 0.33, 0.4)
          default:
            return rgb(0, 0, 0)
        }
      }

      const leftSegments = segments.filter(
        (segment) => !segment.align || segment.align === "left"
      )
      const centerSegments = segments.filter(
        (segment) => segment.align === "center"
      )
      const rightSegments = segments.filter(
        (segment) => segment.align === "right"
      )

      const renderSegments = (renderList: TextSegment[], startX: number) => {
        let currentX = startX
        const maxX = pageWidth - right
        const indentAmount = 30

        for (let segmentIndex = 0; segmentIndex < renderList.length; segmentIndex++) {
          const segment = renderList[segmentIndex]
          const segmentFont = getFont(segment)

          if (segment.indent && segmentIndex === 0) {
            currentX += indentAmount
          }

          const cleanText = segment.text
            .replace(/▸/g, ">")
            .replace(/★/g, "*")
            .replace(/✓/g, "v")
            .replace(/◆/g, "+")
            .replace(/■/g, "-")
            .replace(/●/g, "•")
            .replace(/⬤/g, "•")
            .replace(/∗/g, "*")

          const words = cleanText.split(" ")

          for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
            const word = words[wordIndex]
            const isUrl = !segment.link && urlRegex.test(word)
            urlRegex.lastIndex = 0

            const wordText = `${word}${wordIndex < words.length - 1 ? " " : ""}`
            const segmentFontSize = segment.fontSize || baseFontSize
            const wordWidth = segmentFont.widthOfTextAtSize(wordText, segmentFontSize)

            if (currentX + wordWidth > maxX) {
              yPosition -= segmentFontSize * customLineSpacing
              currentX = left

              if (yPosition < bottom + segmentFontSize) {
                page = pdfDoc.addPage([pageWidth, pageHeight])
                yPosition = pageHeight - top
              }
            }

            page.drawText(wordText, {
              x: currentX,
              y: yPosition,
              size: segmentFontSize,
              font: segmentFont,
              color: getColor(segment)
            })

            if (segment.underline || isUrl || segment.link) {
              page.drawLine({
                start: { x: currentX, y: yPosition - 1 },
                end: { x: currentX + wordWidth, y: yPosition - 1 },
                thickness: 0.5,
                color: getColor(segment)
              })
            }

            if (segment.link || isUrl) {
              const linkUrl = segment.link || word
              addLinkAnnotation(
                page,
                currentX,
                yPosition,
                wordWidth,
                segmentFontSize + 2,
                linkUrl
              )
            }

            currentX += wordWidth
          }

          if (segmentIndex < renderList.length - 1) {
            currentX += segmentFont.widthOfTextAtSize(
              " ",
              renderList[segmentIndex].fontSize || baseFontSize
            )
          }
        }
      }

      const getSegmentsWidth = (measureList: TextSegment[]) => {
        let totalWidth = 0

        for (let segmentIndex = 0; segmentIndex < measureList.length; segmentIndex++) {
          const segment = measureList[segmentIndex]
          const segmentFont = getFont(segment)
          const words = segment.text.split(" ")

          for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
            const word = words[wordIndex]
            const wordText = `${word}${wordIndex < words.length - 1 ? " " : ""}`
            totalWidth += segmentFont.widthOfTextAtSize(
              wordText,
              segment.fontSize || baseFontSize
            )
          }

          if (segmentIndex < measureList.length - 1) {
            totalWidth += segmentFont.widthOfTextAtSize(
              " ",
              segment.fontSize || baseFontSize
            )
          }
        }

        return totalWidth
      }

      if (centerSegments.length > 0 || rightSegments.length > 0) {
        if (leftSegments.length > 0) {
          renderSegments(leftSegments, left)
        }

        if (centerSegments.length > 0) {
          const centerWidth = getSegmentsWidth(centerSegments)
          renderSegments(
            centerSegments,
            Math.max(left, left + (maxWidth - centerWidth) / 2)
          )
        }

        if (rightSegments.length > 0) {
          const rightWidth = getSegmentsWidth(rightSegments)
          renderSegments(rightSegments, Math.max(left, pageWidth - right - rightWidth))
        }
      } else {
        const totalLineWidth = getSegmentsWidth(segments)
        let xPosition = left

        if (alignment === "center") {
          xPosition = Math.max(left, left + (maxWidth - totalLineWidth) / 2)
        } else if (alignment === "right") {
          xPosition = pageWidth - right - totalLineWidth
        }

        renderSegments(segments, xPosition)
      }

      yPosition -= baseFontSize * customLineSpacing
    }
  }

  const pdfBytes = await pdfDoc.save()
  const pdfArrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer

  const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = "tailored-resume.pdf"
  anchor.click()
  URL.revokeObjectURL(url)
}
