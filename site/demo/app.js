import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.min.mjs"

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs"

const API_BASE_URL = "https://simapply-relay.onrender.com"

const state = {
  inputMode: "upload",
  sourceResumeText: "",
  editedResumeText: "",
  jobPosting: "",
  file: null,
  insights: null,
  activeTab: "assistant",
  appliedSuggestionIds: new Set(),
  guidedResult: null
}

const elements = {
  uploadView: document.getElementById("upload-view"),
  workspaceView: document.getElementById("workspace-view"),
  modeButtons: Array.from(document.querySelectorAll(".mode-button")),
  uploadPanel: document.getElementById("upload-panel"),
  pastePanel: document.getElementById("paste-panel"),
  fileInput: document.getElementById("resume-file"),
  fileName: document.getElementById("file-name"),
  resumeText: document.getElementById("resume-text"),
  jobDescription: document.getElementById("job-description"),
  continueButton: document.getElementById("continue-button"),
  startOver: document.getElementById("start-over"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  toolbarButtons: Array.from(document.querySelectorAll(".toolbar-button")),
  tabPanels: {
    assistant: document.getElementById("assistant-tab"),
    edit: document.getElementById("edit-tab"),
    preview: document.getElementById("preview-tab")
  },
  editText: document.getElementById("edit-text"),
  previewText: document.getElementById("preview-text"),
  matchLabel: document.getElementById("match-label"),
  matchSummary: document.getElementById("match-summary"),
  matchTonePill: document.getElementById("match-tone-pill"),
  reviewList: document.getElementById("review-list"),
  keywordList: document.getElementById("keyword-list"),
  guidedRequest: document.getElementById("guided-request"),
  guidedSubmit: document.getElementById("guided-submit"),
  guidedResult: document.getElementById("guided-result"),
  guidedError: document.getElementById("guided-error"),
  presetButtons: Array.from(document.querySelectorAll(".preset-pill"))
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function renderInlineFormatting(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
}

function getToneClass(tone) {
  if (tone === "good") return "tone-good"
  if (tone === "low") return "tone-low"
  return "tone-medium"
}

function getReviewTypeLabel(type) {
  if (type === "good") return "Strong"
  if (type === "warn") return "Could improve"
  return "Needs work"
}

function renderMode() {
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.inputMode)
  })

  elements.uploadPanel.classList.toggle("hidden", state.inputMode !== "upload")
  elements.pastePanel.classList.toggle("hidden", state.inputMode !== "paste")
  updateContinueButton()
}

function renderTabs() {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === state.activeTab)
  })

  Object.entries(elements.tabPanels).forEach(([tab, panel]) => {
    panel.classList.toggle("active", tab === state.activeTab)
  })
}

function updateContinueButton() {
  const canContinue =
    state.inputMode === "upload"
      ? Boolean(state.file)
      : Boolean(elements.resumeText.value.trim())

  elements.continueButton.disabled = !canContinue
}

async function extractResumeTextFromPdf(file) {
  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const lines = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const items = textContent.items || []
    const grouped = new Map()

    items.forEach((item) => {
      if (!item.str || !item.transform) return
      const text = String(item.str).trim()
      if (!text) return
      const y = Math.round(item.transform[5])
      if (!grouped.has(y)) grouped.set(y, [])
      grouped.get(y).push(item)
    })

    Array.from(grouped.keys())
      .sort((a, b) => b - a)
      .forEach((y) => {
        const row = grouped.get(y)
        row.sort((a, b) => a.transform[4] - b.transform[4])
        const line = row
          .map((item) => String(item.str).trim())
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()

        if (line) {
          lines.push(line)
        }
      })
  }

  return lines.join("\n")
}

async function fetchJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || "Request failed")
  }

  return data
}

function applySuggestion(item, nextText) {
  const sourceLine = item.originalText
  if (!nextText || !sourceLine) return

  const lines = state.editedResumeText.split("\n")
  const index = lines.findIndex((line) => line === sourceLine)
  if (index === -1) return

  lines[index] = nextText
  state.editedResumeText = lines.join("\n")
  state.appliedSuggestionIds.add(item.id)
  elements.editText.value = state.editedResumeText
  renderPreview()
  renderReviewList()
  state.activeTab = "edit"
  renderTabs()
}

