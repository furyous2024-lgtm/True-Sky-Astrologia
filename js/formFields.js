document.addEventListener("DOMContentLoaded", () => {
  // Prevent drag and drop on all form inputs and selects
  const formElements = document.querySelectorAll('.form input, .form select');
  formElements.forEach(element => {
    element.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });
    element.addEventListener('drop', (e) => {
      e.preventDefault();
      return false;
    });
    element.addEventListener('dragover', (e) => {
      e.preventDefault();
      return false;
    });
  });

  // Year fields with BCE negative symbol
  const yearInputs = [
    "natalYear",
    "triwheelYear",
    "graphStartYear",
    "graphEndYear",
    "synastryYear",
    "triwheelYearGraph",
    "returnYear",
  ]
    .map((id) => document.getElementById(id))
    .filter((el) => el !== null);

  yearInputs.forEach((input) => {
    input.addEventListener("input", function () {
      let value = this.value;

      // Accept AD/CE years as plain numbers and BC/BCE as either a leading minus
      // or text suffix: -44, 44 BC, 44 BCE, 44 AC, 44 a.C.
      value = value.replace(/[^0-9a-zA-Z.\-\s]/g, "");
      value = value.replace(/(?!^)-/g, "");

      const yearMatch = value.match(/-?\d{0,5}/);
      const hasBceSuffix = /\b(bc|bce|ac|a\.?c\.?)\b/i.test(value);
      const yearPart = yearMatch ? yearMatch[0] : "";

      if (yearPart) {
        const sign = yearPart.startsWith("-") || hasBceSuffix ? "-" : "";
        const digits = yearPart.replace(/\D/g, "").slice(0, 5);
        value = sign + digits + (hasBceSuffix && !sign ? " BC" : "");
      }

      this.value = value;
    });
  });

  // Number only fields
  const numericInputIDs = [
    "natalDay",
    "natalHour",
    "natalMinute",
    "triwheelDay",
    "triwheelHour",
    "triwheelMinute",
    "graphStartDay",
    "graphStartHour",
    "graphStartMinute",
    "graphEndDay",
    "graphEndHour",
    "graphEndMinute",
    "synastryDay",
    "triwheelDayGraph",
    "triwheelHourGraph",
    "triwheelMinuteGraph",
    "synastryHour",
    "synastryMinute",
  ];

  numericInputIDs.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, ""); // remove non-digit characters

      if (this.value.length > 2) {
        this.value = this.value.slice(0, 2);
      }
    });
  });
});
