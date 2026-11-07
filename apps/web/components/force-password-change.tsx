"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { makeT } from "@/lib/content";

type ForcePasswordChangeProps = {
  content: Record<string, string>;
  redirectTo: string;
};

export function ForcePasswordChange({ content, redirectTo }: ForcePasswordChangeProps) {
  const t = makeT(content);
  const router = useRouter();
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);

    if (password.next !== password.confirm) {
      setError(t("account.passwordMismatch"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/account/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: password.current,
          newPassword: password.next,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        { data?: { redirectTo?: string } } | { error?: { message?: string } } | null;

      if (!response.ok) {
        const message =
          body && "error" in body && body.error?.message
            ? body.error.message
            : t("account.forcePassword.error");
        setError(message);
        setSubmitting(false);
        return;
      }

      const destination =
        body && "data" in body && body.data?.redirectTo ? body.data.redirectTo : redirectTo;
      router.replace(destination);
      router.refresh();
    } catch {
      setError(t("account.forcePassword.networkError"));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
      {error ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-danger/25 bg-danger/[0.06] px-4 py-3 text-[0.8rem] leading-6 text-danger"
        >
          {error}
        </div>
      ) : null}

      <label className="block text-xs font-semibold">
        {t("account.currentPassword")}
        <input
          className="input mt-1.5"
          type="password"
          autoComplete="current-password"
          value={password.current}
          onChange={(event) => setPassword({ ...password, current: event.target.value })}
          required
        />
      </label>
      <label className="block text-xs font-semibold">
        {t("account.newPassword")}
        <input
          className="input mt-1.5"
          type="password"
          autoComplete="new-password"
          value={password.next}
          onChange={(event) => setPassword({ ...password, next: event.target.value })}
          minLength={10}
          maxLength={200}
          required
        />
      </label>
      <label className="block text-xs font-semibold">
        {t("account.confirmPassword")}
        <input
          className="input mt-1.5"
          type="password"
          autoComplete="new-password"
          value={password.confirm}
          onChange={(event) => setPassword({ ...password, confirm: event.target.value })}
          minLength={10}
          maxLength={200}
          required
        />
      </label>
      <p className="text-[0.7rem] leading-5 text-muted">{t("account.forcePassword.policy")}</p>

      <button type="submit" className="btn btn-primary w-full py-3.5" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("account.forcePassword.submitting")}
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {t("account.forcePassword.submit")}
          </>
        )}
      </button>
    </form>
  );
}
