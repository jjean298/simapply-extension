import { useEffect, useMemo, useState } from "react"
import * as pdfjs from "pdfjs-dist"
import { CheckCheck } from "lucide-react"
import type { ResumeReviewItem } from "../utils/aiSuggestions"
import { RewriteSuggestionControls } from "./RewriteSuggestionControls"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString()

interface PdfReviewOverlayProps {
  file: File
  reviewItems: ResumeReviewItem[]
  appliedSuggestionIds: string[]
  onApplySuggestion: (item: ResumeReviewItem) => void
  selectedOptionsById: Record<string, string[]>
  candidateTextById: Record<string, string | undefined>
  rewriteExplanationById: Record<string, string | undefined>
  rewriteErrorById: Record<string, string | null | undefined>
  rewritingById: Record<string, boolean | undefined>
  onToggleOption: (itemId: string, option: string) => void
  onRewrite: (item: ResumeReviewItem) => void
}

interface ReviewLine {
  id: string
  pageNumber: number
  text: string
  x: number
  y: number
  width: number
  height: number
  fragments: Array<{
    text: string
    x: number
    y: number
    width: number
    height: number
  }>
}

interface RenderedPage {
  pageNumber: number
  imageUrl: string
  width: number
  height: number
  lines: ReviewLine[]
}

interface LineReviewAssignment {
  lineId: string
  reviewItem: ResumeReviewItem
}

