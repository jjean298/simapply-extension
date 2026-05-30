import "./style.css"
import { useState } from "react"
import { UploadPanel } from "./components/UploadPanel"
import { ResumeWorkspace } from "./components/ResumeWorkspace"

interface WorkspaceInput {
  file: File | null
  resumeText: string
  jobPosting: string
}

export default function SidePanel() {
  const [workspaceInput, setWorkspaceInput] = useState<WorkspaceInput | null>(
    null
  )

  return (
    <div className="min-h-screen bg-[color:var(--app-bg)] p-4 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-4xl">
        {workspaceInput ? (
          <ResumeWorkspace
            file={workspaceInput.file}
            initialResumeText={workspaceInput.resumeText}
            jobPosting={workspaceInput.jobPosting}
            onReset={() => setWorkspaceInput(null)}
          />
        ) : (
          <UploadPanel onContinue={setWorkspaceInput} />
        )}
      </div>
    </div>
  )
}
