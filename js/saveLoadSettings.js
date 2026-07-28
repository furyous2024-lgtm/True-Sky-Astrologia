"use strict";

// Decode HTML entities for proper display of settings names
function decodeHtmlEntities(str) {
  if (!str) return str;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = str;
  return textarea.value;
}

// Custom points data and state
let customPointsData = [];
let activeCustomPoints = []; // Array of {num, name, display, aspect}

// Load custom points JSON on page load
fetch("json/customPoints.json")
  .then((res) => res.json())
  .then((data) => {
    customPointsData = data;
  })
  .catch((err) => {
    console.error("Failed to load custom points data");
  });

// Helper to clear error messages after a delay (default 5 seconds)
let clearSettingsMessageTimeoutId;
const clearSettingsMessage = (delay = 5000) => {
  if (clearSettingsMessageTimeoutId) {
    clearTimeout(clearSettingsMessageTimeoutId);
  }
  clearSettingsMessageTimeoutId = setTimeout(() => {
    const errorElem = document.querySelector(".errorMessageSettings");
    if (errorElem) {
      errorElem.textContent = "";
    }
  }, delay);
};

// On page load, fetch recent settings & prevent the form from submitting on enter key press
document.addEventListener("DOMContentLoaded", () => {
  const settingsForm = document.querySelector(".settings-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
    });
  }

  // Add Enter key handler for settings name input
  const settingsNameInput = document.getElementById("settingsName");
  if (settingsNameInput) {
    settingsNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("settingsSave").click();
      }
    });
  }

  // Start every fresh page load with the real True Sky default settings.
  // Saved settings stay available in the list, but they are not auto-applied.
  applyDefaultSettingsOnStartup();

  // Fetch recent settings after the DOM is loaded
  fetchRecentSettings();

  // Render initial custom points input field
  renderCustomPointsList();
});

// Helper to clear custom points error message
let clearCustomPointsErrorTimeoutId;
const clearCustomPointsError = (delay = 5000) => {
  if (clearCustomPointsErrorTimeoutId) {
    clearTimeout(clearCustomPointsErrorTimeoutId);
  }
  clearCustomPointsErrorTimeoutId = setTimeout(() => {
    const errorElem = document.getElementById("customPointsError");
    if (errorElem) {
      errorElem.textContent = "";
    }
  }, delay);
};

// Render the custom points list matching planet-settings format
function renderCustomPointsList() {
  const container = document.getElementById("customPointsList");
  if (!container) return;

  container.innerHTML = "";

  // Render existing custom points in same format as planet settings
  activeCustomPoints.forEach((point, index) => {
    const slotNum = String(index + 1).padStart(2, "0");

    // Create row container to keep elements together
    const row = document.createElement("div");
    row.className = "custom-point-row";

    // Label with number and name
    const label = document.createElement("label");
    label.innerHTML = `<span class="custom-point-number">${slotNum}</span><span class="custom-point-name" title="${point.name}">${point.name}</span>`;
    row.appendChild(label);

    // Display checkbox
    const displayCb = document.createElement("input");
    displayCb.type = "checkbox";
    displayCb.checked = point.display;
    displayCb.title = "Show on wheel";
    displayCb.addEventListener("change", (e) => {
      activeCustomPoints[index].display = e.target.checked;
    });
    row.appendChild(displayCb);

    // Aspect checkbox
    const aspectCb = document.createElement("input");
    aspectCb.type = "checkbox";
    aspectCb.checked = point.aspect;
    aspectCb.title = "Show aspects";
    aspectCb.addEventListener("change", (e) => {
      activeCustomPoints[index].aspect = e.target.checked;
    });
    row.appendChild(aspectCb);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "custom-point-delete";
    deleteBtn.textContent = "X";
    deleteBtn.title = "Remove";
    deleteBtn.addEventListener("click", () => {
      const isConfirming = deleteBtn.dataset.confirming === "true";
      if (isConfirming) {
        activeCustomPoints.splice(index, 1);
        renderCustomPointsList();
      } else {
        deleteBtn.textContent = "✓";
        deleteBtn.dataset.confirming = "true";
        setTimeout(() => {
          if (deleteBtn.dataset.confirming === "true") {
            deleteBtn.textContent = "X";
            deleteBtn.dataset.confirming = "false";
          }
        }, 5000);
      }
    });
    row.appendChild(deleteBtn);

    container.appendChild(row);
  });

  // Ensure dynamic custom point labels are bound after rendering
  if (typeof window.bindLabelsToInput === "function") {
    window.bindLabelsToInput("#customPointsList");
  }

  // Add input row for adding new custom point (if under limit)
  if (activeCustomPoints.length < 5) {
    const slotNum = String(activeCustomPoints.length + 1).padStart(2, "0");
    const inputRow = document.createElement("div");
    inputRow.className = "custompoint-input-row";
    inputRow.innerHTML = `
      <span class="custom-point-number">${slotNum}</span>
      <span class="custom-point-input-wrapper">
        <input
          type="text"
          id="customPointInput"
          class="custom-point-input"
          placeholder="Custom Point"
          autocomplete="off"
          spellcheck="false"
          maxlength="40"
        />
        <span id="customPointGhost" class="custom-point-ghost"></span>
      </span>
      <button type="button" id="customPointConfirm" class="custom-point-confirm" title="Add">✓</button>
    `;
    container.appendChild(inputRow);

    // Setup ghost text autocomplete behavior
    const input = inputRow.querySelector("#customPointInput");
    const ghost = inputRow.querySelector("#customPointGhost");
    const confirmBtn = inputRow.querySelector("#customPointConfirm");
    let currentMatch = null;

    input.addEventListener("input", () => {
      const query = input.value.trim();
      const queryLower = query.toLowerCase();
      const errorElem = document.getElementById("customPointsError");

      // Clear any previous error while typing
      if (errorElem) errorElem.textContent = "";

      if (!query) {
        ghost.textContent = "";
        currentMatch = null;
        return;
      }

      // Find partial match for ghost text
      const partial = customPointsData.find((p) =>
        p.name.toLowerCase().startsWith(queryLower),
      );

      if (partial) {
        // Show ghost text: user's input + remaining characters in lighter color
        ghost.textContent = query + partial.name.slice(query.length);
        currentMatch = partial;
      } else {
        // No match
        ghost.textContent = "";
        currentMatch = null;
      }
    });

    // Tab or Right arrow key to accept ghost text
    input.addEventListener("keydown", (e) => {
      if (
        (e.key === "Tab" || e.key === "ArrowRight") &&
        currentMatch &&
        ghost.textContent
      ) {
        e.preventDefault();
        input.value = currentMatch.name;
        ghost.textContent = "";
      }
      if (e.key === "Enter") {
        e.preventDefault();
        confirmBtn.click();
      }
    });

    // Confirm button click
    confirmBtn.addEventListener("click", () => {
      const errorElem = document.getElementById("customPointsError");
      const query = input.value.trim();

      // Check if input is empty
      if (!query) {
        return;
      }

      // Check if no valid match found
      if (!currentMatch) {
        if (errorElem) {
          errorElem.textContent = "No match found";
          clearCustomPointsError();
        }
        return;
      }

      // Check if already added
      const alreadyAdded = activeCustomPoints.some(
        (p) => p.num === currentMatch.num,
      );
      if (alreadyAdded) {
        if (errorElem) {
          errorElem.textContent = `${currentMatch.name} already added`;
          clearCustomPointsError();
        }
        return;
      }

      const newPoint = {
        num: currentMatch.num,
        name: currentMatch.name,
        display: true,
        aspect: false,
      };

      activeCustomPoints.push(newPoint);
      renderCustomPointsList();
    });
  }
}


