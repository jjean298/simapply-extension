import http from "node:http"
import { loadEnvFile } from "./load-env.mjs"

loadEnvFile()

const PORT = Number(process.env.PORT || 8787)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5"

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  })
  response.end(JSON.stringify(payload))
}

function extractJsonObject(text) {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object")
  }

  return JSON.parse(text.slice(start, end + 1))
}

function validateInsightsShape(candidate) {
  if (!candidate || typeof candidate !== "object") {
    throw new Error("AI response was not an object")
  }

  const normalized = {
    matchSummary:
      typeof candidate.matchSummary === "string"
        ? candidate.matchSummary
        : "AI analysis is ready.",
    matchLabel:
      typeof candidate.matchLabel === "string"
        ? candidate.matchLabel
        : "AI Review",
    matchTone:
      candidate.matchTone === "good" ||
      candidate.matchTone === "medium" ||
      candidate.matchTone === "low"
        ? candidate.matchTone
        : "medium",
    agentPlan: Array.isArray(candidate.agentPlan)
      ? candidate.agentPlan
          .filter((value) => typeof value === "string" && value.trim())
          .slice(0, 5)
      : [],
    missingKeywords: Array.isArray(candidate.missingKeywords)
      ? candidate.missingKeywords
          .filter((value) => typeof value === "string" && value.trim())
          .slice(0, 8)
      : [],
    reviewItems: Array.isArray(candidate.reviewItems)
      ? candidate.reviewItems
          .filter((item) => item && typeof item === "object")
          .map((item, index) => ({
            id:
              typeof item.id === "string" && item.id.trim()
                ? item.id
                : `review-${index}`,
            type:
              item.type === "good"
                ? "good"
                : item.type === "warn"
                  ? "warn"
                  : "fix",
            priority:
              item.priority === "high" ||
              item.priority === "medium" ||
              item.priority === "low"
                ? item.priority
                : item.type === "good"
                  ? "low"
                  : item.type === "warn"
                    ? "medium"
                  : "medium",
            section: typeof item.section === "string" ? item.section : undefined,
            clarificationOptions: Array.isArray(item.clarificationOptions)
              ? item.clarificationOptions
                  .filter((value) => typeof value === "string" && value.trim())
                  .slice(0, 8)
              : [],
            originalText:
              typeof item.originalText === "string" ? item.originalText : "",
            suggestedText:
              typeof item.suggestedText === "string"
                ? item.suggestedText
                : undefined,
            reason: typeof item.reason === "string" ? item.reason : "",
            highlightText:
              typeof item.highlightText === "string"
                ? item.highlightText
                : undefined,
            replacementText:
              typeof item.replacementText === "string"
                ? item.replacementText
                : undefined,
            hoverTitle:
              typeof item.hoverTitle === "string" ? item.hoverTitle : undefined
          }))
          .filter((item) => item.originalText.trim() && item.reason.trim())
          .slice(0, 80)
      : []
  }

  return normalized
}

