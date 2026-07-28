"use strict";

function initializeNavigation() {
  // Hide all sections. This ensures that only the selected section is visible
  function hideAllSections() {
    [
      "showNatal",
      "showTriwheel",
      "showGraph",
      "showReturn",
      "showSettings",
      "showSynastry",
      "showComposite",
      "showCommunity",
      "showHelp",
      "showAccount",
    ].forEach((sectionId) => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.style.display = "none";
      }
    });
    // Remove chat-active class when leaving CHAT section
    document.body.classList.remove("chat-active");
  }

  // Clean up the UI by removing the Graph tooltip and red date box if they exist
  function cleanupUI() {
    // Remove the Tooltip
    const tooltip = document.querySelector(".tooltip");
    if (tooltip) {
      tooltip.style.opacity = "0"; // Hide the tooltip
      tooltip.innerHTML = ""; // Clear any existing content
    }

    // Remove the Red Date Box
    const fixedDateText = document.getElementById("fixedDateText");
    if (fixedDateText) {
      fixedDateText.remove(); // Remove the red date box from the DOM
    }

    // Remove the Red Line
    const redLines = document.querySelectorAll("#graph svg .red-line");
    redLines.forEach((line) => line.remove());
  }

  // Change nav button on selection
  // Store all nav buttons and their corresponding sections
  const navButtons = [
    { id: "natal-button", section: "showNatal", icon: "natal" },
    { id: "triwheel-button", section: "showTriwheel", icon: "triwheel" },
    { id: "graph-button", section: "showGraph", icon: "graph" },
    { id: "return-button", section: "showReturn", icon: "return" },
    { id: "settings-button", section: "showSettings", icon: "settings" },
    { id: "synastry-button", section: "showSynastry", icon: "synastry" },
    { id: "composite-button", section: "showComposite", icon: "composite" },
    { id: "community-button", section: "showCommunity", icon: "community" },
    { id: "help-button", section: "showHelp", icon: "help" },
    { id: "account-button", section: "showAccount", icon: "account" },
  ];

  const iconDefaultFiles = {
    natal: "natal",
    triwheel: "triwheel",
    graph: "graph",
    return: "return",
    settings: "settings",
    synastry: "synastry",
    composite: "composite",
    community: "community",
    help: "help",
    account: "account",
  };

  const iconSelectedFiles = {
    natal: "natal-select",
    triwheel: "triwheel",
    graph: "graph",
    return: "return",
    settings: "settings",
    synastry: "synastry",
    composite: "composite",
    community: "community",
    help: "help",
    account: "account",
  };


  // Keep the top menu clean: each tab button must have exactly one label and one SVG image.
  // This prevents duplicated menu SVGs after tab changes or cached partial reloads.
  function normalizeNavButton(button, iconName) {
    if (!button) return null;

    const expectedAlt = `${iconName.charAt(0).toUpperCase() + iconName.slice(1)} Icon`;
    const imgs = Array.from(button.querySelectorAll("img"));
    let img = imgs[0];

    imgs.slice(1).forEach((extraImg) => extraImg.remove());

    if (!img) {
      img = document.createElement("img");
      img.alt = expectedAlt;
      button.appendChild(img);
    }

    img.alt = img.alt || expectedAlt;
    img.classList.add("menu-icon");
    return img;
  }

  function normalizeAllNavButtons() {
    navButtons.forEach(({ id, icon }) => {
      normalizeNavButton(document.getElementById(id), icon);
    });
  }

  // Reset all icons to their default version
  function resetAllIcons() {
    navButtons.forEach(({ id, icon }) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const img = normalizeNavButton(btn, icon);
      const label = btn.querySelector("span");
      const defaultIcon = iconDefaultFiles[icon] || icon;
      if (img) img.src = `images/menu/${defaultIcon}.svg`;

      label.classList.remove(
        "active-natal",
        "active-triwheel",
        "active-graph",
        "active-return",
        "active-settings",
        "active-synastry",
        "active-composite",
        "active-community",
        "active-help",
        "active-account"
      );
    });
  }

  // Show selected section and update the nav icon
  function showSection(buttonId, sectionId, iconName) {
    hideAllSections();
    document.getElementById(sectionId).style.display = "block";
    cleanupUI();
    resetAllIcons();

    const btn = document.getElementById(buttonId);
    const img = normalizeNavButton(btn, iconName);
    const label = btn.querySelector("span");
    const selectedIcon = iconSelectedFiles[iconName] || iconName;
    if (img) img.src = `images/menu/${selectedIcon}.svg`;
    label.classList.add(`active-${iconName}`);

    if (sectionId === "showTriwheel") {
      document.dispatchEvent(new Event("triwheel:shown"));
    }
    if (sectionId === "showGraph") {
      document.dispatchEvent(new Event("graph:shown"));
    }
    if (sectionId === "showSynastry") {
      document.dispatchEvent(new Event("synastry:shown"));
    }
    if (sectionId === "showCommunity") {
      document.body.classList.add("chat-active");
      const communitySection = document.getElementById("showCommunity");
      const channelToSelect = window.currentChannel || "ai";
      const channelBtn = communitySection?.querySelector(`.channel-btn[data-channel="${channelToSelect}"]`);
      if (channelBtn) {
        channelBtn.dispatchEvent(new MouseEvent("click", { view: window, bubbles: true, cancelable: true }));
      }
    }

  }

  normalizeAllNavButtons();

  // Attach event listeners dynamically
  navButtons.forEach(({ id, section, icon }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener("click", () => {
      showSection(id, section, icon);
    });
  });

  // Start on MAIN, empty and uncalculated. Do not open TRANSIT by default and
  // do not dispatch triwheel:shown on startup, otherwise the transit wheel is
  // calculated automatically.
  hideAllSections();
  const natalBtn = document.getElementById("natal-button");
  if (natalBtn) {
    const natalImg = normalizeNavButton(natalBtn, "natal");
    const natalLabel = natalBtn.querySelector("span");
    if (natalImg) natalImg.src = `images/menu/natal-select.svg`;
    if (natalLabel) natalLabel.classList.add("active-natal");
  }
  const defaultNatalSection = document.getElementById("showNatal");
  if (defaultNatalSection) {
    defaultNatalSection.style.display = "block";
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNavigation);
} else {
  initializeNavigation();
}