const LOCAL_SETTINGS_KEY = "astroSavedSettings.v1";
const SWISS_RESET_KEY = "astroSwissFactoryReset.v2";
try {
  if (localStorage.getItem(SWISS_RESET_KEY) !== "done") {
    localStorage.removeItem(LOCAL_SETTINGS_KEY);
    localStorage.removeItem("settingsData");
    localStorage.setItem(SWISS_RESET_KEY, "done");
  }
} catch (_) {}

function makeLocalSettingsId() {
  return `local_settings_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_SETTINGS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeLocalSettings(items) {
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(items));
}

function recentLocalSettings(items) {
  return [...items]
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
    .slice(0, 100);
}

function mergeSettingsLists(...lists) {
  const byId = new Map();
  lists.flat().forEach((item) => {
    if (!item || !item.id) return;
    byId.set(String(item.id), item);
  });
  return [...byId.values()]
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")))
    .slice(0, 100);
}

function saveSettingsLocally(settingsName, settingsData) {
  const nowIso = new Date().toISOString();
  const item = {
    id: makeLocalSettingsId(),
    settings_name: settingsName || "Settings",
    settings_json: JSON.stringify(settingsData || {}),
    created_at: nowIso,
    updated_at: nowIso,
  };
  const next = [item, ...readLocalSettings()].slice(0, 5000);
  writeLocalSettings(next);
  return recentLocalSettings(next);
}

function setSettingsMessage(text) {
  const errorElem = document.querySelector(".errorMessageSettings");
  if (errorElem) errorElem.textContent = text || "";
}

function getSettingsOverlay() {
  return document.getElementById("loading-overlay");
}

function showSettingsOverlay() {
  const overlay = getSettingsOverlay();
  if (overlay) overlay.style.display = "block";
}

function hideSettingsOverlay() {
  const overlay = getSettingsOverlay();
  if (overlay) overlay.style.display = "none";
}

function fetchJsonWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .finally(() => clearTimeout(timeoutId));
}

function removeLocalSettingById(id) {
  const current = readLocalSettings();
  const next = current.filter((item) => String(item.id) !== String(id));
  if (next.length !== current.length) {
    writeLocalSettings(next);
    return true;
  }
  return false;
}

function isLocalSettingId(id) {
  return String(id || "").startsWith("local_settings_");
}


function getSettingsNameOrDefault() {
  const settingsNameField = document.getElementById("settingsName");
  const clean = (settingsNameField?.value || "").trim() || "Default Settings";
  if (settingsNameField) settingsNameField.value = clean;
  return clean;
}

function safeParseJson(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function getFieldValue(id) {
  return document.getElementById(id)?.value || "";
}

function getNatalHiddenValue(name) {
  return document.querySelector(`#natalForm [name="${name}"]`)?.value || "";
}

function buildCurrentBirthChartSnapshot() {
  const storedNatalData = safeParseJson(localStorage.getItem("natalData"), {}) || {};
  const lat = getNatalHiddenValue("lat") || getNatalHiddenValue("latitude") || storedNatalData.lat || storedNatalData.latitude || "";
  const lon = getNatalHiddenValue("long") || getNatalHiddenValue("lon") || getNatalHiddenValue("longitude") || storedNatalData.long || storedNatalData.lon || storedNatalData.longitude || "";
  const utc = getNatalHiddenValue("utcOffset") || getNatalHiddenValue("utc") || storedNatalData.utcOffset || storedNatalData.utc || "";
  const timezone = getNatalHiddenValue("timezone") || getNatalHiddenValue("timezoneName") || storedNatalData.timezone || storedNatalData.timezoneName || "";
  const utcMode = getNatalHiddenValue("utcMode") || storedNatalData.utcMode || "auto";

  const snapshot = {
    name: getFieldValue("natalName") || storedNatalData.name || "",
    day: getFieldValue("natalDay") || storedNatalData.day || "",
    month: getFieldValue("natalMonth") || storedNatalData.month || "",
    year: getFieldValue("natalYear") || storedNatalData.year || "",
    hour: getFieldValue("natalHour") || storedNatalData.hour || storedNatalData.hourString || "",
    minute: (getFieldValue("natalMinute") || storedNatalData.minute || storedNatalData.minuteString || "").toString().padStart(2, "0"),
    location: getFieldValue("natalLocation") || storedNatalData.location || "",
    lat,
    latitude: lat,
    long: lon,
    lon,
    longitude: lon,
    utc,
    utcOffset: utc,
    timezone,
    timezoneName: timezone,
    utcMode,
    zodiacSystem: document.querySelector('select[name="zodiacSystem"]')?.value || storedNatalData.zodiacSystem || "Tropical",
    ayanamsaSystem: document.querySelector('select[name="ayanamsaSystem"]')?.value || storedNatalData.ayanamsaSystem || "Tropical",
    customAyanamsa: Number(document.querySelector('input[name="customAyanamsa"]')?.value ?? storedNatalData.customAyanamsa ?? 0),
    houseSystem: document.querySelector('select[name="houseSystem"]')?.value || storedNatalData.houseSystem || "Placidus",
    coordinateSystem: document.querySelector('select[name="coordinateSystem"]')?.value || storedNatalData.coordinateSystem || "Ecliptic",
    ascendantOverride: document.querySelector('select[name="ascendantOverride"]')?.value || storedNatalData.ascendantOverride || "Normal",
  };

  const hasCoreBirthData = [snapshot.name, snapshot.day, snapshot.month, snapshot.year, snapshot.location]
    .some((value) => String(value || "").trim() !== "");

  return hasCoreBirthData ? snapshot : null;
}

function getCurrentDefaultLocationForSettings() {
  const inputValue = document.getElementById("defaultLocation")?.value || "";
  const storedValue = localStorage.getItem("trueSky.defaultLocation") || localStorage.getItem("astroDefaultLocation.v1") || localStorage.getItem("defaultLocation") || "";
  const helperValue = window.TrueSkyDefaultLocation?.get ? window.TrueSkyDefaultLocation.get() : "";
  return String(inputValue || helperValue || storedValue || "").trim();
}

function addAccountStateToSettings(settingsData) {
  const birthChart = buildCurrentBirthChartSnapshot();
  const defaultLocation = getCurrentDefaultLocationForSettings();

  settingsData.accountState = {
    birthChart,
    defaultLocation,
    savedAt: new Date().toISOString(),
  };
  settingsData.birthChart = birthChart;
  settingsData.defaultLocation = defaultLocation;

  return settingsData;
}

