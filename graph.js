"use strict";

import { sharedNatal, calculateAstrologyChart, parseHistoricalYear, makeHistoricalDate, astronomicalYearToHistorical } from "./sharedNatal.js?v=DELTA_SYNASTRY_FIX_20260617";

// Disable context menu on the graph area globally (covers right-click drags)
document.addEventListener(
  "contextmenu",
  (e) => {
    if (e.target.closest("#graph")) {
      e.preventDefault();
    }
  },
  true
);

// Hide tooltip on click
// Desktop
document.addEventListener("click", (e) => {
  if (e.button === 0) {
    d3.select(".tooltip").style("opacity", 0).html("");
  }
});
// Touchscreen
document.addEventListener("touchstart", (e) => {
  if (!e.target.closest(".tooltip")) {
    d3.select(".tooltip").style("opacity", 0).html("");
  }
});

// Planet symbol image paths
const planetSymbols = {
  Sun: "/images/planets/sun.svg",
  Moon: "/images/planets/moon.svg",
  Mercury: "/images/planets/mercury.svg",
  Venus: "/images/planets/venus.svg",
  Mars: "/images/planets/mars.svg",
  Jupiter: "/images/planets/jupiter.svg",
  Saturn: "/images/planets/saturn.svg",
  Uranus: "/images/planets/uranus.svg",
  Neptune: "/images/planets/neptune.svg",
  Pluto: "/images/planets/pluto.svg",
  Chiron: "/images/planets/chiron.svg",
  Ceres: "/images/planets/ceres.svg",
  Vesta: "/images/planets/vesta.svg",
  Pallas: "/images/planets/pallas.svg",
  Juno: "/images/planets/juno.svg",
  Lilith: "/images/planets/lilith.svg",
  Priapus: "/images/planets/priapus.svg",
  Vertex: "/images/planets/vertex.svg",
  "Anti-Vertex": "/images/planets/antivertex.svg",
  "Part of Fortune": "/images/planets/partoffortune.svg",
  "Part of Spirit": "/images/planets/partofspirit.svg",
  "Galactic Center": "/images/planets/galacticcenter.svg",
  Midheaven: "/images/planets/midheaven.svg",
  Ascendant: "/images/planets/ascendantsymbol.svg",
  "Ascendant Symbol": "/images/planets/ascendantsymbol.svg",
  Descendant: "/images/planets/descendant.svg",
  "Imum Coeli": "/images/planets/imumcoeli.svg",
  "North Node": "/images/planets/northnode.svg",
  "South Node": "/images/planets/southnode.svg",
};

function trueSkyGraphAssetPath(relativePath) {
  return `./${String(relativePath || "").replace(/^\/+/, "")}`;
}

// Aspect symbol image paths
const aspectSymbols = {
  Conjunction: trueSkyGraphAssetPath("images/aspects/conjunction.svg"),
  Opposition: trueSkyGraphAssetPath("images/aspects/opposition.svg"),
  Square: trueSkyGraphAssetPath("images/aspects/square.svg"),
  Trine: trueSkyGraphAssetPath("images/aspects/trine.svg"),
  Sextile: trueSkyGraphAssetPath("images/aspects/sextile.svg"),
  Semisextile: trueSkyGraphAssetPath("images/aspects/semisextile.svg"),
  Quincunx: trueSkyGraphAssetPath("images/aspects/quincunx.svg"),
};


// Sign symbol image paths (colorized for sign ingresses)
const signSymbols = {
  Aries: trueSkyGraphAssetPath("images/signs/colorized/aries.svg"),
  Taurus: trueSkyGraphAssetPath("images/signs/colorized/taurus.svg"),
  Gemini: trueSkyGraphAssetPath("images/signs/colorized/gemini.svg"),
  Cancer: trueSkyGraphAssetPath("images/signs/colorized/cancer.svg"),
  Leo: trueSkyGraphAssetPath("images/signs/colorized/leo.svg"),
  Virgo: trueSkyGraphAssetPath("images/signs/colorized/virgo.svg"),
  Libra: trueSkyGraphAssetPath("images/signs/colorized/libra.svg"),
  Scorpio: trueSkyGraphAssetPath("images/signs/colorized/scorpio.svg"),
  Ophiuchus: trueSkyGraphAssetPath("images/signs/colorized/ophiuchus.svg"),
  Ofiuco: trueSkyGraphAssetPath("images/signs/colorized/ophiuchus.svg"),
  Sagittarius: trueSkyGraphAssetPath("images/signs/colorized/sagittarius.svg"),
  Capricorn: trueSkyGraphAssetPath("images/signs/colorized/capricorn.svg"),
  Aquarius: trueSkyGraphAssetPath("images/signs/colorized/aquarius.svg"),
  Pisces: trueSkyGraphAssetPath("images/signs/colorized/pisces.svg"),
};

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
};

// Aspect colors
const aspectColors = {
  Conjunction: "black",
  Opposition: "red",
  Square: "red",
  Trine: "blue",
  Sextile: "blue",
  Semisextile: "darkolivegreen",
  Quincunx: "darkolivegreen",
};

// Station colors
const stationColors = {
  retrograde: "deeppink",
  direct: "deepskyblue",
};

function isInvalidServerLoad() {
  const protocol = window.location.protocol;
  return !["http:", "https:"].includes(protocol);
}

function showServerRequiredWarning() {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML =
      '<div style="font-family: sans-serif; padding: 40px; background: #fff; color: #000; line-height:1.6;">' +
      '<h1>Abra este aplicativo via servidor local</h1>' +
      '<p>O aplicativo precisa ser aberto por um servidor HTTP local.</p>' +
      '<p>Use um endereço como:</p>' +
      '<ul>' +
      '<li><code>http://localhost:5501/</code></li>' +
      '</ul>' +
      '<p>Se você estiver usando o Live Server, certifique-se de que ele esteja em execução.</p>' +
      '</div>';
  });
}

// Load planet aspect descriptions
let planetAspectDescriptions = {};
let progressedPlanetHouseDescriptions = {};
let transitPlanetHouseDescriptions = {};
let graphPlanetRetroDescriptions = {};

