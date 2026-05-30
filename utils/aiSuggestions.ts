export interface ResumeReviewItem {
  id: string
  type: "good" | "warn" | "fix"
  priority?: "high" | "medium" | "low"
  section?: string
  clarificationOptions?: string[]
  originalText: string
  suggestedText?: string
  reason: string
  highlightText?: string
  replacementText?: string
  hoverTitle?: string
}

export interface ResumeInsights {
  matchSummary: string
  matchLabel: string
  matchTone: "good" | "medium" | "low"
  agentPlan: string[]
  missingKeywords: string[]
  reviewItems: ResumeReviewItem[]
}

export const EMPTY_RESUME_INSIGHTS: ResumeInsights = {
  matchSummary: "AI analysis will appear here once your resume is reviewed.",
  matchLabel: "Waiting",
  matchTone: "medium",
  agentPlan: [],
  missingKeywords: [],
  reviewItems: []
}

export function normalizeResumeInsights(value: unknown): ResumeInsights {
  if (!value || typeof value !== "object") {
    return EMPTY_RESUME_INSIGHTS
  }

  const candidate = value as Partial<ResumeInsights> & {
    reviewItems?: Array<Partial<ResumeReviewItem>>
  }

  return {
    matchSummary:
      typeof candidate.matchSummary === "string"
        ? candidate.matchSummary
        : EMPTY_RESUME_INSIGHTS.matchSummary,
    matchLabel:
      typeof candidate.matchLabel === "string"
        ? candidate.matchLabel
        : EMPTY_RESUME_INSIGHTS.matchLabel,
    matchTone:
      candidate.matchTone === "good" ||
      candidate.matchTone === "medium" ||
      candidate.matchTone === "low"
        ? candidate.matchTone
        : EMPTY_RESUME_INSIGHTS.matchTone,
    agentPlan: Array.isArray(candidate.agentPlan)
      ? candidate.agentPlan.filter(
          (step): step is string => typeof step === "string" && step.trim().length > 0
        )
      : [],
    missingKeywords: Array.isArray(candidate.missingKeywords)
      ? candidate.missingKeywords.filter(
          (keyword): keyword is string =>
            typeof keyword === "string" && keyword.trim().length > 0
        )
      : [],
    reviewItems: Array.isArray(candidate.reviewItems)
      ? candidate.reviewItems
          .filter((item) => item && typeof item === "object")
          .map(
            (item, index): ResumeReviewItem => ({
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
                  : undefined,
              section:
                typeof item.section === "string" && item.section.trim()
                  ? item.section
                  : undefined,
              clarificationOptions: Array.isArray(item.clarificationOptions)
                ? item.clarificationOptions.filter(
                    (option): option is string =>
                      typeof option === "string" &&
                      option.trim().length > 0
                  )
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
                typeof item.hoverTitle === "string"
                  ? item.hoverTitle
                  : undefined
            })
          )
          .filter((item) => item.originalText.trim() && item.reason.trim())
      : []
  }
}

const STOP_WORDS = new Set([
  "about",
  "across",
  "also",
  "among",
  "and",
  "are",
  "been",
  "being",
  "build",
  "built",
  "can",
  "company",
  "customers",
  "deliver",
  "delivering",
  "experience",
  "from",
  "have",
  "help",
  "highly",
  "into",
  "looking",
  "must",
  "need",
  "our",
  "role",
  "team",
  "that",
  "the",
  "their",
  "them",
  "they",
  "this",
  "using",
  "with",
  "work",
  "works",
  "your"
])

const KNOWN_KEY_PHRASES = [
  "customer support",
  "technical support",
  "stakeholder communication",
  "cross-functional collaboration",
  "cross functional collaboration",
  "project coordination",
  "issue resolution",
  "troubleshooting",
  "documentation",
  "process improvement",
  "customer experience",
  "crm",
  "saas",
  "apis",
  "sql",
  "salesforce",
  "zendesk",
  "jira",
  "ios",
  "windows",
  "macos",
  "web environments"
]

const STRONG_ACTION_VERBS = [
  "led",
  "built",
  "launched",
  "resolved",
  "improved",
  "reduced",
  "increased",
  "supported",
  "managed",
  "implemented",
  "created",
  "delivered",
  "optimized",
  "designed"
]

const WEAK_BULLET_PATTERNS = [
  /^worked on\b/i,
  /^helped\b/i,
  /^responsible for\b/i,
  /^assisted\b/i,
  /^tasked with\b/i,
  /^involved in\b/i
]