function renderPreview() {
  const lines = state.editedResumeText.split("\n")
  const parts = []
  let currentList = []

  function flushList() {
    if (!currentList.length) return
    parts.push(`<ul>${currentList.join("")}</ul>`)
    currentList = []
  }

  lines.forEach((line) => {
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      return
    }

    const isCentered = trimmed.startsWith("[CENTER]")
    const centeredText = isCentered ? trimmed.replace("[CENTER]", "").trim() : trimmed
    const formatted = renderInlineFormatting(centeredText)

    if (/^[•-]\s*/.test(centeredText)) {
      currentList.push(
        `<li>${formatted.replace(/^[•-]\s*/, "")}</li>`
      )
      return
    }

    flushList()
    parts.push(
      `<p class="${isCentered ? "preview-centered" : ""}">${formatted}</p>`
    )
  })

  flushList()
  elements.previewText.innerHTML = parts.join("")
}

function wrapSelection(prefix, suffix = prefix) {
  const textarea = elements.editText
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.slice(start, end)
  const replacement = `${prefix}${selected}${suffix}`

  textarea.setRangeText(replacement, start, end, "select")
  state.editedResumeText = textarea.value
  renderPreview()
}

function applyLinePrefix(prefix) {
  const textarea = elements.editText
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const lineStart = value.lastIndexOf("\n", start - 1) + 1
  const lineEnd = value.indexOf("\n", end)
  const sliceEnd = lineEnd === -1 ? value.length : lineEnd
  const block = value.slice(lineStart, sliceEnd)
  const nextBlock = block
    .split("\n")
    .map((line) => (line.trim() ? `${prefix}${line}` : line))
    .join("\n")

  textarea.setRangeText(nextBlock, lineStart, sliceEnd, "select")
  state.editedResumeText = textarea.value
  renderPreview()
}

