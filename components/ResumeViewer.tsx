interface Suggestion {
  type: 'fix' | 'good' | 'add';
  text: string;
  suggestion?: string;
}

interface ResumeViewerProps {
  content: string;
  suggestions: Suggestion[];
}

export function ResumeViewer({ content, suggestions }: ResumeViewerProps) {
  const renderContentWithHighlights = () => {
    const lines = content.split('\n');

    return lines.map((line, index) => {
      const suggestion = suggestions.find(s => s.text === line.trim());

      if (suggestion?.type === 'fix') {
        return (
          <div key={index} className="relative group mb-2">
            {suggestion.suggestion && (
              <div className="text-sm text-green-400 mb-1 italic">
                + {suggestion.suggestion}
              </div>
            )}
            <div className="line-through text-red-400 opacity-75">
              {line}
            </div>
          </div>
        );
      }

      if (suggestion?.type === 'good') {
        return (
          <div key={index} className="bg-green-500/10 border-l-4 border-green-400 pl-3 py-1 mb-2">
            <span className="text-green-300">{line}</span>
          </div>
        );
      }

      return (
        <div key={index} className="text-gray-300 mb-1">
          {line}
        </div>
      );
    });
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-gray-900/50">
      <div className="font-mono text-sm leading-relaxed">
        {renderContentWithHighlights()}
      </div>
    </div>
  );
}
