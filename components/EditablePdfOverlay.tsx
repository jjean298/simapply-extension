import { useEffect, useRef, useState } from "react"
import * as pdfjsLib from "pdfjs-dist"

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

interface EditableLine {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
}

interface EditablePdfOverlayProps {
  fileUrl: string
}

export function EditablePdfOverlay({ fileUrl }: EditablePdfOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [lines, setLines] = useState<EditableLine[]>([])
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const loadPdf = async () => {
      const pdf = await pdfjsLib.getDocument(fileUrl).promise
      const page = await pdf.getPage(1)

      const scale = 1.6
      const viewport = page.getViewport({ scale })

      setPageSize({
        width: viewport.width,
        height: viewport.height
      })

      const canvas = canvasRef.current
      if (!canvas) return

      const context = canvas.getContext("2d")
      if (!context) return

      canvas.width = viewport.width
      canvas.height = viewport.height

      await page.render({
        canvas,
        canvasContext: context,
        viewport
      }).promise

      const textContent = await page.getTextContent()

      const fragments = textContent.items
        .map((item: any, index) => {
          const transform = pdfjsLib.Util.transform(
            viewport.transform,
            item.transform
          )

          const x = transform[4]
          const y = transform[5]

          const fontSize = Math.max(Math.abs(transform[0]), 6)
          const width = Math.max(item.width * scale, 10)

          return {
            id: `${index}`,
            text: item.str,
            x,
            y,
            width,
            height: fontSize + 3,
            fontSize
          }
        })
        .filter((item) => item.text.trim().length > 0)

      const sorted = fragments.sort((a, b) => {
        if (Math.abs(a.y - b.y) < 4) {
          return a.x - b.x
        }

        return a.y - b.y
      })

      const groupedLines: EditableLine[] = []

      sorted.forEach((fragment) => {
        const line = groupedLines.find(
          (existing) => Math.abs(existing.y - fragment.y) < 4
        )

        if (!line) {
          groupedLines.push({
            id: fragment.id,
            text: fragment.text,
            x: fragment.x,
            y: fragment.y,
            width: fragment.width,
            height: fragment.height,
            fontSize: fragment.fontSize
          })
        } else {
          const gap = fragment.x - (line.x + line.width)

          line.text += gap > 2 ? ` ${fragment.text}` : fragment.text
          line.width = Math.max(line.width, fragment.x + fragment.width - line.x)
          line.height = Math.max(line.height, fragment.height)
          line.fontSize = Math.max(line.fontSize, fragment.fontSize)
        }
      })

      setLines(groupedLines)
    }

    loadPdf().catch((error) => {
      console.error("Editable PDF overlay failed:", error)
    })
  }, [fileUrl])

  const updateLine = (id: string, value: string) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, text: value } : line))
    )
  }

  return (
    <div className="flex h-full w-full items-start justify-center overflow-auto bg-gray-800 p-3">
      <div
        className="relative bg-white shadow-2xl"
        style={{
          width: pageSize.width,
          height: pageSize.height,
          transform: "scale(0.45)",
          transformOrigin: "top center"
        }}
      >
        <canvas ref={canvasRef} className="absolute left-0 top-0" />

        {lines.map((line) => (
          <input
            key={line.id}
            value={line.text}
            onChange={(e) => updateLine(line.id, e.target.value)}
            className="absolute border-none bg-white/80 p-0 text-black outline-none focus:bg-yellow-200"
            style={{
              left: line.x,
              top: line.y - line.height,
              width: Math.max(line.width + 10, 30),
              height: line.height,
              fontSize: line.fontSize,
              lineHeight: `${line.height}px`
            }}
          />
        ))}
      </div>
    </div>
  )
}