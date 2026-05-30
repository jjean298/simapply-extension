import { type ChangeEvent, useMemo, useState } from "react"
import { FileText, Upload } from "lucide-react"
import { SimApplyMark } from "./SimApplyMark"

interface UploadPanelProps {
  onContinue: (payload: {
    file: File | null
    resumeText: string
    jobPosting: string
  }) => void
}

type InputMode = "upload" | "paste"

export function UploadPanel({ onContinue }: UploadPanelProps) {
  const [inputMode, setInputMode] = useState<InputMode>("upload")
  const [jobPosting, setJobPosting] = useState("")
  const [resumeText, setResumeText] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const canContinue = useMemo(() => {
    if (inputMode === "upload") {
      return Boolean(selectedFile)
    }

    return resumeText.trim().length > 0
  }, [inputMode, resumeText, selectedFile])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleContinue = () => {
    onContinue({
      file: inputMode === "upload" ? selectedFile : null,
      resumeText: inputMode === "paste" ? resumeText.trim() : "",
      jobPosting: jobPosting.trim()
    })
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-xl flex-col justify-center px-6 py-8">
      <div className="simapply-shell-glow rounded-[32px] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] backdrop-blur-xl">
        <div className="border-b border-[color:var(--panel-border)] px-6 py-5">
          <div className="flex flex-col items-center text-center">
            <SimApplyMark size="lg" />
            <h1 className="mt-5 simapply-wordmark text-4xl font-semibold tracking-tight">
              SimApply
            </h1>
            <p className="mt-3 max-w-md text-base leading-7 text-slate-300">
              Upload your resume, paste a role, and get structured AI guidance
              in a focused side-panel workflow.
            </p>
            <p className="mt-5 text-sm text-slate-500">
              Start with a PDF or paste your resume text
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="inline-flex rounded-2xl bg-white/5 p-1 text-sm ring-1 ring-white/8">
              <button
                onClick={() => setInputMode("upload")}
                className={`rounded-xl px-4 py-2 transition ${
                  inputMode === "upload"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400"
                }`}
              >
                Upload PDF
              </button>
              <button
                onClick={() => setInputMode("paste")}
                className={`rounded-xl px-4 py-2 transition ${
                  inputMode === "paste"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400"
                }`}
              >
                Paste Resume
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-6">
          <section className="space-y-3">
            <label className="text-sm font-medium text-slate-200">
              Resume
            </label>

            {inputMode === "upload" ? (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/4 px-5 py-8 text-center transition hover:border-[color:var(--brand-sky)] hover:bg-white/6">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="mb-3 h-5 w-5 text-[color:var(--brand-sky)]" />
                <span className="text-sm font-medium text-slate-100">
                  {selectedFile ? selectedFile.name : "Choose a PDF resume"}
                </span>
                <span className="mt-1 text-xs text-slate-400">
                  Upload a PDF to parse it into the workspace.
                </span>
              </label>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/4 p-3">
                <textarea
                  value={resumeText}
                  onChange={(event) => setResumeText(event.target.value)}
                  placeholder="Paste your resume text here..."
                  className="h-48 w-full resize-none rounded-xl border-0 bg-[#fdfdfd] px-4 py-3 text-sm leading-6 text-slate-800 outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-[color:var(--brand-sky)]"
                />
              </div>
            )}
          </section>

          <section className="space-y-3">
            <label className="text-sm font-medium text-slate-200">
              Job Description
              <span className="ml-1 text-slate-500">(optional)</span>
            </label>
            <div className="rounded-2xl border border-white/10 bg-white/4 p-3">
              <textarea
                value={jobPosting}
                onChange={(event) => setJobPosting(event.target.value)}
                placeholder="Paste the job description here for tailored suggestions..."
                className="h-36 w-full resize-none rounded-xl border-0 bg-[#fdfdfd] px-4 py-3 text-sm leading-6 text-slate-800 outline-none ring-1 ring-black/5 focus:ring-2 focus:ring-[color:var(--brand-sky)]"
              />
            </div>
          </section>

          <button
            onClick={handleContinue}
            disabled={!canContinue}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,var(--brand-warm),var(--brand-rose),var(--accent-strong))] px-4 py-3 text-sm font-medium text-white shadow-[0_12px_28px_rgba(124,92,255,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            Continue to Workspace
          </button>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,210,120,0.06))] p-4 text-sm text-slate-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Formatting Note
              </p>
              <p className="mt-1 leading-6">
                Fonts, spacing, and layout may shift during editing and export.
                Use the Edit tools to refine your final version.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Early Access AI
              </p>
              <p className="mt-1 leading-6">
                Guided AI rewrites are limited during early access and may
                require your own API key after a small free allowance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
