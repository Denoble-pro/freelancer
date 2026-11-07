"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_LOCK = "dlp.sessionRefreshAt";
const MIN_INTERVAL = 5 * 60 * 1000;

export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    let lastCheck = Date.now();

    const rotate = async () => {
      try {
        const response = await fetch("/api/v1/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
        });
        if (response.status === 401 || response.status === 403) {
          router.replace("/login");
          router.refresh();
        }
      } catch {
        // Keep the current UI; a later navigation will re-check the session.
      }
    };

    const refresh = async () => {
      lastCheck = Date.now();
      const recent = Number(window.localStorage.getItem(REFRESH_LOCK) ?? 0);
      if (Date.now() - recent < MIN_INTERVAL) return;
      window.localStorage.setItem(REFRESH_LOCK, String(Date.now()));

      if (navigator.locks?.request) {
        await navigator.locks.request("dlp-session-refresh", rotate);
      } else {
        await rotate();
      }
    };

    const interval = window.setInterval(() => void refresh(), 10 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck > 10 * 60 * 1000) {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