function ensureNatalHiddenField(name) {
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

function setValueAndNotify(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value ?? "";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyBirthChartFromSettings(chart) {
  if (!chart || typeof chart !== "object") return;

  setValueAndNotify("natalName", chart.name || "");
  setValueAndNotify("natalDay", chart.day || "");
  setValueAndNotify("natalMonth", chart.month || "");
  setValueAndNotify("natalYear", chart.year || "");
  setValueAndNotify("natalHour", chart.hour || chart.hourString || "");
  setValueAndNotify("natalMinute", String(chart.minute || chart.minuteString || "").padStart(2, "0"));
  setValueAndNotify("natalLocation", chart.location || "");

  const lat = chart.lat ?? chart.latitude ?? "";
  const lon = chart.long ?? chart.lon ?? chart.lng ?? chart.longitude ?? "";
  const utc = chart.utcOffset ?? chart.utc ?? chart.timezoneOffset ?? chart.utc_offset ?? "";
  const timezone = chart.timezone ?? chart.timezoneName ?? "";
  const utcMode = chart.utcMode ?? chart.timezoneMode ?? "auto";
  const geoPairs = { lat, latitude: lat, long: lon, lon, longitude: lon, utc, utcOffset: utc, timezone, timezoneName: timezone, utcMode };

  Object.entries(geoPairs).forEach(([name, value]) => {
    const input = ensureNatalHiddenField(name);
    if (input && value !== undefined && value !== null && String(value).trim() !== "") input.value = String(value);
  });

  const locInput = document.getElementById("natalLocation");
  if (locInput) {
    if (timezone) locInput.dataset.selectedTimezone = String(timezone);
    locInput.dataset.utcMode = String(utcMode || "auto");
    window.TrueSkyLocationControls?.setUtcMode?.(locInput.closest("form"), locInput, utcMode || "auto");
    if (utc !== undefined && utc !== null && String(utc).trim() !== "") locInput.dataset.selectedUtcFallback = String(utc);
    if (lat !== undefined && lat !== null && lon !== undefined && lon !== null && String(lat).trim() !== "" && String(lon).trim() !== "") {
      locInput.dataset.selectedLat = String(lat);
      locInput.dataset.selectedLon = String(lon);
    }
  }

  const cleanChart = {
    ...safeParseJson(localStorage.getItem("natalData"), {}),
    ...chart,
    lat,
    latitude: lat,
    long: lon,
    lon,
    longitude: lon,
    utc,
    utcOffset: utc,
    timezone,
    timezoneName: timezone,
    utcMode,
  };
  try {
    localStorage.setItem("natalData", JSON.stringify(cleanChart));
  } catch (_) {}
}

function applyDefaultLocationFromSettings(location) {
  const clean = String(location || "").trim();
  if (!clean) return;
  if (window.TrueSkyDefaultLocation?.set) {
    window.TrueSkyDefaultLocation.set(clean);
  } else {
    try {
      localStorage.setItem("astroDefaultLocation.v1", clean);
      localStorage.setItem("defaultLocation", clean);
    } catch (_) {}
    const input = document.getElementById("defaultLocation");
    if (input) input.value = clean;
  }
}

function applySavedAccountState(settings) {
  const birthChart = settings?.birthChart || settings?.accountState?.birthChart || settings?.natalData || null;
  const defaultLocation = settings?.defaultLocation || settings?.accountState?.defaultLocation || "";

  if (birthChart) applyBirthChartFromSettings(birthChart);
  if (defaultLocation) applyDefaultLocationFromSettings(defaultLocation);
}

function applyDefaultSettingsOnStartup() {
  try {
    resetFormToDefaults();
  } catch (err) {
    console.warn("Could not apply default settings on startup:", err);
  }
  const settingsNameField = document.getElementById("settingsName");
  if (settingsNameField) settingsNameField.value = "Default Settings";
}

// Track delete confirmation state for settings
const deleteConfirmationStateSettings = new Map();

// Update the recent settings list in the UI
function updateRecentSettings(settingsList) {
  const recentSettingsList = document.getElementById("recentSettingsList");
  if (!recentSettingsList) return;
  recentSettingsList.innerHTML = "";
  settingsList = Array.isArray(settingsList) ? settingsList : [];
  // Clear confirmation state when updating list
  deleteConfirmationStateSettings.clear();

  settingsList.forEach((setting) => {
    const li = document.createElement("li");

    // Create text for the saved settings name
    const settingText = document.createElement("span");
    settingText.textContent = decodeHtmlEntities(setting.settings_name);

    // Make the entire li clickable instead of just the text
    li.addEventListener("click", (event) => {
      // Prevent click if it's on the delete button
      if (event.target.className === "deleteChartButton") return;

      showSettingsOverlay();

      try {
        const settings = JSON.parse(setting.settings_json || "{}");
        loadSettingsIntoForm(settings);
        const nameField = document.getElementById("settingsName");
        if (nameField) nameField.value = decodeHtmlEntities(setting.settings_name || "Settings");
        const errorElem = document.querySelector(".errorMessageSettings");
        if (errorElem) errorElem.textContent = "";
        const natalForm = document.getElementById("natalForm");
        if (natalForm) natalForm.requestSubmit();
      } catch (err) {
        console.error(err);
        setSettingsMessage("Error loading settings. Please try again.");
        clearSettingsMessage();
      } finally {
        hideSettingsOverlay();
      }

      // Touch timestamp in the background only. Loading settings should not depend on this request.
      if (!isLocalSettingId(setting.id)) {
        fetchJsonWithTimeout("/update-settings-timestamp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: setting.id }),
          credentials: "same-origin",
        }, 6000)
          .then((data) => {
            if (data && data.success && Array.isArray(data.recentSettings)) {
              updateRecentSettings(mergeSettingsLists(recentLocalSettings(readLocalSettings()), data.recentSettings));
            }
          })
          .catch((err) => console.warn("Could not update settings timestamp:", err));
      }
    });

    // Create a delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "X";
    deleteBtn.className = "deleteChartButton";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      const isConfirming = deleteConfirmationStateSettings.get(setting.id);

      if (isConfirming) {
        // Second click - actually delete
        deleteSetting(setting.id);
        deleteConfirmationStateSettings.delete(setting.id);
      } else {
        // First click - show confirmation
        deleteBtn.textContent = "✓";
        deleteBtn.style.height = "29px";
        deleteBtn.style.width = "30px";
        deleteConfirmationStateSettings.set(setting.id, true);

        // Reset after 5 seconds
        setTimeout(() => {
          if (deleteConfirmationStateSettings.get(setting.id)) {
            deleteBtn.textContent = "X";
            deleteBtn.style.height = ""; // Reset height
            deleteBtn.style.width = ""; // Reset width
            deleteConfirmationStateSettings.delete(setting.id);
          }
        }, 5000);
      }
    });

    li.appendChild(settingText);
    li.appendChild(deleteBtn);
    recentSettingsList.appendChild(li);
  });
}

// Fetch recent settings from the server
let firstLoad = true;

function fetchRecentSettings() {
  const localSettings = recentLocalSettings(readLocalSettings());
  updateRecentSettings(localSettings);

  fetchJsonWithTimeout("/recent-settings", {
    credentials: "same-origin",
  }, 6000)
    .then((data) => {
      if (data.success) {
        const mergedSettings = mergeSettingsLists(localSettings, Array.isArray(data.recentSettings) ? data.recentSettings : []);
        updateRecentSettings(mergedSettings);
      } else if (data.error) {
        setSettingsMessage(data.error);
        clearSettingsMessage();
      }
    })
    .catch((err) => {
      console.warn("Could not fetch server settings, using local settings:", err);
      updateRecentSettings(recentLocalSettings(readLocalSettings()));
    })
    .finally(() => {
      if (firstLoad) {
        applyDefaultSettingsOnStartup();
        firstLoad = false;
      }
    });
}

window.fetchRecentSettings = fetchRecentSettings;

