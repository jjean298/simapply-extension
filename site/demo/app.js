import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/legacy/build/pdf.min.mjs"

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.7.284/legacy/build/pdf.worker.min.mjs"

const API_BASE_URL = "https://simapply-relay.onrender.com"

const MARGIN_PRESETS = {
  narrow: { top: 36, right: 36, bottom: 36, left: 36 },
  normal: { top: 60, right: 60, bottom: 40, left: 60 },
  moderate: { top: 72, right: 72, bottom: 56, left: 72 },
  wide: { top: 90, right: 90, bottom: 72, left: 90 }
}

const COLOR_MAP = {
  black: "#0f1728",
  slate: "#475569",
  blue: "#2563eb",
  green: "#15803d",
  red: "#dc2626"
}

const FONT_MAP = {
  serif: '"Georgia", "Times New Roman", serif',
  sans: '"Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
  mono: '"SFMono-Regular", "Menlo", "Monaco", monospace'
}

const state = {
  inputMode: "upload",
  sourceResumeText: "",
  editedResumeText: "",
  jobPosting: "",
  file: null,
  insights: null,
  activeTab: "assistant",
  appliedSuggestionIds: new Set(),
  guidedResult: null,
  history: [""],
  historyIndex: 0,
  marginPreset: "normal"
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
  fontSelect: document.getElementById("font-select"),
  sizeSelect: document.getElementById("size-select"),
  colorSelect: document.getElementById("color-select"),
  marginSelect: document.getElementById("margin-select"),
  spacingSelect: document.getElementById("spacing-select"),
  bulletSelect: document.getElementById("bullet-select"),
  tabPanels: {
    assistant: document.getElementById("assistant-tab"),
    edit: document.getElementById("edit-tab"),
    preview: document.getElementById("preview-tab")
  },
  editText: document.getElementById("edit-text"),
  editorCanvas: document.getElementById("editor-canvas"),
  previewPaper: document.getElementById("preview-paper"),
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
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
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

function recordHistory(value) {
  const current = state.history[state.historyIndex]
  if (current === value) return
  state.history = state.history.slice(0, state.historyIndex + 1)
  state.history.push(value)
  state.historyIndex = state.history.length - 1
}

function setEditedText(nextText, options = {}) {
  const { preserveSelection = false, skipHistory = false } = options
  const textarea = elements.editText
  const start = textarea.selectionStart
  const end = textarea.selectionEnd

  state.editedResumeText = nextText
  textarea.value = nextText

  if (preserveSelection) {
    const safeStart = Math.min(start, nextText.length)
    const safeEnd = Math.min(end, nextText.length)
    textarea.setSelectionRange(safeStart, safeEnd)
  }

  renderPreview()

  if (!skipHistory) {
    recordHistory(nextText)
  }
}

function applyHistory(direction) {
  const nextIndex = state.historyIndex + direction
  if (nextIndex < 0 || nextIndex >= state.history.length) return
  state.historyIndex = nextIndex
  setEditedText(state.history[state.historyIndex], { skipHistory: true })
}

function updateMarginLayout() {
  const preset = MARGIN_PRESETS[state.marginPreset] || MARGIN_PRESETS.normal
  const paddingValue = `${preset.top}px ${preset.right}px ${preset.bottom}px ${preset.left}px`

  elements.editorCanvas.dataset.margin = state.marginPreset
  elements.previewPaper.dataset.margin = state.marginPreset
  elements.editorCanvas.style.padding = paddingValue
  elements.previewPaper.style.padding = paddingValue
  elements.marginSelect.value = state.marginPreset
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
  state.appliedSuggestionIds.add(item.id)
  setEditedText(lines.join("\n"))
  renderReviewList()
  state.activeTab = "edit"
  renderTabs()
}

function parseInlineSegments(text, inherited = {}) {
  const segments = []
  let remaining = text

  function append(items) {
    items.forEach((item) => {
      if (!item.text) return
      const last = segments[segments.length - 1]
      if (
        last &&
        last.bold === item.bold &&
        last.italic === item.italic &&
        last.underline === item.underline &&
        last.link === item.link &&
        last.align === item.align &&
        last.indent === item.indent &&
        last.color === item.color &&
        last.fontFamily === item.fontFamily &&
        last.fontSize === item.fontSize
      ) {
        last.text += item.text
      } else {
        segments.push(item)
      }
    })
  }

  while (remaining.length > 0) {
    const indentMatch = remaining.match(/^\[INDENT:(.+?)\]/)
    if (indentMatch) {
      append(parseInlineSegments(indentMatch[1], { ...inherited, indent: true }))
      remaining = remaining.slice(indentMatch[0].length)
      continue
    }

    const colorMatch = remaining.match(/^\[COLOR:([a-zA-Z0-9#-]+):(.+?)\]/)
    if (colorMatch) {
      append(parseInlineSegments(colorMatch[2], { ...inherited, color: colorMatch[1].trim() }))
      remaining = remaining.slice(colorMatch[0].length)
      continue
    }

    const fontMatch = remaining.match(/^\[FONT:(serif|sans|mono):(.+?)\]/)
    if (fontMatch) {
      append(parseInlineSegments(fontMatch[2], { ...inherited, fontFamily: fontMatch[1].trim() }))
      remaining = remaining.slice(fontMatch[0].length)
      continue
    }

    const sizeMatch = remaining.match(/^\[SIZE:([0-9.]+):(.+?)\]/)
    if (sizeMatch) {
      append(parseInlineSegments(sizeMatch[2], { ...inherited, fontSize: sizeMatch[1].trim() }))
      remaining = remaining.slice(sizeMatch[0].length)
      continue
    }

    const leftMatch = remaining.match(/^\[L:(.+?)\]/)
    if (leftMatch) {
      append(parseInlineSegments(leftMatch[1], { ...inherited, align: "left" }))
      remaining = remaining.slice(leftMatch[0].length)
      continue
    }

    const centerMatch = remaining.match(/^\[C:(.+?)\]/)
    if (centerMatch) {
      append(parseInlineSegments(centerMatch[1], { ...inherited, align: "center" }))
      remaining = remaining.slice(centerMatch[0].length)
      continue
    }

    const rightMatch = remaining.match(/^\[R:(.+?)\]/)
    if (rightMatch) {
      append(parseInlineSegments(rightMatch[1], { ...inherited, align: "right" }))
      remaining = remaining.slice(rightMatch[0].length)
      continue
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      append(parseInlineSegments(linkMatch[1], { ...inherited, link: linkMatch[2], underline: true }))
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/)
    if (boldItalicMatch) {
      append(parseInlineSegments(boldItalicMatch[1], { ...inherited, bold: true, italic: true }))
      remaining = remaining.slice(boldItalicMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      append(parseInlineSegments(boldMatch[1], { ...inherited, bold: true }))
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(/^\*([^*]+?)\*/)
    if (italicMatch) {
      append(parseInlineSegments(italicMatch[1], { ...inherited, italic: true }))
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const underlineMatch = remaining.match(/^__([\s\S]+?)__/)
    if (underlineMatch) {
      append(parseInlineSegments(underlineMatch[1], { ...inherited, underline: true }))
      remaining = remaining.slice(underlineMatch[0].length)
      continue
    }

    const nextMarker = remaining.search(/(\*\*\*|\*\*|\*|__|\[)/)
    if (nextMarker === -1) {
      append([{ text: remaining, ...inherited }])
      break
    }

    if (nextMarker > 0) {
      append([{ text: remaining.slice(0, nextMarker), ...inherited }])
      remaining = remaining.slice(nextMarker)
      continue
    }

    append([{ text: remaining[0], ...inherited }])
    remaining = remaining.slice(1)
  }

  return segments
}

function getLineMeta(line) {
  let workingLine = line.trim()
  let alignment = "left"
  let spacing = null

  const spacingMatch = workingLine.match(/^\[SPACING:([0-9.]+)\]/)
  if (spacingMatch) {
    spacing = spacingMatch[1]
    workingLine = workingLine.replace(/^\[SPACING:[^\]]+\]\s*/, "")
  }

  if (workingLine.startsWith("[CENTER]")) {
    alignment = "center"
    workingLine = workingLine.replace("[CENTER]", "").trim()
  } else if (workingLine.startsWith("[JUSTIFY]")) {
    alignment = "justify"
    workingLine = workingLine.replace("[JUSTIFY]", "").trim()
  }

  return { cleanedLine: workingLine, alignment, spacing }
}

function renderSegments(segments) {
  return segments
    .map((segment) => {
      const styles = []

      if (segment.color) {
        styles.push(`color:${COLOR_MAP[segment.color] || segment.color}`)
      }
      if (segment.fontFamily) {
        styles.push(`font-family:${FONT_MAP[segment.fontFamily] || FONT_MAP.sans}`)
      }
      if (segment.fontSize) {
        styles.push(`font-size:${segment.fontSize}pt`)
      }
      if (segment.indent) {
        styles.push("padding-left:2rem;display:inline-block")
      }

      const styleAttr = styles.length ? ` style="${styles.join(";")}"` : ""
      let content = escapeHtml(segment.text)

      if (segment.link) {
        content = `<a href="${escapeHtml(segment.link)}" target="_blank" rel="noreferrer">${content}</a>`
      }
      if (segment.underline) content = `<u>${content}</u>`
      if (segment.italic) content = `<em>${content}</em>`
      if (segment.bold) content = `<strong>${content}</strong>`

      return `<span${styleAttr}>${content}</span>`
    })
    .join("")
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
    if (!line.trim()) {
      flushList()
      return
    }

    const { cleanedLine, alignment, spacing } = getLineMeta(line)
    const bulletMatch = cleanedLine.match(/^([•●⬤▸★✓■◆-])\s*/)
    const bulletValue = bulletMatch?.[1] || null
    const lineContent = bulletValue
      ? cleanedLine.replace(/^([•●⬤▸★✓■◆-])\s*/, "")
      : cleanedLine
    const segments = parseInlineSegments(lineContent)
    const segmentAlignment =
      segments.find((segment) => segment.align)?.align || alignment
    const rendered = renderSegments(segments)

    const styleAttr = spacing ? ` style="line-height:${spacing}"` : ""
    const className =
      segmentAlignment === "center"
        ? "preview-centered"
        : segmentAlignment === "right"
          ? "preview-right"
          : segmentAlignment === "justify"
            ? "preview-justify"
            : "preview-left"

    if (bulletValue) {
      currentList.push(`<li${styleAttr}>${rendered}</li>`)
      return
    }

    flushList()
    parts.push(`<p class="${className}"${styleAttr}>${rendered}</p>`)
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
  setEditedText(textarea.value, { preserveSelection: true })
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
  setEditedText(textarea.value, { preserveSelection: true })
}

function applyLineWrapper(prefix, suffix = "]") {
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
    .map((line) => {
      if (!line.trim()) return line
      return `${prefix}${line}${suffix}`
    })
    .join("\n")

  textarea.setRangeText(nextBlock, lineStart, sliceEnd, "select")
  setEditedText(textarea.value, { preserveSelection: true })
}

function applyStyleSelection(tag, value) {
  const textarea = elements.editText
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  if (start === end) return

  const selected = textarea.value.slice(start, end)
  const replacement = selected
    .split("\n")
    .map((line) => (line.trim() ? `[${tag}:${value}:${line}]` : line))
    .join("\n")

  textarea.setRangeText(replacement, start, end, "select")
  setEditedText(textarea.value, { preserveSelection: true })
}

function applyToolbarAction(format, value = "") {
  elements.editText.focus()

  if (format === "undo") {
    applyHistory(-1)
    return
  }

  if (format === "redo") {
    applyHistory(1)
    return
  }

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
    setEditedText(textarea.value, { preserveSelection: true })
    return
  }

  if (format === "left") {
    applyLineWrapper("[L:")
    return
  }

  if (format === "center") {
    applyLineWrapper("[C:")
    return
  }

  if (format === "right") {
    applyLineWrapper("[R:")
    return
  }

  if (format === "justify") {
    applyLinePrefix("[JUSTIFY] ")
    return
  }

  if (format === "indent") {
    applyLineWrapper("[INDENT:")
    return
  }

  if (format === "font" && value) {
    applyStyleSelection("FONT", value)
    return
  }

  if (format === "size" && value) {
    applyStyleSelection("SIZE", value)
    return
  }

  if (format === "color" && value) {
    applyStyleSelection("COLOR", value)
    return
  }

  if (format === "spacing" && value) {
    applyLinePrefix(`[SPACING:${value}] `)
    return
  }

  if (format === "bullet") {
    applyLinePrefix(`${value || "•"} `)
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
            <p>${escapeHtml(suggestedResumeText).replace(/\n/g, "<br />")}</p>
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
      setEditedText(suggestedResumeText || "")
      state.activeTab = "edit"
      renderTabs()
    })
  }
}

async function handleLineRewrite(item) {
  const button = document.querySelector(`[data-rewrite-id="${item.id}"]`)

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
  }
}

function renderReviewList() {
  const items = state.insights?.reviewItems || []

  if (!items.length) {
    elements.reviewList.innerHTML =
      `<div class="review-card warn"><p class="review-reason">No review items yet. Upload a resume and continue to run AI analysis.</p></div>`
    return
  }

  elements.reviewList.innerHTML = items
    .map((item) => {
      const typeLabel = getReviewTypeLabel(item.type)
      const suggestionBlock =
        item.type !== "good" && item.suggestedText
          ? `<p class="review-suggestion"><strong>Suggested fix:</strong> ${escapeHtml(item.suggestedText)}</p>`
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
  elements.matchSummary.textContent =
    "Running AI analysis against the current resume and job description."
  elements.matchTonePill.textContent = "Loading"
  elements.matchTonePill.className = "tone-pill tone-medium"
  elements.reviewList.innerHTML =
    `<div class="review-card warn"><p class="review-reason">Reviewing the resume...</p></div>`

  try {
    const result = await fetchJson("/analyze", {
      resumeText: state.sourceResumeText,
      jobPosting: state.jobPosting
    })

    state.insights = result.insights
    renderInsights()
  } catch (error) {
    elements.reviewList.innerHTML =
      `<div class="review-card fix"><p class="review-reason">${escapeHtml(
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
    state.history = [state.editedResumeText]
    state.historyIndex = 0
    renderPreview()
    elements.uploadView.classList.add("hidden")
    elements.workspaceView.classList.remove("hidden")
    await runAnalysis()
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "We could not prepare the workspace."
    const isPdfUploadIssue = state.inputMode === "upload"

    alert(
      isPdfUploadIssue
        ? `We couldn't extract that PDF in the browser demo. Try the Paste Resume tab instead, or use a different PDF file.\n\nTechnical detail: ${message}`
        : message
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
  state.history = [""]
  state.historyIndex = 0
  state.marginPreset = "normal"
  elements.fileInput.value = ""
  elements.fileName.textContent = "Choose a PDF resume"
  elements.resumeText.value = ""
  elements.jobDescription.value = ""
  elements.editText.value = ""
  elements.guidedRequest.value = ""
  elements.fontSelect.value = ""
  elements.sizeSelect.value = ""
  elements.colorSelect.value = ""
  elements.marginSelect.value = "normal"
  elements.spacingSelect.value = ""
  elements.bulletSelect.value = ""
  renderGuidedResult()
  updateMarginLayout()
  renderPreview()
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
  elements.fileName.textContent = state.file ? state.file.name : "Choose a PDF resume"
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
  setEditedText(elements.editText.value)
})

elements.toolbarButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyToolbarAction(button.dataset.format)
  })
})

elements.fontSelect.addEventListener("change", () => {
  if (!elements.fontSelect.value) return
  applyToolbarAction("font", elements.fontSelect.value)
  elements.fontSelect.value = ""
})

elements.sizeSelect.addEventListener("change", () => {
  if (!elements.sizeSelect.value) return
  applyToolbarAction("size", elements.sizeSelect.value)
  elements.sizeSelect.value = ""
})

elements.colorSelect.addEventListener("change", () => {
  if (!elements.colorSelect.value) return
  applyToolbarAction("color", elements.colorSelect.value)
  elements.colorSelect.value = ""
})

elements.marginSelect.addEventListener("change", () => {
  state.marginPreset = elements.marginSelect.value || "normal"
  updateMarginLayout()
})

elements.spacingSelect.addEventListener("change", () => {
  if (!elements.spacingSelect.value) return
  applyToolbarAction("spacing", elements.spacingSelect.value)
  elements.spacingSelect.value = ""
})

elements.bulletSelect.addEventListener("change", () => {
  if (!elements.bulletSelect.value) return
  applyToolbarAction("bullet", elements.bulletSelect.value)
  elements.bulletSelect.value = ""
})

elements.guidedSubmit.addEventListener("click", handleGuidedRequest)

elements.presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    elements.guidedRequest.value = button.dataset.request || ""
  })
})

renderMode()
renderTabs()
updateMarginLayout()
renderPreview()
