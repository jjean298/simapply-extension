import { useState, useRef, useEffect, type ReactNode, type RefObject } from "react"
import {
  Bold,
  Italic,
  Underline,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Space,
  List,
  ChevronDown,
  Undo,
  Redo,
  Palette,
  Type,
  FileText
} from "lucide-react"
import {
  DEFAULT_MARGINS,
  getMarginPresetLabel,
  type DocumentMargins
} from "../utils/documentLayout"

interface RichTextToolbarProps {
  onFormat: (format: string, value?: string) => void
  margins?: DocumentMargins
  onMarginsChange?: (preset: string) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

export function RichTextToolbar({
  onFormat,
  margins = DEFAULT_MARGINS,
  onMarginsChange = () => {},
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}: RichTextToolbarProps) {
  const [showSpacingMenu, setShowSpacingMenu] = useState(false)
  const [showBulletsMenu, setShowBulletsMenu] = useState(false)
  const [showFontsMenu, setShowFontsMenu] = useState(false)
  const [showSizeMenu, setShowSizeMenu] = useState(false)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [showMarginsMenu, setShowMarginsMenu] = useState(false)
  const spacingRef = useRef<HTMLDivElement>(null)
  const bulletsRef = useRef<HTMLDivElement>(null)
  const fontsRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef<HTMLDivElement>(null)
  const colorRef = useRef<HTMLDivElement>(null)
  const marginsRef = useRef<HTMLDivElement>(null)

  const spacingOptions = [
    { label: "0.5x", value: "0.5" },
    { label: "1x", value: "1.0" },
    { label: "1.5x", value: "1.5" },
    { label: "2x", value: "2.0" }
  ]

  const bulletOptions = [
    { label: "• Dot", value: "•" },
    { label: "● Medium Dot", value: "●" },
    { label: "⬤ Large Dot", value: "⬤" },
    { label: "▸ Arrow", value: "▸" },
    { label: "★ Star", value: "★" },
    { label: "✓ Check", value: "✓" },
    { label: "■ Square", value: "■" },
    { label: "◆ Diamond", value: "◆" },
    { label: "- Dash", value: "-" }
  ]

  const fontOptions = [
    { label: "Serif", value: "serif" },
    { label: "Sans", value: "sans" },
    { label: "Mono", value: "mono" }
  ]

  const sizeOptions = [
    { label: "Small", value: "9.5" },
    { label: "Normal", value: "10.5" },
    { label: "Medium", value: "12" },
    { label: "Large", value: "14" },
    { label: "XL", value: "16" }
  ]

  const colorOptions = [
    { label: "Black", value: "black" },
    { label: "Slate", value: "slate" },
    { label: "Blue", value: "blue" },
    { label: "Green", value: "green" },
    { label: "Red", value: "red" }
  ]

  const marginOptions = [
    { label: "Normal", value: "normal" },
    { label: "Narrow", value: "narrow" },
    { label: "Moderate", value: "moderate" },
    { label: "Wide", value: "wide" },
    { label: "Custom", value: "custom" }
  ]

  const buttons = [
    { icon: Bold, label: "Bold", format: "bold" },
    { icon: Italic, label: "Italic", format: "italic" },
    { icon: Underline, label: "Underline", format: "underline" },
    { icon: Link, label: "Link", format: "link" },
    { icon: AlignLeft, label: "Position Left", format: "left" },
    { icon: AlignCenter, label: "Position Center", format: "center" },
    { icon: AlignRight, label: "Position Right", format: "right" },
    { icon: AlignJustify, label: "Justify Line", format: "justify" },
    { icon: Indent, label: "Indent Text", format: "indent" }
  ]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (spacingRef.current && !spacingRef.current.contains(event.target as Node)) {
        setShowSpacingMenu(false)
      }
      if (bulletsRef.current && !bulletsRef.current.contains(event.target as Node)) {
        setShowBulletsMenu(false)
      }
      if (fontsRef.current && !fontsRef.current.contains(event.target as Node)) {
        setShowFontsMenu(false)
      }
      if (sizeRef.current && !sizeRef.current.contains(event.target as Node)) {
        setShowSizeMenu(false)
      }
      if (colorRef.current && !colorRef.current.contains(event.target as Node)) {
        setShowColorMenu(false)
      }
      if (marginsRef.current && !marginsRef.current.contains(event.target as Node)) {
        setShowMarginsMenu(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[color:var(--panel-border)] bg-[color:var(--surface-soft)] px-3 py-2">
      <button
        onClick={onUndo}
        onMouseDown={(event) => event.preventDefault()}
        disabled={!canUndo}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </button>
      <button
        onClick={onRedo}
        onMouseDown={(event) => event.preventDefault()}
        disabled={!canRedo}
        className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </button>

      <div className="mx-1 h-6 w-px bg-slate-200" />

      {buttons.map(({ icon: Icon, label, format }) => (
        <button
          key={format}
          onClick={() => onFormat(format)}
          onMouseDown={(event) => event.preventDefault()}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
          title={label}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <DropdownMenu
        menuRef={fontsRef}
        open={showFontsMenu}
        onToggle={() => setShowFontsMenu(!showFontsMenu)}
        icon={<Type className="h-4 w-4" />}
        title="Font Family"
        options={fontOptions}
        onSelect={(value) => {
          onFormat("font", value)
          setShowFontsMenu(false)
        }}
      />

      <DropdownMenu
        menuRef={sizeRef}
        open={showSizeMenu}
        onToggle={() => setShowSizeMenu(!showSizeMenu)}
        icon={<span className="text-xs font-semibold">Aa</span>}
        title="Font Size"
        options={sizeOptions}
        onSelect={(value) => {
          onFormat("size", value)
          setShowSizeMenu(false)
        }}
      />

      <DropdownMenu
        menuRef={colorRef}
        open={showColorMenu}
        onToggle={() => setShowColorMenu(!showColorMenu)}
        icon={<Palette className="h-4 w-4" />}
        title="Text Color"
        options={colorOptions}
        onSelect={(value) => {
          onFormat("color", value)
          setShowColorMenu(false)
        }}
      />

      <DropdownMenu
        menuRef={marginsRef}
        open={showMarginsMenu}
        onToggle={() => setShowMarginsMenu(!showMarginsMenu)}
        icon={<FileText className="h-4 w-4" />}
        title={`Page Margins: ${getMarginPresetLabel(margins)}`}
        buttonLabel={getMarginPresetLabel(margins)}
        options={marginOptions}
        onSelect={(value) => {
          onMarginsChange(value)
          setShowMarginsMenu(false)
        }}
      />

      <DropdownMenu
        menuRef={spacingRef}
        open={showSpacingMenu}
        onToggle={() => setShowSpacingMenu(!showSpacingMenu)}
        icon={<Space className="h-4 w-4" />}
        title="Line Spacing"
        options={spacingOptions}
        onSelect={(value) => {
          onFormat("spacing", value)
          setShowSpacingMenu(false)
        }}
      />

      <DropdownMenu
        menuRef={bulletsRef}
        open={showBulletsMenu}
        onToggle={() => setShowBulletsMenu(!showBulletsMenu)}
        icon={<List className="h-4 w-4" />}
        title="Bullets"
        options={bulletOptions}
        onSelect={(value) => {
          onFormat("bullet", value)
          setShowBulletsMenu(false)
        }}
      />

      <div className="ml-2 text-xs text-slate-400">
        Select text and click a format button
      </div>
    </div>
  )
}

function DropdownMenu({
  menuRef,
  open,
  onToggle,
  icon,
  title,
  buttonLabel,
  options,
  onSelect
}: {
  menuRef: RefObject<HTMLDivElement | null>
  open: boolean
  onToggle: () => void
  icon: ReactNode
  title: string
  buttonLabel?: string
  options: Array<{ label: string; value: string }>
  onSelect: (value: string) => void
}) {
  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={onToggle}
        onMouseDown={(event) => event.preventDefault()}
        className="flex items-center gap-1 rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
        title={title}
      >
        {icon}
        {buttonLabel ? (
          <span className="max-w-[72px] truncate text-xs font-medium">
            {buttonLabel}
          </span>
        ) : null}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-xl border border-slate-200 bg-white shadow-lg">
          {options.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onSelect(value)}
              onMouseDown={(event) => event.preventDefault()}
              className="block w-full px-4 py-2 text-left text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