function applyToolbarAction(format) {
  elements.editText.focus()

  if (format === "bold") {
    wrapSelection("**")
    return
  }

  if (format === "italic") {
    wrapSelection("*")
    return
  }

  if (format === "underline") {
    wrapSelection("__")
    return
  }

  if (format === "bullet") {
    applyLinePrefix("• ")
    return
  }

  if (format === "center") {
    applyLinePrefix("[CENTER]")
    return
  }

  if (format === "link") {
    const url = window.prompt("Paste the URL to attach to this text:")
    if (!url) return
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`
    const textarea = elements.editText
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = textarea.value.slice(start, end) || "Link text"
    textarea.setRangeText(
      `[${selected}](${normalizedUrl})`,
      start,
      end,
      "select"
    )
    state.editedResumeText = textarea.value
    renderPreview()
  }
}

function renderKeywords() {
  const keywords = state.insights?.missingKeywords || []
  elements.keywordList.innerHTML = keywords.length
    ? keywords
        .map((keyword) => `<span class="keyword-chip">${escapeHtml(keyword)}</span>`)
        .join("")
    : `<span class="muted-copy">No major missing keywords surfaced from the current review.</span>`
}

function renderGuidedResult() {
  if (!state.guidedResult) {
    elements.guidedResult.classList.add("hidden")
    elements.guidedResult.innerHTML = ""
    return
  }

  const { responseText, suggestedResumeText, changes } = state.guidedResult
  const changesHtml = changes.length
    ? `<div class="change-grid">
        ${changes
          .map(
            (change) => `
              <div class="change-card">
                <p><strong>Before:</strong> ${escapeHtml(change.before)}</p>
                <p><strong>After:</strong> ${escapeHtml(change.after)}</p>
                <p><strong>Why:</strong> ${escapeHtml(change.reason)}</p>
              </div>
            `
          )
          .join("")}
      </div>`
    : ""

  elements.guidedResult.innerHTML = `
    <div class="guided-block">
      <p class="eyebrow small">Guided response</p>
      <p>${escapeHtml(responseText)}</p>
    </div>
    ${changesHtml}
    ${
      suggestedResumeText
        ? `<div class="guided-block">
            <p class="eyebrow small">Rewritten resume draft</p>
            <p>${escapeHtml(suggestedResumeText).replaceAll("\n", "<br />")}</p>
            <div class="review-actions">
              <button class="inline-button" id="apply-guided-draft">Replace Edit draft with this version</button>
            </div>
          </div>`
        : ""
    }
  `

  elements.guidedResult.classList.remove("hidden")

  const applyButton = document.getElementById("apply-guided-draft")
  if (applyButton) {
    applyButton.addEventListener("click", () => {
      state.editedResumeText = suggestedResumeText
      elements.editText.value = state.editedResumeText
      renderPreview()
      state.activeTab = "edit"
      renderTabs()
    })
  }
}

async function handleLineRewrite(item) {
  const button = document.querySelector(
    `[data-rewrite-id="${item.id}"]`
  )

  if (button) {
    button.disabled = true
    button.textContent = "Rewriting..."
  }

  try {
    const result = await fetchJson("/rewrite-line", {
      originalLine: item.originalText,
      currentSuggestion: item.suggestedText || "",
      jobPosting: state.jobPosting,
      section: item.section || "",
      selectedDetails: item.clarificationOptions?.slice(0, 3) || []
    })

    item.suggestedText = result.rewrittenLine || item.suggestedText
    item.reason = result.explanation
      ? `${item.reason} ${result.explanation}`
      : item.reason
    renderReviewList()
  } catch (error) {
    if (button) {
      button.textContent = error instanceof Error ? error.message : "Try again"
    }
    return
  }
}

function renderReviewList() {
  const items = state.insights?.reviewItems || []

  if (!items.length) {
    elements.reviewList.innerHTML = `<div class="review-card warn"><p class="review-reason">No review items yet. Upload a resume and continue to run AI analysis.</p></div>`
    return
  }

  elements.reviewList.innerHTML = items
    .map((item) => {
      const typeLabel = getReviewTypeLabel(item.type)
      const suggestionBlock =
        item.type !== "good" && item.suggestedText
          ? `<p class="review-suggestion"><strong>Suggested fix:</strong> ${escapeHtml(
              item.suggestedText
            )}</p>`
          : ""

      const actionButtons =
        item.type !== "good"
          ? `
            <div class="review-actions">
              ${
                item.clarificationOptions?.length
                  ? `<button class="inline-button" data-rewrite-id="${item.id}">Generate stronger rewrite</button>`
                  : ""
              }
              ${
                item.suggestedText
                  ? `<button class="inline-button" data-apply-id="${item.id}" ${
                      state.appliedSuggestionIds.has(item.id) ? "disabled" : ""
                    }>${state.appliedSuggestionIds.has(item.id) ? "Added to Edit" : "Use this in Edit"}</button>`
                  : ""
              }
            </div>
          `
          : ""

      return `
        <article class="review-card ${item.type}">
          <div class="review-meta">
            <span class="review-type-pill ${item.type}">${typeLabel}</span>
            <span class="muted-copy">${escapeHtml(item.section || "Resume")}</span>
          </div>
          <p class="review-line">${escapeHtml(item.originalText)}</p>
          <p class="review-reason">${escapeHtml(item.reason)}</p>
          ${suggestionBlock}
          ${actionButtons}
        </article>
      `
    })
    .join("")

  items.forEach((item) => {
    const applyButton = document.querySelector(`[data-apply-id="${item.id}"]`)
    if (applyButton) {
      applyButton.addEventListener("click", () => {
        if (item.suggestedText) {
          applySuggestion(item, item.suggestedText)
        }
      })
    }

    const rewriteButton = document.querySelector(`[data-rewrite-id="${item.id}"]`)
    if (rewriteButton) {
      rewriteButton.addEventListener("click", () => handleLineRewrite(item))
    }
  })
}

function renderInsights() {
  const insights = state.insights
  if (!insights) return

  elements.matchLabel.textContent = insights.matchLabel || "AI Review"
  elements.matchSummary.textContent = insights.matchSummary || "AI analysis is ready."
  elements.matchTonePill.textContent = insights.matchLabel || "AI Review"
  elements.matchTonePill.className = `tone-pill ${getToneClass(insights.matchTone)}`
  renderKeywords()
  renderReviewList()
}

async function runAnalysis() {
  state.guidedResult = null
  renderGuidedResult()
  elements.matchLabel.textContent = "Thinking..."
  elements.matchSummary.textContent = "Running AI analysis against the current resume and job description."
  elements.matchTonePill.textContent = "Loading"
  elements.matchTonePill.className = "tone-pill tone-medium"
  elements.reviewList.innerHTML = `<div class="review-card warn"><p class="review-reason">Reviewing the resume...</p></div>`

  try {
    const result = await fetchJson("/analyze", {
      resumeText: state.sourceResumeText,
      jobPosting: state.jobPosting
    })

    state.insights = result.insights
    renderInsights()
  } catch (error) {
    elements.reviewList.innerHTML = `<div class="review-card fix"><p class="review-reason">${escapeHtml(
      error instanceof Error ? error.message : "AI review failed"
    )}</p></div>`
  }
}

async function handleContinue() {
  elements.continueButton.disabled = true
  elements.continueButton.textContent = "Preparing workspace..."

  try {
    state.jobPosting = elements.jobDescription.value.trim()

    if (state.inputMode === "upload") {
      if (!state.file) return
      state.sourceResumeText = await extractResumeTextFromPdf(state.file)
    } else {
      state.sourceResumeText = elements.resumeText.value.trim()
    }

    state.editedResumeText = state.sourceResumeText
    elements.editText.value = state.editedResumeText
    renderPreview()
    elements.uploadView.classList.add("hidden")
    elements.workspaceView.classList.remove("hidden")
    await runAnalysis()
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : "We could not prepare the workspace."
    )
  } finally {
    elements.continueButton.textContent = "Continue to Workspace"
    updateContinueButton()
  }
}

async function handleGuidedRequest() {
  const request = elements.guidedRequest.value.trim()
  if (!request || !state.editedResumeText.trim()) return

  elements.guidedSubmit.disabled = true
  elements.guidedSubmit.textContent = "Thinking..."
  elements.guidedError.classList.add("hidden")
  elements.guidedError.textContent = ""

  try {
    const result = await fetchJson("/guided-request", {
      resumeText: state.editedResumeText,
      jobPosting: state.jobPosting,
      request
    })

    state.guidedResult = {
      responseText: result.responseText || "",
      suggestedResumeText: result.suggestedResumeText || "",
      changes: Array.isArray(result.changes) ? result.changes : []
    }
    renderGuidedResult()
  } catch (error) {
    elements.guidedError.textContent =
      error instanceof Error ? error.message : "Guided request failed."
    elements.guidedError.classList.remove("hidden")
  } finally {
    elements.guidedSubmit.disabled = false
    elements.guidedSubmit.textContent = "Ask SimApply"
  }
}

function resetDemo() {
  state.sourceResumeText = ""
  state.editedResumeText = ""
  state.jobPosting = ""
  state.file = null
  state.insights = null
  state.guidedResult = null
  state.appliedSuggestionIds = new Set()
  elements.fileInput.value = ""
  elements.fileName.textContent = "Choose a PDF resume"
  elements.resumeText.value = ""
  elements.jobDescription.value = ""
  elements.editText.value = ""
  elements.guidedRequest.value = ""
  renderGuidedResult()
  elements.uploadView.classList.remove("hidden")
  elements.workspaceView.classList.add("hidden")
  updateContinueButton()
}

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.inputMode = button.dataset.mode
    renderMode()
  })
})

elements.fileInput.addEventListener("change", (event) => {
  state.file = event.target.files?.[0] || null
  elements.fileName.textContent = state.file
    ? state.file.name
    : "Choose a PDF resume"
  updateContinueButton()
})

elements.resumeText.addEventListener("input", updateContinueButton)
elements.jobDescription.addEventListener("input", () => {
  state.jobPosting = elements.jobDescription.value.trim()
})
elements.continueButton.addEventListener("click", handleContinue)
elements.startOver.addEventListener("click", resetDemo)

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.activeTab = button.dataset.tab
    renderTabs()
    if (state.activeTab === "preview") {
      renderPreview()
    }
  })
})

elements.editText.addEventListener("input", () => {
  state.editedResumeText = elements.editText.value
  renderPreview()
})

elements.toolbarButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyToolbarAction(button.dataset.format)
  })
})

elements.guidedSubmit.addEventListener("click", handleGuidedRequest)

elements.presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    elements.guidedRequest.value = button.dataset.request || ""
  })
})

renderMode()
renderTabs()
renderPreview()
