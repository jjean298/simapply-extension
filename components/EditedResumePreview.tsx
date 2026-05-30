import { useEffect, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import { parseFormattedLine, getAlignment, TextSegment } from '../utils/textFormatting';
import { DEFAULT_MARGINS, type DocumentMargins } from "../utils/documentLayout"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

interface EditedResumePreviewProps {
  text: string;
  originalFile?: File;
  className?: string;
  margins?: DocumentMargins;
}

export function EditedResumePreview({
  text,
  originalFile,
  className = "",
  margins = DEFAULT_MARGINS
}: EditedResumePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generatePreview = async () => {
      if (!containerRef.current) return;

      try {
        // Create a new PDF from the edited text
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const serifFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        const boldItalicFont = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
        const serifBoldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        const serifItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
        const serifBoldItalicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
        const monoBoldFont = await pdfDoc.embedFont(StandardFonts.CourierBold);
        const monoItalicFont = await pdfDoc.embedFont(StandardFonts.CourierOblique);
        const monoBoldItalicFont = await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);

        const pageWidth = 612; // 8.5 inches
        const pageHeight = 792; // 11 inches
        const { top, right, bottom, left } = margins
        const maxWidth = pageWidth - left - right;

        // Split by page breaks
        const pages = text.split('---PAGE BREAK---').filter(p => p.trim());

        for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
          const pageContent = pages[pageIndex];
          let page = pdfDoc.addPage([pageWidth, pageHeight]);
          let yPosition = pageHeight - top;

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
            if (yPosition < bottom + baseFontSize) {
              page = pdfDoc.addPage([pageWidth, pageHeight]);
              yPosition = pageHeight - top;
            }

            // Helper function to get font based on formatting
            const getFont = (seg: TextSegment): PDFFont => {
              const isBold = seg.bold || defaultBold;
              const isItalic = seg.italic;
              const fontFamily = seg.fontFamily || "sans";

              if (fontFamily === "serif") {
                if (isBold && isItalic) return serifBoldItalicFont;
                if (isBold) return serifBoldFont;
                if (isItalic) return serifItalicFont;
                return serifFont;
              }

              if (fontFamily === "mono") {
                if (isBold && isItalic) return monoBoldItalicFont;
                if (isBold) return monoBoldFont;
                if (isItalic) return monoItalicFont;
                return monoFont;
              }

              if (isBold && isItalic) return boldItalicFont;
              if (isBold) return boldFont;
              if (isItalic) return italicFont;
              return font;
            };

            const getColor = (seg: TextSegment) => {
              switch (seg.color) {
                case "blue":
                  return rgb(0.15, 0.35, 0.75);
                case "green":
                  return rgb(0.1, 0.5, 0.2);
                case "red":
                  return rgb(0.75, 0.2, 0.2);
                case "slate":
                  return rgb(0.28, 0.33, 0.4);
                default:
                  return rgb(0, 0, 0);
              }
            };

            // Group segments by inline alignment
            const leftSegs = segments.filter(s => !s.align || s.align === 'left');
            const centerSegs = segments.filter(s => s.align === 'center');
            const rightSegs = segments.filter(s => s.align === 'right');

            // Helper to render a group of segments at a specific x position
            const renderSegments = (segs: TextSegment[], startX: number) => {
              let currentX = startX;
              const maxX = pageWidth - right;
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
                  const segmentFontSize = seg.fontSize || baseFontSize;
                  const wordWidth = segFont.widthOfTextAtSize(wordText, segmentFontSize);

                  // Strict bounds check - don't exceed right margin
                  if (currentX + wordWidth > maxX) {
                    // Wrap to next line instead of skipping
                    yPosition -= segmentFontSize * customLineSpacing;
                    currentX = left;

                    // Check for page break after wrapping
                    if (yPosition < bottom + segmentFontSize) {
                      page = pdfDoc.addPage([pageWidth, pageHeight]);
                      yPosition = pageHeight - top;
                    }
                  }

                  // Draw the word
                  page.drawText(wordText, {
                    x: currentX,
                    y: yPosition,
                    size: segmentFontSize,
                    font: segFont,
                    color: getColor(seg),
                  });

                  // Underline if needed
                  if (seg.underline || isUrl || seg.link) {
                    page.drawLine({
                      start: { x: currentX, y: yPosition - 1 },
                      end: { x: currentX + wordWidth, y: yPosition - 1 },
                      thickness: 0.5,
                      color: getColor(seg),
                    });
                  }

                  currentX += wordWidth;
                }

                // Add space between segments
                if (segIdx < segs.length - 1) {
                  currentX += segFont.widthOfTextAtSize(' ', seg.fontSize || baseFontSize);
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
                  totalWidth += segFont.widthOfTextAtSize(wordText, seg.fontSize || baseFontSize);
                }

                // Add space between segments if not the last one
                if (segIdx < segs.length - 1) {
                  totalWidth += segFont.widthOfTextAtSize(' ', seg.fontSize || baseFontSize);
                }
              }
              return totalWidth;
            };

            // If we have inline alignments, render them separately
            if (centerSegs.length > 0 || rightSegs.length > 0) {
              // Render left-aligned text
              if (leftSegs.length > 0) {
                const startX = left;
                renderSegments(leftSegs, startX);
              }

              // Render center-aligned text
              if (centerSegs.length > 0) {
                const centerWidth = getSegmentsWidth(centerSegs);
                const startX = Math.max(left, left + (maxWidth - centerWidth) / 2);
                renderSegments(centerSegs, startX);
              }

              // Render right-aligned text
              if (rightSegs.length > 0) {
                const rightWidth = getSegmentsWidth(rightSegs);
                const startX = Math.max(left, pageWidth - right - rightWidth);
                renderSegments(rightSegs, startX);
              }
            } else {
              // No inline alignment, use line-level alignment
              let totalLineWidth = getSegmentsWidth(segments);

              let xPosition = left;
              if (alignment === 'center') {
                xPosition = Math.max(left, left + (maxWidth - totalLineWidth) / 2);
              } else if (alignment === 'right') {
                xPosition = pageWidth - right - totalLineWidth;
              }

              renderSegments(segments, xPosition);
            }

            // Apply line spacing (custom or default)
            yPosition -= baseFontSize * customLineSpacing;
          }
        }

        // Generate PDF bytes and render
        const pdfBytes = await pdfDoc.save()
