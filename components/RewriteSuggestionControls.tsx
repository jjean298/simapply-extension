import type { ResumeReviewItem } from "../utils/aiSuggestions"

interface RewriteSuggestionControlsProps {
  reviewItem: ResumeReviewItem
  candidateText?: string
  selectedOptions: string[]
  isRewriting: boolean
  rewriteError?: string | null
  rewriteExplanation?: string
  isApplied: boolean
  onToggleOption: (option: string) => void
  onRewrite: () => void
  onApply: () => void
}

export function RewriteSuggestionControls({
  reviewItem,
  candidateText,
  selectedOptions,
  isRewriting,
  rewriteError,
  rewriteExplanation,
  isApplied,
  onToggleOption,
  onRewrite,
  onApply
}: RewriteSuggestionControlsProps) {
  if (reviewItem.type === "good") return null

  const clarificationOptions = reviewItem.clarificationOptions || []

  return (
    <div className="mt-3 space-y-3">
      {clarificationOptions.length > 0 ? (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Anything missing that applies?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {clarificationOptions.map((option) => {
              const isSelected = selectedOptions.includes(option)

              return (
                <button
                  key={option}
                  onClick={onToggleOption.bind(null, option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    isSelected
                      ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent-strong)]"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {candidateText ? (
        <div className="rounded-xl border border-rose-200 bg-white/80 px-3 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-500">
            Suggested Rewrite
          </p>
          <p className="text-sm leading-6 text-slate-800">{candidateText}</p>
          {rewriteExplanation ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {rewriteExplanation}
            </p>
          ) : null}
        </div>
      ) : null}

      {rewriteError ? (
        <p className="text-xs leading-5 text-rose-600">{rewriteError}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {clarificationOptions.length > 0 ? (
          <button
            onClick={onRewrite}
            disabled={isRewriting || selectedOptions.length === 0}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
          >
            {isRewriting ? "Rewriting..." : "Rewrite with selected details"}
          </button>
        ) : null}

        {candidateText ? (
          <button
            onClick={onApply}
            disabled={isApplied}
            className="rounded-xl bg-[color:var(--accent-strong)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-95 disabled:cursor-default disabled:opacity-40"
          >
            {isApplied ? "Added to Edit" : "Use this rewrite"}
          </button>
        ) : null}
      </div>
    </div>
  )
}
