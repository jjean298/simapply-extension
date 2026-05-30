import * as pdfjs from "pdfjs-dist"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString()

function normalizeLine(line: string) {
  return line.replace(/\s+/g, " ").trim()
}

function getFontStyle(fontName: string) {
  const lower = fontName.toLowerCase()

  return {
    isBold: lower.includes("bold"),
    isItalic: lower.includes("italic") || lower.includes("oblique")
  }
}

export async function extractResumeTextFromPdf(file: File) {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise

  let fullText = ""

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    const items = textContent.items as Array<{
      str: string
      width: number
      fontName?: string
      transform: number[]
    }>

    const iconWords = [
      "envelope",
      "linkedin",
      "github",
      "phone",
      "mail",
      "link",
      "at"
    ]

    const lineMap = new Map<number, typeof items>()

    items.forEach((item) => {
      const str = normalizeLine(item.str)

      if (!str) return

      if (iconWords.includes(str.toLowerCase()) && str.length < 15) {
        return
      }

      const y = Math.round(item.transform[5])

      if (!lineMap.has(y)) {
        lineMap.set(y, [])
      }

      lineMap.get(y)!.push(item)
    })

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
    const pageWidth = page.getViewport({ scale: 1 }).width
    let lastY = sortedYs[0] ?? 0
    const pageLines: string[] = []

    sortedYs.forEach((y) => {
      const lineItems = lineMap.get(y)
      if (!lineItems?.length) return

      lineItems.sort((a, b) => a.transform[4] - b.transform[4])

      const firstItemX = lineItems[0].transform[4]
      const isCentered =
        firstItemX > pageWidth * 0.25 && firstItemX < pageWidth * 0.75

      const segments: Array<{
        text: string
        isBold: boolean
        isItalic: boolean
        isLargeGap: boolean
      }> = []

      lineItems.forEach((item, index) => {
        const { isBold, isItalic } = getFontStyle(item.fontName || "")
        const prevItem = index > 0 ? lineItems[index - 1] : null
        const gap = prevItem
          ? item.transform[4] - (prevItem.transform[4] + prevItem.width)
          : 0
        const isLargeGap = gap > 20
        const lastSegment = segments[segments.length - 1]

        if (
          lastSegment &&
          lastSegment.isBold === isBold &&
          lastSegment.isItalic === isItalic &&
          !isLargeGap &&
          !lastSegment.isLargeGap
        ) {
          lastSegment.text += ` ${item.str}`
        } else {
          segments.push({
            text: item.str,
            isBold,
            isItalic,
            isLargeGap
          })
        }
      })

      let lineText = ""

      segments.forEach((segment, index) => {
        let text = normalizeLine(segment.text)
        if (!text) return

        if (segment.isBold && segment.isItalic) {
          text = `***${text}***`
        } else if (segment.isBold) {
          text = `**${text}**`
        } else if (segment.isItalic) {
          text = `*${text}*`
        }

        if (index === 0) {
          lineText = text
        } else {
          lineText += `${segment.isLargeGap ? "\t" : " "}${text}`
        }
      })

      let cleanedLine = normalizeLine(lineText)

      iconWords.forEach((iconWord) => {
        const regex = new RegExp(`\\b${iconWord}\\b`, "gi")
        cleanedLine = normalizeLine(cleanedLine.replace(regex, " "))
      })

      const yGap = Math.abs(lastY - y)
      if (yGap > 15 && pageLines.length > 0) {
        pageLines.push("")
      }

      if (cleanedLine) {
        pageLines.push(
          isCentered ? `[CENTER]${cleanedLine}` : cleanedLine
        )
      }

      lastY = y
    })

    fullText += `${pageLines.join("\n")}\n\n---PAGE BREAK---\n\n`
  }

  return fullText.trim()
}
