"use strict";

import { sharedNatal } from "./sharedNatal.js?v=DELTA_SYNASTRY_FIX_20260617";
import { openSafariPrintView, isSafariMode } from "./js/safariPrintView.js?v=DELTA_SYNASTRY_FIX_20260617";

document.addEventListener("DOMContentLoaded", function () {
  const svgContainer = d3.select("#return-chart");
  sharedNatal(
    svgContainer,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    "return"
  );
});

// Print return chart
document.getElementById("returnPrint").addEventListener("click", function () {
  const chart = document.getElementById("return-chart");
  if (!chart) return;
  const returnType = document.getElementById("adjustType")?.value || "";

  const label = returnType.toLowerCase() === "lunar" ? "Lunar Return" : "Solar Return";
  openSafariPrintView("return-chart", label, (titleText) => {
    if (!titleText.dataset.originalText) {
      titleText.dataset.originalText = titleText.textContent;
    }
    titleText.textContent = `${titleText.dataset.originalText} - ${label}`;
  });
});

// Return report
document.getElementById("returnReport")?.addEventListener("click", function () {
  // Open immediately on the click so View Report is not blocked by async fetch
  const printWindow = window.open(
    "about:blank",
    "_blank",
    "width=1000,height=1200,scrollbars=yes,resizable=yes",
  );
  if (printWindow) {
    printWindow.document.write(
      `<html><body style="font-family:Segoe UI,Arial,sans-serif;padding:24px"><p>Loading report...</p></body></html>`,
    );
  }

  fetch("/view-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  })
    .then((response) => response.json())
    .then((data) => {
      if (false && data.redirectUrl) {
        if (printWindow) printWindow.close();
        window.location.href = data.redirectUrl;
        return;
      }

      if (data.success) {
        // Call the return report generation function
        window.generateReturnReport(printWindow);
      }
    })
    .catch((error) => {
      if (printWindow) printWindow.close();
      console.error("Error preparing report:", error);
    });
});
