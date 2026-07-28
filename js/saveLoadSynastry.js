"use strict";

// Helper to clear error messages after a delay (default 5 seconds)
let clearSynastryMessageTimeoutId;
const clearSynastryMessage = (delay = 5000) => {
  if (clearSynastryMessageTimeoutId) {
    clearTimeout(clearSynastryMessageTimeoutId);
  }
  clearSynastryMessageTimeoutId = setTimeout(() => {
    const errorElem = document.querySelector(".errorMessageSynastry");
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

// Track delete confirmation state for synastry charts
const deleteConfirmationStateSynastry = new Map();

// Keep an in‐memory copy of the most recent charts
let recentChartsSynastry = [];

// Fetch recent charts when the document is ready
document.addEventListener("DOMContentLoaded", fetchRecentChartsSynastry);

// Update chart list
function updateRecentChartsSynastry(charts) {
  // Store for duplicate checks
  recentChartsSynastry = charts.slice();

  const recentChartsList = document.getElementById("synastryRecentChartsList");
  recentChartsList.innerHTML = "";
  // Clear confirmation state when updating list
  deleteConfirmationStateSynastry.clear();

  charts.forEach((chart) => {
    const listItem = document.createElement("li");

    const chartText = document.createElement("span");
    // Decode HTML entities for proper display in the list
    const displayName = decodeHtmlEntities(chart.name);
    const displayLocation = decodeHtmlEntities(chart.location);
    // Pad minute to 2 digits (e.g., 1 becomes 01)
    const paddedMinute = String(chart.minute).padStart(2, "0");
    chartText.textContent = `${displayName} ${chart.day} ${chart.month} ${chart.year} ${chart.hour}:${paddedMinute} ${displayLocation}`;
    chartText.style.cursor = "pointer";

    chartText.addEventListener("click", () => {
      // Show spinner immediately for visual feedback
      document.getElementById("loading-overlay").style.display = "block";

            fetch("/update-chart-timestamp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: chart.id }),
        credentials: "same-origin",
      })
        .then((response) => response.json())
        .then((data) => {
                    if (false && data.redirectUrl) {
            window.location.href = data.redirectUrl;
            return;
          }

          if (data.success) {
                        // Decode HTML entities for proper display and geodata lookup
            document.getElementById("synastryName").value = decodeHtmlEntities(
              chart.name
            );
            document.getElementById("synastryDay").value = chart.day;
            document.getElementById("synastryMonth").value = chart.month;
            document.getElementById("synastryYear").value = chart.year;
            document.getElementById("synastryHour").value = chart.hour;
            document.getElementById("synastryMinute").value = String(
              chart.minute
            ).padStart(2, "0");
            document.getElementById("synastryLocation").value =
              decodeHtmlEntities(chart.location);

            // Clear the search field
            document.getElementById("synastrySearchChartsInput").value = "";

            updateRecentChartsSynastry(data.recentCharts);
            document.dispatchEvent(
              new CustomEvent("chartsUpdated", {
                detail: { charts: data.recentCharts },
              })
            );

            // Trigger the calculation
            document.getElementById("synastryCalculate").click();
          } else {
            // Hide spinner on error
            document.getElementById("loading-overlay").style.display = "none";
            // Display server's generic error message to user
            const errorContainer = document.querySelector(
              ".errorMessageSynastry"
            );
            if (errorContainer && data.error) {
              errorContainer.textContent = data.error;
              clearSynastryMessage();
            }
            console.error(data.error);
          }
        })
        .catch((error) => {
          // Hide spinner on error
          document.getElementById("loading-overlay").style.display = "none";
          // Display generic message for network errors
          const errorContainer = document.querySelector(
            ".errorMessageSynastry"
          );
          if (errorContainer) {
            errorContainer.textContent =
              "Unexpected error. Please check your connection.";
            clearSynastryMessage();
          }
          console.error("Error updating chart timestamp:", error);
        });
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "X";
    deleteButton.className = "deleteChartButton";
    deleteButton.addEventListener("mousedown", (event) => {
      event.preventDefault(); // Prevent search field from losing focus
    });
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();

      const isConfirming = deleteConfirmationStateSynastry.get(chart.id);

      if (isConfirming) {
        // Second click - actually delete
        deleteChartSynastry(chart.id);
        deleteConfirmationStateSynastry.delete(chart.id);
      } else {
        // First click - show confirmation
        deleteButton.textContent = "✓";
        deleteButton.style.height = "29px";
        deleteButton.style.width = "30px";
        deleteConfirmationStateSynastry.set(chart.id, true);

        // Reset after 5 seconds
        setTimeout(() => {
          if (deleteConfirmationStateSynastry.get(chart.id)) {
            deleteButton.textContent = "X";
            deleteButton.style.height = "";
            deleteButton.style.width = "";
            deleteConfirmationStateSynastry.delete(chart.id);
          }
        }, 5000);
      }
    });

    listItem.appendChild(chartText);
    listItem.appendChild(deleteButton);

    recentChartsList.appendChild(listItem);
  });
}

// Load recent charts
function fetchRecentChartsSynastry() {
  fetch("/recent-charts", {
    credentials: "same-origin",
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateRecentChartsSynastry(data.recentCharts);
      } else {
        // Display server's generic error message to user
        const errorContainer = document.querySelector(".errorMessageSynastry");
        if (errorContainer && data.error) {
          errorContainer.textContent = data.error;
          clearSynastryMessage();
        }
        console.error(data.error);
      }
    })
    .catch((error) => {
      // Display generic message for network errors
      if (!(error instanceof SyntaxError)) {
        const errorContainer = document.querySelector(".errorMessageSynastry");
        if (errorContainer) {
          errorContainer.textContent =
            "Unexpected error. Please check your connection.";
          clearSynastryMessage();
        }
      }
      console.error("Error fetching recent charts:", error);
    });
}

// Save synastry chart
document.getElementById("synastrySave").addEventListener("click", () => {
  document.getElementById("loading-overlay").style.display = "block";

  // Stop if the form is blank
  const ids = [
    "synastryName",
    "synastryDay",
    "synastryMonth",
    "synastryYear",
    "synastryHour",
    "synastryMinute",
    "synastryLocation",
  ];
  const formIsBlank = ids.every(
    (id) => !document.getElementById(id).value.trim()
  );

  if (formIsBlank) {
    localStorage.removeItem("synastryData"); // throw away stale chart
    document.getElementById("loading-overlay").style.display = "none";
    document.querySelector(".errorMessageSynastry").textContent =
      "Calculate the chart first, then click Save.";
    clearSynastryMessage();
    return;
  }

  // Get form values directly
  const meta = JSON.parse(localStorage.getItem("synastryData") || "null");

  const chartData = {
    name: meta.name,
    year: meta.year,
    month: meta.month,
    day: meta.day,
    hour: meta.hour,
    minute: meta.minute,
    lat: meta.lat,
    long: meta.long,
    utc: meta.utcOffset,
    location: meta.location,
  };

  // Check for duplicates in recentChartsSynastry
  const isDuplicate = recentChartsSynastry.some((existing) => {
    return (
      existing.name === chartData.name &&
      String(existing.day) === chartData.day &&
      String(existing.month) === chartData.month &&
      String(existing.year) === chartData.year &&
      String(existing.hour) === chartData.hour &&
      String(existing.minute) === chartData.minute &&
      existing.location === chartData.location
    );
  });

  if (isDuplicate) {
    document.getElementById("loading-overlay").style.display = "none";
    document.querySelector(".errorMessageSynastry").textContent =
      "Chart already exists in database.";
    clearSynastryMessage();
    return;
  }

  fetch("/save-chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chartData),
    credentials: "same-origin",
  })
    .then((r) => r.json())
    .then((data) => {
      document.getElementById("loading-overlay").style.display = "none";

      if (false && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (data.success) {
        updateRecentChartsSynastry(data.recentCharts);
        document.querySelector(".errorMessageSynastry").textContent = "";
        // Update natal page recent charts
        document.dispatchEvent(
          new CustomEvent("chartsUpdated", {
            detail: { charts: data.recentCharts },
          })
        );
      } else {
        const msg =
          data.error === "Chart already exists in database."
            ? "Chart already exists in database."
            : data.error ===
              "Chart limit reached. Maximum allowed charts is 5000."
            ? "Chart limit reached. Maximum allowed charts is 5000."
            : "Error saving chart. Please check your connection.";
        document.querySelector(".errorMessageSynastry").textContent = msg;
        clearSynastryMessage();
      }
    })
    .catch((err) => {
      document.getElementById("loading-overlay").style.display = "none";
      document.querySelector(".errorMessageSynastry").textContent =
        "Unexpected error. Please check your connection.";
      clearSynastryMessage();
      console.error(err);
    });
});

// Delete chart
function deleteChartSynastry(chartId) {
  // Show spinner during delete operation
  document.getElementById("loading-overlay").style.display = "block";

  fetch("/delete-chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: chartId }),
    credentials: "same-origin",
  })
    .then((response) => response.json())
    .then((data) => {
      // Hide spinner after operation completes
      document.getElementById("loading-overlay").style.display = "none";

      if (data.success) {
        const searchInput = document.getElementById(
          "synastrySearchChartsInput"
        );

        // If search field is focused, ONLY re-run the search (skip updating with recent charts)
        if (document.activeElement === searchInput) {
          const query = searchInput.value.trim();
          fetch(`/search-charts?query=${encodeURIComponent(query)}`, {
            credentials: "same-origin",
          })
            .then((response) => response.json())
            .then((searchData) => {
              if (searchData.success) {
                updateRecentChartsSynastry(searchData.recentCharts);
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
          updateRecentChartsSynastry(data.recentCharts);
          document.dispatchEvent(
            new CustomEvent("chartsUpdated", {
              detail: { charts: data.recentCharts },
            })
          );
        }
        document.querySelector(".errorMessageSynastry").textContent = "";
      } else {
        document.querySelector(".errorMessageSynastry").textContent =
          "Error deleting chart. Please try again.";
        clearSynastryMessage();
      }
    })
    .catch((error) => {
      // Hide spinner on error
      document.getElementById("loading-overlay").style.display = "none";

      document.querySelector(".errorMessageSynastry").textContent =
        "An unexpected error occurred while deleting the chart.";
      clearSynastryMessage();
      console.error(error);
    });
}

// Search charts
document
  .getElementById("synastrySearchChartsInput")
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
              updateRecentChartsSynastry(data.recentCharts);
            }
          })
          .catch((error) => {
            console.error("Error fetching all charts:", error);
          });
      } else {
        // Field is not focused - show recent charts
        fetchRecentChartsSynastry();
      }
      return;
    }

    fetch(`/search-charts?query=${encodeURIComponent(query)}`, {
      credentials: "same-origin",
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          updateRecentChartsSynastry(data.recentCharts);
        } else {
          // Display server's generic error message to user
          const errorContainer = document.querySelector(
            ".errorMessageSynastry"
          );
          if (errorContainer && data.error) {
            errorContainer.textContent = data.error;
            clearSynastryMessage();
          }
          console.error(data.error);
        }
      })
      .catch((error) => {
        // Display generic message for network errors
        const errorContainer = document.querySelector(".errorMessageSynastry");
        if (errorContainer) {
          errorContainer.textContent =
            "Unexpected error. Please check your connection.";
          clearSynastryMessage();
        }
        console.error("Error searching charts:", error);
      });
  });

// Show all charts when clicking into empty search field
document
  .getElementById("synastrySearchChartsInput")
  .addEventListener("focus", (event) => {
    const query = event.target.value.trim();

    if (query === "") {
      fetch(`/search-charts?query=`, {
        credentials: "same-origin",
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            updateRecentChartsSynastry(data.recentCharts);
          }
        })
        .catch((error) => {
          console.error("Error fetching all charts:", error);
        });
    }
  });

// Show recent charts when clicking away from empty search field
document
  .getElementById("synastrySearchChartsInput")
  .addEventListener("blur", (event) => {
    const query = event.target.value.trim();

    if (query === "") {
      setTimeout(() => {
        fetchRecentChartsSynastry();
      }, 100);
    }
  });

// Get recent charts updates from natal page
document.addEventListener("chartsUpdated", (event) => {
  updateRecentChartsSynastry(event.detail.charts);
});
