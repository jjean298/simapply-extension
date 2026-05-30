export interface ResumeLink {
  label: string
  url: string
}

export interface ResumeExperience {
  company: string
  role: string
  dates?: string
  location?: string
  bullets: string[]
}

export interface ResumeProject {
  name: string
  tech?: string
  dates?: string
  bullets: string[]
}

export interface ResumeEducation {
  school: string
  degree?: string
  dates?: string
  details: string[]
}

export interface ResumeData {
  name: string
  headline: string
  contactLine: string
  links: ResumeLink[]
  summary: string
  experience: ResumeExperience[]
  projects: ResumeProject[]
  education: ResumeEducation[]
  skills: string[]
  certifications: string[]
  rawText: string
}