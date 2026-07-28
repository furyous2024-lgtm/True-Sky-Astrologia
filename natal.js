"use strict";

import { sharedNatal } from "./sharedNatal.js?v=DELTA_SYNASTRY_FIX_20260617";

function initializeNatal() {
  const svgContainer = d3.select("#natal-chart");
  sharedNatal(svgContainer);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNatal);
} else {
  initializeNatal();
}
