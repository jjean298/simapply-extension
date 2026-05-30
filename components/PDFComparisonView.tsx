import { useState, useEffect, useRef } from 'react';
import { SimplePDFViewer } from './SimplePDFViewer';
import { EditablePDFView } from './EditablePDFView';
import { X, Sparkles, Download } from 'lucide-react';
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import { parseFormattedLine, getAlignment, TextSegment } from '../utils/textFormatting';

interface Suggestion {
  pageNumber: number;
  type: 'fix' | 'good';
  text: string;
  suggestion?: string;
  position?: { x: number; y: number; width: number; height: number };
}

interface PDFComparisonViewProps {
  file: File;
  jobPosting: string;
  suggestions: Suggestion[];
  onClose: () => void;
}

export function PDFComparisonView({ file, jobPosting, suggestions, onClose }: PDFComparisonViewProps) {
  const [editedContent, setEditedContent] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    // Clamp between 20% and 80%
    const clampedPercentage = Math.min(Math.max(percentage, 20), 80);
    setLeftPanelWidth(clampedPercentage);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, leftPanelWidth]);

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      if (!editedContent || editedContent.trim().length === 0) {
        alert('No content to download. Please make edits first.');
        setIsDownloading(false);
        return;
      }

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
      const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

      const pageWidth = 612; // 8.5 inches
      const pageHeight = 792; // 11 inches
      const margin = 60; // Slightly larger margin for visible white space
      const bottomMargin = 20; // Much smaller bottom margin to prevent cutoff
      const maxWidth = pageWidth - (margin * 2);

      // Split by page breaks
      const pages = editedContent.split('---PAGE BREAK---').filter(p => p.trim());

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const pageContent = pages[pageIndex];
        let page = pdfDoc.addPage([pageWidth, pageHeight]);
        let yPosition = pageHeight - margin;

        const lines = pageContent.split('\n');

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          const trimmedLine = line.trim();

          // Skip completely empty lines but add minimal spacing
          if (!trimmedLine) {
            yPosition -= 4; // Smaller gap for empty lines
            continue;
          }

          // Get alignment, spacing, and clean line
          const { alignment, cleanedLine, spacing } = getAlignment(trimmedLine);
          const customLineSpacing = spacing || 1.2; // Use custom spacing or default

          // Parse formatted segments
          const segments = parseFormattedLine(cleanedLine);

          // URL detection regex for auto-detected URLs
          const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.(com|org|net|edu|io|co|dev|ai|us|uk|ca)[^\s,]*)/gi;

          // Detect line type for default formatting
          const isName = i === 0 && cleanedLine.length < 40 && !cleanedLine.includes('@');
          const isHeader = cleanedLine === cleanedLine.toUpperCase() && cleanedLine.length < 50 && cleanedLine.length > 3;
          const isBullet = cleanedLine.startsWith('•') || cleanedLine.startsWith('-');
          const isJobTitle = !isBullet && cleanedLine.length < 80 && !cleanedLine.includes('@') &&
                            (cleanedLine.includes('Engineer') || cleanedLine.includes('Developer') ||
                             cleanedLine.includes('Manager') || cleanedLine.includes('Analyst') ||
                             cleanedLine.includes('Intern') || cleanedLine.includes('Designer'));

          // Base font size
          let baseFontSize = 10.5;
          let defaultBold = false;

          if (isName) {
            defaultBold = true;
            baseFontSize = 14;
          } else if (isHeader) {
            defaultBold = true;
            baseFontSize = 11;
          } else if (isJobTitle) {
            defaultBold = true;
            baseFontSize = 10.5;
          }

          // Add smaller spacing before headers
          if (isHeader && i > 0) {
            yPosition -= 5;
          }

          // Check if we need a new page - use small bottom margin
          if (yPosition < bottomMargin + baseFontSize) {
            page = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }

          // Helper function to get font based on formatting
          const getFont = (seg: TextSegment): PDFFont => {
            const isBold = seg.bold || defaultBold;
            const isItalic = seg.italic;

            if (isBold && isItalic) return boldItalicFont;
            if (isBold) return boldFont;
            if (isItalic) return italicFont;
            return font;
          };

          // Group segments by inline alignment
          const leftSegs = segments.filter(s => !s.align || s.align === 'left');
          const centerSegs = segments.filter(s => s.align === 'center');
          const rightSegs = segments.filter(s => s.align === 'right');

          // Helper to render a group of segments at a specific x position
          const renderSegments = (segs: TextSegment[], startX: number) => {
            let currentX = startX;
            const maxX = pageWidth - margin; // Right boundary
            const indentAmount = 30; // 30pt indent

            for (let segIdx = 0; segIdx < segs.length; segIdx++) {
              const seg = segs[segIdx];
              const segFont = getFont(seg);

              // Apply indentation if needed
              if (seg.indent && segIdx === 0) {
                currentX += indentAmount;
              }

              // Clean text to remove special characters that can't be encoded
              const cleanText = seg.text
                .replace(/▸/g, '>')
                .replace(/★/g, '*')
                .replace(/✓/g, 'v')
                .replace(/◆/g, '+')
                .replace(/■/g, '-')
                .replace(/●/g, '•')
                .replace(/⬤/g, '•')
                .replace(/∗/g, '*'); // Asterisk operator → regular asterisk

              const words = cleanText.split(' ');

              for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
                const word = words[wordIdx];
                const isUrl = !seg.link && urlRegex.test(word);
                urlRegex.lastIndex = 0;

                const wordText = word + (wordIdx < words.length - 1 ? ' ' : '');
                const wordWidth = segFont.widthOfTextAtSize(wordText, baseFontSize);

                // Strict bounds check - don't exceed right margin
                if (currentX + wordWidth > maxX) {
                  // Wrap to next line instead of skipping
                  yPosition -= baseFontSize * customLineSpacing;
                  currentX = margin;

                  // Check for page break after wrapping
                  if (yPosition < bottomMargin + baseFontSize) {
                    page = pdfDoc.addPage([pageWidth, pageHeight]);
                    yPosition = pageHeight - margin;
                  }
                }

                // Draw the word
                page.drawText(wordText, {
                  x: currentX,
                  y: yPosition,
                  size: baseFontSize,
                  font: segFont,
                  color: rgb(0, 0, 0),
                });

                // Underline if needed
                if (seg.underline || isUrl || seg.link) {
                  page.drawLine({
                    start: { x: currentX, y: yPosition - 1 },
                    end: { x: currentX + wordWidth, y: yPosition - 1 },
                    thickness: 0.5,
                    color: rgb(0, 0, 0),
                  });
                }

                currentX += wordWidth;
              }

              // Add space between segments
              if (segIdx < segs.length - 1) {
                currentX += segFont.widthOfTextAtSize(' ', baseFontSize);
              }
            }
            return currentX;
          };

          // Calculate widths for each group - must match rendering exactly
          const getSegmentsWidth = (segs: TextSegment[]) => {
            let totalWidth = 0;
            for (let segIdx = 0; segIdx < segs.length; segIdx++) {
              const seg = segs[segIdx];
              const segFont = getFont(seg);
              const words = seg.text.split(' ');

              // Calculate exactly as we render: word by word with spaces
              for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
                const word = words[wordIdx];
                const wordText = word + (wordIdx < words.length - 1 ? ' ' : '');
                totalWidth += segFont.widthOfTextAtSize(wordText, baseFontSize);
              }

              // Add space between segments if not the last one
              if (segIdx < segs.length - 1) {
                totalWidth += segFont.widthOfTextAtSize(' ', baseFontSize);
              }
            }
            return totalWidth;
          };

          // If we have inline alignments, render them separately
          if (centerSegs.length > 0 || rightSegs.length > 0) {
            // Render left-aligned text
            if (leftSegs.length > 0) {
              const startX = margin;
              renderSegments(leftSegs, startX);
            }

            // Render center-aligned text
            if (centerSegs.length > 0) {
              const centerWidth = getSegmentsWidth(centerSegs);
              const startX = Math.max(margin, (pageWidth - centerWidth) / 2);
              renderSegments(centerSegs, startX);
            }

            // Render right-aligned text
            if (rightSegs.length > 0) {
              const rightWidth = getSegmentsWidth(rightSegs);
              const startX = Math.max(margin, pageWidth - margin - rightWidth);
              renderSegments(rightSegs, startX);
            }
          } else {
            // No inline alignment, use line-level alignment
            let totalLineWidth = getSegmentsWidth(segments);

            let xPosition = margin;
            if (alignment === 'center') {
              xPosition = (pageWidth - totalLineWidth) / 2;
            } else if (alignment === 'right') {
              xPosition = pageWidth - margin - totalLineWidth;
            }

            renderSegments(segments, xPosition);
          }

          // Apply line spacing (custom or default)
          yPosition -= baseFontSize * customLineSpacing;
        }
      }

      // Save and download
      const pdfBytes = await pdfDoc.save()
