import { ResumeData } from "../types/resume"

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim()
}

function getSection(lines: string[], sectionName: string, stopSections: string[]) {
  const start = lines.findIndex(
    (line) => cleanLine(line).toUpperCase() === sectionName
  )

  if (start === -1) return []

  const end = lines.findIndex((line, index) => {
    if (index <= start) return false
    return stopSections.includes(cleanLine(line).toUpperCase())
  })

  return lines.slice(start + 1, end === -1 ? lines.length : end)
}

function extractLinks(text: string) {
  const links = []

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const linkedin = text.match(/linkedin\.com\/[^\s|]+/i)?.[0]
  const github = text.match(/github\.com\/[^\s|]+/i)?.[0]
  const urls = text.match(/https?:\/\/[^\s|]+/gi) || []

  if (email) links.push({ label: "Email", url: `mailto:${email}` })
  if (linkedin) links.push({ label: "LinkedIn", url: `https://${linkedin}` })
  if (github) links.push({ label: "GitHub", url: `https://${github}` })

  urls.forEach((url) => {
    if (!links.some((link) => link.url.includes(url))) {
      links.push({ label: "Portfolio", url })
    }
  })

  return links
}

function parseBullets(lines: string[]) {
  return lines
    .filter((line) => line.startsWith("•") || line.startsWith("-"))
    .map((line) => cleanLine(line.replace(/^[-•]\s*/, "")))
}

export function parseResumeToJson(text: string): ResumeData {
  const lines = text
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)

  const sections = [
    "SUMMARY",
    "EXPERIENCE",
    "PROJECTS",
    "EDUCATION",
    "TECHNICAL SKILLS",
    "SKILLS",
    "CERTIFICATIONS"
  ]

  const name = lines[0] || "Your Name"
  const headline = lines[1] || ""
  const contactLine = lines[2] || ""

  const summaryLines = getSection(lines, "SUMMARY", sections)
  const experienceLines = getSection(lines, "EXPERIENCE", sections)
  const projectLines = getSection(lines, "PROJECTS", sections)
  const educationLines = getSection(lines, "EDUCATION", sections)

  const skillsLines =
    getSection(lines, "TECHNICAL SKILLS", sections).length > 0
      ? getSection(lines, "TECHNICAL SKILLS", sections)
      : getSection(lines, "SKILLS", sections)

  const certificationLines = getSection(lines, "CERTIFICATIONS", sections)

  return {
    name,
    headline,
    contactLine,
    links: extractLinks(text),
    summary: summaryLines.join(" "),
    experience: [
      {
        company: experienceLines[0] || "",
        role: experienceLines[1] || "",
        dates: "",
        location: "",
        bullets: parseBullets(experienceLines)
      }
    ].filter((item) => item.company || item.bullets.length > 0),
    projects: [
      {
        name: projectLines[0] || "",
        tech: "",
        dates: "",
        bullets: parseBullets(projectLines)
      }
    ].filter((item) => item.name || item.bullets.length > 0),
    education: [
      {
        school: educationLines[0] || "",
        degree: educationLines[1] || "",
        dates: "",
        details: educationLines.slice(2)
      }
    ].filter((item) => item.school),
    skills: skillsLines
      .join(" ")
      .split(/[,|]/)
      .map(cleanLine)
      .filter(Boolean),
    certifications: certificationLines.map(cleanLine),
    rawText: text
  }
}