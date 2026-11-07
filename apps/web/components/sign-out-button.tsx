"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

type SignOutButtonProps = {
  label: string;
  allDevices?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function SignOutButton({
  label,
  allDevices = false,
  className = "",
  variant = "secondary",
}: SignOutButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/v1/auth/${allDevices ? "logout-all" : "logout"}`, {
        method: "POST",
        credentials: "same-origin",
      });
      router.replace("/login");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={`btn btn-${variant} ${className}`}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