// Save settings button click handler
const settingsSaveButton = document.getElementById("settingsSave");
if (settingsSaveButton) {
  settingsSaveButton.addEventListener("click", () => {
    hideSettingsOverlay();

    const settingsName = getSettingsNameOrDefault();

    let settingsData;
    try {
      settingsData = getSettingsData();
    } catch (err) {
      console.error(err);
      setSettingsMessage("Error reading settings. Please try again.");
      clearSettingsMessage();
      return;
    }

    // The regular Save Settings button must be instant and offline-safe.
    // Firebase/server saving is handled by the separate Save Settings to Firebase button.
    const localRecent = saveSettingsLocally(settingsName, settingsData);
    updateRecentSettings(localRecent);
    setSettingsMessage("Settings saved locally.");
    clearSettingsMessage();
  });
}


const settingsFirebaseSaveButton = document.getElementById("settingsFirebaseSave");
if (settingsFirebaseSaveButton) {
  settingsFirebaseSaveButton.addEventListener("click", async () => {
    const settingsName = getSettingsNameOrDefault();

    if (!window.TrueSkyCloud || typeof window.TrueSkyCloud.saveCurrentSettingsToCloud !== "function") {
      setSettingsMessage("Firebase is not ready. Check js/firebase-config.js and login first.");
      clearSettingsMessage();
      return;
    }

    let settingsData;
    try {
      settingsData = getSettingsData();
    } catch (err) {
      console.error(err);
      setSettingsMessage("Error reading settings. Please try again.");
      clearSettingsMessage();
      return;
    }

    settingsFirebaseSaveButton.disabled = true;
    settingsFirebaseSaveButton.setAttribute("aria-busy", "true");
    showSettingsOverlay();
    try {
      const result = await window.TrueSkyCloud.saveCurrentSettingsToCloud(settingsName, settingsData);
      updateRecentSettings(result.recentSettings || []);
      if (Array.isArray(result.recentCharts) && typeof window.updateRecentCharts === "function") {
        window.updateRecentCharts(result.recentCharts);
        document.dispatchEvent(new CustomEvent("chartsUpdated", { detail: { charts: result.recentCharts } }));
      }
      if (result.defaultLocation && window.TrueSkyDefaultLocation?.set) {
        window.TrueSkyDefaultLocation.set(result.defaultLocation);
      }
      setSettingsMessage("Settings, Birth Chart and Default Location saved to Firebase.");
      clearSettingsMessage();
    } catch (err) {
      console.error(err);
      setSettingsMessage(err.message || "Error saving Settings to Firebase.");
      clearSettingsMessage();
    } finally {
      hideSettingsOverlay();
      settingsFirebaseSaveButton.disabled = false;
      settingsFirebaseSaveButton.removeAttribute("aria-busy");
    }
  });
}

// Apply Without Saving button click handler
const settingsApplyButton = document.getElementById("settingsApply");
if (settingsApplyButton) settingsApplyButton.addEventListener("click", () => {
  // Clear any existing error message
  const errorElem = document.querySelector(".errorMessageSettings");
  if (errorElem) errorElem.textContent = "";

  // Clear the settings name to indicate these are unsaved/modified settings
  document.getElementById("settingsName").value = "";

  // Trigger the natal chart calculation by submitting the natal form
  const natalForm = document.getElementById("natalForm");
  if (natalForm) {
    natalForm.requestSubmit();
  }
});

// Apply Default Settings button click handler
const settingsApplyDefaultsButton = document.getElementById("settingsApplyDefaults");
if (settingsApplyDefaultsButton) settingsApplyDefaultsButton.addEventListener("click", () => {
    // Clear any existing error message
    const errorElem = document.querySelector(".errorMessageSettings");
    if (errorElem) errorElem.textContent = "";

    // Reset all form elements to their default values as defined in the HTML
    resetFormToDefaults();

    // Set the settings name to "Default Settings"
    document.getElementById("settingsName").value = "Default Settings";

    // Trigger the natal chart calculation by submitting the natal form
    const natalForm = document.getElementById("natalForm");
    if (natalForm) {
      natalForm.requestSubmit();
    }
  });

// Delete settings entry
function deleteSetting(id) {
  hideSettingsOverlay();

  const removedLocally = removeLocalSettingById(id);
  if (removedLocally || isLocalSettingId(id)) {
    updateRecentSettings(recentLocalSettings(readLocalSettings()));
    setSettingsMessage("Settings deleted.");
    clearSettingsMessage();
    return;
  }

  showSettingsOverlay();

  fetchJsonWithTimeout("/delete-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: id }),
    credentials: "same-origin",
  })
    .then((data) => {
      hideSettingsOverlay();

      if (data.success) {
        updateRecentSettings(Array.isArray(data.recentSettings) ? data.recentSettings : []);
        setSettingsMessage("Settings deleted.");
        clearSettingsMessage();
      } else {
        setSettingsMessage(data.error || "Error deleting settings. Please try again.");
        clearSettingsMessage();
      }
    })
    .catch((err) => {
      hideSettingsOverlay();
      console.error(err);
      setSettingsMessage("Error deleting settings. Please try again.");
      clearSettingsMessage();
    });
}

