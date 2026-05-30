interface SimApplyMarkProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeClasses = {
  sm: {
    shell: "h-11 w-11",
    icon: "h-6 w-6"
  },
  md: {
    shell: "h-12 w-12",
    icon: "h-7 w-7"
  },
  lg: {
    shell: "h-14 w-14",
    icon: "h-8 w-8"
  }
} as const

export function SimApplyMark({
  size = "md",
  className = ""
}: SimApplyMarkProps) {
  const styles = sizeClasses[size]

  return (
    <div
      className={`simapply-mark ${styles.shell} ${className}`.trim()}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 32 32"
        className={styles.icon}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M15.8 6.5C16.1 6.5 16.3 6.7 16.4 7L17.8 13.1C17.9 13.6 18.3 14 18.8 14.1L24.9 15.5C25.2 15.6 25.4 15.8 25.4 16.1C25.4 16.4 25.2 16.6 24.9 16.7L18.8 18.1C18.3 18.2 17.9 18.6 17.8 19.1L16.4 25.2C16.3 25.5 16.1 25.7 15.8 25.7C15.5 25.7 15.3 25.5 15.2 25.2L13.8 19.1C13.7 18.6 13.3 18.2 12.8 18.1L6.7 16.7C6.4 16.6 6.2 16.4 6.2 16.1C6.2 15.8 6.4 15.6 6.7 15.5L12.8 14.1C13.3 14 13.7 13.6 13.8 13.1L15.2 7C15.3 6.7 15.5 6.5 15.8 6.5Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M23.9 6.2V10.4"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M21.8 8.3H26"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M9.2 22.2V25.2"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M7.7 23.7H10.7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
