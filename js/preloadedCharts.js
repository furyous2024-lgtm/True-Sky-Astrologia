document.addEventListener("DOMContentLoaded", function () {
  const today = new Date();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const day = today.getDate();
  const month = monthNames[today.getMonth()];
  const year = today.getFullYear();
  const hour = String(today.getHours()).padStart(2, "0");
  const minute = String(today.getMinutes()).padStart(2, "0");
  const defaultLocation =
    window.TrueSkyDefaultLocation?.get?.() ||
    document.getElementById("defaultLocation")?.value.trim() ||
    "New York City, New York, United States";

  function setValue(id, value, { force = false } = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    if (force || !String(el.value || "").trim()) el.value = String(value);
  }

  function fillDate(prefix, { force = false, location = true, name = false } = {}) {
    if (name) setValue(`${prefix}Name`, "Today", { force });
    setValue(`${prefix}Day`, day, { force });
    setValue(`${prefix}Month`, month, { force });
    setValue(`${prefix}Year`, year, { force });
    setValue(`${prefix}Hour`, hour, { force });
    setValue(`${prefix}Minute`, minute, { force });
    if (location) setValue(`${prefix}Location`, defaultLocation, { force });
  }

  // Preload today's data so every wheel is ready for the user to click Calculate.
  // This intentionally does NOT submit any form or start an automatic calculation.
  fillDate("natal", { name: true });
  fillDate("triwheel");
  fillDate("synastry", { name: true });

  // Transit Graph starts and ends on today's date by default now.
  setValue("graphStartDay", day);
  setValue("graphStartMonth", month);
  setValue("graphStartYear", year);
  setValue("graphStartHour", hour);
  setValue("graphStartMinute", minute);
  setValue("graphEndDay", day);
  setValue("graphEndMonth", month);
  setValue("graphEndYear", year);
  setValue("graphEndHour", hour);
  setValue("graphEndMinute", minute);
  setValue("graphLocation", defaultLocation);

  // Hidden triwheel used by the graph/report flow.
  setValue("triwheelDayGraph", day);
  setValue("triwheelMonthGraph", month);
  setValue("triwheelYearGraph", year);
  setValue("triwheelHourGraph", hour);
  setValue("triwheelMinuteGraph", minute);
  setValue("triwheelLocationGraph", defaultLocation);
});
