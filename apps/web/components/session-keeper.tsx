"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    let lastCheck = Date.now();

    const refresh = async () => {
      lastCheck = Date.now();
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

    const interval = window.setInterval(refresh, 10 * 60 * 1000);
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