const arrayBuffer = pdfBytes.buffer.slice(
  pdfBytes.byteOffset,
  pdfBytes.byteOffset + pdfBytes.byteLength
) as ArrayBuffer

const blob = new Blob([arrayBuffer], { type: "application/pdf" })
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tailored-resume.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

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

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 text-white font-semibold rounded-lg transition-colors shadow-lg flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </button>

          <button
            onClick={onClose}
            className="w-8 h-8 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 flex bg-gray-700 overflow-hidden relative"
      >
        {/* Left Side: Original Resume */}
        <div className="flex flex-col bg-gray-950 overflow-hidden" style={{ width: `${leftPanelWidth}%` }}>
          <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-white">Original Resume</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <SimplePDFViewer file={file} />
          </div>
        </div>

        {/* Draggable Divider */}
        <div
          className={`w-1 ${isDragging ? 'bg-yellow-400' : 'bg-gray-600 hover:bg-yellow-400'} cursor-col-resize transition-colors relative z-10 flex items-center justify-center`}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-2 -right-2" />
          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-12 bg-gray-400 rounded-full pointer-events-none" />
        </div>

        {/* Right Side: Editable Resume */}
        <div className="flex flex-col bg-gray-950 overflow-hidden flex-1">
          <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-white">Your Resume (Editable)</h3>
          </div>
          <div className="flex-1 overflow-hidden">
            <EditablePDFView file={file} onTextChange={setEditedContent} />
          </div>
        </div>
      </div>
    </div>
  );
}
