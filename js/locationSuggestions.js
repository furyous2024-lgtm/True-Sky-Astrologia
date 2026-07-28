(function () {
  "use strict";

  const CITY_DB_URL = "./data/cities.json";
  const TIMEZONE_LOOKUP_TIMEOUT_MS = 4500;
  let cityCache = null;
  let timezoneStandardOffsets = new Map();

  const debounce = (fn, delay = 250) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const normalizeText = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  const parseMonthValue = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    const numeric = Number.parseInt(raw, 10);
    if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) return numeric;
    const names = {
      january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
      julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    };
    return names[raw] || null;
  };

  const parseHistoricalYear = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const lower = raw.toLowerCase();
    const isBce = /(^|\s)(bc|bce|a\.?c\.?|ac)(\s|$)/i.test(lower) || raw.startsWith("-");
    const match = lower.match(/-?\d+/);
    if (!match) return null;
    const year = Math.abs(Number.parseInt(match[0], 10));
    if (!Number.isFinite(year) || year === 0) return null;
    return isBce ? -year : year;
  };

  const historicalToAstronomicalYear = (year) => {
    if (!Number.isFinite(year)) return null;
    return year < 0 ? year + 1 : year;
  };

  const makeUtcDate = (year, month, day, hour = 12, minute = 0) => {
    const astronomicalYear = historicalToAstronomicalYear(year);
    if (!Number.isFinite(astronomicalYear) || astronomicalYear <= 0) return null;
    const date = new Date(Date.UTC(0, month - 1, day, hour, minute, 0, 0));
    date.setUTCFullYear(astronomicalYear);
    return Number.isFinite(date.getTime()) ? date : null;
  };

  const getFirstFormValue = (form, selectors, fallback = "") => {
    for (const selector of selectors) {
      const el = form.querySelector(selector);
      const value = String(el?.value ?? "").trim();
      if (value) return value;
    }
    return fallback;
  };

  const getFormLocalDateGuess = (form) => {
    // Normal wheels use day/month/year. Transit Graph uses startDay/startMonth/startYear.
    // Use the date field that belongs to the same form so automatic UTC/DST is
    // calculated for the chart date, not for the browser's current date.
    const day = Number.parseInt(getFirstFormValue(form, ['[name="day"]', '[name="startDay"]', '.day'], ""), 10);
    const month = parseMonthValue(getFirstFormValue(form, ['[name="month"]', '[name="startMonth"]', '.month'], ""));
    const year = parseHistoricalYear(getFirstFormValue(form, ['[name="year"]', '[name="startYear"]', '.year'], ""));
    const hour = Number.parseInt(getFirstFormValue(form, ['[name="hour"]', '[name="startHour"]', '.hour'], "12"), 10);
    const minute = Number.parseInt(getFirstFormValue(form, ['[name="minute"]', '[name="startMinute"]', '.minute'], "0"), 10);
    if (!Number.isFinite(day) || !month || !Number.isFinite(year)) return new Date();
    return makeUtcDate(year, month, day, Number.isFinite(hour) ? hour : 12, Number.isFinite(minute) ? minute : 0) || new Date();
  };

  const parseOffsetName = (value) => {
    const raw = String(value || "").trim();
    if (!raw || raw === "GMT" || raw === "UTC") return 0;
    const match = raw.match(/(?:GMT|UTC)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?/i);
    if (!match) return null;
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number(match[2] || 0);
    const minutes = Number(match[3] || 0);
    const seconds = Number(match[4] || 0);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
    return sign * (hours + minutes / 60 + seconds / 3600);
  };

  const isNormalUtcOffsetHours = (offset) => {
    const n = Number(offset);
    if (!Number.isFinite(n) || n < -12 || n > 14) return false;
    const rawMinutes = n * 60;
    const totalMinutes = Math.round(rawMinutes);
    if (Math.abs(rawMinutes - totalMinutes) > 1e-6) return false;
    const minutePart = Math.abs(totalMinutes) % 60;
    return minutePart === 0 || minutePart === 15 || minutePart === 30 || minutePart === 45;
  };

  const toOffsetNumber = (offset, fallback = 0) => {
    const parsedName = parseOffsetName(offset);
    if (Number.isFinite(parsedName)) return parsedName;
    const n = Number(String(offset ?? "").trim().replace(",", "."));
    if (Number.isFinite(n)) return n;
    const fallbackName = parseOffsetName(fallback);
    if (Number.isFinite(fallbackName)) return fallbackName;
    const fb = Number(String(fallback ?? "").trim().replace(",", "."));
    return Number.isFinite(fb) ? fb : (Number.isNaN(fallback) ? NaN : 0);
  };

  const normalizeUtcOffsetHours = (offset, fallback = 0) => {
    const n = toOffsetNumber(offset, NaN);
    if (isNormalUtcOffsetHours(n)) return Math.round(n * 60) / 60;
    const fb = toOffsetNumber(fallback, NaN);
    if (isNormalUtcOffsetHours(fb)) return Math.round(fb * 60) / 60;
    if (Number.isFinite(n)) {
      const roundedMinutes = Math.max(-12 * 60, Math.min(14 * 60, Math.round(n * 4) * 15));
      return roundedMinutes / 60;
    }
    return 0;
  };

  const rawOffsetFromIntl = (timeZone, date) => {
    if (!timeZone || !(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
    for (const timeZoneName of ["longOffset", "shortOffset", "short"]) {
      try {
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone,
          timeZoneName,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        }).formatToParts(date);
        const tz = parts.find((p) => p.type === "timeZoneName")?.value || "";
        const parsed = parseOffsetName(tz);
        if (Number.isFinite(parsed)) return parsed;
      } catch (_) {
        break;
      }
    }
    return null;
  };

  const getStandardOffsetForTimezone = (timezoneId, fallback = 0) => {
    const key = String(timezoneId || "").trim();
    if (!key) return normalizeUtcOffsetHours(fallback, fallback);
    const lowerKey = key.toLowerCase();
    if (timezoneStandardOffsets.has(key)) return normalizeUtcOffsetHours(timezoneStandardOffsets.get(key), fallback);
    if (timezoneStandardOffsets.has(lowerKey)) return normalizeUtcOffsetHours(timezoneStandardOffsets.get(lowerKey), fallback);
    if (lowerKey === "utc" || lowerKey === "etc/utc" || lowerKey === "gmt" || lowerKey === "etc/gmt") return 0;

    const sampleDates = [
      new Date(Date.UTC(2024, 0, 15, 12, 0, 0)),
      new Date(Date.UTC(2024, 3, 15, 12, 0, 0)),
      new Date(Date.UTC(2024, 6, 15, 12, 0, 0)),
      new Date(Date.UTC(2024, 9, 15, 12, 0, 0)),
    ];
    const normalOffsets = sampleDates
      .map((date) => rawOffsetFromIntl(key, date))
      .filter((offset) => isNormalUtcOffsetHours(offset))
      .map((offset) => Math.round(offset * 60) / 60);

    if (normalOffsets.length) {
      const standard = Math.min(...normalOffsets);
      timezoneStandardOffsets.set(key, standard);
      timezoneStandardOffsets.set(lowerKey, standard);
      return standard;
    }

    return normalizeUtcOffsetHours(fallback, fallback);
  };

  const toUtcOffsetHours = (timezoneId, date = new Date(), fallbackOffset = null) => {
    if (!timezoneId) return normalizeUtcOffsetHours(fallbackOffset, 0);
    const timeZone = String(timezoneId).trim();
    const safeFallback = getStandardOffsetForTimezone(timeZone, toOffsetNumber(fallbackOffset, 0));
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return safeFallback;
    if (date.getUTCFullYear() <= 0) return safeFallback;

    // Prefer comparing the IANA-formatted local clock against the UTC instant.
    // When old IANA data returns LMT offsets such as +00:53, normalize back to
    // the civil timezone standard (for example Europe/Vienna => UTC+01:00).
    try {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(date).map((part) => [part.type, part.value]));
      const localAsUtc = makeUtcDate(
        Number(parts.year),
        Number(parts.month),
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute)
      );
      if (localAsUtc instanceof Date && Number.isFinite(localAsUtc.getTime())) {
        const seconds = Number(parts.second || 0);
        localAsUtc.setUTCSeconds(seconds, 0);
        const rawOffset = (localAsUtc.getTime() - date.getTime()) / 3600000;
        return normalizeUtcOffsetHours(rawOffset, safeFallback);
      }
    } catch (_) {}

    const rawOffset = rawOffsetFromIntl(timeZone, date);
    if (Number.isFinite(rawOffset)) return normalizeUtcOffsetHours(rawOffset, safeFallback);
    return safeFallback;
  };

  const getOffsetForFormDate = (timezoneId, form, fallbackOffset = 0) => {
    const fallback = getStandardOffsetForTimezone(timezoneId, toOffsetNumber(fallbackOffset, 0));
    const formYear = parseHistoricalYear(getFirstFormValue(form, ['[name="year"]', '[name="startYear"]', '.year'], ""));
    if (Number.isFinite(formYear) && formYear <= 0) return fallback;
    const localDate = getFormLocalDateGuess(form);
    if (!(localDate instanceof Date) || !Number.isFinite(localDate.getTime())) return fallback;

    // Resolve the offset for the typed local date/time, not merely for "now".
    // This keeps modern DST when it is a valid civil offset, but blocks old LMT
    // values like UTC+00:53 from ever entering the automatic UTC field.
    let offset = fallback;
    for (let i = 0; i < 3; i += 1) {
      const utcGuess = new Date(localDate.getTime() - offset * 3600000);
      const nextOffset = toUtcOffsetHours(timezoneId, utcGuess, offset);
      if (!Number.isFinite(nextOffset)) break;
      if (Math.abs(nextOffset - offset) < 1 / 60) {
        offset = nextOffset;
        break;
      }
      offset = nextOffset;
    }
    return normalizeUtcOffsetHours(offset, fallback);
  };

  const formatOffset = (offset) => {
    const safe = normalizeUtcOffsetHours(offset, offset);
    const totalMinutes = Math.round(safe * 60);
    const sign = totalMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(totalMinutes);
    const h = String(Math.floor(absMinutes / 60)).padStart(2, "0");
    const m = String(absMinutes % 60).padStart(2, "0");
    return `UTC${sign}${h}:${m}`;
  };

  const canonicalKey = (item) => [item.name, item.region, item.country].map(normalizeText).join("|");
  const coordinateKey = (item) => `${Number(item.lat).toFixed(3)}|${Number(item.lon).toFixed(3)}`;

  const distanceKm = (aLat, aLon, bLat, bLon) => {
    const toRad = (d) => d * Math.PI / 180;
    const r = 6371;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
    return 2 * r * Math.asin(Math.sqrt(x));
  };

  const loadCityDb = async () => {
    if (cityCache) return cityCache;
    try {
      const res = await fetch(CITY_DB_URL, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error("local city db failed");
      const raw = await res.json();
      const map = new Map();
      raw.forEach((city) => {
        const timezone = city.timezone || "UTC";
        const standardOffset = normalizeUtcOffsetHours(city.utcOffset ?? toUtcOffsetHours(timezone), getStandardOffsetForTimezone(timezone, 0));
        const item = {
          name: city.name,
          region: city.region || "",
          country: city.country || "",
          lat: Number(city.lat),
          lon: Number(city.lon),
          timezone,
          utcOffset: standardOffset,
          source: "local",
        };
        if (timezone && isNormalUtcOffsetHours(standardOffset)) {
          timezoneStandardOffsets.set(timezone, standardOffset);
          timezoneStandardOffsets.set(String(timezone).toLowerCase(), standardOffset);
        }
        if (Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
          const key = `${canonicalKey(item)}|${coordinateKey(item)}`;
          map.set(key, item);
        }
      });
      cityCache = [...map.values()].sort((a, b) => `${a.country} ${a.region} ${a.name}`.localeCompare(`${b.country} ${b.region} ${b.name}`));
    } catch (_) {
      cityCache = [];
    }
    return cityCache;
  };

  const nearestLocalTimezone = async (lat, lon) => {
    const db = await loadCityDb();
    let best = null;
    db.forEach((city) => {
      const d = distanceKm(lat, lon, Number(city.lat), Number(city.lon));
      if (!best || d < best.distance) best = { city, distance: d };
    });
    if (best && best.distance <= 900) return { timezone: best.city.timezone, offset: normalizeUtcOffsetHours(best.city.utcOffset, getStandardOffsetForTimezone(best.city.timezone, 0)) };
    const estimated = Math.max(-12, Math.min(14, Math.round(Number(lon) / 15)));
    return { timezone: "UTC", offset: normalizeUtcOffsetHours(estimated, 0) };
  };

  const buildDisplayName = (item) => [item.name, item.region, item.country].filter(Boolean).join(", ") || item.display_name || "Localização";

  const ensureHidden = (form, name) => {
    let el = form.querySelector(`input[name="${name}"]`);
    if (!el) {
      el = document.createElement("input");
      el.type = "hidden";
      el.name = name;
      form.appendChild(el);
    }
    return el;
  };


  const clearFormLocation = (form, locationInput) => {
    const keepManualUtc = getUtcMode(form, locationInput) === "manual";
    const manualUtcValue = keepManualUtc ? (ensureHidden(form, "utcOffset").value || ensureHidden(form, "utc").value || locationInput.dataset.selectedUtcFallback || "") : "";

    delete locationInput.dataset.selectedLat;
    delete locationInput.dataset.selectedLon;
    delete locationInput.dataset.selectedTimezone;
    if (!keepManualUtc) delete locationInput.dataset.selectedUtcFallback;

    ["lat", "long", "latitude", "longitude", "timezone", "timezoneName"].forEach((name) => {
      const el = form.querySelector(`input[name="${name}"]`);
      if (el) el.value = "";
    });

    if (keepManualUtc) {
      setUtcMode(form, locationInput, "manual");
      if (manualUtcValue !== "") {
        ensureHidden(form, "utcOffset").value = manualUtcValue;
        ensureHidden(form, "utc").value = manualUtcValue;
        locationInput.dataset.selectedUtcFallback = manualUtcValue;
      }
    } else {
      ["utcOffset", "utc", "utcMode"].forEach((name) => {
        const el = form.querySelector(`input[name="${name}"]`);
        if (el) el.value = "";
      });
    }
  };

  const getUtcMode = (form, locationInput) => {
    const hiddenMode = ensureHidden(form, "utcMode").value;
    const datasetMode = locationInput?.dataset?.utcMode;
    return (hiddenMode || datasetMode || "auto").toLowerCase() === "manual" ? "manual" : "auto";
  };

  const setUtcMode = (form, locationInput, mode) => {
    const normalized = String(mode || "auto").toLowerCase() === "manual" ? "manual" : "auto";
    ensureHidden(form, "utcMode").value = normalized;
    if (locationInput) locationInput.dataset.utcMode = normalized;
    const panel = form.querySelector(`[data-location-panel-for="${locationInput?.dataset?.locationControlId}"]`);
    if (panel) {
      const modeInput = panel.querySelector(".utc-mode");
      const manualUtc = panel.querySelector(".manual-utc");
      if (modeInput) modeInput.value = normalized;
      if (manualUtc) {
        manualUtc.disabled = normalized !== "manual";
        manualUtc.placeholder = normalized === "manual" ? "ex: -3 ou -03:00" : "automático";
      }
    }
    return normalized;
  };

  const parseManualUtcOffset = (value) => {
    const raw = String(value ?? "").trim().replace(",", ".");
    if (!raw) return null;
    const parsedName = parseOffsetName(raw);
    if (Number.isFinite(parsedName)) return parsedName;
    const match = raw.match(/^([+-])?(\d{1,2})(?::(\d{1,2}))?$/);
    if (match) {
      const sign = match[1] === "-" ? -1 : 1;
      const hours = Number(match[2]);
      const minutes = Number(match[3] || 0);
      if (Number.isFinite(hours) && Number.isFinite(minutes) && hours <= 14 && minutes < 60) {
        return sign * (hours + minutes / 60);
      }
    }
    const numeric = Number(raw);
    return Number.isFinite(numeric) && numeric >= -12 && numeric <= 14 ? numeric : null;
  };

  const setFormLocation = (form, locationInput, data) => {
    const lat = Number(data.lat ?? data.latitude);
    const lon = Number(data.lon ?? data.long ?? data.lng ?? data.longitude);
    const timezone = data.timezone || "UTC";
    const hasExplicitMode = Object.prototype.hasOwnProperty.call(data, "utcMode") || Object.prototype.hasOwnProperty.call(data, "timezoneMode");
    const requestedMode = hasExplicitMode
      ? (String(data.utcMode || data.timezoneMode || "auto").toLowerCase() === "manual" ? "manual" : "auto")
      : getUtcMode(form, locationInput);
    const rawBaseOffset = toOffsetNumber(data.utcOffset ?? data.utc ?? 0, 0);
    const baseOffset = requestedMode === "manual" && hasExplicitMode
      ? normalizeUtcOffsetHours(rawBaseOffset, rawBaseOffset)
      : getStandardOffsetForTimezone(timezone, rawBaseOffset);
    const panel = form.querySelector(`[data-location-panel-for="${locationInput.dataset.locationControlId}"]`);
    const currentManualOffset = parseManualUtcOffset(
      requestedMode === "manual" && hasExplicitMode
        ? (data.utcOffset ?? data.utc ?? panel?.querySelector(".manual-utc")?.value ?? ensureHidden(form, "utcOffset").value)
        : (panel?.querySelector(".manual-utc")?.value || ensureHidden(form, "utcOffset").value || ensureHidden(form, "utc").value)
    );
    const utcOffset = requestedMode === "manual"
      ? (Number.isFinite(currentManualOffset) ? normalizeUtcOffsetHours(currentManualOffset, currentManualOffset) : baseOffset)
      : getOffsetForFormDate(timezone, form, baseOffset);
    const latValue = Number.isFinite(lat) ? lat.toFixed(6) : "0";
    const lonValue = Number.isFinite(lon) ? lon.toFixed(6) : "0";
    const utcValue = Number.isFinite(utcOffset) ? String(utcOffset) : "0";
    const utcDisplayValue = formatOffset(utcOffset);

    locationInput.dataset.selectedLat = latValue;
    locationInput.dataset.selectedLon = lonValue;
    locationInput.dataset.selectedTimezone = timezone;
    locationInput.dataset.selectedUtcFallback = requestedMode === "manual"
      ? utcValue
      : String(Number.isFinite(baseOffset) ? baseOffset : utcOffset);

    ensureHidden(form, "lat").value = latValue;
    ensureHidden(form, "long").value = lonValue;
    ensureHidden(form, "latitude").value = latValue;
    ensureHidden(form, "longitude").value = lonValue;
    ensureHidden(form, "utcOffset").value = utcValue;
    ensureHidden(form, "utc").value = utcValue;
    ensureHidden(form, "timezone").value = timezone;
    ensureHidden(form, "timezoneName").value = timezone;
    setUtcMode(form, locationInput, requestedMode);

    if (panel) {
      panel.querySelector(".manual-lat").value = latValue;
      panel.querySelector(".manual-lon").value = lonValue;
      panel.querySelector(".manual-tz").value = timezone;
      panel.querySelector(".manual-utc").value = utcDisplayValue;
    }
  };

  const refreshSelectedUtcOffset = (form, locationInput) => {
    const timezone = locationInput.dataset.selectedTimezone || ensureHidden(form, "timezone").value;
    const mode = getUtcMode(form, locationInput);
    const panel = form.querySelector(`[data-location-panel-for="${locationInput.dataset.locationControlId}"]`);
    if (mode === "manual") {
      const current = parseManualUtcOffset(panel?.querySelector(".manual-utc")?.value || ensureHidden(form, "utcOffset").value || ensureHidden(form, "utc").value);
      if (Number.isFinite(current)) {
        ensureHidden(form, "utcOffset").value = String(current);
        ensureHidden(form, "utc").value = String(current);
        locationInput.dataset.selectedUtcFallback = String(current);
        if (panel) panel.querySelector(".manual-utc").value = formatOffset(current);
      }
      if (panel) {
        const status = panel.querySelector(".location-status");
        const timezoneLabel = timezone ? ` ${timezone}` : "";
        if (status && (locationInput.value.trim() || Number.isFinite(current))) status.textContent = `UTC manual fixo: ${formatOffset(ensureHidden(form, "utcOffset").value)}${timezoneLabel}`;
      }
      return;
    }
    if (!timezone) return;
    const fallback = getStandardOffsetForTimezone(timezone, locationInput.dataset.selectedUtcFallback || ensureHidden(form, "utcOffset").value || 0);
    const offset = getOffsetForFormDate(timezone, form, fallback);
    ensureHidden(form, "utcOffset").value = String(offset);
    ensureHidden(form, "utc").value = String(offset);
    if (panel) {
      panel.querySelector(".manual-utc").value = formatOffset(offset);
      const status = panel.querySelector(".location-status");
      if (status && locationInput.value.trim()) status.textContent = `UTC automático atualizado para a data informada: ${formatOffset(offset)} ${timezone}`;
    }
  };

  const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEZONE_LOOKUP_TIMEOUT_MS);
    try {
      return await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const getTimezoneByCoordinate = async (lat, lon) => {
    const urls = [
      `/api/timezone?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      `https://timeapi.io/api/TimeZone/coordinate?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error("timezone lookup failed");
        const data = await res.json();
        const timezone = data.timeZone || data.id || data.timezone || "UTC";
        const offset = Number.isFinite(Number(data.currentUtcOffset?.seconds))
          ? normalizeUtcOffsetHours(Number(data.currentUtcOffset.seconds) / 3600, getStandardOffsetForTimezone(timezone, 0))
          : toUtcOffsetHours(timezone);
        if (timezone && timezone !== "UTC") return { timezone, offset };
      } catch (_) {}
    }
    return nearestLocalTimezone(Number(lat), Number(lon));
  };

  const makeSuggestion = (item, form, locationInput, box, status) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "location-suggestion-option";
    const displayOffset = getOffsetForFormDate(item.timezone, form, item.utcOffset);
    option.innerHTML = `<strong>${buildDisplayName(item)}</strong><small>${Number(item.lat).toFixed(4)}, ${Number(item.lon).toFixed(4)} · ${formatOffset(displayOffset)} · ${item.timezone || "UTC"}</small>`;
    option.addEventListener("click", () => {
      locationInput.value = buildDisplayName(item);
      setFormLocation(form, locationInput, item);
      box.innerHTML = "";
      box.style.display = "none";
      const appliedOffset = ensureHidden(form, "utcOffset").value;
      status.textContent = `Localização aplicada: ${formatOffset(appliedOffset)} ${item.timezone || ""}`.trim();
    });
    return option;
  };

  const localSearch = async (query) => {
    const db = await loadCityDb();
    const q = normalizeText(query);
    if (!q) return [];
    return db
      .map((city) => {
        const hay = normalizeText(`${city.name} ${city.region} ${city.country}`);
        let score = hay === q ? 120 : hay.startsWith(q) ? 90 : hay.includes(q) ? 50 : 0;
        if (normalizeText(city.name).startsWith(q)) score += 35;
        if (normalizeText(city.country).startsWith(q)) score += 10;
        return { city, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || buildDisplayName(a.city).localeCompare(buildDisplayName(b.city)))
      .slice(0, 12)
      .map((x) => x.city);
  };

  const searchOnline = async (query) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=10&q=${encodeURIComponent(query)}`;
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error("city lookup failed");
      const data = await res.json();
      const items = await Promise.all(data.map(async (item) => {
        const address = item.address || {};
        const lat = Number(item.lat);
        const lon = Number(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const tz = await getTimezoneByCoordinate(lat, lon);
        const timezone = tz.timezone || "UTC";
        return {
          name: address.city || address.town || address.village || address.municipality || address.county || item.name || "Localização",
          region: address.state || address.region || address.province || "",
          country: address.country || "",
          lat,
          lon,
          timezone,
          utcOffset: Number.isFinite(toOffsetNumber(tz.offset, NaN)) ? normalizeUtcOffsetHours(tz.offset, getStandardOffsetForTimezone(timezone, 0)) : toUtcOffsetHours(timezone),
          source: "online",
        };
      }));
      const map = new Map();
      items.filter(Boolean).forEach((city) => map.set(`${canonicalKey(city)}|${coordinateKey(city)}`, city));
      return [...map.values()];
    } catch (_) {
      return [];
    }
  };

  const attachLocationControl = (locationInput, index) => {
    const form = locationInput.closest("form");
    if (!form || locationInput.dataset.enhancedLocation === "true") return;
    locationInput.dataset.enhancedLocation = "true";
    locationInput.dataset.locationControlId = locationInput.id || `location-control-${index}`;
    if (!locationInput.id) locationInput.id = locationInput.dataset.locationControlId;
    locationInput.autocomplete = "off";

    ["lat", "long", "latitude", "longitude", "utcOffset", "utc", "timezone", "timezoneName", "utcMode"].forEach((name) => ensureHidden(form, name));

    let box = locationInput.parentElement.querySelector(".suggestions-box");
    if (!box) {
      box = document.createElement("div");
      box.className = "suggestions-box";
      locationInput.insertAdjacentElement("afterend", box);
    }
    box.classList.add("online-location-suggestions");

    const panel = document.createElement("div");
    panel.className = "location-options-panel";
    panel.dataset.locationPanelFor = locationInput.dataset.locationControlId;
    panel.innerHTML = `
      <button type="button" class="use-current-location">Usar minha localização atual</button>
      <details class="manual-location-details" open>
        <summary>Coordenadas manuais</summary>
        <label>Latitude <input class="manual-lat" inputmode="decimal" placeholder="-23.5505"></label>
        <label>Longitude <input class="manual-lon" inputmode="decimal" placeholder="-46.6333"></label>
        <label>Timezone IANA <input class="manual-tz" placeholder="America/Sao_Paulo"></label>
        <label>Modo UTC <select class="utc-mode"><option value="auto">Automático pela localização/data</option><option value="manual">Manual fixo</option></select></label>
        <label>UTC manual <input class="manual-utc" inputmode="decimal" placeholder="automático" disabled></label>
        <button type="button" class="apply-manual-location">Aplicar coordenadas/UTC</button>
      </details>
      <small class="location-status">Digite uma cidade para escolher da lista sem duplicadas, ou use coordenadas manuais.</small>
    `;
    box.insertAdjacentElement("afterend", panel);
    const status = panel.querySelector(".location-status");
    setUtcMode(form, locationInput, ensureHidden(form, "utcMode").value || "auto");
    panel.querySelector(".utc-mode").addEventListener("change", (event) => {
      const mode = setUtcMode(form, locationInput, event.target.value);
      if (mode === "auto") {
        refreshSelectedUtcOffset(form, locationInput);
      } else {
        const current = ensureHidden(form, "utcOffset").value || panel.querySelector(".manual-utc").value || "0";
        panel.querySelector(".manual-utc").value = formatOffset(current);
        status.textContent = `UTC manual ativado: ${formatOffset(current)}. Edite o campo e clique em Aplicar.`;
      }
    });
    panel.querySelector(".manual-utc").addEventListener("input", () => {
      if (panel.querySelector(".utc-mode").value !== "manual") setUtcMode(form, locationInput, "manual");
      const manual = parseManualUtcOffset(panel.querySelector(".manual-utc").value);
      if (Number.isFinite(manual)) {
        ensureHidden(form, "utcOffset").value = String(manual);
        ensureHidden(form, "utc").value = String(manual);
        locationInput.dataset.selectedUtcFallback = String(manual);
      }
    });

    const renderResults = (results) => {
      const map = new Map();
      results.forEach((item) => map.set(`${canonicalKey(item)}|${coordinateKey(item)}`, item));
      const unique = [...map.values()].slice(0, 12);
      box.innerHTML = "";
      unique.forEach((item) => box.appendChild(makeSuggestion(item, form, locationInput, box, status)));
      box.style.display = unique.length ? "block" : "none";
      status.textContent = unique.length ? "Escolha uma cidade da lista ou aplique coordenadas manuais." : "Nenhuma cidade encontrada. Use coordenadas manuais.";
    };

    const doSearch = debounce(async () => {
      const q = locationInput.value.trim();
      if (q.length < 2) {
        box.innerHTML = "";
        box.style.display = "none";
        status.textContent = "Digite uma cidade para buscar.";
        return;
      }
      status.textContent = "Buscando cidades...";
      const local = await localSearch(q);
      renderResults(local);
      if (local.length < 8) {
        const online = await searchOnline(q);
        renderResults([...local, ...online]);
      }
    }, 250);

    locationInput.addEventListener("input", () => {
      clearFormLocation(form, locationInput);
      doSearch();
    });

    locationInput.addEventListener("blur", async () => {
      if (locationInput.dataset.selectedTimezone || !locationInput.value.trim()) return;
      const local = await localSearch(locationInput.value.trim());
      const exact = local.find((item) => normalizeText(buildDisplayName(item)) === normalizeText(locationInput.value.trim()) || normalizeText(item.name) === normalizeText(locationInput.value.trim()));
      if (exact) {
        setFormLocation(form, locationInput, exact);
        const appliedOffset = ensureHidden(form, "utcOffset").value;
        status.textContent = `Localização aplicada automaticamente: ${formatOffset(appliedOffset)} ${exact.timezone || ""}`.trim();
      }
    });

    form.querySelectorAll('[name="day"], [name="month"], [name="year"], [name="hour"], [name="minute"], [name="startDay"], [name="startMonth"], [name="startYear"], [name="startHour"], [name="startMinute"], .day, .month, .year, .hour, .minute')
      .forEach((el) => {
        el.addEventListener("input", () => refreshSelectedUtcOffset(form, locationInput));
        el.addEventListener("change", () => refreshSelectedUtcOffset(form, locationInput));
      });
    form.addEventListener("submit", () => refreshSelectedUtcOffset(form, locationInput));

    panel.querySelector(".use-current-location").addEventListener("click", () => {
      if (!navigator.geolocation) {
        status.textContent = "Geolocalização não disponível neste navegador.";
        return;
      }
      status.textContent = "Obtendo sua localização...";
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const tz = await getTimezoneByCoordinate(lat, lon);
        locationInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        setFormLocation(form, locationInput, { lat, lon, timezone: tz.timezone, utcOffset: tz.offset });
        const appliedOffset = ensureHidden(form, "utcOffset").value;
        status.textContent = `Localização aplicada: ${formatOffset(appliedOffset)} ${tz.timezone || ""}`.trim();
      }, (err) => {
        status.textContent = err.message || "Não foi possível obter a localização.";
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 });
    });

    panel.querySelector(".apply-manual-location").addEventListener("click", () => {
      const lat = Number(panel.querySelector(".manual-lat").value.replace(",", "."));
      const lon = Number(panel.querySelector(".manual-lon").value.replace(",", "."));
      const timezone = panel.querySelector(".manual-tz").value.trim() || "UTC";
      const mode = panel.querySelector(".utc-mode").value === "manual" ? "manual" : "auto";
      const manualOffset = panel.querySelector(".manual-utc").value.trim();
      const parsedManualOffset = parseManualUtcOffset(manualOffset);
      const utcOffset = mode === "manual" ? normalizeUtcOffsetHours(parsedManualOffset, parsedManualOffset) : getOffsetForFormDate(timezone, form, getStandardOffsetForTimezone(timezone, 0));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        status.textContent = "Digite latitude e longitude válidas.";
        return;
      }
      if (!Number.isFinite(utcOffset)) {
        status.textContent = "Digite UTC manual válido, por exemplo -3, -03:00 ou UTC-03:00.";
        return;
      }
      setFormLocation(form, locationInput, { lat, lon, timezone, utcOffset, utcMode: mode });
      locationInput.value = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
      const appliedOffset = ensureHidden(form, "utcOffset").value;
      status.textContent = mode === "manual"
        ? `Coordenadas aplicadas com UTC manual: ${formatOffset(appliedOffset)} ${timezone}`
        : `Coordenadas aplicadas com UTC automático: ${formatOffset(appliedOffset)} ${timezone}`;
    });
  };

  const addStyles = () => {
    if (document.getElementById("enhanced-location-styles")) return;
    const style = document.createElement("style");
    style.id = "enhanced-location-styles";
    style.textContent = `
      .online-location-suggestions { display:none; max-height:260px; overflow-y:auto; border:1px solid rgba(255,255,255,.18); border-radius:10px; background:#111b25; color:#f5f7fb; z-index:9999; box-shadow:0 10px 24px rgba(0,0,0,.35); }
      .location-suggestion-option { display:grid; gap:3px; width:100%; padding:9px 11px; border:0; background:transparent; color:inherit; text-align:left; cursor:pointer; }
      .location-suggestion-option small { color:#b6c3d2; }
      .location-suggestion-option:hover { background:rgba(255,255,255,.09); }
      .location-options-panel { margin:8px 0 12px; display:grid; gap:8px; }
      .use-current-location, .apply-manual-location { width:fit-content; padding:6px 10px; cursor:pointer; border-radius:8px; border:1px solid rgba(255,255,255,.18); background:#162233; color:#fff; }
      .manual-location-details label { display:grid; gap:3px; margin:6px 0; }
      .manual-location-details input, .manual-location-details select { max-width:280px; }
      .location-status { color:#aeb8c5; font-size:.9em; }
    `;
    document.head.appendChild(style);
  };

  window.TrueSkyLocationControls = window.TrueSkyLocationControls || {};
  window.TrueSkyLocationControls.refreshUtcOffset = refreshSelectedUtcOffset;
  window.TrueSkyLocationControls.setUtcMode = setUtcMode;

  document.addEventListener("DOMContentLoaded", () => {
    addStyles();
    loadCityDb();
    document.querySelectorAll("form input.location").forEach(attachLocationControl);
  });
})();
