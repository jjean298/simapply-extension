import { useEffect, useState } from "react"
import { Download, RotateCcw, X } from "lucide-react"
import { EditedResumePreview } from "./EditedResumePreview"
import { ResumeEditPanel } from "./ResumeEditPanel"
import { AIAssistantPanel } from "./AIAssistantPanel"
import { SimApplyMark } from "./SimApplyMark"
import {
  applySuggestionToResume,
  EMPTY_RESUME_INSIGHTS,
  type ResumeReviewItem
} from "../utils/aiSuggestions"
import { exportResumePdf } from "../utils/exportResumePdf"
import { DEFAULT_MARGINS, type DocumentMargins } from "../utils/documentLayout"
import {
  fetchResumeInsights,
  type GuidedResumeChange
} from "../utils/openaiRelay"
import { extractResumeTextFromPdf } from "../utils/pdfText"

interface ResumeWorkspaceProps {
  file: File | null
  initialResumeText: string
  jobPosting: string
  onReset: () => void
}

type WorkspaceTab = "preview" | "edit" | "assistant"

const tabs: Array<{ id: WorkspaceTab; label: string }> = [
  { id: "preview", label: "Preview" },
  { id: "edit", label: "Edit" },
  { id: "assistant", label: "AI Assistant" }
]

export function ResumeWorkspace({
  file,
  initialResumeText,
  jobPosting,
  onReset
}: ResumeWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("assistant")
  const [sourceResumeText, setSourceResumeText] = useState(initialResumeText)
  const [editedResumeText, setEditedResumeText] = useState(initialResumeText)
  const [isLoading, setIsLoading] = useState(!initialResumeText && Boolean(file))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [insertedText, setInsertedText] = useState<string | null>(null)
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<string[]>([])
  const [documentMargins, setDocumentMargins] =
    useState<DocumentMargins>(DEFAULT_MARGINS)
  const [guidedRequest, setGuidedRequest] = useState("")
  const [guidedResponse, setGuidedResponse] = useState("")
  const [guidedSuggestedResumeText, setGuidedSuggestedResumeText] = useState("")
  const [guidedChanges, setGuidedChanges] = useState<GuidedResumeChange[]>([])
  const [guidedError, setGuidedError] = useState<string | null>(null)
  const [isGuidedLoading, setIsGuidedLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadResume() {
      if (initialResumeText.trim()) {
        setSourceResumeText(initialResumeText)
        setEditedResumeText(initialResumeText)
        setIsLoading(false)
        return
      }

      if (!file) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const extractedText = await extractResumeTextFromPdf(file)

        if (!cancelled) {
          setSourceResumeText(extractedText)
          setEditedResumeText(extractedText)
          setLoadError(null)
        }
      } catch (error) {
        console.error("Failed to extract resume text", error)

        if (!cancelled) {
          setLoadError("We couldn't parse that PDF. Try another file or paste the resume instead.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadResume()

    return () => {
      cancelled = true
    }
  }, [file, initialResumeText])

  const [insights, setInsights] = useState(EMPTY_RESUME_INSIGHTS)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const runAiAnalysis = async () => {
    if (!sourceResumeText.trim()) return

    try {
      setIsAiLoading(true)
      setAiError(null)
      const nextInsights = await fetchResumeInsights(sourceResumeText, jobPosting)
      setInsights(nextInsights)
    } catch (error) {
      console.error("Failed to fetch AI review", error)
      setAiError(
        error instanceof Error
          ? error.message
          : "We couldn't generate AI suggestions right now."
      )
      setInsights(EMPTY_RESUME_INSIGHTS)
    } finally {
      setIsAiLoading(false)
    }
  }

  useEffect(() => {
    if (!sourceResumeText.trim()) return
    runAiAnalysis()
  }, [sourceResumeText, jobPosting])

  const handleApplySuggestion = (item: ResumeReviewItem) => {
    if (!item.suggestedText) return

    const { nextText, insertedText: nextInsertedText } = applySuggestionToResume(
      editedResumeText,
      item.originalText,
      item.suggestedText
    )

    setEditedResumeText(nextText)
    setInsertedText(nextInsertedText)
    setAppliedSuggestionIds((currentIds) =>
      currentIds.includes(item.id) ? currentIds : [...currentIds, item.id]
    )
    setActiveTab("edit")
  }

  const handleExport = async () => {
    if (!editedResumeText.trim()) return
    await exportResumePdf(editedResumeText, documentMargins)
  }

  const handleApplyGuidedResume = (nextResumeText: string) => {
    if (!nextResumeText.trim()) return
    setEditedResumeText(nextResumeText)
    setInsertedText(null)
    setActiveTab("edit")
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center bg-[color:var(--surface-soft)]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--accent-soft)] border-t-[color:var(--accent-strong)]" />
            <p className="text-sm text-slate-500">Preparing your workspace...</p>
          </div>
        </div>
      )
    }

    if (loadError) {
      return (
        <div className="flex h-full items-center justify-center bg-[color:var(--surface-soft)] px-6">
          <div className="max-w-sm rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm leading-6 text-rose-600">{loadError}</p>
          </div>
        </div>
      )
    }

    if (activeTab === "preview") {
      return (
        <div className="flex h-full flex-col bg-white">
          <div className="border-b border-[color:var(--panel-border)] px-5 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
                <p className="text-xs text-slate-500">
                  Review the current resume before exporting.
                </p>
              </div>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 bg-[color:var(--surface-soft)] px-5 py-5">
            <div className="mx-auto h-full max-w-5xl rounded-3xl border border-[color:var(--panel-border)] bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
              <EditedResumePreview
                text={editedResumeText}
                margins={documentMargins}
              />
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === "edit") {
      return (
        <div className="min-h-0 flex-1 bg-[color:var(--surface-soft)] px-5 py-5">
          <div className="mx-auto flex h-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-3xl border border-[color:var(--panel-border)] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <ResumeEditPanel
              content={editedResumeText}
              onChange={(nextText) => {
                setEditedResumeText(nextText)
                if (insertedText && !nextText.includes(insertedText)) {
                  setInsertedText(null)
                }
              }}
              onExport={handleExport}
              margins={documentMargins}
              onMarginsChange={setDocumentMargins}
              insertedText={insertedText}
            />
          </div>
        </div>
      )
    }

    return (
      <AIAssistantPanel
        insights={insights}
        sourceResumeText={sourceResumeText}
        workingResumeText={editedResumeText}
        sourceFile={file}
        jobPosting={jobPosting}
        hasJobPosting={jobPosting.trim().length > 0}
        isLoading={isAiLoading}
        error={aiError}
        onRetry={runAiAnalysis}
        appliedSuggestionIds={appliedSuggestionIds}
        onApplySuggestion={handleApplySuggestion}
        guidedRequest={guidedRequest}
        guidedResponse={guidedResponse}
        guidedSuggestedResumeText={guidedSuggestedResumeText}
        guidedChanges={guidedChanges}
        guidedError={guidedError}
        isGuidedLoading={isGuidedLoading}
        onGuidedRequestChange={setGuidedRequest}
        onGuidedResponse={({ responseText, suggestedResumeText, changes }) => {
          setGuidedResponse(responseText)
          setGuidedSuggestedResumeText(suggestedResumeText)
          setGuidedChanges(changes)
          setGuidedError(null)
        }}
        onGuidedError={(value) => {
          setGuidedError(value)
          if (value) {
            setGuidedResponse("")
            setGuidedSuggestedResumeText("")
            setGuidedChanges([])
          }
        }}
        onGuidedLoadingChange={setIsGuidedLoading}
        onApplyGuidedResume={handleApplyGuidedResume}
      />
    )
  }

  return (
    <div className="simapply-shell-glow flex h-full flex-col overflow-hidden rounded-[32px] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)]">
      <header className="border-b border-[color:var(--panel-border)] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <SimApplyMark size="md" />
            <div>
              <h1 className="simapply-wordmark text-2xl font-semibold tracking-tight">
                SimApply
              </h1>
              <p className="text-sm text-slate-300">
                Resume workspace for previewing, editing, and AI suggestions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/8"
            >
              <RotateCcw className="h-4 w-4" />
              Start Over
            </button>
            <button
              onClick={onReset}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/8"
              aria-label="Close workspace"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,210,120,0.08))] px-4 py-3 text-sm text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Formatting Note
            </p>
            <p className="mt-1 leading-6">
              Resume structure may shift during editing, preview, or export. Use the margin, spacing, font, and link tools to refine the final presentation.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Early Access AI
            </p>
            <p className="mt-1 leading-6">
              AI reviews and guided rewrites are limited in early access. Plan for a small number of free attempts before continuing with your own key.
            </p>
          </div>
        </div>
      </header>

      <nav className="border-b border-[color:var(--panel-border)] bg-white/4 px-4">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative rounded-t-2xl px-4 py-3 text-sm transition ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[linear-gradient(90deg,#ffd23f,#7c5cff,#67b6ff)]" />
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="min-h-0 flex-1">{renderContent()}</div>
    </div>
  )
}
