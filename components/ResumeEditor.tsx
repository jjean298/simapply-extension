import { Download } from 'lucide-react';
import { useRef } from 'react';
import jsPDF from 'jspdf';

interface ResumeEditorProps {
  content: string;
  onChange: (content: string) => void;
  onDownload: () => void;
}

export function ResumeEditor({ content, onChange, onDownload }: ResumeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleDownload = () => {
    const doc = new jsPDF();
    const lines = content.split('\n');
    let y = 20;

    doc.setFontSize(11);
    lines.forEach((line) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += 7;
    });

    doc.save('tailored-resume.pdf');
    onDownload();
  };

  return (
    <div className="h-full flex flex-col bg-gray-900/30">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 p-6 bg-transparent text-gray-200 font-mono text-sm leading-relaxed resize-none focus:outline-none"
        placeholder="Edit your resume here..."
      />

      <div className="p-4 flex justify-end border-t border-gray-700">
        <button
          onClick={handleDownload}
          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors shadow-lg flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
      </div>
    </div>
  );
}
