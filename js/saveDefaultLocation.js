"use strict";

const DEFAULT_LOCATION_STORAGE_KEY = "trueSky.defaultLocation";
const FALLBACK_DEFAULT_LOCATION = "New York City, New York, United States";

// Decode HTML entities for proper display of default location
function decodeHtmlEntities(str) {
  if (!str) return str;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = str;
  return textarea.value;
}

function getStoredDefaultLocation() {
  try {
    return localStorage.getItem(DEFAULT_LOCATION_STORAGE_KEY) || "";
  } catch (error) {
    return "";
  }
}

function setStoredDefaultLocation(value) {
  try {
    localStorage.setItem(DEFAULT_LOCATION_STORAGE_KEY, value);
    // Keep compatibility with older scripts/settings payloads that read these names.
    localStorage.setItem("astroDefaultLocation.v1", value);
    localStorage.setItem("defaultLocation", value);
  } catch (error) {
    // localStorage can be unavailable in private mode; server/Firebase save still works.
  }
}

function getUserDefaultLocation() {
  return String(window.user?.default_location || window.user?.defaultLocation || "").trim();
}

function getDefaultLocationValue() {
  const inputValue = document.getElementById("defaultLocation")?.value?.trim() || "";
  return (
    getStoredDefaultLocation().trim() ||
    getUserDefaultLocation() ||
    inputValue ||
    FALLBACK_DEFAULT_LOCATION
  );
}

function applyDefaultLocationToEmptyFields(location) {
  if (!location) return;
  document.querySelectorAll("input.location").forEach((el) => {
    if (el.id === "defaultLocation") return;
    const current = String(el.value || "").trim();
    if (!current || current === FALLBACK_DEFAULT_LOCATION) el.value = location;
  });
}

window.TrueSkyDefaultLocation = {
  key: DEFAULT_LOCATION_STORAGE_KEY,
  fallback: FALLBACK_DEFAULT_LOCATION,
  get: getDefaultLocationValue,
  set(value) {
    const clean = String(value || "").trim();
    if (!clean) return;
    setStoredDefaultLocation(clean);
    const input = document.getElementById("defaultLocation");
    if (input) input.value = clean;
    applyDefaultLocationToEmptyFields(clean);
  },
  apply: applyDefaultLocationToEmptyFields,
};

