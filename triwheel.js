"use strict";

import { sharedNatal } from "./sharedNatal.js?v=DELTA_SYNASTRY_FIX_20260617";
import { openSafariPrintView, isSafariMode } from "./js/safariPrintView.js?v=DELTA_SYNASTRY_FIX_20260617";

let triwheelRendered = false;
function initializeTriwheel() {
  if (triwheelRendered) return;
  const svgContainer = d3.select("#triwheel-chart");

  // Move house circles closer to center
  const signInner = 2.27;
  const houseOuter = 7.5;
  const houseInner = 9;
  const houseNumber = `16px`;
  const planetCircle = 5;
  const innerWheel = 0.55;
  const middleWheel = 0.765;
  const innerPlanet = 0.8;
  const centerPlanet = 3.25;
  const outerPlanet = 2.44;
  const removeHouseTicks = true;

  // Call sharedNatal with the custom parameters for triwheel chart
  sharedNatal(
    svgContainer,
    signInner,
    houseOuter,
    houseInner,
    houseNumber,
    planetCircle,
    innerWheel,
    middleWheel,
    innerPlanet,
    centerPlanet,
    outerPlanet,
    removeHouseTicks,
    "triwheel"
  );
  triwheelRendered = true;
}

function isTriwheelSectionVisible() {
  const section = document.getElementById("showTriwheel");
  return !!section && section.style.display !== "none";
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function clearTriwheelStartupState() {
  window.progressedPlanets = [];
  window.transitPlanets = [];
  const chart = document.getElementById("triwheel-chart");
  if (chart && !chart.querySelector("svg")) {
    initializeTriwheel();
  }
}

function showTriwheelBaseOrBlank() {
  if (!isTriwheelSectionVisible()) return;
  clearTriwheelStartupState();

  const form = document.getElementById("triwheelForm");
  const storedNatalData = JSON.parse(localStorage.getItem("natalData") || "null");
  const hasMainCalculation =
    storedNatalData && storedNatalData.day && storedNatalData.month && storedNatalData.year;

  // After MAIN is calculated, TRANSIT opens with the first/main circle already
  // drawn. The progression and transit circles stay empty until this form is
  // filled and calculated.
  if (form && hasMainCalculation) {
    form.dataset.baseOnly = "true";
    setTimeout(() => {
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }, 0);
  }
}

document.addEventListener("triwheel:shown", showTriwheelBaseOrBlank);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    if (isTriwheelSectionVisible()) showTriwheelBaseOrBlank();
  });
} else if (isTriwheelSectionVisible()) {
  showTriwheelBaseOrBlank();
}

// Print triwheel chart
document.getElementById("triwheelPrint").addEventListener("click", function () {
  const chart = document.getElementById("triwheel-chart");
  if (!chart) return;

  // Determine label based on selected wheel mode
  const getWheelModeLabel = () => {
    if (chart.classList.contains("biwheel-progressions")) return "Progressions";
    if (chart.classList.contains("biwheel-transits")) return "Transits";
    return "Multiwheel";
  };
  const wheelModeLabel = getWheelModeLabel();

  // Open a dedicated print view for the triwheel chart.
  // This provides a clean preview and print button on all browsers.
  openSafariPrintView("triwheel-chart", "Triwheel Chart", (titleText) => {
    if (!titleText.dataset.originalText) {
      titleText.dataset.originalText = titleText.textContent;
    }
    titleText.textContent = `${titleText.dataset.originalText} - ${wheelModeLabel}`;
  });
});

// Triwheel report
document.getElementById("triwheelReport")?.addEventListener("click", function () {
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
        // Call the triwheel report generation function
        window.generateTriwheelReport(printWindow);
      }
    })
    .catch((error) => {
      if (printWindow) printWindow.close();
      console.error("Error preparing report:", error);
    });
});
