function handleNamePhoto() {
  const firebaseUser = window.TrueSkyAuth?.currentUser || window.TrueSkyAuth?.auth?.currentUser || null;
  const usesGoogle = firebaseUser?.providerData?.some((provider) => provider.providerId === "google.com") || window.user?.provider === "google";

  if (usesGoogle) {
    window.open("https://myaccount.google.com/personal-info", "_blank", "noopener,noreferrer");
    return;
  }

  const displayName = prompt("Display name:", window.TrueSkyAccountProfile?.read?.().displayName || window.user?.display_name || "");
  if (displayName && window.user) {
    window.user.display_name = displayName.trim();
    window.user.displayName = displayName.trim();
    window.TrueSkyAccountProfile?.apply?.();
  }
}