// Load settings into the form
function loadSettingsIntoForm(settings) {
  // Load wheel settings for planets
  for (const planet in settings.wheelSettings.planets) {
    const displayCheckbox = document.querySelector(
      `input[name="planet"][value="${planet}"]`,
    );
    // Map saved keys to the aspect checkbox value if needed
    let aspectValue = planet;
    if (planet === "True_Node") {
      aspectValue = "North Node";
    } else if (planet === "Ascendant_Symbol") {
      aspectValue = "Ascendant Symbol";
    }
    const aspectCheckbox = document.querySelector(
      `input[name="planetAspects"][value="${aspectValue}"]`,
    );
    if (displayCheckbox) {
      displayCheckbox.checked = settings.wheelSettings.planets[planet].display;
    }
    if (aspectCheckbox) {
      aspectCheckbox.checked = settings.wheelSettings.planets[planet].aspect;
    }
  }

  // Backwards compatibility: Reset new points to defaults if not present in saved settings
  // These points were added later and old saved settings won't have them
  const newPoints = [
    { planet: "Vertex", aspect: "Vertex" },
    { planet: "Anti-Vertex", aspect: "Anti-Vertex" },
    { planet: "Priapus", aspect: "Priapus" },
    { planet: "Part of Spirit", aspect: "Part of Spirit" },
    { planet: "Galactic Center", aspect: "Galactic Center" },
  ];
  newPoints.forEach(({ planet, aspect }) => {
    if (!settings.wheelSettings.planets[planet]) {
      const displayCheckbox = document.querySelector(
        `input[name="planet"][value="${planet}"]`,
      );
      const aspectCheckbox = document.querySelector(
        `input[name="planetAspects"][value="${aspect}"]`,
      );
      if (displayCheckbox) displayCheckbox.checked = false;
      if (aspectCheckbox) aspectCheckbox.checked = false;
    }
  });

  // Load the degrees setting
  const degreesCheckbox = document.querySelector('input[name="degrees"]');
  if (degreesCheckbox) {
    degreesCheckbox.checked = settings.wheelSettings.degrees;
  }

  // Load true nodes/lilith settings (with backwards compatibility for old saved settings)
  // Old settings won't have these keys, so default to trueNodes=true, trueLilith=false
  const trueNodesCheckbox = document.querySelector('input[name="trueNodes"]');
  if (trueNodesCheckbox) {
    trueNodesCheckbox.checked =
      settings.wheelSettings.trueNodes !== undefined
        ? settings.wheelSettings.trueNodes
        : true; // default for old settings
  }
  const trueLilithCheckbox = document.querySelector('input[name="trueLilith"]');
  if (trueLilithCheckbox) {
    trueLilithCheckbox.checked =
      settings.wheelSettings.trueLilith !== undefined
        ? settings.wheelSettings.trueLilith
        : false; // default for old settings
  }
  const draconicCheckbox = document.querySelector('input[name="draconic"]');
  if (draconicCheckbox) {
    draconicCheckbox.checked =
      settings.wheelSettings.draconic !== undefined
        ? settings.wheelSettings.draconic
        : false; // default for old settings
  }
  const fixedStarsCheckbox = document.querySelector('input[name="fixedStars"]');
  if (fixedStarsCheckbox) {
    fixedStarsCheckbox.checked =
      settings.wheelSettings.fixedStars !== undefined
        ? settings.wheelSettings.fixedStars
        : false; // default for old settings
  }
  const fixedStarsMagnitudeSelect = document.querySelector(
    'select[name="fixedStarsMagnitude"]',
  );
  if (fixedStarsMagnitudeSelect) {
    fixedStarsMagnitudeSelect.value =
      settings.wheelSettings.fixedStarsMagnitude !== undefined
        ? Number(settings.wheelSettings.fixedStarsMagnitude).toFixed(1)
        : "2.0"; // default for old settings
  }
  const fixedStarsLatitudeSelect = document.querySelector(
    'select[name="fixedStarsLatitude"]',
  );
  if (fixedStarsLatitudeSelect) {
    fixedStarsLatitudeSelect.value =
      settings.wheelSettings.fixedStarsLatitude !== undefined
        ? String(settings.wheelSettings.fixedStarsLatitude)
        : "30"; // default for old settings
  }

  // Load custom points (with backwards compatibility - old settings won't have this)
  if (
    settings.wheelSettings.customPoints &&
    Array.isArray(settings.wheelSettings.customPoints)
  ) {
    activeCustomPoints = settings.wheelSettings.customPoints.map((p) => ({
      num: p.num,
      name: p.name,
      display: p.display !== false,
      aspect: p.aspect === true,
    }));
  } else {
    activeCustomPoints = [];
  }
  renderCustomPointsList();

  // Load aspect settings
  for (const aspect in settings.aspectSettings.aspects) {
    const aspectCheckbox = document.querySelector(
      `input[name="aspects"][value="${aspect}"]`,
    );
    if (aspectCheckbox) {
      aspectCheckbox.checked = settings.aspectSettings.aspects[aspect];
    }

    // Orbs
    if (settings.aspectSettings.orbs) {
      for (const [aspect, orb] of Object.entries(
        settings.aspectSettings.orbs,
      )) {
        const sel = document.querySelector(
          `#aspect-settings select.aspect-orb[data-aspect="${aspect}"]`,
        );
        if (sel) sel.value = String(orb);
      }
    }
  }

  // Load system settings
  const zodiacSelect = document.querySelector(`select[name="zodiacSystem"]`);
  if (zodiacSelect) {
    const rawSavedZodiacSystem = settings.systemSettings.zodiacSystem;
    const savedZodiacSystem = rawSavedZodiacSystem === "Tropical13Equal" ? "Sidereal13Equal" : rawSavedZodiacSystem;
    const hasSavedZodiacSystem = Array.from(zodiacSelect.options).some(
      (option) => option.value === savedZodiacSystem,
    );
    zodiacSelect.value = hasSavedZodiacSystem ? savedZodiacSystem : "Tropical";
  }
  const ayanamsaSelect = document.querySelector(`select[name="ayanamsaSystem"]`);
  if (ayanamsaSelect && settings.systemSettings.ayanamsaSystem) {
    ayanamsaSelect.value = settings.systemSettings.ayanamsaSystem === "Precession" ? "Tropical" : settings.systemSettings.ayanamsaSystem;
  }
  const customAyanamsaInput = document.querySelector(`input[name="customAyanamsa"]`);
  if (customAyanamsaInput && settings.systemSettings.customAyanamsa !== undefined) {
    customAyanamsaInput.value = settings.systemSettings.customAyanamsa;
  }
  if (typeof window.syncIau13Ayanamsa === "function") {
    window.syncIau13Ayanamsa();
  }
  const houseSelect = document.querySelector(`select[name="houseSystem"]`);
  if (houseSelect) {
    houseSelect.value = settings.systemSettings.houseSystem;
  }
  const coordSelect = document.querySelector(`select[name="coordinateSystem"]`);
  if (coordSelect) {
    coordSelect.value = settings.systemSettings.coordinateSystem;
  }
  const ascendantOverrideSelect = document.querySelector(
    'select[name="ascendantOverride"]',
  );
  if (ascendantOverrideSelect) {
    ascendantOverrideSelect.value =
      settings.systemSettings.ascendantOverride || "Normal";
  }

  // Load graph planet settings
  for (const planet in settings.graphSettings.planetSettings) {
    const graphPlanet = settings.graphSettings.planetSettings[planet];
    // Map saved keys to the correct checkbox values for progressed/transit
    // (natal uses True_Node but progressed/transit use "North Node" in the HTML)
    let progressedTransitValue = planet;
    if (planet === "True_Node") {
      progressedTransitValue = "North Node";
    }
    const natalCheckbox = document.querySelector(
      `input[name="planetNatal"][value="${planet}"]`,
    );
    const progressedCheckbox = document.querySelector(
      `input[name="planetProgressed"][value="${progressedTransitValue}"]`,
    );
    const transitCheckbox = document.querySelector(
      `input[name="planetTransit"][value="${progressedTransitValue}"]`,
    );
    if (natalCheckbox) natalCheckbox.checked = graphPlanet.natal;
    if (progressedCheckbox) progressedCheckbox.checked = graphPlanet.progressed;
    if (transitCheckbox) transitCheckbox.checked = graphPlanet.transit;
  }

  // Load graph aspect settings
  for (const aspect in settings.graphSettings.graphAspectSettings) {
    const aspectValue = settings.graphSettings.graphAspectSettings[aspect];
    const aspectCheckbox = document.querySelector(
      `input[name="transitingAspects"][value="${aspect}"]`,
    );
    if (aspectCheckbox) aspectCheckbox.checked = aspectValue;
  }

  // Load graph type settings
  for (const type in settings.graphSettings.graphTypeSettings) {
    const typeValue = settings.graphSettings.graphTypeSettings[type];
    const typeCheckbox = document.querySelector(
      `input[name="transitingTypes"][value="${type}"]`,
    );
    if (typeCheckbox) typeCheckbox.checked = typeValue;
  }

  // Backwards compatibility: Reset Sign Ingresses to unchecked if not present in saved settings
  // This type was added later and old saved settings won't have it
  if (!settings.graphSettings?.graphTypeSettings?.["Sign Ingresses"]) {
    const signIngressCheckbox = document.querySelector(
      'input[name="transitingTypes"][value="Sign Ingresses"]',
    );
    if (signIngressCheckbox) signIngressCheckbox.checked = false;
  }

  // Backwards compatibility: Reset Progressed Stations to unchecked if not present in saved settings
  // This type was added later and old saved settings won't have it
  if (!settings.graphSettings?.graphTypeSettings?.["Progressed Stations"]) {
    const progressedStationsCheckbox = document.querySelector(
      'input[name="transitingTypes"][value="Progressed Stations"]',
    );
    if (progressedStationsCheckbox) progressedStationsCheckbox.checked = false;
  }

  applySavedAccountState(settings);
}

