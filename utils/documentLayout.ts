export interface DocumentMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export type MarginPreset = "narrow" | "normal" | "moderate" | "wide" | "custom"

export const DEFAULT_MARGINS: DocumentMargins = {
  top: 60,
  right: 60,
  bottom: 40,
  left: 60
}

export const MARGIN_PRESETS: Record<
  Exclude<MarginPreset, "custom">,
  { label: string; margins: DocumentMargins }
> = {
  narrow: {
    label: "Narrow",
    margins: { top: 36, right: 36, bottom: 36, left: 36 }
  },
  normal: {
    label: "Normal",
    margins: DEFAULT_MARGINS
  },
  moderate: {
    label: "Moderate",
    margins: { top: 72, right: 72, bottom: 56, left: 72 }
  },
  wide: {
    label: "Wide",
    margins: { top: 90, right: 90, bottom: 72, left: 90 }
  }
}

export function detectMarginPreset(margins: DocumentMargins): MarginPreset {
  for (const [presetKey, preset] of Object.entries(MARGIN_PRESETS)) {
    if (
      preset.margins.top === margins.top &&
      preset.margins.right === margins.right &&
      preset.margins.bottom === margins.bottom &&
      preset.margins.left === margins.left
    ) {
      return presetKey as Exclude<MarginPreset, "custom">
    }
  }

  return "custom"
}

export function getMarginPresetLabel(margins: DocumentMargins) {
  const preset = detectMarginPreset(margins)
  return preset === "custom" ? "Custom" : MARGIN_PRESETS[preset].label
}

export function clampMargin(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_MARGINS.top
  return Math.max(18, Math.min(144, value))
}
