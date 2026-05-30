import { useEffect, useRef, useState } from "react"
import { Download } from "lucide-react"
import { RichTextToolbar } from "./RichTextToolbar"
import {
  clampMargin,
  type DocumentMargins
} from "../utils/documentLayout"

interface HistoryState {
  text: string
  cursorPosition: number
}

interface ResumeEditPanelProps {
  content: string
  onChange: (content: string) => void
  onExport: () => void
  margins: DocumentMargins
  onMarginsChange: (margins: DocumentMargins) => void
  insertedText?: string | null
}

export function ResumeEditPanel({
  content,
  onChange,
  onExport,
  margins,
  onMarginsChange,
  insertedText
}: ResumeEditPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const didInitializeRef = useRef(false)
  const handledInsertedTextRef = useRef<string | null>(null)
  const [history, setHistory] = useState<HistoryState[]>([
    { text: content, cursorPosition: 0 }
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const isUndoRedoRef = useRef(false)

  useEffect(() => {
    if (didInitializeRef.current || !content.trim()) return

    didInitializeRef.current = true
    setHistory([{ text: content, cursorPosition: 0 }])
    setHistoryIndex(0)
  }, [content])

  useEffect(() => {
    if (!insertedText || !textareaRef.current) return
    if (handledInsertedTextRef.current === insertedText) return

    const start = content.indexOf(insertedText)
    if (start === -1) return

    handledInsertedTextRef.current = insertedText
    addToHistory(content, start)
    const end = start + insertedText.length
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(start, end)
  }, [content, insertedText])

  const addToHistory = (text: string, cursorPosition: number) => {
    if (isUndoRedoRef.current) return

    const nextHistory = history.slice(0, historyIndex + 1)
    nextHistory.push({ text, cursorPosition })

    if (nextHistory.length > 50) {
      nextHistory.shift()
    }

    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
  }

  const handleTextChange = (nextText: string, cursorPosition: number) => {
    onChange(nextText)
    addToHistory(nextText, cursorPosition)
  }

  const handleUndo = () => {
    if (historyIndex <= 0) return

    isUndoRedoRef.current = true
    const previousState = history[historyIndex - 1]
    onChange(previousState.text)
    setHistoryIndex((value) => value - 1)

    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(
        previousState.cursorPosition,
        previousState.cursorPosition
      )
      isUndoRedoRef.current = false
    }, 0)
  }

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return

    isUndoRedoRef.current = true
    const nextState = history[historyIndex + 1]
    onChange(nextState.text)
    setHistoryIndex((value) => value + 1)

    setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(
        nextState.cursorPosition,
        nextState.cursorPosition
      )
      isUndoRedoRef.current = false
    }, 0)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault()
        handleUndo()
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "y" || (event.key === "z" && event.shiftKey))
      ) {
        event.preventDefault()
        handleRedo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [history, historyIndex])

  const handleFormat = (format: string, value?: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)

    if (
      !selectedText &&
      format !== "spacing" &&
      format !== "bullet" &&
      format !== "link"
    ) {
      return
    }

    let formattedText = ""
    let nextText = ""
    const applyLineFormat = (
      prefix: string,
      selection: string,
      suffix = "]"
    ) =>
      selection
        .split("\n")
        .map((line) => {
          if (!line.trim()) return line
          return `${prefix}${line}${suffix}`
        })
        .join("\n")

    switch (format) {
      case "bold":
        if (
          selectedText.startsWith("*") &&
          selectedText.endsWith("*") &&
          !selectedText.startsWith("**")
        ) {
          const innerText = selectedText.slice(1, -1)
          formattedText = `***${innerText}***`
        } else if (
          selectedText.startsWith("***") &&
          selectedText.endsWith("***")
        ) {
          const innerText = selectedText.slice(3, -3)
          formattedText = `*${innerText}*`
        } else if (
          selectedText.startsWith("**") &&
          selectedText.endsWith("**")
        ) {
          formattedText = selectedText.slice(2, -2)
        } else {
          formattedText = `**${selectedText}**`
        }
        break
      case "italic":
        if (
          selectedText.startsWith("**") &&
          selectedText.endsWith("**") &&
          !selectedText.startsWith("***")
        ) {
          const innerText = selectedText.slice(2, -2)
          formattedText = `***${innerText}***`
        } else if (
          selectedText.startsWith("***") &&
          selectedText.endsWith("***")
        ) {
          const innerText = selectedText.slice(3, -3)
          formattedText = `**${innerText}**`
        } else if (
          selectedText.startsWith("*") &&
          selectedText.endsWith("*") &&
          !selectedText.startsWith("**")
        ) {
          formattedText = selectedText.slice(1, -1)
        } else {
          formattedText = `*${selectedText}*`
        }
        break
      case "underline":
        formattedText =
          selectedText.startsWith("__") && selectedText.endsWith("__")
            ? selectedText.slice(2, -2)
            : `__${selectedText}__`
        break
      case "font":
        formattedText = applyLineFormat(
          `[FONT:${value || "serif"}:`,
          selectedText
        )
        break
      case "size":
        formattedText = applyLineFormat(
          `[SIZE:${value || "10.5"}:`,
          selectedText
        )
        break
      case "color":
        formattedText = applyLineFormat(
          `[COLOR:${value || "black"}:`,
          selectedText
        )
        break
      case "link": {
        const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
        let regexMatch: RegExpExecArray | null
        let activeLink:
          | {
              label: string
              url: string
              start: number
              end: number
            }
          | undefined

        while ((regexMatch = linkRegex.exec(content)) !== null) {
          const matchStart = regexMatch.index
          const matchEnd = matchStart + regexMatch[0].length
          const selectionInsideLink =
            start >= matchStart && end <= matchEnd && (start !== end || start > matchStart)
          const cursorInsideLink = start === end && start >= matchStart && start <= matchEnd

          if (selectionInsideLink || cursorInsideLink) {
            activeLink = {
              label: regexMatch[1],
              url: regexMatch[2],
              start: matchStart,
              end: matchEnd
            }
            break
          }
        }

        if (activeLink) {
          const nextUrl = window.prompt(
            "Update the link URL. Leave blank to remove the link.",
            activeLink.url
          )

          if (nextUrl === null) return

          const replacement = nextUrl.trim()
            ? `[${activeLink.label}](${nextUrl.trim()})`
            : activeLink.label

          nextText =
            content.substring(0, activeLink.start) +
            replacement +
            content.substring(activeLink.end)

          onChange(nextText)
          addToHistory(nextText, activeLink.start + replacement.length)
          setTimeout(() => {
            textarea.focus()
            textarea.setSelectionRange(
              activeLink.start,
              activeLink.start + replacement.length
            )
          }, 0)
          return
        }

        if (!selectedText) {
          return
        }

        const url = window.prompt("Enter URL to attach to the selected text:")
        if (!url?.trim()) return
        formattedText = `[${selectedText}](${url.trim()})`
        break
      }
      case "left":
        formattedText = `[L:${selectedText}]`
        break
      case "center":
        formattedText = `[C:${selectedText}]`
        break
      case "right":
        formattedText = `[R:${selectedText}]`
        break
      case "justify": {
        const beforeJustify = content.substring(0, start)
        const afterJustify = content.substring(end)
        const lineStart = beforeJustify.lastIndexOf("\n") + 1
        const lineEnd = afterJustify.indexOf("\n")
        const fullLine = content.substring(
          lineStart,
          lineEnd === -1 ? content.length : end + lineEnd
        )
        const cleanedLine = fullLine.replace(/^\[JUSTIFY\]\s*/, "")
        nextText =
          content.substring(0, lineStart) +
          `[JUSTIFY]${cleanedLine}` +
          (lineEnd === -1 ? "" : content.substring(end + lineEnd))
        onChange(nextText)
        addToHistory(nextText, start)
        return
      }
      case "indent":
        formattedText = `[INDENT:${selectedText}]`
        break
      case "bullet": {
        const bulletChar = value || "•"
        if (selectedText) {
          formattedText = `${bulletChar} ${selectedText}`
        } else {
          const beforeBullet = content.substring(0, start)
          const afterBullet = content.substring(end)
          const lineStart = beforeBullet.lastIndexOf("\n") + 1
          const lineEnd = afterBullet.indexOf("\n")
          const currentLine = content.substring(
            lineStart,
            lineEnd === -1 ? content.length : end + lineEnd
          )
          const hasBullet = /^[•●⬤▸★✓■◆\-\+\*>]\s/.test(currentLine.trim())
          const cleanedLine = currentLine
            .trim()
            .replace(/^[•●⬤▸★✓■◆\-\+\*>]\s/, "")

          nextText =
            content.substring(0, lineStart) +
            `${bulletChar} ${cleanedLine}` +
            (lineEnd === -1 ? "" : content.substring(end + lineEnd))

          onChange(nextText)
          addToHistory(nextText, start)
          return
        }
        break
      }
      case "spacing": {
        const spacingValue = value || "1.5"
        const selectionStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1
        const selectionEndLineBreak = content.indexOf("\n", end)
        const selectionEnd =
          selectionEndLineBreak === -1 ? content.length : selectionEndLineBreak
        const selectedBlock = content.substring(selectionStart, selectionEnd)
        const spacedBlock = selectedBlock
          .split("\n")
          .map((line) => {
            if (!line.trim()) return line
            const cleanedLine = line.replace(/^\[SPACING:[^\]]+\]\s*/, "")
            return `[SPACING:${spacingValue}]${cleanedLine}`
          })
          .join("\n")

        nextText =
          content.substring(0, selectionStart) +
          spacedBlock +
          content.substring(selectionEnd)

        onChange(nextText)
        addToHistory(nextText, selectionStart + spacedBlock.length)
        setTimeout(() => {
          textarea.focus()
          textarea.setSelectionRange(
            selectionStart,
            selectionStart + spacedBlock.length
          )
        }, 0)
        return
      }
      default:
        return
    }

    nextText = content.substring(0, start) + formattedText + content.substring(end)
    onChange(nextText)

    const nextSelectionStart = start
    const nextSelectionEnd = start + formattedText.length
    addToHistory(nextText, nextSelectionEnd)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(nextSelectionStart, nextSelectionEnd)
    }, 0)
  }

  const handleMarginsChange = (preset: string) => {
    if (preset !== "custom") {
      const presetMargins = {
        narrow: { top: 36, right: 36, bottom: 36, left: 36 },
        normal: { top: 60, right: 60, bottom: 40, left: 60 },
        moderate: { top: 72, right: 72, bottom: 56, left: 72 },
        wide: { top: 90, right: 90, bottom: 72, left: 90 }
      }[preset]

      if (presetMargins) {
        onMarginsChange(presetMargins)
      }
      return
    }

    const top = window.prompt("Top margin (18-144 pt)", String(margins.top))
    if (top === null) return
    const right = window.prompt("Right margin (18-144 pt)", String(margins.right))
    if (right === null) return
    const bottom = window.prompt(
      "Bottom margin (18-144 pt)",
      String(margins.bottom)
    )
    if (bottom === null) return
    const left = window.prompt("Left margin (18-144 pt)", String(margins.left))
    if (left === null) return

    onMarginsChange({
      top: clampMargin(Number(top)),
      right: clampMargin(Number(right)),
      bottom: clampMargin(Number(bottom)),
      left: clampMargin(Number(left))
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-[color:var(--panel-border)] px-5 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Edit</h2>
            <p className="text-xs text-slate-500">
              Refine the content directly, then export when it looks right.
            </p>
          </div>
          <button
            onClick={onExport}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="sticky top-0 z-20 border-b border-[color:var(--panel-border)] bg-white">
        <RichTextToolbar
          onFormat={handleFormat}
          margins={margins}
          onMarginsChange={handleMarginsChange}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--surface-soft)] p-5">
        <div className="mx-auto flex min-h-full max-w-3xl flex-col rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) =>
              handleTextChange(event.target.value, event.target.selectionStart)
            }
            className="min-h-[900px] w-full resize-none rounded-[28px] px-12 py-12 font-serif text-[15px] leading-8 text-slate-800 outline-none"
            style={{
              paddingTop: `${margins.top}px`,
              paddingRight: `${margins.right}px`,
              paddingBottom: `${margins.bottom}px`,
              paddingLeft: `${margins.left}px`
            }}
            placeholder="Your resume text will appear here..."
          />
        </div>
      </div>
    </div>
  )
}
