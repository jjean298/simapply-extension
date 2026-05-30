import { useEffect, useRef, useState } from "react"
import * as pdfjs from "pdfjs-dist"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString()

interface SimplePDFViewerProps {
  file: File;
  showSuggestions?: boolean;
  onTextExtracted?: (text: string) => void;
}

export function SimplePDFViewer({ file, showSuggestions = false, onTextExtracted }: SimplePDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        if (!containerRef.current) return;

        // Clear previous content
        containerRef.current.innerHTML = '';

        let fullText = '';

        // Render each page
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);

          // Create canvas for this page
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) continue;

          // Set scale to fit viewport width
          const containerWidth = containerRef.current.clientWidth - 40; // Account for padding
          const baseViewport = page.getViewport({ scale: 1.0 });
          const scale = containerWidth / baseViewport.width;
          const viewport = page.getViewport({ scale: Math.min(scale, 1.0) }); // Cap at 1.0 to avoid too large

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.marginBottom = '20px';
          canvas.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
          canvas.style.background = 'white';
          canvas.style.maxWidth = '100%';

          // Render page
          await page.render({
            canvas,
            canvasContext: context,
            viewport: viewport,
          }).promise;

          containerRef.current.appendChild(canvas);

          // Extract text with proper line breaks and spacing
          const textContent = await page.getTextContent();
          const items = textContent.items as any[];

          // Icon/symbol words to filter out
          const iconWords = ['envelope', 'linkedin', 'github', 'phone', 'mail', 'link', 'at'];

          // Helper to detect font style from font name
          const getFontStyle = (fontName: string) => {
            const lower = fontName.toLowerCase();
            const isBold = lower.includes('bold');
            const isItalic = lower.includes('italic') || lower.includes('oblique');
            return { isBold, isItalic };
          };

          // Group items by Y position (lines)
          const lineMap = new Map<number, any[]>();

          items.forEach((item) => {
            const str = item.str.trim();
            // Skip if it's a standalone icon word
            if (iconWords.includes(str.toLowerCase()) && str.length < 15) {
              return;
            }

            const y = Math.round(item.transform[5]); // Y position
            if (!lineMap.has(y)) {
              lineMap.set(y, []);
            }
            lineMap.get(y)!.push(item);
          });

          // Sort lines by Y position (top to bottom)
          const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

          let pageLines: string[] = [];
          let lastY = sortedYs[0];
          const pageWidth = page.getViewport({ scale: 1.0 }).width;

          sortedYs.forEach((y) => {
            const lineItems = lineMap.get(y)!;
            if (lineItems.length === 0) return;

            // Sort items in line by X position (left to right)
            lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

            // Calculate if line is centered (first item starts near center)
            const firstItemX = lineItems[0].transform[4];
            const isCentered = firstItemX > pageWidth * 0.25 && firstItemX < pageWidth * 0.75;

            // Join items with space, but detect if there's a large gap (new section)
            // Group consecutive items with same formatting to avoid **word1** **word2**
            let segments: Array<{ text: string; isBold: boolean; isItalic: boolean; isLargeGap: boolean }> = [];

            lineItems.forEach((item, idx) => {
              const { isBold, isItalic } = getFontStyle(item.fontName || '');
              const prevItem = idx > 0 ? lineItems[idx - 1] : null;
              const gap = prevItem ? item.transform[4] - (prevItem.transform[4] + prevItem.width) : 0;
              const isLargeGap = gap > 20;

              const lastSeg = segments[segments.length - 1];

              // Merge with previous segment if same formatting and not a large gap
              if (lastSeg && lastSeg.isBold === isBold && lastSeg.isItalic === isItalic && !isLargeGap && !lastSeg.isLargeGap) {
                lastSeg.text += ' ' + item.str;
              } else {
                segments.push({ text: item.str, isBold, isItalic, isLargeGap });
              }
            });

            // Build line text from segments
            let lineText = '';
            segments.forEach((seg, idx) => {
              let text = seg.text;

              // Wrap with formatting markers
              if (seg.isBold && seg.isItalic) {
                text = `***${text}***`; // Bold + italic
              } else if (seg.isBold) {
                text = `**${text}**`;
              } else if (seg.isItalic) {
                text = `*${text}*`;
              }

              if (idx === 0) {
                lineText = text;
              } else {
                lineText += (seg.isLargeGap ? '\t' : ' ') + text;
              }
            });

            // Clean up icon words from the line
            let cleanedLine = lineText.trim();
            iconWords.forEach(iconWord => {
              const regex = new RegExp(`\\b${iconWord}\\b`, 'gi');
              cleanedLine = cleanedLine.replace(regex, '').replace(/\s+/g, ' ').trim();
            });

            // Add extra line break if vertical gap is large (new section)
            const yGap = Math.abs(lastY - y);
            if (yGap > 15 && pageLines.length > 0) {
              pageLines.push(''); // Empty line for spacing
            }

            if (cleanedLine) {
              // Mark centered lines with prefix
              if (isCentered) {
                pageLines.push('[CENTER]' + cleanedLine);
              } else {
                pageLines.push(cleanedLine);
              }
            }
            lastY = y;
          });

          fullText += pageLines.join('\n') + '\n\n---PAGE BREAK---\n\n';
        }

        if (onTextExtracted) {
          onTextExtracted(fullText);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF. Please try another file.');
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [file, onTextExtracted]);

  return (
    <div className="w-full h-full overflow-y-auto bg-gray-800 p-4">
      {isLoading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <p>Loading PDF...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-full">
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-6 py-4 rounded-lg">
            {error}
          </div>
        </div>
      )}

      <div ref={containerRef} className="flex flex-col items-center gap-3"></div>
    </div>
  );
}
