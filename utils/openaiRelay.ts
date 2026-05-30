import {
  ensureResumeReviewCoverage,
  normalizeResumeInsights,
  type ResumeInsights
} from "./aiSuggestions"

const DEFAULT_API_BASE_URL = "http://localhost:8787"

export interface GuidedResumeChange {
  before: string
  after: string
  reason: string
}

function getRelayBaseUrl() {
  const envProcess = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> }
    }
  ).process
  const configured =
    envProcess?.env?.PLASMO_PUBLIC_SIMAPPLY_API_BASE_URL || DEFAULT_API_BASE_URL

  return configured.replace(/\/$/, "")
}

export async function fetchResumeInsights(
  resumeText: string,
  jobPosting: string
): Promise<ResumeInsights> {
  const response = await fetch(`${getRelayBaseUrl()}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      resumeText,
      jobPosting
    })
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "AI analysis request failed"
    throw new Error(message)
  }

  if (!payload?.insights) {
    throw new Error("The AI relay returned an invalid response")
  }

  return ensureResumeReviewCoverage(
    normalizeResumeInsights(payload.insights),
    resumeText,
    jobPosting
  )
}

export async function rewriteResumeLineWithDetails({
  originalLine,
  currentSuggestion,
  jobPosting,
  section,
  selectedDetails
}: {
  originalLine: string
  currentSuggestion?: string
  jobPosting: string
  section?: string
  selectedDetails: string[]
}) {
  const response = await fetch(`${getRelayBaseUrl()}/rewrite-line`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      originalLine,
      currentSuggestion,
      jobPosting,
      section,
      selectedDetails
    })
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Line rewrite request failed"
    throw new Error(message)
  }

  if (!payload?.rewrittenLine) {
    throw new Error("The AI relay did not return a rewritten line")
  }

  return {
    rewrittenLine: String(payload.rewrittenLine),
    explanation:
      typeof payload.explanation === "string" ? payload.explanation : ""
  }
}

export async function requestResumeGuidance({
  resumeText,
  jobPosting,
  request
}: {
  resumeText: string
  jobPosting: string
  request: string
}) {
  const response = await fetch(`${getRelayBaseUrl()}/guided-request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      resumeText,
      jobPosting,
      request
    })
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Guided request failed"
    throw new Error(message)
  }

  if (!payload?.responseText) {
    throw new Error("The AI relay did not return a guided response")
  }

  return {
    responseText: String(payload.responseText),
    suggestedResumeText:
      typeof payload.suggestedResumeText === "string"
        ? payload.suggestedResumeText
        : "",
    changes: Array.isArray(payload.changes)
      ? payload.changes
          .filter((value) => value && typeof value === "object")
          .map((value) => ({
            before:
              typeof value.before === "string" ? value.before : "",
            after: typeof value.after === "string" ? value.after : "",
            reason:
              typeof value.reason === "string" ? value.reason : ""
          }))
          .filter((value) => value.before.trim() && value.after.trim())
      : []
  }
}
