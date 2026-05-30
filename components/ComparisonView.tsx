import { ResumeViewer } from './ResumeViewer';
import { ResumeEditor } from './ResumeEditor';
import { X, Sparkles } from 'lucide-react';

interface Suggestion {
  type: 'fix' | 'good' | 'add';
  text: string;
  suggestion?: string;
}

interface ComparisonViewProps {
  originalContent: string;
  editedContent: string;
  suggestions: Suggestion[];
  onContentChange: (content: string) => void;
  onClose: () => void;
  onDownload: () => void;
}

export function ComparisonView({
  originalContent,
  editedContent,
  suggestions,
  onContentChange,
  onClose,
  onDownload
}: ComparisonViewProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="bg-gradient-to-r from-yellow-500 via-blue-500 to-black p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Simapply</h1>
            <p className="text-xs text-gray-200">AI-Powered Resume Tailoring</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-0.5 bg-gray-700 overflow-hidden">
        <div className="flex flex-col bg-gray-950">
          <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-white">AI Recommendations</h3>
            <p className="text-xs text-gray-400 mt-1">
              <span className="text-red-400">Red</span> = Suggested fixes •
              <span className="text-green-400 ml-1">Green</span> = Keep this
            </p>
          </div>
          <ResumeViewer content={originalContent} suggestions={suggestions} />
        </div>

        <div className="flex flex-col bg-gray-950">
          <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-white">Edit Your Resume</h3>
            <p className="text-xs text-gray-400 mt-1">Make changes and download when ready</p>
          </div>
          <ResumeEditor
            content={editedContent}
            onChange={onContentChange}
            onDownload={onDownload}
          />
        </div>
      </div>
    </div>
  );
}
