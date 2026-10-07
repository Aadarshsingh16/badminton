
// lib/viewerMode.ts — Persistent spectator mode tracking across tabs and navigation

import React from "react";

const VIEWER_SLUG_KEY = "badminton_viewer_slug";
const VIEWER_ACTIVE_KEY = "badminton_is_viewer";

export function setViewerSlug(slug: string) {
  if (typeof window !== "undefined" && slug) {
    localStorage.setItem(VIEWER_SLUG_KEY, slug.trim());
    window.dispatchEvent(new Event("viewer-mode-change"));
  }
}

export function getViewerSlug(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(VIEWER_SLUG_KEY) || null;
  }
  return null;
}

export function isViewerMode(): boolean {
  if (typeof window !== "undefined") {
    return window.location.pathname.startsWith("/live");
  }
  return false;
}

export function clearViewerMode() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(VIEWER_SLUG_KEY);
    localStorage.removeItem(VIEWER_ACTIVE_KEY);
    window.dispatchEvent(new Event("viewer-mode-change"));
  }
}

/**
 * React hook to reactively subscribe to spectator mode status
 */
export function useViewerStatus() {
  const [isViewer, setIsViewer] = React.useState(false);
  const [slug, setSlug] = React.useState<string | null>(null);

  React.useEffect(() => {
    const update = () => {
      setIsViewer(isViewerMode());
      setSlug(getViewerSlug());
    };
    update();
    window.addEventListener("viewer-mode-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("viewer-mode-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return { isViewer, slug };
}