// Gather settings from the form into an object following your structure
function getSettingsData() {
  const settingsData = {
    wheelSettings: {
      planets: {
        Sun: {
          display: document.querySelector('input[name="planet"][value="Sun"]')
            .checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Sun"]',
          ).checked,
        },
        Moon: {
          display: document.querySelector('input[name="planet"][value="Moon"]')
            .checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Moon"]',
          ).checked,
        },
        Mercury: {
          display: document.querySelector(
            'input[name="planet"][value="Mercury"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Mercury"]',
          ).checked,
        },
        Venus: {
          display: document.querySelector('input[name="planet"][value="Venus"]')
            .checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Venus"]',
          ).checked,
        },
        Mars: {
          display: document.querySelector('input[name="planet"][value="Mars"]')
            .checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Mars"]',
          ).checked,
        },
        Jupiter: {
          display: document.querySelector(
            'input[name="planet"][value="Jupiter"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Jupiter"]',
          ).checked,
        },
        Saturn: {
          display: document.querySelector(
            'input[name="planet"][value="Saturn"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Saturn"]',
          ).checked,
        },
        Uranus: {
          display: document.querySelector(
            'input[name="planet"][value="Uranus"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Uranus"]',
          ).checked,
        },
        Neptune: {
          display: document.querySelector(
            'input[name="planet"][value="Neptune"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Neptune"]',
          ).checked,
        },
        Pluto: {
          display: document.querySelector('input[name="planet"][value="Pluto"]')
            .checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Pluto"]',
          ).checked,
        },
        Chiron: {
          display: document.querySelector(
            'input[name="planet"][value="Chiron"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Chiron"]',
          ).checked,
        },
        True_Node: {
          display: document.querySelector(
            'input[name="planet"][value="True_Node"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="North Node"]',
          ).checked,
        },
        Ascendant_Symbol: {
          display: document.querySelector(
            'input[name="planet"][value="Ascendant_Symbol"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Ascendant Symbol"]',
          ).checked,
        },
        Midheaven: {
          display: document.querySelector(
            'input[name="planet"][value="Midheaven"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Midheaven"]',
          ).checked,
        },
        "South Node": {
          display: document.querySelector(
            'input[name="planet"][value="South Node"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="South Node"]',
          ).checked,
        },
        Descendant: {
          display: document.querySelector(
            'input[name="planet"][value="Descendant"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Descendant"]',
          ).checked,
        },
        "Imum Coeli": {
          display: document.querySelector(
            'input[name="planet"][value="Imum Coeli"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Imum Coeli"]',
          ).checked,
        },
        Ceres: {
          display: document.querySelector('input[name="planet"][value="Ceres"]')
            .checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Ceres"]',
          ).checked,
        },
        Vesta: {
          display: document.querySelector('input[name="planet"][value="Vesta"]')
            .checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Vesta"]',
          ).checked,
        },
        Pallas: {
          display: document.querySelector(
            'input[name="planet"][value="Pallas"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Pallas"]',
          ).checked,
        },
        Juno: {
          display: document.querySelector('input[name="planet"][value="Juno"]')
            .checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Juno"]',
          ).checked,
        },
        Lilith: {
          display: document.querySelector(
            'input[name="planet"][value="Lilith"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Lilith"]',
          ).checked,
        },
        Priapus: {
          display: document.querySelector(
            'input[name="planet"][value="Priapus"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Priapus"]',
          ).checked,
        },
        "Part of Fortune": {
          display: document.querySelector(
            'input[name="planet"][value="Part of Fortune"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Part of Fortune"]',
          ).checked,
        },
        "Part of Spirit": {
          display: document.querySelector(
            'input[name="planet"][value="Part of Spirit"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Part of Spirit"]',
          ).checked,
        },
        Vertex: {
          display: document.querySelector(
            'input[name="planet"][value="Vertex"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Vertex"]',
          ).checked,
        },
        "Anti-Vertex": {
          display: document.querySelector(
            'input[name="planet"][value="Anti-Vertex"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Anti-Vertex"]',
          ).checked,
        },
        "Galactic Center": {
          display: document.querySelector(
            'input[name="planet"][value="Galactic Center"]',
          ).checked,
          aspect: document.querySelector(
            'input[name="planetAspects"][value="Galactic Center"]',
          ).checked,
        },
      },
      degrees: document.querySelector('input[name="degrees"]').checked,
      trueNodes: document.querySelector('input[name="trueNodes"]').checked,
      trueLilith: document.querySelector('input[name="trueLilith"]').checked,
      draconic: document.querySelector('input[name="draconic"]').checked,
      fixedStars: document.querySelector('input[name="fixedStars"]').checked,
      fixedStarsMagnitude: parseFloat(
        document.querySelector('select[name="fixedStarsMagnitude"]').value,
      ),
      fixedStarsLatitude: parseFloat(
        document.querySelector('select[name="fixedStarsLatitude"]').value,
      ),
      customPoints: activeCustomPoints.map((p) => ({
        num: p.num,
        name: p.name,
        display: p.display,
        aspect: p.aspect,
      })),
    },
    aspectSettings: {
      aspects: {
        Conjunction: document.querySelector(
          'input[name="aspects"][value="Conjunction"]',
        ).checked,
        Opposition: document.querySelector(
          'input[name="aspects"][value="Opposition"]',
        ).checked,
        Square: document.querySelector('input[name="aspects"][value="Square"]')
          .checked,
        Trine: document.querySelector('input[name="aspects"][value="Trine"]')
          .checked,
        Sextile: document.querySelector(
          'input[name="aspects"][value="Sextile"]',
        ).checked,
        Semisextile: document.querySelector(
          'input[name="aspects"][value="Semisextile"]',
        ).checked,
        Quincunx: document.querySelector(
          'input[name="aspects"][value="Quincunx"]',
        ).checked,
      },
      orbs: Array.from(
        document.querySelectorAll("#aspect-settings select.aspect-orb"),
      ).reduce((obj, sel) => {
        obj[sel.dataset.aspect] = Number(sel.value); // { Conjunction: 10, … }
        return obj;
      }, {}),
    },
    systemSettings: {
      zodiacSystem: document.querySelector('select[name="zodiacSystem"]')?.value || "Tropical",
      ayanamsaSystem: document.querySelector('select[name="ayanamsaSystem"]')?.value || "Tropical",
      customAyanamsa: Number(document.querySelector('input[name="customAyanamsa"]')?.value ?? 0),
      houseSystem: document.querySelector('select[name="houseSystem"]').value,
      coordinateSystem: document.querySelector(
        'select[name="coordinateSystem"]',
      ).value,
      ascendantOverride: document.querySelector(
        'select[name="ascendantOverride"]',
      ).value,
    },
    graphSettings: {
      planetSettings: {
        Sun: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Sun"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Sun"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Sun"]',
          ).checked,
        },
        Moon: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Moon"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Moon"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Moon"]',
          ).checked,
        },
        Mercury: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Mercury"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Mercury"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Mercury"]',
          ).checked,
        },
        Venus: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Venus"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Venus"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Venus"]',
          ).checked,
        },
        Mars: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Mars"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Mars"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Mars"]',
          ).checked,
        },
        Jupiter: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Jupiter"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Jupiter"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Jupiter"]',
          ).checked,
        },
        Saturn: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Saturn"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Saturn"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Saturn"]',
          ).checked,
        },
        Uranus: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Uranus"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Uranus"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Uranus"]',
          ).checked,
        },
        Neptune: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Neptune"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Neptune"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Neptune"]',
          ).checked,
        },
        Pluto: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Pluto"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Pluto"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Pluto"]',
          ).checked,
        },
        Chiron: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Chiron"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Chiron"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Chiron"]',
          ).checked,
        },
        True_Node: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="True_Node"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="North Node"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="North Node"]',
          ).checked,
        },
        Ascendant_Symbol: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Ascendant_Symbol"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Ascendant_Symbol"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Ascendant_Symbol"]',
          ).checked,
        },
        Midheaven: {
          natal: document.querySelector(
            'input[name="planetNatal"][value="Midheaven"]',
          ).checked,
          progressed: document.querySelector(
            'input[name="planetProgressed"][value="Midheaven"]',
          ).checked,
          transit: document.querySelector(
            'input[name="planetTransit"][value="Midheaven"]',
          ).checked,
        },
      },
      graphAspectSettings: {
        Conjunction: document.querySelector(
          'input[name="transitingAspects"][value="Conjunction"]',
        ).checked,
        Opposition: document.querySelector(
          'input[name="transitingAspects"][value="Opposition"]',
        ).checked,
        Square: document.querySelector(
          'input[name="transitingAspects"][value="Square"]',
        ).checked,
        Trine: document.querySelector(
          'input[name="transitingAspects"][value="Trine"]',
        ).checked,
        Sextile: document.querySelector(
          'input[name="transitingAspects"][value="Sextile"]',
        ).checked,
        Semisextile: document.querySelector(
          'input[name="transitingAspects"][value="Semisextile"]',
        ).checked,
        Quincunx: document.querySelector(
          'input[name="transitingAspects"][value="Quincunx"]',
        ).checked,
      },
      graphTypeSettings: {
        "Progressed to Natal": document.querySelector(
          'input[name="transitingTypes"][value="Progressed to Natal"]',
        ).checked,
        "Transiting to Natal": document.querySelector(
          'input[name="transitingTypes"][value="Transiting to Natal"]',
        ).checked,
        "Progressed to Progressed": document.querySelector(
          'input[name="transitingTypes"][value="Progressed to Progressed"]',
        ).checked,
        "Transiting to Transiting": document.querySelector(
          'input[name="transitingTypes"][value="Transiting to Transiting"]',
        ).checked,
        Stations: document.querySelector(
          'input[name="transitingTypes"][value="Stations"]',
        ).checked,
        "Progressed Stations": document.querySelector(
          'input[name="transitingTypes"][value="Progressed Stations"]',
        ).checked,
        "House Ingresses": document.querySelector(
          'input[name="transitingTypes"][value="House Ingresses"]',
        ).checked,
        "Sign Ingresses": document.querySelector(
          'input[name="transitingTypes"][value="Sign Ingresses"]',
        ).checked,
      },
    },
  };

  return addAccountStateToSettings(settingsData);
}