function normalizeLine(text: string) {
  return text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getWordTokens(text: string) {
  return normalizeLine(text)
    .toLowerCase()
    .split(" ")
    .map((token) => token.replace(/[^a-z0-9+-]/gi, ""))
    .filter((token) => token.length > 2)
}

function getTokenOverlapScore(a: string, b: string) {
  const aTokens = getWordTokens(a)
  const bTokens = getWordTokens(b)

  if (!aTokens.length || !bTokens.length) return 0

  const aSet = new Set(aTokens)
  const bSet = new Set(bTokens)
  let overlapCount = 0

  aSet.forEach((token) => {
    if (bSet.has(token)) {
      overlapCount += 1
    }
  })

  return overlapCount / Math.max(Math.min(aSet.size, bSet.size), 1)
}

function isLikelyLineMatch(lineText: string, reviewText: string) {
  const normalizedLine = normalizeLine(lineText).toLowerCase()
  const normalizedReview = normalizeLine(reviewText).toLowerCase()

  if (!normalizedLine || !normalizedReview) return false
  if (normalizedLine === normalizedReview) return true
  if (normalizedLine.includes(normalizedReview)) return true
  if (normalizedReview.includes(normalizedLine)) return true

  return getTokenOverlapScore(normalizedLine, normalizedReview) >= 0.6
}

function getLineMatchScore(lineText: string, reviewText: string) {
  const normalizedLine = normalizeLine(lineText).toLowerCase()
  const normalizedReview = normalizeLine(reviewText).toLowerCase()

  if (!normalizedLine || !normalizedReview) return 0
  if (normalizedLine === normalizedReview) return 1
  if (normalizedLine.includes(normalizedReview) || normalizedReview.includes(normalizedLine)) {
    return 0.92
  }

  return getTokenOverlapScore(normalizedLine, normalizedReview)
}

function getFontStyle(fontName: string) {
  const lower = fontName.toLowerCase()

  return {
    isBold: lower.includes("bold"),
    isItalic: lower.includes("italic") || lower.includes("oblique")
  }
}

export function PdfReviewOverlay({
  file,
  reviewItems,
  appliedSuggestionIds,
  onApplySuggestion,
  selectedOptionsById,
  candidateTextById,
  rewriteExplanationById,
  rewriteErrorById,
  rewritingById,
  onToggleOption,
  onRewrite
}: PdfReviewOverlayProps) {
  const [pages, setPages] = useState<RenderedPage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openReviewId, setOpenReviewId] = useState<string | null>(null)

  const reviewMap = useMemo(
    () =>
      new Map(
        reviewItems.map((item) => [
          normalizeLine(item.originalText).toLowerCase(),
          item
        ] as const)
      ),
    [reviewItems]
  )

  const matchedReviewIds = useMemo(() => {
    const lineAssignments: LineReviewAssignment[] = []
    const usedReviewIds = new Set<string>()

    pages.forEach((page) => {
      page.lines.forEach((line) => {
        const candidates = reviewItems
          .map((item) => ({
            item,
            score: getLineMatchScore(line.text, item.originalText)
          }))
          .filter(({ score, item }) => score >= 0.6 && !usedReviewIds.has(item.id))
          .sort((a, b) => b.score - a.score)

        const bestCandidate = candidates[0]

        if (bestCandidate) {
          usedReviewIds.add(bestCandidate.item.id)
          lineAssignments.push({
            lineId: line.id,
            reviewItem: bestCandidate.item
          })
        }
      })
    })

    const matchedIds = new Set<string>()
    lineAssignments.forEach(({ reviewItem }) => matchedIds.add(reviewItem.id))

    return matchedIds
  }, [pages, reviewItems, reviewMap])

  const lineReviewAssignments = useMemo(() => {
    const assignments = new Map<string, ResumeReviewItem>()
    const usedReviewIds = new Set<string>()

    pages.forEach((page) => {
      page.lines.forEach((line) => {
        const candidates = reviewItems
          .map((item) => ({
            item,
            score: getLineMatchScore(line.text, item.originalText)
          }))
          .filter(({ score, item }) => score >= 0.6 && !usedReviewIds.has(item.id))
          .sort((a, b) => b.score - a.score)

        const bestCandidate = candidates[0]

        if (bestCandidate) {
          usedReviewIds.add(bestCandidate.item.id)
          assignments.set(line.id, bestCandidate.item)
        }
      })
    })

    return assignments
  }, [pages, reviewItems])

  const unmatchedReviewItems = useMemo(
    () =>
      reviewItems.filter(
        (item) => item.type !== "good" && !matchedReviewIds.has(item.id)
      ),
    [matchedReviewIds, reviewItems]
  )

  useEffect(() => {
    let cancelled = false
    const objectUrls: string[] = []

    async function loadPdfReview() {
      try {
        setIsLoading(true)
        setError(null)

        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
        const nextPages: RenderedPage[] = []

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 1.25 })
          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d")

          if (!context) continue

          canvas.width = viewport.width
          canvas.height = viewport.height

          await page.render({
            canvas,
            canvasContext: context,
            viewport
          }).promise

          const imageUrl = canvas.toDataURL("image/png")
          objectUrls.push(imageUrl)

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
            if (iconWords.includes(str.toLowerCase()) && str.length < 15) return

            const y = Math.round(item.transform[5])

            if (!lineMap.has(y)) {
              lineMap.set(y, [])
            }

            lineMap.get(y)!.push(item)
          })

          const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a)
          const groupedLines: ReviewLine[] = []

          sortedYs.forEach((y, lineIndex) => {
            const lineItems = lineMap.get(y)
            if (!lineItems?.length) return

            lineItems.sort((a, b) => a.transform[4] - b.transform[4])

            let segments: Array<{
              text: string
              isBold: boolean
              isItalic: boolean
              isLargeGap: boolean
              x: number
              width: number
              fontHeight: number
            }> = []

            lineItems.forEach((item, index) => {
              const { isBold, isItalic } = getFontStyle(item.fontName || "")
              const prevItem = index > 0 ? lineItems[index - 1] : null
              const gap = prevItem
                ? item.transform[4] - (prevItem.transform[4] + prevItem.width)
                : 0
              const isLargeGap = gap > 20
              const lastSegment = segments[segments.length - 1]
              const fontHeight = Math.abs(item.transform[0]) * 1.25

              if (
                lastSegment &&
                lastSegment.isBold === isBold &&
                lastSegment.isItalic === isItalic &&
                !isLargeGap &&
                !lastSegment.isLargeGap
              ) {
                lastSegment.text += ` ${item.str}`
                lastSegment.width =
                  item.transform[4] + item.width - lastSegment.x
                lastSegment.fontHeight = Math.max(
                  lastSegment.fontHeight,
                  fontHeight
                )
              } else {
                segments.push({
                  text: item.str,
                  isBold,
                  isItalic,
                  isLargeGap,
                  x: item.transform[4],
                  width: item.width,
                  fontHeight
                })
              }
            })

            let lineText = ""
            let lineX = Number.MAX_SAFE_INTEGER
            let lineWidth = 0
            let lineHeight = 16
            const fragments: ReviewLine["fragments"] = []

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

              lineX = Math.min(lineX, segment.x)
              lineWidth = Math.max(lineWidth, segment.x + segment.width - lineX)
              lineHeight = Math.max(lineHeight, segment.fontHeight + 8)
              const fragmentPoint = viewport.convertToViewportPoint(
                segment.x,
                y
              )
              fragments.push({
                text,
                x: fragmentPoint[0],
                y: fragmentPoint[1] - (segment.fontHeight + 8) + 4,
                width: Math.max(segment.width * 1.25, 24),
                height: Math.max(segment.fontHeight + 8, 16)
              })
            })

            let cleanedLine = normalizeLine(lineText)
            iconWords.forEach((iconWord) => {
              const regex = new RegExp(`\\b${iconWord}\\b`, "gi")
              cleanedLine = normalizeLine(cleanedLine.replace(regex, " "))
            })

            if (!cleanedLine) return

            const viewportPoint = viewport.convertToViewportPoint(lineX, y)

            groupedLines.push({
              id: `page-${pageNumber}-line-${lineIndex}`,
              pageNumber,
              text: cleanedLine,
              x: viewportPoint[0],
              y: viewportPoint[1] - lineHeight + 4,
              width: Math.max(lineWidth * 1.25, 40),
              height: lineHeight,
              fragments
            })
          })

          nextPages.push({
            pageNumber,
            imageUrl,
            width: viewport.width,
            height: viewport.height,
            lines: groupedLines
          })
        }

        if (!cancelled) {
          setPages(nextPages)
        }
      } catch (loadError) {
        console.error("Failed to render PDF review overlay", loadError)
        if (!cancelled) {
          setError("We couldn't render review overlays on this PDF.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadPdfReview()

    return () => {
      cancelled = true
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [file])

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--accent-soft)] border-t-[color:var(--accent-strong)]" />
          <p className="text-sm text-slate-500">Loading original PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-600">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col items-center gap-5">
        {pages.map((page) => (
          <div
            key={page.pageNumber}
            className="relative overflow-visible rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
            style={{ width: page.width }}
          >
            <img
              src={page.imageUrl}
              alt={`Resume page ${page.pageNumber}`}
              className="block h-auto w-full rounded-[22px]"
            />

            {page.lines.map((line) => {
              const reviewItem = lineReviewAssignments.get(line.id)
              if (!reviewItem) return null

              const isApplied = appliedSuggestionIds.includes(reviewItem.id)
              const isGood = reviewItem.type === "good"
              const isWarn = reviewItem.type === "warn"
              const highlightTarget = reviewItem.highlightText
                ? normalizeLine(reviewItem.highlightText)
                : null
              const targetFragment = highlightTarget
                ? line.fragments.find((fragment) =>
                    normalizeLine(fragment.text).includes(
                      highlightTarget.split(" ")[0]
                    )
                  )
                : null
              const highlightBox = targetFragment
                ? {
                    left: targetFragment.x - 4,
                    top: targetFragment.y - 2,
                    width: targetFragment.width + 8,
                    height: targetFragment.height + 4
                  }
                : {
                    left: line.x - 4,
                    top: line.y - 2,
                    width: line.width + 8,
                    height: line.height + 4
                  }

              return (
                <div
                  key={line.id}
                  className={`absolute cursor-pointer rounded-xl border transition ${
                    isGood
                      ? "border-emerald-300 bg-emerald-200/30 hover:bg-emerald-200/40"
                      : isWarn
                        ? "border-amber-300 bg-amber-200/30 hover:bg-amber-200/40"
                      : "border-rose-300 bg-rose-200/30 hover:bg-rose-200/40"
                  }`}
                  style={highlightBox}
                  onMouseEnter={() => setOpenReviewId(reviewItem.id)}
                  onMouseLeave={() =>
                    setOpenReviewId((currentId) =>
                      currentId === reviewItem.id ? null : currentId
                    )
                  }
                >
                  <div
                    className={`absolute left-1/2 top-full z-20 mt-3 w-80 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_16px_40px_rgba(15,23,42,0.16)] ${
                      openReviewId === reviewItem.id ? "block" : "hidden"
                    }`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {reviewItem.hoverTitle ||
                        (isGood
                          ? "Strong line"
                          : isWarn
                            ? "Could improve"
                            : "Needs work")}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {reviewItem.reason}
                    </p>
                    {reviewItem.replacementText && reviewItem.highlightText && (
                      <p className="mt-2 text-sm leading-6 text-rose-600">
                        Try replacing "{reviewItem.highlightText}" with "{reviewItem.replacementText}".
                      </p>
                    )}
                    {!isGood ? (
                      <RewriteSuggestionControls
                        reviewItem={reviewItem}
                        candidateText={
                          candidateTextById[reviewItem.id] || reviewItem.suggestedText
                        }
                        selectedOptions={selectedOptionsById[reviewItem.id] || []}
                        isRewriting={Boolean(rewritingById[reviewItem.id])}
                        rewriteError={rewriteErrorById[reviewItem.id]}
                        rewriteExplanation={rewriteExplanationById[reviewItem.id]}
                        isApplied={isApplied}
                        onToggleOption={(option) =>
                          onToggleOption(reviewItem.id, option)
                        }
                        onRewrite={() => onRewrite(reviewItem)}
                        onApply={() =>
                          onApplySuggestion({
                            ...reviewItem,
                            suggestedText:
                              candidateTextById[reviewItem.id] ||
                              reviewItem.suggestedText
                          })
                        }
                      />
                    ) : null}
                  </div>

                  <div
                    className="absolute -right-11 top-1/2 -translate-y-1/2"
                  >
                    {isGood ? (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm">
                        <CheckCheck className="h-4 w-4" />
                      </span>
                    ) : isWarn ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600 shadow-sm">
                        Review
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500 shadow-sm">
                        Review
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {unmatchedReviewItems.length > 0 ? (
        <div className="mt-5 rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div className="mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-500">
              More Suggestions
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              These items did not map cleanly onto the PDF preview, but the AI still flagged them as worthwhile improvements.
            </p>
          </div>

          <div className="space-y-3">
            {unmatchedReviewItems.map((reviewItem) => {
              const isApplied = appliedSuggestionIds.includes(reviewItem.id)
              const cardClass =
                reviewItem.type === "warn"
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-rose-200 bg-rose-50/70"
              const noteClass =
                reviewItem.type === "warn" ? "text-amber-700" : "text-rose-700"

              return (
                <div
                  key={reviewItem.id}
                  className={`rounded-2xl border px-4 py-4 ${cardClass}`}
                >
                  <p className="text-sm font-medium leading-6 text-slate-900">
                    {reviewItem.originalText}
                  </p>
                  <p className={`mt-2 text-xs leading-5 ${noteClass}`}>
                    {reviewItem.reason}
                  </p>

                  <RewriteSuggestionControls
                    reviewItem={reviewItem}
                    candidateText={
                      candidateTextById[reviewItem.id] || reviewItem.suggestedText
                    }
                    selectedOptions={selectedOptionsById[reviewItem.id] || []}
                    isRewriting={Boolean(rewritingById[reviewItem.id])}
                    rewriteError={rewriteErrorById[reviewItem.id]}
                    rewriteExplanation={rewriteExplanationById[reviewItem.id]}
                    isApplied={isApplied}
                    onToggleOption={(option) =>
                      onToggleOption(reviewItem.id, option)
                    }
                    onRewrite={() => onRewrite(reviewItem)}
                    onApply={() =>
                      onApplySuggestion({
                        ...reviewItem,
                        suggestedText:
                          candidateTextById[reviewItem.id] ||
                          reviewItem.suggestedText
                      })
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
