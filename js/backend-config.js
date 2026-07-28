(function () {
  "use strict";

  // URL do backend/API no Render. Troque aqui se o Render gerar outro domínio.
  var DEFAULT_RENDER_API = "https://true-sky-astrologia.onrender.com";
  var configured = "";

  try {
    configured = (localStorage.getItem("TRUESKY_API_BASE_URL") || "").trim();
  } catch (e) {}

  var apiBase = (window.TRUESKY_API_BASE_URL || configured || DEFAULT_RENDER_API || "").trim();
  apiBase = apiBase.replace(/\/+$/, "");
  window.TRUESKY_API_BASE_URL = apiBase;

  window.trueskyApiUrl = function (path) {
    path = String(path || "");
    if (/^https?:\/\//i.test(path)) return path;
    if (!path.startsWith("/")) path = "/" + path;
    return apiBase ? apiBase + path : path;
  };

  var backendPaths = [
    "/api/",
    "/recent-charts",
    "/search-charts",
    "/save-chart",
    "/delete-chart",
    "/update-chart-timestamp",
    "/recent-profiles",
    "/save-profile",
    "/delete-profile",
    "/update-profile-timestamp",
    "/recent-settings",
    "/save-settings",
    "/delete-settings",
    "/update-settings-timestamp",
    "/save-default-location",
    "/view-report",
    "/import-charts",
    "/export-charts",
    "/delete-exported-charts",
    "/deleteAccount",
    "/chat-history/",
    "/delete-chat-message"
  ];

  function shouldRedirect(path) {
    return backendPaths.some(function (prefix) { return path === prefix || path.startsWith(prefix); });
  }

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if (originalFetch && apiBase) {
    window.fetch = function (input, init) {
      try {
        if (typeof input === "string" && input.startsWith("/") && shouldRedirect(input)) {
          return originalFetch(window.trueskyApiUrl(input), init);
        }
        if (input && typeof input.url === "string") {
          var url = new URL(input.url, window.location.href);
          if (url.origin === window.location.origin && shouldRedirect(url.pathname)) {
            var redirected = window.trueskyApiUrl(url.pathname + url.search + url.hash);
            return originalFetch(new Request(redirected, input), init);
          }
        }
      } catch (e) {}
      return originalFetch(input, init);
    };
  }
})();
