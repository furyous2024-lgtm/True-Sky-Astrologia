"use strict";

document.addEventListener("DOMContentLoaded", () => {

  function parseHistoricalYearInput(value) {
    const raw = String(value ?? "").trim();
    const match = raw.match(/-?\d+/);
    if (!match) return NaN;
    const isBce = raw.startsWith("-") || /\b(bc|bce|ac|a\.?c\.?)\b/i.test(raw);
    const n = Math.abs(parseInt(match[0], 10));
    return n === 0 ? NaN : (isBce ? -n : n);
  }

  function historicalToAstronomicalYear(year) {
    return year < 0 ? year + 1 : year;
  }

  function astronomicalToHistoricalYear(year) {
    return year <= 0 ? year - 1 : year;
  }

  function makeHistoricalLocalDate(year, monthIndexZeroBased, day, hour, minute) {
    const astronomicalYear = historicalToAstronomicalYear(year);
    const date = new Date(0, monthIndexZeroBased, day, hour, minute);
    date.setFullYear(astronomicalYear);
    return date;
  }
  const MONTH_NAMES = [
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

  function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (!field) return;
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const calculateButton = document.getElementById("natalCalculate");
  const natalChart = document.getElementById("natal-chart");

  const controlsContainer = document.createElement("div");

  controlsContainer.style.display = "flex";
  controlsContainer.style.alignItems = "center";
  controlsContainer.style.justifyContent = "center";
  controlsContainer.style.gap = "10px";
  controlsContainer.style.marginBottom = "12px";

  const leftArrow = document.createElement("button");
  leftArrow.type = "button";
  leftArrow.innerHTML = "&#8592;";
  leftArrow.title = "Decrement";
  leftArrow.className = "animation-control-btn";
  leftArrow.style.fontSize = "24px";
  leftArrow.style.cursor = "pointer";
  leftArrow.style.padding = "5px 15px";
  leftArrow.style.border = "none";
  leftArrow.style.borderRadius = "5px";

  const rightArrow = document.createElement("button");
  rightArrow.type = "button";
  rightArrow.innerHTML = "&#8594;";
  rightArrow.title = "Increment";
  rightArrow.className = "animation-control-btn";
  rightArrow.style.fontSize = "24px";
  rightArrow.style.cursor = "pointer";
  rightArrow.style.padding = "5px 15px";
  rightArrow.style.border = "none";
  rightArrow.style.borderRadius = "5px";

  const dropdown = document.createElement("select");
  dropdown.id = "adjustUnitNatal";
  dropdown.style.padding = "5px 10px";
  dropdown.style.fontSize = "18px";
  dropdown.style.fontFamily = '"Segoe UI", sans-serif';
  dropdown.style.borderRadius = "5px";
  dropdown.style.border = "1px solid #ccc";

  // Add default "Animate" option that does nothing
  const animateOption = document.createElement("option");
  animateOption.value = "animate";
  animateOption.text = "Animate";
  dropdown.appendChild(animateOption);

  const units = ["year", "month", "day", "hour", "minute"];
  units.forEach((unit) => {
    const option = document.createElement("option");
    option.value = unit;
    option.text = unit.charAt(0).toUpperCase() + unit.slice(1);
    dropdown.appendChild(option);
  });

  // Set default to "animate" (no action)
  dropdown.value = "animate";

  const nowButton = document.createElement("button");
  nowButton.type = "button";
  nowButton.textContent = "Now";
  nowButton.className = "animation-control-btn";
  nowButton.style.fontSize = "18px";
  nowButton.style.cursor = "pointer";
  nowButton.style.padding = "5px 15px";
  nowButton.style.border = "none";
  nowButton.style.borderRadius = "5px";

  controlsContainer.appendChild(leftArrow);
  controlsContainer.appendChild(dropdown);
  controlsContainer.appendChild(nowButton);
  controlsContainer.appendChild(rightArrow);

  natalChart.parentNode.insertBefore(controlsContainer, natalChart.nextSibling);

  function adjustDate(unit, direction) {
    let day = parseInt(document.getElementById("natalDay").value);
    let monthStr = document.getElementById("natalMonth").value;
    let year = parseHistoricalYearInput(document.getElementById("natalYear").value);
    let hour = parseInt(document.getElementById("natalHour").value);
    let minute = parseInt(document.getElementById("natalMinute").value);

    const monthNames = MONTH_NAMES;
    let month = monthNames.indexOf(monthStr) + 1;

    let date = makeHistoricalLocalDate(year, month - 1, day, hour, minute);

    const adjustValue = direction === "increment" ? 1 : -1;

    switch (unit) {
      case "year":
        date.setFullYear(date.getFullYear() + adjustValue);
        break;
      case "month":
        date.setMonth(date.getMonth() + adjustValue);
        break;
      case "day":
        date.setDate(date.getDate() + adjustValue);
        break;
      case "hour":
        date.setHours(date.getHours() + adjustValue);
        break;
      case "minute":
        date.setMinutes(date.getMinutes() + adjustValue);
        break;
      default:
        console.error("Unknown unit:", unit);
        return;
    }

    // Validate date range (10,000 BCE to 10,000 CE) and skip year 0
    const resultYear = astronomicalToHistoricalYear(date.getFullYear());
    if (resultYear < -9999 || resultYear > 9999 || resultYear === 0) {
      // Skip year 0 (doesn't exist in Gregorian calendar)
      if (resultYear === 0) {
        date.setFullYear(historicalToAstronomicalYear(direction === "increment" ? 1 : -1));
      } else {
        return;
      }
    }

    document.getElementById("natalDay").value = date.getDate();
    document.getElementById("natalMonth").value = monthNames[date.getMonth()];
    document.getElementById("natalYear").value = astronomicalToHistoricalYear(date.getFullYear());
    document.getElementById("natalHour").value = String(
      date.getHours()
    ).padStart(2, "0");
    document.getElementById("natalMinute").value = String(
      date.getMinutes()
    ).padStart(2, "0");

    calculateButton.click();
  }

  leftArrow.addEventListener("click", () => {
    const selectedUnit = dropdown.value;
    // Don't do anything if "Animate" is selected
    if (selectedUnit === "animate") {
      return;
    }
    adjustDate(selectedUnit, "decrement");
  });

  rightArrow.addEventListener("click", () => {
    const selectedUnit = dropdown.value;
    // Don't do anything if "Animate" is selected
    if (selectedUnit === "animate") {
      return;
    }
    adjustDate(selectedUnit, "increment");
  });

  nowButton.addEventListener("click", () => {
    const today = new Date();

    setFieldValue("natalName", "Today");
    setFieldValue("natalDay", today.getDate());
    setFieldValue("natalMonth", MONTH_NAMES[today.getMonth()]);
    setFieldValue("natalYear", today.getFullYear());
    setFieldValue("natalHour", String(today.getHours()).padStart(2, "0"));
    setFieldValue("natalMinute", String(today.getMinutes()).padStart(2, "0"));
    setFieldValue(
      "natalLocation",
      window.TrueSkyDefaultLocation?.get?.() ||
        document.getElementById("defaultLocation")?.value.trim() ||
        "New York City, New York, United States"
    );

    calculateButton.click();
  });
});
