import { useState } from "react"
import { CheckCheck, Sparkles } from "lucide-react"
import type { ResumeInsights, ResumeReviewItem } from "../utils/aiSuggestions"
import {
  type GuidedResumeChange,
  requestResumeGuidance,
  rewriteResumeLineWithDetails
} from "../utils/openaiRelay"
import { PdfReviewOverlay } from "./PDFReviewOverlay"
import { RewriteSuggestionControls } from "./RewriteSuggestionControls"

interface AIAssistantPanelProps {
  insights: ResumeInsights
  sourceResumeText: string
  workingResumeText: string
  sourceFile: File | null
  jobPosting: string
  hasJobPosting: boolean
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  appliedSuggestionIds: string[]
  onApplySuggestion: (item: ResumeReviewItem) => void
  guidedRequest: string
  guidedResponse: string
  guidedSuggestedResumeText: string
  guidedChanges: GuidedResumeChange[]
  guidedError: string | null
  isGuidedLoading: boolean
  onGuidedRequestChange: (value: string) => void
  onGuidedResponse: (payload: {
    responseText: string
    suggestedResumeText: string
    changes: GuidedResumeChange[]
  }) => void
  onGuidedError: (value: string | null) => void
  onGuidedLoadingChange: (value: boolean) => void
  onApplyGuidedResume: (resumeText: string) => void
}

const toneStyles = {
  good: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-rose-100 text-rose-700"
}

const reviewStyles = {
  good: {
    wrapper: "border-emerald-200 bg-emerald-50/80",
    text: "text-emerald-900",
    note: "text-emerald-700"
  },
  warn: {
    wrapper: "border-amber-200 bg-amber-50/80",
    text: "text-amber-950",
    note: "text-amber-700"
  },
  fix: {
    wrapper: "border-rose-200 bg-rose-50/80",
    text: "text-rose-900",
    note: "text-rose-700"
  }
}

const requestSuggestions = [
  "Make this more ATS-friendly",
  "Emphasize email support experience",
  "Make my bullets more metric-driven",
  "Rewrite this for customer support roles"
]