async function callOpenAI({ resumeText, jobPosting }) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY on the relay server")
  }

  const resumeLines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 160)

  const instructions = [
    "You are reviewing a resume for a Chrome extension called SimApply.",
    "Return ONLY valid JSON matching the requested shape.",
    "Evaluate the resume against the job description when provided.",
    "Behave like a resume tailoring agent, not a chatbot.",
    "Use type \"good\" for strong lines, type \"warn\" for lines that are acceptable but could be stronger, and type \"fix\" for lines that need clear improvement.",
    "Set priority to high, medium, or low for each review item.",
    "Set section to the most relevant resume section name like Summary, Experience, Education, Skills, Projects, or Header when possible.",
    "Each reviewItems.originalText MUST exactly match one full line from the provided resume lines.",
    "Only include review items for lines that are actually present in the resume lines list.",
    "Nearly every meaningful non-empty resume line should receive a review item unless it is purely decorative or redundant.",
    "For fix items, suggestedText should be a polished replacement for the full line.",
    "For fix items, clarificationOptions should be 3 to 8 short selectable details the user might confirm, like email support, phone support, live chat, ticketing, Zendesk, Salesforce, escalations, follow-up, documentation, or CRM.",
    "highlightText should be the exact weak word or phrase to highlight when useful.",
    "replacementText should be a stronger alternative for that weak word or phrase when useful.",
    "hoverTitle should be short and clear.",
    "missingKeywords should be short phrases from the job description that are absent or underrepresented.",
    "agentPlan should be a short list of concrete next steps the user should take, in priority order.",
    "Keep reviewItems focused and practical. Prefer 14 to 28 items total.",
    "When a job description is provided, include multiple fix items unless the resume line is already clearly strong and directly aligned.",
    "Do not return only positive feedback when there are obvious missing keywords, weak bullets, or unclear responsibilities.",
    "Aim for a balanced review across the resume. If a line is not a clear fix and not a clear strength, mark it as warn with a helpful explanation."
  ].join(" ")

  const schemaHint = {
    matchSummary: "string",
    matchLabel: "string",
    matchTone: "good | medium | low",
    agentPlan: ["string"],
    missingKeywords: ["string"],
    reviewItems: [
      {
        id: "string",
        type: "good | warn | fix",
        priority: "high | medium | low",
        section: "string or omitted",
        clarificationOptions: ["string"],
        originalText: "exact resume line",
        suggestedText: "string or omitted",
        reason: "string",
        highlightText: "string or omitted",
        replacementText: "string or omitted",
        hoverTitle: "string or omitted"
      }
    ]
  }

  const input = [
    {
      role: "system",
      content: instructions
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          jobPosting: jobPosting || "",
          resumeLines,
          outputSchema: schemaHint
        },
        null,
        2
      )
    }
  ]

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input,
      max_output_tokens: 2500
    })
  })

  if (!openAiResponse.ok) {
    const failureText = await openAiResponse.text()
    throw new Error(`OpenAI request failed: ${openAiResponse.status} ${failureText}`)
  }

  const payload = await openAiResponse.json()
  const outputText =
    typeof payload.output_text === "string" && payload.output_text.trim()
      ? payload.output_text
      : Array.isArray(payload.output)
        ? payload.output
            .flatMap((entry) => entry.content || [])
            .map((content) => content.text || "")
            .join("\n")
        : ""

  const parsed = extractJsonObject(outputText)
  return validateInsightsShape(parsed)
}

async function rewriteResumeLine({
  originalLine,
  currentSuggestion,
  jobPosting,
  selectedDetails,
  section
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY on the relay server")
  }

  const input = [
    {
      role: "system",
      content: [
        "You rewrite a single resume line for SimApply.",
        "Return ONLY valid JSON.",
        "Use the selected details to improve the line, but do not invent experience beyond those selected details.",
        "Keep the result concise, strong, and realistic for a resume.",
        "Preserve bullet formatting if the original line is a bullet."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          originalLine,
          currentSuggestion: currentSuggestion || "",
          jobPosting: jobPosting || "",
          section: section || "",
          selectedDetails,
          outputSchema: {
            rewrittenLine: "string",
            explanation: "string"
          }
        },
        null,
        2
      )
    }
  ]

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input,
      max_output_tokens: 700
    })
  })

  if (!openAiResponse.ok) {
    const failureText = await openAiResponse.text()
    throw new Error(`OpenAI request failed: ${openAiResponse.status} ${failureText}`)
  }

  const payload = await openAiResponse.json()
  const outputText =
    typeof payload.output_text === "string" && payload.output_text.trim()
      ? payload.output_text
      : Array.isArray(payload.output)
        ? payload.output
            .flatMap((entry) => entry.content || [])
            .map((content) => content.text || "")
            .join("\n")
        : ""

  const parsed = extractJsonObject(outputText)

  return {
    rewrittenLine:
      typeof parsed.rewrittenLine === "string" && parsed.rewrittenLine.trim()
        ? parsed.rewrittenLine
        : originalLine,
    explanation:
      typeof parsed.explanation === "string" && parsed.explanation.trim()
        ? parsed.explanation
        : "Updated using the selected missing details."
  }
}

