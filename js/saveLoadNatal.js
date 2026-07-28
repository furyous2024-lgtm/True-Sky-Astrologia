"use strict";

// Helper to clear error messages after a delay (default 5 seconds)
let clearNatalMessageTimeoutId;
const clearNatalMessage = (delay = 5000) => {
  if (clearNatalMessageTimeoutId) {
    clearTimeout(clearNatalMessageTimeoutId);
  }
  clearNatalMessageTimeoutId = setTimeout(() => {
    const errorElem = document.querySelector(".errorMessage");
    if (errorElem) {
      errorElem.textContent = "";
    }
  }, delay);
};

// Helper function to decode HTML entities (for compatibility with saved charts)
function decodeHtmlEntities(str) {
  if (!str) return str;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = str;
  return textarea.value;
}


function ensureNatalHidden(name) {
  const form = document.getElementById("natalForm");
  if (!form) return null;
  let input = form.querySelector(`[name="${name}"]`);
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    form.appendChild(input);
  }
  return input;
}

function applySavedChartGeo(chart) {
  const locInput = document.getElementById("natalLocation");
  const lat = chart.lat ?? chart.latitude;
  const lon = chart.long ?? chart.lon ?? chart.lng ?? chart.longitude;
  const utc = chart.utcOffset ?? chart.utc ?? chart.timezoneOffset ?? chart.utc_offset;
  const timezone = chart.timezone ?? chart.timezoneName ?? "";
  const utcMode = chart.utcMode ?? chart.timezoneMode ?? "auto";

  const pairs = {
    lat,
    latitude: lat,
    long: lon,
    longitude: lon,
    utcOffset: utc,
    utc,
    timezone,
    timezoneName: timezone,
    utcMode,
  };
  Object.entries(pairs).forEach(([name, value]) => {
    const input = ensureNatalHidden(name);
    if (input && value !== undefined && value !== null && String(value).trim() !== "") input.value = String(value);
  });

  if (locInput) {
    if (timezone) locInput.dataset.selectedTimezone = String(timezone);
    locInput.dataset.utcMode = String(utcMode || "auto");
    window.TrueSkyLocationControls?.setUtcMode?.(locInput.closest("form"), locInput, utcMode || "auto");
    if (utc !== undefined && utc !== null && String(utc).trim() !== "") locInput.dataset.selectedUtcFallback = String(utc);
    if (lat !== undefined && lat !== null && lon !== undefined && lon !== null) {
      locInput.dataset.selectedLat = String(lat);
      locInput.dataset.selectedLon = String(lon);
    }
  }
}


function getNatalOverlay() {
  return document.getElementById("loading-overlay");
}

function showNatalOverlay() {
  const overlay = getNatalOverlay();
  if (overlay) overlay.style.display = "block";
}

function hideNatalOverlay() {
  const overlay = getNatalOverlay();
  if (overlay) overlay.style.display = "none";
}

function setNatalMessage(message) {
  const errorElem = document.querySelector(".errorMessage");
  if (errorElem) errorElem.textContent = message || "";
  if (message) clearNatalMessage();
}

function parseNatalJson(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error("Invalid natalData in localStorage:", error);
    return null;
  }
}

function withNatalTimeout(promise, timeoutMs = 12000, label = "operation") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

async function saveNatalChartRequest(chartData) {
  const response = await withNatalTimeout(
    fetch("/save-chart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chartData),
      credentials: "same-origin",
    }),
    12000,
    "Saving birth chart"
  );

  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Resposta inválida ao salvar o Birth Chart.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Resposta inválida ao salvar o Birth Chart.");
  }
  return data;
}

// Track delete confirmation state for natal charts
const deleteConfirmationStateNatal = new Map();

// Recent charts
// Fetch recent charts on page load
document.addEventListener("DOMContentLoaded", fetchRecentCharts);