const WEAK_WORD_REPLACEMENTS: Array<{
  pattern: RegExp
  target: string
  replacement: string
}> = [
  { pattern: /^worked on\b/i, target: "worked on", replacement: "built" },
  { pattern: /^helped\b/i, target: "helped", replacement: "supported" },
  {
    pattern: /^responsible for\b/i,
    target: "responsible for",
    replacement: "led"
  },
  { pattern: /^assisted\b/i, target: "assisted", replacement: "resolved" },
  { pattern: /^tasked with\b/i, target: "tasked with", replacement: "owned" },
  {
    pattern: /^involved in\b/i,
    target: "involved in",
    replacement: "delivered"
  }
]

const SECTION_HEADINGS = new Set([
  "summary",
  "professional summary",
  "experience",
  "work experience",
  "education",
  "skills",
  "technical skills",
  "projects",
  "certifications",
  "leadership",
  "activities",
  "awards"
])

type ResumeSectionKey =
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "other"

function stripFormatting(text: string) {
  return text
    .replace(/\[CENTER\]|\[JUSTIFY\]/g, "")
    .replace(/\[SPACING:[^\]]+\]/g, "")
    .replace(/\[INDENT:([^\]]+)\]/g, "$1")
    .replace(/\[(L|C|R):([^\]]+)\]/g, "$2")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeText(text: string) {
  return stripFormatting(text).toLowerCase()
}

function extractKeywords(jobPosting: string) {
  const normalized = normalizeText(jobPosting)
  const phraseMatches = KNOWN_KEY_PHRASES.filter((phrase) =>
    normalized.includes(phrase)
  )

  const words = normalized.match(/[a-z][a-z0-9+-]{2,}/g) || []
  const tokens = words.filter((word) => !STOP_WORDS.has(word))
  const uniqueTokens = Array.from(new Set(tokens))

  return {
    phrases: phraseMatches,
    tokens: uniqueTokens.slice(0, 30)
  }
}

function scoreMatch(resumeText: string, jobPosting: string) {
  const resumeLower = normalizeText(resumeText)
  const { phrases, tokens } = extractKeywords(jobPosting)
  const sourceKeywords = [...phrases, ...tokens]

  if (!sourceKeywords.length) {
    return {
      ratio: 0,
      present: [] as string[],
      missing: [] as string[]
    }
  }

  const present = sourceKeywords.filter((keyword) => resumeLower.includes(keyword))
  const missing = sourceKeywords.filter((keyword) => !resumeLower.includes(keyword))
  const ratio = present.length / sourceKeywords.length

  return { ratio, present, missing }
}

function getMatchCopy(ratio: number, hasJobPosting: boolean) {
  if (!hasJobPosting) {
    return {
      label: "Resume Ready",
      tone: "medium" as const,
      summary:
        "Your resume is ready for review. Add a job description to get more targeted red and green feedback across the page."
    }
  }

  if (ratio >= 0.55) {
    return {
      label: "Good Match",
      tone: "good" as const,
      summary:
        "The resume already aligns well with the role. Green highlights show where your content is strong, and red highlights point to the most useful improvements."
    }
  }

  if (ratio >= 0.3) {
    return {
      label: "Partial Match",
      tone: "medium" as const,
      summary:
        "There is a solid base here, but several bullets could better reflect the job description language and show more impact."
    }
  }

  return {
    label: "Needs Tailoring",
    tone: "low" as const,
    summary:
      "The current resume needs stronger alignment with the job description. Focus on the red highlights first to make the fit clearer."
  }
}

function hasMetric(text: string) {
  return /(\d+%?)|(\$[\d,]+)|(\d+\+)|(daily|weekly|monthly|annually)/i.test(text)
}

function startsWithStrongVerb(text: string) {
  return STRONG_ACTION_VERBS.some((verb) =>
    normalizeText(text).startsWith(verb)
  )
}

function getWeakWordSuggestion(text: string) {
  const cleanText = stripFormatting(text).replace(/^[•\-]\s*/, "").trim()

  return (
    WEAK_WORD_REPLACEMENTS.find(({ pattern }) => pattern.test(cleanText)) || null
  )
}

function isSectionHeading(text: string) {
  const cleanText = stripFormatting(text)
    .replace(/[:\-]+$/, "")
    .toLowerCase()
    .trim()

  return SECTION_HEADINGS.has(cleanText)
}

function isContactLine(text: string) {
  return (
    /@/.test(text) ||
    /linkedin\.com|github\.com|portfolio|www\./i.test(text) ||
    /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)
  )
}