const pdfArrayBuffer = pdfBytes.buffer.slice(
  pdfBytes.byteOffset,
  pdfBytes.byteOffset + pdfBytes.byteLength
) as ArrayBuffer

const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" })
        const arrayBuffer = await blob.arrayBuffer();

        // Render the generated PDF
        const loadingTask = pdfjs.getDocument({ data: pdfArrayBuffer })
        const pdf = await loadingTask.promise;

        containerRef.current.innerHTML = '';

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          const containerWidth = containerRef.current.clientWidth - 40;
          const baseViewport = page.getViewport({ scale: 1.0 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale: Math.min(scale, 1.0) });

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.marginBottom = '20px';
          canvas.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
          canvas.style.background = 'white';
          canvas.style.maxWidth = '100%';

          await page.render({
            canvas,
            canvasContext: context,
            viewport: viewport,
          }).promise;

          containerRef.current.appendChild(canvas);
        }
      } catch (error) {
        console.error('Error generating preview:', error);
        // Fallback to text display
        if (containerRef.current) {
          containerRef.current.innerHTML = `
            <div class="max-w-3xl mx-auto bg-white shadow-lg p-12">
              <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-900">${text}</pre>
            </div>
          `;
        }
      }
    };

    generatePreview();
  }, [text, originalFile]);

  return (
    <div className={`h-full w-full overflow-y-auto bg-[color:var(--surface-soft)] p-4 ${className}`}>
      <div
        ref={containerRef}
        className="flex flex-col items-center gap-5"
      ></div>
    </div>
  );
}