// Update recent charts list
function updateRecentCharts(charts) {
  const recentChartsList = document.getElementById("recentChartsList");
  recentChartsList.innerHTML = "";
  // Clear confirmation state when updating list
  deleteConfirmationStateNatal.clear();

  charts.forEach((chart) => {
    const listItem = document.createElement("li");

    // Container for the chart text and the delete button
    const chartText = document.createElement("span");
    // Decode HTML entities for proper display in the list
    const displayName = decodeHtmlEntities(chart.name);
    const displayLocation = decodeHtmlEntities(chart.location);
    // Pad minute to 2 digits (e.g., 1 becomes 01)
    const paddedMinute = String(chart.minute).padStart(2, "0");
    chartText.textContent = `${displayName} ${chart.day} ${chart.month} ${chart.year} ${chart.hour}:${paddedMinute} ${displayLocation}`;
    chartText.style.cursor = "pointer";

    // Clicking a saved chart should load the form immediately. Updating the
    // timestamp in Firebase is only a background convenience; the old flow waited
    // for that network request first and caused "Loading saved birth chart timed
    // out" even when the chart data was already available in the list.
    chartText.addEventListener("click", () => {
      showNatalOverlay();

      try {
        document.getElementById("natalName").value = decodeHtmlEntities(chart.name);
        document.getElementById("natalDay").value = chart.day;
        document.getElementById("natalMonth").value = chart.month;
        document.getElementById("natalYear").value = chart.year;
        document.getElementById("natalHour").value = chart.hour;
        document.getElementById("natalMinute").value = String(chart.minute).padStart(2, "0");
        document.getElementById("natalLocation").value = decodeHtmlEntities(chart.location);
        applySavedChartGeo(chart);

        const searchInput = document.getElementById("searchChartsInput");
        if (searchInput) searchInput.value = "";

        document.getElementById("natalCalculate").click();
      } catch (error) {
        hideNatalOverlay();
        const errorContainer = document.querySelector(".errorMessage");
        if (errorContainer) {
          errorContainer.textContent = "Unexpected error loading this Birth Chart.";
          clearNatalMessage();
        }
        console.error("Error loading saved chart:", error);
      }

      withNatalTimeout(fetch("/update-chart-timestamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chart.id }),
        credentials: "same-origin",
      }), 6000, "Updating saved birth chart")
        .then((response) => response.json())
        .then((data) => {
          if (data && data.success && Array.isArray(data.recentCharts)) {
            updateRecentCharts(data.recentCharts);
            document.dispatchEvent(new CustomEvent("chartsUpdated", { detail: { charts: data.recentCharts } }));
          }
        })
        .catch((error) => console.warn("Could not update chart timestamp; chart was loaded anyway:", error));
    });

    // Create the delete "x" button
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "X";
    deleteButton.className = "deleteChartButton";
    deleteButton.addEventListener("mousedown", (event) => {
      event.preventDefault(); // Prevent search field from losing focus
    });
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation(); // Prevent triggering the chartText click event

      const isConfirming = deleteConfirmationStateNatal.get(chart.id);

      if (isConfirming) {
        // Second click - actually delete
        deleteChart(chart.id);
        deleteConfirmationStateNatal.delete(chart.id);
      } else {
        // First click - show confirmation
        deleteButton.textContent = "✓";
        deleteButton.style.height = "29px";
        deleteButton.style.width = "30px";
        deleteConfirmationStateNatal.set(chart.id, true);

        // Reset after 5 seconds
        setTimeout(() => {
          if (deleteConfirmationStateNatal.get(chart.id)) {
            deleteButton.textContent = "X";
            deleteButton.style.height = "";
            deleteButton.style.width = "";
            deleteConfirmationStateNatal.delete(chart.id);
          }
        }, 5000);
      }
    });

    listItem.appendChild(chartText);
    listItem.appendChild(deleteButton);

    recentChartsList.appendChild(listItem);
  });
}

