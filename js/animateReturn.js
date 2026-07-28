"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // load the original birth data
  let natalData = null;
  try {
    natalData = JSON.parse(localStorage.getItem("natalData"));
  } catch (_) {}

  const returnChart = document.getElementById("return-chart");

  // Create and style controls container
  const controlsContainer = document.createElement("div");
  controlsContainer.style.display = "flex";
  controlsContainer.style.alignItems = "center";
  controlsContainer.style.justifyContent = "center";
  controlsContainer.style.gap = "10px";
  controlsContainer.style.marginBottom = "12px";

  // Arrow buttons
  const leftArrow = document.createElement("button");
  leftArrow.type = "button";
  leftArrow.innerHTML = "&#8592;";
  leftArrow.title = "Previous";
  leftArrow.className = "animation-control-btn";
  leftArrow.style.fontSize = "24px";
  leftArrow.style.cursor = "pointer";
  leftArrow.style.padding = "5px 15px";
  leftArrow.style.border = "none";
  leftArrow.style.borderRadius = "5px";

  const rightArrow = document.createElement("button");
  rightArrow.type = "button";
  rightArrow.innerHTML = "&#8594;";
  rightArrow.title = "Next";
  rightArrow.className = "animation-control-btn";
  rightArrow.style.fontSize = "24px";
  rightArrow.style.cursor = "pointer";
  rightArrow.style.padding = "5px 15px";
  rightArrow.style.border = "none";
  rightArrow.style.borderRadius = "5px";

  // Dropdown
  const dropdown = document.createElement("select");
  dropdown.id = "adjustType";
  dropdown.style.padding = "5px 10px";
  dropdown.style.fontSize = "18px";
  dropdown.style.fontFamily = '"Segoe UI", sans-serif';
  dropdown.style.borderRadius = "5px";
  dropdown.style.border = "1px solid #ccc";
  ["Solar", "Lunar"].forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.text = type;
    dropdown.appendChild(option);
  });

  const currentButton = document.createElement("button");
  currentButton.type = "button";
  currentButton.textContent = "Current";
  currentButton.title = "Set to current return";
  currentButton.className = "animation-control-btn";
  currentButton.style.fontSize = "18px";
  currentButton.style.cursor = "pointer";
  currentButton.style.padding = "5px 15px";
  currentButton.style.border = "none";
  currentButton.style.borderRadius = "5px";

  controlsContainer.appendChild(leftArrow);
  controlsContainer.appendChild(dropdown);
  controlsContainer.appendChild(currentButton);
  controlsContainer.appendChild(rightArrow);
  returnChart.parentNode.insertBefore(
    controlsContainer,
    returnChart.nextSibling
  );

  // Form elements
  const offsetInput = document.getElementById("returnOffset");
  const calculateButton = document.getElementById("returnCalculate");
  const nameField = document.getElementById("returnName");
  const dayField = document.getElementById("returnDay");
  const monthField = document.getElementById("returnMonth");
  const yearField = document.getElementById("returnYear");
  const hourField = document.getElementById("returnHour");
  const minuteField = document.getElementById("returnMinute");
  const locationField = document.getElementById("returnLocation");

  async function updateReturn(offsetChange) {
    // re-read natalData fresh each time
    const natalData = JSON.parse(localStorage.getItem("natalData") || "null");
    if (!natalData) {
      console.error("No natalData in storage.");
      return;
    }

    const isRelocatedInput = document.getElementById("isRelocated");
    if (isRelocatedInput) isRelocatedInput.value = "true";

    const currentOffset = parseInt(offsetInput.value, 10);
    const newOffset = currentOffset + offsetChange;
    offsetInput.value = newOffset;

    const returnType = dropdown.value;

    // grab the user’s zodiac system choice
    const zodiacSystemEl = document.querySelector(
      "#system-settings select[name='zodiacSystem']"
    );
    const selectedZodiacSystem = zodiacSystemEl
      ? zodiacSystemEl.value
      : "Tropical";

    // grab the user’s coordinate system choice (Geocentric vs Topocentric)
    const coordinateSystemEl = document.querySelector(
      "#system-settings select[name='coordinateSystem']"
    );
    const selectedCoordinateSystem = coordinateSystemEl
      ? coordinateSystemEl.value
      : "Geocentric";

    const payload = {
      formType: "chart",
      name: nameField.value,
      day: parseInt(natalData.day, 10),
      month: natalData.month,
      year: parseInt(natalData.year, 10),
      hour: parseInt(natalData.hour, 10),
      minute: parseInt(natalData.minute, 10),
      location: locationField.value,
      returnOffset: newOffset,
      form: "return",
      preservedNatalLocation: natalData.location,
      returnLocation: locationField.value,
      returnType,
      selectedZodiacSystem,
      selectedCoordinateSystem,
    };

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });

      // Check for any HTTP error
      if (!response.ok) {
        const data = await response.json();
        const errorContainer = document.querySelector("#returnForm .errorMessage");
        if (errorContainer && data.error) {
          errorContainer.textContent = data.error;
          setTimeout(() => {
            errorContainer.textContent = "";
          }, 5000);
        }
        return;
      }

      const returnISO = response.headers.get("X-Return-Date");
      const relocatedDiffRaw = response.headers.get("X-Relocated-Diff") || "0";
      const relocatedDiff = parseInt(relocatedDiffRaw, 10);

      if (returnISO) {
        const date = new Date(returnISO);

        // If we're in relocated mode, shift by the server-computed offset
        const isRelocated =
          document.getElementById("isRelocated").value === "true";
        if (isRelocated && relocatedDiff) {
          date.setUTCMinutes(date.getUTCMinutes() + relocatedDiff);
        }

        // Update form fields
        dayField.value = String(date.getUTCDate()).padStart(2, "0");

        const monthNames = ["January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"];
        monthField.value = monthNames[date.getUTCMonth()];
        const hiddenMonth = document.querySelector("input[name='month']");
        if (hiddenMonth) hiddenMonth.value = monthField.value;

        yearField.value = (date.getUTCFullYear() <= 0 ? date.getUTCFullYear() - 1 : date.getUTCFullYear());
        hourField.value = String(date.getUTCHours()).padStart(2, "0");
        minuteField.value = String(date.getUTCMinutes()).padStart(2, "0");

        // Submit form after inputs are updated
        requestAnimationFrame(() => {
          calculateButton.click(); // trigger real user-like click
        });
      }
    } catch (err) {
      console.error("Error fetching return:", err);
    }
  }

  // Bind arrow buttons
  leftArrow.addEventListener("click", () => {
    updateReturn(-1);
  });
  rightArrow.addEventListener("click", () => {
    updateReturn(1);
  });
  currentButton.addEventListener("click", () => {
    offsetInput.value = "0";
    updateReturn(0);
  });

  // When user changes the return‐location update return chart
  let locationChangeTimeout;
  locationField.addEventListener("change", () => {
    // Clear any pending timeout
    if (locationChangeTimeout) clearTimeout(locationChangeTimeout);
    // Wait a bit to ensure the value is fully settled
    locationChangeTimeout = setTimeout(() => {
      currentButton.click();
    }, 100);
  });

  // When user selects return type reset to “current”
  dropdown.addEventListener("change", () => {
    currentButton.click();
  });
});
