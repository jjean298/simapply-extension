import fs from "node:fs"
import path from "node:path"

function parseEnvValue(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

export function loadEnvFile(envPath = path.resolve(process.cwd(), "server/.env")) {
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, "utf8")

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const separatorIndex = line.indexOf("=")
    if (separatorIndex === -1) continue

    const key = line.slice(0, separatorIndex).trim()
    const value = parseEnvValue(line.slice(separatorIndex + 1))

    if (!key || process.env[key] !== undefined) continue
    process.env[key] = value
  }
}
