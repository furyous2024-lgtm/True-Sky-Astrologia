import { sharedNatal } from "./sharedNatal.js?v=DELTA_SYNASTRY_FIX_20260617";
import { openSafariPrintView, isSafariMode } from "./js/safariPrintView.js?v=DELTA_SYNASTRY_FIX_20260617";

document.addEventListener("DOMContentLoaded", function () {
  const compositeContainerBlank = d3.select("#composite-chart-blank");
  sharedNatal(
    compositeContainerBlank,
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
    "compositeBlank"
  );

  const compositeContainer = d3.select("#composite-chart");
  sharedNatal(
    compositeContainer,
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
    "composite"
  );
});

document
  .getElementById("compositePrint")
  ?.addEventListener("click", function () {
    const chart = document.getElementById("composite-chart");
    const blankChart = document.getElementById("composite-chart-blank");

    // Determine which chart to use based on visibility
    let chartToUse = "composite-chart";
    if (
      blankChart &&
      blankChart.style.display !== "none" &&
      (!chart ||
        chart.style.display === "none" ||
        !chart.querySelector("svg circle"))
    ) {
      chartToUse = "composite-chart-blank";
    }

    if (!document.getElementById(chartToUse)) return;

    // Use a dedicated print view for all browsers.
    openSafariPrintView(chartToUse, "Composite Chart");
  });

// Composite report
document.getElementById("compositeReport")?.addEventListener("click", function () {
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
        // Call the composite report generation function
        window.generateCompositeReport(printWindow);
      }
    })
    .catch((error) => {
      if (printWindow) printWindow.close();
      console.error("Error preparing report:", error);
    });
});