// Fetch recent charts from db
function fetchRecentCharts() {
  fetch("/recent-charts", {
    credentials: "same-origin",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateRecentCharts(data.recentCharts);
      } else {
        // Display server's generic error message to user
        const errorContainer = document.querySelector(".errorMessage");
        if (errorContainer && data.error) {
          errorContainer.textContent = data.error;
          clearNatalMessage();
        }
        console.error(data.error);
      }
    })
    .catch((error) => {
      // Display generic message for network errors
      if (!(error instanceof SyntaxError)) {
        const errorContainer = document.querySelector(".errorMessage");
        if (errorContainer) {
          errorContainer.textContent =
            "Unexpected error. Please check your connection.";
          clearNatalMessage();
        }
      }
      console.error("Error fetching recent charts:", error);
    });
}

// Save button
// public/js/saveLoadNatal.js
const natalSaveButton = document.getElementById("natalSave");
if (natalSaveButton) {
  natalSaveButton.addEventListener("click", async () => {
    showNatalOverlay();
    natalSaveButton.disabled = true;

    try {
      const storedNatalData = localStorage.getItem("natalData");
      if (!storedNatalData) {
        setNatalMessage("Calculate a natal chart before saving it.");
        return;
      }

      const natalData = parseNatalJson(storedNatalData);
      if (!natalData || !natalData.name) {
        setNatalMessage("O mapa natal não pode ser salvo porque os dados estão incompletos.");
        return;
      }

      const chartData = {
        name: natalData.name,
        year: natalData.year,
        month: natalData.month,
        day: natalData.day,
        hour: natalData.hour,
        minute: natalData.minute,
        lat: natalData.lat,
        latitude: natalData.lat ?? natalData.latitude,
        long: natalData.long ?? natalData.lon ?? natalData.lng ?? natalData.longitude,
        lon: natalData.lon ?? natalData.long ?? natalData.lng ?? natalData.longitude,
        longitude: natalData.longitude ?? natalData.long ?? natalData.lon ?? natalData.lng,
        utc: natalData.utcOffset ?? natalData.utc ?? 0,
        utcOffset: natalData.utcOffset ?? natalData.utc ?? 0,
        timezone: natalData.timezone ?? natalData.timezoneName ?? "",
        timezoneName: natalData.timezone ?? natalData.timezoneName ?? "",
        utcMode: natalData.utcMode ?? document.querySelector(`#natalForm [name="utcMode"]`)?.value ?? "auto",
        location: natalData.location,
        natalData,
      };

      // Use the normal endpoint so the existing Firebase/localStorage fetch bridges can handle
      // the storage target. A timeout prevents the loading overlay from staying forever if
      // Firebase/Auth/Firestore hangs.
      const data = await saveNatalChartRequest(chartData);

      if (data.success) {
        const recentCharts = data.recentCharts || [];
        updateRecentCharts(recentCharts);
        setNatalMessage("");
        document.dispatchEvent(
          new CustomEvent("chartsUpdated", { detail: { charts: recentCharts } })
        );
      } else if (data.error === "Chart already exists in database.") {
        setNatalMessage("Chart already exists in database.");
        if (Array.isArray(data.recentCharts)) updateRecentCharts(data.recentCharts);
      } else if (data.error === "Chart limit reached. Maximum allowed charts is 5000.") {
        setNatalMessage("Chart limit reached. Maximum allowed charts is 5000.");
      } else {
        setNatalMessage(data.error || "Error saving chart. Please check your connection.");
      }
    } catch (error) {
      setNatalMessage(
        error && /timed out/i.test(error.message)
          ? "O salvamento demorou demais. Tente novamente ou confira sua conexão/Firebase."
          : "Unexpected error. Please check your connection."
      );
      console.error("Error saving chart:", error);
    } finally {
      hideNatalOverlay();
      natalSaveButton.disabled = false;
    }
  });
}