function getSectionKey(text: string): ResumeSectionKey | null {
  const cleanText = stripFormatting(text)
    .replace(/[:\-]+$/, "")
    .toLowerCase()
    .trim()

  if (
    cleanText === "summary" ||
    cleanText === "professional summary"
  ) {
    return "summary"
  }

  if (cleanText === "experience" || cleanText === "work experience") {
    return "experience"
  }

  if (cleanText === "education") {
    return "education"
  }

  if (cleanText === "skills" || cleanText === "technical skills") {
    return "skills"
  }

  if (cleanText === "projects") {
    return "projects"
  }

  return isSectionHeading(text) ? "other" : null
}

function getSectionFromLine(
  text: string,
  currentSection: ResumeSectionKey | null
) {
  return getSectionKey(text) || currentSection || "other"
}

function isReviewableContentLine(
  text: string,
  currentSection: ResumeSectionKey | null
) {
  const trimmed = stripFormatting(text)
  if (!trimmed) return false
  if (isSectionHeading(trimmed) || isContactLine(trimmed)) return false
  if (!currentSection) return false

  const isBullet = /^[•\-]/.test(trimmed)
  if (isBullet) return true

  if (currentSection === "skills") {
    return trimmed.length > 8
  }

  if (currentSection === "education") {
    return (
      trimmed.length > 10 &&
      /university|college|b\.s|bachelor|master|gpa|expected|graduation|course/i.test(
        trimmed
      )
    )
  }

  return trimmed.length > 18
}

function buildKeywordHint(missingKeywords: string[]) {
  const keywords = missingKeywords.slice(0, 2)
  if (!keywords.length) return ""
  if (keywords.length === 1) {
    return ` Consider weaving in ${keywords[0]}.`
  }

  return ` Consider weaving in ${keywords[0]} or ${keywords[1]}.`
}

function buildImprovedBullet(
  bullet: string,
  missingKeywords: string[],
  jobPosting: string
) {
  const cleanBullet = stripFormatting(bullet).replace(/^[•\-]\s*/, "")
  const jobLower = normalizeText(jobPosting)
  const selectedKeywords = missingKeywords.slice(0, 2)

  if (
    jobLower.includes("support") ||
    jobLower.includes("technical") ||
    jobLower.includes("troubleshoot")
  ) {
    return `Resolved user issues across Windows, iOS, and web environments while maintaining clear communication and reliable follow-through.`
  }

  if (selectedKeywords.length > 0) {
    return `Improved ${cleanBullet.toLowerCase()} by emphasizing ${selectedKeywords.join(
      " and "
    )} with clearer ownership and impact.`
  }

  return `Improved ${cleanBullet.toLowerCase()} by making the result, ownership, and collaboration more explicit.`
}

function buildImprovedLine(
  line: string,
  section: ResumeSectionKey,
  missingKeywords: string[],
  jobPosting: string
) {
  const cleanLine = stripFormatting(line).replace(/^[•\-]\s*/, "").trim()
  const keywordHint = missingKeywords[0]

  if (section === "skills") {
    const baseSkills = cleanLine
      .split(/[•,|]/)
      .map((value) => value.trim())
      .filter(Boolean)

    const suggestedSkills = Array.from(
      new Set(
        [
          ...baseSkills,
          keywordHint === "customer support" ? "Customer Support" : null,
          keywordHint === "troubleshooting" ? "Troubleshooting" : null,
          keywordHint === "documentation" ? "Documentation" : null,
          keywordHint === "crm" ? "CRM" : null
        ].filter(Boolean)
      )
    ) as string[]

    return suggestedSkills.slice(0, 8).join(" • ")
  }

  if (section === "education") {
    return `${cleanLine} - Highlight any coursework, tools, or training that directly supports this role.`
  }

  if (
    jobPosting.toLowerCase().includes("support") ||
    jobPosting.toLowerCase().includes("customer")
  ) {
    return `Tailor this line to emphasize customer support impact, communication, and problem-solving in a fast-paced environment.`
  }

  if (keywordHint) {
    return `Tailor this line to connect more clearly to ${keywordHint}.`
  }

  return `Rewrite this line with stronger specificity, clearer ownership, or more relevant tools and outcomes.`
}

