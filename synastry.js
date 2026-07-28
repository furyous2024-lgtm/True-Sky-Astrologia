"use strict";

import { sharedNatal } from "./sharedNatal.js?v=DELTA_SYNASTRY_FIX_20260617";
import { openSafariPrintView, isSafariMode } from "./js/safariPrintView.js?v=DELTA_SYNASTRY_FIX_20260617";

document.addEventListener("DOMContentLoaded", function () {
  const svgContainer = d3.select("#synastry-chart");

  // Move house circles closer to center
  const signInner = 2.27;
  const houseOuter = 7.5;
  const houseInner = 9;
  const houseNumber = `16px`;
  const planetCircle = 4.2;
  const innerWheel = 0.64;
  const middleWheel = false;
  const innerPlanet = 1;
  const centerPlanet = 3.25;
  const outerPlanet = 2.5;
  const removeHouseTicks = true;

  // Call sharedNatal with the custom parameters for synastry chart
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
    "synastry"
  );

  const person2FieldIds = [
    "synastryName",
    "synastryDay",
    "synastryMonth",
    "synastryYear",
    "synastryHour",
    "synastryMinute",
    "synastryLocation",
  ];

  function clearSynastryPerson2Fields() {
    person2FieldIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  function hasSynastryPerson2Fields() {
    return person2FieldIds.some((id) => String(document.getElementById(id)?.value || "").trim() !== "");
  }

  function getStoredNatalData() {
    try {
      return JSON.parse(localStorage.getItem("natalData") || "null");
    } catch (_) {
      return null;
    }
  }

  function hasMainCalculation() {
    const storedNatalData = getStoredNatalData();
    return Boolean(
      storedNatalData && storedNatalData.day && storedNatalData.month && storedNatalData.year
    );
  }

  function submitSynastryBaseOnly({ clearPerson2 = false } = {}) {
    const form = document.getElementById("synastryForm");
    if (!form) return;

    if (clearPerson2) clearSynastryPerson2Fields();

    const errorMessage = document.querySelector(".errorMessageSynastry");
    if (errorMessage) errorMessage.textContent = "";

    if (!hasMainCalculation()) {
      window.synastryPlanets = [];
      window.synastryData = null;
      localStorage.removeItem("synastryData");
      d3.select("#synastry-chart").selectAll("*").remove();
      return;
    }

    // Only wipe Person 2 state when no Person 2 has been entered. This keeps
    // saved/typed synastry data from disappearing just because the user opens
    // the tab or recalculates the Main chart.
    if (!hasSynastryPerson2Fields()) {
      window.synastryPlanets = [];
      window.synastryData = null;
      localStorage.removeItem("synastryData");
    }

    form.dataset.baseOnly = "true";
    setTimeout(() => {
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }, 0);
  }

  function openSynastryBaseOrBlank() {
    const form = document.getElementById("synastryForm");
    if (!form) return;

    // If Person 2 is already filled/rendered, leave the completed synastry intact.
    // Otherwise show the Main chart immediately as Person 1 with its first aspects.
    if (!hasSynastryPerson2Fields() || !window.synastryPlanets?.length) {
      submitSynastryBaseOnly({ clearPerson2: false });
    }
  }

  document.addEventListener("synastry:shown", openSynastryBaseOrBlank);

  let baseRenderTimer = null;
  function scheduleSynastryBaseRender() {
    if (baseRenderTimer) clearTimeout(baseRenderTimer);
    baseRenderTimer = setTimeout(() => {
      if (!hasSynastryPerson2Fields()) {
        submitSynastryBaseOnly({ clearPerson2: false });
      }
    }, 60);
  }

  // After a Main/Natal Calculate, pre-render the first person in the synastry
  // wheel too, so opening Synastry already shows Person 1 and the first aspects.
  ["mainChartBaseUpdated", "mainChartPlanetsUpdated", "natalChartComplete"].forEach((eventName) => {
    document.addEventListener(eventName, scheduleSynastryBaseRender);
  });

  document.getElementById("synastryCalculate")?.addEventListener("click", () => {
    const form = document.getElementById("synastryForm");
    if (form) form.dataset.baseOnly = "false";
  });

  if (document.getElementById("showSynastry")?.style.display !== "none") {
    openSynastryBaseOrBlank();
  }
});

// Print synastry chart
document.getElementById("synastryPrint").addEventListener("click", function () {
  const chart = document.getElementById("synastry-chart");
  if (!chart) return;

  openSafariPrintView("synastry-chart", "Synastry Chart");
});

// Synastry report
document.getElementById("synastryReport")?.addEventListener("click", function () {
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
        // Call the synastry report generation function
        window.generateSynastryReport(printWindow);
      }
    })
    .catch((error) => {
      if (printWindow) printWindow.close();
      console.error("Error preparing report:", error);
    });
});