export function AIAssistantPanel({
  insights,
  sourceResumeText,
  workingResumeText,
  sourceFile,
  jobPosting,
  hasJobPosting,
  isLoading = false,
  error = null,
  onRetry,
  appliedSuggestionIds,
  onApplySuggestion,
  guidedRequest,
  guidedResponse,
  guidedSuggestedResumeText,
  guidedChanges,
  guidedError,
  isGuidedLoading,
  onGuidedRequestChange,
  onGuidedResponse,
  onGuidedError,
  onGuidedLoadingChange,
  onApplyGuidedResume
}: AIAssistantPanelProps) {
  const [itemState, setItemState] = useState<
    Record<
      string,
      {
        selectedOptions: string[]
        candidateText?: string
        rewriteExplanation?: string
        rewriteError?: string | null
        isRewriting?: boolean
      }
    >
  >({})
  const reviewMap = new Map(
    insights.reviewItems.map((item) => [item.originalText, item] as const)
  )
  const selectedOptionsById = Object.keys(itemState).reduce<Record<string, string[]>>(
    (accumulator, id) => {
      accumulator[id] = itemState[id]?.selectedOptions || []
      return accumulator
    },
    {}
  )
  const candidateTextById = Object.keys(itemState).reduce<
    Record<string, string | undefined>
  >((accumulator, id) => {
    accumulator[id] = itemState[id]?.candidateText
    return accumulator
  }, {})
  const rewriteExplanationById = Object.keys(itemState).reduce<
    Record<string, string | undefined>
  >((accumulator, id) => {
    accumulator[id] = itemState[id]?.rewriteExplanation
    return accumulator
  }, {})
  const rewriteErrorById = Object.keys(itemState).reduce<
    Record<string, string | null | undefined>
  >((accumulator, id) => {
    accumulator[id] = itemState[id]?.rewriteError
    return accumulator
  }, {})
  const rewritingById = Object.keys(itemState).reduce<
    Record<string, boolean | undefined>
  >((accumulator, id) => {
    accumulator[id] = itemState[id]?.isRewriting
    return accumulator
  }, {})

  const lines = sourceResumeText.split("\n")

  const toggleOption = (itemId: string, option: string) => {
    setItemState((current) => {
      const currentOptions = current[itemId]?.selectedOptions || []
      const nextOptions = currentOptions.includes(option)
        ? currentOptions.filter((value) => value !== option)
        : [...currentOptions, option]

      return {
        ...current,
        [itemId]: {
          ...current[itemId],
          selectedOptions: nextOptions,
          rewriteError: null
        }
      }
    })
  }

  const rewriteItem = async (reviewItem: ResumeReviewItem) => {
    const selectedOptions = itemState[reviewItem.id]?.selectedOptions || []
    if (!selectedOptions.length) return

    setItemState((current) => ({
      ...current,
      [reviewItem.id]: {
        ...current[reviewItem.id],
        selectedOptions,
        isRewriting: true,
        rewriteError: null
      }
    }))

    try {
      const rewrite = await rewriteResumeLineWithDetails({
        originalLine: reviewItem.originalText,
        currentSuggestion: itemState[reviewItem.id]?.candidateText || reviewItem.suggestedText,
        jobPosting,
        section: reviewItem.section,
        selectedDetails: selectedOptions
      })

      setItemState((current) => ({
        ...current,
        [reviewItem.id]: {
          ...current[reviewItem.id],
          selectedOptions,
          candidateText: rewrite.rewrittenLine,
          rewriteExplanation: rewrite.explanation,
          rewriteError: null,
          isRewriting: false
        }
      }))
    } catch (rewriteError) {
      setItemState((current) => ({
        ...current,
        [reviewItem.id]: {
          ...current[reviewItem.id],
          selectedOptions,
          rewriteError:
            rewriteError instanceof Error
              ? rewriteError.message
              : "We couldn't rewrite this line right now.",
          isRewriting: false
        }
      }))
    }
  }

  const applyReviewItem = (reviewItem: ResumeReviewItem) => {
    const candidateText =
      itemState[reviewItem.id]?.candidateText || reviewItem.suggestedText

    onApplySuggestion({
      ...reviewItem,
      suggestedText: candidateText
    })
  }

  const handleGuidedRequest = async () => {
    if (!guidedRequest.trim() || !sourceResumeText.trim()) return

    try {
      onGuidedLoadingChange(true)
      onGuidedError(null)
      const result = await requestResumeGuidance({
        resumeText: workingResumeText,
        jobPosting,
        request: guidedRequest.trim()
      })
      onGuidedResponse({
        responseText: result.responseText,
        suggestedResumeText: result.suggestedResumeText,
        changes: result.changes
      })
    } catch (requestError) {
      onGuidedError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn't process that request right now."
      )
    } finally {
      onGuidedLoadingChange(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[color:var(--surface-soft)] px-5 py-5">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
            Use Your Judgment
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            AI suggestions are meant to help, not replace your judgment. Use
            what fits your experience and ignore what does not.
          </p>
        </section>

        <section className="rounded-3xl border border-[color:var(--panel-border)] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[color:var(--accent-strong)]" />
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Match Summary
              </h2>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneStyles[insights.matchTone]}`}
            >
              {insights.matchLabel}
            </span>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-3 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--accent-soft)] border-t-[color:var(--accent-strong)]" />
              <p className="text-sm leading-6 text-slate-500">
                Generating real AI feedback for this resume...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="text-sm leading-6 text-rose-600">{error}</p>
              {onRetry ? (
                <button
                  onClick={onRetry}
                  className="mt-3 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-700">
              {insights.matchSummary}
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-[color:var(--panel-border)] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--accent-strong)]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Ask SimApply
            </h2>
          </div>
          <p className="text-sm leading-6 text-slate-500">
            Make a focused request without opening a full chat. Ask for resume-specific improvements like ATS wording, stronger bullets, or clearer support experience.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {requestSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onGuidedRequestChange(suggestion)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-white"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <textarea
              value={guidedRequest}
              onChange={(event) => onGuidedRequestChange(event.target.value)}
              placeholder="Ask SimApply to refine this resume..."
              className="h-24 w-full resize-none rounded-xl border-0 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-[color:var(--accent-strong)]"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Keep requests focused on resume improvement.
              </p>
              <button
                onClick={handleGuidedRequest}
                disabled={isGuidedLoading || !guidedRequest.trim()}
                className="rounded-xl bg-[color:var(--accent-strong)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-default disabled:opacity-40"
              >
                {isGuidedLoading ? "Thinking..." : "Ask SimApply"}
              </button>
            </div>
          </div>

          {guidedError ? (
            <p className="mt-3 text-sm leading-6 text-rose-600">{guidedError}</p>
          ) : null}

          {guidedResponse ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Guided Response
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {guidedResponse}
              </p>
              {guidedChanges.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    What changed
                  </p>
                  {guidedChanges.map((change, index) => (
                    <div
                      key={`${change.before}-${index}`}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">
                        Before
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        {change.before}
                      </p>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                        After
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-900">
                        {change.after}
                      </p>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        {change.reason}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              {guidedSuggestedResumeText ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-[color:var(--accent-soft)] bg-white px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent-strong)]">
                      Rewritten Resume Draft
                    </p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {guidedSuggestedResumeText}
                    </pre>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={() => onApplyGuidedResume(guidedSuggestedResumeText)}
                      className="rounded-xl bg-[color:var(--accent-strong)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-95"
                    >
                      Replace Edit draft with this version
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-[color:var(--panel-border)] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Resume Review
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Green highlights show what is working well. For yellow and red highlights, look for the missing keyword, where it belongs, and a stronger rewrite you can send into Edit.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                Strong
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Could improve
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                Needs work
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-slate-50">
              <div className="text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--accent-soft)] border-t-[color:var(--accent-strong)]" />
                <p className="text-sm text-slate-500">
                  Reviewing your original resume with AI...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-8 text-center text-sm text-rose-600">
              {error}
            </div>
          ) : sourceFile?.type === "application/pdf" ? (
            <PdfReviewOverlay
              file={sourceFile}
              reviewItems={insights.reviewItems}
              appliedSuggestionIds={appliedSuggestionIds}
              onApplySuggestion={onApplySuggestion}
              selectedOptionsById={selectedOptionsById}
              candidateTextById={candidateTextById}
              rewriteExplanationById={rewriteExplanationById}
              rewriteErrorById={rewriteErrorById}
              rewritingById={rewritingById}
              onToggleOption={toggleOption}
              onRewrite={rewriteItem}
            />
          ) : (
            <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
              <div className="mx-auto max-w-3xl rounded-[24px] border border-slate-200 bg-white px-8 py-7 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                {lines.map((line, index) => {
                  const reviewItem = reviewMap.get(line)

                  if (!reviewItem) {
                    return line.trim() ? (
                      <div
                        key={`${index}-${line}`}
                        className="mb-2 text-sm leading-7 text-slate-700"
                      >
                        {line}
                      </div>
                    ) : (
                      <div key={`${index}-${line}`} className="h-4" />
                    )
                  }

                  const styleSet = reviewStyles[reviewItem.type]
                  const isApplied = appliedSuggestionIds.includes(reviewItem.id)
                  const priorityTone =
                    reviewItem.priority === "high"
                      ? "text-rose-600"
                      : reviewItem.priority === "low"
                        ? "text-slate-400"
                        : "text-amber-600"

                  return (
                    <div
                      key={reviewItem.id}
                      className={`group mb-3 rounded-2xl border px-4 py-3 ${styleSet.wrapper}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm leading-7 ${styleSet.text}`}>
                            {line}
                          </p>
                          <p className={`mt-2 text-xs leading-5 ${styleSet.note}`}>
                            {reviewItem.reason}
                          </p>
                          {reviewItem.type !== "good" ? (
                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
                              {reviewItem.priority ? (
                                <span className={priorityTone}>
                                  {reviewItem.priority} priority
                                </span>
                              ) : null}
                              {reviewItem.section ? (
                                <span className="text-slate-400">
                                  {reviewItem.section}
                                </span>
                              ) : null}
                            </div>
                          ) : null}

                          <RewriteSuggestionControls
                            reviewItem={reviewItem}
                            candidateText={
                              itemState[reviewItem.id]?.candidateText ||
                              reviewItem.suggestedText
                            }
                            selectedOptions={
                              itemState[reviewItem.id]?.selectedOptions || []
                            }
                            isRewriting={Boolean(itemState[reviewItem.id]?.isRewriting)}
                            rewriteError={itemState[reviewItem.id]?.rewriteError}
                            rewriteExplanation={
                              itemState[reviewItem.id]?.rewriteExplanation
                            }
                            isApplied={isApplied}
                            onToggleOption={(option) =>
                              toggleOption(reviewItem.id, option)
                            }
                            onRewrite={() => rewriteItem(reviewItem)}
                            onApply={() => applyReviewItem(reviewItem)}
                          />

                          <div className="mt-3 hidden rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 shadow-sm group-hover:block">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              {reviewItem.hoverTitle ||
                                (reviewItem.type === "good"
                                  ? "Strong line"
                                  : reviewItem.type === "warn"
                                    ? "Could improve"
                                    : "Needs work")}
                            </p>
                            <p className="mt-2 leading-6">{reviewItem.reason}</p>
                            {reviewItem.replacementText && reviewItem.highlightText && (
                              <p className="mt-2 leading-6 text-rose-600">
                                Try replacing "{reviewItem.highlightText}" with "{reviewItem.replacementText}".
                              </p>
                            )}
                          </div>
                        </div>

                        {reviewItem.type === "good" ? (
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                            <CheckCheck className="h-4 w-4" />
                          </span>
                        ) : reviewItem.type === "warn" ? (
                          <span className="inline-flex rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">
                            Review
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">
                            Review
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[color:var(--panel-border)] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Missing Keywords
          </h2>

          {isLoading ? (
            <p className="text-sm leading-6 text-slate-500">
              Pulling role-specific keywords from your AI analysis...
            </p>
          ) : insights.missingKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {insights.missingKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[color:var(--accent-strong)]"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              {hasJobPosting
                ? "The resume already covers the main keywords surfaced from the job description."
                : "Add a job description to surface missing keywords for this role."}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