function buildReviewItems(
  resumeText: string,
  jobPosting: string,
  missingKeywords: string[]
) {
  const lines = resumeText.split("\n")
  const reviewItems: ResumeReviewItem[] = []
  let currentSection: ResumeSectionKey | null = null

  lines.forEach((line, index) => {
    const trimmed = stripFormatting(line)
    if (!trimmed) return

    const sectionKey = getSectionKey(trimmed)
    if (sectionKey) {
      currentSection = sectionKey
      return
    }

    if (!isReviewableContentLine(trimmed, currentSection)) return

    const normalized = normalizeText(trimmed)
    const isBullet = /^[•\-]/.test(trimmed)
    const matchedKeywords = missingKeywords.filter((keyword) =>
      normalized.includes(keyword)
    )
    const section = getSectionFromLine(trimmed, currentSection)

    if (isBullet) {
      const weakPattern = WEAK_BULLET_PATTERNS.some((pattern) =>
        pattern.test(trimmed.replace(/^[•\-]\s*/, ""))
      )
      const strong = hasMetric(trimmed) || startsWithStrongVerb(trimmed)
      const weakWordSuggestion = getWeakWordSuggestion(trimmed)

      if (strong && !weakPattern) {
        reviewItems.push({
          id: `good-${index}`,
          type: "good",
          section,
          originalText: line,
          hoverTitle: hasMetric(trimmed)
            ? "Strong impact language"
            : "Strong action verb",
          reason: hasMetric(trimmed)
            ? "Strong impact language. This bullet already shows measurable value."
            : "Strong action-oriented wording. This reads clearly and confidently."
        })
        return
      }

      if (!weakPattern && !strong) {
        reviewItems.push({
          id: `warn-${index}`,
          type: "warn",
          section,
          originalText: line,
          hoverTitle: "Could be sharper",
          reason:
            `This bullet is relevant, but it would be stronger with clearer impact, more specific tools, or more measurable outcomes.${buildKeywordHint(missingKeywords)}`,
          suggestedText: `• ${buildImprovedBullet(trimmed, missingKeywords, jobPosting)}`
        })
        return
      }

        reviewItems.push({
          id: `fix-${index}`,
          type: "fix",
          section,
          originalText: line,
          suggestedText: `• ${buildImprovedBullet(trimmed, missingKeywords, jobPosting)}`,
          highlightText: weakWordSuggestion?.target,
          replacementText: weakWordSuggestion?.replacement,
          hoverTitle: weakWordSuggestion
            ? `Replace "${weakWordSuggestion.target}"`
            : "Needs stronger wording",
          reason:
          weakPattern || !hasMetric(trimmed)
            ? "This bullet could be stronger with clearer impact, more specific language, or closer alignment to the target role."
            : "This bullet needs sharper language to match the role more closely."
      })
      return
    }

    if (
      matchedKeywords.length > 0 ||
      KNOWN_KEY_PHRASES.some((phrase) => normalized.includes(phrase))
    ) {
      reviewItems.push({
        id: `good-${index}`,
        type: "good",
        section,
        originalText: line,
        hoverTitle: "Relevant role language",
        reason: "This line already reinforces language that is relevant to the target role."
      })
    } else if (trimmed.length > 12) {
      reviewItems.push({
        id: `warn-${index}`,
        type: "warn",
        section,
        originalText: line,
        hoverTitle: "Could be more tailored",
        reason:
          `This line is useful, but it could connect more directly to the target role with clearer wording or stronger specificity.${buildKeywordHint(missingKeywords)}`
      })
    }
  })

  return reviewItems
}

export function generateResumeInsights(
  resumeText: string,
  jobPosting: string
): ResumeInsights {
  const { ratio, missing } = scoreMatch(resumeText, jobPosting)
  const matchCopy = getMatchCopy(ratio, jobPosting.trim().length > 0)
  const missingKeywords = missing.slice(0, 6)

  return {
    matchSummary: matchCopy.summary,
    matchLabel: matchCopy.label,
    matchTone: matchCopy.tone,
    agentPlan: [
      "Review the highest-priority red highlights first.",
      "Apply the most important experience bullet rewrites into the Edit tab.",
      "Check missing keywords and add the strongest ones where they fit naturally."
    ],
    missingKeywords,
    reviewItems: buildReviewItems(resumeText, jobPosting, missingKeywords)
  }
}

function normalizeReviewKey(text: string) {
  return stripFormatting(text).toLowerCase().replace(/\s+/g, " ").trim()
}

function getSectionFromResumeLine(text: string, resumeText: string) {
  const lines = resumeText.split("\n")
  let currentSection: ResumeSectionKey | null = null

  for (const line of lines) {
    const trimmed = stripFormatting(line)
    if (!trimmed) continue

    const sectionKey = getSectionKey(trimmed)
    if (sectionKey) {
      currentSection = sectionKey
      continue
    }

    if (normalizeReviewKey(line) === normalizeReviewKey(text)) {
      return currentSection || "other"
    }
  }

  return "other"
}