document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("saveDefaultLocationBtn");
  const input = document.getElementById("defaultLocation");
  const messageBox = document.getElementById("defaultLocationMessage");
  let messageTimer = null;
  let savingDefaultLocation = false;

  if (!saveBtn || !input || !messageBox) return;

  function withTimeout(promise, timeoutMs, label) {
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} demorou demais para responder.`)), timeoutMs);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  async function fetchJsonWithTimeout(url, options, timeoutMs, label) {
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    let abortTimer = null;
    const finalOptions = { ...(options || {}) };
    if (controller) {
      finalOptions.signal = controller.signal;
      abortTimer = setTimeout(() => controller.abort(), timeoutMs);
    }
    try {
      const response = await withTimeout(fetch(url, finalOptions), timeoutMs + 500, label);
      const data = await response.json().catch(() => ({}));
      return { response, data };
    } finally {
      if (abortTimer) clearTimeout(abortTimer);
    }
  }


  const suggestionsBox = input.parentElement?.querySelector(".suggestions-box") || input.nextElementSibling;
  let defaultCityCache = null;
  let defaultSuggestTimer = null;

  const normalizeText = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const buildCityDisplayName = (city) => [city.name, city.region, city.country].filter(Boolean).join(", ");

  async function loadDefaultCityList() {
    if (defaultCityCache) return defaultCityCache;
    try {
      const response = await fetch("/data/cities.json");
      if (!response.ok) throw new Error("city db failed");
      defaultCityCache = await response.json();
    } catch (error) {
      defaultCityCache = [];
    }
    return defaultCityCache;
  }

  async function showDefaultLocationSuggestions() {
    if (!suggestionsBox) return;
    const query = normalizeText(input.value);
    if (query.length < 2) {
      suggestionsBox.style.display = "none";
      suggestionsBox.innerHTML = "";
      return;
    }

    const cities = await loadDefaultCityList();
    const matches = cities
      .map((city) => {
        const display = buildCityDisplayName(city);
        const normalizedDisplay = normalizeText(display);
        const normalizedName = normalizeText(city.name);
        let score = 0;
        if (normalizedName.startsWith(query)) score += 50;
        if (normalizedDisplay.startsWith(query)) score += 25;
        if (normalizedDisplay.includes(query)) score += 10;
        return { city, display, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.display.localeCompare(b.display))
      .slice(0, 8);

    suggestionsBox.innerHTML = "";
    if (!matches.length) {
      suggestionsBox.style.display = "none";
      return;
    }

    matches.forEach(({ display }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "location-suggestion-option suggestion-item";
      button.textContent = display;
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        input.value = display;
        suggestionsBox.style.display = "none";
      });
      suggestionsBox.appendChild(button);
    });
    suggestionsBox.style.display = "block";
  }

  const initialLocation = decodeHtmlEntities(getDefaultLocationValue());
  if (initialLocation) {
    input.value = initialLocation;
    applyDefaultLocationToEmptyFields(initialLocation);
  }

  // If the backend has a saved default location, sync it too. The local value is
  // used immediately above so the UI still works while offline/file://.
  async function syncDefaultLocationFromCloud() {
    try {
      const { response, data } = await fetchJsonWithTimeout(
        "/api/default-location",
        { credentials: "same-origin" },
        10000,
        "Carregar Default Location"
      );
      if (!response.ok || data?.success === false) return;
      const serverLocation = String(data?.defaultLocation || data?.default_location || "").trim();
      if (serverLocation) window.TrueSkyDefaultLocation.set(decodeHtmlEntities(serverLocation));
    } catch (error) {
      // Keep the local/default value already applied above.
      console.warn("Default Location cloud sync skipped:", error);
    }
  }

  window.syncDefaultLocationFromCloud = syncDefaultLocationFromCloud;
  window.addEventListener("truesky-firebase-ready", syncDefaultLocationFromCloud);
  syncDefaultLocationFromCloud();

  const showLoading = () => {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.style.display = "block";
      const spinner = overlay.querySelector(".spinner");
      if (spinner) spinner.style.display = "";
    }
  };

  const hideLoading = () => {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = "none";
  };

  const hideSpinner = () => {
    const spinner = document.querySelector("#loading-overlay .spinner");
    if (spinner) spinner.style.display = "none";
  };

  async function saveDefaultLocation() {
    if (savingDefaultLocation) return;
    clearMessage();

    const location = decodeHtmlEntities(input.value).trim();

    if (!location) {
      showMessage("Enter a location to save.");
      return;
    }

    if (!isValidLocationInput(location)) {
      showMessage("Enter a city or coordinates, for example: Maringá, Paraná, Brazil or -23.4205, -51.9331.");
      return;
    }

    savingDefaultLocation = true;
    saveBtn.disabled = true;
    saveBtn.setAttribute("aria-busy", "true");
    showLoading();

    try {
      let savedLocation = location;
      if (window.TrueSkyCloud && typeof window.TrueSkyCloud.saveCloudDefaultLocation === "function") {
        savedLocation = await window.TrueSkyCloud.saveCloudDefaultLocation(location);
      } else {
        const { response, data } = await fetchJsonWithTimeout(
          "/save-default-location",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ defaultLocation: location }),
            credentials: "same-origin",
          },
          12000,
          "Salvar Default Location"
        );

        if (!response.ok || data?.success === false) {
          throw new Error(data?.error || "Error saving default location.");
        }
        savedLocation = data.defaultLocation || data.default_location || location;
      }

      window.TrueSkyDefaultLocation.set(savedLocation || location);
      showMessage("Default location saved to Firebase.");
    } catch (error) {
      // Keep the chosen value locally so the UI never loses the location, but
      // show the real Firebase error instead of the misleading generic timeout.
      console.warn("Default Location Firebase save failed; saved locally:", error);
      window.TrueSkyDefaultLocation.set(location);
      showMessage(`Default location saved locally. Firebase error: ${error.message || "cloud save failed."}`);
    } finally {
      hideLoading();
      saveBtn.disabled = false;
      saveBtn.removeAttribute("aria-busy");
      savingDefaultLocation = false;
    }
  }

  saveBtn.addEventListener("click", saveDefaultLocation);

  input.addEventListener("keydown", (e) => {
    const suggestionsBox = input.nextElementSibling;
    const firstSuggestion = suggestionsBox?.querySelector(".suggestion-item, .location-suggestion-option");

    if (e.key === "Enter") {
      if (suggestionsBox?.style.display === "block" && firstSuggestion) {
        e.preventDefault();
        input.value = firstSuggestion.textContent.trim();
        suggestionsBox.style.display = "none";
      } else {
        e.preventDefault();
        saveDefaultLocation();
      }
    }
  });

  input.addEventListener("input", () => {
    clearTimeout(defaultSuggestTimer);
    defaultSuggestTimer = setTimeout(showDefaultLocationSuggestions, 120);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => { if (suggestionsBox) suggestionsBox.style.display = "none"; }, 150);
  });

  input.addEventListener("focus", () => {
    input.select();
    showDefaultLocationSuggestions();
  });

  function showMessage(text) {
    messageBox.textContent = text;
    messageTimer = setTimeout(() => { messageBox.textContent = ""; }, 4000);
  }

  function clearMessage() {
    messageBox.textContent = "";
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
  }
});

// Accept normal city labels and coordinate formats. Do not depend on
// /locations.json because this package does not include that file.
function isValidLocationInput(inputValue) {
  const trimmed = String(inputValue || "").trim();
  if (trimmed.length < 2) return false;

  const latLonOnlyRegex = /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/;
  const labelledLatLonRegex = /^.+:\s*-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/;
  if (latLonOnlyRegex.test(trimmed) || labelledLatLonRegex.test(trimmed)) return true;

  // City/region/country text, including accents and apostrophes.
  return /^[\p{L}\p{M}0-9 .,'’()\-/]+$/u.test(trimmed);
}
