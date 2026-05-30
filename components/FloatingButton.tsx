import { SimApplyMark } from "./SimApplyMark"

interface FloatingButtonProps {
  onClick: () => void
}

export function FloatingButton({ onClick }: FloatingButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed left-4 top-4 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-all hover:scale-105"
    >
      <SimApplyMark size="lg" />
    </button>
  )
}
