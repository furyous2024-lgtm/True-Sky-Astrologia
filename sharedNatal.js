import { buildPrintWindowBridgeScript, buildSafeExportFileName, buttonCss, displayZodiacSystemLabel, escapeHtml, normalizeZodiacTextLabels, openInlinePrintFallback } from "./js/printExportShared.js?v=DELTA_SYNASTRY_FIX_20260617";
window.progressedPlanets = window.progressedPlanets || [];
window.transitPlanets = window.transitPlanets || [];
function getErrorMessage(error) {
  if (!error) return "Calculation failed.";
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  try { return JSON.stringify(error); } catch (e) { return "Calculation failed."; }
}

// Historical year helpers used by every chart form.
// User-facing convention: positive years are AD/CE; negative years are BC/BCE.
// There is no typed year 0: -1 = 1 BC, -44 = 44 BC. JavaScript Date uses
// astronomical year numbering internally, where 0 = 1 BC, -43 = 44 BC.
export function parseHistoricalYear(value) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : NaN;
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;
  const lower = raw.toLowerCase();
  const isBce = /(^|\s)(bc|bce|a\.?c\.?|ac|a\.c\.e?)(\s|$)/i.test(lower);
  const match = lower.match(/-?\d+/);
  if (!match) return NaN;
  let year = Math.abs(parseInt(match[0], 10));
  if (!Number.isFinite(year)) return NaN;
  if (raw.trim() === "0") return 0;
  if (year === 0) return NaN;
  if (isBce || raw.trim().startsWith("-")) year = -year;
  return year;
}

export function historicalYearToAstronomical(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return NaN;
  if (y === 0) return 0;
  return y < 0 ? y + 1 : y;
}

export function astronomicalYearToHistorical(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return NaN;
  if (y === 0) return 0;
  return y < 0 ? y - 1 : y;
}

export function makeHistoricalDate(year, monthIndexZeroBased, day, hour = 0, minute = 0, second = 0, millisecond = 0, utc = false) {
  const astronomicalYear = historicalYearToAstronomical(year);
  if (!Number.isFinite(astronomicalYear)) return new Date(NaN);
  const date = utc
    ? new Date(Date.UTC(0, monthIndexZeroBased, day, hour, minute, second, millisecond))
    : new Date(0, monthIndexZeroBased, day, hour, minute, second, millisecond);
  if (utc) {
    date.setUTCFullYear(astronomicalYear);
  } else {
    date.setFullYear(astronomicalYear);
  }
  return date;
}

function normalizeDegrees360(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((n % 360) + 360) % 360;
}

function getHouseSystemCode(name) {
  const key = String(name || "Placidus").toLowerCase();
  if (key.includes("koch")) return "K";
  if (key.includes("equal")) return "E";
  if (key.includes("whole")) return "W";
  if (key.includes("porphyry")) return "O";
  if (key.includes("regiomontanus")) return "R";
  if (key.includes("campanus")) return "C";
  return "P";
}


function isSafariMode() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function openSafariPrintView(chartId, chartTitle, modifyTitle) {
  const chart = document.getElementById(chartId);
  if (!chart) return;

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const printWindow = window.open("about:blank", "_blank", "width=1000,height=1000,scrollbars=yes,resizable=yes");
  const chartClone = chart.cloneNode(true);

  if (modifyTitle) {
    const titleText = chartClone.querySelector("svg .birth-details text");
    if (titleText) modifyTitle(titleText);
  }

  normalizeZodiacTextLabels(chartClone);

  const hiddenElements = chartClone.querySelectorAll(
    ".birth-details, .birth-details-left, .birth-details-right, .birth-details-center, .system-details"
  );
  hiddenElements.forEach((el) => {
    el.style.display = "block";
    el.style.visibility = "visible";
    el.style.opacity = "1";
    el.removeAttribute("display");
    el.querySelectorAll("text").forEach((text) => {
      text.style.display = "block";
      text.style.visibility = "visible";
      text.style.opacity = "1";
    });
  });

  const svgElement = chartClone.querySelector("svg");
  if (svgElement) {
    const currentViewBox = svgElement.getAttribute("viewBox");
    if (currentViewBox) {
      const parts = currentViewBox.split(" ");
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]) - 180;
      const width = parseFloat(parts[2]);
      const height = parseFloat(parts[3]) + 400;
      svgElement.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
    } else {
      svgElement.setAttribute("viewBox", "0 -250 1000 1400");
    }
    svgElement.setAttribute("width", "1000");
    svgElement.setAttribute("height", "1330");
  }

  const exportFileName = buildSafeExportFileName(chartTitle);
  const printHtml = `<!DOCTYPE html><html><head><title>${escapeHtml(chartTitle)}</title><link rel="stylesheet" href="css/styles.css"><style>
    .birth-details,.birth-details-left,.birth-details-right,.birth-details-center,.system-details{display:block!important;visibility:visible!important;opacity:1!important}
    .birth-details text,.birth-details-left text,.birth-details-right text,.birth-details-center text,.system-details text{display:block!important;visibility:visible!important;opacity:1!important}
    body{margin:0;padding:20px;background:white;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;box-sizing:border-box}
    #${chartId}{position:static!important;width:100%;max-width:900px;display:flex;justify-content:center;align-items:center;padding:20px;box-sizing:border-box}
    #${chartId} svg{width:100%;height:auto;max-width:900px;overflow:visible!important}
    ${buttonCss(isMobile, true)}
    @media print{body{padding:0!important;margin:0!important;display:block!important;min-height:0!important}#${chartId}{transform:scale(${isMobile ? "1" : "0.95"});transform-origin:top center;padding:0;page-break-inside:avoid;break-inside:avoid}#${chartId} svg{width:100%;height:auto;max-width:100%}body *{visibility:visible!important}@page{margin:12mm}}
  </style></head><body>
    <button class="close-window-button" type="button" data-action="close">Close View</button>
    <button class="print-trigger-button" type="button" data-action="print">Save PDF / Print</button>
    <button class="image-save-button" type="button" data-action="save-image">Save Image</button>
    <div class="export-status" data-export-status></div>
    ${chartClone.outerHTML}
    ${buildPrintWindowBridgeScript(chartId, exportFileName)}
  </body></html>`;

  if (!printWindow) {
    openInlinePrintFallback({
      title: chartTitle,
      contentHtml: chartClone.outerHTML,
      chartId,
      fileName: exportFileName,
      includeImageButton: true,
    });
    return;
  }

  printWindow.document.open();
  printWindow.document.write(printHtml);
  printWindow.document.close();
}

const FIXED_STARS_CATALOG = [
  { name: "Sirius", longitude: 104.08, eclipticLatitude: -39.61, magnitude: -1.46 },
  { name: "Canopus", longitude: 95.99, eclipticLatitude: -75.70, magnitude: -0.74 },
  { name: "Arcturus", longitude: 203.92, eclipticLatitude: 30.75, magnitude: -0.05 },
  { name: "Vega", longitude: 285.32, eclipticLatitude: 61.73, magnitude: 0.03 },
  { name: "Capella", longitude: 81.92, eclipticLatitude: 22.86, magnitude: 0.08 },
  { name: "Rigel", longitude: 78.63, eclipticLatitude: -31.11, magnitude: 0.13 },
  { name: "Procyon", longitude: 114.83, eclipticLatitude: -15.93, magnitude: 0.34 },
  { name: "Betelgeuse", longitude: 88.75, eclipticLatitude: -16.03, magnitude: 0.42 },
  { name: "Achernar", longitude: 29.41, eclipticLatitude: -58.79, magnitude: 0.46 },
  { name: "Hadar", longitude: 210.96, eclipticLatitude: -39.99, magnitude: 0.61 },
  { name: "Altair", longitude: 301.64, eclipticLatitude: 29.30, magnitude: 0.77 },
  { name: "Acrux", longitude: 187.79, eclipticLatitude: -52.47, magnitude: 0.76 },
  { name: "Aldebaran", longitude: 69.79, eclipticLatitude: -5.47, magnitude: 0.86 },
  { name: "Spica", longitude: 203.84, eclipticLatitude: -2.05, magnitude: 0.97 },
  { name: "Antares", longitude: 249.76, eclipticLatitude: -4.57, magnitude: 1.06 },
  { name: "Pollux", longitude: 113.22, eclipticLatitude: 6.69, magnitude: 1.14 },
  { name: "Fomalhaut", longitude: 334.07, eclipticLatitude: -21.14, magnitude: 1.16 },
  { name: "Deneb", longitude: 335.11, eclipticLatitude: 59.92, magnitude: 1.25 },
  { name: "Mimosa", longitude: 191.93, eclipticLatitude: -47.12, magnitude: 1.25 },
  { name: "Regulus", longitude: 149.83, eclipticLatitude: 0.46, magnitude: 1.35 },
  { name: "Adhara", longitude: 104.65, eclipticLatitude: -50.75, magnitude: 1.50 },
  { name: "Castor", longitude: 113.96, eclipticLatitude: 10.08, magnitude: 1.58 },
  { name: "Shaula", longitude: 263.84, eclipticLatitude: -13.78, magnitude: 1.62 },
  { name: "Bellatrix", longitude: 80.33, eclipticLatitude: -17.33, magnitude: 1.64 },
  { name: "Elnath", longitude: 82.74, eclipticLatitude: 5.39, magnitude: 1.65 },
  { name: "Miaplacidus", longitude: 140.36, eclipticLatitude: -76.59, magnitude: 1.67 },
  { name: "Alnilam", longitude: 84.05, eclipticLatitude: -25.29, magnitude: 1.69 },
  { name: "Alnitak", longitude: 83.00, eclipticLatitude: -25.08, magnitude: 1.74 },
  { name: "Dubhe", longitude: 135.80, eclipticLatitude: 49.28, magnitude: 1.79 },
  { name: "Mirfak", longitude: 57.06, eclipticLatitude: 34.69, magnitude: 1.79 },
  { name: "Wezen", longitude: 108.38, eclipticLatitude: -54.13, magnitude: 1.83 },
  { name: "Sargas", longitude: 264.37, eclipticLatitude: -19.34, magnitude: 1.86 },
  { name: "Kaus Australis", longitude: 276.99, eclipticLatitude: -6.36, magnitude: 1.85 },
  { name: "Avior", longitude: 125.75, eclipticLatitude: -74.23, magnitude: 1.86 },
  { name: "Alkaid", longitude: 178.04, eclipticLatitude: 55.38, magnitude: 1.86 },
  { name: "Menkalinan", longitude: 89.15, eclipticLatitude: 21.53, magnitude: 1.90 },
  { name: "Atria", longitude: 241.15, eclipticLatitude: -47.38, magnitude: 1.91 },
  { name: "Alhena", longitude: 108.77, eclipticLatitude: -7.35, magnitude: 1.93 },
  { name: "Peacock", longitude: 306.04, eclipticLatitude: -56.74, magnitude: 1.94 },
  { name: "Mirzam", longitude: 101.17, eclipticLatitude: -39.18, magnitude: 1.98 },
  { name: "Alphard", longitude: 142.17, eclipticLatitude: -16.23, magnitude: 1.99 },
  { name: "Polaris", longitude: 87.95, eclipticLatitude: 66.10, magnitude: 1.98 },
  { name: "Alphecca", longitude: 222.39, eclipticLatitude: 44.00, magnitude: 2.22 },
  { name: "Algol", longitude: 56.17, eclipticLatitude: 22.42, magnitude: 2.09 },
  { name: "Denebola", longitude: 171.88, eclipticLatitude: 12.21, magnitude: 2.14 },
  { name: "Zosma", longitude: 160.83, eclipticLatitude: 14.22, magnitude: 2.56 }
];



function normalizeObjectName(name) {
  return String(name || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function canonicalObjectName(name) {
  const normalized = normalizeObjectName(name).replace(/[-]/g, " ");
  const aliases = {
    ascendant: "ascendant symbol",
    asc: "ascendant symbol",
    "ascendant symbol": "ascendant symbol",
    descendant: "descendant",
    desc: "descendant",
    dc: "descendant",
    midheaven: "midheaven",
    mc: "midheaven",
    "imum coeli": "imum coeli",
    ic: "imum coeli",
    "north node": "north node",
    "true node": "north node",
    "true_node": "north node",
    "south node": "south node",
    lilith: "lilith",
    "black moon lilith": "lilith",
    "part of fortune": "part of fortune",
    fortuna: "part of fortune",
    "part of spirit": "part of spirit",
    vertex: "vertex",
    "anti vertex": "anti vertex",
    "anti-vertex": "anti vertex",
    antivertex: "anti vertex",
    "galactic center": "galactic center",
  };
  return aliases[normalized] || normalized;
}

const ANGLE_POINT_HOUSE_ANCHORS = {
  "ascendant symbol": 1,
  descendant: 7,
  "imum coeli": 4,
  midheaven: 10,
};

function anglePointHouseAnchorNumber(itemOrName) {
  const name = typeof itemOrName === "string" ? itemOrName : itemOrName?.name;
  return ANGLE_POINT_HOUSE_ANCHORS[canonicalObjectName(name)] || null;
}

function findHouseCuspByNumber(houseCusps, houseNumber) {
  const wanted = Number(houseNumber);
  if (!Number.isFinite(wanted)) return null;
  return (Array.isArray(houseCusps) ? houseCusps : []).find((cusp) => {
    const explicit = Number(cusp?.house);
    if (Number.isFinite(explicit) && explicit === wanted) return true;
    const fromName = Number(String(cusp?.name || "").match(/\d+/)?.[0]);
    return Number.isFinite(fromName) && fromName === wanted;
  }) || null;
}

function getRenderablePosition(item) {
  const anchored = Number(item?.houseAnchorPosition ?? item?.anchorPosition ?? item?.renderPosition);
  if (Number.isFinite(anchored)) return normalizeDegrees360(anchored);
  const ordinary = Number(item?.position);
  return Number.isFinite(ordinary) ? normalizeDegrees360(ordinary) : null;
}

function getRenderableSign(item, zodiacSystem) {
  if (item?.houseAnchorSign) return item.houseAnchorSign;
  const renderPosition = getRenderablePosition(item);
  if (Number.isFinite(renderPosition)) return getSignFromPosition(renderPosition, zodiacSystem);
  return item?.sign || "";
}

function applyAngleHouseAnchorsToItems(items, houseCusps, zodiacSystem) {
  if (!Array.isArray(items) || !Array.isArray(houseCusps) || houseCusps.length === 0) return items;

  items.forEach((item) => {
    const houseNumber = anglePointHouseAnchorNumber(item);
    if (!houseNumber) return;

    const cusp = findHouseCuspByNumber(houseCusps, houseNumber);
    const cuspPosition = Number(cusp?.position);
    if (!Number.isFinite(cuspPosition)) return;

    const anchorPosition = normalizeDegrees360(cuspPosition);
    item.houseAnchorPosition = anchorPosition;
    item.anchorPosition = anchorPosition;
    item.renderPosition = anchorPosition;
    item.houseAnchorHouse = houseNumber;
    item.renderHouse = houseNumber;
    item.houseAnchorSign = cusp?.sign || getSignFromPosition(anchorPosition, zodiacSystem);
  });

  return items;
}

function dedupePlanetsForAspects(planets) {
  const byName = new Map();
  (Array.isArray(planets) ? planets : []).forEach((planet) => {
    if (!planet?.name || !Number.isFinite(planet.position)) return;
    const key = canonicalObjectName(planet.name);
    if (!byName.has(key)) byName.set(key, planet);
  });
  return [...byName.values()];
}

function selectionIncludes(selection, objectName) {
  // Fail-open for the wheel: if saved settings are empty or the settings DOM did not load,
  // keep all built-in Swiss objects visible instead of rendering a blank chart.
  if (!Array.isArray(selection) || selection.length === 0) return true;
  const wanted = new Set(selection.map(canonicalObjectName));
  return wanted.has(canonicalObjectName(objectName));
}

const TRUE_SKY_GREGORIAN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function parseMonthValue(monthValue) {
  const raw = String(monthValue ?? "").trim();
  const numeric = Number.parseInt(raw, 10);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  const englishIndex = TRUE_SKY_GREGORIAN_MONTHS.findIndex((m) => m.toLowerCase() === raw.toLowerCase());
  if (englishIndex >= 0) return englishIndex + 1;
  const portuguese = {
    janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  };
  return portuguese[raw.toLowerCase()] || 1;
}

function isLunar13CalendarMode(value) {
  const key = String(value || "").trim().toLowerCase().replace(/[\s_\-]+/g, "");
  return key === "lunar13x28" || key === "lunar13" || key === "13x28" || key.includes("13x28");
}

function normalizeLunar13MonthValue(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = raw.match(/(\d{1,2})/);
  const month = match ? Number.parseInt(match[1], 10) : Number.parseInt(raw, 10);
  return Number.isFinite(month) ? Math.min(13, Math.max(1, month)) : 1;
}

function lunar13DateToGregorianParts(yearValue, lunarMonthValue, lunarDayValue) {
  const year = parseHistoricalYear(yearValue);
  const lunarMonth = normalizeLunar13MonthValue(lunarMonthValue);
  const lunarDay = Math.min(28, Math.max(1, Number.parseInt(lunarDayValue, 10) || 1));
  const dayOfYearZeroBased = (lunarMonth - 1) * 28 + (lunarDay - 1);
  const date = makeHistoricalDate(year, 0, 1 + dayOfYearZeroBased, 0, 0, 0, 0, true);
  return {
    year: astronomicalYearToHistorical(date.getUTCFullYear()),
    month: date.getUTCMonth() + 1,
    monthName: TRUE_SKY_GREGORIAN_MONTHS[date.getUTCMonth()],
    day: date.getUTCDate(),
  };
}

function normalizeCalendarDateFields(formDataObj, dayKey = "day", monthKey = "month", yearKey = "year", calendarKey = "calendarSystem") {
  const source = formDataObj || {};
  if (!isLunar13CalendarMode(source[calendarKey] ?? source.calendarSystem)) {
    return {
      year: parseHistoricalYear(source[yearKey] ?? source.year ?? new Date().getUTCFullYear()),
      month: parseMonthValue(source[monthKey] ?? source.month ?? 1),
      day: Number(source[dayKey] ?? source.day ?? 1),
    };
  }
  const converted = lunar13DateToGregorianParts(
    source[yearKey] ?? source.year ?? new Date().getUTCFullYear(),
    source[monthKey] ?? source.month ?? 1,
    source[dayKey] ?? source.day ?? 1
  );
  source[dayKey] = String(converted.day);
  source[monthKey] = converted.monthName;
  source[yearKey] = String(converted.year);
  source[calendarKey] = "gregorian";
  return { year: converted.year, month: converted.month, day: converted.day };
}

const TRUE_SKY_TZ_STANDARD_OFFSET_CACHE = new Map();

function isNormalUtcOffsetHours(offset) {
  const n = Number(offset);
  if (!Number.isFinite(n) || n < -12 || n > 14) return false;
  const rawMinutes = n * 60;
  const totalMinutes = Math.round(rawMinutes);
  if (Math.abs(rawMinutes - totalMinutes) > 1e-6) return false;
  const minutePart = Math.abs(totalMinutes) % 60;
  return minutePart === 0 || minutePart === 15 || minutePart === 30 || minutePart === 45;
}

function rawUtcOffsetNumber(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?/i);
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number.parseInt(match[2] || "0", 10);
    const minutes = Number.parseInt(match[3] || "0", 10);
    const seconds = Number.parseInt(match[4] || "0", 10);
    return sign * (hours + minutes / 60 + seconds / 3600);
  }
  const numeric = Number.parseFloat(raw.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : NaN;
}

function normalizeUtcOffsetHours(offset, fallback = 0) {
  const n = rawUtcOffsetNumber(offset);
  if (isNormalUtcOffsetHours(n)) return Math.round(n * 60) / 60;

  const fb = rawUtcOffsetNumber(fallback);
  if (isNormalUtcOffsetHours(fb)) return Math.round(fb * 60) / 60;

  if (Number.isFinite(n)) {
    const roundedMinutes = Math.max(-12 * 60, Math.min(14 * 60, Math.round(n * 4) * 15));
    return roundedMinutes / 60;
  }
  return 0;
}

function rawIanaOffsetFromIntl(timezoneValue, date) {
  const tz = String(timezoneValue || "").trim();
  if (!tz || typeof Intl === "undefined" || !(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
  for (const timeZoneName of ["longOffset", "shortOffset", "short"]) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(date);
      const name = parts.find((part) => part.type === "timeZoneName")?.value || "";
      const parsed = rawUtcOffsetNumber(name);
      if (Number.isFinite(parsed)) return parsed;
    } catch (_) {
      break;
    }
  }
  return null;
}

function standardTimezoneOffsetHours(timezoneValue, fallback = 0) {
  const key = String(timezoneValue || "").trim();
  const lowerKey = key.toLowerCase();
  if (!key) return normalizeUtcOffsetHours(fallback, fallback);
  if (lowerKey === "utc" || lowerKey === "etc/utc" || lowerKey === "gmt" || lowerKey === "etc/gmt") return 0;
  if (TRUE_SKY_TZ_STANDARD_OFFSET_CACHE.has(key)) return normalizeUtcOffsetHours(TRUE_SKY_TZ_STANDARD_OFFSET_CACHE.get(key), fallback);
  if (TRUE_SKY_TZ_STANDARD_OFFSET_CACHE.has(lowerKey)) return normalizeUtcOffsetHours(TRUE_SKY_TZ_STANDARD_OFFSET_CACHE.get(lowerKey), fallback);

  const sampleDates = [
    new Date(Date.UTC(2024, 0, 15, 12, 0, 0)),
    new Date(Date.UTC(2024, 3, 15, 12, 0, 0)),
    new Date(Date.UTC(2024, 6, 15, 12, 0, 0)),
    new Date(Date.UTC(2024, 9, 15, 12, 0, 0)),
  ];
  const normalOffsets = sampleDates
    .map((date) => rawIanaOffsetFromIntl(key, date))
    .filter((offset) => isNormalUtcOffsetHours(offset))
    .map((offset) => Math.round(offset * 60) / 60);
  if (normalOffsets.length) {
    const standard = Math.min(...normalOffsets);
    TRUE_SKY_TZ_STANDARD_OFFSET_CACHE.set(key, standard);
    TRUE_SKY_TZ_STANDARD_OFFSET_CACHE.set(lowerKey, standard);
    return standard;
  }

  return normalizeUtcOffsetHours(fallback, fallback);
}

function parseUtcOffsetHours(value, timezoneValue) {
  const raw = String(value ?? timezoneValue ?? "").trim();
  const tzRaw = String(timezoneValue ?? value ?? "").trim();

  const parsedFromRaw = rawUtcOffsetNumber(raw);
  if (Number.isFinite(parsedFromRaw)) return normalizeUtcOffsetHours(parsedFromRaw, standardTimezoneOffsetHours(tzRaw, parsedFromRaw));

  const parsedFromTimezone = rawUtcOffsetNumber(tzRaw);
  if (Number.isFinite(parsedFromTimezone)) return normalizeUtcOffsetHours(parsedFromTimezone, standardTimezoneOffsetHours(tzRaw, parsedFromTimezone));

  const standard = standardTimezoneOffsetHours(tzRaw || raw, NaN);
  if (Number.isFinite(standard)) return standard;

  // Browser/loaded charts sometimes save only an IANA timezone name.
  // Use stable manual fallbacks for zones used by the app instead of returning 0,
  // because UTC 0 shifts houses/ASC and can make angle code look broken.
  const knownZones = {
    "america/sao_paulo": -3,
    "america/curitiba": -3,
    "brazil/east": -3,
    "utc": 0,
    "etc/utc": 0,
  };
  const known = knownZones[tzRaw.toLowerCase()] ?? knownZones[raw.toLowerCase()];
  if (Number.isFinite(known)) return normalizeUtcOffsetHours(known, 0);

  return 0;
}

function formatUtcOffsetForDisplay(value, timezoneValue) {
  const parsed = normalizeUtcOffsetHours(parseUtcOffsetHours(value, timezoneValue), standardTimezoneOffsetHours(timezoneValue, 0));
  const totalMinutes = Math.round((Number.isFinite(parsed) ? parsed : 0) * 60);
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absMinutes = Math.abs(totalMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, "0");
  const minutes = String(absMinutes % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}




function normalizeUtcModeValue(value, fallback = "auto") {
  const raw = String(value ?? fallback ?? "auto").trim().toLowerCase();
  return raw === "manual" || raw === "fixed" || raw === "user" ? "manual" : "auto";
}

function resolveUtcMode(formDataObj = {}) {
  return normalizeUtcModeValue(
    formDataObj.utcMode ?? formDataObj.timezoneMode ?? formDataObj.utc_mode ?? formDataObj.timezone_mode ?? "auto"
  );
}

function getBrazilHistoricalUtcOffsetHours(year, month, day, locationText) {
  // No position/timezone hard-code here. The chart must use the explicit UTC
  // offset/timezone selected by the user, then Swiss Ephemeris calculates the
  // real astronomical positions and houses from that UT.
  return null;
}

function getIanaTimezoneOffsetHours(timeZone, utcGuessDate) {
  const tz = String(timeZone || "").trim();
  if (!tz || !tz.includes("/")) return null;

  // IANA/Intl timezone data is not reliable for BCE years and many JS
  // engines format BCE dates with a positive year plus an era marker. If we
  // ignore the era, 44 BCE can be read back as 44 CE and the UTC conversion
  // becomes wildly wrong. For BCE charts, keep the explicit UTC offset that
  // came from the form/location fallback instead of trying an IANA lookup.
  if (!(utcGuessDate instanceof Date) || !Number.isFinite(utcGuessDate.getTime())) return null;
  if (utcGuessDate.getUTCFullYear() <= 0) return null;
  try {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    const parts = Object.fromEntries(dtf.formatToParts(utcGuessDate).map((part) => [part.type, part.value]));
    const formattedYear = Number(parts.year);
    if (!Number.isFinite(formattedYear) || formattedYear <= 0) return null;

    // Date.UTC treats years 0..99 as 1900..1999, so build the comparison date
    // through makeHistoricalDate/setUTCFullYear to preserve literal historical
    // years. This keeps early CE dates from jumping by ~1900 years.
    const asUtcDate = makeHistoricalDate(
      formattedYear,
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second || 0),
      0,
      true
    );
    const rawOffset = (asUtcDate.getTime() - utcGuessDate.getTime()) / 3600000;
    return normalizeUtcOffsetHours(rawOffset, standardTimezoneOffsetHours(tz, rawOffset));
  } catch (err) {
    return null;
  }
}

function makeUtcDateFromBirthFields(year, month, day, hour, minute, utcOffset, timezone, location, preferExplicitUtcOffset = false) {
  let effectiveOffset = normalizeUtcOffsetHours(utcOffset, standardTimezoneOffsetHours(timezone, 0));
  const historicalBrazilOffset = getBrazilHistoricalUtcOffsetHours(year, month, day, location);
  if (!preferExplicitUtcOffset && Number.isFinite(historicalBrazilOffset)) effectiveOffset = historicalBrazilOffset;

  // Date.UTC keeps the typed birth components independent from the browser's
  // own timezone. The selected UTC offset must shift local birth time into UT.
  let utcDate = new Date(makeHistoricalDate(year, month - 1, day, hour, minute, 0, 0, true).getTime() - effectiveOffset * 3600000);

  // Important: when the form has an explicit UTC/utcOffset value, do NOT let an
  // IANA timezone overwrite it. Otherwise changing the UTC field appears in the
  // UI but the chart remains calculated with the old timezone offset.
  const ianaOffset = preferExplicitUtcOffset ? null : getIanaTimezoneOffsetHours(timezone, utcDate);
  if (Number.isFinite(ianaOffset)) {
    effectiveOffset = normalizeUtcOffsetHours(ianaOffset, effectiveOffset);
    utcDate = new Date(makeHistoricalDate(year, month - 1, day, hour, minute, 0, 0, true).getTime() - effectiveOffset * 3600000);
  }

  return { utcDate, utcOffset: effectiveOffset };
}


const AYANAMSA_VALUES = {
  Tropical: 0,
  IAU: 28.6888982207,
  IAU2: 29.12,
  IAUZeroAries: 31.8153223264,
  MidpointJ2000: 31.2836,
  Lahiri: 24.19,
  FaganBradley: 24.97,
  Raman: 22.67,
  Krishnamurti: 24.1,
  Yukteswar: 22.46,
  DjwhalKhul: 28.0,
  Aldebaran15Taurus: 25.122152,
  Aryabhata: 21.258289,
  Aryabhata522: 20.939077,
  AryabhataMundaneSun: 21.020657,
  B1950: 1.061601,
  BabylonianBritton: 24.978981,
  BabylonianETPSC: 24.885756,
  BabylonianHuber: 25.096868,
  BabylonianKugler1: 23.896868,
  BabylonianKugler2: 25.296868,
  BabylonianKugler3: 26.146868,
  DeLuce: 28.178981,
  GalacticAlignmentMardyks: 30.381025,
  GalacticCenter0Sag: 27.209282,
  GalacticCenter0Capricorn: 357.209282,
  DhruvaGalacticCenterMula: 20.418535,
  GalacticCenterGilBrand: 22.832341,
  GalacticEquatorFiorenza: 25.36325,
  GalacticEquatorIAU1958: 30.38834,
  GalacticEquatorMula: 23.774592,
  GalacticEquatorTrue: 30.441259,
  Hipparchos: 20.611016,
  J1900: 1.759812,
  J2000: 0.363231,
  JN_Bhasin: 23.125368,
  KrishnamurtiVP291: 24.143594,
  Lahiri1940: 24.205554,
  LahiriICRC: 24.22002,
  LahiriVP285: 24.22671,
  Sassanian: 20.356189,
  SS_Citra: 23.368993,
  SS_Revati: 20.466618,
  SuryaSiddhanta: 21.258288,
  SuryaSiddhantaMeanSun: 21.043654,
  TrueCitra: 24.202974,
  TrueMula: 24.943162,
  TruePushya: 23.09065,
  TrueRevati: 20.409188,
  TrueSheoran: 25.598008,
  UshaShashi: 20.420772,
  ValensMoon: 23.158838,
  LarryEly: 28.003611,
  Takra: 24.533333,
  TakraI: 24.533333,
  TakraII: 24.533333,
  Kanatas: 3.95,
  Chimenti: 32.087066,
};


function ayanamsaValueForKey(key) {
  const directMap = {
    tropical: "Tropical",
    iau: "IAU",
    iau2: "IAU2",
    iauzeroaries: "IAUZeroAries",
    midpointj2000: "MidpointJ2000",
    lahiri: "Lahiri",
    faganbradley: "FaganBradley",
    raman: "Raman",
    krishnamurti: "Krishnamurti",
    yukteswar: "Yukteswar",
    djwhalkhul: "DjwhalKhul",
    aldebaran15taurus: "Aldebaran15Taurus",
    aryabhata: "Aryabhata",
    aryabhata522: "Aryabhata522",
    aryabhatamundanesun: "AryabhataMundaneSun",
    b1950: "B1950",
    babylonianbritton: "BabylonianBritton",
    babylonianetpsc: "BabylonianETPSC",
    babylonianhuber: "BabylonianHuber",
    babyloniankugler1: "BabylonianKugler1",
    babyloniankugler2: "BabylonianKugler2",
    babyloniankugler3: "BabylonianKugler3",
    deluce: "DeLuce",
    galacticalignmentmardyks: "GalacticAlignmentMardyks",
    galacticcenter0sag: "GalacticCenter0Sag",
    galacticcenter0capricorn: "GalacticCenter0Capricorn",
    dhruvagalacticcentermula: "DhruvaGalacticCenterMula",
    galacticcentergilbrand: "GalacticCenterGilBrand",
    galacticequatorfiorenza: "GalacticEquatorFiorenza",
    galacticequatoriau1958: "GalacticEquatorIAU1958",
    galacticequatormula: "GalacticEquatorMula",
    galacticequatortrue: "GalacticEquatorTrue",
    hipparchos: "Hipparchos",
    j1900: "J1900",
    j2000: "J2000",
    jn_bhasin: "JN_Bhasin",
    krishnamurtivp291: "KrishnamurtiVP291",
    lahiri1940: "Lahiri1940",
    lahiriicrc: "LahiriICRC",
    lahirivp285: "LahiriVP285",
    sassanian: "Sassanian",
    ss_citra: "SS_Citra",
    ss_revati: "SS_Revati",
    suryasiddhanta: "SuryaSiddhanta",
    suryasiddhantameansun: "SuryaSiddhantaMeanSun",
    truecitra: "TrueCitra",
    truemula: "TrueMula",
    truepushya: "TruePushya",
    truerevati: "TrueRevati",
    truesheoran: "TrueSheoran",
    ushashashi: "UshaShashi",
    valensmoon: "ValensMoon",
    larryely: "LarryEly",
    takra: "Takra",
    takrai: "TakraI",
    takraii: "TakraII",
    kanatas: "Kanatas",
    chimenti: "Chimenti",
    aldebaran15taurus: "Aldebaran15Taurus",
    aldebaran: "Aldebaran15Taurus",
    aldebaran15tau: "Aldebaran15Taurus",
    aryabhata: "Aryabhata",
    aryabhata522: "Aryabhata522",
    aryabhatamundanesun: "AryabhataMundaneSun",
    aryabhatameansun: "AryabhataMundaneSun",
    aryabhatamsun: "AryabhataMundaneSun",
    b1950: "B1950",
    babylonianbritton: "BabylonianBritton",
    britton: "BabylonianBritton",
    babylonianetpsc: "BabylonianETPSC",
    etapiscium: "BabylonianETPSC",
    babylonianetapiscium: "BabylonianETPSC",
    babylonianhuber: "BabylonianHuber",
    huber: "BabylonianHuber",
    babyloniankugler1: "BabylonianKugler1",
    kugler1: "BabylonianKugler1",
    babyloniankugler2: "BabylonianKugler2",
    kugler2: "BabylonianKugler2",
    babyloniankugler3: "BabylonianKugler3",
    kugler3: "BabylonianKugler3",
    deluce: "DeLuce",
    deluce: "DeLuce",
    galacticalignmentmardyks: "GalacticAlignmentMardyks",
    mardyks: "GalacticAlignmentMardyks",
    galacticcenter0sag: "GalacticCenter0Sag",
    galacticcenter: "GalacticCenter0Sag",
    gc0sag: "GalacticCenter0Sag",
    galacticcenter0capricorn: "GalacticCenter0Capricorn",
    cochrane: "GalacticCenter0Capricorn",
    gc0capricorn: "GalacticCenter0Capricorn",
    dhruvagalacticcentermula: "DhruvaGalacticCenterMula",
    wilhelm: "DhruvaGalacticCenterMula",
    galacticcentermula: "DhruvaGalacticCenterMula",
    galacticcentergilbrand: "GalacticCenterGilBrand",
    gilbrand: "GalacticCenterGilBrand",
    galacticequatorfiorenza: "GalacticEquatorFiorenza",
    fiorenza: "GalacticEquatorFiorenza",
    galacticequatoriau1958: "GalacticEquatorIAU1958",
    iau1958: "GalacticEquatorIAU1958",
    galacticequatormula: "GalacticEquatorMula",
    galacticequator5sagittarius: "GalacticEquatorMula",
    galacticequator5sag: "GalacticEquatorMula",
    mula: "GalacticEquatorMula",
    galacticequatortrue: "GalacticEquatorTrue",
    truegalacticequator: "GalacticEquatorTrue",
    hipparchos: "Hipparchos",
    hipparchus: "Hipparchos",
    j1900: "J1900",
    j2000: "J2000",
    jnbhasin: "JN_Bhasin",
    bhasin: "JN_Bhasin",
    krishnamurtivp291: "KrishnamurtiVP291",
    kpvp291: "KrishnamurtiVP291",
    lahiri1940: "Lahiri1940",
    lahiriicrc: "LahiriICRC",
    lahirivp285: "LahiriVP285",
    sassanian: "Sassanian",
    sscitra: "SS_Citra",
    suryasiddhantacitra: "SS_Citra",
    ssrevati: "SS_Revati",
    suryasiddhantarevati: "SS_Revati",
    suryasiddhanta: "SuryaSiddhanta",
    suryasiddhantameansun: "SuryaSiddhantaMeanSun",
    suryasiddhantamsun: "SuryaSiddhantaMeanSun",
    truecitra: "TrueCitra",
    truemula: "TrueMula",
    truepushya: "TruePushya",
    truerevati: "TrueRevati",
    truesheoran: "TrueSheoran",
    sheoran: "TrueSheoran",
    ushashashi: "UshaShashi",
    ushaandshashi: "UshaShashi",
    ushashashi: "UshaShashi",
    valensmoon: "ValensMoon",
    larryely: "LarryEly",
    takra: "Takra",
    takrai: "TakraI",
    takra1: "TakraI",
    takraii: "TakraII",
    takra2: "TakraII",
    kanatas: "Kanatas",
    chimenti: "Chimenti",
    midpointj2000ayanamsa: "MidpointJ2000",
    mtzmidpointayanamsa: "MidpointJ2000",
    midpointayanamsa: "MidpointJ2000",
  };
  const valueKey = directMap[key];
  return valueKey ? AYANAMSA_VALUES[valueKey] : null;
}

function normalizeAyanamsaName(value) {
  return String(value || "Tropical")
    .trim()
    .toLowerCase()
    .replace(/[\s_()\-.°]/g, "");
}


function isMidpointZodiacSystem(zodiacSystem) {
  const value = String(zodiacSystem || "").trim().toLowerCase();
  return value === "midpoint" || value.includes("midpoint") || value.includes("true sidereal");
}

function normalizeZodiacSystemKey(zodiacSystem) {
  return String(zodiacSystem || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_()\-.°]/g, "");
}

function isTropicalEqualThirteenSignZodiacSystem(zodiacSystem) {
  const key = normalizeZodiacSystemKey(zodiacSystem);
  return (
    key === "tropical13" ||
    key === "tropical13equal" ||
    key === "equal13" ||
    key === "13signequal" ||
    key === "13signsequal" ||
    key === "equal13tropical" ||
    key === "13signtropical" ||
    key === "13signsequaltropical" ||
    key === "tropical13signs" ||
    key === "tropical13signsequal"
  );
}

function isSiderealEqualThirteenSignZodiacSystem(zodiacSystem) {
  const key = normalizeZodiacSystemKey(zodiacSystem);
  return (
    key === "sidereal13" ||
    key === "sidereal13equal" ||
    key === "equal13sidereal" ||
    key === "13signsidereal" ||
    key === "13signssidereal" ||
    key === "13signsequalsidereal" ||
    key === "sidereal13signs" ||
    key === "sidereal13signsequal"
  );
}

function isEqualThirteenSignZodiacSystem(zodiacSystem) {
  return isTropicalEqualThirteenSignZodiacSystem(zodiacSystem) || isSiderealEqualThirteenSignZodiacSystem(zodiacSystem);
}

function isIauRealThirteenSignZodiacSystem(zodiacSystem) {
  const key = normalizeZodiacSystemKey(zodiacSystem);
  return (
    key === "iau13" ||
    key === "iaureal13" ||
    key === "iau13real" ||
    key === "iaureal13signs" ||
    key === "iau13signsreal" ||
    key.includes("iaureal") ||
    (key.includes("iau") && key.includes("13"))
  );
}

function isThirteenSignZodiacSystem(zodiacSystem) {
  return isEqualThirteenSignZodiacSystem(zodiacSystem) || isIauRealThirteenSignZodiacSystem(zodiacSystem);
}

function isUnequalZodiacSystem(zodiacSystem) {
  // Historical name kept for compatibility: it means "use custom sign boundaries"
  // instead of the classic 12 x 30° wheel. 13-sign equal is custom but equal-sized.
  return isMidpointZodiacSystem(zodiacSystem) || isThirteenSignZodiacSystem(zodiacSystem);
}

function formatZodiacSystemLabel(zodiacSystem) {
  const key = normalizeZodiacSystemKey(zodiacSystem);
  if (!key || key === "tropical") return "Tropical/Sideral";
  if (isEqualThirteenSignZodiacSystem(zodiacSystem)) return "Tropical / Sidereal 13 Signs Equal / Ofiuco";
  if (isIauRealThirteenSignZodiacSystem(zodiacSystem)) return "IAU Real 13 Signs";
  if (isMidpointZodiacSystem(zodiacSystem)) return "Midpoint (True Sidereal)";
  return String(zodiacSystem || "Tropical/Sideral");
}

const THIRTEEN_EQUAL_SIGN_SIZE = 360 / 13;
const THIRTEEN_SIGN_ORDER = Object.freeze([
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra",
  "Scorpio", "Ophiuchus", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]);

// Tropical/Sidereal 13-sign equal wheel: Aries starts at the selected
// ayanamsa zero point. With Ayanamsa = Tropical it behaves as tropical 0°;
// with Lahiri/Fagan/etc. it behaves as sidereal. Every sign, including
// Ophiuchus, has exactly 360/13 = 27.69230769230769°.
const TROPICAL13_EQUAL_BOUNDARIES = Object.freeze(
  THIRTEEN_SIGN_ORDER.map((sign, index) => ({
    sign,
    boundary: index * THIRTEEN_EQUAL_SIGN_SIZE,
  }))
);

// True ecliptic crossings of the official IAU constellation boundaries.
// These are not equal 30° signs and are not the old Midpoint/MTZ table.
// They are expressed after subtracting the IAU Pisces/Aries boundary
// ayanamsa (28.6888982207° at J2000), so Aries starts at 0°.
const IAU13_BOUNDARIES = Object.freeze([
  { sign: "Aries", boundary: 0 },
  { sign: "Taurus", boundary: 24.7303438758 },
  { sign: "Gemini", boundary: 61.4527810238 },
  { sign: "Cancer", boundary: 89.3003003539 },
  { sign: "Leo", boundary: 109.3506140311 },
  { sign: "Virgo", boundary: 145.1633258927 },
  { sign: "Libra", boundary: 189.1232495648 },
  { sign: "Scorpio", boundary: 212.3513797405 },
  { sign: "Ophiuchus", boundary: 218.9508108251 },
  { sign: "Sagittarius", boundary: 237.5504397001 },
  { sign: "Capricorn", boundary: 270.9683978212 },
  { sign: "Aquarius", boundary: 298.7998253932 },
  { sign: "Pisces", boundary: 322.9637169472 },
]);

const MIDPOINT_BOUNDARIES = Object.freeze([
  { sign: "Aries", boundary: 0 },
  { sign: "Taurus", boundary: 19.7286 },
  { sign: "Gemini", boundary: 56.5875 },
  { sign: "Cancer", boundary: 86.0412 },
  { sign: "Leo", boundary: 103.19 },
  { sign: "Virgo", boundary: 141.6065 },
  { sign: "Libra", boundary: 191.32 },
  { sign: "Scorpio", boundary: 210.1972 },
  { sign: "Ophiuchus", boundary: 223.4245 },
  { sign: "Sagittarius", boundary: 235.7818 },
  { sign: "Capricorn", boundary: 269.2677 },
  { sign: "Aquarius", boundary: 294.8435 },
  { sign: "Pisces", boundary: 318.0103 },
]);

function getUnequalZodiacBoundaries(zodiacSystem) {
  if (isEqualThirteenSignZodiacSystem(zodiacSystem)) return TROPICAL13_EQUAL_BOUNDARIES;
  if (isIauRealThirteenSignZodiacSystem(zodiacSystem)) return IAU13_BOUNDARIES;
  return MIDPOINT_BOUNDARIES;
}

function jdFromAstronomyTime(time) {
  if (time && Number.isFinite(time.ut)) return Number(time.ut) + 2451545.0;
  if (time && Number.isFinite(time.tt)) return Number(time.tt) + 2451545.0;
  if (time && time.date instanceof Date) return julianDayFromUtcDate(time.date);
  if (time instanceof Date) return julianDayFromUtcDate(time);
  return julianDayFromUtcDate(new Date());
}

function getSignedPrecessionFromJ2000(time) {
  const jd = jdFromAstronomyTime(time);
  if (!Number.isFinite(jd)) return 0;
  const T = (jd - 2451545.0) / 36525;
  // IAU 1976 general precession in longitude, signed from J2000.
  // Negative before J2000, positive after J2000. This is what old BCE
  // sidereal charts need: a modern ayanamsa around 28° must roll back
  // close to 0° around 7 BCE instead of staying fixed at 28°.
  return (5029.0966 * T + 1.11113 * T * T - 0.000006 * T * T * T) / 3600;
}

function adjustModernAyanamsaToDate(modernAyanamsa, time, epochYear = 2026) {
  const base = Number(modernAyanamsa);
  if (!Number.isFinite(base)) return 0;
  const currentYear = Number(epochYear) || 2026;
  const epochDate = makeHistoricalDate(currentYear, 0, 1, 12, 0, 0, 0, true);
  let epochPrecession = 0;
  try {
    epochPrecession = getSignedPrecessionFromJ2000(window.Astronomy.MakeTime(epochDate));
  } catch (e) {
    epochPrecession = (5029.0966 * ((julianDayFromUtcDate(epochDate) - 2451545.0) / 36525)) / 3600;
  }
  return normalizeDegrees360(base + getSignedPrecessionFromJ2000(time) - epochPrecession);
}

function getMidpointAyanamsa(time) {
  const precession = typeof calculateAyanamsa === "function" ? calculateAyanamsa(time) : 0;
  return ((AYANAMSA_VALUES.MidpointJ2000 + precession) % 360 + 360) % 360;
}

function getEffectiveAyanamsa(time, zodiacSystem, ayanamsaSystem = "Tropical", customAyanamsa = 0) {
  const key = normalizeAyanamsaName(ayanamsaSystem);

  // Midpoint (True Sidereal), como no Mastering the Zodiac.
  if (isMidpointZodiacSystem(zodiacSystem)) {
    return getMidpointAyanamsa(time);
  }

  // Tropical/Sidereal 13-sign equal mode uses the same 13 equal sectors;
  // its zero point is controlled by the selected ayanamsa below.
  // Ayanamsa = Tropical keeps it tropical; Lahiri/Fagan/etc. makes it sidereal.

  // IAU real 13-sign mode represents the real-sky constellation wheel.
  // Force the IAU ayanamsa even when an old saved profile still says Tropical,
  // otherwise the wheel keeps drawing 13 unequal sectors but the planet degrees
  // remain tropical.
  if (isIauRealThirteenSignZodiacSystem(zodiacSystem)) {
    return adjustModernAyanamsaToDate(AYANAMSA_VALUES.IAU, time);
  }

  if (key === "tropical" || key === "0" || key === "none" || key === "semayanamsa") {
    return AYANAMSA_VALUES.Tropical;
  }

  // Ayanamsa is not a fixed number for every epoch. The values in the menu are
  // modern anchors; for BCE/ancient dates they must be rolled backward by
  // precession. This fixes old charts where 7 BCE stayed ~28° off and placed
  // the Sun around 28° Cancer instead of the expected late Leo reference.
  if (key === "custom") {
    const value = Number(customAyanamsa);
    return Number.isFinite(value) ? adjustModernAyanamsaToDate(value, time) : 0;
  }
  const ayanamsaValue = ayanamsaValueForKey(key);
  if (ayanamsaValue !== null) return adjustModernAyanamsaToDate(ayanamsaValue, time);

  return 0;
}

function isDraconicEnabled(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const key = String(value).trim().toLowerCase();
  return key === "true" || key === "1" || key === "yes" || key === "on" || key === "draconic" || key === "draconico" || key === "dracônico";
}

function applyDraconicZodiacToChartData(data, houseCusps, zodiacSystem, wrap360, getSignFromPositionFn) {
  const northNode = data.find((entry) => entry?.name === "North Node" && Number.isFinite(Number(entry.position)));
  const northNodeOffset = Number(northNode?.position);
  if (!Number.isFinite(northNodeOffset)) return null;

  const shiftItem = (item) => {
    if (!item || !Number.isFinite(Number(item.position))) return;
    const basePosition = wrap360(Number(item.position));
    item.baseZodiacPosition = basePosition;
    item.draconicOffset = northNodeOffset;
    item.position = wrap360(basePosition - northNodeOffset);
    item.draconicPosition = item.position;
    if (Number.isFinite(Number(item.swissPosition))) item.swissPosition = item.position;
    if (typeof getSignFromPositionFn === "function") item.sign = getSignFromPositionFn(item.position, zodiacSystem);
  };

  data.forEach((item) => {
    if (!item || item === data[0]) return;
    shiftItem(item);
  });

  if (Array.isArray(houseCusps)) {
    houseCusps.forEach((cusp) => {
      shiftItem(cusp);
      if (cusp && typeof getSignFromPositionFn === "function" && Number.isFinite(Number(cusp.position))) {
        cusp.sign = getSignFromPositionFn(cusp.position, zodiacSystem);
      }
    });
  }

  return northNodeOffset;
}

function julianDayFromUtcDate(date) {
  let year = date.getUTCFullYear();
  let month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000;
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5 + hour / 24;
}

function calculateLocalSiderealDegrees(utcDate, longitude) {
  // Try using Astronomy Engine first for more accurate sidereal time
  if (typeof window !== 'undefined' && window.Astronomy && typeof window.Astronomy.MakeTime === 'function' && typeof window.Astronomy.SiderealTime === 'function') {
    try {
      const time = window.Astronomy.MakeTime(utcDate);
      const gast = window.Astronomy.SiderealTime(time); // Greenwich Apparent Sidereal Time in hours
      const lastDeg = ((gast * 15 + longitude) % 360 + 360) % 360; // Convert to degrees and add longitude
      return lastDeg;
    } catch (e) {
      // Fallback to manual calculation
    }
  }

  // Fallback: Manual calculation
  const jd = julianDayFromUtcDate(utcDate);
  const T = (jd - 2451545.0) / 36525;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000;
  return ((gmst + longitude) % 360 + 360) % 360;
}

function calculateTropicalAngles(utcDate, latitude, longitude) {
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  // Calculate LST using Astronomy Engine when available
  const lstDeg = calculateLocalSiderealDegrees(utcDate, longitude);

  // Get obliquity from Astronomy Engine if available
  let obliquity = 23.43929111111111; // Default mean obliquity
  if (typeof window !== 'undefined' && window.Astronomy && typeof window.Astronomy.MakeTime === 'function') {
    try {
      const time = window.Astronomy.MakeTime(utcDate);
      // Try to get true obliquity if available in Astronomy Engine
      if (typeof window.Astronomy.Rotation_EQJ_EQD === 'function') {
        // Use Astronomy Engine rotation matrices to get accurate obliquity
        const T = (julianDayFromUtcDate(utcDate) - 2451545.0) / 36525;
        obliquity = 23.43929111111111 - 0.0130041666667 * T;
      }
    } catch (e) {
      // Use fallback obliquity calculation
      const T = (julianDayFromUtcDate(utcDate) - 2451545.0) / 36525;
      obliquity = 23.43929111111111 - 0.0130041666667 * T;
    }
  } else {
    const T = (julianDayFromUtcDate(utcDate) - 2451545.0) / 36525;
    obliquity = 23.43929111111111 - 0.0130041666667 * T;
  }

  const lstRad = lstDeg * DEG2RAD;
  const epsRad = obliquity * DEG2RAD;
  const latRad = latitude * DEG2RAD;
  const sinEps = Math.sin(epsRad);
  const cosEps = Math.cos(epsRad);

  // Calculate Ascendant using standard formula
  const ascendant = ((Math.atan2(
    Math.cos(lstRad),
    -(Math.sin(lstRad) * cosEps + Math.tan(latRad) * sinEps),
  ) * RAD2DEG) % 360 + 360) % 360;

  // Calculate Midheaven using standard formula
  const midheaven = ((Math.atan2(
    Math.sin(lstRad),
    Math.cos(lstRad) * cosEps,
  ) * RAD2DEG) % 360 + 360) % 360;

  return { ascendant, midheaven, lstDeg, obliquity };
}


function isAngularPointName(name) {
  return Boolean(anglePointHouseAnchorNumber(name));
}

function isQuadrantHouseSystem(houseSystem) {
  const key = String(houseSystem || 'Placidus').trim().toLowerCase().replace(/[\s_-]+/g, '');
  return key === 'placidus' || key === 'koch' || key === 'porphyrius' ||
    key === 'porphyry' || key === 'regiomontanus' || key === 'campanus';
}

function angularDistanceDegrees(a, b) {
  const diff = Math.abs(normalizeDegrees360(Number(a) - Number(b)));
  return Math.min(diff, 360 - diff);
}

function findChartPoint(data, names) {
  const wanted = new Set(names.map((name) => canonicalObjectName(name)));
  return (Array.isArray(data) ? data : []).find((item) => wanted.has(canonicalObjectName(item?.name)));
}

function synchronizeAngleCusps(data, houseCusps, houseSystem) {
  if (!Array.isArray(data) || !Array.isArray(houseCusps) || houseCusps.length !== 12) return houseCusps;

  const asc = findChartPoint(data, ['Ascendant Symbol', 'Ascendant']);
  const dsc = findChartPoint(data, ['Descendant']);
  const mc = findChartPoint(data, ['Midheaven', 'MC']);
  const ic = findChartPoint(data, ['Imum Coeli', 'IC']);
  const updates = [
    { house: 1, point: asc },
    { house: 7, point: dsc },
  ];

  // In quadrant house systems Swiss defines the 10th cusp as MC and the 4th
  // cusp as IC. Equal and Whole Sign are intentionally left alone because MC/IC
  // are not the same thing as the 10th/4th cusp in those systems.
  if (isQuadrantHouseSystem(houseSystem)) {
    updates.push({ house: 10, point: mc }, { house: 4, point: ic });
  }

  updates.forEach(({ house, point }) => {
    if (!point || !Number.isFinite(Number(point.position))) return;
    const cusp = houseCusps.find((item) => Number(item.house) === house);
    if (!cusp) return;
    const exact = normalizeDegrees360(Number(point.position));
    if (!Number.isFinite(exact)) return;
    if (angularDistanceDegrees(cusp.position, exact) > 0.000001) {
      cusp.position = exact;
      cusp.sign = getSignFromPosition(exact, data?.[0]?.zodiacSystem || 'Tropical');
      cusp.swissAngleSynced = true;
    }
  });

  return houseCusps;
}



function degreeMinuteToLongitude(signName, degree, minute = 0) {
  const signStarts = {
    aries: 0, taurus: 30, gemini: 60, cancer: 90, leo: 120, virgo: 150,
    libra: 180, scorpio: 210, sagittarius: 240, capricorn: 270, aquarius: 300, pisces: 330,
  };
  const start = signStarts[String(signName || '').toLowerCase()];
  return Number.isFinite(start) ? ((((start + Number(degree) + Number(minute) / 60) % 360) + 360) % 360) : null;
}



// All hard-coded chart reference guards were removed.
// The only authoritative ephemeris source is /api/swiss-ephemeris.

function applySwissPayloadToChartData(data, swissPayload, formDataObj, zodiacSystem, wrap360, getSignFromPositionFn) {
  if (!swissPayload || !swissPayload.positions) return null;

  const aliases = {
    'Ascendant': 'Ascendant Symbol',
    'AS': 'Ascendant Symbol',
    'MC': 'Midheaven',
    'IC': 'Imum Coeli',
    'DS': 'Descendant',
    'Desc': 'Descendant',
    'Anti Vertex': 'Anti-Vertex',
    'Pars Fortunae': 'Part of Fortune',
    'Pars Spiritus': 'Part of Spirit',
    'Galactic Centre': 'Galactic Center',
  };
  const canonical = (name) => aliases[name] || name;
  const defaultPoint = (name) => ({
    name,
    position: null,
    sign: 'Unavailable',
    house: null,
    aspects: [],
    retroIcon: null,
    retrograde: false,
    isFixedStar: false,
    unavailable: true,
    swissEphemeris: true,
  });
  const markUnavailable = (name, reason) => {
    let item = data.find((entry) => entry.name === name);
    if (!item) {
      item = defaultPoint(name);
      data.push(item);
    }
    item.position = null;
    item.sign = 'Unavailable';
    item.house = null;
    item.aspects = [];
    item.unavailable = true;
    item.swissEphemeris = true;
    item.swissError = reason || 'Swiss Ephemeris returned no position for this date.';
    return item;
  };
  const normalizeRetrogradeFlag = (payload) => {
    if (!payload) return false;
    if (payload.retrograde === true || payload.retrograde === 'sd' || payload.retrograde === 'sr') return payload.retrograde;
    if (payload.retrograde === false) return false;
    if (Number.isFinite(payload.speed)) return payload.speed < 0;
    return false;
  };

  Object.entries(swissPayload.positions).forEach(([rawName, payload]) => {
    const pointName = canonical(rawName);
    if (!payload || !Number.isFinite(payload.position)) {
      markUnavailable(pointName, payload?.error || 'Swiss Ephemeris returned no position for this date.');
      return;
    }
    let item = data.find((entry) => entry.name === pointName);
    if (!item) {
      item = defaultPoint(pointName);
      data.push(item);
    }
    item.position = wrap360(payload.position);
    item.swissPosition = item.position;

    const payloadAnchor = Number(payload.houseAnchorPosition ?? payload.anchorPosition ?? payload.renderPosition);
    if (Number.isFinite(payloadAnchor)) {
      item.houseAnchorPosition = wrap360(payloadAnchor);
      item.anchorPosition = item.houseAnchorPosition;
      item.renderPosition = item.houseAnchorPosition;
      item.houseAnchorHouse = Number(payload.houseAnchorHouse ?? payload.renderHouse) || anglePointHouseAnchorNumber(pointName);
      item.renderHouse = item.houseAnchorHouse;
      item.houseAnchorSign = getSignFromPositionFn(item.houseAnchorPosition, zodiacSystem);
    }

    item.sign = getSignFromPositionFn(item.position, zodiacSystem);
    item.retrograde = normalizeRetrogradeFlag(payload);
    item.retroIcon = item.retrograde ? '/images/misc/retrograde.svg' : null;
    item.unavailable = false;
    item.swissError = null;
    item.swissEphemeris = true;
  });

  const ascItem = data.find((entry) => entry.name === 'Ascendant Symbol');
  const mcItem = data.find((entry) => entry.name === 'Midheaven');
  const descItem = data.find((entry) => entry.name === 'Descendant');
  const icItem = data.find((entry) => entry.name === 'Imum Coeli');

  // Arabic parts are sensitive to whether the final Swiss Sun/Moon/ASC replaced
  // the fallback values. Recompute once more on the client from the final values
  // so rendered glyphs and text cannot keep stale fallback coordinates.
  const sunItem = data.find((entry) => entry.name === 'Sun');
  const moonItem = data.find((entry) => entry.name === 'Moon');
  if (ascItem && sunItem && moonItem) {
    const parts = {
      'Part of Fortune': wrap360(ascItem.position + moonItem.position - sunItem.position),
      'Part of Spirit': wrap360(ascItem.position + sunItem.position - moonItem.position),
    };
    Object.entries(parts).forEach(([name, position]) => {
      let item = data.find((entry) => entry.name === name);
      if (!item) {
        item = defaultPoint(name);
        data.push(item);
      }
      item.position = position;
      item.swissPosition = position;
      item.sign = getSignFromPositionFn(position, zodiacSystem);
      item.swissEphemeris = true;
    });
  }

  return {
    ascPos: ascItem?.position,
    mcPos: mcItem?.position,
    descPos: descItem?.position,
    icPos: icItem?.position,
    nodePos: data.find((entry) => entry.name === 'North Node')?.position,
    southNodePos: data.find((entry) => entry.name === 'South Node')?.position,
    houseCusps: Array.isArray(swissPayload.houseCusps) && swissPayload.houseCusps.length === 12
      ? swissPayload.houseCusps
          .slice()
          .sort((a, b) => Number(a.house) - Number(b.house))
          .map((cusp) => {
            const houseNumber = Number(cusp.house);
            const position = wrap360(cusp.position);
            return {
              name: `House ${houseNumber}`,
              house: houseNumber,
              position,
              sign: getSignFromPositionFn(position, zodiacSystem),
              aspects: [],
              retroIcon: null,
              isFixedStar: false,
              swissEphemeris: true,
            };
          })
      : null,
  };
}

// Manual position override functions removed.


function normalizeAspectSettingName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function getSelectedAspectTypesStrict() {
  const inputs = Array.from(document.querySelectorAll('#aspect-settings input[name="aspects"]'));
  if (!inputs.length) return null; // settings UI not mounted: keep safe defaults elsewhere
  return new Set(
    inputs
      .filter((el) => el.checked)
      .map((el) => normalizeAspectSettingName(el.value)),
  );
}

function getCurrentAspectPrefs() {
  const aspectInputs = Array.from(document.querySelectorAll('#aspect-settings input[name="aspects"]'));
  let allowedAspects = aspectInputs.length
    ? aspectInputs.filter((cb) => cb.checked).map((cb) => normalizeAspectSettingName(cb.value))
    : ['conjunction', 'opposition', 'trine', 'square', 'sextile', 'semisextile', 'quincunx'];

  const allowedPlanets = [
    ...document.querySelectorAll(
      '#planet-settings input[name="planetAspects"]:checked',
    ),
  ].map((cb) => cb.value); // Only the objects checked in Wheel Settings.

  const aspectOrbs = {};
  document
    .querySelectorAll("#aspect-settings select.aspect-orb")
    .forEach((sel) => {
      aspectOrbs[sel.dataset.aspect.toLowerCase()] = +sel.value;
    });

  return { allowedAspects, allowedPlanets, aspectOrbs };
}



function getSelectedPlanetsAspectsFallback(formDataObj = {}) {
  if (Array.isArray(formDataObj?.selectedPlanetsAspects) && formDataObj.selectedPlanetsAspects.length) {
    return formDataObj.selectedPlanetsAspects;
  }
  try {
    const stored = JSON.parse(localStorage.getItem("natalData") || "null");
    if (Array.isArray(stored?.selectedPlanetsAspects) && stored.selectedPlanetsAspects.length) {
      return stored.selectedPlanetsAspects;
    }
  } catch (_) {}
  try {
    return Array.from(document.querySelectorAll('#planet-settings input[name="planetAspects"]:checked')).map((checkbox) => checkbox.value);
  } catch (_) {
    return [];
  }
}

function getSelectedAspectsFallback(formDataObj = {}) {
  if (Array.isArray(formDataObj?.selectedAspects) && formDataObj.selectedAspects.length) {
    return formDataObj.selectedAspects;
  }
  try {
    const stored = JSON.parse(localStorage.getItem("natalData") || "null");
    if (Array.isArray(stored?.selectedAspects) && stored.selectedAspects.length) {
      return stored.selectedAspects;
    }
  } catch (_) {}
  try {
    return Array.from(document.querySelectorAll('#aspect-settings input[name="aspects"]:checked')).map((checkbox) => checkbox.value);
  } catch (_) {
    return [];
  }
}

function getAspectMasterFromSettings() {
  const defaults = [
    { type: "conjunction", deg: 0, orb: 8 },
    { type: "opposition", deg: 180, orb: 8 },
    { type: "trine", deg: 120, orb: 7 },
    { type: "square", deg: 90, orb: 7 },
    { type: "sextile", deg: 60, orb: 5 },
    { type: "semisextile", deg: 30, orb: 2 },
    { type: "quincunx", deg: 150, orb: 3 },
  ];
  try {
    const inputNodes = Array.from(document.querySelectorAll('#aspect-settings input[name="aspects"]'));
    const selected = inputNodes.length
      ? inputNodes.filter((el) => el.checked).map((el) => normalizeAspectSettingName(el.value))
      : null;
    const orbs = {};
    document.querySelectorAll('#aspect-settings select.aspect-orb').forEach((sel) => {
      const key = normalizeAspectSettingName(sel.dataset.aspect);
      const val = Number(sel.value);
      if (key && Number.isFinite(val)) orbs[key] = val;
    });
    return defaults
      .filter((asp) => selected === null || selected.includes(normalizeAspectSettingName(asp.type)))
      .map((asp) => ({ ...asp, orb: orbs[normalizeAspectSettingName(asp.type)] ?? asp.orb }));
  } catch (e) {
    return defaults;
  }
}

function calculateHousePositionGlobal(planetPosition, houseCusps) {
  if (!Array.isArray(houseCusps) || houseCusps.length === 0) return null;
  const pos = normalizeDegrees360(planetPosition);
  const cusps = houseCusps.slice().sort((a, b) => Number(a.house || 0) - Number(b.house || 0));
  for (let i = 0; i < cusps.length; i++) {
    const current = normalizeDegrees360(cusps[i].position);
    const next = normalizeDegrees360(cusps[(i + 1) % cusps.length].position);
    if (next > current) {
      if (pos >= current && pos < next) return i + 1;
    } else if (pos >= current || pos < next) {
      return i + 1;
    }
  }
  return 1;
}

function addAspectsToChartData(data, selectedPlanetsAspects = [], selectedAspects = [], aspectOrbs = {}) {
  const aspectable = data.filter((p) => p && Number.isFinite(p.position) && !String(p.name || '').startsWith('House'));
  const allowedPlanets = Array.isArray(selectedPlanetsAspects) && selectedPlanetsAspects.length
    ? new Set(selectedPlanetsAspects.map(canonicalObjectName))
    : new Set(aspectable.map((p) => canonicalObjectName(p.name)));
  const aspectInputsExist = !!document.querySelector('#aspect-settings input[name="aspects"]');
  const selected = Array.isArray(selectedAspects)
    ? new Set(selectedAspects.map((a) => normalizeAspectSettingName(a)))
    : null;
  const aspects = getAspectMasterFromSettings()
    .filter((a) => {
      const key = normalizeAspectSettingName(a.type);
      if (selected && selected.size) return selected.has(key);
      if (selected && selected.size === 0 && aspectInputsExist) return false;
      return true;
    })
    .map((a) => {
      const key = normalizeAspectSettingName(a.type);
      return { ...a, orb: Number(aspectOrbs?.[key]) || a.orb };
    });

  aspectable.forEach((planetA) => {
    if (!allowedPlanets.has(canonicalObjectName(planetA.name))) {
      planetA.aspects = [];
      return;
    }
    planetA.aspects = aspectable
      .filter((planetB) => planetB.name !== planetA.name && allowedPlanets.has(canonicalObjectName(planetB.name)))
      .map((planetB) => {
        const diff = Math.abs(normalizeDegrees360(planetA.position) - normalizeDegrees360(planetB.position));
        const angle = diff > 180 ? 360 - diff : diff;
        for (const asp of aspects) {
          const orb = Math.abs(angle - asp.deg);
          if (orb <= asp.orb) {
            return {
              planet: planetB.name,
              type: asp.type[0].toUpperCase() + asp.type.slice(1),
              orb,
              status: planetA.position < planetB.position ? "applying" : "separating",
            };
          }
        }
        return null;
      })
      .filter(Boolean);
  });
  return data;
}

function getBackendApiBaseUrl() {
  if (typeof window === "undefined" || !window.location) return "";
  const configured = String(window.TRUESKY_API_BASE_URL || "").replace(/\/+$/, "");
  if (configured && window.location.origin !== configured) return configured;
  if (window.location.protocol === "file:") return "http://localhost:5501";
  // When served by the bundled Node/Render server, same-origin /api is preferred.
  return "";
}

function getLocalSwissApiUrls(pathname) {
  const path = pathname || "/api/swiss-ephemeris";
  const urls = [];
  const add = (url) => { if (url && !urls.includes(url)) urls.push(url); };
  const backendBase = getBackendApiBaseUrl();
  if (backendBase) add(`${backendBase}${path}`);
  if (typeof window !== "undefined" && window.location && window.location.protocol !== "file:") {
    add(`${window.location.origin}${path}`);
  } else {
    add(`http://localhost:5501${path}`);
  }
  add(`http://localhost:5501${path}`);
  add(`http://127.0.0.1:5501${path}`);
  return urls;
}

async function fetchJsonWithLocalFallback(pathname, options) {
  const urls = getLocalSwissApiUrls(pathname);
  const errors = [];
  for (const url of urls) {
    try {
      const response = await fetch(url, options);
      return { response, url };
    } catch (fetchError) {
      errors.push(`${url}: ${fetchError?.message || fetchError}`);
    }
  }
  throw new Error(`Não consegui conectar ao servidor Swiss. Testei: ${errors.join(" | ")}. Abra por http://localhost:5501 depois de rodar npm start.`);
}


function localFallbackCoordinates(location) {
  const key = String(location || "").trim().toLowerCase();
  if (!key) return null;
  if (key.includes("new york")) return { lat: 40.7128, lon: -74.0060 };
  if (key.includes("sao paulo") || key.includes("são paulo")) return { lat: -23.5505, lon: -46.6333 };
  if (key.includes("curitiba")) return { lat: -25.4284, lon: -49.2733 };
  if (key.includes("london")) return { lat: 51.5074, lon: -0.1278 };
  return null;
}


const TRUE_SKY_CITY_DB_URL = "./data/cities.json";
let trueSkyCityDbPromise = null;

function normalizeLocationLookupText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cityDisplayName(city) {
  return [city?.name, city?.region, city?.country].filter(Boolean).join(", ");
}

async function loadTrueSkyCityDb() {
  if (trueSkyCityDbPromise) return trueSkyCityDbPromise;
  trueSkyCityDbPromise = (async () => {
    if (typeof fetch !== "function") return [];
    try {
      const response = await fetch(TRUE_SKY_CITY_DB_URL, { headers: { Accept: "application/json" } });
      if (!response.ok) return [];
      const raw = await response.json();
      if (!Array.isArray(raw)) return [];
      return raw
        .map((city) => ({
          name: city.name || "",
          region: city.region || "",
          country: city.country || "",
          lat: Number(city.lat),
          lon: Number(city.lon),
          timezone: city.timezone || "",
          utcOffset: normalizeUtcOffsetHours(parseUtcOffsetHours(city.utcOffset, city.timezone || ""), standardTimezoneOffsetHours(city.timezone || "", 0)),
        }))
        .filter((city) => Number.isFinite(city.lat) && Number.isFinite(city.lon));
    } catch (_) {
      return [];
    }
  })();
  return trueSkyCityDbPromise;
}

function scoreCityForLocationQuery(city, query) {
  const q = normalizeLocationLookupText(query);
  if (!q) return 0;
  const name = normalizeLocationLookupText(city.name);
  const region = normalizeLocationLookupText(city.region);
  const country = normalizeLocationLookupText(city.country);
  const full = normalizeLocationLookupText(cityDisplayName(city));
  let score = 0;
  if (full === q) score += 180;
  if (name === q) score += 150;
  if (full.startsWith(q)) score += 95;
  if (name.startsWith(q)) score += 85;
  if (full.includes(q)) score += 55;
  if (q.includes(name) && name.length >= 3) score += 45;
  if (region && q.includes(region)) score += 18;
  if (country && q.includes(country)) score += 18;
  const qTokens = q.split(/\s+/).filter((token) => token.length >= 3);
  const hay = `${name} ${region} ${country}`;
  score += qTokens.filter((token) => hay.includes(token)).length * 10;
  return score;
}

function distanceKmBetween(lat1, lon1, lat2, lon2) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

async function findCityMetadata(locationQuery, lat, lon) {
  const db = await loadTrueSkyCityDb();
  if (!db.length) return null;

  const query = String(locationQuery || "").trim();
  if (query) {
    let best = null;
    for (const city of db) {
      const score = scoreCityForLocationQuery(city, query);
      if (score > 0 && (!best || score > best.score)) best = { city, score };
    }
    if (best && best.score >= 55) return best.city;
  }

  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (Number.isFinite(latNum) && Number.isFinite(lonNum) && !(latNum === 0 && lonNum === 0)) {
    let nearest = null;
    for (const city of db) {
      const distance = distanceKmBetween(latNum, lonNum, city.lat, city.lon);
      if (!nearest || distance < nearest.distance) nearest = { city, distance };
    }
    if (nearest && nearest.distance <= 250) return nearest.city;
  }

  return null;
}

function getTimezoneOffsetForLocalFields(timezone, fallbackOffset, year, month, day, hour, minute) {
  const fallback = standardTimezoneOffsetHours(timezone, fallbackOffset);
  const tz = String(timezone || "").trim();
  if (!tz) return fallback;
  if (!Number.isFinite(year) || year <= 0) return fallback;
  const localDate = makeHistoricalDate(year, month - 1, day, hour, minute, 0, 0, true);
  if (!(localDate instanceof Date) || !Number.isFinite(localDate.getTime())) return fallback;

  let offset = fallback;
  for (let i = 0; i < 3; i += 1) {
    const utcGuess = new Date(localDate.getTime() - offset * 3600000);
    const nextOffset = getIanaTimezoneOffsetHours(tz, utcGuess);
    if (!Number.isFinite(nextOffset)) return offset;
    if (Math.abs(nextOffset - offset) < 1 / 60) return nextOffset;
    offset = nextOffset;
  }
  return normalizeUtcOffsetHours(offset, fallback);
}

async function geocodeLocationQuery(location) {
  const query = String(location || "").trim();
  if (!query) return null;
  try {
    const backendBase = getBackendApiBaseUrl();
    const url = backendBase
      ? `${backendBase}/api/geocode?query=${encodeURIComponent(query)}`
      : `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=1&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const result = await response.json();
    if (!Array.isArray(result) || result.length === 0) return null;
    const item = result[0];
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch (e) {
    return null;
  }
}

export async function calculateAstrologyChart(formDataObj = {}) {
  const normalizedDate = normalizeCalendarDateFields(formDataObj, "day", "month", "year", "calendarSystem");
  const year = normalizedDate.year;
  const month = normalizedDate.month;
  const day = normalizedDate.day;
  const hour = Number(formDataObj.hour ?? formDataObj.hourString ?? 0);
  const minute = Number(formDataObj.minute ?? formDataObj.minuteString ?? 0);
  let lat = Number(formDataObj.lat ?? formDataObj.latitude ?? 0);
  let lon = Number(formDataObj.long ?? formDataObj.lon ?? formDataObj.longitude ?? 0);
  const locationQuery = String(formDataObj.location ?? formDataObj.birthLocation ?? "").trim();
  let cityMeta = await findCityMetadata(locationQuery, lat, lon);
  if ((!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) && locationQuery) {
    const localGeo = cityMeta || localFallbackCoordinates(locationQuery);
    const geo = localGeo || await geocodeLocationQuery(locationQuery);
    if (geo) {
      lat = Number(geo.lat);
      lon = Number(geo.lon ?? geo.long);
      formDataObj.lat = String(lat);
      formDataObj.long = String(lon);
      formDataObj.latitude = String(lat);
      formDataObj.longitude = String(lon);
      if (!cityMeta) cityMeta = await findCityMetadata(locationQuery, lat, lon);
    }
  }

  if (!String(formDataObj.timezone || formDataObj.timezoneName || "").trim() && cityMeta?.timezone) {
    formDataObj.timezone = cityMeta.timezone;
    formDataObj.timezoneName = cityMeta.timezone;
  }

  const selectedZodiacSystem = formDataObj.selectedZodiacSystem || formDataObj.zodiacSystem || "Tropical";
  const selectedAyanamsaSystem = formDataObj.selectedAyanamsaSystem || formDataObj.ayanamsaSystem || "Tropical";
  const selectedHouseSystem = formDataObj.selectedHouseSystem || formDataObj.houseSystem || "Placidus";
  const customAyanamsa = Number(formDataObj.customAyanamsa || 0);
  const utcCandidates = [formDataObj.utcOffset, formDataObj.utc, formDataObj.timezoneOffset, formDataObj.timezone_offset, formDataObj.utc_offset];
  const explicitUtcValue = utcCandidates.find((value) => String(value ?? "").trim() !== "");
  const timezoneForCalculation = formDataObj.timezone || formDataObj.timezoneName || cityMeta?.timezone || "";
  const utcMode = resolveUtcMode(formDataObj);
  const hasUsableTimezone = String(timezoneForCalculation || "").trim().includes("/");
  // Hidden utcOffset is created even in automatic mode by js/locationSuggestions.js.
  // Treat it as manual ONLY when utcMode/timezoneMode is manual, or when there is no
  // timezone to recalculate from. Otherwise DST must be recomputed for the selected
  // local date/time and the stored numeric UTC value is only a fallback.
  const hasExplicitUtcOffset = explicitUtcValue !== undefined && (utcMode === "manual" || !hasUsableTimezone);
  const parsedOffset = parseUtcOffsetHours(explicitUtcValue !== undefined ? explicitUtcValue : timezoneForCalculation, timezoneForCalculation);
  const cityFallbackOffset = cityMeta && Number.isFinite(parseUtcOffsetHours(cityMeta.utcOffset, cityMeta.timezone || ""))
    ? getTimezoneOffsetForLocalFields(cityMeta.timezone, parseUtcOffsetHours(cityMeta.utcOffset, cityMeta.timezone || ""), year, month, day, hour, minute)
    : null;
  let offsetRaw;
  if (utcMode === "manual" && explicitUtcValue !== undefined) {
    // Manual UTC must always win over city/timezone metadata. Otherwise choosing
    // a city can silently replace the user's fixed UTC offset before the chart is calculated.
    offsetRaw = normalizeUtcOffsetHours(parsedOffset, parsedOffset);
  } else {
    offsetRaw = normalizeUtcOffsetHours(Number.isFinite(cityFallbackOffset) ? cityFallbackOffset : parsedOffset, standardTimezoneOffsetHours(timezoneForCalculation, parsedOffset));
  }
  if (utcMode === "auto" && hasUsableTimezone) {
    offsetRaw = getTimezoneOffsetForLocalFields(
      timezoneForCalculation,
      Number.isFinite(offsetRaw) ? offsetRaw : 0,
      year,
      month,
      day,
      hour,
      minute
    );
  }
  const { utcDate, utcOffset } = makeUtcDateFromBirthFields(year, month, day, hour, minute, offsetRaw, timezoneForCalculation, formDataObj.location, hasExplicitUtcOffset);
  let time = null;
  try { time = window.Astronomy?.MakeTime ? window.Astronomy.MakeTime(utcDate) : null; } catch (e) { time = null; }
  const ayanamsa = getEffectiveAyanamsa(time || { date: utcDate }, selectedZodiacSystem, selectedAyanamsaSystem, customAyanamsa);
  const wrap360 = normalizeDegrees360;
  const meta = {
    name: formDataObj.name || formDataObj.chartName || "Natal Chart",
    day, month, year,
    hour, minute,
    hourString: String(Math.trunc(hour)).padStart(2, "0"),
    minuteString: String(Math.trunc(minute)).padStart(2, "0"),
    location: formDataObj.location || "",
    lat, long: lon,
    utcOffset,
    utc: utcOffset,
    utcMode,
    timezone: timezoneForCalculation || "",
    zodiacSystem: selectedZodiacSystem,
    ayanamsaSystem: selectedAyanamsaSystem,
    customAyanamsa,
    houseSystem: selectedHouseSystem,
    coordinateSystem: formDataObj.selectedCoordinateSystem || formDataObj.coordinateSystem || "Ecliptic",
    trueNodes: formDataObj.trueNodes !== false,
    trueLilith: formDataObj.trueLilith === true,
    draconic: isDraconicEnabled(formDataObj.draconic),
    draconicOffset: null,
    draconicReference: null,
  };
  const data = [meta];

  let response;
  let swissApiUrl = '';
  try {
    const result = await fetchJsonWithLocalFallback('/api/swiss-ephemeris', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        historicalYear: year,
        month, day, hour, minute,
        utcOffset,
        lat, long: lon,
        ayanamsa,
        houseSystemCode: getHouseSystemCode(selectedHouseSystem),
        trueNodes: formDataObj.trueNodes !== false,
        trueLilith: formDataObj.trueLilith === true,
      }),
    });
    response = result.response;
    swissApiUrl = result.url;
  } catch (fetchError) {
    throw fetchError;
  }
  if (!response.ok) {
    let errorText = '';
    try { errorText = await response.text(); } catch (e) { errorText = ''; }
    throw new Error(`Servidor Swiss respondeu HTTP ${response.status}: ${errorText || response.statusText}`);
  }
  const swissPayload = await response.json();
  if (!swissPayload?.success) {
    throw new Error(swissPayload?.error || 'Swiss Ephemeris calculation failed');
  }
  const swiss = applySwissPayloadToChartData(data, swissPayload, formDataObj, selectedZodiacSystem, wrap360, getSignFromPosition);
  const houseCusps = swiss?.houseCusps || [];
  if (meta.draconic) {
    const draconicOffset = applyDraconicZodiacToChartData(data, houseCusps, selectedZodiacSystem, wrap360, getSignFromPosition);
    if (Number.isFinite(Number(draconicOffset))) {
      meta.draconicOffset = draconicOffset;
      meta.draconicReference = "North Node";
    }
  }
  houseCusps.forEach((cusp) => {
    if (!data.some((p) => p.name === cusp.name)) data.push(cusp);
  });

  // Visual anchor: keep ASC/DS/IC/MC glued to their house-system cusps
  // in every house system (House 1/7/4/10), without changing their
  // astronomical longitude used for calculations and Arabic parts.
  applyAngleHouseAnchorsToItems(data, houseCusps, selectedZodiacSystem);

  data.forEach((item) => {
    if (!item || item === meta || !Number.isFinite(item.position) || String(item.name || '').startsWith('House')) return;
    item.house = calculateHousePositionGlobal(item.position, houseCusps);
    const deg = calculatePlanetDegrees(normalizeDegrees360(item.position), selectedZodiacSystem);
    item.hour = deg.hour;
    item.minute = Number(deg.minute);
    if (item.minute >= 60) { item.hour += 1; item.minute = 0; }
  });

  if (formDataObj.fixedStars) {
    const maxMag = Number(formDataObj.fixedStarsMagnitude ?? 2.5);
    const maxLat = Number(formDataObj.fixedStarsLatitude ?? 90);
    const fixedStarDraconicOffset = meta.draconic && Number.isFinite(Number(meta.draconicOffset)) ? Number(meta.draconicOffset) : 0;
    FIXED_STARS_CATALOG
      .filter((star) => Math.abs(Number(star.eclipticLatitude || 0)) <= maxLat && Number(star.magnitude || 99) <= maxMag)
      .forEach((star) => {
        const basePosition = normalizeDegrees360(star.longitude - ayanamsa);
        const position = normalizeDegrees360(basePosition - fixedStarDraconicOffset);
        data.push({
          name: star.name,
          position,
          baseZodiacPosition: meta.draconic ? basePosition : undefined,
          draconicPosition: meta.draconic ? position : undefined,
          draconicOffset: meta.draconic ? fixedStarDraconicOffset : undefined,
          sign: getSignFromPosition(position, selectedZodiacSystem),
          house: calculateHousePositionGlobal(position, houseCusps),
          aspects: [],
          isFixedStar: true,
          magnitude: star.magnitude,
          eclipticLatitude: star.eclipticLatitude,
        });
      });
  }

  addAspectsToChartData(data, formDataObj.selectedPlanetsAspects, formDataObj.selectedAspects, formDataObj.aspectOrbs);
  return data;
}

// Composite charts
let compositeNatal;
let compositeSynastry;

function getSignFromPosition(position, zodiacSystem) {
  const normPos = ((position % 360) + 360) % 360;

  if (isUnequalZodiacSystem(zodiacSystem)) {
    const boundaries = getUnequalZodiacBoundaries(zodiacSystem);

    for (let i = 0; i < boundaries.length - 1; i++) {
      if (
        normPos >= boundaries[i].boundary &&
        normPos < boundaries[i + 1].boundary
      ) {
        return boundaries[i].sign;
      }
    }
    return "Pisces"; // fallback
  } else {
    const signs = [
      "Aries",
      "Taurus",
      "Gemini",
      "Cancer",
      "Leo",
      "Virgo",
      "Libra",
      "Scorpio",
      "Sagittarius",
      "Capricorn",
      "Aquarius",
      "Pisces",
    ];
    const index = Math.floor(normPos / 30);
    return signs[index];
  }
}

function buildComposite(natalPlanets, synastryPlanets) {
  const norm = (v) => ((v % 360) + 360) % 360;
  const delta = (a, b) => {
    let d = norm(b) - norm(a);
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  };

  const zodiacSystem = natalPlanets?.[0]?.zodiacSystem || "";
  const houseSystem = natalPlanets?.[0]?.houseSystem || "";
  const isWholeSign = houseSystem === "Whole Sign";

  // Pull user aspect preferences
  const allowedAspects = Array.from(
    document.querySelectorAll('#aspect-settings input[name="aspects"]:checked'),
  ).map((cb) => cb.value.toLowerCase());

  const allowedPlanets = Array.from(
    document.querySelectorAll(
      '#planet-settings input[name="planetAspects"]:checked',
    ),
  ).map((cb) => cb.value);

  const aspectOrbs = {};
  document
    .querySelectorAll("#aspect-settings select.aspect-orb")
    .forEach((sel) => {
      aspectOrbs[sel.dataset.aspect.toLowerCase()] = +sel.value;
    });

  const ASPECT_MASTER = getAspectMasterFromSettings();

  // Generate composite planets (immediate returnable form)
  const composite = natalPlanets
    .slice(1)
    .map((p) => {
      const match = synastryPlanets.find((q) => q.name === p.name);
      if (!match) return null;

      // For Whole Sign, skip house cusps - we'll generate them properly below
      if (isWholeSign && p.name && p.name.startsWith("House")) {
        return null;
      }

      const d = delta(p.position, match.position);
      const mid = norm(p.position + d / 2);
      const newSign = getSignFromPosition(mid, zodiacSystem);

      return {
        ...p,
        position: mid,
        sign: newSign || p.sign,
        retrograde: false,
      };
    })
    .filter(Boolean);

  // For Whole Sign, generate house cusps based on composite Ascendant's sign
  if (isWholeSign) {
    const natalAsc = natalPlanets.find((p) => p.name === "Ascendant" || p.name === "Ascendant Symbol");
    const synastryAsc = synastryPlanets.find((p) => p.name === "Ascendant" || p.name === "Ascendant Symbol");

    if (natalAsc && synastryAsc) {
      // Calculate composite Ascendant midpoint
      const ascDelta = delta(natalAsc.position, synastryAsc.position);
      const compositeAscPosition = norm(natalAsc.position + ascDelta / 2);

      if (isUnequalZodiacSystem(zodiacSystem)) {
        // Unequal zodiac boundaries. Whole-sign houses remain 12 houses, so
        // Ophiuchus is skipped as a house cusp while the chart wheel/sign labels
        // still use all 13 IAU signs.
        const customBoundaries = getUnequalZodiacBoundaries(zodiacSystem).filter((b) => b.sign !== "Ophiuchus");

        // Find which sign the composite Ascendant is in
        let firstHouseIndex = customBoundaries.findIndex((sign, index) => {
          const nextSign =
            customBoundaries[(index + 1) % customBoundaries.length];
          return (
            (compositeAscPosition >= sign.boundary &&
              compositeAscPosition < nextSign.boundary) ||
            (sign.boundary > nextSign.boundary &&
              (compositeAscPosition >= sign.boundary ||
                compositeAscPosition < nextSign.boundary))
          );
        });

        // Generate 12 house cusps at sign boundaries
        for (let i = 0; i < 12; i++) {
          const signIndex = (firstHouseIndex + i) % customBoundaries.length;
          const cusp = customBoundaries[signIndex].boundary;
          composite.push({
            name: `House ${i + 1}`,
            position: cusp,
            sign: customBoundaries[signIndex].sign,
          });
        }
      } else {
        // Regular Whole Sign (30° per sign)
        const firstHouseStart = Math.floor(compositeAscPosition / 30) * 30;
        const signs = [
          "Aries",
          "Taurus",
          "Gemini",
          "Cancer",
          "Leo",
          "Virgo",
          "Libra",
          "Scorpio",
          "Sagittarius",
          "Capricorn",
          "Aquarius",
          "Pisces",
        ];

        for (let i = 0; i < 12; i++) {
          const cusp = (firstHouseStart + i * 30) % 360;
          const signIndex = Math.floor(cusp / 30);
          composite.push({
            name: `House ${i + 1}`,
            position: cusp,
            sign: signs[signIndex],
          });
        }
      }
    }
  }

  // Composite angles must render on the composite house-system anchors too.
  const compositeHouseCusps = composite
    .filter((item) => item?.name && /^House\s+\d+$/i.test(String(item.name).trim()))
    .map((item) => ({
      ...item,
      house: Number(item.house || String(item.name).match(/\d+/)?.[0]),
    }))
    .filter((item) => Number.isFinite(item.house) && Number.isFinite(Number(item.position)))
    .sort((a, b) => a.house - b.house);
  applyAngleHouseAnchorsToItems(composite, compositeHouseCusps, zodiacSystem);

  // Inject aspects directly into each planet
  return composite.map((planetA) => {
    if (!allowedPlanets.includes(planetA.name)) {
      return { ...planetA, aspects: [] };
    }

    const aspects = composite
      .filter(
        (planetB) =>
          planetB.name !== planetA.name &&
          allowedPlanets.includes(planetB.name),
      )
      .map((planetB) => {
        const diff = Math.abs(norm(planetA.position) - norm(planetB.position));
        const angle = diff > 180 ? 360 - diff : diff;

        for (const asp of ASPECT_MASTER) {
          const orb = aspectOrbs[String(asp.type).toLowerCase()] ?? asp.orb ?? 0;
          if (Math.abs(angle - asp.deg) <= orb) {
            return {
              planet: planetB.name,
              type: asp.type[0].toUpperCase() + asp.type.slice(1),
              orb: Math.abs(angle - asp.deg),
              status:
                planetA.position < planetB.position ? "applying" : "separating",
            };
          }
        }

        return null;
      })
      .filter(Boolean);

    return { ...planetA, aspects };
  });
}

// Function to copy composite birth details text to synastry chart
function copyCompositeBirthDetailsToSynastry() {
  // Wait a bit to ensure composite DOM is fully rendered
  setTimeout(() => {
    // Find composite chart birth details
    const compositeChart = document.getElementById("composite-chart");
    if (!compositeChart) return;

    const compositeSvg = compositeChart.querySelector("svg");
    if (!compositeSvg) return;

    // Get all birth detail text elements from composite
    const compositeLeftDetails = compositeSvg.querySelectorAll(
      ".birth-details-left text",
    );
    const compositeRightDetails = compositeSvg.querySelectorAll(
      ".birth-details-right text",
    );
    const compositeTitle = compositeSvg.querySelector(
      ".birth-details-center text",
    );

    if (
      !compositeLeftDetails.length ||
      !compositeRightDetails.length ||
      !compositeTitle
    )
      return;

    // Extract text content
    const leftTexts = Array.from(compositeLeftDetails).map(
      (el) => el.textContent,
    );
    const rightTexts = Array.from(compositeRightDetails).map(
      (el) => el.textContent,
    );
    const titleText = compositeTitle.textContent;

    // Find all SVGs that might be synastry charts
    const allSvgs = document.querySelectorAll("svg");

    allSvgs.forEach((svg) => {
      // Skip the composite chart itself
      if (svg === compositeSvg) return;

      // Skip the natal chart - it should keep its own birth details
      const parentElement = svg.closest("#natal-chart");
      if (parentElement) return;

      // Skip the triwheel chart - it should keep its own birth details
      const triwheelParent = svg.closest("#triwheel-chart");
      if (triwheelParent) return;

      // Skip the return chart - it should keep its own birth details
      const returnParent = svg.closest("#return-chart");
      if (returnParent) return;

      // Check if this SVG has birth details (indicating it's a chart)
      const existingDetails = svg.querySelector(".birth-details");
      if (!existingDetails) return;

      // Remove existing birth details
      svg.querySelectorAll(".birth-details").forEach((el) => el.remove());
      svg.querySelectorAll(".birth-details-left").forEach((el) => el.remove());
      svg.querySelectorAll(".birth-details-right").forEach((el) => el.remove());
      svg
        .querySelectorAll(".birth-details-center")
        .forEach((el) => el.remove());

      // Copy composite's birth details structure
      const width = 1000; // Standard width from sharedNatal

      // Add left column details
      const leftGroup = d3
        .select(svg)
        .append("g")
        .attr("class", "birth-details birth-details-left")
        .attr("transform", "translate(0, -64)");

      leftTexts.forEach((text, i) => {
        leftGroup
          .append("text")
          .attr("y", i * 34)
          .attr("font-family", "Segoe UI, sans-serif")
          .attr("font-size", "28px")
          .attr("fill", "#222")
          .attr("font-weight", "normal")
          .text(text);
      });

      // Add right column details
      const rightGroup = d3
        .select(svg)
        .append("g")
        .attr("class", "birth-details birth-details-right")
        .attr("transform", `translate(${width - 20}, -64)`);

      rightTexts.forEach((text, i) => {
        rightGroup
          .append("text")
          .attr("y", i * 34)
          .attr("text-anchor", "end")
          .attr("font-family", "Segoe UI, sans-serif")
          .attr("font-size", "28px")
          .attr("fill", "#222")
          .attr("font-weight", "normal")
          .text(text);
      });

      // Add center title, but change "Composite" to "Synastry"
      const synastryTitle = titleText.replace("Composite", "Synastry");

      d3.select(svg)
        .append("g")
        .attr("class", "birth-details birth-details-center")
        .attr("transform", `translate(${width / 2}, -112)`)
        .append("text")
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .attr("font-family", "Segoe UI, sans-serif")
        .attr("font-size", "36px")
        .attr("fill", "#222")
        .attr("font-weight", "bold")
        .text(synastryTitle);
    });
  }, 500); // Wait for composite to fully render
}

// Preloaded sign and image caches
const signImageCache = {};
const colorizedSignImageCache = {};
const planetImageCache = {};
const miscImageCache = {};


// Canonical zodiac SVG assets already exist in ./images/signs.
// The wheel uses these original local SVG files directly (no external SVGs),
// including Ophiuchus for the 13-sign wheel.
const TRUE_SKY_SIGN_GLYPHS = {
  aries: "♈",
  taurus: "♉",
  gemini: "♊",
  cancer: "♋",
  leo: "♌",
  virgo: "♍",
  libra: "♎",
  scorpio: "♏",
  ophiuchus: "⛎",
  sagittarius: "♐",
  capricorn: "♑",
  aquarius: "♒",
  pisces: "♓",
};

const TRUE_SKY_SIGN_COLORS = {
  aries: "#e15947",
  taurus: "#d58f3b",
  gemini: "#c9dd47",
  cancer: "#a5c16f",
  leo: "#33b278",
  virgo: "#44c1a8",
  libra: "#33b7bb",
  scorpio: "#3388c7",
  ophiuchus: "#353535",
  sagittarius: "#7a33d0",
  capricorn: "#a14cd3",
  aquarius: "#cf49cc",
  pisces: "#c16195",
};


// Inline SVG paths copied from ./images/signs/*.svg.  The wheel injects these
// local paths directly into the chart so the outer border symbols do not depend
// on <image> loading, relative URLs, browser cache, or font glyph support.
const TRUE_SKY_SIGN_SVG_CONTENT = {
  aries: "<path d=\"M430 0V488Q430 572 389.5 618.0Q349 664 276 664Q232 664 197.0 642.5Q162 621 142.0 584.5Q122 548 122 501Q122 458 141.0 424.0Q160 390 192.5 370.0Q225 350 265 350V290Q203 290 154.5 317.0Q106 344 78.5 391.5Q51 439 51 501Q51 568 79.0 618.0Q107 668 158.0 696.5Q209 725 276 725Q350 725 396.0 692.0Q442 659 465 587Q488 659 534.5 692.0Q581 725 654 725Q721 725 771.5 696.5Q822 668 850.5 618.0Q879 568 879 501Q879 439 851.5 391.5Q824 344 776.0 317.0Q728 290 665 290V350Q706 350 738.5 370.0Q771 390 789.5 424.0Q808 458 808 501Q808 548 788.0 585.0Q768 622 733.5 643.0Q699 664 654 664Q581 664 540.5 617.5Q500 571 500 488V0Z\" transform=\"translate(1.702899 87.650966) scale(0.103865 -0.103865)\" fill=\"#000000\"/>",
  taurus: "<path d=\"M435 -13Q382 -13 335.0 7.5Q288 28 252.5 63.5Q217 99 196.5 146.0Q176 193 176 246Q176 316 210.5 375.5Q245 435 305 470Q237 515 204 580Q181 625 162.0 647.0Q143 669 118.0 676.0Q93 683 51 683V744Q96 744 135.5 739.0Q175 734 203 705Q217 691 229.0 674.5Q241 658 251 638Q271 600 296.0 566.5Q321 533 356 519Q393 505 435 505Q476 505 513.5 522.0Q551 539 576 571Q589 588 600.0 604.5Q611 621 620 639Q638 675 668.0 705.0Q698 735 738 739Q758 741 778.5 742.5Q799 744 819 744V683Q778 683 753.0 676.0Q728 669 709.0 647.5Q690 626 667 581Q633 516 564 470Q625 435 659.5 375.5Q694 316 694 246Q694 192 673.5 145.0Q653 98 617.5 62.5Q582 27 535.0 7.0Q488 -13 435 -13ZM435 61Q486 61 528.0 86.0Q570 111 595.0 153.5Q620 196 620 246Q620 297 595.0 339.0Q570 381 528.0 406.0Q486 431 435 431Q385 431 342.5 406.0Q300 381 275.0 339.0Q250 297 250 246Q250 196 275.0 153.5Q300 111 342.5 86.0Q385 61 435 61Z\" transform=\"translate(1.289062 90.928385) scale(0.111979 -0.111979)\" fill=\"#000000\"/>",
  gemini: "<path d=\"M51 -66V-4Q84 9 118.0 19.0Q152 29 187 36V663Q145 672 111.0 682.0Q77 692 51 703V765Q213 699 425 699Q637 699 799 765V703Q741 678 663 662V36Q698 29 731.5 19.0Q765 9 799 -4V-66Q708 -31 618.5 -15.5Q529 0 425 0Q324 0 233.5 -15.5Q143 -31 51 -66ZM257 49Q297 56 339.0 59.0Q381 62 425 62Q469 62 511.0 59.0Q553 56 593 49V649Q511 637 425 637Q340 637 257 649Z\" transform=\"translate(6.016847 86.169675) scale(0.103490 -0.103490)\" fill=\"#000000\"/>",
  cancer: "<path d=\"M258 318Q163 318 107.0 367.0Q51 416 51 497Q51 606 152 659Q256 714 482 714Q550 714 624.0 703.0Q698 692 768.0 672.5Q838 653 892 628V558Q803 601 694.5 623.5Q586 646 482 646Q407 646 368 637Q409 630 437.0 592.0Q465 554 465 497Q465 416 409.0 367.0Q353 318 258 318ZM258 382Q317 382 352.5 413.0Q388 444 388 497Q388 550 352.5 581.0Q317 612 258 612Q197 612 162.5 581.0Q128 550 128 497Q128 444 163.5 413.0Q199 382 258 382ZM461 0Q389 0 311.0 12.5Q233 25 164.5 45.0Q96 65 51 86V156Q140 115 246.0 91.5Q352 68 461 68Q541 68 575 77Q535 82 506.5 120.5Q478 159 478 217Q478 297 534.5 346.5Q591 396 685 396Q780 396 836.0 347.0Q892 298 892 217Q892 111 792 56Q691 0 461 0ZM685 102Q746 102 780.5 133.5Q815 165 815 217Q815 269 781.0 300.5Q747 332 685 332Q624 332 589.5 300.5Q555 269 555 217Q555 165 590.0 133.5Q625 102 685 102Z\" transform=\"translate(1.784780 86.506540) scale(0.102259 -0.102259)\" fill=\"#000000\"/>",
  leo: "<path d=\"M619 -222Q553 -222 514.5 -180.0Q476 -138 476 -64Q476 -17 491.5 39.5Q507 96 536 163Q595 299 595 425Q595 493 572.0 542.5Q549 592 509.5 619.0Q470 646 419 646Q344 646 298.5 596.0Q253 546 253 459Q253 416 264 378Q311 372 347.0 345.0Q383 318 404.0 278.5Q425 239 425 193Q425 142 399.5 99.5Q374 57 332.0 31.5Q290 6 238 6Q187 6 144.5 31.5Q102 57 76.5 99.5Q51 142 51 193Q51 255 89.0 305.5Q127 356 188 373Q176 412 176 458Q176 532 207.0 589.5Q238 647 294.0 680.5Q350 714 424 714Q499 714 555.0 678.5Q611 643 641.5 579.0Q672 515 672 428Q672 384 666.5 338.5Q661 293 645.0 238.5Q629 184 599 112Q554 4 554 -63Q554 -103 575.0 -125.0Q596 -147 630 -147Q663 -147 688 -133L712 -198Q670 -222 619 -222ZM238 82Q268 82 293.5 97.0Q319 112 334.0 137.5Q349 163 349 193Q349 223 334.0 248.5Q319 274 293.5 289.0Q268 304 238 304Q209 304 183.5 288.5Q158 273 142.5 248.0Q127 223 127 193Q127 163 142.0 138.0Q157 113 182.5 97.5Q208 82 238 82Z\" transform=\"translate(14.947650 72.602564) scale(0.091880 -0.091880)\" fill=\"#000000\"/>",
  virgo: "<path d=\"M615 -207Q575 -175 557 -91Q479 -133 404 -145V-81Q479 -69 547 -29Q544 3 544 38V532Q544 568 536.0 604.5Q528 641 514 663Q500 651 480.0 624.5Q460 598 440.5 566.0Q421 534 406.5 505.5Q392 477 390 462V0H320V517Q320 554 313.0 591.0Q306 628 290 663Q276 651 256.0 624.5Q236 598 216.5 566.0Q197 534 182.5 505.5Q168 477 166 462V0H96V525Q96 596 51 714H104Q118 692 132.5 657.5Q147 623 160 575Q169 592 187.5 618.0Q206 644 227.0 670.5Q248 697 266 714H325Q343 688 359.5 647.5Q376 607 382 575Q391 593 410.0 618.5Q429 644 451.5 670.0Q474 696 492 714H551Q585 668 599.5 623.0Q614 578 614 528V445Q627 471 651.0 500.0Q675 529 695 545H753Q782 511 799.5 449.5Q817 388 817 313Q817 204 767.0 110.0Q717 16 621 -52Q628 -97 644.0 -134.5Q660 -172 690 -207ZM614 20Q678 76 712.5 151.5Q747 227 747 313Q747 428 715 494Q699 478 678.0 448.5Q657 419 639.5 388.5Q622 358 614 339Z\" transform=\"translate(9.474484 73.671010) scale(0.093377 -0.093377)\" fill=\"#000000\"/>",
  libra: "<path d=\"M51 233V303H317Q280 332 257.5 377.5Q235 423 235 467Q235 531 266.0 582.5Q297 634 350.5 665.0Q404 696 469 696Q534 696 587.0 665.0Q640 634 671.5 582.5Q703 531 703 467Q703 424 681.5 379.0Q660 334 621 303H887V233H516V310Q567 327 600.0 371.0Q633 415 633 467Q633 514 611.5 551.0Q590 588 553.0 609.5Q516 631 469 631Q422 631 385.0 609.0Q348 587 326.5 550.0Q305 513 305 467Q305 414 338.5 370.0Q372 326 422 310V233ZM51 0V70H886V0Z\" transform=\"translate(1.753589 85.799043) scale(0.102871 -0.102871)\" fill=\"#000000\"/>",
  scorpio: "<path d=\"M767 -191 786 -118H741Q668 -118 625.0 -88.0Q582 -58 563.0 6.5Q544 71 544 176V532Q544 568 536.0 604.5Q528 641 514 663Q500 651 480.0 624.5Q460 598 440.5 566.0Q421 534 406.5 505.5Q392 477 390 462V0H320V517Q320 554 313.0 591.0Q306 628 290 663Q276 651 256.0 624.5Q236 598 216.5 566.0Q197 534 182.5 505.5Q168 477 166 462V0H96V525Q96 596 51 714H104Q118 692 132.5 657.5Q147 623 160 575Q169 592 187.5 618.0Q206 644 227.0 670.5Q248 697 266 714H325Q343 688 359.5 647.5Q376 607 382 575Q391 593 410.0 618.5Q429 644 451.5 670.0Q474 696 492 714H551Q585 668 599.5 623.0Q614 578 614 528V176Q614 87 626.5 36.5Q639 -14 667.0 -35.0Q695 -56 741 -56H786L767 17L903 -87Z\" transform=\"translate(4.671823 74.849724) scale(0.095028 -0.095028)\" fill=\"#000000\"/>",
  ophiuchus: "<path d=\"M365 -10Q244 -10 182.0 62.5Q120 135 120 254V397Q92 391 65.0 377.5Q38 364 12 341V433Q38 456 65.0 468.5Q92 481 120 486V714H210V486Q257 480 297.0 465.5Q337 451 376 435Q411 421 446.0 407.5Q481 394 520 389V714H610V389Q638 395 665.0 408.5Q692 422 718 445V353Q692 330 665.0 317.5Q638 305 610 300V254Q610 135 548.0 62.5Q486 -10 365 -10ZM210 251Q210 165 249.0 117.5Q288 70 365 70Q442 70 481.0 117.5Q520 165 520 251V300Q473 306 433.0 320.5Q393 335 354 351Q319 365 284.0 378.5Q249 392 210 397Z\" transform=\"translate(6.643646 91.812155) scale(0.118785 -0.118785)\" fill=\"#000000\"/>",
  sagittarius: "<path d=\"M96 7 51 53 269 272 137 402 182 447 313 316 624 629H299V693H719L739 674V255H674V587L359 271L492 138L447 93L314 226Z\" transform=\"translate(0.625000 93.750000) scale(0.125000 -0.125000)\" fill=\"#000000\"/>",
  capricorn: "<path d=\"M325 -192V-137Q392 -137 444.5 -96.0Q497 -55 543 39Q517 79 508.0 130.0Q499 181 499 241V517Q499 564 488.0 595.0Q477 626 451 663Q437 650 418.0 618.0Q399 586 377.0 543.0Q355 500 334.5 451.5Q314 403 296.5 356.0Q279 309 269.0 270.5Q259 232 259 208V0H189V363Q189 426 186.0 471.0Q183 516 175 544Q160 600 129.5 625.0Q99 650 51 650V714Q156 714 205.5 641.5Q255 569 256 408V405Q265 441 285.0 489.0Q305 537 330.0 584.0Q355 631 377.5 666.5Q400 702 413 714H501Q519 693 534.5 661.5Q550 630 559.5 597.0Q569 564 569 535V244Q569 145 588 106Q630 165 671.0 187.5Q712 210 761 210Q831 210 873.0 174.5Q915 139 915 77Q915 8 868.5 -31.0Q822 -70 741 -70Q698 -70 663.5 -57.5Q629 -45 589 -12Q550 -97 480.0 -144.5Q410 -192 325 -192ZM741 -8Q792 -8 821.5 15.5Q851 39 851 77Q851 107 826.5 128.5Q802 150 762 150Q724 150 689.0 126.5Q654 103 620 49Q638 26 673.5 9.0Q709 -8 741 -8Z\" transform=\"translate(4.152318 74.774834) scale(0.094923 -0.094923)\" fill=\"#000000\"/>",
  aquarius: "<path d=\"M81 397 51 453 296 599 356 486 544 603 608 486 796 603 890 429 836 397 773 513 585 397 521 513 333 397 269 513ZM81 97 51 153 296 299 356 186 544 303 608 186 796 303 890 129 836 97 773 213 585 97 521 213 333 97 269 213Z\" transform=\"translate(1.772348 85.876043) scale(0.102503 -0.102503)\" fill=\"#000000\"/>",
  pisces: "<path d=\"M91 0Q220 174 230 341H51V405H230Q218 577 90 752H164Q294 595 304 405H511Q523 599 651 752H725Q595 579 585 405H764V341H585Q596 173 724 0H651Q520 153 511 341H304Q294 151 164 0Z\" transform=\"translate(3.397606 93.000000) scale(0.114362 -0.114362)\" fill=\"#000000\"/>",
};

function getWheelBorderSignFill(signKey) {
  const key = normalizeTrueSkySignKey(signKey);
  return key === "ophiuchus" ? "#FFFFFF" : "#000000";
}

function appendInlineTrueSkySignSvg(svgSelection, signKey, x, y, size, className = "", wheelSymbol = false, symbolFill = null) {
  const key = normalizeTrueSkySignKey(signKey);
  const markup = TRUE_SKY_SIGN_SVG_CONTENT[key];
  if (!markup) return null;

  const group = svgSelection
    .append("g")
    .attr("class", className)
    .attr("transform", `translate(${x - size / 2}, ${y - size / 2}) scale(${size / 100})`)
    .style("pointer-events", "none");

  group.html(markup);

  // Only the wheel-border sign glyphs get this special rule:
  // Ophiuchus stays white, while all other border signs stay black.
  // Planet-adjacent sign glyphs below planets still use their normal colors.
  const effectiveFill = wheelSymbol ? getWheelBorderSignFill(key) : symbolFill;
  if (effectiveFill) {
    group
      .selectAll("path, polygon, polyline, circle, ellipse, rect, line")
      .attr("fill", effectiveFill)
      .attr("stroke", "none")
      .attr("stroke-width", null)
      .attr("paint-order", null);
  }

  return group;
}

const TRUE_SKY_SIGN_ALIASES = {
  aries: "aries",
  ari: "aries",
  "áries": "aries",
  taurus: "taurus",
  touro: "taurus",
  tau: "taurus",
  gemini: "gemini",
  gêmeos: "gemini",
  gemeos: "gemini",
  gem: "gemini",
  cancer: "cancer",
  câncer: "cancer",
  can: "cancer",
  leo: "leo",
  leão: "leo",
  leao: "leo",
  virgo: "virgo",
  virgem: "virgo",
  libra: "libra",
  scorpio: "scorpio",
  escorpião: "scorpio",
  escorpiao: "scorpio",
  ophiuchus: "ophiuchus",
  ofiuco: "ophiuchus",
  serpentario: "ophiuchus",
  serpentário: "ophiuchus",
  sagittarius: "sagittarius",
  sagitario: "sagittarius",
  sagitário: "sagittarius",
  capricorn: "capricorn",
  capricornio: "capricorn",
  capricórnio: "capricorn",
  aquarius: "aquarius",
  aquario: "aquarius",
  aquário: "aquarius",
  pisces: "pisces",
  peixes: "pisces",
};

function normalizeTrueSkySignKey(signKey) {
  const key = String(signKey || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
  return TRUE_SKY_SIGN_ALIASES[key] || key;
}

function trueSkyLocalAssetPath(relativePath) {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  if (!clean) return "";
  return `./${clean}`;
}

function trueSkySignSvgPath(signKey, colorized = false) {
  const key = normalizeTrueSkySignKey(signKey);
  if (!key) return "";
  const cache = colorized ? colorizedSignImageCache : signImageCache;
  if (cache[key]) return cache[key];
  return trueSkyLocalAssetPath(`images/signs/${colorized ? "colorized/" : ""}${key}.svg`);
}

// Preload sign images
async function preloadSignImages() {
  const signs = [
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "ophiuchus",
    "capricorn",
    "aquarius",
    "pisces",
  ];

  await Promise.all(
    signs.flatMap((sign) => [
      // Default sign image
      (async () => {
        try {
          const res = await fetch(trueSkyLocalAssetPath(`images/signs/${sign}.svg`));
          const blob = await res.blob();
          const reader = new FileReader();
          const result = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          signImageCache[sign] = result;
        } catch {
          signImageCache[sign] = trueSkyLocalAssetPath(`images/signs/${sign}.svg`);
        }
      })(),

      // Colorized sign image
      (async () => {
        try {
          const res = await fetch(trueSkyLocalAssetPath(`images/signs/colorized/${sign}.svg`));
          const blob = await res.blob();
          const reader = new FileReader();
          const result = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          colorizedSignImageCache[sign] = result;
        } catch {
          colorizedSignImageCache[sign] = trueSkyLocalAssetPath(`images/signs/colorized/${sign}.svg`);
        }
      })(),
    ]),
  );
}

// Preload planet images
async function preloadPlanetImages() {
  const planets = [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
    "chiron",
    "northnode",
    "southnode",
    "ascendantsymbol",
    "midheaven",
    "descendant",
    "imumcoeli",
    "ceres",
    "vesta",
    "pallas",
    "juno",
    "lilith",
    "priapus",
    "partoffortune",
    "partofspirit",
    "vertex",
    "antivertex",
    "galacticcenter",
  ];

  await Promise.all(
    planets.map(async (planet) => {
      try {
        const res = await fetch(`/images/planets/${planet}.svg`);
        const blob = await res.blob();
        const reader = new FileReader();
        const result = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        planetImageCache[planet] = result;
      } catch {
        planetImageCache[planet] = `/images/planets/${planet}.svg`; // fallback
      }
    }),
  );
}

// Preload misc images
async function preloadMiscImages() {
  const retroSymbols = ["retrograde", "sd", "sr"];
  const aspectSymbols = [
    "opposition",
    "square",
    "trine",
    "sextile",
    "conjunction",
    "semisextile",
    "quincunx",
  ];

  await Promise.all([
    ...retroSymbols.map(async (filename) => {
      try {
        const res = await fetch(`/images/misc/${filename}.svg`);
        const blob = await res.blob();
        const reader = new FileReader();
        const result = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        miscImageCache[filename] = result;
      } catch {
        miscImageCache[filename] = `/images/misc/${filename}.svg`; // fallback
      }
    }),
    ...aspectSymbols.map(async (filename) => {
      try {
        const res = await fetch(`/images/aspects/${filename}.svg`);
        const blob = await res.blob();
        const reader = new FileReader();
        const result = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        miscImageCache[filename] = result;
      } catch {
        miscImageCache[filename] = `/images/aspects/${filename}.svg`; // fallback
      }
    }),
  ]);
}

// Tooltip planet placement descriptions
let planetSignDescriptions = {};
let planetHouseDescriptions = {};
let progressedPlanetSignDescriptions = {};
let progressedPlanetHouseDescriptions = {};
let transitPlanetSignDescriptions = {};
let transitPlanetHouseDescriptions = {};
let solarReturnPlanetSignDescriptions = {};
let solarReturnPlanetHouseDescriptions = {};
let lunarReturnPlanetSignDescriptions = {};
let lunarReturnPlanetHouseDescriptions = {};
let synastryPlanetSignDescriptions = {};
let synastryPlanetHouseDescriptions = {};
let compositePlanetSignDescriptions = {};
let compositePlanetHouseDescriptions = {};
let planetAspectDescriptions = {};
let graphPlanetRetroDescriptions = {};

const trueSkyDescriptionDataReady = Promise.all([
  fetch("/json/planetSignDescriptions.json").then((res) => res.json()),
  fetch("/json/planetHouseDescriptions.json").then((res) => res.json()),
  fetch("/json/progressedPlanetSignDescriptions.json").then((res) =>
    res.json(),
  ),
  fetch("/json/progressedPlanetHouseDescriptions.json").then((res) =>
    res.json(),
  ),
  fetch("/json/transitPlanetSignDescriptions.json").then((res) => res.json()),
  fetch("/json/transitPlanetHouseDescriptions.json").then((res) => res.json()),
  fetch("/json/solarReturnPlanetSignDescriptions.json").then((res) =>
    res.json(),
  ),
  fetch("/json/solarReturnPlanetHouseDescriptions.json").then((res) =>
    res.json(),
  ),
  fetch("/json/lunarReturnPlanetSignDescriptions.json").then((res) =>
    res.json(),
  ),
  fetch("/json/lunarReturnPlanetHouseDescriptions.json").then((res) =>
    res.json(),
  ),
  fetch("/json/synastryPlanetSignDescriptions.json").then((res) => res.json()),
  fetch("/json/synastryPlanetHouseDescriptions.json").then((res) => res.json()),
  fetch("/json/compositePlanetSignDescriptions.json").then((res) => res.json()),
  fetch("/json/compositePlanetHouseDescriptions.json").then((res) =>
    res.json(),
  ),
  fetch("/json/planetAspectDescriptions.json").then((res) => res.json()),
  fetch("/json/graphPlanetRetroDescriptions.json").then((res) => res.json()),
])
  .then(
    ([
      signs,
      houses,
      progressedSigns,
      progressedHouses,
      transitSigns,
      transitHouses,
      solarReturnSigns,
      solarReturnHouses,
      lunarReturnSigns,
      lunarReturnHouses,
      synastrySigns,
      synastryHouses,
      compositeSigns,
      compositeHouses,
      aspects,
      graphRetro,
    ]) => {
      planetSignDescriptions = signs;
      planetHouseDescriptions = houses;
      progressedPlanetSignDescriptions = progressedSigns;
      progressedPlanetHouseDescriptions = progressedHouses;
      transitPlanetSignDescriptions = transitSigns;
      transitPlanetHouseDescriptions = transitHouses;
      solarReturnPlanetSignDescriptions = solarReturnSigns;
      solarReturnPlanetHouseDescriptions = solarReturnHouses;
      lunarReturnPlanetSignDescriptions = lunarReturnSigns;
      lunarReturnPlanetHouseDescriptions = lunarReturnHouses;
      synastryPlanetSignDescriptions = synastrySigns;
      synastryPlanetHouseDescriptions = synastryHouses;
      compositePlanetSignDescriptions = compositeSigns;
      compositePlanetHouseDescriptions = compositeHouses;
      planetAspectDescriptions = aspects;
      graphPlanetRetroDescriptions = graphRetro;
    },
  )
  .catch((err) => {
    console.error("Error loading planet description files.");
  });

// Helper function to calculate degrees for planet popups
function calculatePlanetDegrees(position, zodiacSystem) {
  const degreeInSign = getDegreeInSign(position, zodiacSystem);
  const hour = Math.floor(degreeInSign);
  const m = Math.floor((degreeInSign - hour) * 60);
  const minute = m < 10 ? "0" + m : m;

  return { hour, minute };
}



function escapePositionPanelHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeAssetSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function formatDms(value, maxDegrees = 360) {
  let n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (maxDegrees === 360) n = normalizeDegrees360(n);

  let degree = Math.floor(n);
  let minutesFloat = (n - degree) * 60;
  let minute = Math.floor(minutesFloat);
  let second = Math.round((minutesFloat - minute) * 60);

  if (second >= 60) {
    second = 0;
    minute += 1;
  }
  if (minute >= 60) {
    minute = 0;
    degree += 1;
  }
  if (maxDegrees === 360 && degree >= 360) degree = 0;

  return `${degree}° ${String(minute).padStart(2, "0")}′ ${String(second).padStart(2, "0")}″`;
}

function formatAbsoluteDegrees(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return formatDms(Number(value), 360);
}

function getDegreeInSign(position, zodiacSystem) {
  const normalizedPosition = normalizeDegrees360(Number(position));
  if (!Number.isFinite(normalizedPosition)) return NaN;

  if (!isUnequalZodiacSystem(zodiacSystem)) {
    return normalizedPosition % 30;
  }

  const midpointBoundaries = getUnequalZodiacBoundaries(zodiacSystem);
  if (!Array.isArray(midpointBoundaries) || !midpointBoundaries.length) return normalizedPosition % 30;

  let signStart = midpointBoundaries[0].boundary;
  for (let i = 0; i < midpointBoundaries.length; i++) {
    const current = midpointBoundaries[i];
    const next = midpointBoundaries[i + 1];
    if (!next || (normalizedPosition >= current.boundary && normalizedPosition < next.boundary)) {
      signStart = current.boundary;
      break;
    }
  }
  if (normalizedPosition < midpointBoundaries[0].boundary) {
    signStart = midpointBoundaries[midpointBoundaries.length - 1].boundary;
  }

  let degreeInSign = normalizedPosition - signStart;
  if (degreeInSign < 0) degreeInSign += 360;
  return degreeInSign;
}

function formatSignDegrees(item, zodiacSystem) {
  if (!item || !Number.isFinite(Number(item.position))) return "—";
  return formatDms(getDegreeInSign(Number(item.position), zodiacSystem), 999);
}

function formatCompactSignPosition(item, sign, zodiacSystem) {
  const degreeText = formatSignDegrees(item, zodiacSystem);
  return `${degreeText} ${sign || ""}`.trim();
}

function positionPanelIcon(kind, name) {
  const slug = normalizeAssetSlug(name);
  if (!slug) return "";
  const folder = kind === "sign" ? "signs" : "planets";
  return `<img class="positions-symbol" src="/images/${folder}/${slug}.svg" alt="${escapePositionPanelHtml(name)}" onerror="this.style.display='none'">`;
}

function renderChartPositionPanel(form, data, natalData, zodiacSystem, houseCusps) {
  if (typeof document === "undefined" || !Array.isArray(data)) return;

  const sectionByForm = {
    natal: "showNatal",
    triwheel: "showTriwheel",
    return: "showReturn",
    synastry: "showSynastry",
    composite: "showComposite",
  };
  const section = document.getElementById(sectionByForm[form] || "showNatal");
  if (!section) return;

  const panelId = `${form || "natal"}-positions-panel`;

  // Keep only one degree/positions table in the DOM.
  // This prevents old tables from previous chart modes from stacking up.
  document.querySelectorAll(".chart-positions-panel").forEach((existingPanel) => {
    if (existingPanel.id !== panelId) existingPanel.remove();
  });

  let panel = document.getElementById(panelId);
  if (!panel) {
    panel = document.createElement("section");
    panel.id = panelId;
    panel.className = "chart-positions-panel";
    const formEl = section.querySelector("form.form");
    if (formEl && formEl.parentNode) formEl.insertAdjacentElement("afterend", panel);
    else section.appendChild(panel);
  }

  const rows = [];
  const planetRows = [];
  const houseRows = [];

  data
    .filter((item) => item && item !== data[0] && Number.isFinite(Number(item.position)) && !/^House\s+\d+$/i.test(String(item.name || "")))
    .forEach((item) => {
      const name = item.isCustomPoint && item.asteroidName ? item.asteroidName : item.name;
      const sign = item.sign || getSignFromPosition(Number(item.position), zodiacSystem);
      const house = item.houseNatal || item.house || "—";
      const retro = item.retrograde || item.retroIcon ? `<span class="positions-retro">R</span>` : "";
      const row = `<tr>
        <td><span class="positions-pill positions-pill-object">Objeto</span></td>
        <td><span class="positions-object">${positionPanelIcon("planet", item.name)}<span>${escapePositionPanelHtml(name)}${retro}</span></span></td>
        <td><span class="positions-sign">${positionPanelIcon("sign", sign)}<span>${escapePositionPanelHtml(sign || "—")}</span></span></td>
        <td class="positions-degree-main">${escapePositionPanelHtml(formatSignDegrees(item, zodiacSystem))}</td>
        <td>${escapePositionPanelHtml(house)}</td>
        <td>${escapePositionPanelHtml(formatAbsoluteDegrees(item.position))}</td>
        <td class="positions-full-position">${escapePositionPanelHtml(formatCompactSignPosition(item, sign, zodiacSystem))}</td>
      </tr>`;
      planetRows.push(row);
      rows.push(row);
    });

  (Array.isArray(houseCusps) ? houseCusps : [])
    .slice()
    .sort((a, b) => Number(a.house || 0) - Number(b.house || 0))
    .forEach((house) => {
      const sign = house.sign || getSignFromPosition(Number(house.position), zodiacSystem);
      const houseNumber = house.house || String(house.name || "").replace(/\D/g, "");
      const row = `<tr>
        <td><span class="positions-pill positions-pill-house">Casa</span></td>
        <td><span class="positions-object positions-house-name"><span>Casa ${escapePositionPanelHtml(houseNumber || "—")}</span></span></td>
        <td><span class="positions-sign">${positionPanelIcon("sign", sign)}<span>${escapePositionPanelHtml(sign || "—")}</span></span></td>
        <td class="positions-degree-main">${escapePositionPanelHtml(formatSignDegrees(house, zodiacSystem))}</td>
        <td>${escapePositionPanelHtml(houseNumber || "—")}</td>
        <td>${escapePositionPanelHtml(formatAbsoluteDegrees(house.position))}</td>
        <td class="positions-full-position">${escapePositionPanelHtml(formatCompactSignPosition(house, sign, zodiacSystem))}</td>
      </tr>`;
      houseRows.push(row);
      rows.push(row);
    });

  const titleName = natalData?.name || data?.[0]?.name || "Mapa";
  const systemLine = [formatZodiacSystemLabel(natalData?.zodiacSystem || zodiacSystem), natalData?.houseSystem].filter(Boolean).join(" • ");

  panel.innerHTML = `
    <div class="positions-header">
      <div>
        <p class="positions-kicker">Tabela de graus</p>
        <h2>Graus, signos, casas e longitude</h2>
        <p>${escapePositionPanelHtml(titleName)}${systemLine ? ` — ${escapePositionPanelHtml(systemLine)}` : ""}</p>
      </div>
      <div class="positions-summary">
        <span>${planetRows.length} objetos</span>
        <span>${houseRows.length} casas</span>
      </div>
    </div>
    <article class="positions-card positions-card-single">
      <div class="positions-table-wrap">
        <table class="positions-table">
          <thead><tr><th>Tipo</th><th>Objeto/Casa</th><th>Signo</th><th>Grau no signo</th><th>Casa</th><th>Longitude 360°</th><th>Posição completa</th></tr></thead>
          <tbody>${rows.join("") || `<tr><td colspan="7" class="positions-empty">Nenhuma posição disponível.</td></tr>`}</tbody>
        </table>
      </div>
    </article>`;
}
// Main function
export function sharedNatal(
  svgContainer,
  signInnerCustom = false,
  houseOuterCustom = false,
  houseInnerCustom = false,
  houseNumberCustom = false,
  planetCircleCustom = false,
  innerWheel = false,
  middleWheel = false,
  innerPlanet = false,
  centerPlanet = false,
  outerPlanet = false,
  removeHouseTicks = false,
  form = "natal",
) {
  // Define initial dimensions for the SVG viewBox
  const width = 1000;
  const height = 1000;
  const minDimension = Math.min(width, height); // Get the smaller dimension

  // Create an SVG that scales responsively
  const svg = svgContainer
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%")
    .attr("height", "100%");

  // Planet symbol tooltip
  const tooltip = d3.select("#tooltip");

  function showPlanetDetails(planet, chartType = "natal") {
    setTimeout(() => {
      tooltip.html("");
      const tp = tooltip
        .append("div")
        .attr("class", "planet-tooltip-instance")
        .style("pointer-events", "auto");
      const c = tp.append("div").attr("class", "tooltip-content");
      let key = planet.name.toLowerCase(),
        name = planet.name;
      // Handle custom points - use asteroid name for display only, keep key as-is to avoid matching built-in planet descriptions
      if (planet.isCustomPoint && planet.asteroidName) {
        name = planet.asteroidName;
      }
      if (key === "ascendant symbol") {
        key = "ascendant";
        name = "Ascendant";
      }
      if (key === "descendant symbol") {
        key = "descendant";
        name = "Descendant";
      }

      // Select appropriate description set based on chart type
      let signDescriptions = planetSignDescriptions;
      let houseDescriptions = planetHouseDescriptions;
      if (chartType === "progressed") {
        signDescriptions = progressedPlanetSignDescriptions;
        houseDescriptions = progressedPlanetHouseDescriptions;
      } else if (chartType === "transit") {
        signDescriptions = transitPlanetSignDescriptions;
        houseDescriptions = transitPlanetHouseDescriptions;
      } else if (chartType === "solar_return") {
        signDescriptions = solarReturnPlanetSignDescriptions;
        houseDescriptions = solarReturnPlanetHouseDescriptions;
      } else if (chartType === "lunar_return") {
        signDescriptions = lunarReturnPlanetSignDescriptions;
        houseDescriptions = lunarReturnPlanetHouseDescriptions;
      } else if (chartType === "synastry") {
        signDescriptions = synastryPlanetSignDescriptions;
        houseDescriptions = synastryPlanetHouseDescriptions;
      } else if (chartType === "composite") {
        signDescriptions = compositePlanetSignDescriptions;
        houseDescriptions = compositePlanetHouseDescriptions;
      } else if (chartType === "composite") {
        signDescriptions = compositePlanetSignDescriptions;
        houseDescriptions = compositePlanetHouseDescriptions;
      }

      const signDesc =
        (signDescriptions[key] || {})[planet.sign.toLowerCase()] ||
        "No description available";
      let houseHTML = "";
      if (
        !["ascendant", "descendant", "midheaven", "imum coeli"].includes(key)
      ) {
        let houseToUse;

        // For composite charts, calculate house position from composite's house cusps
        // to show midpoint houses, not chart 1's houses
        if (currentChartForm === "composite" && currentChartHouseCusps) {
          houseToUse = calculateHousePosition(
            planet.position,
            currentChartHouseCusps,
          );
        } else {
          // For other charts, use houseNatal (set for synastry) or house (from server)
          houseToUse = planet.houseNatal || planet.house;
        }

        const hd =
          ((houseToUse && houseDescriptions[key]) || {})[houseToUse] ||
          "House information not available";
        houseHTML = `<p style="margin:5px 0 0 0;"><strong>${name} in House ${
          houseToUse || "N/A"
        }:</strong> ${hd}</p>`;
      }
      const isMobile = window.innerWidth < 600,
        fs = isMobile ? "16px" : "20px";

      let planetIcon;
      if (planet.isCustomPoint && planet.displayLabel) {
        // For custom points, show the label and asteroid name
        planetIcon = `<span style="font-weight:bold;font-size:20px;vertical-align:middle;margin-right:6px">${planet.displayLabel}</span>`;
      } else {
        planetIcon = `<img src="/images/planets/${planet.name
          .toLowerCase()
          .replace(
            /[\s-]+/g,
            "",
          )}.svg" width="28" height="28" style="vertical-align:middle;margin:-6px 4px 0 -4px"/>`;
      }

      const signIcon = `<img src="/images/signs/${planet.sign
        .toLowerCase()
        .replace(
          /\s+/g,
          "",
        )}.svg" width="18" height="18" style="vertical-align:middle;margin:-2px 4px 0 2px"/>`;

      const retroIcon = planet.retroIcon
        ? `<img src="${planet.retroIcon}" width="18" height="18" style="vertical-align:middle;margin:-3px 0 0 0"/>`
        : "";

      // Skip sign description for Galactic Center (doesn't change signs)
      const signHTML =
        key === "galactic center"
          ? ""
          : `<p style="margin:5px 0 0 0;"><strong>${name} in ${planet.sign}:</strong> ${signDesc}</p>`;

      c
        .append("div")
        .attr("class", "planet-details")
        .attr(
          "style",
          `white-space:normal;word-wrap:break-word;font-size:${fs};max-width:90vw;overflow-wrap:break-word;`,
        ).html(`
         <h3 style="margin:0 0 5px 0;">${planetIcon}${name}</h3>
         <p style="margin:0;"><strong>${planet.hour}°${signIcon}${planet.minute}'</strong>${retroIcon}</p>
         ${signHTML}
         ${houseHTML}
       `);

      tooltip.style("opacity", 0.95);
      if (isMobile)
        tooltip
          .style("top", "25%")
          .style("left", "0%")
          .style("transform", "translate(0,0)");

      function close(e) {
        if (!tooltip.node().contains(e.target)) {
          tooltip.style("opacity", 0);
          document.removeEventListener("click", close, true);
        }
      }
      document.addEventListener("click", close, true);
    }, 100);
  }

  // Helper function to calculate which house a planet position falls into
  // Used for synastry charts to determine Chart 2 planet positions in Chart 1's houses
  // Make calculateHousePosition globally accessible for report generation
  function calculateHousePosition(planetPosition, houseCusps) {
    if (!houseCusps || houseCusps.length === 0) return null;

    // Normalize planet position to 0-360
    let normalizedPosition = planetPosition % 360;
    if (normalizedPosition < 0) normalizedPosition += 360;

    // Find which house the planet falls into
    for (let i = 0; i < houseCusps.length; i++) {
      const currentCusp = houseCusps[i].position;
      const nextCusp = houseCusps[(i + 1) % houseCusps.length].position;

      // Handle wraparound at 0/360 degrees
      if (nextCusp > currentCusp) {
        // Normal case: house doesn't cross 0°
        if (
          normalizedPosition >= currentCusp &&
          normalizedPosition < nextCusp
        ) {
          return i + 1; // House numbers are 1-indexed
        }
      } else {
        // Wraparound case: house crosses 0°
        if (
          normalizedPosition >= currentCusp ||
          normalizedPosition < nextCusp
        ) {
          return i + 1;
        }
      }
    }

    return null; // Shouldn't happen, but fallback
  }

  // Make it globally accessible
  window.calculateHousePosition = calculateHousePosition;
  window.calculatePlanetDegrees = calculatePlanetDegrees;

  // Store house cusps globally for synastry calculations
  let chart1HouseCusps = null;

  // Store current chart context for planet details
  let currentChartForm = null;
  let currentChartHouseCusps = null;

  // Dimensions
  const signOuter = 2.1;
  const signInner = signInnerCustom || 2.33;
  const houseOuter = houseOuterCustom || 4;
  const houseInner = houseInnerCustom || 4.5;
  const planetCircle = planetCircleCustom || 2.6;

  // Circles
  const signOuterRadius = minDimension / signOuter;
  const signInnerRadius = minDimension / signInner;
  const houseOuterRadius = minDimension / houseOuter;
  const houseInnerRadius = minDimension / houseInner;
  const planetCircleRadius = minDimension / planetCircle;

  // Zodiac signs
  const signs = [
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
  ];

  // Planet colors
  const planetColors = {
    sun: "#b4af00",
    moon: "#0053bd",
    mercury: "#c5c5c5",
    venus: "#008401",
    mars: "#b90000",
    jupiter: "#ff5e00",
    saturn: "#8B4513",
    uranus: "#00a2b5",
    neptune: "#0007b8",
    pluto: "#5300c7",
    chiron: "#979797",
    "north node": "#353535",
    "south node": "#353535",
    "ascendant symbol": "#000000",
    midheaven: "#000000",
    descendant: "#000000",
    "imum coeli": "#000000",
    ceres: "#979797",
    vesta: "#979797",
    pallas: "#979797",
    juno: "#979797",
    lilith: "#000000",
    priapus: "#000000",
    "part of fortune": "#000000",
    "part of spirit": "#000000",
    vertex: "#000000",
    "anti-vertex": "#000000",
    "galactic center": "#000000",
  };

  // Sign colors
  const signColors = {
    aries: "#e15947",
    taurus: "#d58f3b",
    gemini: "#c9dd47",
    cancer: "#a5c16f",
    leo: "#33b278",
    virgo: "#44c1a8",
    libra: "#33b7bb",
    scorpio: "#3388c7",
    ophiuchus: "#353535",
    sagittarius: "#7a33d0",
    capricorn: "#a14cd3",
    aquarius: "#cf49cc",
    pisces: "#c16195",
  };

  // House colors
  const houseColors = [
    "#e15947",
    "#d58f3b",
    "#c9dd47",
    "#a5c16f",
    "#33b278",
    "#44c1a8",
    "#33b7bb",
    "#3388c7",
    "#7a33d0",
    "#a14cd3",
    "#cf49cc",
    "#c16195",
  ];

  //Sizes
  const signSizes = 28;
  const planetSizes = 48;
  const aspectSymbolSize = 20;

  const aspectColors = {
    Conjunction: "#666666",
    Opposition: "#d71920",
    Square: "#d71920",
    Trine: "#1f4ed8",
    Sextile: "#1f4ed8",
    Semisextile: "#8b5fbf",
    Quincunx: "#4b8f45",
  };

  const aspectGlyphs = {
    conjunction: "☌",
    opposition: "☍",
    square: "□",
    trine: "△",
    sextile: "✶",
    semisextile: "⚺",
    quincunx: "⚻",
  };

  const getAspectColor = (type) => aspectColors[type] || "gray";
  const getAspectKey = (type) => String(type || "").toLowerCase().replace(/[\s-]+/g, "");

  const drawAspectSymbolAtMidpoint = (svgTarget, midX, midY, aspectType, cssClass, color, classPrefix = "") => {
    const aspectKey = getAspectKey(aspectType);
    const aspectSymbol = miscImageCache[aspectKey] || `/images/aspects/${aspectKey}.svg`;

    // Original MTZ-style visual: only the small aspect glyph in the middle of the line,
    // no white circular badge and no altered background.
    const img = svgTarget
      .append("image")
      .attr("href", aspectSymbol)
      .attr("xlink:href", aspectSymbol)
      .attr("x", midX - aspectSymbolSize / 2)
      .attr("y", midY - aspectSymbolSize / 2)
      .attr("width", aspectSymbolSize)
      .attr("height", aspectSymbolSize)
      .attr("class", `${classPrefix ? `${classPrefix} ` : ""}aspect-symbol ${cssClass}`.trim())
      .style("pointer-events", "none")
      .style("opacity", 0.9);

    img.on("error", function () {
      d3.select(this).remove();
      svgTarget
        .append("text")
        .attr("x", midX)
        .attr("y", midY)
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .attr("class", `${classPrefix ? `${classPrefix} ` : ""}aspect-symbol-text ${cssClass}`.trim())
        .style("font-size", `${aspectSymbolSize}px`)
        .style("font-weight", "normal")
        .style("fill", color)
        .style("pointer-events", "none")
        .text(aspectGlyphs[aspectKey] || String(aspectType || "?").charAt(0));
    });
  };
  const findCrossAspect = (fromPlanet, toPlanet, aspectDefs) => {
    if (!Number.isFinite(fromPlanet?.position) || !Number.isFinite(toPlanet?.position)) return null;
    const diff = Math.abs(normalizeDegrees360(fromPlanet.position) - normalizeDegrees360(toPlanet.position));
    const angle = diff > 180 ? 360 - diff : diff;

    for (const asp of aspectDefs) {
      const orb = Math.abs(angle - asp.deg);
      if (orb <= asp.orb) {
        let raw = normalizeDegrees360(toPlanet.position) - normalizeDegrees360(fromPlanet.position);
        if (raw > 180) raw -= 360;
        if (raw < -180) raw += 360;
        const speedFrom = Number(fromPlanet.speed ?? 0);
        const speedTo = Number(toPlanet.speed ?? 0);
        const deriv = Math.sign(raw || 1) * (speedTo - speedFrom);
        const applying = (angle - asp.deg) * deriv < 0;
        return {
          planet: toPlanet.name,
          type: asp.type[0].toUpperCase() + asp.type.slice(1),
          orb,
          status: applying ? "applying" : "separating",
        };
      }
    }
    return null;
  };

  const getVisibleCrossAspectDefs = (selectedAspectNames = undefined, customOrbs = {}) => {
    const selected = Array.isArray(selectedAspectNames)
      ? new Set(selectedAspectNames.map((name) => normalizeAspectSettingName(name)).filter(Boolean))
      : null;
    const aspectInputsExist = !!document.querySelector('#aspect-settings input[name="aspects"]');
    return getAspectMasterFromSettings()
      .filter((asp) => {
        const key = normalizeAspectSettingName(asp.type);
        if (selected && selected.size) return selected.has(key);
        // If the settings panel yields no checked boxes (for example after a
        // hidden/partial settings load), keep the wheel usable by falling back
        // to all default aspect types instead of drawing none.
        return true;
      })
      .map((asp) => {
        const key = normalizeAspectSettingName(asp.type);
        return { ...asp, orb: Number(customOrbs?.[key]) || asp.orb };
      });
  };

  // Global ascendant position
  let ascendantPosition = null;

  // Natal calculate button
  let formIdToUse;

  switch (form) {
    case "return":
      formIdToUse = "returnForm";
      break;

    case "triwheel":
      formIdToUse = "triwheelForm";
      break;

    case "synastry":
      formIdToUse = "synastryForm";
      break;

    case "composite":
      formIdToUse = "synastryForm";
      break;

    case "compositeBlank":
      formIdToUse = "natalForm";
      break;

    default:
      formIdToUse = "natalForm";
  }
  document.getElementById(formIdToUse).addEventListener("submit", function (e) {
    e.preventDefault(); // Prevent the default form submission behavior (no page reload)

    // Show the loading overlay immediately
    if (form === "natal" || form === "return") {
      document.getElementById("loading-overlay").style.display = "block";
    }

    const formData = new FormData(this); // Get the form data
    let formDataObj = Object.fromEntries(formData); // Convert form data to an object
    const isBaseOnlySynastry = form === "synastry" && this.dataset.baseOnly === "true";

    // Synastry is a biwheel: the inner/base wheel must always be the most recent
    // Main/Natal calculation. The fields inside #synastryForm are Person 2 only.
    // If this first submit listener uses those fields as the base, Person 2 is
    // drawn twice and the first person's houses/aspects disappear or race with
    // the outer-wheel calculation.
    if (form === "synastry") {
      let storedNatalData = null;
      try {
        storedNatalData = JSON.parse(localStorage.getItem("natalData") || "null");
      } catch (_) {
        storedNatalData = null;
      }
      const hasStoredNatal =
        storedNatalData && storedNatalData.day && storedNatalData.month && storedNatalData.year;

      if (hasStoredNatal) {
        formDataObj = {
          ...storedNatalData,
          name: storedNatalData.name || "Person 1",
          hour: storedNatalData.hourString ?? storedNatalData.hour,
          minute: storedNatalData.minuteString ?? storedNatalData.minute,
          formType: "chart",
        };
      } else {
        d3.select("#synastry-chart").selectAll("*").remove();
        window.natalPlanets = [];
        window.person1Planets = [];
        window.chart1HouseCusps = [];

        if (!isBaseOnlySynastry) {
          const errorContainer = document.querySelector("#synastryForm .errorMessageSynastry");
          showTemporaryError(
            errorContainer,
            "Calculate the main chart first, then calculate the synastry wheel.",
          );
        }
        document.getElementById("loading-overlay").style.display = "none";
        return;
      }
    }

    // Add return chart location to determine if relocated
    formDataObj.preservedNatalLocation =
      document.getElementById("natalLocation")?.value;
    formDataObj.returnLocation =
      document.getElementById("returnLocation")?.value;
    formDataObj.form = form;

    // Retrieve selections from settings page
    const selectedPlanets = Array.from(
      document.querySelectorAll(
        '#planet-settings input[name="planet"]:checked',
      ),
    ).map((checkbox) => checkbox.value);

    const selectedPlanetsAspects = Array.from(
      document.querySelectorAll(
        '#planet-settings input[name="planetAspects"]:checked',
      ),
    ).map((checkbox) => checkbox.value);

    const selectedDegrees = document.querySelector(
      '.degree-settings input[name="degrees"]',
    ).checked;

    const trueNodes = document.querySelector(
      '.degree-settings input[name="trueNodes"]',
    ).checked;

    const trueLilith = document.querySelector(
      '.degree-settings input[name="trueLilith"]',
    ).checked;

    const draconic = document.querySelector(
      '.degree-settings input[name="draconic"]',
    ).checked;

    const fixedStars = document.querySelector(
      'input[name="fixedStars"]',
    ).checked;

    const fixedStarsMagnitude = parseFloat(
      document.querySelector('select[name="fixedStarsMagnitude"]').value,
    );

    const fixedStarsLatitude = parseFloat(
      document.querySelector('select[name="fixedStarsLatitude"]').value,
    );

    const selectedAspects = Array.from(
      document.querySelectorAll(
        '#aspect-settings input[name="aspects"]:checked',
      ),
    ).map((checkbox) => checkbox.value);

    const aspectOrbs = {};
    document
      .querySelectorAll("#aspect-settings select.aspect-orb") // ← existing class
      .forEach((sel) => {
        const key = String(sel.dataset.aspect || "").toLowerCase();
        aspectOrbs[key] = +sel.value;
      });
    formDataObj.aspectOrbs = aspectOrbs;

    const selectedZodiacSystem = document.querySelector(
      '#system-settings select[name="zodiacSystem"]',
    ).value;

    const selectedAyanamsaSystem = document.querySelector(
      '#system-settings select[name="ayanamsaSystem"]',
    )?.value || "Tropical";

    const customAyanamsa = Number(
      document.querySelector('#system-settings input[name="customAyanamsa"]')?.value ?? 0,
    );

    const selectedHouseSystem = document.querySelector(
      '#system-settings select[name="houseSystem"]',
    ).value;

    const selectedCoordinateSystem = document.querySelector(
      '#system-settings select[name="coordinateSystem"]',
    ).value;

    const ascendantOverride =
      document.getElementById("ascendantOverride").value;

    // Include selected planets in the request
    formDataObj.selectedPlanets = selectedPlanets;
    formDataObj.selectedPlanetsAspects = selectedPlanetsAspects;
    formDataObj.selectedAspects = selectedAspects;
    formDataObj.selectedZodiacSystem = selectedZodiacSystem;
    formDataObj.selectedAyanamsaSystem = selectedAyanamsaSystem;
    formDataObj.customAyanamsa = customAyanamsa;
    formDataObj.selectedHouseSystem = selectedHouseSystem;
    formDataObj.selectedCoordinateSystem = selectedCoordinateSystem;
    formDataObj.ascendantOverride = ascendantOverride;
    formDataObj.trueNodes = trueNodes;
    formDataObj.trueLilith = trueLilith;
    formDataObj.draconic = draconic;
    formDataObj.fixedStars = fixedStars;
    formDataObj.fixedStarsMagnitude = fixedStarsMagnitude;
    formDataObj.fixedStarsLatitude = fixedStarsLatitude;

    // Include custom points if the global is defined (from saveLoadSettings.js)
    if (
      typeof activeCustomPoints !== "undefined" &&
      activeCustomPoints.length > 0
    ) {
      formDataObj.customPoints = activeCustomPoints
        .filter((p) => p.display)
        .map((p) => ({
          num: p.num,
          name: p.name,
          display: p.display,
          aspect: p.aspect,
        }));
    }

    function renderChart(data) {
      // Store natal data in localStorage
      const natalMeta = data[0];
      const natalData = {
        ...natalMeta,
        selectedPlanets,
        selectedPlanetsAspects:
          typeof selectedPlanetsAspects !== "undefined" && Array.isArray(selectedPlanetsAspects)
            ? selectedPlanetsAspects
            : getSelectedPlanetsAspectsFallback(formDataObj),
        selectedAspects,
        zodiacSystem: selectedZodiacSystem,
        ayanamsaSystem: selectedAyanamsaSystem,
        customAyanamsa,
        houseSystem: selectedHouseSystem,
        coordinateSystem: selectedCoordinateSystem,
        ascendantOverride,
        trueNodes,
        trueLilith,
        draconic,
      };

      // Array of month names
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

      // Convert numeric month to spelled-out month for use on forms
      if (natalData.month && !isNaN(natalData.month)) {
        natalData.month = monthNames[natalData.month - 1]; // Convert numeric month to spelled-out
      }

      // Render triwheel & synastry in parallel
      if (form === "natal") {
        localStorage.setItem("natalData", JSON.stringify(natalData));
        // Dispatch event to signal natal chart calculation is complete (used by graph)
        document.dispatchEvent(new CustomEvent("natalChartComplete"));
        document.dispatchEvent(new CustomEvent("mainChartBaseUpdated"));

        // Do not auto-submit the hidden triwheel form after a main Natal calculation.
        // That background render uses triwheel-specific radii and can overwrite/overlay
        // the visible wheel after clicking Calculate. The triwheel page recalculates
        // itself when the user opens/uses it, so keeping this disabled preserves the
        // normal natal wheel geometry.

        // If synastry data exists, also trigger composite recalculation
        if (window.synastryData && window.synastryData.length > 0) {
          // Trigger synastry form which will then calculate composite
          const synastryForm = document.getElementById("synastryForm");
          if (synastryForm) {
            setTimeout(() => {
              synastryForm.requestSubmit();
            }, 100);
          }
        }
      }

      // Clear error message - check which page is visible
      const settingsVisible =
        document.getElementById("showSettings") &&
        document.getElementById("showSettings").style.display !== "none";

      if (settingsVisible) {
        const settingsError = document.querySelector(
          "#showSettings .errorMessage",
        );
        if (settingsError) settingsError.textContent = "";
      } else {
        // Clear natal or return form error
        const natalError = document.querySelector("#natalForm .errorMessage");
        const returnError = document.querySelector("#returnForm .errorMessage");
        if (natalError) natalError.textContent = "";
        if (returnError) returnError.textContent = "";
      }

      // Remove every previously-rendered artifact before drawing a new wheel.
      // For the main natal wheel we clear the SVG completely; this prevents stale
      // triwheel-radius house lines/ticks from surviving after Calculate. Other
      // chart types keep the narrower class-based cleanup because they can have
      // multiple layers that are updated independently.
      if (form === "natal") {
        svg.selectAll("*").remove();
      } else {
        svg
          .selectAll(
            ".natal,.progressions,.transits,.transits-middle,.aspect-line,.aspect-symbol,.aspect-symbol-bg,.aspect-symbol-text,.aspect-hotspot,.aspectarian-hotspot,circle[fill='transparent']",
          )
          .remove();
      }

      // Reset the Graph Section for natal calculations (skip if graph is running)
      if (form === "natal" && !window._graphNeedsOverlay) {
        const graphContainer = document.getElementById("graph");
        if (graphContainer) {
          graphContainer.innerHTML = "";
        }
      }

      // Extract Ascendant position
      const ascendant = data.find((item) => item.name === "Ascendant" || item.name === "Ascendant Symbol");
      ascendantPosition = ascendant ? ascendant.position : null;

      // Birth details
      svg.selectAll(".birth-details").remove();

      if (form === "composite") {
        // Dual-column layout for composite charts
        const maxNatalDetailsLength = 38; // Maximum characters for natal details lines
        const person1Data = window.natalData?.[0] || {};
        const person2Data = window.synastryData?.[0] || {};

        // Convert numeric months to month names
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

        if (person1Data.month && !isNaN(person1Data.month)) {
          person1Data.month = monthNames[person1Data.month - 1];
        }
        if (person2Data.month && !isNaN(person2Data.month)) {
          person2Data.month = monthNames[person2Data.month - 1];
        }

        // Left column (Person 1)
        const person1Details = [
          `${person1Data.name || ""}`.substring(0, maxNatalDetailsLength),
          `${person1Data.day || ""} ${person1Data.month || ""} ${
            person1Data.year || ""
          } ${person1Data.hourString || ""}:${
            person1Data.minuteString || ""
          } (${formatUtcOffsetForDisplay(person1Data.utcOffset, person1Data.timezone)})`.substring(0, maxNatalDetailsLength),
          `${(person1Data.location || "").split(":")[0] || ""}`.substring(
            0,
            maxNatalDetailsLength,
          ),
          `${person1Data.lat || ""}, ${person1Data.long || ""}`.substring(
            0,
            maxNatalDetailsLength,
          ),
        ];

        svg
          .append("g")
          .attr("class", "birth-details birth-details-left")
          .attr("transform", `translate(0, -64)`)
          .selectAll("text")
          .data(person1Details)
          .enter()
          .append("text")
          .attr("y", (d, i) => i * 34)
          .attr("font-family", "Segoe UI, sans-serif")
          .attr("font-size", "28px")
          .attr("fill", "#222")
          .attr("font-weight", "normal")
          .text((d) => d);

        // Right column (Person 2)
        const person2Details = [
          `${person2Data.name || ""}`.substring(0, maxNatalDetailsLength),
          `${person2Data.day || ""} ${person2Data.month || ""} ${
            person2Data.year || ""
          } ${person2Data.hourString || ""}:${
            person2Data.minuteString || ""
          } (${formatUtcOffsetForDisplay(person2Data.utcOffset, person2Data.timezone)})`.substring(0, maxNatalDetailsLength),
          `${(person2Data.location || "").split(":")[0] || ""}`.substring(
            0,
            maxNatalDetailsLength,
          ),
          `${person2Data.lat || ""}, ${person2Data.long || ""}`.substring(
            0,
            maxNatalDetailsLength,
          ),
        ];

        svg
          .append("g")
          .attr("class", "birth-details birth-details-right")
          .attr("transform", `translate(${width - 20}, -64)`)
          .selectAll("text")
          .data(person2Details)
          .enter()
          .append("text")
          .attr("y", (d, i) => i * 34)
          .attr("text-anchor", "end")
          .attr("font-family", "Segoe UI, sans-serif")
          .attr("font-size", "28px")
          .attr("fill", "#222")
          .attr("font-weight", "normal")
          .text((d) => d);

        // Center title for composite with both names
        const compositeTitle = `${person1Data.name || "Person 1"} & ${
          person2Data.name || "Person 2"
        } - Composite`;
        svg
          .append("g")
          .attr("class", "birth-details birth-details-center")
          .attr("transform", `translate(${width / 2}, -112)`)
          .append("text")
          .attr("y", 0)
          .attr("text-anchor", "middle")
          .attr("font-family", "Segoe UI, sans-serif")
          .attr("font-size", "36px")
          .attr("fill", "#222")
          .attr("font-weight", "bold")
          .text(compositeTitle);
      } else {
        // Standard single-column layout for other charts
        const birthDetails = [
          `${natalData.name}`,
          `${natalData.day} ${natalData.month} ${natalData.year} ${natalData.hourString}:${natalData.minuteString} (${formatUtcOffsetForDisplay(natalData.utcOffset, natalData.timezone)})`,
          `${natalData.location}`,
          `${natalData.lat}, ${natalData.long}`,
        ];

        svg
          .append("g")
          .attr("class", "birth-details")
          .attr("transform", `translate(${width / 2}, -120)`)
          .selectAll("text")
          .data(birthDetails)
          .enter()
          .append("text")
          .attr("y", (d, i) => (i === 0 ? 0 : (i - 1) * 34 + 40)) // Line spacing (more spacing below name)
          .attr("text-anchor", "middle")
          .attr("font-family", "Segoe UI, sans-serif")
          .attr("font-size", (d, i) => (i === 0 ? "36px" : "28px"))
          .attr("fill", "#222")
          .attr("font-weight", (d, i) => (i === 0 ? "bold" : "normal"))
          .text((d) => d);
      }

      // Astrology system details
      svg.selectAll(".system-details").remove();

      const nodeText = natalData.trueNodes ? 'True Nodes' : 'Mean Nodes';
      const lilithText = natalData.trueLilith ? ', True Lilith' : '';
      const draconicText = natalData.draconic ? ', Draconic' : '';
      const systemDetails = [
        `Zodiac: ${formatZodiacSystemLabel(natalData.zodiacSystem)}`,
        `House: ${natalData.houseSystem}`,
        `Coordinates: ${natalData.coordinateSystem}`,
        `Lunar Nodes: ${nodeText}${lilithText}${draconicText}`,
      ];

      svg
        .append("g")
        .attr("class", "system-details")
        .attr("transform", `translate(${width / 2}, ${height + 26})`)
        .selectAll("text")
        .data(systemDetails)
        .enter()
        .append("text")
        .attr("y", (d, i) => i * 30)
        .attr("text-anchor", "middle")
        .attr("font-family", "Segoe UI, sans-serif")
        .attr("font-size", "24px")
        .attr("fill", "#222")
        .text((d) => d);

      // HOUSES
      // House Cusps
      // Extract house cusp positions from data
      const houseCusps = data
        .filter((item) => item.name && /^House\s+\d+$/i.test(String(item.name).trim()))
        .map((item) => {
          const houseNumber = Number(String(item.name).match(/\d+/)?.[0]);
          return {
            ...item,
            name: `House ${houseNumber}`,
            house: houseNumber,
          };
        })
        .filter((item) => Number.isFinite(item.house) && item.house >= 1 && item.house <= 12 && Number.isFinite(Number(item.position)))
        .sort((a, b) => a.house - b.house);

      // Safety pass for charts loaded from older localStorage/session data: even
      // when a payload did not carry render anchors, ASC/DS/IC/MC are displayed
      // on the house-system cusps they belong to.
      applyAngleHouseAnchorsToItems(data, houseCusps, selectedZodiacSystem);

      // Store Chart 1's house cusps for synastry calculations
      if (form === "synastry") {
        chart1HouseCusps = houseCusps;
        // Make it globally accessible for synastry report generation
        window.chart1HouseCusps = houseCusps;
      }

      // Store composite house cusps for composite report generation
      if (form === "composite") {
        window.compositeHouseCusps = houseCusps;
      }

      // Store return house cusps for return chart calculations
      if (form === "return") {
        window.returnHouseCusps = houseCusps;
      }

      // Store current chart's form and house cusps for planet details
      currentChartForm = form;
      currentChartHouseCusps = houseCusps;

      renderChartPositionPanel(form, data, natalData, selectedZodiacSystem, houseCusps);

      houseCusps.forEach((house) => {
        // Convert house position from degrees to radians
        const angle =
          ((ascendantPosition - house.position - 180) * Math.PI) / 180;

        // Calculate coordinates for the start (inner circle) and end (outer circle) of each line
        const x1 = width / 2 + houseInnerRadius * Math.cos(angle);
        const y1 = height / 2 + houseInnerRadius * Math.sin(angle);
        const x2 = width / 2 + signInnerRadius * Math.cos(angle);
        const y2 = height / 2 + signInnerRadius * Math.sin(angle);

        // Append house cusp line from inner house circle to outer sign circle
        svg
          .append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr(
            "class",
            `natal${form === "triwheel" ? " house-line-full" : ""}`,
          )
          .style("stroke", "black")
          .style("stroke-width", 1.5)
          .style("stroke-opacity", 0.5);

        // For triwheel, also render shorter house lines for biwheel mode
        // These extend only to the middle wheel's inner radius
        if (form === "triwheel" && middleWheel) {
          const x2Short =
            width / 2 + signInnerRadius * middleWheel * Math.cos(angle);
          const y2Short =
            height / 2 + signInnerRadius * middleWheel * Math.sin(angle);

          svg
            .append("line")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2Short)
            .attr("y2", y2Short)
            .attr("class", "natal house-line-short")
            .style("stroke", "black")
            .style("stroke-width", 1.5)
            .style("stroke-opacity", 0.5);
        }
      });

      // House colors
      // Draw each Placidus/house sector from its cusp to the next cusp in zodiac order.
      // d3.arc uses a different angle system than the x/y math below, so the start/end
      // angles must be normalized carefully; otherwise the last sector can cover the
      // whole ring and the house numbers appear duplicated/stacked after Calculate.
      const normalizeRadians = (angle) => {
        const twoPi = Math.PI * 2;
        return ((angle % twoPi) + twoPi) % twoPi;
      };
      const d3AngleForLongitude = (longitude) =>
        normalizeRadians(((ascendantPosition - longitude - 90) * Math.PI) / 180);
      const xyAngleForLongitude = (longitude) =>
        ((ascendantPosition - longitude - 180) * Math.PI) / 180;
      const zodiacDelta = (from, to) => ((to - from + 360) % 360) || 360;

      houseCusps.forEach((house, index) => {
        const nextHouse = houseCusps[(index + 1) % houseCusps.length];

        // Longitude increases counter-clockwise on this wheel, while d3.arc's positive
        // direction is clockwise. Use next -> current in d3 angle space so each sector
        // is only the real Placidus span, not a wrapped 300°+ arc.
        let startAngle = d3AngleForLongitude(nextHouse.position);
        let endAngle = d3AngleForLongitude(house.position);
        if (endAngle <= startAngle) endAngle += Math.PI * 2;

        const arc = d3
          .arc()
          .innerRadius(houseInnerRadius)
          .outerRadius(houseOuterRadius)
          .startAngle(startAngle)
          .endAngle(endAngle);

        svg
          .append("path")
          .attr("d", arc)
          .attr("transform", `translate(${width / 2}, ${height / 2})`)
          .attr("class", "natal house-sector")
          .style("fill", houseColors[index % houseColors.length])
          .style("fill-opacity", 0.9)
          .style("stroke", "black")
          .style("stroke-width", 1.5);
      });

      // House numbers: one label at the midpoint between each cusp and the next cusp.
      houseCusps.forEach((house, index) => {
        const nextHouse = houseCusps[(index + 1) % houseCusps.length];
        const midLongitude = (Number(house.position) + zodiacDelta(Number(house.position), Number(nextHouse.position)) / 2) % 360;
        const midAngle = xyAngleForLongitude(midLongitude);

        const x =
          width / 2 +
          ((houseInnerRadius + houseOuterRadius) / 2) * Math.cos(midAngle);
        const y =
          height / 2 +
          ((houseInnerRadius + houseOuterRadius) / 2) * Math.sin(midAngle);

        svg
          .append("text")
          .attr("x", x)
          .attr("y", y)
          .attr("text-anchor", "middle")
          .attr("alignment-baseline", "middle")
          .attr("font-size", houseNumberCustom || "24px")
          .attr("fill", "black")
          .attr("class", "natal house-number")
          .text(house.house || index + 1);
      });

      // SIGNS
      const customZodiacBoundaries = getUnequalZodiacBoundaries(selectedZodiacSystem);

      // Function to calculate zodiac angles
      function getZodiacAngles(boundaries) {
        return boundaries.map((item, index) => {
          const start = item.boundary;
          const end =
            index === boundaries.length - 1
              ? 360 // Wrap around for Pisces
              : boundaries[index + 1].boundary;
          return { sign: item.sign, start, end };
        });
      }

      // Sign colors
      const generateSignColors = (c, selectedZodiacSystem, extraClass = "") => {
        const boundaries = isUnequalZodiacSystem(selectedZodiacSystem)
          ? customZodiacBoundaries
          : signs.map((sign, index) => ({
              sign,
              boundary: index * 30,
            })); // Default 30 degree signs

        const zodiacAngles = getZodiacAngles(boundaries);

        const arcGenerator = d3
          .arc()
          .innerRadius(signInnerRadius * c)
          .outerRadius(signOuterRadius * c)
          .startAngle(
            (d) => ((ascendantPosition - d.start - 90) * Math.PI) / 180,
          )
          .endAngle((d) => ((ascendantPosition - d.end - 90) * Math.PI) / 180);

        zodiacAngles.forEach((angle) => {
          svg
            .append("path")
            .datum(angle)
            .attr("d", arcGenerator)
            .attr("transform", `translate(${width / 2}, ${height / 2})`)
            .attr("class", `natal${extraClass ? ` ${extraClass}` : ""}`)
            .style("fill", signColors[angle.sign.toLowerCase()] || "gray")
            .style("fill-opacity", 1)
            .style("stroke", "black")
            .style("stroke-width", 1.5);
        });
      };

      // Outer wheel sign colors
      generateSignColors(
        1,
        selectedZodiacSystem,
        form === "triwheel" ? "outer-wheel" : "",
      );

      // Inner wheel sign colors
      if (innerWheel) {
        generateSignColors(innerWheel, selectedZodiacSystem);
      }

      // Middle wheel sign colors
      if (middleWheel) {
        generateSignColors(middleWheel, selectedZodiacSystem);
      }

      // Sign Lines
      const boundaries =
        isUnequalZodiacSystem(selectedZodiacSystem)
          ? customZodiacBoundaries
          : signs.map((sign, index) => ({
              sign,
              boundary: index * 30,
            })); // Default 30° intervals

      const zodiacAngles = getZodiacAngles(boundaries);

      zodiacAngles.forEach((angle, index) => {
        // Midpoint angle for placing the sign SVG
        const midAngleDeg = (angle.start + angle.end) / 2;

        // Convert angles to radians for D3 calculations
        const startAngle =
          ((ascendantPosition - angle.start - 180) * Math.PI) / 180;
        const midAngle =
          ((ascendantPosition - midAngleDeg - 180) * Math.PI) / 180;

        // Calculate x and y coordinates for the start line of each sign
        const x1 = width / 2 + signOuterRadius * Math.cos(startAngle);
        const y1 = height / 2 + signOuterRadius * Math.sin(startAngle);
        const x2 = width / 2 + signInnerRadius * Math.cos(startAngle);
        const y2 = height / 2 + signInnerRadius * Math.sin(startAngle);

        svg
          .append("line")
          .attr("x1", x1)
          .attr("y1", y1)
          .attr("x2", x2)
          .attr("y2", y2)
          .attr("class", `natal${form === "triwheel" ? " outer-wheel" : ""}`)
          .style("stroke", "black")
          .style("stroke-width", 1.5);

        // Sign symbols
        // Symbol sizes
        let signSize = signSizes;

        // Function to position and append sign symbols
        const appendSignSymbols = (s, extraClass = "") => {
          const xMid =
            width / 2 +
            ((signOuterRadius * s + signInnerRadius * s) / 2) *
              Math.cos(midAngle);
          const yMid =
            height / 2 +
            ((signOuterRadius * s + signInnerRadius * s) / 2) *
              Math.sin(midAngle);

          const scaledSignSize = signSize * s;
          const signKey = normalizeTrueSkySignKey(angle.sign);
          const className = `natal sign-symbol-svg inline-sign-symbol${extraClass ? ` ${extraClass}` : ""}`;

          // Use the SVG artwork from images/signs/*.svg directly in the chart.
          // This keeps the original project SVGs (including Ophiuchus) and makes
          // the outer border signs visible even when <image href="..."> fails.
          const inlineSign = appendInlineTrueSkySignSvg(
            svg,
            signKey,
            xMid,
            yMid,
            scaledSignSize,
            className,
            true,
          );

          if (!inlineSign) {
            const signHref = trueSkySignSvgPath(signKey, false);
            svg.append("image")
              .attr("href", signHref)
              .attr("xlink:href", signHref)
              .attr("x", xMid - scaledSignSize / 2)
              .attr("y", yMid - scaledSignSize / 2)
              .attr("width", scaledSignSize)
              .attr("height", scaledSignSize)
              .attr("class", className)
              .style("pointer-events", "none")
              .style("filter", signKey === "ophiuchus" ? "brightness(0) invert(1)" : "brightness(0)");
          }
        };

        // Outer wheel sign symbol
        appendSignSymbols(1, form === "triwheel" ? "outer-wheel" : "");

        // Inner wheel sign symbol
        if (innerWheel) {
          appendSignSymbols(innerWheel);
        }

        // Middle wheel sign symbol
        if (middleWheel) {
          appendSignSymbols(middleWheel);
        }
      });

      // PLANETS
      // Array of planets from the data
      const selectableObjectNames = [
        "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn",
        "Uranus", "Neptune", "Pluto", "Chiron", "North Node", "South Node",
        "Ascendant Symbol", "Midheaven", "Descendant", "Imum Coeli", "Ceres", "Vesta",
        "Pallas", "Juno", "Lilith", "Priapus", "Part of Fortune", "Part of Spirit",
        "Vertex", "Anti-Vertex", "Galactic Center",
      ];

      const selectedPlanetObjects = Array.isArray(selectedPlanets) ? selectedPlanets : [];
      const planets = data.filter((item) => {
        if (!item.name) return false;
        const isSelectableObject = selectableObjectNames.some((name) => canonicalObjectName(name) === canonicalObjectName(item.name));
        if (item.isCustomPoint) return true;
        if (!isSelectableObject) return false;
        return selectionIncludes(selectedPlanetObjects, item.name);
      });

      // Extract fixed stars from data
      const fixedStarsData = data.filter((item) => item.isFixedStar === true);

      // Use planets in aspectarian and report. In synastry this render pass is
      // always Person 1 / the Main chart; Person 2 is assigned later by the
      // outer-wheel submit listener. Keeping these separate prevents Person 2
      // from replacing the first person before the synastry aspects are drawn.
      if (form === "synastry") {
        window.natalPlanets = planets;
        window.person1Planets = planets;
        window.natalData = data;
      }
      if (form === "return") {
        window.returnPlanets = planets;
      }
      if (form === "natal") {
        window.natalPlanets = planets;
        // Get natal data for composite
        window.natalData = data;
        window.person1Planets = planets;
        document.dispatchEvent(new CustomEvent("mainChartPlanetsUpdated"));
      }

      // FIXED STARS (rendered before planets so planets appear on top)
      if (fixedStarsData && fixedStarsData.length > 0) {
        // Position for dots (on inner edge of zodiac signs)
        const starDotRadius = innerWheel
          ? signInnerRadius * innerWheel
          : signInnerRadius;

        // Text labels positioned inside toward center (closer for triwheel with smaller font)
        const starTextOffset = form === "triwheel" ? 15 : 25;
        const starTextRadius = starDotRadius - starTextOffset;

        // Sort stars by position and calculate spaced label positions
        const sortedStars = [...fixedStarsData].sort(
          (a, b) => a.position - b.position,
        );

        // Simple angular spacing: push labels apart when too close
        const minSeparation = 3; // minimum degrees between labels
        const labelPositions = [];

        sortedStars.forEach((star, i) => {
          let labelPos = star.position;

          // Check against all previous labels and push apart if too close
          for (let j = 0; j < labelPositions.length; j++) {
            const diff = labelPos - labelPositions[j];
            const absDiff = Math.abs(diff);
            const actualDiff = absDiff > 180 ? 360 - absDiff : absDiff;

            if (actualDiff < minSeparation) {
              labelPos = labelPositions[j] + minSeparation;
              if (labelPos >= 360) labelPos -= 360;
            }
          }

          labelPositions.push(labelPos);
        });

        // Render stars with spaced labels and connecting lines
        sortedStars.forEach((star, i) => {
          const dotAngle =
            ((ascendantPosition - star.position - 180) * Math.PI) / 180;
          const dotX = width / 2 + starDotRadius * Math.cos(dotAngle);
          const dotY = height / 2 + starDotRadius * Math.sin(dotAngle);

          const labelAngle =
            ((ascendantPosition - labelPositions[i] - 180) * Math.PI) / 180;
          const textX = width / 2 + starTextRadius * Math.cos(labelAngle);
          const textY = height / 2 + starTextRadius * Math.sin(labelAngle);

          // Determine hemisphere for text orientation
          let rotationDeg = (labelAngle * 180) / Math.PI;
          const normalizedAngle = ((rotationDeg % 360) + 360) % 360;
          const isLeftHemisphere =
            normalizedAngle > 90 && normalizedAngle < 270;

          // Draw connecting line if label is offset from dot
          const labelOffset = Math.abs(star.position - labelPositions[i]);
          if (labelOffset > 0.5) {
            svg
              .append("line")
              .attr("x1", dotX)
              .attr("y1", dotY)
              .attr("x2", textX)
              .attr("y2", textY)
              .attr("stroke", "#555555")
              .attr("stroke-width", 1)
              .attr("class", "natal fixed-star-line");
          }

          // Draw dots (all three wheels in triwheel mode)
          if (form === "triwheel" && middleWheel) {
            // Draw dot on inner wheel (always visible)
            const innerDotRadius = signInnerRadius * innerWheel;
            const innerDotX = width / 2 + innerDotRadius * Math.cos(dotAngle);
            const innerDotY = height / 2 + innerDotRadius * Math.sin(dotAngle);
            svg
              .append("circle")
              .attr("cx", innerDotX)
              .attr("cy", innerDotY)
              .attr("r", 3)
              .attr("class", "natal fixed-star-dot")
              .style("fill", "#000000");

            // Draw dot on middle wheel (visible in biwheel modes as the outer ring)
            const middleDotRadius = signInnerRadius * middleWheel;
            const middleDotX = width / 2 + middleDotRadius * Math.cos(dotAngle);
            const middleDotY =
              height / 2 + middleDotRadius * Math.sin(dotAngle);
            svg
              .append("circle")
              .attr("cx", middleDotX)
              .attr("cy", middleDotY)
              .attr("r", 3)
              .attr("class", "natal fixed-star-dot")
              .style("fill", "#000000");

            // Draw dot on outer wheel (hidden in biwheel modes)
            const outerDotX = width / 2 + signInnerRadius * Math.cos(dotAngle);
            const outerDotY = height / 2 + signInnerRadius * Math.sin(dotAngle);
            svg
              .append("circle")
              .attr("cx", outerDotX)
              .attr("cy", outerDotY)
              .attr("r", 3)
              .attr("class", "natal fixed-star-dot outer-wheel")
              .style("fill", "#000000");
          } else {
            // Single wheel - draw one dot
            svg
              .append("circle")
              .attr("cx", dotX)
              .attr("cy", dotY)
              .attr("r", 4)
              .attr("class", "natal fixed-star-dot")
              .style("fill", "#000000");
          }

          let textAnchor;
          if (isLeftHemisphere) {
            textAnchor = "start";
            rotationDeg = rotationDeg + 180;
          } else {
            textAnchor = "end";
          }

          // Draw star name (smaller for triwheel)
          const starFontSize = form === "triwheel" ? "12px" : "18px";
          svg
            .append("text")
            .attr("x", textX)
            .attr("y", textY)
            .attr("text-anchor", textAnchor)
            .attr("dominant-baseline", "middle")
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", starFontSize)
            .attr("fill", "#333333")
            .attr("class", "natal fixed-star-label")
            .attr("transform", `rotate(${rotationDeg}, ${textX}, ${textY})`)
            .text(star.name);
        });
      }

      // PLANET SYMBOLS
      // Planet symbols spacing
      let spacingDistance = 0.12;
      if (innerPlanet) {
        spacingDistance = 0.19;
      }
      const spacedSymbols = symbolSpacing(
        planets,
        ascendantPosition,
        spacingDistance,
      );

      // Draw planet symbols
      spacedSymbols.forEach((planet) => {
        // Adjusted angle for symbols
        const adjustedAngle = planet.adjustedAngle;
        const displayPosition = getRenderablePosition(planet) ?? planet.position;

        // Calculate x and y coordinates for the planet based on its position
        const x = width / 2 + planetCircleRadius * Math.cos(adjustedAngle);
        const y = height / 2 + planetCircleRadius * Math.sin(adjustedAngle);

        // Store degree + minute
        const { hour, minute } = formatZodiacDegrees(
          displayPosition,
          boundaries,
          selectedZodiacSystem,
        );
        planet.hour = hour;
        planet.minute = minute;

        // Store retro icon
        if (planet.retrograde === true || planet.retrograde === 'sd' || planet.retrograde === 'sr') {
          let icon = "/images/misc/retrograde.svg";
          if (planet.retrograde === "sd") icon = "/images/misc/sd.svg";
          if (planet.retrograde === "sr") icon = "/images/misc/sr.svg";
          planet.retroIcon = icon;
        }

        // Planet sizes
        let planetSize = planetSizes;

        if (innerPlanet) {
          planetSize *= innerPlanet;
        }

        const planetKey = planet.name.toLowerCase().replace(/[\s-]+/g, "");
        const planetHref =
          planetImageCache[planetKey] || `/images/planets/${planetKey}.svg`;

        // Check if this is a custom point (renders text instead of image)
        if (planet.isCustomPoint && planet.displayLabel) {
          // Render text label for custom points (01, 02, etc.)
          // Use planetSize * 0.6 to get proportional font size matching planet SVGs
          const customFontSize = Math.round(planetSize * 0.6);
          svg
            .append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("font-family", "Arial, sans-serif")
            .attr("font-size", `${customFontSize}px`)
            .attr("font-weight", "bold")
            .attr("fill", "#2c3d4f")
            .attr("class", "natal custom-point-symbol")
            .style("filter", "drop-shadow(1px 1px 0px #999)")
            .style("cursor", "pointer")
            .text(planet.displayLabel)
            .on("click", function (event) {
              event.stopPropagation();
              showPlanetDetails(planet);
            });
        } else {
          // Append planet SVG image at calculated position
          svg
            .append("image")
            .attr("xlink:href", planetHref) // data planet name to svg name
            .attr("x", x - planetSize / 2) // Offset to center image on position
            .attr("y", y - planetSize / 2) // Offset to center image on position
            .attr("width", planetSize) // Width of planet image
            .attr("height", planetSize) // Height of planet image
            .attr("class", "natal")
            .style(
              "filter",
              innerPlanet
                ? `drop-shadow(1px 1px 0px #222)`
                : `drop-shadow(2px 2px 0px #222)`,
            )
            .on("error", function () {
              d3.select(this).remove();
              const fallbackGlyphs = {
                sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂", jupiter: "♃", saturn: "♄",
                uranus: "♅", neptune: "♆", pluto: "♇", chiron: "⚷", northnode: "☊", southnode: "☋",
                ascendantsymbol: "ASC", midheaven: "MC", descendant: "DSC", imumcoeli: "IC", ceres: "⚳", vesta: "⚶",
                pallas: "⚴", juno: "⚵", lilith: "⚸", priapus: "P", partoffortune: "⊕", partofspirit: "⊙",
                vertex: "Vx", antivertex: "Av", galacticcenter: "GC",
              };
              svg.append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("font-family", "Segoe UI Symbol, Noto Sans Symbols, Arial")
                .attr("font-size", `${Math.max(12, planetSize * 0.72)}px`)
                .attr("font-weight", "bold")
                .attr("fill", "#111")
                .attr("class", "natal planet-symbol-text-fallback")
                .text(fallbackGlyphs[planetKey] || planet.name.slice(0, 2));
            })
            // Add click event for the popup
            .on("mouseover", function () {
              d3.select(this).style("cursor", "pointer");
            })
            .on("click", function (event) {
              event.stopPropagation();
              if (form === "return") {
                const adjustType = document.getElementById("adjustType")?.value;
                const chartType =
                  adjustType === "Lunar" ? "lunar_return" : "solar_return";
                showPlanetDetails(planet, chartType);
              } else if (form === "composite") {
                showPlanetDetails(planet, "composite");
              } else {
                showPlanetDetails(planet);
              }
            });
        }

        // Sign symbol
        let signOffset = 60;
        const signX =
          width / 2 +
          (planetCircleRadius - signOffset) * Math.cos(adjustedAngle);
        const signY =
          height / 2 +
          (planetCircleRadius - signOffset) * Math.sin(adjustedAngle);

        const signKey = normalizeTrueSkySignKey(getRenderableSign(planet, selectedZodiacSystem) || planet.sign || getSignFromPosition(displayPosition, selectedZodiacSystem));
        const signColor = TRUE_SKY_SIGN_COLORS[signKey] || "#000000";

        if (selectedDegrees && !innerPlanet) {
          const signGlyphs = { aries: "♈", taurus: "♉", gemini: "♊", cancer: "♋", leo: "♌", virgo: "♍", libra: "♎", scorpio: "♏", sagittarius: "♐", capricorn: "♑", aquarius: "♒", pisces: "♓", ophiuchus: "⛎" };
          const signSizeBelowPlanet = 18;
          const inlinePlanetSign = appendInlineTrueSkySignSvg(
            svg,
            signKey,
            signX,
            signY,
            signSizeBelowPlanet,
            "natal planet-sign-svg inline-planet-sign-symbol",
            false,
            signColor,
          );

          if (inlinePlanetSign) {
            inlinePlanetSign
              .style("opacity", 0.8)
              .style("filter", "drop-shadow(1px 1px 0px #222)");
          }

          if (!inlinePlanetSign) {
            const signHref = trueSkySignSvgPath(signKey, true);
            const signImage = svg.append("image")
              .attr("href", signHref)
              .attr("xlink:href", signHref)
              .attr("x", signX - signSizeBelowPlanet / 2)
              .attr("y", signY - signSizeBelowPlanet / 2)
              .attr("width", signSizeBelowPlanet)
              .attr("height", signSizeBelowPlanet)
              .attr("class", "natal planet-sign-svg")
              .style("pointer-events", "none")
              .style("opacity", 0.8)
              .style("filter", "drop-shadow(1px 1px 0px #222)");

            signImage.on("error", function () {
              d3.select(this).remove();
              svg.append("text")
                .attr("x", signX)
                .attr("y", signY)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("font-size", "22px")
                .attr("font-family", "Segoe UI Symbol, Noto Sans Symbols, Arial")
                .attr("fill", signColor)
                .attr("class", "natal sign-symbol-text")
                .text(signGlyphs[signKey] || planet.sign.slice(0, 2));
            });
          }
        }

        // DEGREES
        // Function for getting degrees
        function formatZodiacDegrees(
          totalDegrees,
          boundaries,
          selectedZodiacSystem,
        ) {
          // Mainstream 30 degree systems
          if (!isUnequalZodiacSystem(selectedZodiacSystem)) {
            const degreeInSign = totalDegrees % 30;
            const d = Math.floor(degreeInSign);
            const m = Math.floor((degreeInSign - d) * 60);
            const mStr = m < 10 ? "0" + m : m;
            return { hour: d, minute: mStr };
          }

          // Custom boundaries
          let signStart = 0,
            signEnd = 0;

          // If planet's position is less than the first boundary it belongs to the last sign
          if (totalDegrees < boundaries[0].boundary) {
            signStart = boundaries[boundaries.length - 1].boundary;
            signEnd = 360;
          } else {
            // Otherwise find the sign where totalDegrees falls
            for (let i = 0; i < boundaries.length; i++) {
              const current = boundaries[i];
              const next = boundaries[i + 1];
              if (!next) {
                // last sign
                signStart = current.boundary;
                signEnd = 360;
                break;
              }
              if (
                totalDegrees >= current.boundary &&
                totalDegrees < next.boundary
              ) {
                signStart = current.boundary;
                signEnd = next.boundary;
                break;
              }
            }
          }
          const degreeInSign = totalDegrees - signStart;
          const d = Math.floor(degreeInSign);
          const m = Math.floor((degreeInSign - d) * 60);
          const mStr = m < 10 ? "0" + m : m;
          return { hour: d, minute: mStr };
        }

        if (selectedDegrees && !innerPlanet) {
          const { hour, minute } = formatZodiacDegrees(
            displayPosition,
            boundaries,
            selectedZodiacSystem,
          );

          // Hour (degree) - outer text
          const hourOffset = 38;
          const hourX =
            width / 2 +
            (planetCircleRadius - hourOffset) * Math.cos(adjustedAngle);
          const hourY =
            height / 2 +
            (planetCircleRadius - hourOffset) * Math.sin(adjustedAngle);

          svg
            .append("text")
            .attr("x", hourX)
            .attr("y", hourY)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr(
              "font-family",
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            )
            .attr("font-size", "16px")
            .attr("fill", "black")
            .attr("font-weight", "bold")
            .attr("class", "natal degrees")
            .text(`${hour}°`);

          // Minute - inner text
          const minuteOffset = 82;
          const minuteX =
            width / 2 +
            (planetCircleRadius - minuteOffset) * Math.cos(adjustedAngle);
          const minuteY =
            height / 2 +
            (planetCircleRadius - minuteOffset) * Math.sin(adjustedAngle);

          svg
            .append("text")
            .attr("x", minuteX)
            .attr("y", minuteY)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr(
              "font-family",
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            )
            .attr("font-size", "14px")
            .attr("fill", "black")
            .attr("font-weight", "normal")
            .attr("class", "natal degrees")
            .text(`${minute}'`);
        }

        // Retrograde symbols
        if (planet.retrograde === true || planet.retrograde === 'sd' || planet.retrograde === 'sr') {
          let retrogradeOffset = selectedDegrees ? 106 : 42;
          if (innerPlanet) {
            retrogradeOffset = 36;
          }
          const retrogradeX =
            width / 2 +
            (planetCircleRadius - retrogradeOffset) * Math.cos(adjustedAngle);
          const retrogradeY =
            height / 2 +
            (planetCircleRadius - retrogradeOffset) * Math.sin(adjustedAngle);

          let svgHref;
          if (planet.retrograde === true) {
            svgHref = miscImageCache["retrograde"];
          } else if (planet.retrograde === "sd") {
            svgHref = miscImageCache["sd"];
          } else if (planet.retrograde === "sr") {
            svgHref = miscImageCache["sr"];
          }

          svg
            .append("image")
            .attr("xlink:href", svgHref)
            .attr("x", retrogradeX - 10)
            .attr("y", retrogradeY - 10)
            .attr("width", 22)
            .attr("height", 22)
            .attr("class", "natal")
            .style("opacity", 0.8);
        }
      });

      // Degree ticks
      // Function to add degree ticks for different wheels
      function addDegreeTicks(
        wheelRadius,
        tickLength,
        thickness,
        extraClass = "",
      ) {
        const majorTickLength = tickLength * 2; // Longer tick every 5 degrees

        for (let i = 0; i < 360; i++) {
          const angle = ((ascendantPosition - i - 180) * Math.PI) / 180;
          const length = i % 5 === 0 ? majorTickLength : tickLength;

          const x1 = width / 2 + (wheelRadius - length) * Math.cos(angle);
          const y1 = height / 2 + (wheelRadius - length) * Math.sin(angle);
          const x2 = width / 2 + wheelRadius * Math.cos(angle);
          const y2 = height / 2 + wheelRadius * Math.sin(angle);

          svg
            .append("line")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .attr("class", `natal${extraClass ? ` ${extraClass}` : ""}`)
            .style("stroke", "black")
            .style("stroke-width", thickness)
            .style("stroke-opacity", 0.6);
        }
      }

      // Outer wheel degree ticks
      addDegreeTicks(
        signInnerRadius,
        10,
        2,
        form === "triwheel" ? "outer-wheel" : "",
      );

      // Middle wheel degree ticks
      if (middleWheel) {
        addDegreeTicks(signInnerRadius * middleWheel, 6, 1.8);
      }

      // Inner wheel degree ticks
      if (innerWheel) {
        addDegreeTicks(signInnerRadius * innerWheel, 4, 1.4);
      }

      // PLANET TICKS
      planets.forEach((planet) => {
        // Original angle for ticks
        const tickPosition = getRenderablePosition(planet) ?? planet.position;
        const angle =
          ((ascendantPosition - tickPosition - 180) * Math.PI) / 180;

        const tickLength = 16;

        // Inner sign circle tick
        let xInnerSign1 =
          width / 2 + (signInnerRadius - tickLength / 2) * Math.cos(angle);
        let yInnerSign1 =
          height / 2 + (signInnerRadius - tickLength / 2) * Math.sin(angle);
        let xInnerSign2 =
          width / 2 + (signInnerRadius + tickLength / 2) * Math.cos(angle);
        let yInnerSign2 =
          height / 2 + (signInnerRadius + tickLength / 2) * Math.sin(angle);

        if (innerWheel) {
          xInnerSign1 =
            width / 2 +
            (signInnerRadius * innerWheel - tickLength / 2) * Math.cos(angle);
          yInnerSign1 =
            height / 2 +
            (signInnerRadius * innerWheel - tickLength / 2) * Math.sin(angle);
          xInnerSign2 =
            width / 2 +
            (signInnerRadius * innerWheel + tickLength / 2) * Math.cos(angle);
          yInnerSign2 =
            height / 2 +
            (signInnerRadius * innerWheel + tickLength / 2) * Math.sin(angle);
        }

        // Inner sign circle tick
        // Get tick color - use black for custom points
        const tickColor = planet.isCustomPoint
          ? "#2c3d4f"
          : planetColors[planet.name.toLowerCase()];

        svg
          .append("line")
          .attr("x1", xInnerSign1)
          .attr("y1", yInnerSign1)
          .attr("x2", xInnerSign2)
          .attr("y2", yInnerSign2)
          .attr("class", "natal")
          .style("stroke", tickColor)
          .style("stroke-width", 4);

        if (!removeHouseTicks) {
          // Function to add house ticks
          const appendHouseTick = (radius) => {
            const x1 = width / 2 + (radius - tickLength / 2) * Math.cos(angle);
            const y1 = height / 2 + (radius - tickLength / 2) * Math.sin(angle);
            const x2 = width / 2 + (radius + tickLength / 2) * Math.cos(angle);
            const y2 = height / 2 + (radius + tickLength / 2) * Math.sin(angle);

            svg
              .append("line")
              .attr("x1", x1)
              .attr("y1", y1)
              .attr("x2", x2)
              .attr("y2", y2)
              .attr("class", "natal")
              .style("stroke", tickColor)
              .style("stroke-width", 4);
          };

          appendHouseTick(houseOuterRadius);
          appendHouseTick(houseInnerRadius);
        }
      });

      // ASPECTS
      // Create a map of planet names to their angles on the inner house radius
      if (form !== "synastry" || isBaseOnlySynastry) {
        const planetAngles = {};
        planets.forEach((planet) => {
          const aspectRenderPosition = getRenderablePosition(planet) ?? planet.position;
          const angle =
            ((ascendantPosition - aspectRenderPosition - 180) * Math.PI) / 180;
          planetAngles[planet.name.toLowerCase()] = angle;
        });

        // Collect unique aspects to avoid duplicates
        const uniqueAspects = new Set();
        const aspectConnections = [];
        const planetsWithRenderedAspects = new Set();

        // Make sure every enabled planet is visible even if it ends up with zero drawable lines
        const safeSelectedPlanetsAspects =
          typeof selectedPlanetsAspects !== "undefined" && Array.isArray(selectedPlanetsAspects)
            ? selectedPlanetsAspects
            : getSelectedPlanetsAspectsFallback(formDataObj);
        safeSelectedPlanetsAspects.forEach((p) =>
          planetsWithRenderedAspects.add(String(p).toLowerCase()),
        );

        // For heliocentric charts, Sun is replaced with Earth in the backend
        // Add "earth" to the set so it appears in the aspectarian
        if (
          natalData.coordinateSystem === "Heliocentric" &&
          planetsWithRenderedAspects.has("sun")
        ) {
          planetsWithRenderedAspects.add("earth");
        }

        planets.forEach((planet) => {
          const planetName = planet.name.toLowerCase();
          const aspects = planet.aspects || [];

          aspects.forEach((aspect) => {
            const targetPlanet = aspect.planet.toLowerCase();
            const aspectType = aspect.type;

            // Skip Conjunctions
            if (aspectType === "Conjunction") {
              return;
            }

            // Create a unique key for the aspect to prevent duplicates (sorted)
            const key =
              planetName < targetPlanet
                ? `${planetName}-${targetPlanet}-${aspectType}`
                : `${targetPlanet}-${planetName}-${aspectType}`;

            if (!uniqueAspects.has(key)) {
              uniqueAspects.add(key);
              aspectConnections.push({
                from: planetName,
                to: targetPlanet,
                type: aspectType,
              });
            }
          });
        });

        // Store planets that were actually involved in drawn aspects for aspectaria
        aspectConnections.forEach((aspect) => {
          planetsWithRenderedAspects.add(aspect.from);
          planetsWithRenderedAspects.add(aspect.to);
        });
        window.planetsWithRenderedAspects = planetsWithRenderedAspects;

        // Draw lines between planets based on aspects and append aspect symbols
        aspectConnections.forEach((aspect) => {
          const fromAngle = planetAngles[aspect.from];
          const toAngle = planetAngles[aspect.to];

          if (fromAngle === undefined || toAngle === undefined) {
            // Skip if any planet is not found
            return;
          }

          // Calculate coordinates on the inner house radius
          const x1 = width / 2 + houseInnerRadius * Math.cos(fromAngle);
          const y1 = height / 2 + houseInnerRadius * Math.sin(fromAngle);
          const x2 = width / 2 + houseInnerRadius * Math.cos(toAngle);
          const y2 = height / 2 + houseInnerRadius * Math.sin(toAngle);

          // Use the same visible color map used by the main wheel. Minor aspects
          // are intentionally not gray/black because they print too dark in PDF.
          const color = getAspectColor(aspect.type);

          // Append the line
          svg
            .append("line")
            .attr("x1", x1)
            .attr("y1", y1)
            .attr("x2", x2)
            .attr("y2", y2)
            .attr("class", "natal aspect-line")
            .style("stroke", color)
            .style("stroke-width", 2.2)
            .style("stroke-opacity", 0.52);

          // Calculate midpoint coordinates
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;

          const aspectKey = aspect.type.toLowerCase().replace(/[\s-]+/g, "");
          const aspectSymbol =
            miscImageCache[aspectKey] || `/images/aspects/${aspectKey}.svg`;

          // Append the aspect symbol image at the midpoint of the line
          svg
            .append("image")
            .attr("href", aspectSymbol)
            .attr("xlink:href", aspectSymbol)
            .attr("x", midX - aspectSymbolSize / 2)
            .attr("y", midY - aspectSymbolSize / 2)
            .attr("width", aspectSymbolSize)
            .attr("height", aspectSymbolSize)
            .attr("class", "natal aspect-symbol")
            .style("pointer-events", "none")
            .style("opacity", 0.9);
        });

        svg
          .append("circle")
          .attr("cx", width / 2)
          .attr("cy", height / 2)
          .attr("r", houseInnerRadius - 20) // Adjust if needed
          .attr("fill", "transparent")
          .style("cursor", "pointer") // aspectarian
          .on("click", function (event) {
            event.stopPropagation();
            if (form === "return") {
              showAspectarian(window.returnPlanets);
            } else if (form === "natal" || form === "compositeBlank") {
              showAspectarian(window.natalPlanets);
            } else if (form === "synastry") {
              showAspectarian(window.natalPlanets || window.person1Planets);
            } else if (form === "composite") {
              showAspectarian(window.compositePlanets);
            } else if (form === "triwheel") {
              // Check which wheel mode is selected
              const triwheelChart = document.getElementById("triwheel-chart");
              const isProgressionsBiwheel = triwheelChart?.classList.contains(
                "biwheel-progressions",
              );
              const isTransitsBiwheel =
                triwheelChart?.classList.contains("biwheel-transits");

              if (
                isProgressionsBiwheel &&
                window.natalPlanets?.length &&
                window.progressedPlanets?.length
              ) {
                // Progressions biwheel: show progressions to natal aspects
                const natalName =
                  JSON.parse(localStorage.getItem("natalData") || "{}").name ||
                  "Natal";
                showAspectarianSynastry(
                  window.natalPlanets,
                  window.progressedPlanets,
                  {
                    chartAName: natalName,
                    chartBName: "Progressions",
                  },
                );
              } else if (
                isTransitsBiwheel &&
                window.natalPlanets?.length &&
                window.transitPlanets?.length
              ) {
                // Transits biwheel: show transits to natal aspects
                const natalName =
                  JSON.parse(localStorage.getItem("natalData") || "{}").name ||
                  "Natal";
                showAspectarianSynastry(
                  window.natalPlanets,
                  window.transitPlanets,
                  {
                    chartAName: natalName,
                    chartBName: "Transits",
                  },
                );
              } else if (window.transitPlanets?.length && window.progressedPlanets?.length) {
                // Default triwheel: show transits to progressions aspects
                showAspectarianSynastry(
                  window.progressedPlanets,
                  window.transitPlanets,
                  {
                    chartAName: "Progressions",
                    chartBName: "Transits",
                  },
                );
              } else {
                // Fallback to natal aspectarian if data not available
                showAspectarian(window.natalPlanets);
              }
            }
          });
        return;
      }
    }

    // Pull out renderChart per wheel type. Keeping a per-form renderer prevents
    // the synastry wheel from accidentally redrawing itself with composite data.
    window.chartRenderers = window.chartRenderers || {};
    window.chartRenderers[form] = renderChart;
    window.renderChart = renderChart;

    // In the triwheel page the visible form is the TRANSIT/PROGRESSION date.
    // The inner wheel must always stay as the already calculated natal chart.
    // Previously this listener used the triwheel form fields as the base chart,
    // so the outer wheels could be calculated from / duplicated against the wrong
    // chart before the user made the second calculation.
    let baseChartData = formDataObj;
    if (form === "triwheel") {
      const storedNatalData = JSON.parse(localStorage.getItem("natalData") || "null");
      if (!storedNatalData || !storedNatalData.day || !storedNatalData.month || !storedNatalData.year) {
        const errorContainer = document.querySelector(".errorMessageTriwheel");
        showTemporaryError(
          errorContainer,
          "Calculate the natal chart first, then calculate the transit wheel.",
        );
        document.getElementById("loading-overlay").style.display = "none";
        return;
      }

      baseChartData = {
        ...formDataObj,
        ...storedNatalData,
        name: storedNatalData.name || formDataObj.name || "Natal",
        day: storedNatalData.day,
        month: storedNatalData.month,
        year: storedNatalData.year,
        hour: storedNatalData.hourString ?? storedNatalData.hour,
        minute: storedNatalData.minuteString ?? storedNatalData.minute,
        location: storedNatalData.location,
        lat: storedNatalData.lat,
        long: storedNatalData.long,
        utcOffset: storedNatalData.utcOffset,
        timezone: storedNatalData.timezone,
        selectedPlanets,
        selectedPlanetsAspects:
          typeof selectedPlanetsAspects !== "undefined" && Array.isArray(selectedPlanetsAspects)
            ? selectedPlanetsAspects
            : getSelectedPlanetsAspectsFallback(formDataObj),
        selectedAspects,
        selectedZodiacSystem,
        selectedAyanamsaSystem,
        customAyanamsa,
        selectedHouseSystem,
        selectedCoordinateSystem,
        ascendantOverride,
        trueNodes,
        trueLilith,
        draconic,
        fixedStars,
        fixedStarsMagnitude,
        fixedStarsLatitude,
      };
    }

    // Calculate locally in the browser so the wheel is included immediately in the calculation.
    const baseRenderPromise = Promise.resolve(calculateAstrologyChart(baseChartData))
      .then((data) => {
        // console.log(`Natal from ${form}: `, data);

        // Composite chart immediate display
        if (form === "composite") {
          // Don't set display inline - remove display property to let CSS take over
          document
            .getElementById("composite-chart")
            .style.removeProperty("display");
          document.getElementById("composite-chart-blank").style.display =
            "none";
        } else {
          // For non-composite charts, only hide composite if it's a natal form submission
          // This preserves composite chart when synastry is calculated
          if (form === "natal") {
            document.getElementById("composite-chart").style.display = "none";
          }
          // Normal chart rendering for all non-composite charts
          renderChart(data);
        }

        if (form === "return") {
          const isRelocatedInput = document.getElementById("isRelocated");
          const returnLocation =
            document.getElementById("returnLocation")?.value;
          const preservedNatalLocation =
            document.getElementById("natalLocation")?.value;
          if (isRelocatedInput) {
            // only clear “relocated” when they’ve actually switched back to natal loc
            isRelocatedInput.value =
              returnLocation === preservedNatalLocation ? "false" : "true";
          }
        }
      })
      .catch((error) => {
        // Dispatch event so graph doesn't hang if it triggered this natal calculation
        if (form === "natal") {
          document.dispatchEvent(new CustomEvent("natalChartComplete"));
        }

        let errorContainer;

        // Check if settings page is visible
        const settingsVisible =
          document.getElementById("showSettings").style.display !== "none";

        if (settingsVisible) {
          errorContainer = document.querySelector(
            "#showSettings .errorMessage",
          );
        } else if (formIdToUse === "natalForm") {
          errorContainer = document.querySelector("#natalForm .errorMessage");
        } else if (formIdToUse === "synastryForm") {
          errorContainer = document.querySelector("#synastryForm .errorMessageSynastry");
        } else {
          errorContainer = document.querySelector("#returnForm .errorMessage");
        }

        console.error('sharedNatal error:', error);
        showTemporaryError(
          errorContainer,
          getErrorMessage(error),
        );
      })
      .finally(() => {
        setTimeout(() => {
          // Don't hide overlay if graph is waiting for its own fetch
          if (!window._graphNeedsOverlay) {
            document.getElementById("loading-overlay").style.display = "none";
          }
        }, 300);
      });

    if (form === "synastry") {
      window.__synastryBaseRenderPromise = baseRenderPromise.catch(() => {});
    }
  });

  // TRIWHEEL
  // Check which triwheel to generate
  let formId = "triwheelForm";
  if (form === "triwheelGraph") {
    formId = "triwheelFormGraph";
  } else if (form === "synastry") {
    formId = "synastryForm";
  }

  let triwheelRenderRunId = 0;

  document.getElementById(formId).addEventListener("submit", async function (e) {
    e.preventDefault();

    const isTriwheelBaseOnly = form === "triwheel" && this.dataset.baseOnly === "true";
    const isSynastryBaseOnly = form === "synastry" && this.dataset.baseOnly === "true";
    const currentTriwheelRunId = ++triwheelRenderRunId;

    // Clear the previous triwheel overlay immediately so stale transit/progression
    // planets and old aspect sets cannot remain visible or duplicate while the
    // new calculation is still running.
    svg.selectAll(".progressions,.transits,.transits-middle").remove();
    svg
      .selectAll(
        ".aspect-line.triwheel-default,.aspect-symbol.triwheel-default,.aspect-symbol-bg.triwheel-default,.aspect-symbol-text.triwheel-default,.aspect-line.triwheel-progressions,.aspect-symbol.triwheel-progressions,.aspect-symbol-bg.triwheel-progressions,.aspect-symbol-text.triwheel-progressions,.aspect-line.triwheel-transits,.aspect-symbol.triwheel-transits,.aspect-symbol-bg.triwheel-transits,.aspect-symbol-text.triwheel-transits,.aspect-line.synastry,.aspect-symbol.synastry,.aspect-symbol-bg.synastry,.aspect-symbol-text.synastry,.aspectarian-hotspot.synastry",
      )
      .remove();

    if (form === "triwheel") {
      window.progressedPlanets = [];
      window.transitPlanets = [];
    }

    if (isTriwheelBaseOnly || isSynastryBaseOnly) {
      this.dataset.baseOnly = "false";
      return;
    }

    document.getElementById("loading-overlay").style.display = "block";

    // Track completion of both fetch calls for graph auto-submit
    const isGraphAutoSubmit =
      form === "triwheelGraph" && this.dataset.autoSubmit === "true";
    let progressionsComplete = false;
    let transitsComplete = false;

    const checkTriwheelGraphComplete = () => {
      if (isGraphAutoSubmit && progressionsComplete && transitsComplete) {
        document.dispatchEvent(new CustomEvent("triwheelGraphComplete"));
        // Reset the flag
        this.dataset.autoSubmit = "false";
      }
    };

      const drawTriwheelAspectLines = (
        svg,
        fromPlanets,
        toPlanets,
        ascendantPosition,
        houseInnerRadius,
        width,
        height,
        cssClass,
      ) => {
        if (!Array.isArray(fromPlanets) || !Array.isArray(toPlanets)) return;
        fromPlanets = dedupePlanetsForAspects(fromPlanets);
        toPlanets = dedupePlanetsForAspects(toPlanets);

        const safeSelectedPlanetsAspectsForTriwheel =
          typeof selectedPlanetsAspects !== "undefined" && Array.isArray(selectedPlanetsAspects)
            ? selectedPlanetsAspects
            : getSelectedPlanetsAspectsFallback(formDataObj);
        const safeSelectedAspectsForTriwheel =
          typeof selectedAspects !== "undefined" && Array.isArray(selectedAspects)
            ? selectedAspects
            : getSelectedAspectsFallback(formDataObj);
        const safeAspectOrbsForTriwheel =
          typeof aspectOrbs !== "undefined" && aspectOrbs
            ? aspectOrbs
            : (formDataObj?.aspectOrbs || {});

        const allowedPlanetNames = Array.isArray(safeSelectedPlanetsAspectsForTriwheel) && safeSelectedPlanetsAspectsForTriwheel.length
          ? new Set(safeSelectedPlanetsAspectsForTriwheel.map(canonicalObjectName))
          : null;
        const isAllowedPlanet = (planet) =>
          planet?.name && (!allowedPlanetNames || allowedPlanetNames.has(canonicalObjectName(planet.name)));
        const aspectDefs = getVisibleCrossAspectDefs(safeSelectedAspectsForTriwheel, safeAspectOrbsForTriwheel);
        if (!aspectDefs.length) return;

        const toAngles = {};
        toPlanets.filter(isAllowedPlanet).forEach((planet) => {
          const toRenderPosition = getRenderablePosition(planet) ?? planet.position;
          if (Number.isFinite(toRenderPosition)) {
            toAngles[canonicalObjectName(planet.name)] =
              ((ascendantPosition - toRenderPosition - 180) * Math.PI) / 180;
          }
        });

        const rendered = new Set();
        fromPlanets.filter(isAllowedPlanet).forEach((fromPlanet) => {
          const fromRenderPosition = getRenderablePosition(fromPlanet) ?? fromPlanet.position;
          if (!Number.isFinite(fromRenderPosition)) return;
          const fromAngle = ((ascendantPosition - fromRenderPosition - 180) * Math.PI) / 180;

          toPlanets.filter(isAllowedPlanet).forEach((toPlanet) => {
            const toKey = canonicalObjectName(toPlanet.name);
            const toAngle = toAngles[toKey];
            if (toAngle === undefined) return;

            const aspect = findCrossAspect(fromPlanet, toPlanet, aspectDefs);
            if (!aspect) return;

            const renderKey = `${cssClass}:${canonicalObjectName(fromPlanet.name)}>${toKey}:${normalizeAspectSettingName(aspect.type)}`;
            if (rendered.has(renderKey)) return;
            rendered.add(renderKey);

            const x1 = width / 2 + houseInnerRadius * Math.cos(fromAngle);
            const y1 = height / 2 + houseInnerRadius * Math.sin(fromAngle);
            const x2 = width / 2 + houseInnerRadius * Math.cos(toAngle);
            const y2 = height / 2 + houseInnerRadius * Math.sin(toAngle);
            const color = getAspectColor(aspect.type);

            svg
              .append("line")
              .attr("x1", x1)
              .attr("y1", y1)
              .attr("x2", x2)
              .attr("y2", y2)
              .attr("class", `aspect-line ${cssClass}`)
              .style("stroke", color)
              .style("stroke-width", 1.45)
              .style("stroke-opacity", 0.55);

            drawAspectSymbolAtMidpoint(
              svg,
              (x1 + x2) / 2,
              (y1 + y2) / 2,
              aspect.type,
              cssClass,
              color,
            );
          });
        });
      };

      const drawSynastryAspectLines = (...args) =>
        drawTriwheelAspectLines(...args);

      const drawCurrentTriwheelAspects = () => {
      if (
        form !== "triwheel" ||
        currentTriwheelRunId !== triwheelRenderRunId ||
        !window.natalPlanets?.length
      ) {
        return;
      }

      svg
        .selectAll(
          ".aspect-line.triwheel-default,.aspect-symbol.triwheel-default,.aspect-symbol-bg.triwheel-default,.aspect-symbol-text.triwheel-default,.aspect-line.triwheel-progressions,.aspect-symbol.triwheel-progressions,.aspect-symbol-bg.triwheel-progressions,.aspect-symbol-text.triwheel-progressions,.aspect-line.triwheel-transits,.aspect-symbol.triwheel-transits,.aspect-symbol-bg.triwheel-transits,.aspect-symbol-text.triwheel-transits,.aspect-line.synastry,.aspect-symbol.synastry,.aspect-symbol-bg.synastry,.aspect-symbol-text.synastry,.aspectarian-hotspot.synastry",
        )
        .remove();

      if (window.transitPlanets?.length && window.progressedPlanets?.length) {
        drawTriwheelAspectLines(
          svg,
          window.transitPlanets,
          window.progressedPlanets,
          ascendantPosition,
          houseInnerRadius,
          width,
          height,
          "triwheel-default",
        );
      }

      if (window.progressedPlanets?.length) {
        drawTriwheelAspectLines(
          svg,
          window.progressedPlanets,
          window.natalPlanets,
          ascendantPosition,
          houseInnerRadius,
          width,
          height,
          "triwheel-progressions",
        );
      }

      if (window.transitPlanets?.length) {
        drawTriwheelAspectLines(
          svg,
          window.transitPlanets,
          window.natalPlanets,
          ascendantPosition,
          houseInnerRadius,
          width,
          height,
          "triwheel-transits",
        );
      }
    };

    const formData = new FormData(this);
    const formDataObj = Object.fromEntries(formData);

    const requiredOuterWheelFields = ["day", "month", "year", "hour", "minute", "location"];

    if (form === "triwheel") {
      const missingTriwheelField = requiredOuterWheelFields.some((key) => !String(formDataObj[key] || "").trim());
      if (missingTriwheelField) {
        document.getElementById("loading-overlay").style.display = "none";
        const msg = document.querySelector("#triwheelForm .errorMessage");
        if (msg) msg.textContent = "Fill the transit date, time and location, then click Calculate.";
        return;
      }
    }

    if (form === "synastry") {
      const missingSynastryField = requiredOuterWheelFields.some((key) => !String(formDataObj[key] || "").trim());
      if (missingSynastryField) {
        document.getElementById("loading-overlay").style.display = "none";
        const msg = document.querySelector("#synastryForm .errorMessageSynastry");
        if (msg) msg.textContent = "Fill Person 2 date, time and location, then click Calculate.";
        return;
      }
    }

    let natalData = null;
    try {
      natalData = JSON.parse(localStorage.getItem("natalData") || "null");
    } catch (_) {
      natalData = null;
    }

    if ((form === "synastry" || form === "triwheel") && (!natalData || !natalData.day || !natalData.month || !natalData.year)) {
      document.getElementById("loading-overlay").style.display = "none";
      const msg = form === "synastry"
        ? document.querySelector("#synastryForm .errorMessageSynastry")
        : document.querySelector("#triwheelForm .errorMessage");
      if (msg) msg.textContent = "Calculate the main chart first, then calculate this wheel.";
      return;
    }

    // Combine natal data with triwheel data
    const combinedData = { ...formDataObj, natalData };

    // Add name if missing (triwheel form doesn't have name field)
    if (!combinedData.name && natalData && natalData.name) {
      combinedData.name = natalData.name;
    }

    // Retrieve selections from settings page
    const selectedPlanets = Array.from(
      document.querySelectorAll(
        '#planet-settings input[name="planet"]:checked',
      ),
    ).map((checkbox) => checkbox.value);

    const selectedPlanetsAspects = Array.from(
      document.querySelectorAll(
        '#planet-settings input[name="planetAspects"]:checked',
      ),
    ).map((checkbox) => checkbox.value);

    const selectedAspects = Array.from(
      document.querySelectorAll(
        '#aspect-settings input[name="aspects"]:checked',
      ),
    ).map((checkbox) => checkbox.value);

    const aspectOrbs = {};
    document
      .querySelectorAll("#aspect-settings select.aspect-orb")
      .forEach((sel) => {
        const key = String(sel.dataset.aspect || "").toLowerCase();
        aspectOrbs[key] = +sel.value;
      });

    const selectedZodiacSystem = document.querySelector(
      '#system-settings select[name="zodiacSystem"]',
    ).value;

    const selectedHouseSystem = document.querySelector(
      '#system-settings select[name="houseSystem"]',
    ).value;

    const selectedAyanamsaSystem = document.querySelector(
      '#system-settings select[name="ayanamsaSystem"]',
    )?.value || "Tropical";

    const customAyanamsa = Number(
      document.querySelector('#system-settings input[name="customAyanamsa"]')?.value ?? 0,
    );

    const selectedCoordinateSystem = document.querySelector(
      '#system-settings select[name="coordinateSystem"]',
    ).value;

    // Include selected planets/aspects in the request for both transits/synastry
    // (formDataObj) and progressions (combinedData).
    formDataObj.selectedPlanets = selectedPlanets;
    combinedData.selectedPlanets = selectedPlanets;
    formDataObj.selectedPlanetsAspects = selectedPlanetsAspects;
    combinedData.selectedPlanetsAspects = selectedPlanetsAspects;
    formDataObj.selectedAspects = selectedAspects;
    combinedData.selectedAspects = selectedAspects;
    formDataObj.aspectOrbs = aspectOrbs;
    combinedData.aspectOrbs = aspectOrbs;

    formDataObj.selectedZodiacSystem = selectedZodiacSystem;
    combinedData.selectedZodiacSystem = selectedZodiacSystem;
    formDataObj.selectedAyanamsaSystem = selectedAyanamsaSystem;
    combinedData.selectedAyanamsaSystem = selectedAyanamsaSystem;
    formDataObj.customAyanamsa = customAyanamsa;
    combinedData.customAyanamsa = customAyanamsa;

    formDataObj.selectedHouseSystem = selectedHouseSystem;
    combinedData.selectedHouseSystem = selectedHouseSystem;

    formDataObj.selectedCoordinateSystem = selectedCoordinateSystem;
    combinedData.selectedCoordinateSystem = selectedCoordinateSystem;

    const ascendantOverride =
      document.getElementById("ascendantOverride").value;
    formDataObj.ascendantOverride = ascendantOverride;
    combinedData.ascendantOverride = ascendantOverride;

    const trueNodes = document.querySelector(
      '.degree-settings input[name="trueNodes"]',
    ).checked;
    const trueLilith = document.querySelector(
      '.degree-settings input[name="trueLilith"]',
    ).checked;
    const draconic = document.querySelector(
      '.degree-settings input[name="draconic"]',
    ).checked;
    const fixedStars = document.querySelector(
      'input[name="fixedStars"]',
    ).checked;
    const fixedStarsMagnitude = parseFloat(
      document.querySelector('select[name="fixedStarsMagnitude"]').value,
    );
    const fixedStarsLatitude = parseFloat(
      document.querySelector('select[name="fixedStarsLatitude"]').value,
    );
    formDataObj.trueNodes = trueNodes;
    formDataObj.trueLilith = trueLilith;
    formDataObj.draconic = draconic;
    formDataObj.fixedStars = fixedStars;
    formDataObj.fixedStarsMagnitude = fixedStarsMagnitude;
    formDataObj.fixedStarsLatitude = fixedStarsLatitude;
    combinedData.trueNodes = trueNodes;
    combinedData.trueLilith = trueLilith;
    combinedData.draconic = draconic;
    combinedData.fixedStars = fixedStars;
    combinedData.fixedStarsMagnitude = fixedStarsMagnitude;
    combinedData.fixedStarsLatitude = fixedStarsLatitude;

    // Include custom points if defined (from saveLoadSettings.js)
    if (
      typeof activeCustomPoints !== "undefined" &&
      activeCustomPoints.length > 0
    ) {
      const customPointsForRequest = activeCustomPoints
        .filter((p) => p.display)
        .map((p) => ({
          num: p.num,
          name: p.name,
          display: p.display,
          aspect: p.aspect,
        }));
      formDataObj.customPoints = customPointsForRequest;
      combinedData.customPoints = customPointsForRequest;
    }

    if (form === "synastry" && window.__synastryBaseRenderPromise) {
      await window.__synastryBaseRenderPromise;
      if (currentTriwheelRunId !== triwheelRenderRunId) return;
      if (!window.natalPlanets?.length || !window.chart1HouseCusps?.length) {
        document.getElementById("loading-overlay").style.display = "none";
        const msg = document.querySelector("#synastryForm .errorMessageSynastry");
        if (msg) msg.textContent = "Could not load Person 1 from the main chart. Calculate Main again, then calculate Synastry.";
        return;
      }
    }

    // Center wheel (progressions)
    if (centerPlanet && form !== "synastry") {
      Promise.resolve(calculateAstrologyChart(combinedData))
        .then((data) => {
          if (currentTriwheelRunId !== triwheelRenderRunId) return;
          const progressionsErrorMessage = document.querySelector(".errorMessageTriwheel");
          if (progressionsErrorMessage) progressionsErrorMessage.textContent = "";
          // console.log(`Progressions: `, data);

          // Remove triwheel images
          svg.selectAll(".progressions").remove();

          const planetCircleCenterRadius = minDimension / centerPlanet;

          const centerPlanets = data.filter(
            (item) =>
              (item.name &&
                [
                  "Sun",
                  "Moon",
                  "Mercury",
                  "Venus",
                  "Mars",
                  "Jupiter",
                  "Saturn",
                  "Uranus",
                  "Neptune",
                  "Pluto",
                  "Chiron",
                  "North Node",
                  "South Node",
                  "Ascendant Symbol",
                  "Midheaven",
                  "Descendant",
                  "Imum Coeli",
                  "Ceres",
                  "Vesta",
                  "Pallas",
                  "Juno",
                  "Lilith",
                  "Priapus",
                  "Part of Fortune",
                  "Part of Spirit",
                  "Vertex",
                  "Anti-Vertex",
                  "Galactic Center",
                ].includes(item.name)) ||
              item.isCustomPoint,
          );

          // Store progressed planets for triwheel report
          if (form === "triwheel") {
            window.progressedPlanets = centerPlanets;
            drawCurrentTriwheelAspects();
          }

          // CENTER PLANET SYMBOLS
          const spacedSymbols = symbolSpacing(
            centerPlanets,
            ascendantPosition,
            0.1,
          );
          spacedSymbols.forEach((planet) => {
            // Adjusted angle for symbols
            const adjustedAngle = planet.adjustedAngle;

            const x =
              width / 2 + planetCircleCenterRadius * Math.cos(adjustedAngle);
            const y =
              height / 2 + planetCircleCenterRadius * Math.sin(adjustedAngle);

            let planetSize = planetSizes;

            // Make smaller than inner planet size by a factor of 2
            planetSize *= innerPlanet ** 2;

            const planetKey = planet.name.toLowerCase().replace(/[\s-]+/g, "");
            const planetHref =
              planetImageCache[planetKey] || `/images/planets/${planetKey}.svg`;

            // Check if this is a custom point (renders text instead of image)
            if (planet.isCustomPoint && planet.displayLabel) {
              // Render text label for custom points (01, 02, etc.)
              // Use planetSize * 0.6 to get proportional font size matching planet SVGs
              const customFontSize = Math.round(planetSize * 0.6);
              svg
                .append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("font-family", "Arial, sans-serif")
                .attr("font-size", `${customFontSize}px`)
                .attr("font-weight", "bold")
                .attr("fill", "#2c3d4f")
                .attr("class", "progressions custom-point-symbol")
                .style("filter", "drop-shadow(1px 1px 0px #999)")
                .style("cursor", "pointer")
                .text(planet.displayLabel)
                .on("click", function (event) {
                  event.stopPropagation();
                  const clickPosition = getRenderablePosition(planet) ?? planet.position;
                  const { hour, minute } = calculatePlanetDegrees(
                    clickPosition,
                    selectedZodiacSystem,
                  );
                  planet.hour = hour;
                  planet.minute = minute;
                  showPlanetDetails(planet, "progressed");
                });
            } else {
              svg
                .append("image")
                .attr("xlink:href", planetHref) // data planet name to svg name
                .attr("x", x - planetSize / 2)
                .attr("y", y - planetSize / 2)
                .attr("width", planetSize)
                .attr("height", planetSize)
                .attr("class", "progressions")
                .style("filter", `drop-shadow(1px 1px 0px #222)`)
                .style("cursor", "pointer")
                .on("mouseover", function () {
                  d3.select(this).style("cursor", "pointer");
                })
                .on("click", function (event) {
                  event.stopPropagation();
                  const clickPosition = getRenderablePosition(planet) ?? planet.position;
                  const { hour, minute } = calculatePlanetDegrees(
                    clickPosition,
                    selectedZodiacSystem,
                  );
                  planet.hour = hour;
                  planet.minute = minute;
                  if (planet.retrograde === true || planet.retrograde === 'sd' || planet.retrograde === 'sr') {
                    planet.retroIcon =
                      planet.retrograde === "sd"
                        ? "/images/misc/sd.svg"
                        : planet.retrograde === "sr"
                          ? "/images/misc/sr.svg"
                          : "/images/misc/retrograde.svg";
                  }
                  showPlanetDetails(planet, "progressed");
                });
            }

            // Retrograde symbol
            if (planet.retrograde === true || planet.retrograde === 'sd' || planet.retrograde === 'sr') {
              let retrogradeOffset = 28;
              const retrogradeX =
                width / 2 +
                (planetCircleCenterRadius - retrogradeOffset) *
                  Math.cos(adjustedAngle);
              const retrogradeY =
                height / 2 +
                (planetCircleCenterRadius - retrogradeOffset) *
                  Math.sin(adjustedAngle);
              let retrogradeSvg;
              if (planet.retrograde === true) {
                retrogradeSvg = miscImageCache["retrograde"];
              } else if (planet.retrograde === "sd") {
                retrogradeSvg = miscImageCache["sd"];
              } else if (planet.retrograde === "sr") {
                retrogradeSvg = miscImageCache["sr"];
              }

              svg
                .append("image")
                .attr("xlink:href", retrogradeSvg)
                .attr("x", retrogradeX - 10)
                .attr("y", retrogradeY - 10)
                .attr("width", 18)
                .attr("height", 18)
                .attr("class", "progressions")
                .style("opacity", 0.8);
            }
          });

          // PLANET TICKS
          centerPlanets.forEach((planet) => {
            // Original angle for ticks
            const tickPosition = getRenderablePosition(planet) ?? planet.position;
            const angle =
              ((ascendantPosition - tickPosition - 180) * Math.PI) / 180;

            const tickLength = 16;

            // Inner sign circle tick
            let xInnerSign1 =
              width / 2 +
              (signInnerRadius * middleWheel - tickLength / 2) *
                Math.cos(angle);
            let yInnerSign1 =
              height / 2 +
              (signInnerRadius * middleWheel - tickLength / 2) *
                Math.sin(angle);
            let xInnerSign2 =
              width / 2 +
              (signInnerRadius * middleWheel + tickLength / 2) *
                Math.cos(angle);
            let yInnerSign2 =
              height / 2 +
              (signInnerRadius * middleWheel + tickLength / 2) *
                Math.sin(angle);

            // Get tick color - use black for custom points
            const tickColor = planet.isCustomPoint
              ? "#2c3d4f"
              : planetColors[planet.name.toLowerCase()];

            svg
              .append("line")
              .attr("x1", xInnerSign1)
              .attr("y1", yInnerSign1)
              .attr("x2", xInnerSign2)
              .attr("y2", yInnerSign2)
              .attr("class", "progressions")
              .style("stroke", tickColor)
              .style("stroke-width", 4);
          });
        })
        .catch((error) => {
          const errorContainer =
            form === "synastry"
              ? document.querySelector("#synastryForm .errorMessageSynastry")
              : document.querySelector(".errorMessageTriwheel");

          console.error('sharedNatal triwheel progressions error:', error);
          showTemporaryError(
            errorContainer,
            getErrorMessage(error),
          );
        })
        .finally(() => {
          progressionsComplete = true;
          checkTriwheelGraphComplete();
        });
    } else if (isGraphAutoSubmit) {
      // No progressions fetch needed, mark as complete
      progressionsComplete = true;
    }

    // Outer wheel (transits)
    if (outerPlanet) {
      // Add name if missing (triwheel form doesn't have name field)
      if (!formDataObj.name && natalData && natalData.name) {
        formDataObj.name = natalData.name;
      }

      // Include natal data for house calculations but flag as transits (not progressions)
      // Only for triwheel and triwheelGraph, NOT synastry
      const transitData =
        form === "triwheel" || form === "triwheelGraph"
          ? { ...formDataObj, natalData, isTransit: true }
          : formDataObj;

      Promise.resolve(calculateAstrologyChart(transitData))
        .then((data) => {
          if (currentTriwheelRunId !== triwheelRenderRunId) return;
          // Keep rendered synastry chart metadata
          if (form === "synastry" && Array.isArray(data) && data.length) {
            const meta = data[0];

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
            const monthText = !isNaN(meta.month)
              ? monthNames[meta.month - 1]
              : meta.month;

            localStorage.setItem(
              "synastryData",
              JSON.stringify({
                name: meta.name,
                year: meta.year,
                month: monthText,
                day: meta.day,
                hour: meta.hour,
                minute: meta.minute,
                lat: meta.lat,
                long: meta.long,
                utcOffset: meta.utcOffset,
                location: meta.location,
              }),
            );
          }

          const outerErrorMessage = form === "synastry"
            ? document.querySelector("#synastryForm .errorMessageSynastry")
            : document.querySelector(".errorMessageTriwheel");
          if (outerErrorMessage) outerErrorMessage.textContent = "";
          // console.log(`Transits: `, data);

          // Remove triwheel images
          svg.selectAll(".transits").remove();
          svg.selectAll(".transits-middle").remove();

          const planetCircleOuterRadius = minDimension / outerPlanet;

          const outerPlanets = data.filter(
            (item) =>
              (item.name &&
                [
                  "Sun",
                  "Moon",
                  "Mercury",
                  "Venus",
                  "Mars",
                  "Jupiter",
                  "Saturn",
                  "Uranus",
                  "Neptune",
                  "Pluto",
                  "Chiron",
                  "North Node",
                  "South Node",
                  "Ascendant Symbol",
                  "Midheaven",
                  "Descendant",
                  "Imum Coeli",
                  "Ceres",
                  "Vesta",
                  "Pallas",
                  "Juno",
                  "Lilith",
                  "Priapus",
                  "Part of Fortune",
                  "Part of Spirit",
                  "Vertex",
                  "Anti-Vertex",
                  "Galactic Center",
                ].includes(item.name)) ||
              item.isCustomPoint,
          );

          // Set synastry planets for synastry aspectarian & composite chart
          if (form === "synastry") {
            window.synastryPlanets = outerPlanets;
            window.synastryData = data;

            compositeNatal = window.natalData; // first person
            compositeSynastry = window.synastryData; // second person

            // Composite chart rendering
            const composite = buildComposite(compositeNatal, compositeSynastry);
            window.compositePlanets = composite;
            const compositeRenderer = window.chartRenderers?.composite;
            if (typeof compositeRenderer === "function") {
              compositeRenderer(composite);
              // Copy composite birth details to synastry after composite renders
              copyCompositeBirthDetailsToSynastry();
            }
          }

          // Store transit planets for triwheel report
          if (form === "triwheel") {
            window.transitPlanets = outerPlanets;
            drawCurrentTriwheelAspects();
          }

          // OUTER PLANET SYMBOLS
          const spacedSymbols = symbolSpacing(
            outerPlanets,
            ascendantPosition,
            0.08,
          );
          spacedSymbols.forEach((planet) => {
            // Adjusted angle for symbols
            const adjustedAngle = planet.adjustedAngle;

            const x =
              width / 2 + planetCircleOuterRadius * Math.cos(adjustedAngle);
            const y =
              height / 2 + planetCircleOuterRadius * Math.sin(adjustedAngle);

            let planetSize = planetSizes;

            // Make smaller than inner planet size by a factor of 2
            planetSize *= innerPlanet ** 2;

            const planetKey = planet.name.toLowerCase().replace(/[\s-]+/g, "");
            const planetHref =
              planetImageCache[planetKey] || `/images/planets/${planetKey}.svg`;

            // Check if this is a custom point (renders text instead of image)
            if (planet.isCustomPoint && planet.displayLabel) {
              // Render text label for custom points (01, 02, etc.)
              // Use planetSize * 0.6 to get proportional font size matching planet SVGs
              const customFontSize = Math.round(planetSize * 0.6);
              svg
                .append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "central")
                .attr("font-family", "Arial, sans-serif")
                .attr("font-size", `${customFontSize}px`)
                .attr("font-weight", "bold")
                .attr("fill", "#2c3d4f")
                .attr("class", "transits custom-point-symbol")
                .style("filter", "drop-shadow(1px 1px 0px #999)")
                .style("cursor", "pointer")
                .text(planet.displayLabel)
                .on("click", function (event) {
                  event.stopPropagation();
                  const clickPosition = getRenderablePosition(planet) ?? planet.position;
                  const { hour, minute } = calculatePlanetDegrees(
                    clickPosition,
                    selectedZodiacSystem,
                  );
                  planet.hour = hour;
                  planet.minute = minute;

                  // For synastry charts, calculate Chart 2 planet's house position in Chart 1
                  if (form === "synastry" && chart1HouseCusps) {
                    planet.houseNatal = calculateHousePosition(
                      planet.position,
                      chart1HouseCusps,
                    );
                  }

                  showPlanetDetails(
                    planet,
                    form === "synastry" ? "synastry" : "transit",
                  );
                });
            } else {
              svg
                .append("image")
                .attr("xlink:href", planetHref) // data planet name to svg name
                .attr("x", x - planetSize / 2)
                .attr("y", y - planetSize / 2)
                .attr("width", planetSize)
                .attr("height", planetSize)
                .attr("class", "transits")
                .style("filter", `drop-shadow(1px 1px 0px #222)`)
                .style("cursor", "pointer")
                .on("mouseover", function () {
                  d3.select(this).style("cursor", "pointer");
                })
                .on("click", function (event) {
                  event.stopPropagation();
                  const clickPosition = getRenderablePosition(planet) ?? planet.position;
                  const { hour, minute } = calculatePlanetDegrees(
                    clickPosition,
                    selectedZodiacSystem,
                  );
                  planet.hour = hour;
                  planet.minute = minute;
                  if (planet.retrograde === true || planet.retrograde === 'sd' || planet.retrograde === 'sr') {
                    planet.retroIcon =
                      planet.retrograde === "sd"
                        ? "/images/misc/sd.svg"
                        : planet.retrograde === "sr"
                          ? "/images/misc/sr.svg"
                          : "/images/misc/retrograde.svg";
                  }

                  // For synastry charts, calculate Chart 2 planet's house position in Chart 1
                  if (form === "synastry" && chart1HouseCusps) {
                    planet.houseNatal = calculateHousePosition(
                      planet.position,
                      chart1HouseCusps,
                    );
                  }

                  showPlanetDetails(
                    planet,
                    form === "synastry" ? "synastry" : "transit",
                  );
                });
            }

            // Retrograde symbol
            if (planet.retrograde === true || planet.retrograde === 'sd' || planet.retrograde === 'sr') {
              let retrogradeOffset = 28;
              const retrogradeX =
                width / 2 +
                (planetCircleOuterRadius - retrogradeOffset) *
                  Math.cos(adjustedAngle);
              const retrogradeY =
                height / 2 +
                (planetCircleOuterRadius - retrogradeOffset) *
                  Math.sin(adjustedAngle);
              let retrogradeSvg;
              if (planet.retrograde === true) {
                retrogradeSvg = miscImageCache["retrograde"];
              } else if (planet.retrograde === "sd") {
                retrogradeSvg = miscImageCache["sd"];
              } else if (planet.retrograde === "sr") {
                retrogradeSvg = miscImageCache["sr"];
              }

              svg
                .append("image")
                .attr("xlink:href", retrogradeSvg)
                .attr("x", retrogradeX - 10)
                .attr("y", retrogradeY - 10)
                .attr("width", 18)
                .attr("height", 18)
                .attr("class", "transits")
                .style("opacity", 0.8);
            }
          });

          // PLANET TICKS
          outerPlanets.forEach((planet) => {
            const tickPosition = getRenderablePosition(planet) ?? planet.position;
            const angle =
              ((ascendantPosition - tickPosition - 180) * Math.PI) / 180;

            const tickLength = 16;

            // Inner sign circle tick
            let xInnerSign1 =
              width / 2 + (signInnerRadius - tickLength / 2) * Math.cos(angle);
            let yInnerSign1 =
              height / 2 + (signInnerRadius - tickLength / 2) * Math.sin(angle);
            let xInnerSign2 =
              width / 2 + (signInnerRadius + tickLength / 2) * Math.cos(angle);
            let yInnerSign2 =
              height / 2 + (signInnerRadius + tickLength / 2) * Math.sin(angle);

            // Get tick color - use black for custom points
            const tickColor = planet.isCustomPoint
              ? "#2c3d4f"
              : planetColors[planet.name.toLowerCase()];

            svg
              .append("line")
              .attr("x1", xInnerSign1)
              .attr("y1", yInnerSign1)
              .attr("x2", xInnerSign2)
              .attr("y2", yInnerSign2)
              .attr("class", "transits")
              .style("stroke", tickColor)
              .style("stroke-width", 4);
          });

          // TRANSITS AT MIDDLE WHEEL POSITION (for biwheel mode)
          // Only render for triwheel form - these will be shown when "Transits" biwheel mode is selected
          if (form === "triwheel") {
            const planetCircleCenterRadius = minDimension / centerPlanet;

            // MIDDLE POSITION TRANSIT PLANET SYMBOLS
            const spacedSymbolsMiddle = symbolSpacing(
              outerPlanets,
              ascendantPosition,
              0.1,
            );
            spacedSymbolsMiddle.forEach((planet) => {
              const adjustedAngle = planet.adjustedAngle;

              const x =
                width / 2 + planetCircleCenterRadius * Math.cos(adjustedAngle);
              const y =
                height / 2 + planetCircleCenterRadius * Math.sin(adjustedAngle);

              let planetSize = planetSizes;
              planetSize *= innerPlanet ** 2;

              const planetKey = planet.name
                .toLowerCase()
                .replace(/[\s-]+/g, "");
              const planetHref =
                planetImageCache[planetKey] ||
                `/images/planets/${planetKey}.svg`;

              if (planet.isCustomPoint && planet.displayLabel) {
                const customFontSize = Math.round(planetSize * 0.6);
                svg
                  .append("text")
                  .attr("x", x)
                  .attr("y", y)
                  .attr("text-anchor", "middle")
                  .attr("dominant-baseline", "central")
                  .attr("font-family", "Arial, sans-serif")
                  .attr("font-size", `${customFontSize}px`)
                  .attr("font-weight", "bold")
                  .attr("fill", "#2c3d4f")
                  .attr("class", "transits-middle custom-point-symbol")
                  .style("filter", "drop-shadow(1px 1px 0px #999)")
                  .style("cursor", "pointer")
                  .text(planet.displayLabel)
                  .on("click", function (event) {
                    event.stopPropagation();
                    const clickPosition = getRenderablePosition(planet) ?? planet.position;
                    const { hour, minute } = calculatePlanetDegrees(
                      clickPosition,
                      selectedZodiacSystem,
                    );
                    planet.hour = hour;
                    planet.minute = minute;
                    showPlanetDetails(planet, "transit");
                  });
              } else {
                svg
                  .append("image")
                  .attr("xlink:href", planetHref)
                  .attr("x", x - planetSize / 2)
                  .attr("y", y - planetSize / 2)
                  .attr("width", planetSize)
                  .attr("height", planetSize)
                  .attr("class", "transits-middle")
                  .style("filter", `drop-shadow(1px 1px 0px #222)`)
                  .style("cursor", "pointer")
                  .on("mouseover", function () {
                    d3.select(this).style("cursor", "pointer");
                  })
                  .on("click", function (event) {
                    event.stopPropagation();
                    const clickPosition = getRenderablePosition(planet) ?? planet.position;
                    const { hour, minute } = calculatePlanetDegrees(
                      clickPosition,
                      selectedZodiacSystem,
                    );
                    planet.hour = hour;
                    planet.minute = minute;
                    if (planet.retrograde === true || planet.retrograde === 'sd' || planet.retrograde === 'sr') {
                      planet.retroIcon =
                        planet.retrograde === "sd"
                          ? "/images/misc/sd.svg"
                          : planet.retrograde === "sr"
                            ? "/images/misc/sr.svg"
                            : "/images/misc/retrograde.svg";
                    }
                    showPlanetDetails(planet, "transit");
                  });
              }

              // Retrograde symbol
              if (planet.retrograde === true || planet.retrograde === 'sd' || planet.retrograde === 'sr') {
                let retrogradeOffset = 28;
                const retrogradeX =
                  width / 2 +
                  (planetCircleCenterRadius - retrogradeOffset) *
                    Math.cos(adjustedAngle);
                const retrogradeY =
                  height / 2 +
                  (planetCircleCenterRadius - retrogradeOffset) *
                    Math.sin(adjustedAngle);
                let retrogradeSvg;
                if (planet.retrograde === true) {
                  retrogradeSvg = miscImageCache["retrograde"];
                } else if (planet.retrograde === "sd") {
                  retrogradeSvg = miscImageCache["sd"];
                } else if (planet.retrograde === "sr") {
                  retrogradeSvg = miscImageCache["sr"];
                }

                svg
                  .append("image")
                  .attr("xlink:href", retrogradeSvg)
                  .attr("x", retrogradeX - 10)
                  .attr("y", retrogradeY - 10)
                  .attr("width", 18)
                  .attr("height", 18)
                  .attr("class", "transits-middle")
                  .style("opacity", 0.8);
              }
            });

            // MIDDLE POSITION TRANSIT PLANET TICKS
            outerPlanets.forEach((planet) => {
              const tickPosition = getRenderablePosition(planet) ?? planet.position;
              const angle =
                ((ascendantPosition - tickPosition - 180) * Math.PI) / 180;

              const tickLength = 16;

              let xInnerSign1 =
                width / 2 +
                (signInnerRadius * middleWheel - tickLength / 2) *
                  Math.cos(angle);
              let yInnerSign1 =
                height / 2 +
                (signInnerRadius * middleWheel - tickLength / 2) *
                  Math.sin(angle);
              let xInnerSign2 =
                width / 2 +
                (signInnerRadius * middleWheel + tickLength / 2) *
                  Math.cos(angle);
              let yInnerSign2 =
                height / 2 +
                (signInnerRadius * middleWheel + tickLength / 2) *
                  Math.sin(angle);

              const tickColor = planet.isCustomPoint
                ? "#2c3d4f"
                : planetColors[planet.name.toLowerCase()];

              svg
                .append("line")
                .attr("x1", xInnerSign1)
                .attr("y1", yInnerSign1)
                .attr("x2", xInnerSign2)
                .attr("y2", yInnerSign2)
                .attr("class", "transits-middle")
                .style("stroke", tickColor)
                .style("stroke-width", 4);
            });
          }

          // Triwheel aspects are drawn by drawCurrentTriwheelAspects() only after
          // both the current progression and transit calculations are available.

          // SYNASTRY ASPECTS
          if (
            form === "synastry" &&
            window.natalPlanets?.length &&
            window.synastryPlanets?.length
          ) {
            drawSynastryAspectLines(
              svg,
              window.natalPlanets,
              window.synastryPlanets,
              ascendantPosition,
              houseInnerRadius,
              width,
              height,
              "synastry",
            );

            svg.selectAll(".aspectarian-hotspot.synastry").remove();
            svg
              .append("circle")
              .attr("cx", width / 2)
              .attr("cy", height / 2)
              .attr("r", houseInnerRadius - 20)
              .attr("fill", "transparent")
              .attr("class", "aspectarian-hotspot synastry")
              .style("cursor", "pointer")
              .on("click", function (event) {
                event.stopPropagation();
                const natalName = JSON.parse(localStorage.getItem("natalData") || "{}").name || "Person 1";
                const synastryName = JSON.parse(localStorage.getItem("synastryData") || "{}").name || "Person 2";
                showAspectarianSynastry(
                  window.natalPlanets,
                  window.synastryPlanets,
                  {
                    chartAName: natalName,
                    chartBName: synastryName,
                  },
                );
              });
          }
        })
        .catch((error) => {
          const errorContainer =
            form === "synastry"
              ? document.querySelector("#synastryForm .errorMessageSynastry")
              : document.querySelector(".errorMessageTriwheel");

          console.error('sharedNatal triwheel transits error:', error);
          showTemporaryError(
            errorContainer,
            getErrorMessage(error),
          );
        })
        .finally(() => {
          transitsComplete = true;
          checkTriwheelGraphComplete();
          setTimeout(() => {
            // Don't hide overlay if graph is waiting for its own fetch
            if (!window._graphNeedsOverlay) {
              document.getElementById("loading-overlay").style.display = "none";
            }
          }, 300);
        });
    } else if (isGraphAutoSubmit) {
      // No transits fetch needed, mark as complete
      transitsComplete = true;
      checkTriwheelGraphComplete();
    }
  });
}

// PLANET SYMBOL SPACING
// Helper to get circular difference in radians:
function circularDiff(a, b) {
  const TWO_PI = 2 * Math.PI;
  let diff = b - a;
  diff = diff % TWO_PI;
  if (diff < 0) diff += TWO_PI;
  return diff;
}

function isAnglePoint(planet) {
  return isAngularPointName(planet?.name);
}

// Planet symbol spacing function
export function symbolSpacing(
  planets,
  ascendantPosition,
  minAngleSeparation = 0.12,
) {
  // Early return if no planets or empty array
  if (!planets || planets.length === 0) {
    return [];
  }

  const TWO_PI = 2 * Math.PI;
  const normalizeAngle = (angle) => {
    angle = angle % TWO_PI;
    if (angle < 0) angle += TWO_PI;
    return angle;
  };

  const rawPlanetData = planets.map((planet, index) => {
    const renderPosition = getRenderablePosition(planet);
    const rawRadians = normalizeAngle(
      ((ascendantPosition - Number(renderPosition ?? planet.position) - 180) * Math.PI) / 180,
    );

    return {
      ...planet,
      renderPosition: Number.isFinite(renderPosition) ? renderPosition : planet.renderPosition,
      originalIndex: index,
      rawAngle: rawRadians,
      adjustedAngle: rawRadians,
      isAnglePoint: isAnglePoint(planet),
    };
  });

  // ASC/MC/DSC/IC are structural angle symbols. They must stay glued to the
  // exact house/cusp anchor, while planets, asteroids and custom points around
  // them are shifted away. This prevents a planet from being drawn directly on
  // top of ASC/MC/IC/DSC without detaching those four labels from their houses.
  const lockedAngles = rawPlanetData.filter((planet) => planet.isAnglePoint);
  const movablePlanets = rawPlanetData.filter((planet) => !planet.isAnglePoint);

  if (rawPlanetData.length === 1 || movablePlanets.length === 0) {
    return rawPlanetData.sort((a, b) => a.adjustedAngle - b.adjustedAngle || a.originalIndex - b.originalIndex);
  }

  const safeMinSeparation = Math.max(0.02, Number(minAngleSeparation) || 0.12);
  const collisionPadding = 0.0006;

  const signedDiff = (from, to) => {
    let diff = normalizeAngle(to - from);
    if (diff > Math.PI) diff -= TWO_PI;
    return diff;
  };

  const moveAwayFromLockedAngles = (planet) => {
    if (planet.isAnglePoint || lockedAngles.length === 0) return;

    lockedAngles.forEach((locked, lockedIndex) => {
      const diff = signedDiff(locked.adjustedAngle, planet.adjustedAngle);
      const absDiff = Math.abs(diff);

      if (absDiff < safeMinSeparation + collisionPadding) {
        // Exact conjunctions need a deterministic side; otherwise stacked
        // symbols choose the same direction and remain visually piled up.
        const fallbackSide = ((planet.originalIndex + lockedIndex) % 2 === 0) ? 1 : -1;
        const side = absDiff < 0.000001 ? fallbackSide : Math.sign(diff);
        planet.adjustedAngle = normalizeAngle(
          locked.adjustedAngle + side * (safeMinSeparation + collisionPadding),
        );
      }
    });
  };

  // Reserve the angular-point zones before the general collision solver starts.
  movablePlanets.forEach(moveAwayFromLockedAngles);

  const allPlanets = [...lockedAngles, ...movablePlanets];

  const relaxSymbolCollisions = (iterations) => {
    for (let iteration = 0; iteration < iterations; iteration++) {
      let changed = false;
      allPlanets.sort((a, b) => a.adjustedAngle - b.adjustedAngle || a.originalIndex - b.originalIndex);

      for (let i = 0; i < allPlanets.length; i++) {
        const current = allPlanets[i];
        const next = allPlanets[(i + 1) % allPlanets.length];
        const gap = circularDiff(current.adjustedAngle, next.adjustedAngle);

        if (gap >= safeMinSeparation) continue;
        if (current.isAnglePoint && next.isAnglePoint) continue;

        const push = safeMinSeparation - gap + collisionPadding;

        if (current.isAnglePoint) {
          next.adjustedAngle = normalizeAngle(next.adjustedAngle + push);
        } else if (next.isAnglePoint) {
          current.adjustedAngle = normalizeAngle(current.adjustedAngle - push);
        } else {
          current.adjustedAngle = normalizeAngle(current.adjustedAngle - push / 2);
          next.adjustedAngle = normalizeAngle(next.adjustedAngle + push / 2);
        }

        changed = true;
      }

      // Keep the reserved ASC/MC/IC/DSC space intact after every relaxation
      // pass, because a planet-vs-planet adjustment can otherwise push a glyph
      // back onto an angular label.
      movablePlanets.forEach(moveAwayFromLockedAngles);
      if (!changed) break;
    }
  };

  relaxSymbolCollisions(Math.max(80, allPlanets.length * 16));

  // Deterministic pass for dense groups: keep movable objects in their visual
  // order and enforce the standard gap between neighbors, then re-check the
  // angular-point exclusion zones.
  movablePlanets.sort((a, b) => a.rawAngle - b.rawAngle || a.originalIndex - b.originalIndex);
  movablePlanets.forEach(moveAwayFromLockedAngles);

  for (let i = 1; i < movablePlanets.length; i++) {
    const prev = movablePlanets[i - 1];
    const curr = movablePlanets[i];
    const gap = circularDiff(prev.adjustedAngle, curr.adjustedAngle);

    if (gap < safeMinSeparation) {
      curr.adjustedAngle = normalizeAngle(prev.adjustedAngle + safeMinSeparation + collisionPadding);
      moveAwayFromLockedAngles(curr);
    }
  }

  // Final sweep catches wrap-around groups and chains created near 0°/360°.
  relaxSymbolCollisions(Math.max(50, allPlanets.length * 10));

  const combined = [...lockedAngles, ...movablePlanets];
  combined.sort((a, b) => a.adjustedAngle - b.adjustedAngle || a.originalIndex - b.originalIndex);
  return combined;
}

// Show aspect interpretation popup
function showAspectDetails(planet1Name, planet2Name, aspectType, orb, status) {
  const tooltip = d3.select("#tooltip");

  // Clear and create new popup
  tooltip.html("");

  const tp = tooltip
    .append("div")
    .attr("class", "planet-tooltip-instance")
    .style("pointer-events", "auto");

  const c = tp.append("div").attr("class", "tooltip-content");

  // Normalize planet names to match JSON keys and get display names
  const normalizeKey = (name) => {
    let key = name.toLowerCase().replace(/\s+/g, " ");
    if (key === "ascendant symbol") return "ascendant";
    if (key === "descendant symbol") return "descendant";
    return key;
  };

  const getDisplayName = (name) => {
    let key = name.toLowerCase().replace(/\s+/g, " ");
    if (key === "ascendant symbol") return "Ascendant";
    if (key === "descendant symbol") return "Descendant";
    return name;
  };

  const planet1Key = normalizeKey(planet1Name);
  const planet2Key = normalizeKey(planet2Name);
  const planet1Display = getDisplayName(planet1Name);
  const planet2Display = getDisplayName(planet2Name);

  // Get description from planetAspectDescriptions
  const description =
    planetAspectDescriptions[planet1Key]?.[planet2Key]?.[aspectType] ||
    planetAspectDescriptions[planet2Key]?.[planet1Key]?.[aspectType] ||
    "No description available";

  // Format aspect type for display
  const aspectTypeDisplay =
    aspectType.charAt(0).toUpperCase() + aspectType.slice(1);

  // Format orb (degrees and minutes)
  const orbNum = parseFloat(orb);
  const deg = Math.floor(orbNum);
  const min = Math.round((orbNum - deg) * 60);
  const orbText = `(${deg}° ${min}')`;

  // Get planet icons
  const planet1IconKey = planet1Name.toLowerCase().replace(/[\s-]+/g, "");
  const planet2IconKey = planet2Name.toLowerCase().replace(/[\s-]+/g, "");

  const planet1Icon = `<img src="/images/planets/${planet1IconKey}.svg" width="28" height="28" style="vertical-align:middle;margin:-6px 2px 0 -6px"/>`;
  const planet2Icon = `<img src="/images/planets/${planet2IconKey}.svg" width="28" height="28" style="vertical-align:middle;margin:-6px 2px 0 0"/>`;

  // Get aspect icon
  const aspectIcon = `<img src="/images/aspects/${aspectType}.svg" width="24" height="24" style="vertical-align:middle;margin:-2px -2px 0 4px"/>`;

  const isMobile = window.innerWidth < 600;
  const fs = isMobile ? "16px" : "20px";

  c
    .append("div")
    .attr("class", "aspect-details")
    .attr(
      "style",
      `white-space:normal;word-wrap:break-word;font-size:${fs};max-width:90vw;overflow-wrap:break-word;padding:10px;`,
    ).html(`
      <h3 style="margin:0 0 10px 0;">${planet1Icon}${planet1Display}${aspectIcon}${planet2Icon}${planet2Display} ${orbText}</h3>
      <p style="margin:0;"><strong>${aspectTypeDisplay}:</strong> ${description}</p>
    `);

  tooltip.style("opacity", 0.95);

  if (isMobile) {
    tooltip
      .style("top", "25%")
      .style("left", "0%")
      .style("transform", "translate(0,0)");
  } else {
    tooltip
      .style("top", "50%")
      .style("left", "50%")
      .style("transform", "translate(-50%, -50%)");
  }
}

// Aspectarian
function showAspectarian(planets) {
  // Early return if no planets or empty array
  if (!planets || planets.length === 0) {
    return;
  }

  const tooltip = d3.select("#tooltip");
  tooltip.html("");

  const aspectTooltip = tooltip
    .append("div")
    .attr("class", "planet-tooltip-instance")
    .style("pointer-events", "auto");

  const tooltipContent = aspectTooltip
    .append("div")
    .attr("class", "tooltip-content")
    .style("height", "auto")
    .style("overflow", "visible");

  // Get unique planet names and track custom points
  const visiblePlanetObjects = planets.filter(
    (p) =>
      p &&
      p.name &&
      window.planetsWithRenderedAspects?.has(p.name.toLowerCase()),
  );
  const visiblePlanets = visiblePlanetObjects.map((p) => p.name);

  // Create a map to check if a planet is a custom point
  const customPointMap = {};
  visiblePlanetObjects.forEach((p) => {
    if (p.isCustomPoint) {
      customPointMap[p.name] = p.displayLabel;
    }
  });

  // Early return if no visible planets
  if (visiblePlanets.length === 0) {
    return;
  }

  const aspectsMap = {};

  // Build matrix map
  planets.forEach((planet) => {
    if (!planet.aspects) return;
    aspectsMap[planet.name] = {};
    planet.aspects.forEach((aspect) => {
      if (visiblePlanets.includes(aspect.planet)) {
        aspectsMap[planet.name][aspect.planet] = {
          type: aspect.type,
          orb: aspect.orb.toFixed(2),
          status: aspect.status,
        };
      }
    });
  });

  // Create right triangle table
  const container = tooltipContent
    .append("div")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("gap", "6px");

  // Insert top header row with the first planet (e.g., Sun)
  const headerRow = container
    .append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "6px");

  // Empty placeholder for the top-left corner
  headerRow.append("div").style("width", "44px").style("height", "44px");

  // Add first planet (usually Sun) icon or custom point label
  const firstPlanetName = visiblePlanets[0];
  const firstPlanetKey = firstPlanetName.toLowerCase().replace(/[\s-]+/g, "");
  if (customPointMap[firstPlanetName]) {
    // Custom point - render text label
    headerRow
      .append("div")
      .style("width", "44px")
      .style("height", "44px")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("font-family", "Arial, sans-serif")
      .style("font-size", "22px")
      .style("font-weight", "bold")
      .style("color", "#2c3d4f")
      .style("margin-left", "14px")
      .text(customPointMap[firstPlanetName]);
  } else {
    headerRow
      .append("img")
      .attr(
        "src",
        planetImageCache[firstPlanetKey] ||
          `/images/planets/${firstPlanetKey}.svg`,
      )
      .attr("width", 44)
      .attr("height", 44)
      .style("margin-left", "14px");
  }

  // Table
  for (let row = 1; row < visiblePlanets.length; row++) {
    const rowDiv = container
      .append("div")
      .style("display", "flex")
      .style("gap", "6px")
      .style("align-items", "center");

    const planetName = visiblePlanets[row];
    const planetKey = planetName.toLowerCase().replace(/[\s-]+/g, "");

    if (customPointMap[planetName]) {
      // Custom point - render text label
      rowDiv
        .append("div")
        .style("width", "44px")
        .style("height", "44px")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "22px")
        .style("font-weight", "bold")
        .style("color", "#2c3d4f")
        .text(customPointMap[planetName]);
    } else {
      rowDiv
        .append("img")
        .attr(
          "src",
          planetImageCache[planetKey] || `/images/planets/${planetKey}.svg`,
        )
        .attr("width", 44)
        .attr("height", 44);
    }

    for (let col = 0; col < row; col++) {
      const p1 = visiblePlanets[col];
      const p2 = visiblePlanets[row];
      const aspect = aspectsMap[p2]?.[p1] || aspectsMap[p1]?.[p2] || null;

      const cell = rowDiv
        .append("div")
        .style("width", "68px")
        .style("height", "68px")
        .style("background", "#f9f9f9")
        .style("border", "1px solid #ccc")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("pointer-events", "auto");

      // Formats aspectarian degree text
      function formatOrb(orb, status) {
        const deg = Math.floor(orb);
        const min = Math.round((orb - deg) * 60);
        const letter = status === "applying" ? "A" : "S";
        const dStr = String(deg).padStart(2, "0");
        const mStr = String(min).padStart(2, "0");
        return `${dStr}${letter}${mStr}`;
      }

      if (aspect) {
        const aspectType = aspect.type.toLowerCase();
        const aspectSymbol =
          miscImageCache[aspectType] || `/images/aspects/${aspectType}.svg`;

        // Make cell clickable
        cell
          .style("cursor", "pointer")
          .on("click", function (event) {
            event.stopPropagation();
            event.preventDefault();
            setTimeout(() => {
              showAspectDetails(p1, p2, aspectType, aspect.orb, aspect.status);
            }, 10);
          })
          .on("mouseover", function () {
            d3.select(this).style("background", "#e8e8e8");
          })
          .on("mouseout", function () {
            d3.select(this).style("background", "#f9f9f9");
          });

        cell
          .append("img")
          .attr("src", aspectSymbol)
          .attr("width", 44)
          .attr("height", 44);
        cell
          .append("div")
          .style("font-size", "18px")
          .style("margin-top", "-4px")
          .style("color", aspect.status === "applying" ? "red" : "blue")
          .text(
            formatOrb(
              parseFloat(aspect.orb), // turn degree into a Number
              aspect.status, // add "applying" or "separating"
            ),
          );
      }
    }

    // Second column icon (end of row) - handle custom points
    if (customPointMap[planetName]) {
      // Custom point - render text label
      rowDiv
        .append("div")
        .style("width", "44px")
        .style("height", "44px")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "22px")
        .style("font-weight", "bold")
        .style("color", "#2c3d4f")
        .style("margin-left", "14px")
        .text(customPointMap[planetName]);
    } else {
      rowDiv
        .append("img")
        .attr(
          "src",
          planetImageCache[planetKey] || `/images/planets/${planetKey}.svg`,
        )
        .attr("width", 44)
        .attr("height", 44)
        .style("margin-left", "14px");
    }
  }

  // Scale based on number of rows
  const rowCount = visiblePlanets.length;

  let scale = 1;

  if (rowCount >= 13) {
    scale = 0.5;
  } else if (rowCount === 12 || rowCount === 11) {
    scale = 0.7;
  } else if (rowCount === 10) {
    scale = 0.9;
  } else if (rowCount <= 9) {
    scale = 1;
  }

  container
    .style("transform", `scale(${scale})`)
    .style("transform-origin", "top center")
    .style("transition", "transform 0.3s ease-in-out");

  // After building the full aspectarian...
  setTimeout(() => {
    const containerNode = container.node();

    const bounding = containerNode.getBoundingClientRect();
    const rawHeight = bounding.height;
    const scaleFactors = {
      12: 0.95,
      13: 0.9,
      14: 0.85,
      15: 0.8,
    };
    let scale = rowCount >= 16 ? 0.75 : (scaleFactors[rowCount] ?? 1);

    // Width-based scaling
    if (window.innerWidth < 300)
      scale *= 0.35; // very small mobile
    else if (window.innerWidth < 400)
      scale *= 0.4; // smaller mobile
    else if (window.innerWidth < 500)
      scale *= 0.5; // small mobile
    else if (window.innerWidth < 600)
      scale *= 0.6; // mobile
    else if (window.innerWidth < 800) scale *= 0.7;
    else if (window.innerWidth < 1000) scale *= 0.75;
    else if (window.innerWidth < 1400) scale *= 0.8;
    else if (window.innerWidth < 1800) scale *= 0.85;
    else if (window.innerWidth < 2400) scale *= 0.9;
    else scale *= 0.95;

    // Additional landscape mobile check (height-based)
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    if (viewportHeight < 500 && viewportWidth > viewportHeight) {
      scale = Math.min(scale, 0.5); // Use smaller of the two scales
    } else if (viewportHeight < 700 && viewportWidth > viewportHeight) {
      scale = Math.min(scale, 0.7); // Use smaller of the two scales
    }

    // iOS/iPadOS/Safari: zoom doesn't scale text properly, use transform instead
    // Other browsers: use zoom (preserves existing behavior)
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIPadOS = navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1;

    if (isIOS || isIPadOS) {
      // Recalculate initial transform scale (same logic as lines 4321-4329)
      let initialScale = 1;
      if (rowCount >= 13) initialScale = 0.5;
      else if (rowCount === 12 || rowCount === 11) initialScale = 0.7;
      else if (rowCount === 10) initialScale = 0.9;

      // Combine both scales into one transform (since zoom doesn't scale text on iOS)
      const combinedScale = initialScale * scale;

      container
        .style("transform", `scale(${combinedScale})`)
        .style("transform-origin", "top center")
        .style("transition", "all 0.3s ease-in-out");

      tooltipContent
        .style("width", `${bounding.width * scale}px`)
        .style("height", `${rawHeight * scale + 8}px`)
        .style("overflow", "hidden");
    } else {
      container
        .style("zoom", scale)
        .style("transition", "all 0.3s ease-in-out");

      // Set height of tooltip content to match the scaled content
      tooltipContent
        .style("height", `${rawHeight * scale + 8}px`)
        .style("overflow", "hidden");
    }
  }, 0);

  // Tooltip display
  tooltip.style("opacity", 0.95);

  // Center on screen
  tooltip
    .style("top", "50%")
    .style("left", "50%")
    .style("transform", "translate(-50%, -50%)");
}

// Synastry Aspectarian
export function showAspectarianSynastry(planetsA, planetsB, options = {}) {
  const { tooltipId = "#tooltip" } = options;

  // Get chart names
  const chartAName =
    options.chartAName ?? // explicit override
    JSON.parse(localStorage.getItem("natalData") || "{}").name ??
    "";

  const chartBName =
    options.chartBName ??
    JSON.parse(localStorage.getItem("synastryData") || "{}").name ??
    "";

  // User settings
  const { allowedAspects, allowedPlanets } = getCurrentAspectPrefs();

  const canonicalAllowedPlanets = allowedPlanets.length
    ? new Set(allowedPlanets.map(canonicalObjectName))
    : null;

  // Keep only enabled, finite and unique planets so the grid cannot repeat the same
  // body multiple times when a chart contains aliases such as Ascendant/Ascendant Symbol.
  planetsA = dedupePlanetsForAspects(planetsA).filter((p) => !canonicalAllowedPlanets || canonicalAllowedPlanets.has(canonicalObjectName(p.name)));
  planetsB = dedupePlanetsForAspects(planetsB).filter((p) => !canonicalAllowedPlanets || canonicalAllowedPlanets.has(canonicalObjectName(p.name)));

  const ASPECTS = getAspectMasterFromSettings();

  // Helpers
  function norm(v) {
    // 0-360 wrap
    v = v % 360;
    return v < 0 ? v + 360 : v;
  }

  function delta(a, b) {
    // smallest angle between two points
    const diff = Math.abs(norm(a) - norm(b));
    return diff > 180 ? 360 - diff : diff;
  }

  function findAspect(pA, pB) {
    // find aspects between two planets (using full planet objects for speed data)
    // For synastry/triwheel: pA is the reference chart (natal/person1) - treated as stationary
    // pB is the aspecting chart (transits/person2) - uses actual speed
    const d = delta(pA.position, pB.position);
    for (const asp of ASPECTS) {
      if (Math.abs(d - asp.deg) <= asp.orb) {
        // Calculate applying/separating using speed-based formula
        // 1) Compute signed difference in [–180, +180]:
        let raw = pA.position - pB.position;
        if (raw > 180) raw -= 360;
        else if (raw < -180) raw += 360;

        // 2) Compute how far from exact angle:
        const sep = Math.abs(raw);
        const diff = sep - asp.deg;

        // 3) Derivative of sep: positive → separating, negative → applying
        // pA (reference chart) is treated as stationary (speed = 0)
        // Only pB's speed is used (the aspecting/transiting planet)
        const speedB = pB.speed ?? 0;
        const deriv = Math.sign(raw) * (0 - speedB);

        // 4) If diff*deriv < 0, we're closing in → applying
        const applying = diff * deriv < 0;

        return {
          ...asp,
          orb: Math.abs(d - asp.deg),
          status: applying ? "applying" : "separating",
        };
      }
    }
    return null;
  }

  function formatOrb(orb, status) {
    // Formats aspectarian degree text (matches natal aspectarian format)
    const deg = Math.floor(orb);
    const min = Math.round((orb - deg) * 60);
    const letter = status === "applying" ? "A" : "S";
    const dStr = String(deg).padStart(2, "0");
    const mStr = String(min).padStart(2, "0");
    return `${dStr}${letter}${mStr}`;
  }

  // Tooltip
  const tooltip = d3.select(tooltipId);
  tooltip.html("");

  const wrapper = tooltip
    .append("div")
    .attr("class", "planet-tooltip-instance")
    .style("pointer-events", "auto")
    .style("display", "flex")
    .style("align-items", "center");

  // Add chart name to left (chartAName matches planetsA in rows)
  const leftName = wrapper
    .append("div")
    .style("overflow", "visible")
    .style("flex", "0 0 0")
    .style("width", "0")
    .style("margin-right", "24px")
    .style("margin-left", "12px")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("align-items", "center")
    .style("transform", "rotate(-90deg)")
    .style("transform-origin", "center")
    .style("white-space", "nowrap")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text(chartAName);

  const box = wrapper
    .append("div")
    .attr("class", "tooltip-content")
    .style("height", "auto")
    .style("overflow", "visible");

  // Planet lists. Do not reuse window.planetsWithRenderedAspects here: that set
  // belongs to the last natal/composite wheel and can wrongly hide or duplicate
  // synastry/transit cells after recalculation.
  const rows = planetsA.map((p) => p.name);
  const cols = planetsB.map((p) => p.name);

  // Create a map to check if a planet is a custom point
  const customPointMap = {};
  [...planetsA, ...planetsB].forEach((p) => {
    if (p.isCustomPoint) {
      customPointMap[p.name] = p.displayLabel;
    }
  });

  // Top icons
  const header = box
    .append("div")
    .style("display", "flex")
    .style("gap", "7px")
    .style("align-items", "center");

  // Add chart name to top (chartBName matches planetsB in columns)
  box
    .insert("div", ":first-child") // new row above header
    .style("text-align", "center")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .style("margin-bottom", "4px")
    .style("width", 60 * cols.length + 50 + "px") // icons width + stub cell
    .text(chartBName);

  header.append("div").style("width", "44px").style("height", "44px");

  cols.forEach((c) => {
    const key = c.toLowerCase().replace(/[\s-]+/g, "");
    const cell = header
      .append("div")
      .style("width", "68px")
      .style("height", "68px")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center");
    if (customPointMap[c]) {
      // Custom point - render text label
      cell
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "22px")
        .style("font-weight", "bold")
        .style("color", "#2c3d4f")
        .text(customPointMap[c]);
    } else {
      cell
        .append("img")
        .attr("src", planetImageCache[key] || `/images/planets/${key}.svg`)
        .attr("width", 44)
        .attr("height", 44);
    }
  });

  // Left icon and cells
  rows.forEach((rName, rIdx) => {
    const row = box
      .append("div")
      .style("display", "flex")
      .style("gap", "6px")
      .style("align-items", "center")
      .style("margin-bottom", "4px");

    // Left icons
    const rKey = rName.toLowerCase().replace(/[\s-]+/g, "");
    if (customPointMap[rName]) {
      // Custom point - render text label
      row
        .append("div")
        .style("width", "44px")
        .style("height", "44px")
        .style("display", "flex")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("font-family", "Arial, sans-serif")
        .style("font-size", "22px")
        .style("font-weight", "bold")
        .style("color", "#2c3d4f")
        .text(customPointMap[rName]);
    } else {
      row
        .append("img")
        .attr("src", planetImageCache[rKey] || `/images/planets/${rKey}.svg`)
        .attr("width", 44)
        .attr("height", 44);
    }

    // Cells
    cols.forEach((cName, cIdx) => {
      const cell = row
        .append("div")
        .style("width", "68px")
        .style("height", "68px")
        .style("background", "#f9f9f9")
        .style("border", "1px solid #ccc")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("align-items", "center")
        .style("justify-content", "center")
        .style("pointer-events", "auto");

      const pA = planetsA[rIdx];
      const pB = planetsB[cIdx];
      const aspect = findAspect(pA, pB);

      if (aspect) {
        const aspKey = aspect.type.toLowerCase();

        // Make cell clickable
        cell
          .style("cursor", "pointer")
          .on("click", function (event) {
            event.stopPropagation();
            event.preventDefault();
            setTimeout(() => {
              showAspectDetails(rName, cName, aspKey, aspect.orb, aspect.status);
            }, 10);
          })
          .on("mouseover", function () {
            d3.select(this).style("background", "#e8e8e8");
          })
          .on("mouseout", function () {
            d3.select(this).style("background", "#f9f9f9");
          });

        cell
          .append("img")
          .attr(
            "src",
            miscImageCache[aspKey] || `/images/aspects/${aspKey}.svg`,
          )
          .attr("width", 44)
          .attr("height", 44);
        cell
          .append("div")
          .style("font-size", "18px")
          .style("margin-top", "-4px")
          .style("color", aspect.status === "applying" ? "red" : "blue")
          .text(formatOrb(aspect.orb, aspect.status));
      }
    });
  });

  // Apply responsive scaling
  const totalPlanets = Math.max(rows.length, cols.length);
  let scale = 1;

  // Base scale by planet count
  if (totalPlanets >= 13) scale = 0.5;
  else if (totalPlanets >= 11) scale = 0.7;
  else if (totalPlanets === 10) scale = 0.9;

  // Adjust for screen size (slightly smaller for synastry since it's wider)
  if (window.innerWidth < 300)
    scale *= 0.3; // was 0.35
  else if (window.innerWidth < 400)
    scale *= 0.35; // was 0.4
  else if (window.innerWidth < 500)
    scale *= 0.45; // was 0.5
  else if (window.innerWidth < 600)
    scale *= 0.55; // was 0.6
  else if (window.innerWidth < 800)
    scale *= 0.65; // was 0.7
  else if (window.innerWidth < 1000)
    scale *= 0.7; // was 0.75
  else if (window.innerWidth < 1400)
    scale *= 0.75; // was 0.8
  else if (window.innerWidth < 1800)
    scale *= 0.8; // was 0.85
  else if (window.innerWidth < 2400)
    scale *= 0.85; // was 0.9
  else scale *= 0.9; // was 0.95

  // Additional landscape mobile check (height-based) - more aggressive for synastry
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  if (viewportHeight < 400 && viewportWidth > viewportHeight) {
    scale = Math.min(scale, 0.35); // Very aggressive for very short landscape
  } else if (viewportHeight < 500 && viewportWidth > viewportHeight) {
    scale = Math.min(scale, 0.4); // More aggressive than natal
  } else if (viewportHeight < 600 && viewportWidth > viewportHeight) {
    scale = Math.min(scale, 0.5); // More aggressive than natal
  } else if (viewportHeight < 700 && viewportWidth > viewportHeight) {
    scale = Math.min(scale, 0.6); // More aggressive than natal
  }

  // iOS/iPadOS/Safari: zoom doesn't scale text properly, use transform instead
  // Other browsers: use zoom (preserves existing behavior)
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isIPadOS = navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1;

  if (isIOS || isIPadOS) {
    // Get dimensions before transform
    const boxNode = box.node();
    const boxRect = boxNode.getBoundingClientRect();
    const marginRight = boxRect.width * (1 - scale);
    const marginBottom = boxRect.height * (1 - scale);

    box
      .style("transform", `scale(${scale})`)
      .style("transform-origin", "top left")
      .style("margin-right", `-${marginRight}px`)
      .style("margin-bottom", `-${marginBottom}px`);

    // leftName: scale margins proportionally (original: margin-left 12px, margin-right 24px)
    leftName
      .style("transform", `rotate(-90deg) scale(${scale})`)
      .style("transform-origin", "center")
      .style("margin-left", `${12 * scale}px`)
      .style("margin-right", `${24 * scale}px`);
  } else {
    box.style("zoom", scale);
    leftName.style("zoom", scale);
  }

  // Show & close behaviour
  tooltip.style("opacity", 0.95);

  // Center on screen
  tooltip
    .style("top", "50%")
    .style("left", "50%")
    .style("transform", "translate(-50%, -50%)");
  function close(e) {
    if (!tooltip.node().contains(e.target)) {
      tooltip.style("opacity", 0);
      document.removeEventListener("click", close, true);
    }
  }
  setTimeout(() => document.addEventListener("click", close, true), 0);
}

// Print natal chart
document.getElementById("natalPrint").addEventListener("click", function () {
  const chart = document.getElementById("natal-chart");
  if (!chart) return;

  // Open a dedicated print view for the natal chart in all browsers.
  openSafariPrintView("natal-chart", "Natal Chart");
});

// Print natal report
document.getElementById("natalReport").addEventListener("click", function () {
  // Open immediately on the click so View/Save Report is not blocked by async fetch.
  // This is also used by triwheel, return, synastry, and composite when they pass a pre-opened window.
  // Check if this is being called from triwheel, return, synastry, or composite report generation
  let printWindow =
    window.triwheelReportWindow ||
    window.returnReportWindow ||
    window.synastryReportWindow ||
    window.compositeReportWindow ||
    null;

  if (!printWindow) {
    printWindow = window.open(
      "about:blank",
      "_blank",
      "width=1000,height=1200,scrollbars=yes,resizable=yes",
    );
    if (printWindow) {
      printWindow.document.write(
        "<html><body style='font-family:Segoe UI,Arial,sans-serif;padding:24px'><p>Loading report...</p></body></html>",
      );
    }
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
        generateReport(printWindow);
      }
    })
    .catch((error) => {
      if (printWindow) printWindow.close();
      console.error("Error preparing report:", error);
    });

  // Helper function to wait for all images to load
  function waitForImages(container) {
    const images = container.querySelectorAll("img");
    const promises = Array.from(images).map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; // Continue even if image fails
      });
    });
    return Promise.all(promises);
  }

  // Helper function to generate aspect descriptions HTML
  function generateAspectDescriptionsHTML() {
    if (!window.natalPlanets?.length || !window.planetsWithRenderedAspects) {
      return "";
    }

    const aspectsHTML = [];
    const processedAspects = new Set(); // To avoid duplicate aspects

    window.natalPlanets.forEach((planet) => {
      // Skip custom points in report
      if (planet.isCustomPoint) return;
      if (
        !planet.aspects ||
        !window.planetsWithRenderedAspects.has(planet.name.toLowerCase())
      )
        return;

      planet.aspects.forEach((aspect) => {
        // Only include aspects that are rendered in the aspectarian
        if (!window.planetsWithRenderedAspects.has(aspect.planet.toLowerCase()))
          return;

        // Skip aspects to custom points in report
        const targetPlanet = window.natalPlanets.find(
          (p) => p.name.toLowerCase() === aspect.planet.toLowerCase(),
        );
        if (targetPlanet?.isCustomPoint) return;

        // Create unique key to avoid duplicates (e.g., Sun-Moon and Moon-Sun)
        const planet1Lower = planet.name.toLowerCase();
        const planet2Lower = aspect.planet.toLowerCase();
        const aspectKey =
          [planet1Lower, planet2Lower].sort().join("-") + "-" + aspect.type;
        if (processedAspects.has(aspectKey)) return;
        processedAspects.add(aspectKey);

        // Normalize planet names for JSON lookup
        const normalizeKey = (name) => {
          let key = name.toLowerCase().replace(/\s+/g, " ");
          if (key === "ascendant symbol") return "ascendant";
          if (key === "descendant symbol") return "descendant";
          return key;
        };

        const getDisplayName = (name) => {
          let key = name.toLowerCase().replace(/\s+/g, " ");
          if (key === "ascendant symbol") return "Ascendant";
          if (key === "descendant symbol") return "Descendant";
          return name;
        };

        const planet1Key = normalizeKey(planet.name);
        const planet2Key = normalizeKey(aspect.planet);
        const planet1Display = getDisplayName(planet.name);
        const planet2Display = getDisplayName(aspect.planet);
        const aspectType = aspect.type.toLowerCase();

        // Get description
        const description =
          planetAspectDescriptions[planet1Key]?.[planet2Key]?.[aspectType] ||
          planetAspectDescriptions[planet2Key]?.[planet1Key]?.[aspectType] ||
          "No description available";

        const aspectTypeDisplay =
          aspectType.charAt(0).toUpperCase() + aspectType.slice(1);

        // Format orb
        const orbNum = parseFloat(aspect.orb);
        const deg = Math.floor(orbNum);
        const min = Math.round((orbNum - deg) * 60);
        const orbText = `(${deg}° ${min}')`;

        // Get icon files
        let planet1IconFile = planet1Key.replace(/[\s-]+/g, "");
        if (planet1IconFile === "ascendant")
          planet1IconFile = "ascendantsymbol";

        let planet2IconFile = planet2Key.replace(/[\s-]+/g, "");
        if (planet2IconFile === "ascendant")
          planet2IconFile = "ascendantsymbol";

        const planet1ImageSrc =
          planetImageCache[planet1IconFile] ||
          `/images/planets/${planet1IconFile}.svg`;
        const planet2ImageSrc =
          planetImageCache[planet2IconFile] ||
          `/images/planets/${planet2IconFile}.svg`;
        const aspectImageSrc = `/images/aspects/${aspectType}.svg`;

        aspectsHTML.push(`
          <div style="margin-bottom: 48px;">
            <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
              <img src="${planet1ImageSrc}" alt="${planet1Display}" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
              ${planet1Display}
              <img src="${aspectImageSrc}" alt="${aspectTypeDisplay}" width="30" height="30" style="margin: 0 -4px;" />
              <img src="${planet2ImageSrc}" alt="${planet2Display}" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
              ${planet2Display} ${orbText}
            </h2>
            <p style="margin: 0;"><strong>${aspectTypeDisplay}:</strong> ${description}</p>
          </div>
        `);
      });
    });

    if (aspectsHTML.length > 0) {
      return `
        <h2 style="margin: 24px 0 24px; font-size: 24px; font-weight: bold; page-break-before: always;">Aspects</h2>
        ${aspectsHTML.join("")}
      `;
    }

    return "";
  }

  // Helper function to generate synastry aspect descriptions HTML
  function generateSynastryAspectDescriptionsHTML() {
    if (!window.person1Planets?.length || !window.synastryPlanets?.length) {
      return "";
    }

    // Get aspect settings
    const { allowedAspects, allowedPlanets } = getCurrentAspectPrefs();

    // Filter planets based on user settings (exclude custom points from report)
    const canonicalAllowedPlanets = allowedPlanets.length
      ? new Set(allowedPlanets.map(canonicalObjectName))
      : null;
    const person1Filtered = dedupePlanetsForAspects(window.person1Planets).filter(
      (p) => (!canonicalAllowedPlanets || canonicalAllowedPlanets.has(canonicalObjectName(p.name))) && !p.isCustomPoint,
    );
    const person2Filtered = dedupePlanetsForAspects(window.synastryPlanets).filter(
      (p) => (!canonicalAllowedPlanets || canonicalAllowedPlanets.has(canonicalObjectName(p.name))) && !p.isCustomPoint,
    );

    const ASPECTS = getAspectMasterFromSettings();

    // Calculate aspects between Person 1 and Person 2
    const norm = (v) => ((v % 360) + 360) % 360;
    const delta = (a, b) => {
      const d = Math.abs(norm(a) - norm(b));
      return d > 180 ? 360 - d : d;
    };
    const findAsp = (aDeg, bDeg) => {
      const d = delta(aDeg, bDeg);
      for (const asp of ASPECTS) {
        const orb = Math.abs(d - asp.deg);
        if (orb <= asp.orb) {
          return { ...asp, orb };
        }
      }
      return null;
    };

    const aspectsHTML = [];

    person1Filtered.forEach((planet1) => {
      person2Filtered.forEach((planet2) => {
        const aspect = findAsp(planet1.position, planet2.position);
        if (!aspect) return;

        // Normalize planet names for JSON lookup
        const normalizeKey = (name) => {
          let key = name.toLowerCase().replace(/\s+/g, " ");
          if (key === "ascendant symbol") return "ascendant";
          if (key === "descendant symbol") return "descendant";
          return key;
        };

        const getDisplayName = (name) => {
          let key = name.toLowerCase().replace(/\s+/g, " ");
          if (key === "ascendant symbol") return "Ascendant";
          if (key === "descendant symbol") return "Descendant";
          return name;
        };

        const planet1Key = normalizeKey(planet1.name);
        const planet2Key = normalizeKey(planet2.name);
        const planet1Display = getDisplayName(planet1.name);
        const planet2Display = getDisplayName(planet2.name);
        const aspectType = aspect.type.toLowerCase();

        // Get description
        const description =
          planetAspectDescriptions[planet1Key]?.[planet2Key]?.[aspectType] ||
          planetAspectDescriptions[planet2Key]?.[planet1Key]?.[aspectType] ||
          "No description available";

        const aspectTypeDisplay =
          aspectType.charAt(0).toUpperCase() + aspectType.slice(1);

        // Format orb
        const deg = Math.floor(aspect.orb);
        const min = Math.round((aspect.orb - deg) * 60);
        const orbText = `(${deg}° ${min}')`;

        // Get icon files
        let planet1IconFile = planet1Key.replace(/[\s-]+/g, "");
        if (planet1IconFile === "ascendant")
          planet1IconFile = "ascendantsymbol";

        let planet2IconFile = planet2Key.replace(/[\s-]+/g, "");
        if (planet2IconFile === "ascendant")
          planet2IconFile = "ascendantsymbol";

        const planet1ImageSrc =
          planetImageCache[planet1IconFile] ||
          `/images/planets/${planet1IconFile}.svg`;
        const planet2ImageSrc =
          planetImageCache[planet2IconFile] ||
          `/images/planets/${planet2IconFile}.svg`;
        const aspectImageSrc = `/images/aspects/${aspectType}.svg`;

        aspectsHTML.push(`
          <div style="margin-bottom: 48px;">
            <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
              <img src="${planet1ImageSrc}" alt="${planet1Display}" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
              ${planet1Display}
              <img src="${aspectImageSrc}" alt="${aspectTypeDisplay}" width="30" height="30" style="margin: 0 -4px;" />
              <img src="${planet2ImageSrc}" alt="${planet2Display}" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
              ${planet2Display} ${orbText}
            </h2>
            <p style="margin: 0;"><strong>${aspectTypeDisplay}:</strong> ${description}</p>
          </div>
        `);
      });
    });

    if (aspectsHTML.length > 0) {
      return `
        <h2 style="margin: 24px 0 24px; font-size: 24px; font-weight: bold; page-break-before: always;">Aspects</h2>
        ${aspectsHTML.join("")}
      `;
    }

    return "";
  }

  async function generateReport(preOpenedWindow) {
    // Always wait for interpretation JSON before building View/Save Report,
    // otherwise the report can open with only titles or "No description available".
    try {
      await trueSkyDescriptionDataReady;
    } catch (err) {
      console.warn("Planet description files were not fully loaded before report generation.", err);
    }

    // Use appropriate chart container based on report type
    const chartContainerId = window.isTriwheelReport
      ? "triwheel-chart"
      : window.isReturnReport
        ? "return-chart"
        : window.isSynastryReport
          ? "synastry-chart"
          : window.isCompositeReport
            ? "composite-chart"
            : window.isCompositeBlankReport
              ? "composite-chart-blank"
              : window.isGraphReport
                ? "graph"
                : "natal-chart";
    const chartContainer = document.getElementById(chartContainerId);
    if (!chartContainer) return;

    // Check if Safari - iOS devices are always Safari, or check for Safari on desktop
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSafari =
      isIOS || /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // Check if mobile
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(
      navigator.userAgent,
    );

    // For non-Safari mobile, add content to DOM early and wait longer for rendering
    if (false && isMobileDevice && !isSafari) {
      // Add class for CSS overrides
      document.body.classList.add("mobile-report-print");

      // Create report content just like desktop but add it early
      const report = document.createElement("div");
      report.id = "reportDescriptions";
      report.style.padding = "20px";
      report.style.fontSize = "20px";
      report.style.lineHeight = "1.4em";
      report.style.pageBreakBefore = "always";

      // Add planet descriptions (exclude custom points from report)
      if (window.natalPlanets?.length > 0) {
        const sortedPlanets = [...window.natalPlanets]
          .filter((p) => !p.isCustomPoint)
          .sort((a, b) => {
            const aKey = a.name.toLowerCase();
            const bKey = b.name.toLowerCase();
            if (aKey === "ascendant symbol") return -1;
            if (bKey === "ascendant symbol") return 1;
            return 0;
          });

        let currentSection = null;
        sortedPlanets.forEach((planet) => {
          // Handle graph items differently
          if (planet.isGraphItem) {
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
            const dateStr = planet.date
              ? `${planet.date.day} ${monthNames[planet.date.month - 1]} ${
                  planet.date.year
                }`
              : "";
            const chartTypeLabel =
              planet.chartType === "transit" ? "Transiting" : "Progressed";

            if (planet.itemType === "aspect") {
              const planet1Key = planet.name.toLowerCase().replace(/\s+/g, " ");
              const planet2Key = planet.planet2
                .toLowerCase()
                .replace(/\s+/g, " ");
              const aspectType = planet.aspectType.toLowerCase();

              const description =
                planetAspectDescriptions[planet1Key]?.[planet2Key]?.[
                  aspectType
                ] ||
                planetAspectDescriptions[planet2Key]?.[planet1Key]?.[
                  aspectType
                ] ||
                "No description available";

              const aspectTypeDisplay =
                planet.aspectType.charAt(0).toUpperCase() +
                planet.aspectType.slice(1);

              // Determine planet2 type label (like "Natal", "Transiting", etc.)
              let planet2TypeLabel = "";
              if (planet.planet2Type === "natal") {
                planet2TypeLabel = "Natal ";
              } else if (planet.planet2Type === "transit") {
                planet2TypeLabel = "Transiting ";
              } else if (planet.planet2Type === "progressed") {
                planet2TypeLabel = "Progressed ";
              }

              // Only show orb for non-graph reports (graph items don't have orb)
              const orbText =
                planet.orb !== undefined
                  ? ` (${Math.floor(planet.orb)}° ${Math.round(
                      (planet.orb - Math.floor(planet.orb)) * 60,
                    )}')`
                  : "";

              const planet1IconFile = planet1Key.replace(/[\s-]+/g, "");
              const planet2IconFile = planet2Key.replace(/[\s-]+/g, "");
              const planet1ImageSrc =
                planetImageCache[planet1IconFile] ||
                `/images/planets/${planet1IconFile}.svg`;
              const planet2ImageSrc =
                planetImageCache[planet2IconFile] ||
                `/images/planets/${planet2IconFile}.svg`;
              const aspectImageSrc = `/images/aspects/${aspectType}.svg`;

              report.innerHTML += `
                <div style="margin-bottom: 48px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                    <img src="${planet1ImageSrc}" alt="${
                      planet.name
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${chartTypeLabel} ${planet.name}
                    <img src="${aspectImageSrc}" alt="${aspectTypeDisplay}" width="30" height="30" style="margin: 0 -4px;" />
                    <img src="${planet2ImageSrc}" alt="${
                      planet.planet2
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${planet2TypeLabel}${planet.planet2}${orbText}
                  </h2>
                  <p style="margin: 0;"><strong>${aspectTypeDisplay}:</strong> ${description}</p>
                  ${
                    dateStr
                      ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">Exact: ${dateStr}</p>`
                      : ""
                  }
                </div>
              `;
            } else if (planet.itemType === "house_ingress") {
              const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
              const houseDescriptions =
                planet.chartType === "progressed"
                  ? progressedPlanetHouseDescriptions
                  : transitPlanetHouseDescriptions;
              const description =
                houseDescriptions[planetKey]?.[planet.house] ||
                "No description available";

              const planetIconFile = planetKey.replace(/[\s-]+/g, "");
              const planetImageSrc =
                planetImageCache[planetIconFile] ||
                `/images/planets/${planetIconFile}.svg`;

              report.innerHTML += `
                <div style="margin-bottom: 48px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                    <img src="${planetImageSrc}" alt="${
                      planet.name
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${chartTypeLabel} ${planet.name} in House ${planet.house}
                  </h2>
                  <p style="margin: 0;">${description}</p>
                  ${
                    dateStr
                      ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">Date: ${dateStr}</p>`
                      : ""
                  }
                </div>
              `;
            } else if (planet.itemType === "station") {
              const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
              const description =
                graphPlanetRetroDescriptions[planetKey]?.station ||
                "No description available";

              const planetIconFile = planetKey.replace(/[\s-]+/g, "");
              const planetImageSrc =
                planetImageCache[planetIconFile] ||
                `/images/planets/${planetIconFile}.svg`;

              report.innerHTML += `
                <div style="margin-bottom: 48px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                    <img src="${planetImageSrc}" alt="${
                      planet.name
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${chartTypeLabel} ${planet.name} Station
                  </h2>
                  <p style="margin: 0;">${description}</p>
                  ${
                    dateStr
                      ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">Date: ${dateStr}</p>`
                      : ""
                  }
                </div>
              `;
            } else if (planet.itemType === "sign_ingress") {
              const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
              const planetIconFile = planetKey.replace(/[\s-]+/g, "");
              const planetImageSrc =
                planetImageCache[planetIconFile] ||
                `/images/planets/${planetIconFile}.svg`;

              report.innerHTML += `
                <div style="margin-bottom: 48px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                    <img src="${planetImageSrc}" alt="${
                      planet.name
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${chartTypeLabel} ${planet.name} enters ${planet.sign}
                  </h2>
                  ${
                    dateStr
                      ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">Date: ${dateStr}</p>`
                      : ""
                  }
                </div>
              `;
            }
            return; // Skip the regular planet handling
          }

          // Add section header if reportSection changes
          if (planet.reportSection && planet.reportSection !== currentSection) {
            currentSection = planet.reportSection;
            report.innerHTML += `
              <h2 style="margin: 24px 0 24px; font-size: 24px; font-weight: bold; page-break-before: always;">
                ${currentSection}
              </h2>
            `;
          }

          let planetKey = planet.name.toLowerCase();
          let displayName = planet.name;
          if (planetKey === "ascendant symbol") {
            planetKey = "ascendant";
            displayName = "Ascendant";
          } else if (planetKey === "descendant symbol") {
            planetKey = "descendant";
            displayName = "Descendant";
          }

          // Select appropriate description set based on chart type
          const chartType = planet.chartType || "natal";
          let signDescriptions = planetSignDescriptions;
          let houseDescriptions = planetHouseDescriptions;
          if (chartType === "progressed") {
            signDescriptions = progressedPlanetSignDescriptions;
            houseDescriptions = progressedPlanetHouseDescriptions;
          } else if (chartType === "transit") {
            signDescriptions = transitPlanetSignDescriptions;
            houseDescriptions = transitPlanetHouseDescriptions;
          } else if (chartType === "solar_return") {
            signDescriptions = solarReturnPlanetSignDescriptions;
            houseDescriptions = solarReturnPlanetHouseDescriptions;
          } else if (chartType === "lunar_return") {
            signDescriptions = lunarReturnPlanetSignDescriptions;
            houseDescriptions = lunarReturnPlanetHouseDescriptions;
          } else if (chartType === "synastry") {
            signDescriptions = synastryPlanetSignDescriptions;
            houseDescriptions = synastryPlanetHouseDescriptions;
          } else if (chartType === "composite") {
            signDescriptions = compositePlanetSignDescriptions;
            houseDescriptions = compositePlanetHouseDescriptions;
          }

          const signKey = planet.sign.toLowerCase();
          const signDesc =
            signDescriptions[planetKey]?.[signKey] ||
            "No description available";

          const isAngle =
            planetKey === "ascendant" ||
            planetKey === "descendant" ||
            planetKey === "midheaven" ||
            planetKey === "imum coeli";

          // Use houseNatal (natal-relative house) if available, otherwise use house
          const houseToUse = planet.houseNatal || planet.house;

          const houseLabel =
            !isAngle && houseToUse ? `House ${houseToUse}` : "";

          const fullLabel =
            houseLabel !== ""
              ? `${displayName} in ${planet.sign} ${houseLabel}`
              : `${displayName} in ${planet.sign}`;

          // Skip sign description for Galactic Center (doesn't change signs)
          const signLine =
            planetKey === "galactic center"
              ? ""
              : `<strong>${displayName} in ${planet.sign}:</strong> ${signDesc}`;

          const houseLine =
            !isAngle && houseToUse && houseDescriptions[planetKey]?.[houseToUse]
              ? `<strong>${displayName} in House ${houseToUse}:</strong> ${houseDescriptions[planetKey][houseToUse]}`
              : "";

          const planetIconFile =
            planetKey === "ascendant"
              ? "ascendantsymbol"
              : planetKey.replace(/[\s-]+/g, "");

          const planetImageSrc =
            planetImageCache[planetIconFile] ||
            `/images/planets/${planetIconFile}.svg`;

          report.innerHTML += `
            <div style="margin-bottom: 48px;">
              <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                <img src="${planetImageSrc}" alt="${displayName}" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                ${fullLabel}
              </h2>
              ${
                signLine ? `<p style="margin: 0 0 12px 0;">${signLine}</p>` : ""
              }
              ${houseLine ? `<p style="margin: 0;">${houseLine}</p>` : ""}
            </div>
          `;
        });
      }

      // Add aspect descriptions (skip for graph reports)
      if (!window.isGraphReport) {
        const aspectDescHTML = window.isSynastryReport
          ? generateSynastryAspectDescriptionsHTML()
          : generateAspectDescriptionsHTML();
        if (aspectDescHTML) {
          report.innerHTML += aspectDescHTML;
        }
      }

      // Add to chart container
      chartContainer.appendChild(report);

      // Add aspectarian visual at the end (skip for triwheel and graph reports)
      if (!window.isTriwheelReport && !window.isGraphReport) {
        // For synastry reports, use synastry aspectarian (Person 1 vs Person 2)
        // Filter out custom points from report aspectarian
        if (window.isSynastryReport) {
          const filteredPerson1 =
            window.person1Planets?.filter((p) => !p.isCustomPoint) || [];
          const filteredSynastry =
            window.synastryPlanets?.filter((p) => !p.isCustomPoint) || [];
          showAspectarianSynastry(filteredPerson1, filteredSynastry);
        } else {
          const filteredPlanets =
            window.natalPlanets?.filter((p) => !p.isCustomPoint) || [];
          showAspectarian(filteredPlanets);
        }
        const tooltip = document.querySelector("#tooltip");
        const clonedAspect = tooltip
          ?.querySelector(".planet-tooltip-instance .tooltip-content")
          ?.cloneNode(true);

        if (clonedAspect) {
          const aspectarianHeader = document.createElement("h2");
          aspectarianHeader.textContent = "Aspectarian";
          aspectarianHeader.style.margin = "24px 0 12px";
          aspectarianHeader.style.fontSize = "24px";
          aspectarianHeader.style.fontWeight = "bold";
          aspectarianHeader.style.pageBreakBefore = "always";
          report.appendChild(aspectarianHeader);
          report.appendChild(clonedAspect);
        }

        // Hide tooltip
        if (tooltip) tooltip.style.opacity = "0";
      }

      // Create a temporary report section (like other tabs)
      // IMPORTANT: At this point, chartContainer contains both the chart SVG and the full report with aspectarian
      const reportSection = document.createElement("div");
      reportSection.id = "showReport";
      reportSection.style.display = "none";
      // Just copy everything from chartContainer - it already has the proper structure
      reportSection.innerHTML = `
        <div style="width: 100%;">
          ${chartContainer.innerHTML}
        </div>
      `;

      // Add to body at the same level as other sections (not inside showNatal)
      document.body.appendChild(reportSection);

      // Hide all existing sections (replicate hideAllSections functionality)
      const sectionsToHide = [
        "showNatal",
        "showTriwheel",
        "showGraph",
        "showReturn",
        "showSettings",
        "showSynastry",
        "showComposite",
        "showAccount",
      ];
      sectionsToHide.forEach((id) => {
        const element = document.getElementById(id);
        if (element) element.style.display = "none";
      });

      // Show only the report section
      reportSection.style.display = "block";

      // Push a history state so back button returns to chart instead of leaving page
      window.history.pushState({ reportView: true }, "", window.location.href);

      // Handle browser back button
      const handlePopState = (e) => {
        // If going back from report view, handle it
        if (document.getElementById("showReport")) {
          returnToMain();
        }
      };
      window.addEventListener("popstate", handlePopState, { once: true });

      // Add click handler to MAIN button to return to chart
      const mainButton = document.getElementById("natal-button");
      const originalMainHandler = mainButton.onclick;
      const returnToMain = () => {
        // Clean up the popstate listener if it hasn't fired
        window.removeEventListener("popstate", handlePopState);

        // FIRST: Remove report section immediately to prevent any interactions
        const existingReport = document.getElementById("showReport");
        if (existingReport) existingReport.remove();

        // Clean up the report content from inside natal-chart (original, not the copy)
        const reportInNatalChart = chartContainer.querySelector(
          "#reportDescriptions",
        );
        if (reportInNatalChart) reportInNatalChart.remove();

        // Clean up the report that was added to the original chart container
        if (report && report.parentNode) {
          report.remove();
        }

        // Remove print classes
        document.body.classList.remove("mobile-print-active");
        document.body.classList.remove("mobile-report-print");

        // THEN: Wait a tiny bit before showing main page to ensure click event is dead
        setTimeout(() => {
          // Show natal section
          const natalSection = document.getElementById("showNatal");
          if (natalSection) natalSection.style.display = "block";

          // Hide other sections
          sectionsToHide
            .filter((id) => id !== "showNatal")
            .forEach((id) => {
              const element = document.getElementById(id);
              if (element) element.style.display = "none";
            });
        }, 100);
      };

      // Make MAIN button return to chart view
      mainButton.addEventListener("click", returnToMain, { once: true });

      // Add class for print CSS
      document.body.classList.add("mobile-print-active");

      // Force layout recalculation
      document.body.offsetHeight;

      // Wait then print
      setTimeout(() => {
        window.print();

        // Return to main when user interacts with page after printing
        let returned = false;

        const handleInteraction = (e) => {
          // Ignore if clicking the MAIN button (let its handler work)
          if (e.target && e.target.id === "natal-button") return;

          if (!returned) {
            returned = true;
            document.removeEventListener("click", handleInteraction);
            document.removeEventListener("touchstart", handleInteraction);
            returnToMain();
          }
        };

        // Wait a bit for print dialog to open, then listen for interaction
        setTimeout(() => {
          document.addEventListener("click", handleInteraction);
          document.addEventListener("touchstart", handleInteraction);
        }, 500); // Wait 500ms for print dialog to open
      }, 500);

      return;
    }

    // Dedicated report window for every browser. This keeps Save/Print Report stable and avoids
    // the main-app layout, transforms, and hidden panels from bleeding into the saved PDF.
    const useDedicatedReportWindow = true;
    if (useDedicatedReportWindow) {
      // First, generate the aspectarian to get its HTML (skip for triwheel and graph reports)
      let aspectarianHTML = "";
      if (!window.isTriwheelReport && !window.isGraphReport) {
        // For synastry reports, use synastry aspectarian (Person 1 vs Person 2)
        // Filter out custom points from report aspectarian
        if (window.isSynastryReport) {
          const filteredPerson1 =
            window.person1Planets?.filter((p) => !p.isCustomPoint) || [];
          const filteredSynastry =
            window.synastryPlanets?.filter((p) => !p.isCustomPoint) || [];
          showAspectarianSynastry(filteredPerson1, filteredSynastry);
        } else {
          const filteredPlanets =
            window.natalPlanets?.filter((p) => !p.isCustomPoint) || [];
          showAspectarian(filteredPlanets);
        }
        const tooltip = document.querySelector("#tooltip");
        aspectarianHTML =
          tooltip?.querySelector(".planet-tooltip-instance .tooltip-content")
            ?.outerHTML || "";
        // Hide the tooltip after capturing
        if (tooltip) tooltip.style.opacity = "0";
      }

      // Create report content
      const report = document.createElement("div");
      report.id = "reportDescriptions";
      report.style.padding = "20px";
      report.style.fontSize = "20px";
      report.style.lineHeight = "1.4em";

      // Add planet descriptions first (exclude custom points from report)
      if (window.natalPlanets?.length > 0) {
        const sortedPlanets = [...window.natalPlanets]
          .filter((p) => !p.isCustomPoint)
          .sort((a, b) => {
            const aKey = a.name.toLowerCase();
            const bKey = b.name.toLowerCase();
            if (aKey === "ascendant symbol") return -1;
            if (bKey === "ascendant symbol") return 1;
            return 0;
          });

        let currentSection = null;
        sortedPlanets.forEach((planet) => {
          // Handle graph items differently
          if (planet.isGraphItem) {
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
            const dateStr = planet.date
              ? `${planet.date.day} ${monthNames[planet.date.month - 1]} ${
                  planet.date.year
                }`
              : "";
            const chartTypeLabel =
              planet.chartType === "transit" ? "Transiting" : "Progressed";

            if (planet.itemType === "aspect") {
              const planet1Key = planet.name.toLowerCase().replace(/\s+/g, " ");
              const planet2Key = planet.planet2
                .toLowerCase()
                .replace(/\s+/g, " ");
              const aspectType = planet.aspectType.toLowerCase();

              const description =
                planetAspectDescriptions[planet1Key]?.[planet2Key]?.[
                  aspectType
                ] ||
                planetAspectDescriptions[planet2Key]?.[planet1Key]?.[
                  aspectType
                ] ||
                "No description available";

              const aspectTypeDisplay =
                planet.aspectType.charAt(0).toUpperCase() +
                planet.aspectType.slice(1);

              // Determine planet2 type label (like "Natal", "Transiting", etc.)
              let planet2TypeLabel = "";
              if (planet.planet2Type === "natal") {
                planet2TypeLabel = "Natal ";
              } else if (planet.planet2Type === "transit") {
                planet2TypeLabel = "Transiting ";
              } else if (planet.planet2Type === "progressed") {
                planet2TypeLabel = "Progressed ";
              }

              // Only show orb for non-graph reports (graph items don't have orb)
              const orbText =
                planet.orb !== undefined
                  ? ` (${Math.floor(planet.orb)}° ${Math.round(
                      (planet.orb - Math.floor(planet.orb)) * 60,
                    )}')`
                  : "";

              const planet1IconFile = planet1Key.replace(/[\s-]+/g, "");
              const planet2IconFile = planet2Key.replace(/[\s-]+/g, "");
              const planet1ImageSrc =
                planetImageCache[planet1IconFile] ||
                `/images/planets/${planet1IconFile}.svg`;
              const planet2ImageSrc =
                planetImageCache[planet2IconFile] ||
                `/images/planets/${planet2IconFile}.svg`;
              const aspectImageSrc = `/images/aspects/${aspectType}.svg`;

              report.innerHTML += `
                <div style="margin-bottom: 48px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                    <img src="${planet1ImageSrc}" alt="${
                      planet.name
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${chartTypeLabel} ${planet.name}
                    <img src="${aspectImageSrc}" alt="${aspectTypeDisplay}" width="30" height="30" style="margin: 0 -4px;" />
                    <img src="${planet2ImageSrc}" alt="${
                      planet.planet2
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${planet2TypeLabel}${planet.planet2}${orbText}
                  </h2>
                  <p style="margin: 0;"><strong>${aspectTypeDisplay}:</strong> ${description}</p>
                  ${
                    dateStr
                      ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">Exact: ${dateStr}</p>`
                      : ""
                  }
                </div>
              `;
            } else if (planet.itemType === "house_ingress") {
              const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
              const houseDescriptions =
                planet.chartType === "progressed"
                  ? progressedPlanetHouseDescriptions
                  : transitPlanetHouseDescriptions;
              const description =
                houseDescriptions[planetKey]?.[planet.house] ||
                "No description available";

              const planetIconFile = planetKey.replace(/[\s-]+/g, "");
              const planetImageSrc =
                planetImageCache[planetIconFile] ||
                `/images/planets/${planetIconFile}.svg`;

              report.innerHTML += `
                <div style="margin-bottom: 48px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                    <img src="${planetImageSrc}" alt="${
                      planet.name
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${chartTypeLabel} ${planet.name} in House ${planet.house}
                  </h2>
                  <p style="margin: 0;">${description}</p>
                  ${
                    dateStr
                      ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">Date: ${dateStr}</p>`
                      : ""
                  }
                </div>
              `;
            } else if (planet.itemType === "station") {
              const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
              const description =
                graphPlanetRetroDescriptions[planetKey]?.station ||
                "No description available";

              const planetIconFile = planetKey.replace(/[\s-]+/g, "");
              const planetImageSrc =
                planetImageCache[planetIconFile] ||
                `/images/planets/${planetIconFile}.svg`;

              report.innerHTML += `
                <div style="margin-bottom: 48px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                    <img src="${planetImageSrc}" alt="${
                      planet.name
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${chartTypeLabel} ${planet.name} Station
                  </h2>
                  <p style="margin: 0;">${description}</p>
                  ${
                    dateStr
                      ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">Date: ${dateStr}</p>`
                      : ""
                  }
                </div>
              `;
            } else if (planet.itemType === "sign_ingress") {
              const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
              const planetIconFile = planetKey.replace(/[\s-]+/g, "");
              const planetImageSrc =
                planetImageCache[planetIconFile] ||
                `/images/planets/${planetIconFile}.svg`;

              report.innerHTML += `
                <div style="margin-bottom: 48px;">
                  <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                    <img src="${planetImageSrc}" alt="${
                      planet.name
                    }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                    ${chartTypeLabel} ${planet.name} enters ${planet.sign}
                  </h2>
                  ${
                    dateStr
                      ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">Date: ${dateStr}</p>`
                      : ""
                  }
                </div>
              `;
            }
            return; // Skip the regular planet handling
          }

          // Add section header if reportSection changes
          if (planet.reportSection && planet.reportSection !== currentSection) {
            currentSection = planet.reportSection;
            report.innerHTML += `
              <h2 style="margin: 24px 0 24px; font-size: 24px; font-weight: bold; page-break-before: always;">
                ${currentSection}
              </h2>
            `;
          }

          let planetKey = planet.name.toLowerCase();
          let displayName = planet.name;
          if (planetKey === "ascendant symbol") {
            planetKey = "ascendant";
            displayName = "Ascendant";
          } else if (planetKey === "descendant symbol") {
            planetKey = "descendant";
            displayName = "Descendant";
          }

          // Select appropriate description set based on chart type
          const chartType = planet.chartType || "natal";
          let signDescriptions = planetSignDescriptions;
          let houseDescriptions = planetHouseDescriptions;
          if (chartType === "progressed") {
            signDescriptions = progressedPlanetSignDescriptions;
            houseDescriptions = progressedPlanetHouseDescriptions;
          } else if (chartType === "transit") {
            signDescriptions = transitPlanetSignDescriptions;
            houseDescriptions = transitPlanetHouseDescriptions;
          } else if (chartType === "solar_return") {
            signDescriptions = solarReturnPlanetSignDescriptions;
            houseDescriptions = solarReturnPlanetHouseDescriptions;
          } else if (chartType === "lunar_return") {
            signDescriptions = lunarReturnPlanetSignDescriptions;
            houseDescriptions = lunarReturnPlanetHouseDescriptions;
          } else if (chartType === "synastry") {
            signDescriptions = synastryPlanetSignDescriptions;
            houseDescriptions = synastryPlanetHouseDescriptions;
          } else if (chartType === "composite") {
            signDescriptions = compositePlanetSignDescriptions;
            houseDescriptions = compositePlanetHouseDescriptions;
          }

          const signKey = planet.sign.toLowerCase();
          const signDesc =
            signDescriptions[planetKey]?.[signKey] ||
            "No description available";

          const isAngle =
            planetKey === "ascendant" ||
            planetKey === "descendant" ||
            planetKey === "midheaven" ||
            planetKey === "imum coeli";

          // Use houseNatal (natal-relative house) if available, otherwise use house
          const houseToUse = planet.houseNatal || planet.house;

          const houseLabel =
            !isAngle && houseToUse ? `House ${houseToUse}` : "";

          const fullLabel =
            houseLabel !== ""
              ? `${displayName} in ${planet.sign} ${houseLabel}`
              : `${displayName} in ${planet.sign}`;

          // Skip sign description for Galactic Center (doesn't change signs)
          const signLine =
            planetKey === "galactic center"
              ? ""
              : `<strong>${displayName} in ${planet.sign}:</strong> ${signDesc}`;

          const houseLine =
            !isAngle && houseToUse && houseDescriptions[planetKey]?.[houseToUse]
              ? `<strong>${displayName} in House ${houseToUse}:</strong> ${houseDescriptions[planetKey][houseToUse]}`
              : "";

          const planetIconFile =
            planetKey === "ascendant"
              ? "ascendantsymbol"
              : planetKey.replace(/[\s-]+/g, "");

          const planetImageSrc =
            planetImageCache[planetIconFile] ||
            `/images/planets/${planetIconFile}.svg`;

          report.innerHTML += `
            <div style="margin-bottom: 48px;">
              <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                <img src="${planetImageSrc}" alt="${displayName}" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                ${fullLabel}
              </h2>
              ${
                signLine ? `<p style="margin: 0 0 12px 0;">${signLine}</p>` : ""
              }
              ${houseLine ? `<p style="margin: 0;">${houseLine}</p>` : ""}
            </div>
          `;
        });
      }

      // Add aspect descriptions (skip for graph reports)
      if (!window.isGraphReport) {
        const aspectDescHTML = window.isSynastryReport
          ? generateSynastryAspectDescriptionsHTML()
          : generateAspectDescriptionsHTML();
        if (aspectDescHTML) {
          report.innerHTML += aspectDescHTML;
        }
      }

      // Add aspectarian visual at the end
      if (aspectarianHTML) {
        report.innerHTML += `
          <h2 style="margin: 48px 0 12px; font-size: 24px; font-weight: bold; page-break-before: always;">Aspectarian</h2>
          ${aspectarianHTML}
        `;
      }

      // Use pre-opened window if provided, otherwise open new one
      const printWindow =
        preOpenedWindow ||
        window.open("", "PrintChart", "width=1000,height=1200,scrollbars=yes,resizable=yes");
      if (printWindow) {
        // Clear any loading/blank content before writing the stable report view.
        printWindow.document.open();
        // Clone the chart
        const chartClone = chartContainer.cloneNode(true);
        normalizeZodiacTextLabels(chartClone);

        // Get the natal data for birth details (skip for graph/synastry/composite reports - they have their own titles)
        const natalData =
          !window.isGraphReport &&
          !window.isSynastryReport &&
          !window.isCompositeReport &&
          !window.isCompositeBlankReport
            ? JSON.parse(localStorage.getItem("natalData"))
            : null;
        const reportExportFileName = buildSafeExportFileName("Report", {
          zodiacSystem: natalData?.zodiacSystem,
          name: natalData?.name,
        });

        // Create birth details HTML (slightly smaller for report) - skip for graph/synastry/composite reports
        let birthDetailsHTML = "";
        if (
          natalData &&
          !window.isGraphReport &&
          !window.isSynastryReport &&
          !window.isCompositeReport &&
          !window.isCompositeBlankReport
        ) {
          birthDetailsHTML = `
            <div class="birth-details-report" style="text-align: center; font-family: 'Segoe UI', sans-serif; color: #222;">
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 5px;">${
                natalData.name || ""
              }</div>
              <div style="font-size: 14px;">${natalData.day || ""} ${
                natalData.month || ""
              } ${natalData.year || ""} ${natalData.hourString || ""}:${
                natalData.minuteString || ""
              } (${formatUtcOffsetForDisplay(natalData.utcOffset, natalData.timezone)})</div>
              <div style="font-size: 14px;">${natalData.location || ""}</div>
              <div style="font-size: 14px;">${natalData.lat || ""}, ${
                natalData.long || ""
              }</div>
            </div>
          `;
        }

        // Create system details HTML (slightly smaller for report) - skip for graph/synastry/composite reports
        let systemDetailsHTML = "";
        if (
          natalData &&
          !window.isGraphReport &&
          !window.isSynastryReport &&
          !window.isCompositeReport &&
          !window.isCompositeBlankReport
        ) {
          systemDetailsHTML = `
            <div class="system-details-report" style="text-align: center; font-family: 'Segoe UI', sans-serif; font-size: 14px; color: #222;">
              <div>Zodiac: ${formatZodiacSystemLabel(natalData.zodiacSystem)}</div>
              <div>House: ${natalData.houseSystem || ""}</div>
              <div>Coordinates: ${natalData.coordinateSystem || ""}</div>
              <div>Lunar Nodes: True Nodes</div>
            </div>
          `;
        }

        // In View Report, use the HTML birth/system detail blocks as the single
        // visible source of these labels. Keeping the SVG labels visible can be
        // clipped by the chart viewBox/container and previously caused duplicated
        // first-page text. Hiding the cloned SVG labels avoids both problems and
        // ensures name, date/time, UTC and coordinates are always readable.
        const birthDetails = chartClone.querySelectorAll(
          ".birth-details, .birth-details-left, .birth-details-right, .birth-details-center",
        );
        const systemDetails = chartClone.querySelectorAll(".system-details");
        birthDetails.forEach((el) => {
          el.style.display = "none";
          el.setAttribute("visibility", "hidden");
          el.style.opacity = "0";
        });
        systemDetails.forEach((el) => {
          el.style.display = "none";
          el.setAttribute("visibility", "hidden");
          el.style.opacity = "0";
        });

        // For synastry and composite, extend the viewBox upward to show title (like safariPrintView.js does)
        if (
          window.isSynastryReport ||
          window.isCompositeReport ||
          window.isCompositeBlankReport
        ) {
          const svgElement = chartClone.querySelector("svg");
          if (svgElement) {
            const currentViewBox = svgElement.getAttribute("viewBox");
            if (currentViewBox) {
              const parts = currentViewBox.split(" ");
              const x = parseFloat(parts[0]);
              const y = parseFloat(parts[1]) - 180; // Extend top to show title
              const width = parseFloat(parts[2]);
              const height = parseFloat(parts[3]) + 180; // Balance by extending height
              svgElement.setAttribute(
                "viewBox",
                `${x} ${y} ${width} ${height}`,
              );
            }
          }
        }

        // Build the print document
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Save / Print Report</title>
            <link rel="stylesheet" href="/css/styles.css">
            <style>
              /* VIEW REPORT DETAILS: keep birth details above the wheel and
                 system details below it, never over the SVG. */
              .birth-details-report {
                margin: 0 auto 18px !important;
                padding-top: 4px;
                line-height: 1.35;
              }
              .system-details-report {
                margin: 4px auto 30px !important;
                line-height: 1.35;
              }
              @media (max-width: 600px) {
                .birth-details-report { margin-bottom: 14px !important; }
                .system-details-report { margin-top: 0 !important; }
              }
              @media print {
                .birth-details-report { margin-bottom: 12px !important; }
                .system-details-report { margin-top: 0 !important; margin-bottom: 18px !important; }
              }
              
              body { 
                margin: 0; 
                padding: 20px;
                ${
                  isMobileDevice
                    ? ""
                    : `
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                `
                }
              }
              #natal-chart, #triwheel-chart, #return-chart, #synastry-chart, #composite-chart, #composite-chart-blank, #graph {
                position: static !important;
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                ${
                  !isMobileDevice
                    ? window.isGraphReport
                      ? "transform: scale(0.8); transform-origin: top center; margin: 0 auto 50px auto;"
                      : "transform: scale(0.8); transform-origin: center; margin: -10% auto 50px auto;"
                    : "margin-bottom: 50px;"
                }
              }
              ${
                !isMobileDevice &&
                (window.isSynastryReport ||
                  window.isCompositeReport ||
                  window.isCompositeBlankReport)
                  ? `
              #synastry-chart .birth-details text,
              #synastry-chart .birth-details-left text,
              #synastry-chart .birth-details-right text,
              #synastry-chart .birth-details-center text,
              #composite-chart .birth-details text,
              #composite-chart .birth-details-left text,
              #composite-chart .birth-details-right text,
              #composite-chart .birth-details-center text,
              #composite-chart-blank .birth-details text,
              #composite-chart-blank .birth-details-left text,
              #composite-chart-blank .birth-details-right text,
              #composite-chart-blank .birth-details-center text {
                font-size: 24px !important;
              }
              `
                  : ""
              }
              #graph {
                ${
                  window.isGraphReport
                    ? "max-height: none; margin-bottom: 100px;"
                    : "max-height: 800px;"
                }
                overflow: visible;
                page-break-inside: avoid;
              }
              ${
                window.isGraphReport
                  ? `
              #reportDescriptions {
                margin-top: 50px;
                padding-top: 50px;
                border-top: 2px solid #ccc;
              }
              `
                  : ""
              }
              ${
                !isMobileDevice
                  ? `
              @media print {
                #natal-chart, #triwheel-chart, #return-chart, #synastry-chart, #composite-chart, #composite-chart-blank, #graph {
                  transform: scale(0.9);
                  ${
                    window.isGraphReport
                      ? "transform-origin: top center; margin: 0 auto 50px auto;"
                      : "margin: -5% auto 50px auto;"
                  }
                }
                ${
                  window.isSynastryReport ||
                  window.isCompositeReport ||
                  window.isCompositeBlankReport
                    ? `
                #synastry-chart .birth-details text,
                #synastry-chart .birth-details-left text,
                #synastry-chart .birth-details-right text,
                #synastry-chart .birth-details-center text,
                #composite-chart .birth-details text,
                #composite-chart .birth-details-left text,
                #composite-chart .birth-details-right text,
                #composite-chart .birth-details-center text,
                #composite-chart-blank .birth-details text,
                #composite-chart-blank .birth-details-left text,
                #composite-chart-blank .birth-details-right text,
                #composite-chart-blank .birth-details-center text {
                  font-size: 24px !important;
                }
                `
                    : ""
                }
                ${
                  window.isGraphReport
                    ? `
                #graph {
                  max-height: none;
                  page-break-after: always;
                  margin-bottom: 0;
                }
                #reportDescriptions {
                  page-break-before: always;
                }
                `
                    : `
                #graph {
                  max-height: 750px;
                  page-break-after: always;
                }
                `
                }
              }
              `
                  : ""
              }
              ${
                isMobileDevice
                  ? `
              /* Mobile Safari specific adjustments */
              ${
                window.isGraphReport
                  ? `
              /* Prevent graph report descriptions from bleeding into graph on mobile Safari */
              #graph {
                margin-bottom: 50px;
              }
              #reportDescriptions {
                margin-top: 50px;
                padding-top: 50px;
                border-top: 2px solid #ccc;
              }
              `
                  : ""
              }
              @media print {
                #natal-chart svg, #triwheel-chart svg, #return-chart svg {
                  margin-top: -4%;
                  margin-bottom: -4%;
                  transform: scale(0.9);
                  transform-origin: center;
                }
                ${
                  window.isGraphReport
                    ? `
                /* Prevent graph report descriptions from bleeding into graph on mobile Safari print */
                #graph {
                  page-break-after: always;
                  margin-bottom: 0;
                }
                #reportDescriptions {
                  page-break-before: always;
                  margin-top: 100px;
                }
                `
                    : ""
                }
              }
              `
                  : ""
              }
              /* The report uses HTML detail blocks; hide cloned SVG detail text
                 to prevent clipping and duplication. */
              .birth-details, .birth-details-left, .birth-details-right, .birth-details-center,
              .system-details { 
                display: none !important; 
                visibility: hidden !important;
                opacity: 0 !important;
              }
              /* Scale down report content slightly */
              #reportDescriptions {
                transform: scale(0.85);
                transform-origin: top center;
              }
              /* Make aspectarian grid smaller */
              .tooltip-content {
                transform: scale(0.75);
                transform-origin: top left;
                margin-bottom: -20%; /* Negative margin to compensate for scale */
              }
              @media print {
                /* Reset layout for proper print pagination */
                body {
                  display: block !important;
                  min-height: 0 !important;
                }
                body * { visibility: visible !important; }
                #reportDescriptions {
                  transform: none !important; /* Remove scale - it breaks pagination */
                  font-size: 16px; /* Reduce font size instead of scaling */
                  ${isMobileDevice ? "margin-top: 128px !important;" : ""}
                }
              }
              .report-print-page {
                max-width: 980px;
                margin: 0 auto;
                padding: 32px 24px 64px;
                background: #fff;
                color: #222;
              }
              .report-print-page svg {
                max-width: 100% !important;
                height: auto !important;
                overflow: visible !important;
              }
              .report-print-page #natal-chart,
              .report-print-page #triwheel-chart,
              .report-print-page #return-chart,
              .report-print-page #synastry-chart,
              .report-print-page #composite-chart,
              .report-print-page #composite-chart-blank,
              .report-print-page #graph {
                width: 100% !important;
                max-width: 900px !important;
                height: auto !important;
                margin: 0 auto 10px !important;
                overflow: visible !important;
                transform: none !important;
              }
              .report-print-page #reportDescriptions {
                max-width: 860px;
                margin: 36px auto 0 !important;
                padding: 20px 0 !important;
                font-size: 18px !important;
                line-height: 1.5em !important;
                transform: none !important;
                transform-origin: initial !important;
              }
              .report-print-page #reportDescriptions h2 {
                break-after: avoid;
                page-break-after: avoid;
              }
              .report-print-page #reportDescriptions > div {
                break-inside: avoid;
                page-break-inside: avoid;
              }
              @media print {
                @page { margin: 12mm; }
                html, body { background: #fff !important; }
                body * { visibility: visible !important; }
                .report-print-page { padding: 0 !important; max-width: none !important; }
                .report-print-page #reportDescriptions { font-size: 16px !important; }
                .report-print-page #natal-chart,
                .report-print-page #triwheel-chart,
                .report-print-page #return-chart,
                .report-print-page #synastry-chart,
                .report-print-page #composite-chart,
                .report-print-page #composite-chart-blank,
                .report-print-page #graph {
                  page-break-inside: avoid;
                  break-inside: avoid;
                  margin-bottom: 18px !important;
                }
              }
              /* Close button */
              .close-window-button {
                position: fixed;
                top: 12px;
                right: 10px;
                padding: 12px 24px;
                background-color: #666;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                z-index: 10000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              }
              .close-window-button:hover {
                background-color: #555;
              }
              @media print {
                .close-window-button { display: none !important; }
              }
              /* Print button for Safari */
              .print-trigger-button {
                position: fixed;
                top: 66px;
                right: 10px;
                padding: 12px 24px;
                background-color: #4A90E2;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                z-index: 10000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              }
              .print-trigger-button:hover {
                background-color: #357ABD;
              }
              @media print {
                .print-trigger-button { display: none !important; }
              }
              ${
                isMobileDevice
                  ? `
              /* Larger buttons for Safari/mobile */
              .close-window-button,
              .print-trigger-button,
              .image-save-button {
                padding: 16px 32px !important;
                font-size: 20px !important;
              }
              
              .print-trigger-button {
                top: 80px !important;
              }
              .image-save-button {
                top: 148px !important;
              }
              `
                  : ""
              }
              ${buttonCss(isMobileDevice, true)}
            </style>
          </head>
          <body>
            <button class="close-window-button" type="button" data-action="close">Close View</button>
            <button class="print-trigger-button" type="button" data-action="print">Save PDF / Print Report</button>
            <button class="image-save-button" type="button" data-action="save-image">Save Chart Image</button>
            <div class="export-status" data-export-status></div>
            <main class="report-print-page">
              ${birthDetailsHTML}
              ${chartClone.outerHTML}
              ${systemDetailsHTML}
              ${report.outerHTML}
            </main>
            ${buildPrintWindowBridgeScript(chartContainerId, reportExportFileName)}
          </body>
          </html>
        `);
        printWindow.document.close();

        // For Safari/mobile, do not auto-print. The user taps the button so the native dialog opens reliably.
      } else {
        const fallbackChartClone = chartContainer.cloneNode(true);
        normalizeZodiacTextLabels(fallbackChartClone);
        fallbackChartClone
          .querySelectorAll(".birth-details, .birth-details-left, .birth-details-right, .birth-details-center, .system-details")
          .forEach((el) => {
            el.style.display = "block";
            el.style.visibility = "visible";
            el.style.opacity = "1";
            el.removeAttribute("display");
          });
        openInlinePrintFallback({
          title: "Save / Print Report",
          contentHtml: `${fallbackChartClone.outerHTML}${report.outerHTML}`,
          chartId: chartContainerId,
          fileName: buildSafeExportFileName("Report"),
          isReport: true,
          includeImageButton: true,
        });
      }
      return;
    }

    // Save original inline styles to restore later
    const originalStyles = {
      position: chartContainer.style.position,
      transform: chartContainer.style.transform,
    };

    // Compute how far from top the chart is visually
    const offsetTop =
      chartContainer.getBoundingClientRect().top + window.scrollY;

    // Shift the chart upward to remove top print gap
    chartContainer.style.position = "relative";
    const extraOffset = -500;
    chartContainer.style.transform = `translateY(-${
      offsetTop + extraOffset
    }px)`;

    // Add report block at the end
    const report = document.createElement("div");
    report.id = "reportDescriptions";
    report.style.marginTop = window.isTriwheelReport ? "0px" : "100px";
    report.style.padding = "20px";
    report.style.fontSize = "20px";
    report.style.lineHeight = "1.4em";

    if (window.natalPlanets?.length > 0) {
      // For graph reports, keep exact order - do NOT sort
      // Exclude custom points from report
      const sortedPlanets = window.isGraphReport
        ? [...window.natalPlanets].filter((p) => !p.isCustomPoint)
        : [...window.natalPlanets]
            .filter((p) => !p.isCustomPoint)
            .sort((a, b) => {
              const aKey = a.name.toLowerCase();
              const bKey = b.name.toLowerCase();

              if (aKey === "ascendant symbol") return -1;
              if (bKey === "ascendant symbol") return 1;
              return 0;
            });

      let currentSection = null;
      sortedPlanets.forEach((planet) => {
        // Handle graph items differently
        if (planet.isGraphItem) {
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

          // Format all transits - mirror the graph exactly
          let datesStr = "";
          if (planet.transits && planet.transits.length > 0) {
            if (planet.itemType === "house_ingress") {
              // For house ingresses: alternate ingress/egress
              datesStr = planet.transits
                .map((transit, index) => {
                  const label = index % 2 === 0 ? "ingress" : "egress";
                  return `${label}: ${transit.date.day} ${
                    monthNames[transit.date.month - 1]
                  } ${transit.date.year}`;
                })
                .join(", ");
            } else if (planet.itemType === "station") {
              // For stations: use stationType (direct/retrograde) instead of contact
              datesStr = planet.transits
                .map((transit) => {
                  const label = transit.stationType || transit.contact;
                  return `${label}: ${transit.date.day} ${
                    monthNames[transit.date.month - 1]
                  } ${transit.date.year}`;
                })
                .join(", ");
            } else {
              // For all other types: use contact type as-is (replace "start" with "orb")
              // If exact contacts exist, exclude orb contacts
              const hasExact = planet.transits.some(
                (t) => t.contact === "exact",
              );
              datesStr = planet.transits
                .filter((transit) => {
                  // If exact exists, filter out orb/start/end contacts
                  if (hasExact) {
                    return transit.contact === "exact";
                  }
                  return true;
                })
                .map((transit) => {
                  const label =
                    transit.contact === "start" || transit.contact === "end"
                      ? "orb"
                      : transit.contact;
                  return `${label}: ${transit.date.day} ${
                    monthNames[transit.date.month - 1]
                  } ${transit.date.year}`;
                })
                .join(", ");
            }
          }

          const chartTypeLabel =
            planet.chartType === "transit" ? "Transiting" : "Progressed";

          if (planet.itemType === "aspect") {
            const planet1Key = planet.name.toLowerCase().replace(/\s+/g, " ");
            const planet2Key = planet.planet2
              .toLowerCase()
              .replace(/\s+/g, " ");
            const aspectType = planet.aspectType.toLowerCase();

            const description =
              planetAspectDescriptions[planet1Key]?.[planet2Key]?.[
                aspectType
              ] ||
              planetAspectDescriptions[planet2Key]?.[planet1Key]?.[
                aspectType
              ] ||
              "No description available";

            const aspectTypeDisplay =
              planet.aspectType.charAt(0).toUpperCase() +
              planet.aspectType.slice(1);

            // Determine planet2 type label
            let planet2TypeLabel = "";
            if (planet.planet2Type === "natal") {
              planet2TypeLabel = "Natal ";
            } else if (planet.planet2Type === "transit") {
              planet2TypeLabel = "Transiting ";
            } else if (planet.planet2Type === "progressed") {
              planet2TypeLabel = "Progressed ";
            }

            let planet1IconFile = planet1Key.replace(/[\s-]+/g, "");
            if (planet1IconFile === "ascendant")
              planet1IconFile = "ascendantsymbol";

            let planet2IconFile = planet2Key.replace(/[\s-]+/g, "");
            if (planet2IconFile === "ascendant")
              planet2IconFile = "ascendantsymbol";

            const planet1ImageSrc =
              planetImageCache[planet1IconFile] ||
              `/images/planets/${planet1IconFile}.svg`;
            const planet2ImageSrc =
              planetImageCache[planet2IconFile] ||
              `/images/planets/${planet2IconFile}.svg`;
            const aspectImageSrc = `/images/aspects/${aspectType}.svg`;

            report.innerHTML += `
              <div style="margin-bottom: 48px;">
                <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                  <img src="${planet1ImageSrc}" alt="${
                    planet.name
                  }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                  ${chartTypeLabel} ${planet.name}
                  <img src="${aspectImageSrc}" alt="${aspectTypeDisplay}" width="30" height="30" style="margin: 0 -4px;" />
                  <img src="${planet2ImageSrc}" alt="${
                    planet.planet2
                  }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                  ${planet2TypeLabel}${planet.planet2}
                </h2>
                <p style="margin: 0;"><strong>${aspectTypeDisplay}:</strong> ${description}</p>
                ${
                  datesStr
                    ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">${datesStr}</p>`
                    : ""
                }
              </div>
            `;
          } else if (planet.itemType === "house_ingress") {
            const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
            const houseDescriptions =
              planet.chartType === "progressed"
                ? progressedPlanetHouseDescriptions
                : transitPlanetHouseDescriptions;
            const description =
              houseDescriptions[planetKey]?.[planet.house] ||
              "No description available";

            const planetIconFile = planetKey.replace(/[\s-]+/g, "");
            const planetImageSrc =
              planetImageCache[planetIconFile] ||
              `/images/planets/${planetIconFile}.svg`;

            report.innerHTML += `
              <div style="margin-bottom: 48px;">
                <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                  <img src="${planetImageSrc}" alt="${
                    planet.name
                  }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                  ${chartTypeLabel} ${planet.name} in House ${planet.house}
                </h2>
                <p style="margin: 0;">${description}</p>
                ${
                  datesStr
                    ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">${datesStr}</p>`
                    : ""
                }
              </div>
            `;
          } else if (planet.itemType === "station") {
            const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
            const description =
              graphPlanetRetroDescriptions[planetKey]?.station ||
              "No description available";

            const planetIconFile = planetKey.replace(/[\s-]+/g, "");
            const planetImageSrc =
              planetImageCache[planetIconFile] ||
              `/images/planets/${planetIconFile}.svg`;

            report.innerHTML += `
              <div style="margin-bottom: 48px;">
                <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                  <img src="${planetImageSrc}" alt="${
                    planet.name
                  }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                  ${chartTypeLabel} ${planet.name} Station
                </h2>
                <p style="margin: 0;">${description}</p>
                ${
                  datesStr
                    ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">${datesStr}</p>`
                    : ""
                }
              </div>
            `;
          } else if (planet.itemType === "sign_ingress") {
            const planetKey = planet.name.toLowerCase().replace(/\s+/g, " ");
            const planetIconFile = planetKey.replace(/[\s-]+/g, "");
            const planetImageSrc =
              planetImageCache[planetIconFile] ||
              `/images/planets/${planetIconFile}.svg`;

            report.innerHTML += `
              <div style="margin-bottom: 48px;">
                <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                  <img src="${planetImageSrc}" alt="${
                    planet.name
                  }" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
                  ${chartTypeLabel} ${planet.name} enters ${planet.sign}
                </h2>
                ${
                  datesStr
                    ? `<p style="margin: 6px 0 0 0; font-size: 16px; color: #666;">${datesStr}</p>`
                    : ""
                }
              </div>
            `;
          }
          return; // Skip the regular planet handling
        }

        // Add section header if reportSection changes
        if (planet.reportSection && planet.reportSection !== currentSection) {
          currentSection = planet.reportSection;
          report.innerHTML += `
            <h2 style="margin: 24px 0 24px; font-size: 24px; font-weight: bold; page-break-before: always;">
              ${currentSection}
            </h2>
          `;
        }

        let planetKey = planet.name.toLowerCase();
        let displayName = planet.name;
        if (planetKey === "ascendant symbol") {
          planetKey = "ascendant";
          displayName = "Ascendant";
        } else if (planetKey === "descendant symbol") {
          planetKey = "descendant";
          displayName = "Descendant";
        }

        // Select appropriate description set based on chart type
        const chartType = planet.chartType || "natal";
        let signDescriptions = planetSignDescriptions;
        let houseDescriptions = planetHouseDescriptions;
        if (chartType === "progressed") {
          signDescriptions = progressedPlanetSignDescriptions;
          houseDescriptions = progressedPlanetHouseDescriptions;
        } else if (chartType === "transit") {
          signDescriptions = transitPlanetSignDescriptions;
          houseDescriptions = transitPlanetHouseDescriptions;
        } else if (chartType === "solar_return") {
          signDescriptions = solarReturnPlanetSignDescriptions;
          houseDescriptions = solarReturnPlanetHouseDescriptions;
        } else if (chartType === "lunar_return") {
          signDescriptions = lunarReturnPlanetSignDescriptions;
          houseDescriptions = lunarReturnPlanetHouseDescriptions;
        } else if (chartType === "synastry") {
          signDescriptions = synastryPlanetSignDescriptions;
          houseDescriptions = synastryPlanetHouseDescriptions;
        } else if (chartType === "composite") {
          signDescriptions = compositePlanetSignDescriptions;
          houseDescriptions = compositePlanetHouseDescriptions;
        }

        const signKey = planet.sign.toLowerCase();
        const signDesc =
          signDescriptions[planetKey]?.[signKey] || "No description available";

        const isAngle =
          planetKey === "ascendant" ||
          planetKey === "descendant" ||
          planetKey === "midheaven" ||
          planetKey === "imum coeli";

        // Use houseNatal (natal-relative house) if available, otherwise use house
        const houseToUse = planet.houseNatal || planet.house;

        const houseLabel = !isAngle && houseToUse ? `House ${houseToUse}` : "";

        const fullLabel =
          houseLabel !== ""
            ? `${displayName} in ${planet.sign} ${houseLabel}`
            : `${displayName} in ${planet.sign}`;

        // Skip sign description for Galactic Center (doesn't change signs)
        const signLine =
          planetKey === "galactic center"
            ? ""
            : `<strong>${displayName} in ${planet.sign}:</strong> ${signDesc}`;

        const houseLine =
          !isAngle && houseToUse && houseDescriptions[planetKey]?.[houseToUse]
            ? `<strong>${displayName} in House ${houseToUse}:</strong> ${houseDescriptions[planetKey][houseToUse]}`
            : "";

        const planetIconFile =
          planetKey === "ascendant"
            ? "ascendantsymbol"
            : planetKey.replace(/[\s-]+/g, "");

        // Use preloaded data URI if available, otherwise fallback to direct path
        const planetImageSrc =
          planetImageCache[planetIconFile] ||
          `/images/planets/${planetIconFile}.svg`;

        report.innerHTML += `
          <div style="margin-bottom: 48px;">
            <h2 style="margin: 0 0 12px 0; font-size: 24px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
              <img src="${planetImageSrc}" alt="${displayName}" width="36" height="36" style="margin-left: -4px; margin-right: -4px;" />
              ${fullLabel}
            </h2>
            ${signLine ? `<p style="margin: 0 0 12px 0;">${signLine}</p>` : ""}
            ${houseLine ? `<p style="margin: 0;">${houseLine}</p>` : ""}
          </div>
        `;
      });
    } else {
      report.innerHTML = "<p>No planet data available.</p>";
    }

    // Add aspect descriptions (skip for graph reports)
    if (!window.isGraphReport) {
      const aspectDescHTML = window.isSynastryReport
        ? generateSynastryAspectDescriptionsHTML()
        : generateAspectDescriptionsHTML();
      if (aspectDescHTML) {
        report.innerHTML += aspectDescHTML;
      }
    }

    // For graph reports, add page break and extreme margin/padding solution
    if (window.isGraphReport) {
      // Remove any existing elements from previous runs
      const existingBreaks = chartContainer.querySelectorAll(
        ".graph-report-page-break",
      );
      existingBreaks.forEach((el) => el.remove());
      const existingStyles = document.querySelector(
        "#graph-report-print-styles",
      );
      if (existingStyles) existingStyles.remove();

      // Create page break element
      const pageBreak = document.createElement("div");
      pageBreak.className = "graph-report-page-break";
      pageBreak.style.cssText = `
        page-break-after: always;
        break-after: page;
        height: 1px;
        visibility: hidden;
        margin: 0;
        padding: 0;
      `;
      chartContainer.appendChild(pageBreak);

      // Add report with class for CSS targeting
      report.classList.add("graph-report-content");
      chartContainer.appendChild(report);

      // Add print styles with extreme margin/padding to force to top
      const printStyles = document.createElement("style");
      printStyles.id = "graph-report-print-styles";
      printStyles.textContent = `
        @media print {
          .graph-report-content {
            page-break-before: always !important;
            margin-top: -9999px !important;
            padding-top: 10040px !important;
            padding-left: 20px !important;
            padding-right: 20px !important;
            position: relative !important;
            transform: none !important;
          }
        }
      `;
      document.head.appendChild(printStyles);
    } else {
      chartContainer.appendChild(report);
    }

    // Aspectarian print (skip for triwheel and graph reports)
    if (!window.isTriwheelReport && !window.isGraphReport) {
      // build the aspectarian tooltip off–screen
      // For synastry reports, use synastry aspectarian (Person 1 vs Person 2)
      // Filter out custom points from report aspectarian
      if (window.isSynastryReport) {
        const filteredPerson1 =
          window.person1Planets?.filter((p) => !p.isCustomPoint) || [];
        const filteredSynastry =
          window.synastryPlanets?.filter((p) => !p.isCustomPoint) || [];
        showAspectarianSynastry(filteredPerson1, filteredSynastry);
      } else {
        const filteredPlanets =
          window.natalPlanets?.filter((p) => !p.isCustomPoint) || [];
        showAspectarian(filteredPlanets);
      }

      // clone just the inner matrix - only if it exists
      const aspectarianElement = document.querySelector(
        "#tooltip .planet-tooltip-instance .tooltip-content",
      );

      if (aspectarianElement) {
        const clonedAspect = aspectarianElement.cloneNode(true);

        // make a header for aspectarian
        const aspectarianHeader = document.createElement("h2");
        aspectarianHeader.textContent = "Aspectarian";
        aspectarianHeader.style.margin = "24px 0 12px";
        aspectarianHeader.style.fontSize = "24px";
        aspectarianHeader.style.fontWeight = "bold";
        aspectarianHeader.style.pageBreakBefore = "always";

        // append header + matrix at the end (after aspect descriptions)
        report.appendChild(aspectarianHeader);
        report.appendChild(clonedAspect);
      }
    }

    // Wait for all images in the report to load before printing
    setTimeout(async () => {
      await waitForImages(report);

      // Store cleanup function
      const cleanupReport = () => {
        // hide tooltip & restore styles
        const tooltip = document.querySelector("#tooltip");
        if (tooltip) {
          tooltip.style.opacity = 0;
          // Clear tooltip content to prevent invisible blocking elements
          tooltip.innerHTML = "";
        }

        // Restore original styles
        chartContainer.style.position = originalStyles.position;
        chartContainer.style.transform = originalStyles.transform;

        // Remove report
        if (report && report.parentNode) {
          report.remove();
        }

        // Cleanup graph report elements
        if (window.isGraphReport) {
          const pageBreaks = chartContainer.querySelectorAll(
            ".graph-report-page-break",
          );
          pageBreaks.forEach((el) => el.remove());
          const printStyles = document.querySelector(
            "#graph-report-print-styles",
          );
          if (printStyles) printStyles.remove();
        }
      };

      // Set up print event listeners for proper cleanup
      const handleAfterPrint = () => {
        // Clean up after print dialog closes
        cleanupReport();
        // Remove the event listeners
        window.removeEventListener("afterprint", handleAfterPrint);
        window.removeEventListener("focus", handleWindowFocus);
      };

      // Fallback for browsers that don't support afterprint (including some Safari versions)
      const handleWindowFocus = () => {
        // Small delay to ensure print dialog has closed
        setTimeout(() => {
          cleanupReport();
          window.removeEventListener("afterprint", handleAfterPrint);
          window.removeEventListener("focus", handleWindowFocus);
        }, 100);
      };

      // Listen for print completion
      window.addEventListener("afterprint", handleAfterPrint);

      // Fallback: Also listen for window focus (for Safari and other browsers)
      // This fires when the print dialog is dismissed
      window.addEventListener("focus", handleWindowFocus);

      // Start the print dialog
      window.print();

      // Ultimate fallback: Remove after 30 seconds if events never fire
      // This prevents memory leaks if user leaves dialog open indefinitely
      setTimeout(() => {
        if (report && report.parentNode) {
          cleanupReport();
          window.removeEventListener("afterprint", handleAfterPrint);
          window.removeEventListener("focus", handleWindowFocus);
        }
      }, 30000);
    }, 50);
  }
});

// Generate Triwheel Report
window.generateTriwheelReport = function (preOpenedWindow) {
  // Define planet orders based on requirements
  const progressedOrder = [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Ascendant Symbol",
    "Midheaven",
    "Descendant",
    "Imum Coeli",
  ];
  const yearlyOrder = [
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
    "Chiron",
    "North Node",
    "South Node",
    "Ceres",
    "Vesta",
    "Pallas",
    "Juno",
    "Lilith",
    "Priapus",
    "Part of Fortune",
    "Part of Spirit",
    "Vertex",
    "Anti-Vertex",
    // Galactic Center excluded - doesn't transit (stationary point)
  ];
  const monthlyOrder = ["Sun", "Moon", "Mercury", "Venus", "Mars"];

  // Build organized planet lists (only activated planets)
  const progressedPlacements = progressedOrder
    .map((name) => window.progressedPlanets?.find((p) => p.name === name))
    .filter((p) => p);

  const yearlyPlacements = yearlyOrder
    .map((name) => window.transitPlanets?.find((p) => p.name === name))
    .filter((p) => p);

  const monthlyPlacements = monthlyOrder
    .map((name) => window.transitPlanets?.find((p) => p.name === name))
    .filter((p) => p);

  // Save original natalPlanets
  const originalNatalPlanets = window.natalPlanets;

  // Create combined list for report (no aspects, no section headers yet - we'll handle in rendering)
  const combinedPlanets = [
    ...progressedPlacements.map((p) => ({
      ...p,
      reportSection: "Progressed Placements",
      chartType: "progressed",
    })),
    ...yearlyPlacements.map((p) => ({
      ...p,
      reportSection: "Yearly Transits",
      chartType: "transit",
    })),
    ...monthlyPlacements.map((p) => ({
      ...p,
      reportSection: "Monthly Transits",
      chartType: "transit",
    })),
  ];

  window.natalPlanets = combinedPlanets;
  window.isTriwheelReport = true;

  // Call the existing generateReport function (defined in natalReport event listener scope)
  // We need to trigger the natal report generation programmatically
  const natalReportButton = document.getElementById("natalReport");
  if (natalReportButton) {
    // Temporarily store the pre-opened window and triwheel flag
    window.triwheelReportWindow = preOpenedWindow;
    natalReportButton.click();

    // Clean up after a delay
    setTimeout(() => {
      delete window.triwheelReportWindow;
      window.natalPlanets = originalNatalPlanets;
      window.isTriwheelReport = false;
    }, 2000);
  }
};

// Generate Return Report
window.generateReturnReport = function (preOpenedWindow) {
  // Determine if this is a Solar or Lunar return
  const adjustType = document.getElementById("adjustType")?.value || "Solar";
  const chartType = adjustType === "Lunar" ? "lunar_return" : "solar_return";

  // Define planet order in standard natal order
  const returnOrder = [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
    "Chiron",
    "North Node",
    "South Node",
    "Ceres",
    "Vesta",
    "Pallas",
    "Juno",
    "Lilith",
    "Priapus",
    "Part of Fortune",
    "Part of Spirit",
    "Vertex",
    "Anti-Vertex",
    "Galactic Center",
    "Ascendant Symbol",
    "Midheaven",
    "Descendant",
    "Imum Coeli",
  ];

  // Build organized planet list (only activated planets in standard order)
  // Add chartType to each planet so report generation uses return descriptions
  const returnPlacements = returnOrder
    .map((name) => {
      const planet = window.returnPlanets?.find((p) => p.name === name);
      if (planet) {
        return {
          ...planet,
          chartType: chartType,
        };
      }
      return null;
    })
    .filter((p) => p);

  // Save original natalPlanets
  const originalNatalPlanets = window.natalPlanets;

  // Set window.natalPlanets to returnPlanets for report generation
  window.natalPlanets = returnPlacements;
  window.isReturnReport = true;

  // Call the existing generateReport function (defined in natalReport event listener scope)
  // We need to trigger the natal report generation programmatically
  const natalReportButton = document.getElementById("natalReport");
  if (natalReportButton) {
    // Temporarily store the pre-opened window and return flag
    window.returnReportWindow = preOpenedWindow;
    natalReportButton.click();

    // Clean up after a delay
    setTimeout(() => {
      delete window.returnReportWindow;
      window.natalPlanets = originalNatalPlanets;
      window.isReturnReport = false;
    }, 2000);
  }
};

// Generate Synastry Report
window.generateSynastryReport = function (preOpenedWindow) {
  // Define planet order in standard natal order
  const planetOrder = [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
    "Chiron",
    "North Node",
    "South Node",
    "Ceres",
    "Vesta",
    "Pallas",
    "Juno",
    "Lilith",
    "Priapus",
    "Part of Fortune",
    "Part of Spirit",
    "Vertex",
    "Anti-Vertex",
    "Galactic Center",
    "Ascendant Symbol",
    "Midheaven",
    "Descendant",
    "Imum Coeli",
  ];

  // Build synastry planets (outer wheel only - Person 2 planets in Person 1's houses)
  // This matches what the user sees when clicking outer wheel planets
  const synastryPlacements = planetOrder
    .map((name) => {
      const planet = window.synastryPlanets?.find((p) => p.name === name);
      if (planet) {
        // Calculate houseNatal (Person 2's planet position in Person 1's houses)
        // This is the same calculation that happens when clicking outer wheel planets
        let houseNatal = planet.house; // Default to natal house
        if (window.chart1HouseCusps && window.calculateHousePosition) {
          houseNatal = window.calculateHousePosition(
            planet.position,
            window.chart1HouseCusps,
          );
        }

        return {
          ...planet,
          houseNatal: houseNatal, // Override with Chart 1 relative house position
          chartType: "synastry", // Use synastry descriptions
        };
      }
      return null;
    })
    .filter((p) => p);

  // Save original natalPlanets (Person 1) for synastry aspects and aspectarian
  const originalNatalPlanets = window.natalPlanets;
  window.person1Planets = originalNatalPlanets; // Store Person 1 for aspects calculation

  // Set window.natalPlanets to synastry planets for report generation
  window.natalPlanets = synastryPlacements;
  window.isSynastryReport = true;

  // Call the existing generateReport function (defined in natalReport event listener scope)
  // We need to trigger the natal report generation programmatically
  const natalReportButton = document.getElementById("natalReport");
  if (natalReportButton) {
    // Temporarily store the pre-opened window and synastry flag
    window.synastryReportWindow = preOpenedWindow;
    natalReportButton.click();

    // Clean up after a delay
    setTimeout(() => {
      delete window.synastryReportWindow;
      window.natalPlanets = originalNatalPlanets;
      window.isSynastryReport = false;
    }, 2000);
  }
};

// Generate Composite Report
window.generateCompositeReport = function (preOpenedWindow) {
  // Check if composite-chart-blank is visible (synastry not calculated yet)
  const blankChart = document.getElementById("composite-chart-blank");
  const compositeChart = document.getElementById("composite-chart");
  const isBlankComposite =
    blankChart &&
    blankChart.style.display !== "none" &&
    (!compositeChart || compositeChart.style.display === "none");

  // If using blank composite, use natal planets instead
  if (isBlankComposite) {
    // Don't set isCompositeReport flag for blank composite - use natal report
    // This will make generateReport use "composite-chart-blank" and natal descriptions
    window.isCompositeBlankReport = true;

    // Trigger the existing natal report mechanism
    const natalReportButton = document.getElementById("natalReport");
    if (natalReportButton) {
      window.compositeReportWindow = preOpenedWindow;
      natalReportButton.click();

      // Clean up after a delay
      setTimeout(() => {
        delete window.compositeReportWindow;
        window.isCompositeBlankReport = false;
      }, 2000);
    }
    return;
  }

  // Regular composite report (synastry has been calculated)
  // Define planet order in standard natal order
  const planetOrder = [
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
    "Chiron",
    "North Node",
    "South Node",
    "Ceres",
    "Vesta",
    "Pallas",
    "Juno",
    "Lilith",
    "Priapus",
    "Part of Fortune",
    "Part of Spirit",
    "Vertex",
    "Anti-Vertex",
    "Galactic Center",
    "Ascendant Symbol",
    "Midheaven",
    "Descendant",
    "Imum Coeli",
  ];

  // Build composite placements list
  const compositePlacements = planetOrder
    .map((name) => {
      const planet = window.compositePlanets?.find((p) => p.name === name);
      if (planet) {
        // Calculate correct house position using composite house cusps
        let compositeHouse = planet.house; // Default to existing house
        if (window.compositeHouseCusps && window.calculateHousePosition) {
          compositeHouse = window.calculateHousePosition(
            planet.position,
            window.compositeHouseCusps,
          );
        }

        return {
          ...planet,
          houseNatal: compositeHouse, // Use houseNatal to override the display house
          chartType: "composite",
        };
      }
      return null;
    })
    .filter((p) => p);

  // Save original natalPlanets
  const originalNatalPlanets = window.natalPlanets;

  // Set window.natalPlanets to composite planets for report generation
  window.natalPlanets = compositePlacements;
  window.isCompositeReport = true;

  // Call the existing generateReport function (defined in natalReport event listener scope)
  // We need to trigger the natal report generation programmatically
  const natalReportButton = document.getElementById("natalReport");
  if (natalReportButton) {
    // Temporarily store the pre-opened window and composite flag
    window.compositeReportWindow = preOpenedWindow;
    natalReportButton.click();

    // Clean up after a delay
    setTimeout(() => {
      delete window.compositeReportWindow;
      window.natalPlanets = originalNatalPlanets;
      window.isCompositeReport = false;
    }, 2000);
  }
};

window.generateGraphReport = function (preOpenedWindow) {
  // If no graph data, silently return (shows blank page like View button does)
  if (!window.graphGroupedAspects || window.graphGroupedAspects.length === 0) {
    if (preOpenedWindow) preOpenedWindow.close();
    return;
  }

  // Add title to graph SVG for report generation
  const graphElement = document.getElementById("graph");
  const svg = graphElement?.querySelector("svg");
  let addedTitle = false;
  let originalViewBox = null;

  if (svg && window.graphFormData?.natalData?.name) {
    // Store original viewBox
    originalViewBox = svg.getAttribute("viewBox");
    const viewBoxParts = originalViewBox.split(" ");
    const currentY = parseFloat(viewBoxParts[1]);
    const currentHeight = parseFloat(viewBoxParts[3]);

    // Check if mobile for responsive sizing
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const titleSpace = isMobile ? 80 : 160;
    const titleYPosition = isMobile ? currentY - 40 : currentY - 80;
    const nameFontSize = isMobile ? "18px" : "52px";
    const dateFontSize = isMobile ? "14px" : "40px";
    const dateYOffset = isMobile ? "25" : "60";

    // Add space at top for title
    svg.setAttribute(
      "viewBox",
      `${viewBoxParts[0]} ${currentY - titleSpace} ${viewBoxParts[2]} ${
        currentHeight + titleSpace
      }`,
    );

    // Create title
    const natalData = window.graphFormData.natalData;
    const startDay = window.graphFormData.startDay || "";
    const startMonth = window.graphFormData.startMonth || "";
    const startYear = window.graphFormData.startYear || "";
    const startHour = (window.graphFormData.startHour || "00").padStart(2, "0");
    const startMinute = (window.graphFormData.startMinute || "00").padStart(
      2,
      "0",
    );
    const endDay = window.graphFormData.endDay || "";
    const endMonth = window.graphFormData.endMonth || "";
    const endYear = window.graphFormData.endYear || "";
    const endHour = (window.graphFormData.endHour || "00").padStart(2, "0");
    const endMinute = (window.graphFormData.endMinute || "00").padStart(2, "0");

    const titleGroup = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g",
    );
    titleGroup.setAttribute("class", "temp-report-title");
    titleGroup.setAttribute(
      "transform",
      `translate(${parseFloat(viewBoxParts[2]) / 2}, ${titleYPosition})`,
    );

    // Add name
    const nameText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    nameText.setAttribute("text-anchor", "middle");
    nameText.setAttribute("font-family", "Segoe UI, sans-serif");
    nameText.setAttribute("font-size", nameFontSize);
    nameText.setAttribute("font-weight", "bold");
    nameText.setAttribute("fill", "#222");
    nameText.textContent = `${natalData.name} - Transit Graph`;
    titleGroup.appendChild(nameText);

    // Add dates
    const dateText = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text",
    );
    dateText.setAttribute("y", dateYOffset);
    dateText.setAttribute("text-anchor", "middle");
    dateText.setAttribute("font-family", "Segoe UI, sans-serif");
    dateText.setAttribute("font-size", dateFontSize);
    dateText.setAttribute("fill", "#222");
    dateText.textContent = `${startDay} ${startMonth} ${startYear} ${startHour}:${startMinute} - ${endDay} ${endMonth} ${endYear} ${endHour}:${endMinute}`;
    titleGroup.appendChild(dateText);

    // Insert at beginning
    svg.insertBefore(titleGroup, svg.firstChild);
    addedTitle = true;
  }

  // Process graphGroupedAspects to create pseudo-planet objects
  // These will be used by the report generation system
  const graphReportItems = [];

  // Mirror the graph exactly - collect ALL transits for each grouped line
  window.graphGroupedAspects.forEach(([aspectText, aspects]) => {
    const firstAspect = aspects[0].aspect;

    // Determine item type
    const isStation =
      firstAspect.type === "Direct" || firstAspect.type === "Retrograde";
    const isIngress = firstAspect.type === "Ingress";

    // Collect ALL transits from ALL aspects in this grouped line
    const allTransits = [];
    aspects.forEach(({ aspect }) => {
      aspect.transits.forEach((transit) => {
        const transitData = {
          contact: transit.contact,
          date: transit.date,
        };

        // For stations, store whether this is direct or retrograde
        if (isStation) {
          transitData.stationType = aspect.type.toLowerCase(); // "direct" or "retrograde"
        }

        allTransits.push(transitData);
      });
    });

    // Get the moving planet (transiting or progressed)
    const movingPlanet =
      firstAspect.transitingPlanet || firstAspect.progressedPlanet;
    const isTransiting = !!firstAspect.transitingPlanet;
    const chartType = isTransiting ? "transit" : "progressed";

    // Create pseudo-planet object - store ALL transit data
    const graphItem = {
      name: movingPlanet,
      chartType: chartType,
      transits: allTransits,
      isGraphItem: true,
    };

    if (isStation) {
      graphItem.itemType = "station";
      // Don't store stationType in graphItem - it's now in each transit
    } else if (isIngress) {
      const target =
        firstAspect.natalPlanet ||
        firstAspect.transitingPlanet2 ||
        firstAspect.progressedPlanet2;
      const houseMatch = target?.match(/House (\d+)/);

      if (houseMatch) {
        graphItem.itemType = "house_ingress";
        graphItem.house = parseInt(houseMatch[1]);
      } else {
        graphItem.itemType = "sign_ingress";
        graphItem.sign = target;
      }
    } else {
      graphItem.itemType = "aspect";
      graphItem.planet2 =
        firstAspect.natalPlanet ||
        firstAspect.transitingPlanet2 ||
        firstAspect.progressedPlanet2;
      graphItem.aspectType = firstAspect.type;

      // Determine planet2 type
      if (firstAspect.natalPlanet) {
        graphItem.planet2Type = "natal";
      } else if (firstAspect.transitingPlanet2) {
        graphItem.planet2Type = "transit";
      } else if (firstAspect.progressedPlanet2) {
        graphItem.planet2Type = "progressed";
      }
    }

    graphReportItems.push(graphItem);
  });

  // Save original natalPlanets
  const originalNatalPlanets = window.natalPlanets;

  // Set window.natalPlanets to graph report items
  window.natalPlanets = graphReportItems;
  window.isGraphReport = true;

  // Call the existing generateReport function
  const natalReportButton = document.getElementById("natalReport");
  if (natalReportButton) {
    // Temporarily store the pre-opened window
    window.graphReportWindow = preOpenedWindow;
    natalReportButton.click();

    // Clean up after a delay
    setTimeout(() => {
      delete window.graphReportWindow;
      window.natalPlanets = originalNatalPlanets;
      window.isGraphReport = false;

      // Remove temporary title from SVG
      if (addedTitle && svg) {
        if (originalViewBox) {
          svg.setAttribute("viewBox", originalViewBox);
        }
        const tempTitle = svg.querySelector(".temp-report-title");
        if (tempTitle) tempTitle.remove();
      }
    }, 2000);
  }
};