if (isInvalidServerLoad()) {
  showServerRequiredWarning();
} else {
  Promise.all([
    fetch("/json/planetAspectDescriptions.json").then((res) => res.json()),
    fetch("/json/progressedPlanetHouseDescriptions.json").then((res) =>
      res.json()
    ),
    fetch("/json/transitPlanetHouseDescriptions.json").then((res) => res.json()),
  fetch("/json/graphPlanetRetroDescriptions.json").then((res) => res.json()),
])
  .then(([aspects, progressedHouses, transitHouses, retro]) => {
    planetAspectDescriptions = aspects;
    progressedPlanetHouseDescriptions = progressedHouses;
    transitPlanetHouseDescriptions = transitHouses;
    graphPlanetRetroDescriptions = retro;
  })
  .catch((err) => console.error("Failed to load descriptions:", err));
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

  const aspectTypeDisplay =
    aspectType.charAt(0).toUpperCase() + aspectType.slice(1);

  // Get planet icon keys - handle special cases
  let planet1IconKey = planet1Key.replace(/[\s-]+/g, "");
  if (planet1IconKey === "ascendant") planet1IconKey = "ascendantsymbol";

  let planet2IconKey = planet2Key.replace(/[\s-]+/g, "");
  if (planet2IconKey === "ascendant") planet2IconKey = "ascendantsymbol";

  // Get planet icons with proper margins
  const planet1Icon = `<img src="/images/planets/${planet1IconKey}.svg" width="28" height="28" style="vertical-align:middle;margin:-6px 2px 0 0"/>`;
  const planet2Icon = `<img src="/images/planets/${planet2IconKey}.svg" width="28" height="28" style="vertical-align:middle;margin:-6px 2px 0 0"/>`;
  const aspectIcon = `<img src="/images/aspects/${aspectType}.svg" width="24" height="24" style="vertical-align:middle;margin:-2px -2px 0 4px"/>`;

  const isMobile = window.innerWidth < 600;
  const fs = isMobile ? "16px" : "20px";

  c
    .append("div")
    .attr("class", "aspect-details")
    .attr(
      "style",
      `white-space:normal;word-wrap:break-word;font-size:${fs};max-width:90vw;overflow-wrap:break-word;padding:10px;`
    ).html(`
      <h3 style="margin:0 0 10px 0;">${planet1Icon}${planet1Display}${aspectIcon}${planet2Icon}${planet2Display}</h3>
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

// Show house placement interpretation popup
function showHouseDetails(planetName, houseNumber, chartType) {
  const tooltip = d3.select("#tooltip");

  // Clear and create new popup
  tooltip.html("");

  const tp = tooltip
    .append("div")
    .attr("class", "planet-tooltip-instance")
    .style("pointer-events", "auto");

  const c = tp.append("div").attr("class", "tooltip-content");

  // Normalize planet name to match JSON keys
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

  const planetKey = normalizeKey(planetName);
  const planetDisplay = getDisplayName(planetName);

  // Select appropriate description set based on chart type
  let houseDescriptions =
    chartType === "progressed"
      ? progressedPlanetHouseDescriptions
      : transitPlanetHouseDescriptions;

  // Get description from house descriptions
  const description =
    houseDescriptions[planetKey]?.[houseNumber] || "No description available";

  // Get planet icon key - handle special cases
  let planetIconKey = planetKey.replace(/[\s-]+/g, "");
  if (planetIconKey === "ascendant") planetIconKey = "ascendantsymbol";

  // Get planet icon
  const planetIcon = `<img src="/images/planets/${planetIconKey}.svg" width="28" height="28" style="vertical-align:middle;margin:-6px 4px 0 -4px"/>`;

  const isMobile = window.innerWidth < 600;
  const fs = isMobile ? "16px" : "20px";

  c
    .append("div")
    .attr("class", "planet-details")
    .attr(
      "style",
      `white-space:normal;word-wrap:break-word;font-size:${fs};max-width:90vw;overflow-wrap:break-word;padding:10px;`
    ).html(`
      <h3 style="margin:0 0 10px 0;">${planetIcon}${planetDisplay} in House ${houseNumber}</h3>
      <p style="margin:0;">${description}</p>
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

// Show station (retrograde/direct) interpretation popup
function showStationDetails(planetName, chartType) {
  const tooltip = d3.select("#tooltip");

  // Clear and create new popup
  tooltip.html("");

  const tp = tooltip
    .append("div")
    .attr("class", "planet-tooltip-instance")
    .style("pointer-events", "auto");

  const c = tp.append("div").attr("class", "tooltip-content");

  // Normalize planet name to match JSON keys
  const normalizeKey = (name) => {
    let key = name.toLowerCase().replace(/\s+/g, " ");
    if (key === "north node") return "north node";
    if (key === "south node") return "south node";
    return key;
  };

  const getDisplayName = (name) => {
    return name;
  };

  const planetKey = normalizeKey(planetName);
  const planetDisplay = getDisplayName(planetName);

  // Get description from retro descriptions
  const description =
    graphPlanetRetroDescriptions[planetKey]?.station ||
    "No description available";

  // Get planet icon key - handle special cases
  let planetIconKey = planetKey.replace(/[\s-]+/g, "");
  if (planetIconKey === "ascendant") planetIconKey = "ascendantsymbol";

  // Get planet icon
  const planetIcon = `<img src="/images/planets/${planetIconKey}.svg" width="28" height="28" style="vertical-align:middle;margin:-6px 4px 0 -4px"/>`;

  const isMobile = window.innerWidth < 600;
  const fs = isMobile ? "16px" : "20px";

  const chartTypeDisplay =
    chartType === "progressed" ? "Progressed" : "Transiting";

  c
    .append("div")
    .attr("class", "planet-details")
    .attr(
      "style",
      `white-space:normal;word-wrap:break-word;font-size:${fs};max-width:90vw;overflow-wrap:break-word;padding:10px;`
    ).html(`
      <h3 style="margin:0 0 10px 0;">${planetIcon}${chartTypeDisplay} ${planetDisplay} Station</h3>
      <p style="margin:0;">${description}</p>
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



async function safeJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error("Server returned invalid JSON while calculating graph.");
  }
}

function monthIndex(name) {
  return TRUE_SKY_GRAPH_MONTHS.indexOf(name);
}

function graphIsLunar13CalendarMode(value) {
  const key = String(value || "").trim().toLowerCase().replace(/[\s_\-]+/g, "");
  return key === "lunar13x28" || key === "lunar13" || key === "13x28" || key.includes("13x28");
}

function graphNormalizeLunar13MonthValue(value) {
  const match = String(value ?? "").trim().match(/(\d{1,2})/);
  const month = match ? Number.parseInt(match[1], 10) : 1;
  return Number.isFinite(month) ? Math.min(13, Math.max(1, month)) : 1;
}

function graphNormalizeCalendarFields(data, dayKey, monthKey, yearKey, calendarKey) {
  if (!data || !graphIsLunar13CalendarMode(data[calendarKey] ?? data.calendarSystem)) return;
  const year = parseHistoricalYear(data[yearKey]);
  const lunarMonth = graphNormalizeLunar13MonthValue(data[monthKey]);
  const lunarDay = Math.min(28, Math.max(1, Number.parseInt(data[dayKey], 10) || 1));
  const dayOfYearZeroBased = (lunarMonth - 1) * 28 + (lunarDay - 1);
  const date = makeHistoricalDate(year, 0, 1 + dayOfYearZeroBased, 0, 0, 0, 0, true);
  data[yearKey] = String(astronomicalYearToHistorical(date.getUTCFullYear()));
  data[monthKey] = TRUE_SKY_GRAPH_MONTHS[date.getUTCMonth()];
  data[dayKey] = String(date.getUTCDate());
  data[calendarKey] = "gregorian";
}

function graphNormalizeAllCalendarFields(data) {
  graphNormalizeCalendarFields(data, "startDay", "startMonth", "startYear", "startCalendarSystem");
  graphNormalizeCalendarFields(data, "endDay", "endMonth", "endYear", "endCalendarSystem");
  graphNormalizeCalendarFields(data, "day", "month", "year", "calendarSystem");
}

function dateParts(date) {
  return {
    year: astronomicalYearToHistorical(date.getFullYear()),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

function angularDistance(a, b) {
  const diff = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return diff;
}

function aspectOrb(posA, posB, aspectDeg) {
  return Math.abs(angularDistance(posA, posB) - aspectDeg);
}

function graphAspectDefs(selected) {
  const all = [
    { type: "Conjunction", deg: 0, orb: 3 },
    { type: "Opposition", deg: 180, orb: 3 },
    { type: "Square", deg: 90, orb: 3 },
    { type: "Trine", deg: 120, orb: 3 },
    { type: "Sextile", deg: 60, orb: 2 },
    { type: "Semisextile", deg: 30, orb: 1.5 },
    { type: "Quincunx", deg: 150, orb: 1.5 },
  ];
  const wanted = (selected || []).map((x) => String(x).toLowerCase());
  return wanted.length ? all.filter((a) => wanted.includes(a.type.toLowerCase())) : all;
}

function canonicalGraphObjectName(name) {
  const normalized = String(name || "")
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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
    "true node": "north node",
    "north node": "north node",
    "south node": "south node",
    "anti vertex": "anti vertex",
    "galactic center": "galactic center",
  };
  return aliases[normalized] || normalized;
}

function visibleBodies(chart, selected) {
  const wanted = new Set((selected || []).map(canonicalGraphObjectName));
  return chart.filter((p) => p && p.name && typeof p.position === "number" && p.isFixedStar !== true)
    .filter((p) => wanted.size > 0 && wanted.has(canonicalGraphObjectName(p.name)));
}

function addHit(groups, key, base, transit) {
  if (!groups.has(key)) groups.set(key, { ...base, transits: [] });
  groups.get(key).transits.push(transit);
}

function graphHouseSystemCode(name) {
  const key = String(name || "Placidus").toLowerCase();
  if (key.includes("koch")) return "K";
  if (key.includes("equal")) return "E";
  if (key.includes("whole")) return "W";
  if (key.includes("porphyry")) return "O";
  if (key.includes("regiomontanus")) return "R";
  if (key.includes("campanus")) return "C";
  return "P";
}

const GRAPH_AYANAMSA_VALUES = {
  Tropical: 0,
  IAU: 28.6888982207,
  IAU2: 29.12,
  IAUZeroAries: 33.8581806828,
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
  Pistak: 23.4363888889,
  Takra: 24.533333,
  TakraI: 24.533333,
  TakraII: 24.533333,
  Kanatas: 3.95,
  Chimenti: 32.087066,
};

function graphJulianDayFromDate(date) {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5 + hour / 24;
}

function graphSignedPrecessionFromJ2000(date) {
  const jd = graphJulianDayFromDate(date);
  const T = (jd - 2451545.0) / 36525;
  return (5029.0966 * T + 1.11113 * T * T - 0.000006 * T * T * T) / 3600;
}


function graphAyanamsaValueForKey(key) {
  const directMap = {
    tropical: "Tropical",
    iau: "IAU",
    iau2: "IAU2",
    iauzeroaries: "IAUZeroAries",
    midpointj2000: "MidpointJ2000",
    lahiri: "Lahiri",
    faganbradley: "FaganBradley",
    raman: "Raman",
    pistak: "Pistak",
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
  return valueKey ? GRAPH_AYANAMSA_VALUES[valueKey] : null;
}

function graphNormalizeAyanamsaName(value) {
  return String(value || "Tropical").trim().toLowerCase().replace(/[\s_()\-.°]/g, "");
}

function graphIsDraconicEnabled(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  const key = String(value).trim().toLowerCase();
  return key === "true" || key === "1" || key === "yes" || key === "on" || key === "draconic" || key === "draconico" || key === "dracônico";
}

function graphIsMidpointZodiacSystem(zodiacSystem) {
  const value = String(zodiacSystem || "").trim().toLowerCase();
  return value.includes("midpoint") || value.includes("true sidereal") || value.includes("mtz");
}

function graphNormalizeZodiacSystemKey(zodiacSystem) {
  return String(zodiacSystem || "").trim().toLowerCase().replace(/[\s_()\-.°]/g, "");
}

function graphIsTropicalEqualThirteenSignZodiacSystem(zodiacSystem) {
  const key = graphNormalizeZodiacSystemKey(zodiacSystem);
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

function graphIsSiderealEqualThirteenSignZodiacSystem(zodiacSystem) {
  const key = graphNormalizeZodiacSystemKey(zodiacSystem);
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

function graphIsEqualThirteenSignZodiacSystem(zodiacSystem) {
  return graphIsTropicalEqualThirteenSignZodiacSystem(zodiacSystem) || graphIsSiderealEqualThirteenSignZodiacSystem(zodiacSystem);
}

function graphIsIauRealThirteenSignZodiacSystem(zodiacSystem) {
  const key = graphNormalizeZodiacSystemKey(zodiacSystem);
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

function graphAdjustModernAyanamsaToDate(modernAyanamsa, date, epochYear = 2026) {
  const base = Number(modernAyanamsa);
  if (!Number.isFinite(base)) return 0;
  const epoch = makeHistoricalDate(Number(epochYear) || 2026, 0, 1, 12, 0, 0);
  return ((base + graphSignedPrecessionFromJ2000(date) - graphSignedPrecessionFromJ2000(epoch)) % 360 + 360) % 360;
}

function graphEffectiveAyanamsa(date, zodiacSystem, ayanamsaSystem, customAyanamsa) {
  if (graphIsMidpointZodiacSystem(zodiacSystem)) return GRAPH_AYANAMSA_VALUES.MidpointJ2000;
  if (graphIsIauRealThirteenSignZodiacSystem(zodiacSystem)) {
    return graphAdjustModernAyanamsaToDate(GRAPH_AYANAMSA_VALUES.IAU, date);
  }
  const key = graphNormalizeAyanamsaName(ayanamsaSystem);
  if (key === "tropical" || key === "0" || key === "none" || key === "semayanamsa") return 0;
  if (key === "custom") {
    const value = Number(customAyanamsa);
    return Number.isFinite(value) ? graphAdjustModernAyanamsaToDate(value, date) : 0;
  }
  const ayanamsaValue = graphAyanamsaValueForKey(key);
  if (ayanamsaValue !== null) return graphAdjustModernAyanamsaToDate(ayanamsaValue, date);
  return 0;
}

const GRAPH_TZ_STANDARD_OFFSET_CACHE = new Map();

function graphRawUtcOffsetNumber(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/(?:UTC|GMT)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?(?::?(\d{2}))?/i);
  if (match) {
    const sign = match[1] === "-" ? -1 : 1;
    const hours = Number.parseInt(match[2] || "0", 10);
    const minutes = Number.parseInt(match[3] || "0", 10);
    const seconds = Number.parseInt(match[4] || "0", 10);
    return sign * (hours + minutes / 60 + seconds / 3600);
  }
  const numeric = Number(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(numeric) ? numeric : NaN;
}

function graphIsNormalUtcOffsetHours(offset) {
  const n = Number(offset);
  if (!Number.isFinite(n) || n < -12 || n > 14) return false;
  const rawMinutes = n * 60;
  const totalMinutes = Math.round(rawMinutes);
  if (Math.abs(rawMinutes - totalMinutes) > 1e-6) return false;
  const minutePart = Math.abs(totalMinutes) % 60;
  return minutePart === 0 || minutePart === 15 || minutePart === 30 || minutePart === 45;
}

function graphNormalizeUtcOffsetHours(offset, fallback = 0) {
  const n = graphRawUtcOffsetNumber(offset);
  if (graphIsNormalUtcOffsetHours(n)) return Math.round(n * 60) / 60;
  const fb = graphRawUtcOffsetNumber(fallback);
  if (graphIsNormalUtcOffsetHours(fb)) return Math.round(fb * 60) / 60;
  if (Number.isFinite(n)) {
    const roundedMinutes = Math.max(-12 * 60, Math.min(14 * 60, Math.round(n * 4) * 15));
    return roundedMinutes / 60;
  }
  return 0;
}

function graphRawIanaOffsetFromIntl(timeZone, date) {
  const tz = String(timeZone || "").trim();
  if (!tz || !(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
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
      const parsed = graphRawUtcOffsetNumber(name);
      if (Number.isFinite(parsed)) return parsed;
    } catch (_) {
      break;
    }
  }
  return null;
}

function graphStandardTimezoneOffsetHours(timeZone, fallback = 0) {
  const key = String(timeZone || "").trim();
  const lowerKey = key.toLowerCase();
  if (!key) return graphNormalizeUtcOffsetHours(fallback, fallback);
  if (lowerKey === "utc" || lowerKey === "etc/utc" || lowerKey === "gmt" || lowerKey === "etc/gmt") return 0;
  if (GRAPH_TZ_STANDARD_OFFSET_CACHE.has(key)) return graphNormalizeUtcOffsetHours(GRAPH_TZ_STANDARD_OFFSET_CACHE.get(key), fallback);
  if (GRAPH_TZ_STANDARD_OFFSET_CACHE.has(lowerKey)) return graphNormalizeUtcOffsetHours(GRAPH_TZ_STANDARD_OFFSET_CACHE.get(lowerKey), fallback);

  const sampleDates = [
    new Date(Date.UTC(2024, 0, 15, 12, 0, 0)),
    new Date(Date.UTC(2024, 3, 15, 12, 0, 0)),
    new Date(Date.UTC(2024, 6, 15, 12, 0, 0)),
    new Date(Date.UTC(2024, 9, 15, 12, 0, 0)),
  ];
  const normalOffsets = sampleDates
    .map((date) => graphRawIanaOffsetFromIntl(key, date))
    .filter((offset) => graphIsNormalUtcOffsetHours(offset))
    .map((offset) => Math.round(offset * 60) / 60);
  if (normalOffsets.length) {
    const standard = Math.min(...normalOffsets);
    GRAPH_TZ_STANDARD_OFFSET_CACHE.set(key, standard);
    GRAPH_TZ_STANDARD_OFFSET_CACHE.set(lowerKey, standard);
    return standard;
  }
  return graphNormalizeUtcOffsetHours(fallback, fallback);
}

function graphIanaTimezoneOffsetHours(timeZone, utcGuessDate) {
  const tz = String(timeZone || "").trim();
  if (!tz || !tz.includes("/")) return null;
  const fallback = graphStandardTimezoneOffsetHours(tz, 0);
  if (!(utcGuessDate instanceof Date) || !Number.isFinite(utcGuessDate.getTime())) return fallback;
  if (utcGuessDate.getUTCFullYear() <= 0) return fallback;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(utcGuessDate).map((part) => [part.type, part.value]));
    const formattedYear = Number(parts.year);
    if (!Number.isFinite(formattedYear) || formattedYear <= 0) return fallback;
    const localAsUtc = makeHistoricalDate(
      formattedYear,
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second || 0),
      0,
      true
    );
    const rawOffset = (localAsUtc.getTime() - utcGuessDate.getTime()) / 3600000;
    return graphNormalizeUtcOffsetHours(rawOffset, fallback);
  } catch (_) {
    const rawOffset = graphRawIanaOffsetFromIntl(tz, utcGuessDate);
    return Number.isFinite(rawOffset) ? graphNormalizeUtcOffsetHours(rawOffset, fallback) : fallback;
  }
}

function graphParseUtcOffsetHours(value, fallback = 0) {
  const parsed = graphRawUtcOffsetNumber(value);
  if (Number.isFinite(parsed)) return graphNormalizeUtcOffsetHours(parsed, fallback);
  return graphNormalizeUtcOffsetHours(fallback, fallback);
}

function graphUtcOffsetForLocalDate(date, combinedData = {}, natalData = {}) {
  const fallback = graphParseUtcOffsetHours(natalData.utcOffset ?? natalData.utc ?? combinedData.utcOffset ?? combinedData.utc ?? 0);
  const timezoneForFallback = String(natalData.timezone ?? natalData.timezoneName ?? combinedData.timezone ?? combinedData.timezoneName ?? "").trim();
  const mode = String(natalData.utcMode ?? natalData.timezoneMode ?? combinedData.utcMode ?? combinedData.timezoneMode ?? "auto").toLowerCase();
  if (mode === "manual" || mode === "fixed") return graphNormalizeUtcOffsetHours(fallback, fallback);
  const safeFallback = graphStandardTimezoneOffsetHours(timezoneForFallback, Number.isFinite(fallback) ? fallback : 0);
  const timezone = timezoneForFallback;
  if (!timezone.includes("/") || !(date instanceof Date) || !Number.isFinite(date.getTime()) || date.getFullYear() <= 0) {
    return safeFallback;
  }

  const localWallClockAsUtc = makeHistoricalDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    0,
    true
  );
  let offset = safeFallback;
  for (let i = 0; i < 3; i += 1) {
    const utcGuess = new Date(localWallClockAsUtc.getTime() - offset * 3600000);
    const nextOffset = graphIanaTimezoneOffsetHours(timezone, utcGuess);
    if (!Number.isFinite(nextOffset)) return offset;
    if (Math.abs(nextOffset - offset) < 1 / 60) return graphNormalizeUtcOffsetHours(nextOffset, safeFallback);
    offset = nextOffset;
  }
  return graphNormalizeUtcOffsetHours(offset, safeFallback);
}

function graphSwissRequestForDate(date, combinedData, natalData) {
  return {
    historicalYear: astronomicalYearToHistorical(date.getFullYear()),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
    utcOffset: graphUtcOffsetForLocalDate(date, combinedData, natalData),
    lat: Number(natalData.lat ?? natalData.latitude ?? 0) || 0,
    long: Number(natalData.long ?? natalData.lon ?? natalData.longitude ?? 0) || 0,
    ayanamsa: graphEffectiveAyanamsa(
      date,
      combinedData.selectedZodiacSystem,
      combinedData.selectedAyanamsaSystem,
      combinedData.customAyanamsa
    ),
    houseSystemCode: graphHouseSystemCode(combinedData.selectedHouseSystem),
    trueNodes: (combinedData.trueNodes ?? natalData.trueNodes) !== false,
    trueLilith: (combinedData.trueLilith ?? natalData.trueLilith) === true,
  };
}

function graphNatalBaseDate(natalData) {
  const monthName = natalData?.month || natalData?.birthMonth || natalData?.natalMonth;
  const monthNumber = Number(natalData?.monthNumber || natalData?.monthIndex || 0);
  const month = monthName ? monthIndex(monthName) : Math.max(0, monthNumber - 1);
  return makeHistoricalDate(
    parseHistoricalYear(natalData?.year ?? natalData?.birthYear ?? new Date().getFullYear()),
    Number.isFinite(month) && month >= 0 ? month : new Date().getMonth(),
    parseInt(natalData?.day ?? natalData?.birthDay ?? new Date().getDate(), 10) || 1,
    parseInt(natalData?.hour ?? natalData?.birthHour ?? 0, 10) || 0,
    parseInt(natalData?.minute ?? natalData?.birthMinute ?? 0, 10) || 0,
    parseInt(natalData?.second ?? natalData?.birthSecond ?? 0, 10) || 0
  );
}

function graphProgressedDateFor(transitDate, natalData) {
  // Secondary progressions: one ephemeris day after birth for each lived year.
  const natalDate = graphNatalBaseDate(natalData);
  if (!Number.isFinite(natalDate.getTime())) return new Date(transitDate);
  const livedDays = (transitDate.getTime() - natalDate.getTime()) / 86400000;
  const progressedDays = livedDays / 365.2425;
  return new Date(natalDate.getTime() + progressedDays * 86400000);
}

function graphTypeEnabled(selectedTypes, label) {
  const wanted = String(label || '').toLowerCase();
  if (!selectedTypes.length) return true;
  return selectedTypes.some((t) => t === wanted || t.includes(wanted));
}

function addPairAspectHits(groups, prefixA, bodiesA, prefixB, bodiesB, aspects, datePartsValue, sampleStepDays, skipSameNames = false) {
  const rendered = new Set();
  for (const a of bodiesA) {
    for (const b of bodiesB) {
      if (skipSameNames && canonicalGraphObjectName(a.name) === canonicalGraphObjectName(b.name)) continue;
      for (const asp of aspects) {
        const orb = aspectOrb(a.position, b.position, asp.deg);
        if (orb > asp.orb) continue;
        const leftKey = canonicalGraphObjectName(a.name);
        const rightKey = canonicalGraphObjectName(b.name);
        const unordered = prefixA === prefixB
          ? [leftKey, rightKey].sort().join('|')
          : `${leftKey}|${rightKey}`;
        const renderKey = `${prefixA}|${prefixB}|${unordered}|${asp.type}`;
        if (rendered.has(renderKey)) continue;
        rendered.add(renderKey);
        const base = { type: asp.type };
        if (prefixA === 'Tr') base.transitingPlanet = a.name;
        if (prefixA === 'Pr') base.progressedPlanet = a.name;
        if (prefixB === 'Na') base.natalPlanet = b.name;
        if (prefixB === 'Tr') base.transitingPlanet2 = b.name;
        if (prefixB === 'Pr') base.progressedPlanet2 = b.name;
        addHit(groups, `${prefixA}|${a.name}|${asp.type}|${prefixB}|${b.name}`, base, {
          date: datePartsValue,
          orb,
          position: a.position,
          targetPosition: b.position,
          sampleStepDays,
        });
      }
    }
  }
}

function graphSwissApiUrls() {
  const urls = [];
  const add = (url) => { if (url && !urls.includes(url)) urls.push(url); };
  const configured = typeof window !== "undefined" ? String(window.TRUESKY_API_BASE_URL || "").replace(/\/+$/, "") : "";
  if (configured) add(`${configured}/api/swiss-ephemeris`);
  if (typeof window !== "undefined" && window.location && window.location.protocol !== "file:") {
    add(`${window.location.origin}/api/swiss-ephemeris`);
  }
  add("http://localhost:5501/api/swiss-ephemeris");
  add("http://127.0.0.1:5501/api/swiss-ephemeris");
  return urls;
}

async function fetchSwissGraphBatch(requests) {
  if (!requests.length) return [];
  const errors = [];
  for (const url of graphSwissApiUrls()) {
    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch: requests }),
      });
    } catch (fetchError) {
      errors.push(`${url}: ${fetchError?.message || fetchError}`);
      continue;
    }
    const payload = await safeJsonResponse(response);
    if (response.ok && payload?.success && Array.isArray(payload.results)) {
      return payload.results;
    }
    errors.push(`${url}: ${payload?.error || response.statusText || "Graph batch calculation failed."}`);
  }
  throw new Error(`Não consegui conectar/calcular no servidor Swiss. Testei: ${errors.join(" | ")}. Abra por http://localhost:5501 depois de rodar npm start.`);
}

function graphBodiesFromSwissPayload(payload, draconic = false) {
  if (!payload?.success || !payload.positions) return [];
  const aliases = { Ascendant: "Ascendant Symbol", AS: "Ascendant Symbol", MC: "Midheaven", IC: "Imum Coeli", DS: "Descendant", Desc: "Descendant", "Anti Vertex": "Anti-Vertex" };
  const norm = (value) => ((Number(value) % 360) + 360) % 360;
  const bodies = Object.entries(payload.positions)
    .filter(([, item]) => item && Number.isFinite(Number(item.position)))
    .map(([rawName, item]) => {
      const anchor = Number(item.houseAnchorPosition ?? item.anchorPosition ?? item.renderPosition);
      const anchorHouse = Number(item.houseAnchorHouse ?? item.renderHouse);
      return {
        name: aliases[rawName] || rawName,
        position: norm(item.position),
        houseAnchorPosition: Number.isFinite(anchor) ? norm(anchor) : undefined,
        anchorPosition: Number.isFinite(anchor) ? norm(anchor) : undefined,
        renderPosition: Number.isFinite(anchor) ? norm(anchor) : undefined,
        houseAnchorHouse: Number.isFinite(anchorHouse) ? anchorHouse : undefined,
        renderHouse: Number.isFinite(anchorHouse) ? anchorHouse : undefined,
        retrograde: item.retrograde === true || item.retrograde === "sd" || item.retrograde === "sr" || (Number.isFinite(Number(item.speed)) && Number(item.speed) < 0),
        speed: Number(item.speed) || 0,
      };
    });

  if (!graphIsDraconicEnabled(draconic)) return bodies;
  const northNode = bodies.find((body) => body.name === "North Node" && Number.isFinite(Number(body.position)));
  const offset = Number(northNode?.position);
  if (!Number.isFinite(offset)) return bodies;

  return bodies.map((body) => {
    const basePosition = norm(body.position);
    const position = norm(basePosition - offset);
    const baseAnchor = Number(body.houseAnchorPosition ?? body.anchorPosition ?? body.renderPosition);
    const anchorPosition = Number.isFinite(baseAnchor) ? norm(baseAnchor - offset) : undefined;
    return {
      ...body,
      baseZodiacPosition: basePosition,
      draconicOffset: offset,
      draconicPosition: position,
      position,
      houseAnchorPosition: Number.isFinite(anchorPosition) ? anchorPosition : body.houseAnchorPosition,
      anchorPosition: Number.isFinite(anchorPosition) ? anchorPosition : body.anchorPosition,
      renderPosition: Number.isFinite(anchorPosition) ? anchorPosition : body.renderPosition,
    };
  });
}

async function calculateGraphLocally(combinedData) {
  graphNormalizeAllCalendarFields(combinedData);
  const start = makeHistoricalDate(
    parseHistoricalYear(combinedData.startYear), monthIndex(combinedData.startMonth), parseInt(combinedData.startDay),
    parseInt(combinedData.startHour) || 0, parseInt(combinedData.startMinute) || 0
  );
  const end = makeHistoricalDate(
    parseHistoricalYear(combinedData.endYear), monthIndex(combinedData.endMonth), parseInt(combinedData.endDay),
    parseInt(combinedData.endHour) || 0, parseInt(combinedData.endMinute) || 0
  );
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    throw new Error("Invalid graph date range.");
  }

  const natalData = combinedData.natalData || JSON.parse(localStorage.getItem("natalData") || "null");
  if (!natalData) throw new Error("Calculate the natal chart before calculating the graph.");

  const draconicEnabled = graphIsDraconicEnabled(combinedData.draconic ?? natalData.draconic);
  const natalChart = await calculateAstrologyChart({
    ...natalData,
    selectedZodiacSystem: combinedData.selectedZodiacSystem || natalData.selectedZodiacSystem || natalData.zodiacSystem || "Tropical",
    zodiacSystem: combinedData.selectedZodiacSystem || natalData.zodiacSystem || natalData.selectedZodiacSystem || "Tropical",
    selectedAyanamsaSystem: combinedData.selectedAyanamsaSystem || natalData.selectedAyanamsaSystem || natalData.ayanamsaSystem || "Tropical",
    ayanamsaSystem: combinedData.selectedAyanamsaSystem || natalData.ayanamsaSystem || natalData.selectedAyanamsaSystem || "Tropical",
    customAyanamsa: Number(combinedData.customAyanamsa ?? natalData.customAyanamsa ?? 0),
    selectedHouseSystem: combinedData.selectedHouseSystem || natalData.selectedHouseSystem || natalData.houseSystem || "Placidus",
    houseSystem: combinedData.selectedHouseSystem || natalData.houseSystem || natalData.selectedHouseSystem || "Placidus",
    selectedCoordinateSystem: combinedData.selectedCoordinateSystem || natalData.selectedCoordinateSystem || natalData.coordinateSystem || "Ecliptic",
    coordinateSystem: combinedData.selectedCoordinateSystem || natalData.coordinateSystem || natalData.selectedCoordinateSystem || "Ecliptic",
    trueNodes: (combinedData.trueNodes ?? natalData.trueNodes) !== false,
    trueLilith: (combinedData.trueLilith ?? natalData.trueLilith) === true,
    draconic: draconicEnabled,
  });
  const natalBodies = visibleBodies(natalChart, combinedData.selectedPlanetsNatal);
  const aspects = graphAspectDefs(combinedData.selectedTransitingAspects);
  const selectedTypes = (combinedData.selectedTransitingTypes || []).map((x) => String(x).trim().toLowerCase());

  const useTransitsNatal = graphTypeEnabled(selectedTypes, "transiting to natal");
  const useProgressedNatal = graphTypeEnabled(selectedTypes, "progressed to natal");
  const useTransitTransit = graphTypeEnabled(selectedTypes, "transiting to transiting");
  const useProgressedProgressed = graphTypeEnabled(selectedTypes, "progressed to progressed");
  const useTransitProgressed = graphTypeEnabled(selectedTypes, "transiting to progressed") || graphTypeEnabled(selectedTypes, "progressed and transiting");

  const needsTransit = useTransitsNatal || useTransitTransit || useTransitProgressed;
  const needsProgressed = useProgressedNatal || useProgressedProgressed || useTransitProgressed;

  const groups = new Map();
  const stepMs = 24 * 60 * 60 * 1000;
  const rawDays = Math.max(1, Math.ceil((end - start) / stepMs));
  const maxSamples = rawDays <= 45 ? Math.min(240, rawDays + 1) : 120;
  const every = Math.max(1, Math.ceil(rawDays / maxSamples));
  const sampleDates = [];

  for (let i = 0; i <= rawDays; i += every) {
    sampleDates.push(new Date(start.getTime() + i * stepMs));
  }
  if (sampleDates.length && sampleDates[sampleDates.length - 1].getTime() < end.getTime()) {
    sampleDates.push(new Date(end));
  }

  const batchRequests = [];
  const requestMap = [];
  sampleDates.forEach((date, index) => {
    if (needsTransit) {
      batchRequests.push(graphSwissRequestForDate(date, combinedData, natalData));
      requestMap.push({ kind: "transit", index });
    }
    if (needsProgressed) {
      batchRequests.push(graphSwissRequestForDate(graphProgressedDateFor(date, natalData), combinedData, natalData));
      requestMap.push({ kind: "progressed", index });
    }
  });

  const batchResults = await fetchSwissGraphBatch(batchRequests);
  const transitByIndex = new Map();
  const progressedByIndex = new Map();
  batchResults.forEach((payload, requestIndex) => {
    const info = requestMap[requestIndex];
    if (!info || !payload?.success) return;
    const bodies = graphBodiesFromSwissPayload(payload, combinedData.draconic);
    if (info.kind === "transit") transitByIndex.set(info.index, bodies);
    if (info.kind === "progressed") progressedByIndex.set(info.index, bodies);
  });

  sampleDates.forEach((d, index) => {
    const dp = dateParts(d);
    const transitBodiesAll = transitByIndex.get(index) || [];
    const progressedBodiesAll = progressedByIndex.get(index) || [];
    const transitBodies = visibleBodies(transitBodiesAll, combinedData.selectedPlanetsTransit);
    const progressedBodies = visibleBodies(progressedBodiesAll, combinedData.selectedPlanetsProgressed);

    if (useTransitsNatal) {
      addPairAspectHits(groups, "Tr", transitBodies, "Na", natalBodies, aspects, dp, every, false);
    }
    if (useProgressedNatal) {
      addPairAspectHits(groups, "Pr", progressedBodies, "Na", natalBodies, aspects, dp, every, false);
    }
    if (useTransitTransit) {
      addPairAspectHits(groups, "Tr", transitBodies, "Tr", transitBodies, aspects, dp, every, true);
    }
    if (useProgressedProgressed) {
      addPairAspectHits(groups, "Pr", progressedBodies, "Pr", progressedBodies, aspects, dp, every, true);
    }
    if (useTransitProgressed) {
      addPairAspectHits(groups, "Tr", transitBodies, "Pr", progressedBodies, aspects, dp, every, false);
    }
  });

  const result = [...groups.values()].filter((g) => g.transits.length);
  window.graphLastCalculationStats = {
    samples: sampleDates.length,
    sampleStepDays: every,
    swissRequests: batchRequests.length,
    aspectRows: result.length,
    types: {
      transitsNatal: useTransitsNatal,
      progressedNatal: useProgressedNatal,
      transitsTransits: useTransitTransit,
      progressedProgressed: useProgressedProgressed,
      transitsProgressed: useTransitProgressed,
    },
    start: start.toISOString(),
    end: end.toISOString(),
  };
  return result;
}

// Global variables for red line and date label
let verticalLine = null;
let verticalText = null;


const TRUE_SKY_GRAPH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function setInputValueIfEmpty(id, value) {
  const el = document.getElementById(id);
  if (el && !String(el.value || "").trim()) el.value = String(value);
}

function ensureGraphDefaultFields() {
  const today = new Date();
  const defaultLocation =
    window.TrueSkyDefaultLocation?.get?.() ||
    document.getElementById("defaultLocation")?.value.trim() ||
    "New York City, New York, United States";

  setInputValueIfEmpty("graphStartDay", today.getDate());
  setInputValueIfEmpty("graphStartMonth", TRUE_SKY_GRAPH_MONTHS[today.getMonth()]);
  setInputValueIfEmpty("graphStartYear", today.getFullYear() - 1);
  setInputValueIfEmpty("graphStartHour", String(today.getHours()).padStart(2, "0"));
  setInputValueIfEmpty("graphStartMinute", String(today.getMinutes()).padStart(2, "0"));
  setInputValueIfEmpty("graphEndDay", today.getDate());
  setInputValueIfEmpty("graphEndMonth", TRUE_SKY_GRAPH_MONTHS[today.getMonth()]);
  setInputValueIfEmpty("graphEndYear", today.getFullYear() + 1);
  setInputValueIfEmpty("graphEndHour", String(today.getHours()).padStart(2, "0"));
  setInputValueIfEmpty("graphEndMinute", String(today.getMinutes()).padStart(2, "0"));
  setInputValueIfEmpty("graphLocation", defaultLocation);
}

function readStoredNatalData() {
  try {
    const raw = localStorage.getItem("natalData");
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function submitFormSafely(form) {
  if (!form) return;
  // Dispatch the submit handler directly. Native requestSubmit() can be blocked
  // by browser validation on hidden/off-screen fields, which left the Graph
  // button showing "Calculating graph..." without ever running the calculator.
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

function graphHasRenderedSvg() {
  return !!document.querySelector("#graph svg");
}

function setGraphStatus(message) {
  const errorContainer = document.querySelector(".errorMessageGraph");
  if (errorContainer) errorContainer.textContent = message || "";
}

function hideGraphUntilManualCalculate() {
  const graph = document.getElementById("graph");
  if (!graph || window.graphHasBeenManuallyCalculated || window.graphManualCalculateRequested) return;
  graph.innerHTML = "";
  graph.style.display = "none";
  graph.style.visibility = "hidden";
}

function showGraphOutputArea() {
  const graph = document.getElementById("graph");
  if (!graph) return;
  graph.style.display = "block";
  graph.style.visibility = "visible";
}

function waitForGraphRender(timeoutMs = 45000) {
  if (graphHasRenderedSvg()) return Promise.resolve(true);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Graph calculation timed out."));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      document.removeEventListener("graph:rendered", onRendered);
      document.removeEventListener("graph:error", onError);
    }
    function onRendered() {
      cleanup();
      resolve(true);
    }
    function onError(event) {
      cleanup();
      reject(new Error(event?.detail?.message || "Graph calculation failed."));
    }
    document.addEventListener("graph:rendered", onRendered, { once: true });
    document.addEventListener("graph:error", onError, { once: true });
  });
}

async function calculateGraphNow({ force = false, allowProgrammatic = false } = {}) {
  ensureGraphDefaultFields();
  const graphSection = document.getElementById("showGraph");
  if (graphSection) graphSection.style.display = "block";
  const graphForm = document.getElementById("graphForm");
  if (!graphForm) throw new Error("Graph form not found.");
  if (!force && graphHasRenderedSvg()) return true;

  // Do not auto-render the Graph just because the GRAPH tab, View, or Report was opened.
  // The visible graph is generated only after the user clicks the Calculate button.
  if (!allowProgrammatic && !window.graphHasBeenManuallyCalculated) {
    hideGraphUntilManualCalculate();
    const message = "Click Calculate to generate the graph.";
    setGraphStatus(message);
    throw new Error(message);
  }

  showGraphOutputArea();
  setGraphStatus("Calculating graph...");
  submitFormSafely(graphForm);
  return waitForGraphRender();
}

function ensureNatalDefaultFields() {
  const today = new Date();
  const defaultLocation =
    window.TrueSkyDefaultLocation?.get?.() ||
    document.getElementById("defaultLocation")?.value.trim() ||
    "New York City, New York, United States";

  setInputValueIfEmpty("natalName", "Today");
  setInputValueIfEmpty("natalDay", today.getDate());
  setInputValueIfEmpty("natalMonth", TRUE_SKY_GRAPH_MONTHS[today.getMonth()]);
  setInputValueIfEmpty("natalYear", today.getFullYear());
  setInputValueIfEmpty("natalHour", String(today.getHours()).padStart(2, "0"));
  setInputValueIfEmpty("natalMinute", String(today.getMinutes()).padStart(2, "0"));
  setInputValueIfEmpty("natalLocation", defaultLocation);
}

function selectedValues(selector) {
  return Array.from(document.querySelectorAll(selector))
    .filter((el) => el.checked)
    .map((el) => el.value);
}

function readSystemSettingsForGraph() {
  return {
    selectedZodiacSystem: document.querySelector('#system-settings select[name="zodiacSystem"]')?.value || "Tropical",
    selectedHouseSystem: document.querySelector('#system-settings select[name="houseSystem"]')?.value || "Placidus",
    selectedCoordinateSystem: document.querySelector('#system-settings select[name="coordinateSystem"]')?.value || "Ecliptic",
    selectedAyanamsaSystem: document.querySelector('#system-settings select[name="ayanamsaSystem"]')?.value || "Tropical",
    customAyanamsa: Number(document.querySelector('#system-settings input[name="customAyanamsa"]')?.value ?? 0),
    trueNodes: document.querySelector('.degree-settings input[name="trueNodes"], input[name="trueNodes"]')?.checked ?? true,
    trueLilith: document.querySelector('.degree-settings input[name="trueLilith"], input[name="trueLilith"]')?.checked ?? false,
    draconic: document.querySelector('.degree-settings input[name="draconic"], input[name="draconic"]')?.checked ?? false,
  };
}

function buildNatalFormDataForGraph() {
  ensureNatalDefaultFields();
  const system = readSystemSettingsForGraph();
  return {
    formType: "natal",
    name: document.getElementById("natalName")?.value || "Today",
    day: document.getElementById("natalDay")?.value || String(new Date().getDate()),
    month: document.getElementById("natalMonth")?.value || TRUE_SKY_GRAPH_MONTHS[new Date().getMonth()],
    year: document.getElementById("natalYear")?.value || String(new Date().getFullYear()),
    hour: document.getElementById("natalHour")?.value || "00",
    minute: document.getElementById("natalMinute")?.value || "00",
    location: document.getElementById("natalLocation")?.value || "New York City, New York, United States",
    selectedPlanets: selectedValues('#planet-settings input[name="planet"]:checked'),
    selectedPlanetsAspects: selectedValues('#planet-settings input[name="planetAspects"]:checked'),
    selectedAspects: selectedValues('#aspect-settings input[name="aspects"]:checked'),
    trueNodes: document.querySelector('.degree-settings input[name="trueNodes"], input[name="trueNodes"]')?.checked ?? true,
    trueLilith: document.querySelector('.degree-settings input[name="trueLilith"], input[name="trueLilith"]')?.checked ?? false,
    draconic: document.querySelector('.degree-settings input[name="draconic"], input[name="draconic"]')?.checked ?? false,
    ...system,
  };
}

async function calculateAndStoreNatalDataForGraph() {
  const natalChart = await calculateAstrologyChart(buildNatalFormDataForGraph());
  if (!Array.isArray(natalChart) || !natalChart[0]) {
    throw new Error("Natal chart calculation returned no data.");
  }
  const natalMeta = natalChart[0];
  const system = readSystemSettingsForGraph();
  const natalData = {
    ...natalMeta,
    _chart: natalChart,
    selectedPlanets: buildNatalFormDataForGraph().selectedPlanets,
    selectedPlanetsAspects: buildNatalFormDataForGraph().selectedPlanetsAspects,
    selectedAspects: buildNatalFormDataForGraph().selectedAspects,
    zodiacSystem: system.selectedZodiacSystem,
    ayanamsaSystem: system.selectedAyanamsaSystem,
    customAyanamsa: system.customAyanamsa,
    houseSystem: system.selectedHouseSystem,
    coordinateSystem: system.selectedCoordinateSystem,
    trueNodes: system.trueNodes !== false,
    trueLilith: system.trueLilith === true,
    draconic: graphIsDraconicEnabled(system.draconic),
  };
  localStorage.setItem("natalData", JSON.stringify(natalData));
  document.dispatchEvent(new CustomEvent("natalChartComplete"));
  return natalData;
}

async function ensureNatalDataForGraph() {
  const before = readStoredNatalData();
  if (before && before.name) return before;

  // Do the natal calculation directly for the graph. This makes the Graph tab
  // independent of hidden form submission, so clicking Graph/Calculate always
  // produces data instead of silently waiting behind the scenes.
  return calculateAndStoreNatalDataForGraph();
}

// Calculate button
document.getElementById("graphForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  document.getElementById("loading-overlay").style.display = "block";
  ensureGraphDefaultFields();

  let natalData;
  try {
    natalData = await ensureNatalDataForGraph();
  } catch (error) {
    document.getElementById("loading-overlay").style.display = "none";
    window._graphNeedsOverlay = false;
    const errorContainer = document.querySelector(".errorMessageGraph");
    if (errorContainer) errorContainer.textContent = error?.message || String(error);
    return;
  }

  const formData = new FormData(this);
  const formDataObj = Object.fromEntries(formData);
  graphNormalizeAllCalendarFields(formDataObj);
  const combinedData = { ...formDataObj, natalData };

  // Retrieve selected settings from DOM
  const selectedPlanetsNatal = Array.from(
    document.querySelectorAll(
      '#graph-planet-settings input[name="planetNatal"]:checked'
    )
  ).map((checkbox) => checkbox.value);
  const selectedPlanetsProgressed = Array.from(
    document.querySelectorAll(
      '#graph-planet-settings input[name="planetProgressed"]:checked'
    )
  ).map((checkbox) => checkbox.value);
  const selectedPlanetsTransit = Array.from(
    document.querySelectorAll(
      '#graph-planet-settings input[name="planetTransit"]:checked'
    )
  ).map((checkbox) => checkbox.value);
  const selectedTransitingAspects = Array.from(
    document.querySelectorAll(
      '#graph-aspect-settings input[name="transitingAspects"]:checked'
    )
  ).map((checkbox) => checkbox.value);
  const selectedTransitingTypes = Array.from(
    document.querySelectorAll(
      '#graph-type-settings input[name="transitingTypes"]:checked'
    )
  ).map((checkbox) => checkbox.value);
  const selectedZodiacSystem = document.querySelector(
    '#system-settings select[name="zodiacSystem"]'
  ).value;
  const selectedHouseSystem = document.querySelector(
    '#system-settings select[name="houseSystem"]'
  ).value;
  const selectedCoordinateSystem = document.querySelector(
    '#system-settings select[name="coordinateSystem"]'
  ).value;
  const selectedAyanamsaSystem = document.querySelector(
    '#system-settings select[name="ayanamsaSystem"]'
  ).value;
  const customAyanamsa = Number(
    document.querySelector('#system-settings input[name="customAyanamsa"]')?.value ?? 0
  );
  const trueNodes = document.querySelector('.degree-settings input[name="trueNodes"], input[name="trueNodes"]')?.checked ?? true;
  const trueLilith = document.querySelector('.degree-settings input[name="trueLilith"], input[name="trueLilith"]')?.checked ?? false;
  const draconic = document.querySelector('.degree-settings input[name="draconic"], input[name="draconic"]')?.checked ?? false;

  combinedData.selectedPlanetsNatal = selectedPlanetsNatal;
  combinedData.selectedPlanetsProgressed = selectedPlanetsProgressed;
  combinedData.selectedPlanetsTransit = selectedPlanetsTransit;
  combinedData.selectedTransitingAspects = selectedTransitingAspects;
  combinedData.selectedTransitingTypes = selectedTransitingTypes;
  combinedData.selectedZodiacSystem = selectedZodiacSystem;
  combinedData.selectedHouseSystem = selectedHouseSystem;
  combinedData.selectedCoordinateSystem = selectedCoordinateSystem;
  combinedData.selectedAyanamsaSystem = selectedAyanamsaSystem;
  combinedData.customAyanamsa = customAyanamsa;
  combinedData.trueNodes = trueNodes;
  combinedData.trueLilith = trueLilith;
  combinedData.draconic = draconic;

  calculateGraphLocally(combinedData)
    .then(async (data) => {
      document.getElementById("loading-overlay").style.display = "none";
      window._graphNeedsOverlay = false;
      if (!Array.isArray(data)) {
        data = await calculateGraphLocally(combinedData);
      }
      document.querySelector(".errorMessageGraph").textContent = "";
      // console.log(data);

      // Store graph form data globally for print view
      window.graphFormData = combinedData;

      const aspectContainer = document.getElementById("graph");
      aspectContainer.innerHTML = "";
      const graphStats = window.graphLastCalculationStats || {};
      const graphSummary = document.createElement("div");
      graphSummary.className = "graph-calculation-summary";
      graphSummary.style.cssText = "font-family:Segoe UI,Arial,sans-serif;font-size:13px;font-weight:600;color:#444;padding:8px 12px 4px 12px;";
      graphSummary.textContent = `Calculation visible: ${graphStats.samples || 0} Swiss samples, step ${graphStats.sampleStepDays || 1} day(s), ${Array.isArray(data) ? data.length : 0} aspect row(s).`;
      aspectContainer.appendChild(graphSummary);
      if (!Array.isArray(data) || data.length === 0) {
        const empty = document.createElement("div");
        empty.className = "graph-empty";
        empty.style.cssText = "padding:24px;text-align:center;";
        empty.textContent = "No graph aspects found for the selected planets, aspects and date range.";
        aspectContainer.appendChild(empty);
        document.dispatchEvent(new CustomEvent("graph:rendered", { detail: { empty: true } }));
        return;
      }

      // Gather dates for x-axis
      const dates = [];
      data.forEach((aspect) => {
        aspect.transits.forEach((transit) => {
          const { year, month, day, hour, minute, second } = transit.date;
          dates.push(
            makeHistoricalDate(year, month - 1, day, hour || 0, minute || 0, second || 0)
          );
        });
      });
      // Use user's input dates for graph domain (not transit data dates)
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      const minDate = makeHistoricalDate(
        parseHistoricalYear(combinedData.startYear),
        monthNames.indexOf(combinedData.startMonth),
        parseInt(combinedData.startDay),
        parseInt(combinedData.startHour) || 0,
        parseInt(combinedData.startMinute) || 0
      );
      const maxDate = makeHistoricalDate(
        parseHistoricalYear(combinedData.endYear),
        monthNames.indexOf(combinedData.endMonth),
        parseInt(combinedData.endDay),
        parseInt(combinedData.endHour) || 0,
        parseInt(combinedData.endMinute) || 0
      );
      const timeFrameInDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);

      // Group aspects by type/text
      const groupedAspects = {};
      data.forEach((aspect) => {
        const planetPrefix1 = aspect.transitingPlanet ? "Tr" : "Pr";
        const planet1 = aspect.transitingPlanet || aspect.progressedPlanet;
        let planetPrefix2 = "";
        let planet2 = "";
        if (aspect.type !== "Ingress") {
          if (aspect.natalPlanet) {
            // For natal planets, use " Na" as prefix.
            planetPrefix2 = " Na";
            planet2 = aspect.natalPlanet;
          } else {
            planetPrefix2 = aspect.transitingPlanet2
              ? " Tr"
              : aspect.progressedPlanet2
              ? " Pr"
              : "";
            planet2 =
              aspect.transitingPlanet2 || aspect.progressedPlanet2 || "";
          }
        } else {
          planet2 =
            aspect.natalPlanet ||
            aspect.transitingPlanet2 ||
            aspect.progressedPlanet2 ||
            "";
        }
        let tokens = [planetPrefix1, planet1];

        if (aspect.type === "Direct" || aspect.type === "Retrograde") {
          tokens.push("Station");
        } else if (aspect.type === "Ingress") {
          if (planet2) {
            // If the second planet is North Node, push its name and abbreviation as separate tokens
            if (planetPrefix2 && planet2.toLowerCase() === "north node") {
              tokens.push(planet2);
              tokens.push(planetPrefix2.trim());
            } else if (planetPrefix2) {
              tokens.push(`${planet2} ${planetPrefix2}`);
            } else {
              tokens.push(planet2);
            }
          }
        } else {
          tokens.push(aspect.type);
          if (planet2) {
            if (planetPrefix2 && planet2.toLowerCase() === "north node") {
              tokens.push(planet2);
              tokens.push(planetPrefix2.trim());
            } else if (planetPrefix2) {
              tokens.push(`${planet2} ${planetPrefix2}`);
            } else {
              tokens.push(planet2);
            }
          }
        }
        const aspectText = tokens.join(" ");
        if (!groupedAspects[aspectText]) groupedAspects[aspectText] = [];
        groupedAspects[aspectText].push({ aspect, tokens });
      });

      const groupedAspectsArray = Object.entries(groupedAspects);

      // Store groupedAspectsArray globally for report generation (preserves display order)
      window.graphGroupedAspects = groupedAspectsArray;

      // Setup SVG dimensions and scales
      const margin = { top: 40, right: 20, bottom: 0, left: 200 };
      const outerWidth = Math.max(900, aspectContainer.getBoundingClientRect().width || window.innerWidth || 900);
      const width = Math.max(600, outerWidth - margin.left - margin.right);
      const height = groupedAspectsArray.length * 32;

      const svgElement = d3
        .select("#graph")
        .append("svg")
        .attr(
          "viewBox",
          `0 0 ${width + margin.left + margin.right} ${
            height + margin.top + margin.bottom
          }`
        )
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .style("width", "100%")
        .style("height", `${height + margin.top + margin.bottom}px`)
        .attr("preserveAspectRatio", "xMinYMin meet");

      // Store graph data for print handlers
      window.graphFormData = window.graphFormData || {};
      window.graphFormData.svgWidth = width + margin.left + margin.right;
      window.graphFormData.svgHeight = height + margin.top + margin.bottom;

      const svg = svgElement
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
      const x = d3
        .scaleTime()
        .domain([minDate, maxDate])
        .range([0, width - margin.right]);
      const y = d3
        .scaleBand()
        .range([0, height])
        .domain(groupedAspectsArray.map((d, i) => i))
        .padding(0.1);

      // Prepare tooltip element (already in the DOM)
      const tooltip = d3.select(".tooltip");
      tooltip.style("opacity", 0).html("");
      const oldDateElement = document.getElementById("fixedDateText");
      if (oldDateElement && oldDateElement._stickyListener) {
        window.removeEventListener("scroll", oldDateElement._stickyListener);
      }
      d3.select("#fixedDateText").remove();

      let verticalLine = null;
      let verticalText = null;

      svg
        .append("clipPath")
        .attr("id", "clipXAxis")
        .append("rect")
        .attr("x", 0)
        .attr("y", -margin.top)
        .attr("width", width - margin.right)
        .attr("height", height + margin.top);

      const xAxisGroup = svg.append("g").attr("clip-path", "url(#clipXAxis)");

      // Draw grid lines and labels based on the timeframe
      if (timeFrameInDays < 32) {
        const currentDate = new Date(minDate);
        currentDate.setHours(0, 0, 0, 0);
        while (currentDate <= maxDate) {
          xAxisGroup
            .append("line")
            .attr("x1", x(currentDate))
            .attr("y1", 0)
            .attr("x2", x(currentDate))
            .attr("y2", height)
            .attr("stroke", "lightgray")
            .attr("stroke-width", 1);
          xAxisGroup
            .append("text")
            .attr("x", x(currentDate))
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-family", "Segoe UI, sans-serif")
            .style("font-size", "18px")
            .style("fill", "black")
            .text(d3.timeFormat("%d")(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else if (timeFrameInDays < 367) {
        const currentDate = new Date(minDate);
        currentDate.setDate(1);
        while (currentDate <= maxDate) {
          xAxisGroup
            .append("line")
            .attr("x1", x(currentDate))
            .attr("y1", 0)
            .attr("x2", x(currentDate))
            .attr("y2", height)
            .attr("stroke", "lightgray")
            .attr("stroke-width", 1);
          xAxisGroup
            .append("text")
            .attr("x", x(currentDate))
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-family", "Segoe UI, sans-serif")
            .style("font-size", "18px")
            .style("fill", "black")
            .text(d3.timeFormat("%b")(currentDate));
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
      } else {
        const currentDate = new Date(minDate);
        currentDate.setMonth(0, 1);
        while (currentDate <= maxDate) {
          xAxisGroup
            .append("line")
            .attr("x1", x(currentDate))
            .attr("y1", 0)
            .attr("x2", x(currentDate))
            .attr("y2", height)
            .attr("stroke", "lightgray")
            .attr("stroke-width", 1);
          xAxisGroup
            .append("text")
            .attr("x", x(currentDate))
            .attr("y", -10)
            .attr("text-anchor", "middle")
            .style("font-family", "Segoe UI, sans-serif")
            .style("font-size", "18px")
            .style("fill", "black")
            .text(String(astronomicalYearToHistorical(currentDate.getFullYear())));
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
      }

      function transitToDate(transit) {
        const { year, month, day, hour, minute, second } = transit.date;
        return makeHistoricalDate(year, month - 1, day, hour || 0, minute || 0, second || 0);
      }

      function splitTransitIntervals(transits) {
        const sorted = [...(transits || [])].sort((a, b) => transitToDate(a) - transitToDate(b));
        if (!sorted.length) return [];
        const gaps = [];
        for (let idx = 1; idx < sorted.length; idx++) {
          gaps.push((transitToDate(sorted[idx]) - transitToDate(sorted[idx - 1])) / (1000 * 60 * 60 * 24));
        }
        const typicalGap = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : (sorted[0].sampleStepDays || 1);
        const maxGap = Math.max(2.2, (Number(typicalGap) || 1) * 1.65);
        const intervals = [];
        let current = [sorted[0]];
        for (let idx = 1; idx < sorted.length; idx++) {
          const prevDate = transitToDate(sorted[idx - 1]);
          const thisDate = transitToDate(sorted[idx]);
          const gapDays = (thisDate - prevDate) / (1000 * 60 * 60 * 24);
          if (gapDays > maxGap) {
            intervals.push(current);
            current = [sorted[idx]];
          } else {
            current.push(sorted[idx]);
          }
        }
        intervals.push(current);
        return intervals;
      }

      // Plot aspect labels and transit lines
      groupedAspectsArray.forEach(([aspectText, aspects], i) => {
        const tokens = aspects[0].tokens;
        const aspectGroup = svg
          .append("g")
          .attr(
            "transform",
            `translate(${-margin.left + 10}, ${y(i) + y.bandwidth() / 2})`
          )
          .style("cursor", "pointer")
          .on("click", function (event) {
            event.stopPropagation();

            // Check if this is a house placement entry
            // House placement format: "Tr Saturn House 10" or "Pr Moon House 5"
            const houseMatch = aspectText.match(
              /(Tr|Pr)\s+(\w+(?:\s+\w+)?)\s+House\s+(\d+)/i
            );

            // Check if this is a station entry
            // Station format: "Tr Mercury Station" or "Pr Mars Station"
            const stationMatch = aspectText.match(
              /(Tr|Pr)\s+(\w+(?:\s+\w+)?)\s+Station/i
            );

            if (houseMatch) {
              // This is a house placement
              const chartTypePrefix = houseMatch[1].toLowerCase();
              const planetName = houseMatch[2];
              const houseNumber = houseMatch[3];
              const chartType =
                chartTypePrefix === "pr" ? "progressed" : "transit";
              showHouseDetails(planetName, houseNumber, chartType);
            } else if (stationMatch) {
              // This is a station
              const chartTypePrefix = stationMatch[1].toLowerCase();
              const planetName = stationMatch[2];
              const chartType =
                chartTypePrefix === "pr" ? "progressed" : "transit";
              showStationDetails(planetName, chartType);
            } else {
              // This is an aspect
              const firstAspect = aspects[0].aspect;
              const planet1 =
                firstAspect.transitingPlanet || firstAspect.progressedPlanet;
              let planet2 = "";
              if (
                firstAspect.type !== "Ingress" &&
                firstAspect.type !== "Direct" &&
                firstAspect.type !== "Retrograde"
              ) {
                planet2 =
                  firstAspect.natalPlanet ||
                  firstAspect.transitingPlanet2 ||
                  firstAspect.progressedPlanet2 ||
                  "";
              }
              const aspectType = firstAspect.type.toLowerCase();

              // Only show popup for actual aspects (not stations or ingresses)
              if (
                planet2 &&
                aspectType !== "direct" &&
                aspectType !== "retrograde" &&
                aspectType !== "ingress"
              ) {
                // Use first transit for orb info
                const firstTransit = firstAspect.transits[0];
                const orb = firstTransit.orb || "0";
                showAspectDetails(
                  planet1,
                  planet2,
                  aspectType,
                  orb,
                  "applying"
                );
              }
            }
          });
        let currentX = 0;
        const symbolSize = 28;
        const signSymbolSize = 22; // Signs are smaller than planets (matches tooltip ratio)
        const symbolSpacing = 0;
        const textSpacing = 5;
        tokens.forEach((token) => {
          // First, check if the full token matches a planet, aspect, or sign symbol.
          if (planetSymbols[token]) {
            aspectGroup
              .append("image")
              .attr("xlink:href", planetSymbols[token])
              .attr("x", currentX)
              .attr("y", -symbolSize / 2)
              .attr("width", symbolSize)
              .attr("height", symbolSize);
            currentX += symbolSize + symbolSpacing;
          } else if (aspectSymbols[token]) {
            aspectGroup
              .append("image")
              .attr("xlink:href", aspectSymbols[token])
              .attr("x", currentX)
              .attr("y", -symbolSize / 2)
              .attr("width", symbolSize)
              .attr("height", symbolSize);
            currentX += symbolSize + symbolSpacing;
          } else if (signSymbols[token]) {
            aspectGroup
              .append("image")
              .attr("xlink:href", signSymbols[token])
              .attr("x", currentX)
              .attr("y", -signSymbolSize / 2)
              .attr("width", signSymbolSize)
              .attr("height", signSymbolSize);
            currentX += signSymbolSize + symbolSpacing;
          } else {
            // If the full token doesn't match, then split it into subTokens.
            const subTokens = token.split(" ");
            subTokens.forEach((subToken) => {
              if (planetSymbols[subToken]) {
                aspectGroup
                  .append("image")
                  .attr("xlink:href", planetSymbols[subToken])
                  .attr("x", currentX)
                  .attr("y", -symbolSize / 2)
                  .attr("width", symbolSize)
                  .attr("height", symbolSize);
                currentX += symbolSize + symbolSpacing;
              } else if (aspectSymbols[subToken]) {
                aspectGroup
                  .append("image")
                  .attr("xlink:href", aspectSymbols[subToken])
                  .attr("x", currentX)
                  .attr("y", -symbolSize / 2)
                  .attr("width", symbolSize)
                  .attr("height", symbolSize);
                currentX += symbolSize + symbolSpacing;
              } else if (signSymbols[subToken]) {
                aspectGroup
                  .append("image")
                  .attr("xlink:href", signSymbols[subToken])
                  .attr("x", currentX)
                  .attr("y", -signSymbolSize / 2)
                  .attr("width", signSymbolSize)
                  .attr("height", signSymbolSize);
                currentX += signSymbolSize + symbolSpacing;
              } else {
                let fontSize = "18px";
                if (
                  token.includes("Na") ||
                  token.includes("Tr") ||
                  token.includes("Pr")
                ) {
                  fontSize = "16px";
                }
                const textElement = aspectGroup
                  .append("text")
                  .attr("x", currentX)
                  .attr("y", 0)
                  .attr("dy", ".35em")
                  .attr("text-anchor", "start")
                  .text(subToken)
                  .style("font-family", "Segoe UI, sans-serif")
                  .style("font-size", fontSize)
                  .style("font-weight", "bold")
                  .style("fill", "#555");
                const textWidth = textElement.node().getComputedTextLength();
                currentX += textWidth + textSpacing;
              }
            });
          }
        });
        svg
          .append("line")
          .attr("x1", -margin.left + 10)
          .attr("y1", y(i) + y.bandwidth())
          .attr("x2", width - margin.right)
          .attr("y2", y(i) + y.bandwidth())
          .attr("stroke", "lightgray")
          .attr("stroke-width", 1);
        aspects.forEach(({ aspect }) => {
          let color = "blue";
          if (aspect.type === "Ingress") {
            const planet = (
              aspect.transitingPlanet || aspect.progressedPlanet
            ).toLowerCase();
            color = planetColors[planet] || "gray";
          } else if (aspect.type === "Direct" || aspect.type === "Retrograde") {
            color = stationColors[aspect.type.toLowerCase()] || "green";
          } else {
            color = aspectColors[aspect.type] || "blue";
          }

          const rowCenter = y(i) + y.bandwidth() / 2;
          const intervals = splitTransitIntervals(aspect.transits);

          intervals.forEach((interval) => {
            const firstTransit = interval[0];
            const lastTransit = interval[interval.length - 1];
            const firstDate = transitToDate(firstTransit);
            const lastDate = transitToDate(lastTransit);
            const exactTransit = interval.reduce((best, t) => {
              const bestOrb = Number.isFinite(Number(best.orb)) ? Math.abs(Number(best.orb)) : Infinity;
              const thisOrb = Number.isFinite(Number(t.orb)) ? Math.abs(Number(t.orb)) : Infinity;
              return thisOrb < bestOrb ? t : best;
            }, firstTransit);
            const exactDate = transitToDate(exactTransit);

            const x1 = Math.max(0, x(firstDate));
            const x2 = Math.min(width - margin.right, x(lastDate));

            if (x2 > x1 + 2) {
              svg
                .append("line")
                .attr("x1", x1)
                .attr("y1", rowCenter)
                .attr("x2", x2)
                .attr("y2", rowCenter)
                .attr("stroke", color)
                .attr("stroke-width", 4);
            }

            if (aspect.type !== "Ingress") {
              const aspectIcon = aspectSymbols[aspect.type];
              const aspectSymbolX = Math.max(0, Math.min(width - margin.right, (x1 + x2) / 2));
              const iconSize = 22;
              // The aspect glyph must sit visibly in the exact middle of the aspect line,
              // matching the original True Sky graph style. A tiny white backing keeps
              // the SVG readable on top of red/blue/green/orange lines.
              svg
                .append("circle")
                .attr("cx", aspectSymbolX)
                .attr("cy", rowCenter)
                .attr("r", 10)
                .attr("fill", "white")
                .attr("opacity", 0.9)
                .style("pointer-events", "none");
              if (aspectIcon) {
                svg
                  .append("image")
                  .attr("href", aspectIcon)
                  .attr("xlink:href", aspectIcon)
                  .attr("x", aspectSymbolX - iconSize / 2)
                  .attr("y", rowCenter - iconSize / 2)
                  .attr("width", iconSize)
                  .attr("height", iconSize)
                  .style("pointer-events", "none");
              } else {
                svg
                  .append("text")
                  .attr("x", aspectSymbolX)
                  .attr("y", rowCenter)
                  .attr("dy", ".35em")
                  .attr("text-anchor", "middle")
                  .style("font-family", "Segoe UI, sans-serif")
                  .style("font-size", "18px")
                  .style("font-weight", "bold")
                  .text("✶")
                  .style("fill", color);
              }
            }

            const labelDate = interval.length > 1 ? firstDate : exactDate;
            svg
              .append("text")
              .attr("x", x(labelDate))
              .attr("y", rowCenter + 10)
              .attr("dy", ".35em")
              .attr("text-anchor", "middle")
              .style("font-family", "Segoe UI, sans-serif")
              .style("font-size", "13px")
              .style("font-weight", "bold")
              .style("fill", "#444")
              .text(
                timeFrameInDays < 32
                  ? d3.timeFormat("%H:%M")(labelDate)
                  : d3.timeFormat("%d%b")(labelDate)
              );

            if (interval.length > 1 && Math.abs(x(lastDate) - x(firstDate)) > 70) {
              svg
                .append("text")
                .attr("x", x(lastDate))
                .attr("y", rowCenter + 10)
                .attr("dy", ".35em")
                .attr("text-anchor", "middle")
                .style("font-family", "Segoe UI, sans-serif")
                .style("font-size", "13px")
                .style("font-weight", "bold")
                .style("fill", "#444")
                .text(
                  timeFrameInDays < 32
                    ? d3.timeFormat("%H:%M")(lastDate)
                    : d3.timeFormat("%d%b")(lastDate)
                );
            }
          });
        });
      });

      // Drag & Interaction
      // Create overlay to capture mouse events (its native contextmenu is already prevented globally)
      const overlay = svg
        .append("rect")
        .attr("class", "overlay")
        .attr("width", width - margin.right)
        .attr("height", height)
        .style("fill", "none")
        .style("pointer-events", "all");

      let isDragging = false;
      let isRightDrag = false;

      overlay.on("mousedown", (event) => {
        if (event.button === 0) {
          isRightDrag = true; // Reusing this variable for left-click behavior
        }
        isDragging = true;
        showRedLine(event);
      });

      overlay.on("mousemove", (event) => {
        if (isDragging) {
          showRedLine(event);
        }
      });

      d3.select(window).on("mouseup", (event) => {
        if (isDragging) {
          isDragging = false;
          if (isRightDrag && event.button === 0) {
            showTooltip(event);
          }
          if (isRightDrag) {
            isRightDrag = false;
          }
        }
      });

      // Touch Events for Mobile/Tablet
      let touchStartPos = null;
      let touchMoved = false;
      let lastTouchPos = null; // Track last touch position for touchend
      const moveThreshold = 10; // pixels

      overlay.on("touchstart", (event) => {
        const touch = event.touches[0];
        touchStartPos = [touch.clientX, touch.clientY];
        lastTouchPos = [touch.clientX, touch.clientY]; // Save initial position
        touchMoved = false;
        showRedLine(event);
      });

      overlay.on("touchmove", (event) => {
        const touch = event.touches[0];
        lastTouchPos = [touch.clientX, touch.clientY]; // Update last position
        if (touchStartPos) {
          const dx = touch.clientX - touchStartPos[0];
          const dy = touch.clientY - touchStartPos[1];
          if (Math.sqrt(dx * dx + dy * dy) > moveThreshold) {
            touchMoved = true;
          }
        }
        showRedLine(event);
      });

      overlay.on("touchend", (event) => {
        if (!touchMoved && touchStartPos && lastTouchPos) {
          // Simple tap - show tooltip with saved position
          // Pass the last touch position to calculate the date correctly
          showTooltipWithPosition(lastTouchPos[0], lastTouchPos[1]);
        }
        touchStartPos = null;
        touchMoved = false;
        lastTouchPos = null;
      });

      // Show red date line and date label
      function showRedLine(event) {
        // For both mouse and touch events, use d3.pointer on the inner group.
        let [mouseX] = d3.pointer(
          event.touches && event.touches.length ? event.touches[0] : event,
          svg.node()
        );
        const date = x.invert(mouseX);
        if (verticalLine) verticalLine.remove();
        if (verticalText) {
          const dateElement = document.getElementById("fixedDateText");
          if (dateElement && dateElement._stickyListener) {
            window.removeEventListener("scroll", dateElement._stickyListener);
          }
          d3.select("#fixedDateText").remove();
        }
        verticalLine = svg
          .append("line")
          .attr("class", "red-line")
          .attr("x1", x(date))
          .attr("x2", x(date))
          .attr("y1", 0)
          .attr("y2", height)
          .attr("stroke", "red")
          .attr("stroke-width", 1);

        // For the label, use event.clientX (or the first touch's clientX)
        let clientX = event.clientX;
        if (event.touches && event.touches.length) {
          clientX = event.touches[0].clientX;
        }
        // Get the graph container's bounding box if needed
        const graphRect = document
          .getElementById("graph")
          .getBoundingClientRect();

        verticalText = d3
          .select("#graph")
          .append("div")
          .attr("id", "fixedDateText")
          .style("position", "absolute")
          .style("top", "0px") // always at the top of the #graph container
          .style("left", `${clientX}px`)
          .style("transform", "translateX(-50%)")
          .style("background", "rgba(255, 255, 255, 0.8)")
          .style("padding", "5px 10px")
          .style("border", "1px solid red")
          .style("border-radius", "4px")
          .style("font-family", "Segoe UI, sans-serif")
          .style("font-size", "16px")
          .style("color", "red")
          .style("font-weight", "bold")
          .style("z-index", "5")
          .style("white-space", "nowrap") // Prevent text wrapping
          .text(d3.timeFormat("%d %b %Y")(date));

        // Add scroll listener to make date sticky when scrolling past graph top
        const dateElement = document.getElementById("fixedDateText");
        const makeSticky = () => {
          const graphRect = document
            .getElementById("graph")
            .getBoundingClientRect();
          if (graphRect.top < 0) {
            // Graph top is above viewport, make date sticky
            dateElement.style.position = "fixed";
            dateElement.style.top = "0px";
          } else {
            // Graph top is visible, keep date at graph top
            dateElement.style.position = "absolute";
            dateElement.style.top = "0px";
          }
        };

        // Attach scroll listener and run once to set initial state
        window.addEventListener("scroll", makeSticky);
        makeSticky();

        // Store listener reference to remove it when line is removed
        dateElement._stickyListener = makeSticky;
      }

      // Show tooltip with specific client coordinates (for touch events)
      function showTooltipWithPosition(clientX, clientY) {
        const tooltip = d3.select(".tooltip");
        tooltip.html(
          '<div id="triwheel-loading-overlay"><div class="triwheel-spinner"></div></div>'
        );

        // Convert client coordinates to SVG coordinates
        const svgElement = d3.select("#graph svg").node();
        const pt = svgElement.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;

        // Transform to SVG coordinate space
        const svgP = pt.matrixTransform(svgElement.getScreenCTM().inverse());

        // Account for the group transform (margin.left offset)
        const mouseX = svgP.x - margin.left;
        const date = x.invert(mouseX);

        // Continue with the rest of the tooltip logic
        showTooltipForDate(date);
      }

      // Show tooltip (for right click or long press)
      function showTooltip(event) {
        const tooltip = d3.select(".tooltip");
        tooltip.html(
          '<div id="triwheel-loading-overlay"><div class="triwheel-spinner"></div></div>'
        );

        // For regular mouse events, use d3.pointer
        const [mouseX] = d3.pointer(event, svg.node());
        const date = x.invert(mouseX);

        // Continue with the rest of the tooltip logic
        showTooltipForDate(date);
      }

      // Common tooltip logic for a specific date
      function showTooltipForDate(date) {
        const triwheelDay = document.getElementById("triwheelDayGraph");
        const triwheelMonth = document.getElementById("triwheelMonthGraph");
        const triwheelYear = document.getElementById("triwheelYearGraph");
        const triwheelHour = document.getElementById("triwheelHourGraph");
        const triwheelMinute = document.getElementById("triwheelMinuteGraph");
        if (
          triwheelDay &&
          triwheelMonth &&
          triwheelYear &&
          triwheelHour &&
          triwheelMinute
        ) {
          triwheelDay.value = date.getDate().toString().padStart(2, "0");
          triwheelMonth.value = d3.timeFormat("%B")(date);
          triwheelYear.value = astronomicalYearToHistorical(date.getFullYear());
          triwheelHour.value = date.getHours().toString().padStart(2, "0");
          triwheelMinute.value = date.getMinutes().toString().padStart(2, "0");
          const triwheelLocation = document.getElementById(
            "triwheelLocationGraph"
          );
          const graphLocation = document.getElementById("graphLocation");
          if (triwheelLocation && graphLocation) {
            triwheelLocation.value = graphLocation.value;
          }
          const triwheelForm = document.getElementById("triwheelFormGraph");
          if (triwheelForm) {
            triwheelForm.dataset.autoSubmit = "true";
            submitFormSafely(triwheelForm);
          }
        }

        const tooltip = d3.select(".tooltip");

        // Display tooltip content when triwheel rendering is complete
        const displayTooltipContent = () => {
          tooltip.html("");

          // Get viewport width for close button sizing
          const viewportWidth = window.innerWidth;

          // Add close button to tooltip (not inside content, so it won't scale)
          const closeButton = tooltip
            .append("div")
            .attr("class", "tooltip-close-btn")
            .style("position", "absolute")
            .style("top", "10px")
            .style("right", "15px")
            .style("cursor", "pointer")
            .style("pointer-events", "auto")
            .style("font-family", "Arial, sans-serif")
            .style("font-size", "40px")
            .style("font-weight", "bold")
            .style("color", "#666")
            .style("z-index", "11")
            .text("×")
            .on("click", () => {
              tooltip.style("opacity", 0);
            });

          const tooltipContent = tooltip
            .append("div")
            .attr("class", "tooltip-content");
          const triwheelSVG = document.querySelector("#triwheel-graph svg");
          let clonedTriwheel = null;
          if (triwheelSVG) {
            clonedTriwheel = triwheelSVG.cloneNode(true);
            clonedTriwheel.setAttribute("width", "600px");
            clonedTriwheel.setAttribute("height", "600px");
          }
          if (clonedTriwheel) {
            tooltipContent.node().appendChild(clonedTriwheel);
          }

          // Responsive scaling
          let scale = 1;
          const viewportHeight = window.innerHeight;
          // viewportWidth already defined above

          // Width-based scaling (matching existing CSS)
          if (viewportWidth <= 600) {
            scale = 0.45; // Matches CSS @media (max-width: 600px)
          } else if (viewportWidth <= 800) {
            scale = 0.75; // Matches CSS @media (max-width: 800px)
          }

          // Additional landscape mobile check (height-based)
          if (viewportHeight < 500 && viewportWidth > viewportHeight) {
            scale = Math.min(scale, 0.5); // Use smaller of the two scales
          } else if (viewportHeight < 700 && viewportWidth > viewportHeight) {
            scale = Math.min(scale, 0.7); // Use smaller of the two scales
          }

          // Apply scale to the tooltip content
          if (scale < 1) {
            tooltipContent.style("zoom", scale);
          }

          // Center the tooltip
          tooltip
            .style("position", "fixed")
            .style("top", "50%")
            .style("left", "50%")
            .style("transform", "translate(-50%, -50%)")
            .style("opacity", 0.95);
        };

        // Wait for triwheel rendering to complete before displaying
        let hasDisplayed = false;
        const onTriwheelComplete = () => {
          if (!hasDisplayed) {
            hasDisplayed = true;
            clearTimeout(fallbackTimeout);
            document.removeEventListener(
              "triwheelGraphComplete",
              onTriwheelComplete
            );
            displayTooltipContent();
          }
        };

        // Listen for the completion event
        document.addEventListener("triwheelGraphComplete", onTriwheelComplete);

        // Fallback timeout (8 seconds) in case event never fires
        const fallbackTimeout = setTimeout(() => {
          if (!hasDisplayed) {
            hasDisplayed = true;
            document.removeEventListener(
              "triwheelGraphComplete",
              onTriwheelComplete
            );
            displayTooltipContent();
          }
        }, 8000);
      }

      // Adjust chart on window resize
      window.addEventListener("resize", () => {
        const newWidth = aspectContainer.offsetWidth;
        const newHeight = groupedAspectsArray.length * 40;
        d3.select("#graph svg").attr(
          "viewBox",
          `0 0 ${newWidth + margin.left + margin.right} ${
            newHeight + margin.top + margin.bottom
          }`
        );
        x.range([0, newWidth - margin.right]);
      });

      document.dispatchEvent(new CustomEvent("graph:rendered", { detail: { empty: false } }));
    })
    .catch((error) => {
      console.error('graph render error:', error);
      document.getElementById("loading-overlay").style.display = "none";
      window._graphNeedsOverlay = false;
      const errorContainer = document.querySelector(".errorMessageGraph");
      const graphErrorMessage =
        error?.message || (typeof error === "string" ? error : String(error)) ||
        "Unexpected error. Please check your connection.";
      document.dispatchEvent(new CustomEvent("graph:error", { detail: { message: graphErrorMessage } }));
      if (errorContainer) {
        errorContainer.textContent =
          graphErrorMessage;
        // Clear error after 5 seconds
        setTimeout(() => {
          errorContainer.textContent = "";
        }, 5000);
      }
    });
});


function submitGraphWhenVisible() {
  // Auto-calculation disabled: the Graph must stay empty until Calculate is clicked.
  hideGraphUntilManualCalculate();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("graph-button")?.addEventListener("click", () => {
    setTimeout(submitGraphWhenVisible, 100);
  });
  document.addEventListener("graph:shown", () => {
    setTimeout(submitGraphWhenVisible, 100);
  });
  document.getElementById("graphCalculate")?.addEventListener("click", (event) => {
    ensureGraphDefaultFields();
    const form = document.getElementById("graphForm");
    if (form) {
      event.preventDefault();
      calculateGraphNow({ force: true }).catch((error) => setGraphStatus(error?.message || String(error)));
    }
  });
});

// Hidden triwheel for drag rendering
document.addEventListener("DOMContentLoaded", function () {
  const svgContainer = d3.select("#triwheel-graph");
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
    "triwheelGraph"
  );
  d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("position", "fixed")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("background", "rgba(255, 255, 255, 0.95)")
    .style("border", "1px solid #ccc")
    .style("padding", "20px")
    .style("border-radius", "8px")
    .style("box-shadow", "0px 0px 15px rgba(0,0,0,0.2)")
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "center")
    .style("justify-content", "center")
    .style("z-index", 10)
    .style("transform", "translate(-50%, -50%)")
    .style("top", "50%")
    .style("left", "50%");
});


function writeGraphPreviewWindow(previewWindow) {
  const graphElement = document.getElementById("graph");
  const svg = graphElement?.querySelector("svg");
  if (!previewWindow || !graphElement || !svg) return false;
  const graphClone = graphElement.cloneNode(true);
  const title = window.graphFormData?.natalData?.name ? `Graph - ${window.graphFormData.natalData.name}` : "Graph";
  previewWindow.document.open();
  previewWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>body{margin:0;padding:24px;font-family:Segoe UI,Arial,sans-serif;background:white;color:#111;}#wrap{width:100%;overflow:auto;}svg{max-width:none;}button{position:fixed;right:24px;top:16px;z-index:2;padding:8px 14px;border:1px solid #ccc;border-radius:6px;background:#f8f8f8;cursor:pointer;}</style></head><body><button onclick="window.print()">Print</button><div id="wrap">${graphClone.innerHTML}</div></body></html>`);
  previewWindow.document.close();
  previewWindow.focus();
  return true;
}

function openGraphPreviewWindow() {
  const graphElement = document.getElementById("graph");
  const svg = graphElement?.querySelector("svg");
  if (!graphElement || !svg) return false;
  const graphClone = graphElement.cloneNode(true);
  const title = window.graphFormData?.natalData?.name ? `Graph - ${window.graphFormData.natalData.name}` : "Graph";
  const previewWindow = window.open("", "GraphView", "width=1200,height=900,scrollbars=yes,resizable=yes");
  if (!previewWindow) return false;
  previewWindow.document.open();
  previewWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>body{margin:0;padding:24px;font-family:Segoe UI,Arial,sans-serif;background:white;color:#111;}#wrap{width:100%;overflow:auto;}svg{max-width:none;}button{position:fixed;right:24px;top:16px;z-index:2;padding:8px 14px;border:1px solid #ccc;border-radius:6px;background:#f8f8f8;cursor:pointer;}</style></head><body><button onclick="window.print()">Print</button><div id="wrap">${graphClone.innerHTML}</div></body></html>`);
  previewWindow.document.close();
  previewWindow.focus();
  return true;
}

// Print graph
document.getElementById("graphPrint").addEventListener("click", async function () {
  const previewWindow = window.open("", "GraphView", "width=1200,height=900,scrollbars=yes,resizable=yes");
  if (previewWindow) {
    previewWindow.document.write("<html><body style='font-family:Segoe UI,Arial,sans-serif;padding:24px'>Calculating graph...</body></html>");
  }
  try {
    await calculateGraphNow({ force: !graphHasRenderedSvg() });
  } catch (error) {
    if (previewWindow) previewWindow.close();
    setGraphStatus(error?.message || String(error));
    return;
  }
  if (!graphHasRenderedSvg()) {
    if (previewWindow) previewWindow.close();
    setGraphStatus("Graph has no visible results to view.");
    return;
  }
  if (previewWindow && writeGraphPreviewWindow(previewWindow)) return;
  if (openGraphPreviewWindow()) return;
  const graphElement = document.getElementById("graph");
  if (graphElement) {
    const y = graphElement.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo(0, y);
  }
  window.print();
});

// Graph report
document.getElementById("graphReport")?.addEventListener("click", async function () {
  const reportWindow = window.open("", "PrintChart", "width=1000,height=1200,scrollbars=yes,resizable=yes");
  if (reportWindow) {
    reportWindow.document.write("<html><body style='font-family:Segoe UI,Arial,sans-serif;padding:24px'>Calculating graph report...</body></html>");
  }
  try {
    await calculateGraphNow({ force: !graphHasRenderedSvg() });
  } catch (error) {
    if (reportWindow) reportWindow.close();
    setGraphStatus(error?.message || String(error));
    return;
  }
  if (!window.graphGroupedAspects || window.graphGroupedAspects.length === 0) {
    if (reportWindow) reportWindow.close();
    setGraphStatus("Graph has no visible results for the report.");
    return;
  }
  if (typeof window.generateGraphReport === "function") {
    window.generateGraphReport(reportWindow);
  } else {
    if (reportWindow) reportWindow.close();
    setGraphStatus("Graph report generator was not loaded.");
  }
});

// Fix zoom bug on mobile by forcing viewport recalculation after any print
if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
  window.addEventListener("afterprint", function () {
    const graphElement = document.getElementById("graph");
    if (graphElement) {
      // Force viewport recalculation by temporarily changing zoom
      const originalZoom = document.body.style.zoom || "1";
      document.body.style.zoom = "0.99";

      setTimeout(() => {
        document.body.style.zoom = originalZoom;
        // Also dispatch resize for good measure
        window.dispatchEvent(new Event("resize"));
      }, 10);
    }
  });
}


// CAIO GRAPH REAL-VISIBLE OVERRIDE 2026-05-31
// This keeps the calculation real (Swiss batch via calculateGraphLocally) and
// uses a compact renderer so the calculation result always becomes visible.
let caioGraphRunToken = 0;

function caioGraphCollectCombinedData(natalData) {
  ensureGraphDefaultFields();
  const form = document.getElementById("graphForm");
  const formDataObj = form ? Object.fromEntries(new FormData(form)) : {};
  graphNormalizeAllCalendarFields(formDataObj);
  const system = readSystemSettingsForGraph();
  return {
    ...formDataObj,
    natalData,
    selectedPlanetsNatal: selectedValues('#graph-planet-settings input[name="planetNatal"]:checked'),
    selectedPlanetsProgressed: selectedValues('#graph-planet-settings input[name="planetProgressed"]:checked'),
    selectedPlanetsTransit: selectedValues('#graph-planet-settings input[name="planetTransit"]:checked'),
    selectedTransitingAspects: selectedValues('#graph-aspect-settings input[name="transitingAspects"]:checked'),
    selectedTransitingTypes: selectedValues('#graph-type-settings input[name="transitingTypes"]:checked'),
    ...system,
  };
}

function caioGraphDateFromTransit(transit) {
  const d = transit?.date || {};
  return makeHistoricalDate(
    d.year,
    Number(d.month || 1) - 1,
    Number(d.day || 1),
    Number(d.hour || 0),
    Number(d.minute || 0),
    Number(d.second || 0)
  );
}

function caioGraphSafeDate(value, fallback) {
  return Number.isFinite(value?.getTime?.()) ? value : fallback;
}

function caioGraphSplitIntervals(transits) {
  const sorted = (transits || [])
    .map((t) => ({ ...t, _dateObj: caioGraphDateFromTransit(t) }))
    .filter((t) => Number.isFinite(t._dateObj.getTime()))
    .sort((a, b) => a._dateObj - b._dateObj);
  if (!sorted.length) return [];
  const dayMs = 24 * 60 * 60 * 1000;
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push((sorted[i]._dateObj - sorted[i - 1]._dateObj) / dayMs);
  const sortedGaps = gaps.filter((g) => Number.isFinite(g) && g > 0).sort((a, b) => a - b);
  const medianGap = sortedGaps.length ? sortedGaps[Math.floor(sortedGaps.length / 2)] : (sorted[0].sampleStepDays || 1);
  const maxGap = Math.max(2.2, Number(sorted[0].sampleStepDays || medianGap || 1) * 1.65, medianGap * 1.65);
  const intervals = [];
  let current = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i]._dateObj - sorted[i - 1]._dateObj) / dayMs;
    if (gap > maxGap) {
      intervals.push(current);
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }
  intervals.push(current);
  return intervals;
}

function caioGraphAddSvgImage(parent, href, x, y, size, fallbackText, color = "#111") {
  if (href) {
    const backing = parent.append("circle")
      .attr("cx", x)
      .attr("cy", y)
      .attr("r", Math.max(10, size / 2 + 3))
      .attr("fill", "white")
      .attr("stroke", "rgba(0,0,0,0.12)")
      .attr("stroke-width", 0.8);
    const img = parent.append("image")
      .attr("href", href)
      .attr("xlink:href", href)
      .attr("x", x - size / 2)
      .attr("y", y - size / 2)
      .attr("width", size)
      .attr("height", size);
    return img;
  }
  return parent.append("text")
    .attr("x", x)
    .attr("y", y + 1)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-family", "Segoe UI Symbol, Arial, sans-serif")
    .attr("font-size", size)
    .attr("font-weight", 700)
    .attr("fill", color)
    .text(fallbackText || "*");
}

function caioGraphDrawPlanetToken(parent, name, x, y, prefix) {
  const group = parent.append("g").attr("transform", `translate(${x},${y})`);
  group.append("text")
    .attr("x", 0)
    .attr("y", 5)
    .attr("font-family", "Segoe UI, Arial, sans-serif")
    .attr("font-size", 12)
    .attr("font-weight", 700)
    .attr("fill", "#555")
    .text(prefix || "");
  const iconX = prefix ? 30 : 16;
  caioGraphAddSvgImage(group, planetSymbols[name], iconX, 0, 18, String(name || "?").slice(0, 1));
  group.append("text")
    .attr("x", iconX + 14)
    .attr("y", 5)
    .attr("font-family", "Segoe UI, Arial, sans-serif")
    .attr("font-size", 12)
    .attr("fill", "#222")
    .text(String(name || ""));
  return x + iconX + 14 + Math.min(82, String(name || "").length * 6.5);
}

function caioGraphRenderVisible(data, combinedData) {
  const graph = document.getElementById("graph");
  if (!graph) return;
  window.graphHasBeenManuallyCalculated = true;
  graph.innerHTML = "";
  graph.style.display = "block";
  graph.style.visibility = "visible";
  graph.style.overflowX = "auto";

  const stats = window.graphLastCalculationStats || {};
  const summary = document.createElement("div");
  summary.className = "graph-calculation-summary";
  summary.style.cssText = "font-family:Segoe UI,Arial,sans-serif;font-size:13px;font-weight:700;color:#333;padding:8px 12px 6px 12px;background:#fff;";
  summary.textContent = `Calculation visible: ${stats.samples || 0} Swiss samples, step ${stats.sampleStepDays || 1} day(s), ${Array.isArray(data) ? data.length : 0} aspect row(s).`;
  graph.appendChild(summary);

  if (!Array.isArray(data) || !data.length) {
    const empty = document.createElement("div");
    empty.className = "graph-empty";
    empty.style.cssText = "padding:24px;text-align:center;font-family:Segoe UI,Arial,sans-serif;";
    empty.textContent = "No graph aspects found for the selected planets, aspects and date range.";
    graph.appendChild(empty);
    window.graphGroupedAspects = [];
    document.dispatchEvent(new CustomEvent("graph:rendered", { detail: { empty: true, renderer: "caio-real-visible" } }));
    return;
  }

  const monthNames = TRUE_SKY_GRAPH_MONTHS;
  const minDate = makeHistoricalDate(
    parseHistoricalYear(combinedData.startYear),
    monthNames.indexOf(combinedData.startMonth),
    parseInt(combinedData.startDay, 10),
    parseInt(combinedData.startHour, 10) || 0,
    parseInt(combinedData.startMinute, 10) || 0
  );
  const maxDate = makeHistoricalDate(
    parseHistoricalYear(combinedData.endYear),
    monthNames.indexOf(combinedData.endMonth),
    parseInt(combinedData.endDay, 10),
    parseInt(combinedData.endHour, 10) || 0,
    parseInt(combinedData.endMinute, 10) || 0
  );
  const safeMin = caioGraphSafeDate(minDate, new Date());
  const safeMax = caioGraphSafeDate(maxDate, new Date(safeMin.getTime() + 30 * 86400000));
  const domainMs = Math.max(1, safeMax - safeMin);
  const labelW = 245;
  const rightPad = 35;
  const rowH = 34;
  const top = 54;
  const width = Math.max(960, graph.getBoundingClientRect().width || window.innerWidth || 960);
  const height = top + data.length * rowH + 24;
  const plotW = width - labelW - rightPad;
  const xForDate = (date) => labelW + Math.max(0, Math.min(1, (date - safeMin) / domainMs)) * plotW;

  const svg = d3.select(graph).append("svg")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height)
    .style("width", "100%")
    .style("height", `${height}px`)
    .style("background", "#fff")
    .style("display", "block");

  svg.append("text")
    .attr("x", labelW + plotW / 2)
    .attr("y", 24)
    .attr("text-anchor", "middle")
    .attr("font-family", "Segoe UI, Arial, sans-serif")
    .attr("font-size", 18)
    .attr("font-weight", 700)
    .text(safeMin.getFullYear() === safeMax.getFullYear() ? String(safeMin.getFullYear()) : `${safeMin.getFullYear()} - ${safeMax.getFullYear()}`);

  const ticks = Math.min(12, Math.max(2, Math.ceil(domainMs / (30 * 86400000)) + 1));
  for (let i = 0; i < ticks; i++) {
    const t = new Date(safeMin.getTime() + (domainMs * i) / (ticks - 1));
    const x = xForDate(t);
    svg.append("line")
      .attr("x1", x).attr("x2", x).attr("y1", top - 22).attr("y2", height - 12)
      .attr("stroke", "#e0e0e0").attr("stroke-width", 1);
    svg.append("text")
      .attr("x", x).attr("y", top - 28).attr("text-anchor", "middle")
      .attr("font-family", "Segoe UI, Arial, sans-serif").attr("font-size", 11).attr("fill", "#555")
      .text(`${String(t.getDate()).padStart(2, "0")} ${monthNames[t.getMonth()].slice(0, 3)}`);
  }

  data.forEach((row, index) => {
    const y = top + index * rowH + rowH / 2;
    svg.append("line")
      .attr("x1", 0).attr("x2", width).attr("y1", y + rowH / 2 - 1).attr("y2", y + rowH / 2 - 1)
      .attr("stroke", "#eeeeee").attr("stroke-width", 1);

    const moving = row.transitingPlanet || row.progressedPlanet || row.transitingPlanet2 || row.progressedPlanet2 || "Transit";
    const target = row.natalPlanet || row.transitingPlanet2 || row.progressedPlanet2 || "Natal";
    const movingPrefix = row.transitingPlanet ? "Tr" : row.progressedPlanet ? "Pr" : "";
    const targetPrefix = row.natalPlanet ? "Na" : row.transitingPlanet2 ? "Tr" : row.progressedPlanet2 ? "Pr" : "";
    let xLabel = 8;
    xLabel = caioGraphDrawPlanetToken(svg, moving, xLabel, y, movingPrefix);
    caioGraphAddSvgImage(svg, aspectSymbols[row.type], Math.min(166, xLabel + 18), y, 20, String(row.type || "").slice(0, 1), aspectColors[row.type] || "#111");
    caioGraphDrawPlanetToken(svg, target, 182, y, targetPrefix);

    const color = aspectColors[row.type] || "#333";
    const intervals = caioGraphSplitIntervals(row.transits);
    intervals.forEach((interval) => {
      if (!interval.length) return;
      let x1 = xForDate(interval[0]._dateObj);
      let x2 = xForDate(interval[interval.length - 1]._dateObj);
      if (Math.abs(x2 - x1) < 14) x2 = Math.min(labelW + plotW, x1 + 14);
      svg.append("line")
        .attr("x1", x1).attr("x2", x2).attr("y1", y).attr("y2", y)
        .attr("stroke", color).attr("stroke-width", 4).attr("stroke-linecap", "round");
      const mid = (x1 + x2) / 2;
      caioGraphAddSvgImage(svg, aspectSymbols[row.type], mid, y, 22, String(row.type || "").slice(0, 1), color);
      const strongest = interval.reduce((best, item) => !best || Number(item.orb) < Number(best.orb) ? item : best, null);
      if (strongest) {
        const d = strongest._dateObj;
        svg.append("text")
          .attr("x", mid).attr("y", y + 21).attr("text-anchor", "middle")
          .attr("font-family", "Segoe UI, Arial, sans-serif").attr("font-size", 10).attr("font-weight", 700).attr("fill", "#444")
          .text(`${String(d.getDate()).padStart(2, "0")}${monthNames[d.getMonth()].slice(0, 3)}`);
      }
    });
  });

  window.graphGroupedAspects = data.map((row) => {
    const movingPrefix = row.transitingPlanet ? "Tr" : row.progressedPlanet ? "Pr" : "";
    const targetPrefix = row.natalPlanet ? "Na" : row.transitingPlanet2 ? "Tr" : row.progressedPlanet2 ? "Pr" : "";
    const moving = row.transitingPlanet || row.progressedPlanet || "";
    const target = row.natalPlanet || row.transitingPlanet2 || row.progressedPlanet2 || "";
    return [`${movingPrefix} ${moving} ${row.type} ${targetPrefix} ${target}`.replace(/\s+/g, " ").trim(), row.transits.map((transit) => ({ aspect: row, transit }))];
  });
  document.dispatchEvent(new CustomEvent("graph:rendered", { detail: { empty: false, renderer: "caio-real-visible" } }));
}

async function caioRunVisibleGraph({ force = true } = {}) {
  const myToken = ++caioGraphRunToken;
  window.graphManualCalculateRequested = true;
  const graphSection = document.getElementById("showGraph");
  if (graphSection) graphSection.style.display = "block";
  showGraphOutputArea();
  setGraphStatus("Calculating graph...");
  document.getElementById("loading-overlay").style.display = "block";
  try {
    const natalData = await ensureNatalDataForGraph();
    if (myToken !== caioGraphRunToken) return false;
    const combinedData = caioGraphCollectCombinedData(natalData);
    window.graphFormData = combinedData;
    const data = await calculateGraphLocally(combinedData);
    if (myToken !== caioGraphRunToken) return false;
    document.getElementById("loading-overlay").style.display = "none";
    window._graphNeedsOverlay = false;
    setGraphStatus("");
    caioGraphRenderVisible(data, combinedData);
    window.graphManualCalculateRequested = false;
    return true;
  } catch (error) {
    window.graphManualCalculateRequested = false;
    document.getElementById("loading-overlay").style.display = "none";
    window._graphNeedsOverlay = false;
    const message = error?.message || String(error);
    setGraphStatus(message);
    document.dispatchEvent(new CustomEvent("graph:error", { detail: { message } }));
    console.error("caio visible graph error:", error);
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.graphHasBeenManuallyCalculated = false;
  window.graphManualCalculateRequested = false;
  hideGraphUntilManualCalculate();
  document.addEventListener("graph:shown", hideGraphUntilManualCalculate);

  const form = document.getElementById("graphForm");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    caioRunVisibleGraph({ force: true });
  }, true);
  document.getElementById("graphCalculate")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    caioRunVisibleGraph({ force: true });
  }, true);
});