// Reset form to default values as defined in the HTML
function resetFormToDefaults() {
  // Reset planet display checkboxes (most are checked by default)
  document.querySelector('input[name="planet"][value="Sun"]').checked = true;
  document.querySelector('input[name="planet"][value="Moon"]').checked = true;
  document.querySelector('input[name="planet"][value="Mercury"]').checked =
    true;
  document.querySelector('input[name="planet"][value="Venus"]').checked = true;
  document.querySelector('input[name="planet"][value="Mars"]').checked = true;
  document.querySelector('input[name="planet"][value="Jupiter"]').checked =
    true;
  document.querySelector('input[name="planet"][value="Saturn"]').checked = true;
  document.querySelector('input[name="planet"][value="Uranus"]').checked = true;
  document.querySelector('input[name="planet"][value="Neptune"]').checked =
    true;
  document.querySelector('input[name="planet"][value="Pluto"]').checked = true;
  document.querySelector('input[name="planet"][value="Chiron"]').checked = true;
  document.querySelector('input[name="planet"][value="True_Node"]').checked =
    true;
  document.querySelector('input[name="planet"][value="South Node"]').checked =
    true;
  document.querySelector(
    'input[name="planet"][value="Ascendant_Symbol"]',
  ).checked = true;
  document.querySelector('input[name="planet"][value="Midheaven"]').checked =
    true;
  document.querySelector('input[name="planet"][value="Descendant"]').checked =
    false;
  document.querySelector('input[name="planet"][value="Imum Coeli"]').checked =
    false;
  document.querySelector('input[name="planet"][value="Ceres"]').checked = true;
  document.querySelector('input[name="planet"][value="Vesta"]').checked = false;
  document.querySelector('input[name="planet"][value="Pallas"]').checked =
    false;
  document.querySelector('input[name="planet"][value="Juno"]').checked = false;
  document.querySelector('input[name="planet"][value="Lilith"]').checked =
    false;
  document.querySelector('input[name="planet"][value="Priapus"]').checked =
    false;
  document.querySelector(
    'input[name="planet"][value="Part of Fortune"]',
  ).checked = false;
  document.querySelector(
    'input[name="planet"][value="Part of Spirit"]',
  ).checked = false;
  document.querySelector('input[name="planet"][value="Vertex"]').checked =
    false;
  document.querySelector('input[name="planet"][value="Anti-Vertex"]').checked =
    false;
  document.querySelector(
    'input[name="planet"][value="Galactic Center"]',
  ).checked = false;

  // Reset planet aspect checkboxes (most are checked by default)
  document.querySelector('input[name="planetAspects"][value="Sun"]').checked =
    true;
  document.querySelector('input[name="planetAspects"][value="Moon"]').checked =
    true;
  document.querySelector(
    'input[name="planetAspects"][value="Mercury"]',
  ).checked = true;
  document.querySelector('input[name="planetAspects"][value="Venus"]').checked =
    true;
  document.querySelector('input[name="planetAspects"][value="Mars"]').checked =
    true;
  document.querySelector(
    'input[name="planetAspects"][value="Jupiter"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetAspects"][value="Saturn"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetAspects"][value="Uranus"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetAspects"][value="Neptune"]',
  ).checked = true;
  document.querySelector('input[name="planetAspects"][value="Pluto"]').checked =
    true;
  document.querySelector(
    'input[name="planetAspects"][value="Chiron"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="North Node"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="South Node"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Ascendant Symbol"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Midheaven"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Descendant"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Imum Coeli"]',
  ).checked = false;
  document.querySelector('input[name="planetAspects"][value="Ceres"]').checked =
    false;
  document.querySelector('input[name="planetAspects"][value="Vesta"]').checked =
    false;
  document.querySelector(
    'input[name="planetAspects"][value="Pallas"]',
  ).checked = false;
  document.querySelector('input[name="planetAspects"][value="Juno"]').checked =
    false;
  document.querySelector(
    'input[name="planetAspects"][value="Lilith"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Priapus"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Part of Fortune"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Part of Spirit"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Vertex"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Anti-Vertex"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetAspects"][value="Galactic Center"]',
  ).checked = false;

  // Reset degrees checkbox (checked by default)
  document.querySelector('input[name="degrees"]').checked = true;

  // Reset true nodes/lilith/draconic checkboxes (trueNodes checked, others unchecked by default)
  document.querySelector('input[name="trueNodes"]').checked = true;
  document.querySelector('input[name="trueLilith"]').checked = false;
  document.querySelector('input[name="draconic"]').checked = false;
  document.querySelector('input[name="fixedStars"]').checked = false;
  document.querySelector('select[name="fixedStarsMagnitude"]').value = "2.0";
  document.querySelector('select[name="fixedStarsLatitude"]').value = "30";

  // Reset custom points
  activeCustomPoints = [];
  renderCustomPointsList();

  // Reset aspect checkboxes (all checked by default)
  document.querySelector('input[name="aspects"][value="Conjunction"]').checked =
    true;
  document.querySelector('input[name="aspects"][value="Opposition"]').checked =
    true;
  document.querySelector('input[name="aspects"][value="Square"]').checked =
    true;
  document.querySelector('input[name="aspects"][value="Trine"]').checked = true;
  document.querySelector('input[name="aspects"][value="Sextile"]').checked =
    true;
  document.querySelector('input[name="aspects"][value="Semisextile"]').checked =
    true;
  document.querySelector('input[name="aspects"][value="Quincunx"]').checked =
    true;

  // Reset orb settings to default values
  document.querySelector('select.aspect-orb[data-aspect="Conjunction"]').value =
    "10";
  document.querySelector('select.aspect-orb[data-aspect="Opposition"]').value =
    "10";
  document.querySelector('select.aspect-orb[data-aspect="Square"]').value = "8";
  document.querySelector('select.aspect-orb[data-aspect="Trine"]').value = "8";
  document.querySelector('select.aspect-orb[data-aspect="Sextile"]').value =
    "6";
  document.querySelector('select.aspect-orb[data-aspect="Semisextile"]').value =
    "3";
  document.querySelector('select.aspect-orb[data-aspect="Quincunx"]').value =
    "3";

  // Reset system settings to default values (first option is default)
  document.querySelector('select[name="zodiacSystem"]').value = "Tropical";
  document.querySelector('select[name="houseSystem"]').value = "Placidus";
  document.querySelector('select[name="coordinateSystem"]').value =
    "Geocentric";
  document.querySelector('select[name="ascendantOverride"]').value = "Normal";
  if (typeof window.syncIau13Ayanamsa === "function") {
    window.syncIau13Ayanamsa();
  }

  // Reset graph planet settings
  document.querySelector('input[name="planetNatal"][value="Sun"]').checked =
    true;
  document.querySelector(
    'input[name="planetProgressed"][value="Sun"]',
  ).checked = true;
  document.querySelector('input[name="planetTransit"][value="Sun"]').checked =
    false;
  document.querySelector('input[name="planetNatal"][value="Moon"]').checked =
    true;
  document.querySelector(
    'input[name="planetProgressed"][value="Moon"]',
  ).checked = true;
  document.querySelector('input[name="planetTransit"][value="Moon"]').checked =
    false;
  document.querySelector('input[name="planetNatal"][value="Mercury"]').checked =
    true;
  document.querySelector(
    'input[name="planetProgressed"][value="Mercury"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetTransit"][value="Mercury"]',
  ).checked = false;
  document.querySelector('input[name="planetNatal"][value="Venus"]').checked =
    true;
  document.querySelector(
    'input[name="planetProgressed"][value="Venus"]',
  ).checked = true;
  document.querySelector('input[name="planetTransit"][value="Venus"]').checked =
    false;
  document.querySelector('input[name="planetNatal"][value="Mars"]').checked =
    true;
  document.querySelector(
    'input[name="planetProgressed"][value="Mars"]',
  ).checked = true;
  document.querySelector('input[name="planetTransit"][value="Mars"]').checked =
    false;
  document.querySelector('input[name="planetNatal"][value="Jupiter"]').checked =
    true;
  document.querySelector(
    'input[name="planetProgressed"][value="Jupiter"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetTransit"][value="Jupiter"]',
  ).checked = true;
  document.querySelector('input[name="planetNatal"][value="Saturn"]').checked =
    true;
  document.querySelector(
    'input[name="planetProgressed"][value="Saturn"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetTransit"][value="Saturn"]',
  ).checked = true;
  document.querySelector('input[name="planetNatal"][value="Uranus"]').checked =
    false;
  document.querySelector(
    'input[name="planetProgressed"][value="Uranus"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetTransit"][value="Uranus"]',
  ).checked = true;
  document.querySelector('input[name="planetNatal"][value="Neptune"]').checked =
    false;
  document.querySelector(
    'input[name="planetProgressed"][value="Neptune"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetTransit"][value="Neptune"]',
  ).checked = true;
  document.querySelector('input[name="planetNatal"][value="Pluto"]').checked =
    false;
  document.querySelector(
    'input[name="planetProgressed"][value="Pluto"]',
  ).checked = false;
  document.querySelector('input[name="planetTransit"][value="Pluto"]').checked =
    true;
  document.querySelector('input[name="planetNatal"][value="Chiron"]').checked =
    false;
  document.querySelector(
    'input[name="planetProgressed"][value="Chiron"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetTransit"][value="Chiron"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetNatal"][value="True_Node"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetProgressed"][value="North Node"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetTransit"][value="North Node"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetNatal"][value="Ascendant_Symbol"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetProgressed"][value="Ascendant_Symbol"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetTransit"][value="Ascendant_Symbol"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetNatal"][value="Midheaven"]',
  ).checked = true;
  document.querySelector(
    'input[name="planetProgressed"][value="Midheaven"]',
  ).checked = false;
  document.querySelector(
    'input[name="planetTransit"][value="Midheaven"]',
  ).checked = false;

  // Reset graph aspect settings (all checked by default)
  document.querySelector(
    'input[name="transitingAspects"][value="Conjunction"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingAspects"][value="Opposition"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingAspects"][value="Square"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingAspects"][value="Trine"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingAspects"][value="Sextile"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingAspects"][value="Semisextile"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingAspects"][value="Quincunx"]',
  ).checked = true;

  // Reset graph type settings (all checked by default)
  document.querySelector(
    'input[name="transitingTypes"][value="Progressed to Natal"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingTypes"][value="Transiting to Natal"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingTypes"][value="Progressed to Progressed"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingTypes"][value="Transiting to Transiting"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingTypes"][value="Stations"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingTypes"][value="Progressed Stations"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingTypes"][value="House Ingresses"]',
  ).checked = true;
  document.querySelector(
    'input[name="transitingTypes"][value="Sign Ingresses"]',
  ).checked = true;
}

window.getSettingsData = getSettingsData;
window.updateRecentSettings = updateRecentSettings;
window.fetchRecentSettings = fetchRecentSettings;
window.loadSettingsIntoForm = loadSettingsIntoForm;


window.getSettingsData = getSettingsData;
window.loadSettingsIntoForm = loadSettingsIntoForm;
window.TrueSkySettingsAccountState = {
  buildCurrentBirthChartSnapshot,
  getCurrentDefaultLocationForSettings,
  applyBirthChartFromSettings,
  applyDefaultLocationFromSettings,
};
