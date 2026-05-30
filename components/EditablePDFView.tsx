import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { SimplePDFViewer } from './SimplePDFViewer';
import { EditedResumePreview } from './EditedResumePreview';
import { RichTextToolbar } from './RichTextToolbar';

interface EditablePDFViewProps {
  file: File;
  onTextChange?: (text: string) => void;
}

interface HistoryState {
  text: string;
  cursorPosition: number;
}

export function EditablePDFView({ file, onTextChange }: EditablePDFViewProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [hasEdits, setHasEdits] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Undo/Redo history
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  const handleTextExtracted = (text: string) => {
    // Only set initial text if we haven't made edits yet
    if (!hasEdits) {
      setExtractedText(text);
      if (onTextChange) {
        onTextChange(text);
      }
      // Initialize history with extracted text
      setHistory([{ text, cursorPosition: 0 }]);
      setHistoryIndex(0);
    }
  };

  // Add to history when text changes (but not during undo/redo)
  const addToHistory = (text: string, cursorPosition: number) => {
    if (isUndoRedoRef.current) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ text, cursorPosition });

    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    } else {
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setExtractedText(newText);
    setHasEdits(true);
    if (onTextChange) {
      onTextChange(newText);
    }

    // Add to history
    const cursorPosition = e.target.selectionStart;
    addToHistory(newText, cursorPosition);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      setExtractedText(previousState.text);
      setHistoryIndex(newIndex);
      setHasEdits(true);
      if (onTextChange) {
        onTextChange(previousState.text);
      }

      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(previousState.cursorPosition, previousState.cursorPosition);
          textareaRef.current.focus();
        }
        isUndoRedoRef.current = false;
      }, 0);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      setExtractedText(nextState.text);
      setHistoryIndex(newIndex);
      setHasEdits(true);
      if (onTextChange) {
        onTextChange(nextState.text);
      }

      // Restore cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(nextState.cursorPosition, nextState.cursorPosition);
          textareaRef.current.focus();
        }
        isUndoRedoRef.current = false;
      }, 0);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };

    if (isEditMode) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isEditMode, historyIndex, history]);


  const handleFormat = (format: string, value?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = extractedText.substring(start, end);

    if (!selectedText && format !== 'spacing' && format !== 'bullet') {
      alert('Please select text first');
      return;
    }

    let formattedText = '';
    let newText = '';

    switch (format) {
      case 'bold':
        // Check if already italic
        if (selectedText.startsWith('*') && selectedText.endsWith('*') && !selectedText.startsWith('**')) {
          // Already italic, make it bold+italic
          const innerText = selectedText.slice(1, -1);
          formattedText = `***${innerText}***`;
        } else if (selectedText.startsWith('**') && selectedText.endsWith('**')) {
          // Already bold, remove it
          formattedText = selectedText.slice(2, -2);
        } else if (selectedText.startsWith('***') && selectedText.endsWith('***')) {
          // Already bold+italic, remove bold
          const innerText = selectedText.slice(3, -3);
          formattedText = `*${innerText}*`;
        } else {
          formattedText = `**${selectedText}**`;
        }
        break;
      case 'italic':
        // Check if already bold
        if (selectedText.startsWith('**') && selectedText.endsWith('**') && !selectedText.startsWith('***')) {
          // Already bold, make it bold+italic
          const innerText = selectedText.slice(2, -2);
          formattedText = `***${innerText}***`;
        } else if (selectedText.startsWith('*') && selectedText.endsWith('*') && !selectedText.startsWith('**')) {
          // Already italic, remove it
          formattedText = selectedText.slice(1, -1);
        } else if (selectedText.startsWith('***') && selectedText.endsWith('***')) {
          // Already bold+italic, remove italic
          const innerText = selectedText.slice(3, -3);
          formattedText = `**${innerText}**`;
        } else {
          formattedText = `*${selectedText}*`;
        }
        break;
      case 'underline':
        // Toggle underline
        if (selectedText.startsWith('__') && selectedText.endsWith('__')) {
          formattedText = selectedText.slice(2, -2);
        } else {
          formattedText = `__${selectedText}__`;
        }
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          formattedText = `[${selectedText}](${url})`;
        } else {
          return;
        }
        break;
      case 'left':
        formattedText = `[L:${selectedText}]`;
        break;
      case 'center':
        formattedText = `[C:${selectedText}]`;
        break;
      case 'right':
        formattedText = `[R:${selectedText}]`;
        break;
      case 'justify':
        // For justify, apply to entire line
        const beforeJustify = extractedText.substring(0, start);
        const afterJustify = extractedText.substring(end);
        const lineStartJustify = beforeJustify.lastIndexOf('\n') + 1;
        const lineEndJustify = afterJustify.indexOf('\n');
        const fullLineJustify = extractedText.substring(lineStartJustify, lineEndJustify === -1 ? extractedText.length : end + lineEndJustify);
        const cleanedLineJustify = fullLineJustify.replace(/^\[JUSTIFY\]\s*/, '');
        newText = extractedText.substring(0, lineStartJustify) + '[JUSTIFY]' + cleanedLineJustify + (lineEndJustify === -1 ? '' : extractedText.substring(end + lineEndJustify));
        setExtractedText(newText);
        setHasEdits(true);
        if (onTextChange) onTextChange(newText);
        addToHistory(newText, start);
        return;
      case 'indent':
        formattedText = `[INDENT:${selectedText}]`;
        break;
      case 'bullet':
        // Add bullet to the beginning of selected text or current line
        const bulletChar = value || '•';
        if (selectedText) {
          // Text is selected - prepend bullet to selection
          formattedText = `${bulletChar} ${selectedText}`;
        } else {
          // No selection - add bullet to beginning of current line
          const beforeBullet = extractedText.substring(0, start);
          const afterBullet = extractedText.substring(end);
          const lineStartBullet = beforeBullet.lastIndexOf('\n') + 1;
          const lineEndBullet = afterBullet.indexOf('\n');
          const currentLine = extractedText.substring(lineStartBullet, lineEndBullet === -1 ? extractedText.length : end + lineEndBullet);

          // Check if line already has a bullet
          const hasBullet = /^[•●⬤▸★✓■◆\-\+\*>]\s/.test(currentLine.trim());
          if (hasBullet) {
            // Replace existing bullet
            const cleanedLine = currentLine.trim().replace(/^[•●⬤▸★✓■◆\-\+\*>]\s/, '');
            newText = extractedText.substring(0, lineStartBullet) + `${bulletChar} ${cleanedLine}` + (lineEndBullet === -1 ? '' : extractedText.substring(end + lineEndBullet));
          } else {
            // Add new bullet
            newText = extractedText.substring(0, lineStartBullet) + `${bulletChar} ${currentLine.trim()}` + (lineEndBullet === -1 ? '' : extractedText.substring(end + lineEndBullet));
          }
          setExtractedText(newText);
          setHasEdits(true);
          if (onTextChange) onTextChange(newText);
          addToHistory(newText, start);
          return;
        }
        break;
      case 'spacing':
        // Apply spacing to current line
        const spacingValue = value || '1.5';
        const beforeSpacing = extractedText.substring(0, start);
        const afterSpacing = extractedText.substring(end);
        const lineStartSpacing = beforeSpacing.lastIndexOf('\n') + 1;
        const lineEndSpacing = afterSpacing.indexOf('\n');
        const fullLineSpacing = extractedText.substring(lineStartSpacing, lineEndSpacing === -1 ? extractedText.length : end + lineEndSpacing);
        const cleanedLineSpacing = fullLineSpacing.replace(/^\[SPACING:[^\]]+\]\s*/, '');
        newText = extractedText.substring(0, lineStartSpacing) + `[SPACING:${spacingValue}]` + cleanedLineSpacing + (lineEndSpacing === -1 ? '' : extractedText.substring(end + lineEndSpacing));
        setExtractedText(newText);
        setHasEdits(true);
        if (onTextChange) onTextChange(newText);
        addToHistory(newText, start);
        return;
      default:
        return;
    }

    newText = extractedText.substring(0, start) + formattedText + extractedText.substring(end);
    setExtractedText(newText);
    setHasEdits(true);
    if (onTextChange) {
      onTextChange(newText);
    }

    // Add to history
    const newCursorPos = start + formattedText.length;
    addToHistory(newText, newCursorPos);

    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toggle Bar */}
      <div className="bg-gray-900 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditMode(false)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !isEditMode
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            👁️ Preview
          </button>
          <button
            onClick={() => setIsEditMode(true)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isEditMode
                ? 'bg-yellow-400 text-black'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            ✏️ Edit
          </button>
        </div>
        <p className="text-gray-400 text-xs">
          {isEditMode ? 'Editing mode' : hasEdits ? 'Preview of final PDF' : 'Loading original...'}
        </p>
      </div>

      {/* Toolbar - only show in edit mode */}
      {isEditMode && (
        <RichTextToolbar
          onFormat={handleFormat}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
        />
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {isEditMode ? (
          <textarea
            ref={textareaRef}
            value={extractedText}
            onChange={handleTextChange}
            className="w-full h-full p-8 bg-white text-gray-900 font-sans text-sm leading-relaxed resize-none focus:outline-none"
            placeholder="Edit your resume text here..."
          />
        ) : (
          // Show formatted preview as soon as text is extracted
          extractedText ? (
            <EditedResumePreview text={extractedText} originalFile={file} />
          ) : (
            <SimplePDFViewer file={file} onTextExtracted={handleTextExtracted} />
          )
        )}
      </div>
    </div>
  );
}