export function ensureResumeReviewCoverage(
  insights: ResumeInsights,
  resumeText: string,
  jobPosting: string
): ResumeInsights {
  const fallbackInsights = generateResumeInsights(resumeText, jobPosting)
  const fallbackByLineKey = new Map(
    fallbackInsights.reviewItems.map((item) => [
      normalizeReviewKey(item.originalText),
      item
    ] as const)
  )
  const lineOrder = new Map<string, number>()
  resumeText.split("\n").forEach((line, index) => {
    const lineKey = normalizeReviewKey(line)
    if (lineKey && !lineOrder.has(lineKey)) {
      lineOrder.set(lineKey, index)
    }
  })

  const aiReviewItems = insights.reviewItems
    .filter((item) =>
      isReviewableContentLine(
        item.originalText,
        getSectionFromResumeLine(item.originalText, resumeText)
      )
    )
    .map((item) => ({
      ...item,
      section:
        item.section || getSectionFromResumeLine(item.originalText, resumeText),
      suggestedText:
        item.type === "good"
          ? item.suggestedText
          : item.suggestedText ||
            fallbackByLineKey.get(normalizeReviewKey(item.originalText))
              ?.suggestedText ||
            buildImprovedLine(
              item.originalText,
              (item.section ||
                getSectionFromResumeLine(
                  item.originalText,
                  resumeText
                )) as ResumeSectionKey,
              fallbackInsights.missingKeywords,
              jobPosting
            )
    }))

  const coveredSections = new Set(
    aiReviewItems.map((item) => item.section || "other")
  )
  const mergedReviewItems: ResumeReviewItem[] = [...aiReviewItems]

  const fallbackBySection = new Map<ResumeSectionKey, ResumeReviewItem[]>()
  fallbackInsights.reviewItems.forEach((item) => {
    const section = (item.section || "other") as ResumeSectionKey
    if (!fallbackBySection.has(section)) {
      fallbackBySection.set(section, [])
    }

    fallbackBySection.get(section)!.push(item)
  })

  fallbackBySection.forEach((items, section) => {
    if (coveredSections.has(section)) return

    const prioritizedItems = [...items].sort((a, b) => {
      const typeRank = { fix: 0, warn: 1, good: 2 }
      return typeRank[a.type] - typeRank[b.type]
    })

    prioritizedItems.slice(0, 2).forEach((item) => {
      mergedReviewItems.push(item)
    })
  })

  const dedupedReviewItems = mergedReviewItems
    .filter((item, index, items) => {
      const lineKey = normalizeReviewKey(item.originalText)
      return (
        items.findIndex(
          (candidate) => normalizeReviewKey(candidate.originalText) === lineKey
        ) === index
      )
    })
    .sort((a, b) => {
      const aIndex = lineOrder.get(normalizeReviewKey(a.originalText)) ?? 9999
      const bIndex = lineOrder.get(normalizeReviewKey(b.originalText)) ?? 9999
      return aIndex - bIndex
    })

  const mergedKeywords = Array.from(
    new Set([...insights.missingKeywords, ...fallbackInsights.missingKeywords])
  ).slice(0, 10)

  const mergedPlan = Array.from(
    new Set([...insights.agentPlan, ...fallbackInsights.agentPlan])
  ).slice(0, 5)

  return {
    ...insights,
    matchSummary:
      insights.matchSummary.trim() || fallbackInsights.matchSummary,
    matchLabel: insights.matchLabel.trim() || fallbackInsights.matchLabel,
    matchTone: insights.matchTone || fallbackInsights.matchTone,
    agentPlan: mergedPlan,
    missingKeywords: mergedKeywords,
    reviewItems: dedupedReviewItems
  }
}

export function applySuggestionToResume(
  resumeText: string,
  originalLine: string,
  replacementLine: string
) {
  const lines = resumeText.split("\n")
  const lineIndex = lines.findIndex((line) => line === originalLine)

  if (lineIndex === -1) {
    return {
      nextText: resumeText,
      insertedText: null as string | null
    }
  }

  const updated = [...lines]
  updated[lineIndex] = replacementLine

  return {
    nextText: updated.join("\n"),
    insertedText: replacementLine
  }
}

export function applyMultipleSuggestionsToResume(
  resumeText: string,
  reviewItems: ResumeReviewItem[]
) {
  let nextText = resumeText
  let lastInsertedText: string | null = null
  const appliedIds: string[] = []

  for (const item of reviewItems) {
    if (!item.suggestedText) continue

    const result = applySuggestionToResume(
      nextText,
      item.originalText,
      item.suggestedText
    )

    if (result.nextText !== nextText) {
      nextText = result.nextText
      lastInsertedText = result.insertedText
      appliedIds.push(item.id)
    }
  }

  return {
    nextText,
    insertedText: lastInsertedText,
    appliedIds
  }
}
