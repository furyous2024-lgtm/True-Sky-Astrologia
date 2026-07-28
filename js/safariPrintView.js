// ============================================
// Safari / mobile-safe Print View Handler
// Purpose: open a stable print/save window with explicit PDF/print and image buttons.
// ============================================

import { buildPrintWindowBridgeScript, buildSafeExportFileName, buttonCss, escapeHtml, normalizeZodiacTextLabels, openInlinePrintFallback } from "./printExportShared.js?v=DELTA_SYNASTRY_FIX_20260617";

/**
 * Check if browser is Safari.
 */
export function isSafariMode() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * Open chart in a dedicated view with Save PDF / Print and Save Image buttons.
 * @param {string} chartId - ID of chart container (e.g., 'synastry-chart')
 * @param {string} chartTitle - Title for window (e.g., 'Synastry Chart')
 * @param {function} [modifyTitle] - Optional function to modify title text before printing
 */
export function openSafariPrintView(chartId, chartTitle, modifyTitle) {
  const chart = document.getElementById(chartId);
  if (!chart) return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Open immediately on the click. If the browser blocks popups/PWA windows,
  // we fall back to an in-page printable view below.
  const printWindow = window.open("about:blank", "_blank", "width=1000,height=1000,scrollbars=yes,resizable=yes");

  const chartClone = chart.cloneNode(true);

  if (modifyTitle) {
    const titleText = chartClone.querySelector("svg .birth-details text");
    if (titleText) modifyTitle(titleText);
  }

  normalizeZodiacTextLabels(chartClone);

  const hiddenElements = chartClone.querySelectorAll(
    ".birth-details, .birth-details-left, .birth-details-right, " +
      ".birth-details-center, .system-details"
  );

  hiddenElements.forEach((el) => {
    el.style.display = "block";
    el.style.visibility = "visible";
    el.style.opacity = "1";
    el.removeAttribute("display");

    const textElements = el.querySelectorAll("text");
    textElements.forEach((text) => {
      text.style.display = "block";
      text.style.visibility = "visible";
      text.style.opacity = "1";
    });
  });

  const svgElement = chartClone.querySelector("svg");
  if (svgElement) {
    const currentViewBox = svgElement.getAttribute("viewBox");
    if (currentViewBox) {
      const parts = currentViewBox.split(" ");
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]) - 180;
      const width = parseFloat(parts[2]);
      const height = parseFloat(parts[3]) + 400;
      svgElement.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    } else {
      svgElement.setAttribute("viewBox", "0 -250 1000 1400");
    }

    svgElement.setAttribute("width", "1000");
    svgElement.setAttribute("height", "1330");
  }

  const exportFileName = buildSafeExportFileName(chartTitle);

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(chartTitle)}</title>
      <link rel="stylesheet" href="css/styles.css">
      <style>
        .birth-details,
        .birth-details-left,
        .birth-details-right,
        .birth-details-center,
        .system-details {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .birth-details text,
        .birth-details-left text,
        .birth-details-right text,
        .birth-details-center text,
        .system-details text {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        body {
          margin: 0;
          padding: 20px;
          background: white;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          box-sizing: border-box;
        }
        #${chartId} {
          position: static !important;
          width: 100%;
          max-width: 900px;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
          box-sizing: border-box;
        }
        #${chartId} svg {
          width: 100%;
          height: auto;
          max-width: 900px;
          overflow: visible !important;
        }

        /* Biwheel modes for triwheel chart - Progressions only (2 wheels) */
        #triwheel-chart.biwheel-progressions { overflow: visible !important; }
        #triwheel-chart.biwheel-progressions .outer-wheel,
        #triwheel-chart.biwheel-progressions .transits,
        #triwheel-chart.biwheel-progressions .transits-middle { display: none !important; }
        #triwheel-chart.biwheel-progressions .house-line-full { display: none !important; }
        #triwheel-chart.biwheel-progressions .house-line-short { display: initial !important; }
        #triwheel-chart.biwheel-progressions .triwheel-default { display: none !important; }
        #triwheel-chart.biwheel-progressions .triwheel-progressions { display: initial !important; }
        #triwheel-chart.biwheel-progressions .triwheel-transits { display: none !important; }

        /* Biwheel modes for triwheel chart - Transits only (2 wheels) */
        #triwheel-chart.biwheel-transits { overflow: visible !important; }
        #triwheel-chart.biwheel-transits .outer-wheel,
        #triwheel-chart.biwheel-transits .transits,
        #triwheel-chart.biwheel-transits .progressions { display: none !important; }
        #triwheel-chart.biwheel-transits .transits-middle { display: initial !important; }
        #triwheel-chart.biwheel-transits .house-line-full { display: none !important; }
        #triwheel-chart.biwheel-transits .house-line-short { display: initial !important; }
        #triwheel-chart.biwheel-transits .triwheel-default { display: none !important; }
        #triwheel-chart.biwheel-transits .triwheel-progressions { display: none !important; }
        #triwheel-chart.biwheel-transits .triwheel-transits { display: initial !important; }

        ${
          chartId === "synastry-chart" ||
          chartId === "composite-chart" ||
          chartId === "composite-chart-blank"
            ? `
        #${chartId} .birth-details text,
        #${chartId} .birth-details-left text,
        #${chartId} .birth-details-right text,
        #${chartId} .birth-details-center text {
          font-size: 24px !important;
        }
        `
            : ""
        }

        ${buttonCss(isMobile, true)}

        @media print {
          body { padding: 0 !important; margin: 0 !important; display: block !important; min-height: 0 !important; }
          #${chartId} {
            transform: scale(${isMobile ? "1" : "0.95"});
            transform-origin: top center;
            padding: 0;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          #${chartId} svg { width: 100%; height: auto; max-width: 100%; }
          body * { visibility: visible !important; }
          @page { margin: 12mm; }
        }
      </style>
    </head>
    <body>
      <button class="close-window-button" type="button" data-action="close">Close View</button>
      <button class="print-trigger-button" type="button" data-action="print">Save PDF / Print</button>
      <button class="image-save-button" type="button" data-action="save-image">Save Image</button>
      <div class="export-status" data-export-status></div>
      ${chartClone.outerHTML}
      ${buildPrintWindowBridgeScript(chartId, exportFileName)}
    </body>
    </html>
  `;

  if (!printWindow) {
    openInlinePrintFallback({
      title: chartTitle,
      contentHtml: chartClone.outerHTML,
      chartId,
      fileName: exportFileName,
      includeImageButton: true,
    });
    return;
  }

  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
}