// Delete chart
function deleteChart(chartId) {
  // Show spinner during delete operation
  showNatalOverlay();

  withNatalTimeout(fetch("/delete-chart", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: chartId }),
    credentials: "same-origin",
  }), 12000, "Deleting birth chart")
    .then((response) => response.json())
    .then((data) => {
      // Hide spinner after operation completes
      hideNatalOverlay();

      if (data.success) {
        const searchInput = document.getElementById("searchChartsInput");

        // If search field is focused, ONLY re-run the search (skip updating with recent charts)
        if (document.activeElement === searchInput) {
          const query = searchInput.value.trim();
          fetch(`/search-charts?query=${encodeURIComponent(query)}`, {
            credentials: "same-origin",
          })
            .then((response) => response.json())
            .then((searchData) => {
              if (searchData.success) {
                updateRecentCharts(searchData.recentCharts);
                document.dispatchEvent(
                  new CustomEvent("chartsUpdated", {
                    detail: { charts: searchData.recentCharts },
                  })
                );
              }
            })
            .catch((error) => {
              console.error("Error re-running search after deletion:", error);
            });
        } else {
          // Not in search mode - update with recent charts
          updateRecentCharts(data.recentCharts);
          document.dispatchEvent(
            new CustomEvent("chartsUpdated", {
              detail: { charts: data.recentCharts },
            })
          );
        }
        document.querySelector(".errorMessage").textContent = "";
      } else {
        document.querySelector(".errorMessage").textContent =
          "Error deleting chart. Please try again.";
        clearNatalMessage();
      }
    })
    .catch((error) => {
      // Hide spinner on error
      hideNatalOverlay();

      setNatalMessage(
        error && /timed out/i.test(error.message)
          ? "A exclusão demorou demais. Tente novamente ou confira sua conexão/Firebase."
          : "An unexpected error occurred while deleting the chart."
      );
      clearNatalMessage();
      console.error(error);
    });
}

// Search charts
document
  .getElementById("searchChartsInput")
  .addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();

    // If the search input is empty, check if field is focused
    if (query === "") {
      if (document.activeElement === event.target) {
        // Field is focused and empty - show all charts
        fetch(`/search-charts?query=`, {
          credentials: "same-origin",
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.success) {
              updateRecentCharts(data.recentCharts);
            }
          })
          .catch((error) => {
            console.error("Error fetching all charts:", error);
          });
      } else {
        // Field is not focused - show recent charts
        fetchRecentCharts();
      }
      return;
    }

    // Fetch filtered charts from the server
    fetch(`/search-charts?query=${encodeURIComponent(query)}`, {
      credentials: "same-origin",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          updateRecentCharts(data.recentCharts);
        } else {
          // Display server's generic error message to user
          const errorContainer = document.querySelector(".errorMessage");
          if (errorContainer && data.error) {
            errorContainer.textContent = data.error;
            clearNatalMessage();
          }
          console.error(data.error);
        }
      })
      .catch((error) => {
        // Display generic message for network errors
        const errorContainer = document.querySelector(".errorMessage");
        if (errorContainer) {
          errorContainer.textContent =
            "Unexpected error. Please check your connection.";
          clearNatalMessage();
        }
        console.error("Error searching charts:", error);
      });
  });

// Show all charts when clicking into empty search field
document
  .getElementById("searchChartsInput")
  .addEventListener("focus", (event) => {
    const query = event.target.value.trim();

    if (query === "") {
      fetch(`/search-charts?query=`, {
        credentials: "same-origin",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            updateRecentCharts(data.recentCharts);
          }
        })
        .catch((error) => {
          console.error("Error fetching all charts:", error);
        });
    }
  });

// Show recent charts when clicking away from empty search field
document
  .getElementById("searchChartsInput")
  .addEventListener("blur", (event) => {
    const query = event.target.value.trim();

    if (query === "") {
      setTimeout(() => {
        fetchRecentCharts();
      }, 100);
    }
  });

// Get recent charts updates from synastry page
document.addEventListener("chartsUpdated", (event) => {
  updateRecentCharts(event.detail.charts);
});

window.updateRecentCharts = updateRecentCharts;
window.fetchRecentCharts = fetchRecentCharts;
