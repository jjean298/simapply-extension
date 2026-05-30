export interface TextSegment {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  link?: string
  align?: "left" | "center" | "right"
  indent?: boolean
  color?: string
  fontFamily?: "serif" | "sans" | "mono"
  fontSize?: number
}

function appendSegments(target: TextSegment[], segments: TextSegment[]) {
  for (const segment of segments) {
    if (!segment.text) continue

    const lastSegment = target[target.length - 1]
    if (
      lastSegment &&
      lastSegment.bold === segment.bold &&
      lastSegment.italic === segment.italic &&
      lastSegment.underline === segment.underline &&
      lastSegment.link === segment.link &&
      lastSegment.align === segment.align &&
      lastSegment.indent === segment.indent &&
      lastSegment.color === segment.color &&
      lastSegment.fontFamily === segment.fontFamily &&
      lastSegment.fontSize === segment.fontSize
    ) {
      lastSegment.text += segment.text
      continue
    }

    target.push(segment)
  }
}

function parseInline(
  text: string,
  inheritedStyles: Partial<TextSegment> = {}
): TextSegment[] {
  const segments: TextSegment[] = []
  let remaining = text

  while (remaining.length > 0) {
    const indentMatch = remaining.match(/^\[INDENT:(.+?)\]/)
    if (indentMatch) {
      appendSegments(
        segments,
        parseInline(indentMatch[1], {
          ...inheritedStyles,
          indent: true
        })
      )
      remaining = remaining.slice(indentMatch[0].length)
      continue
    }

    const colorMatch = remaining.match(/^\[COLOR:([a-zA-Z0-9#-]+):(.+?)\]/)
    if (colorMatch) {
      appendSegments(
        segments,
        parseInline(colorMatch[2], {
          ...inheritedStyles,
          color: colorMatch[1].trim()
        })
      )
      remaining = remaining.slice(colorMatch[0].length)
      continue
    }

    const fontMatch = remaining.match(/^\[FONT:(serif|sans|mono):(.+?)\]/)
    if (fontMatch) {
      appendSegments(
        segments,
        parseInline(fontMatch[2], {
          ...inheritedStyles,
          fontFamily: fontMatch[1] as "serif" | "sans" | "mono"
        })
      )
      remaining = remaining.slice(fontMatch[0].length)
      continue
    }

    const sizeMatch = remaining.match(/^\[SIZE:([0-9.]+):(.+?)\]/)
    if (sizeMatch) {
      appendSegments(
        segments,
        parseInline(sizeMatch[2], {
          ...inheritedStyles,
          fontSize: parseFloat(sizeMatch[1])
        })
      )
      remaining = remaining.slice(sizeMatch[0].length)
      continue
    }

    const leftAlignMatch = remaining.match(/^\[L:(.+?)\]/)
    if (leftAlignMatch) {
      appendSegments(
        segments,
        parseInline(leftAlignMatch[1], {
          ...inheritedStyles,
          align: "left"
        })
      )
      remaining = remaining.slice(leftAlignMatch[0].length)
      continue
    }

    const centerAlignMatch = remaining.match(/^\[C:(.+?)\]/)
    if (centerAlignMatch) {
      appendSegments(
        segments,
        parseInline(centerAlignMatch[1], {
          ...inheritedStyles,
          align: "center"
        })
      )
      remaining = remaining.slice(centerAlignMatch[0].length)
      continue
    }

    const rightAlignMatch = remaining.match(/^\[R:(.+?)\]/)
    if (rightAlignMatch) {
      appendSegments(
        segments,
        parseInline(rightAlignMatch[1], {
          ...inheritedStyles,
          align: "right"
        })
      )
      remaining = remaining.slice(rightAlignMatch[0].length)
      continue
    }

    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      appendSegments(
        segments,
        parseInline(linkMatch[1], {
          ...inheritedStyles,
          link: linkMatch[2],
          underline: true
        })
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    const boldItalicMatch = remaining.match(/^\*\*\*(.+?)\*\*\*/)
    if (boldItalicMatch) {
      appendSegments(
        segments,
        parseInline(boldItalicMatch[1], {
          ...inheritedStyles,
          bold: true,
          italic: true
        })
      )
      remaining = remaining.slice(boldItalicMatch[0].length)
      continue
    }

    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      appendSegments(
        segments,
        parseInline(boldMatch[1], {
          ...inheritedStyles,
          bold: true
        })
      )
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    const italicMatch = remaining.match(/^\*([^*]+?)\*/)
    if (italicMatch) {
      appendSegments(
        segments,
        parseInline(italicMatch[1], {
          ...inheritedStyles,
          italic: true
        })
      )
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    const underlineMatch = remaining.match(/^__([\s\S]+?)__/)
    if (underlineMatch) {
      appendSegments(
        segments,
        parseInline(underlineMatch[1], {
          ...inheritedStyles,
          underline: true
        })
      )
      remaining = remaining.slice(underlineMatch[0].length)
      continue
    }

    const nextMarker = remaining.search(/(\*\*\*|\*\*|\*|__|\[)/)
    if (nextMarker === -1) {
      appendSegments(segments, [{ text: remaining, ...inheritedStyles }])
      break
    }

    if (nextMarker > 0) {
      appendSegments(segments, [
        { text: remaining.slice(0, nextMarker), ...inheritedStyles }
      ])
      remaining = remaining.slice(nextMarker)
      continue
    }

    appendSegments(segments, [{ text: remaining[0], ...inheritedStyles }])
    remaining = remaining.slice(1)
  }

  return segments
}

export function parseFormattedLine(line: string): TextSegment[] {
  return parseInline(line)
}

export function getAlignment(line: string): {
  alignment: "left" | "center" | "right" | "justify"
  cleanedLine: string
  spacing?: number
} {
  const trimmed = line.trim()

  const spacingMatch = trimmed.match(/^\[SPACING:([0-9.]+)\]/)
  let spacing: number | undefined
  let workingLine = trimmed

  if (spacingMatch) {
    spacing = parseFloat(spacingMatch[1])
    workingLine = trimmed.replace(/^\[SPACING:[^\]]+\]\s*/, "")
  }

  if (workingLine.startsWith("[CENTER]")) {
    return {
      alignment: "center",
      cleanedLine: workingLine.replace("[CENTER]", "").trim(),
      spacing
    }
  }

  if (workingLine.startsWith("[JUSTIFY]")) {
    return {
      alignment: "justify",
      cleanedLine: workingLine.replace("[JUSTIFY]", "").trim(),
      spacing
    }
  }

  return { alignment: "left", cleanedLine: workingLine, spacing }
}