async function respondToGuidedRequest({
  resumeText,
  jobPosting,
  request
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY on the relay server")
  }

  const input = [
    {
      role: "system",
      content: [
        "You are SimApply, an AI resume tailoring assistant.",
        "Answer a focused resume-improvement request and produce a true rewritten draft.",
        "Return ONLY valid JSON.",
        "Be concise, specific, and practical.",
        "Do not behave like a generic chatbot.",
        "If the request asks for emphasis, explain what should be emphasized and suggest concrete phrasing or missing proof points.",
        "If the request asks for ATS improvements, mention keywords, phrasing, or clarity improvements grounded in the provided resume and job description.",
        "Also return a suggestedResumeText field containing a full revised resume draft that preserves the existing overall structure and sections as much as possible.",
        "Do not invent new experience. You may only strengthen wording, surface clearer proof points, and improve alignment to the request.",
        "The suggestedResumeText must be an actual rewritten version of the provided resume, not the original text copied back unchanged, unless there is truly nothing to improve.",
        "If the user asks to rewrite the resume for a role, tailor multiple relevant lines across the document so the draft is visibly different and more aligned.",
        "Return a changes array with 3 to 8 concrete before and after edits, plus a short reason for each change."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          request,
          jobPosting: jobPosting || "",
          resumeText,
          outputSchema: {
            responseText: "string",
            suggestedResumeText: "string",
            changes: [
              {
                before: "string",
                after: "string",
                reason: "string"
              }
            ]
          }
        },
        null,
        2
      )
    }
  ]

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input,
      max_output_tokens: 2200
    })
  })

  if (!openAiResponse.ok) {
    const failureText = await openAiResponse.text()
    throw new Error(`OpenAI request failed: ${openAiResponse.status} ${failureText}`)
  }

  const payload = await openAiResponse.json()
  const outputText =
    typeof payload.output_text === "string" && payload.output_text.trim()
      ? payload.output_text
      : Array.isArray(payload.output)
        ? payload.output
            .flatMap((entry) => entry.content || [])
            .map((content) => content.text || "")
            .join("\n")
        : ""

  const parsed = extractJsonObject(outputText)

  return {
    responseText:
      typeof parsed.responseText === "string" && parsed.responseText.trim()
        ? parsed.responseText
        : "No guided response was generated.",
    suggestedResumeText:
      typeof parsed.suggestedResumeText === "string" &&
      parsed.suggestedResumeText.trim()
        ? parsed.suggestedResumeText
        : resumeText,
    changes: Array.isArray(parsed.changes)
      ? parsed.changes
          .filter((value) => value && typeof value === "object")
          .map((value) => ({
            before: typeof value.before === "string" ? value.before : "",
            after: typeof value.after === "string" ? value.after : "",
            reason: typeof value.reason === "string" ? value.reason : ""
          }))
          .filter((value) => value.before.trim() && value.after.trim())
          .slice(0, 8)
      : []
  }
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 404, { error: "Not found" })
    return
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    })
    response.end()
    return
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "simapply-relay"
    })
    return
  }

  if (
    request.method !== "POST" ||
    !["/analyze", "/rewrite-line", "/guided-request"].includes(request.url)
  ) {
    sendJson(response, 404, { error: "Not found" })
    return
  }

  try {
    const chunks = []

    for await (const chunk of request) {
      chunks.push(chunk)
    }

    const rawBody = Buffer.concat(chunks).toString("utf8")
    const body = rawBody ? JSON.parse(rawBody) : {}

    if (request.url === "/analyze") {
      const resumeText =
        typeof body.resumeText === "string" ? body.resumeText.trim() : ""
      const jobPosting =
        typeof body.jobPosting === "string" ? body.jobPosting.trim() : ""

      if (!resumeText) {
        sendJson(response, 400, { error: "resumeText is required" })
        return
      }

      const insights = await callOpenAI({ resumeText, jobPosting })
      sendJson(response, 200, { insights })
      return
    }

    if (request.url === "/guided-request") {
      const resumeText =
        typeof body.resumeText === "string" ? body.resumeText.trim() : ""
      const jobPosting =
        typeof body.jobPosting === "string" ? body.jobPosting.trim() : ""
      const guidedRequest =
        typeof body.request === "string" ? body.request.trim() : ""

      if (!resumeText) {
        sendJson(response, 400, { error: "resumeText is required" })
        return
      }

      if (!guidedRequest) {
        sendJson(response, 400, { error: "request is required" })
        return
      }

      const result = await respondToGuidedRequest({
        resumeText,
        jobPosting,
        request: guidedRequest
      })
      sendJson(response, 200, result)
      return
    }

    const originalLine =
      typeof body.originalLine === "string" ? body.originalLine.trim() : ""
    const currentSuggestion =
      typeof body.currentSuggestion === "string"
        ? body.currentSuggestion.trim()
        : ""
    const jobPosting =
      typeof body.jobPosting === "string" ? body.jobPosting.trim() : ""
    const section =
      typeof body.section === "string" ? body.section.trim() : ""
    const selectedDetails = Array.isArray(body.selectedDetails)
      ? body.selectedDetails.filter(
          (value) => typeof value === "string" && value.trim()
        )
      : []

    if (!originalLine) {
      sendJson(response, 400, { error: "originalLine is required" })
      return
    }

    const rewrite = await rewriteResumeLine({
      originalLine,
      currentSuggestion,
      jobPosting,
      selectedDetails,
      section
    })
    sendJson(response, 200, rewrite)
  } catch (error) {
    console.error("[SimApply Relay] Analysis failed", error)
    sendJson(response, 500, {
      error:
        error instanceof Error ? error.message : "Unknown analysis error"
    })
  }
})

server.listen(PORT, () => {
  console.log(`[SimApply Relay] listening on http://localhost:${PORT}`)
})
